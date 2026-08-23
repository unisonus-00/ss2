#!/usr/bin/env node
/* Build dist/abhyasah.html from app/ plus every lesson's practice.json.
 *
 * The whole point of the distributable is that it is one file with nothing
 * to fetch: it has to open from file:// on a phone with no network.  So the
 * build inlines app/styles.css, app/app.js and the practice data, and then
 * proves the result is still self-contained.
 *
 *   node scripts/build.js [--check]
 *
 * --check builds in memory and fails if the result differs from what is
 * already on disk, without writing.  Use it to prove a source change was
 * purely mechanical.
 *
 * Practice data is discovered, never listed: any numbered lesson directory
 * holding a practice.json is picked up, in directory order, so adding a
 * lesson's practice needs no change here.  Cross-cutting practice that
 * belongs to no single lesson lives in ./practice.json beside 00-overview.md.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const markdown = require('./markdown');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist', 'abhyasah.html');

const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const LINK = '<link rel="stylesheet" href="styles.css">';
const SCRIPT = '<script src="app.js"></script>';
const PRACTICE = /<script id="practice" type="application\/json">[\s\S]*?<\/script>/;
const REFERENCE = /<script id="references" type="application\/json">[\s\S]*?<\/script>/;
/* A contents list earns its place on a long reference and clutters a short
   one.  Five top-level sections is where these files start needing one. */
const TOC_FROM = 5;
/* The brand mark is a separate source file so it can be redrawn or replaced
   without touching the markup, and is inlined here — the distributable has to
   stay one file with nothing to fetch. */
const LOGO = '<!--logo-->';
const BUILD = '<!--build-->';

const CARD_TYPES = new Set(['reveal', 'choice', 'sequence']);
/* The three streams a list can be in: the core acquisition path (the
   default, and what a track's percentage is measured against), the
   enrichment that widens it, and the formal grammar drawn under
   Vyākaraṇam.  See `streamOf` in app.js. */
const STREAMS = new Set(['core', 'enrichment', 'grammar']);

/* ── discover ───────────────────────────────────────────────────────── */

/* A lesson's name and its English gloss, both taken from its own theory.md
   heading so the navigation and the curriculum cannot drift apart.  Every
   heading has the same shape:
 *
 *     # Stage 6: Kriyā — Verbs
 *                 ^^^^^   ^^^^^
 *                 label   gloss
 *
 * The stage number is dropped here rather than displayed: it is how this
 * repository orders its directories, not something a learner needs to read.
 * A trailing parenthetical is dropped too — "Case, Number, and Gender
 * (Declension)" is longer than a subheading can carry. */
function lessonTitle(dir) {
  /* Named for what the lists hold rather than for the section they sit in:
     Vyākaraṇam now heads a section that also carries the formal layer of four
     acquisition stages, and a group inside it called Vyākaraṇam would be the
     same word one level down. */
  if (dir === '00-overview') {
    return { label: 'Saṃjñā', gloss: 'Terminology Used Throughout' };
  }
  const p = path.join(ROOT, dir, 'theory.md');
  let label = dir.slice(3), gloss = '';
  if (fs.existsSync(p)) {
    const h = fs.readFileSync(p, 'utf8').split('\n').find(l => l.startsWith('#'));
    if (h) {
      const parts = h.replace(/^#+\s*/, '').replace(/^Stage\s+\d+\s*:\s*/i, '').split(/\s+—\s+/);
      label = parts[0].trim();
      gloss = (parts[1] || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
  }
  return { label, gloss };
}

function discover() {
  const found = [];

  for (const d of fs.readdirSync(ROOT).sort()) {
    if (!/^\d\d-/.test(d)) continue;
    if (!fs.statSync(path.join(ROOT, d)).isDirectory()) continue;
    const f = path.join(ROOT, d, 'practice.json');
    if (fs.existsSync(f)) found.push({ dir: d, stage: +d.slice(0, 2), file: f });
  }

  /* Cross-cutting practice belongs to no stage, so it goes after the
     curriculum rather than before it — the app should open on stage 1
     vocabulary, not on abstract grammatical terminology. */
  const root = path.join(ROOT, 'practice.json');
  if (fs.existsSync(root)) found.push({ dir: '00-overview', stage: 0, file: root });

  return found;
}

/* A lesson's reference.md, rendered.  Study is a reference viewer, so the
   content goes through essentially verbatim: no summarising, no extraction,
   no cards made from it.  A lesson with no reference.md simply gets none, and
   the app hides the button rather than opening an empty panel. */
function loadReferences(lessons) {
  const out = {};
  for (const { lesson } of lessons) {
    const f = path.join(ROOT, lesson, 'reference.md');
    if (!fs.existsSync(f)) continue;
    const { html, toc } = markdown.render(fs.readFileSync(f, 'utf8'));
    /* A reference opens with its own title — "Stage 5: Rūpa — Reference
       Guide" — and the panel already has a heading, so the h1 would be the
       same words twice.  Dropped here rather than hidden in CSS, so the
       contents list underneath cannot pick it up either.  The panel titles
       itself from the LESSON, which keeps Study and the drawer agreeing and
       does not depend on how a given reference happens to head itself. */
    const sections = toc.filter(t => t.level === 2);
    out[lesson] = {
      html: html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\n?/, ''),
      toc: sections.length >= TOC_FROM ? sections : []
    };
  }
  return out;
}

/* ── validate ───────────────────────────────────────────────────────── */

function loadPractice() {
  const problems = [];
  const ids = new Map();          // id -> where it was first seen
  const lessons = [];
  let cards = 0, decks = 0;

  for (const { dir, stage, file } of discover()) {
    const where = path.relative(ROOT, file);

    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { problems.push(`${where}: not valid JSON — ${e.message}`); continue; }

    if (data.lesson && data.lesson !== dir) {
      problems.push(`${where}: says lesson "${data.lesson}" but sits in ${dir}`);
    }
    if (!Array.isArray(data.decks)) {
      problems.push(`${where}: no "decks" array`);
      continue;
    }

    const outDecks = [];
    data.decks.forEach((deck, di) => {
      const at = `${where} deck ${di}`;
      if (!deck.name) { problems.push(`${at}: no name`); return; }
      if (!Array.isArray(deck.cards) || !deck.cards.length) {
        problems.push(`${at} ("${deck.name}"): no cards`); return;
      }
      /* Which of the three streams the list is in.  Absent is the core
         acquisition path; a typo here would quietly drop a list out of the
         track's percentage or move it to another section altogether. */
      if (deck.stream !== undefined && !STREAMS.has(deck.stream)) {
        problems.push(`${at} ("${deck.name}"): unknown stream "${deck.stream}" — `
          + `expected one of ${[...STREAMS].join(', ')}`);
        return;
      }
      /* "breadth" already says the list widens rather than carries, so a
         breadth list on the core path is a contradiction rather than a
         choice. */
      if (deck.role === 'breadth' && deck.stream === 'core') {
        problems.push(`${at} ("${deck.name}"): a breadth list cannot be in the core stream`);
        return;
      }
      /* `pair` names what a reveal card runs between, so the direction button
         can say so and say the reverse.  Both labels come from this one
         string, so it has to have exactly one arrow with text either side. */
      if (deck.pair !== undefined) {
        const halves = String(deck.pair).split(' → ');
        if (halves.length !== 2 || !halves[0].trim() || !halves[1].trim()) {
          problems.push(`${at} ("${deck.name}"): pair "${deck.pair}" must read "front → back"`);
          return;
        }
      }

      deck.cards.forEach((c, ci) => {
        const at2 = `${where} "${deck.name}" card ${ci}`;
        if (!c.id) { problems.push(`${at2}: no id`); return; }
        if (ids.has(c.id)) { problems.push(`duplicate id "${c.id}" — ${where} and ${ids.get(c.id)}`); return; }
        ids.set(c.id, where);

        const type = c.type || 'reveal';
        if (!CARD_TYPES.has(type)) {
          problems.push(`${at2} (${c.id}): unknown type "${c.type}"`); return;
        }
        if (type === 'reveal' && !c.devanagari && !c.front) {
          problems.push(`${at2} (${c.id}): reveal card with nothing to show`); return;
        }
        if (type === 'choice') {
          if (!Array.isArray(c.options) || c.options.length < 2) {
            problems.push(`${at2} (${c.id}): choice card needs at least 2 options`); return;
          }
          if (c.answer === undefined || c.answer === '') {
            problems.push(`${at2} (${c.id}): choice card has no answer`); return;
          }
          if (!c.options.includes(c.answer)) {
            problems.push(`${at2} (${c.id}): answer "${c.answer}" is not one of its options`); return;
          }
        }
        if (type === 'sequence') {
          if (!Array.isArray(c.parts) || !c.parts.length) {
            problems.push(`${at2} (${c.id}): sequence card needs parts`); return;
          }
          if (!Array.isArray(c.answer) || !c.answer.length) {
            problems.push(`${at2} (${c.id}): sequence answer must be a non-empty array`); return;
          }
          const bank = c.parts.slice();
          const missing = c.answer.find(a => {
            const i = bank.indexOf(a);
            if (i === -1) return true;
            bank.splice(i, 1);
            return false;
          });
          if (missing !== undefined) {
            problems.push(`${at2} (${c.id}): answer piece "${missing}" is not in parts`); return;
          }
        }
        cards++;
      });

      outDecks.push(deck);
      decks++;
    });

    lessons.push({ lesson: dir, stage, ...lessonTitle(dir), decks: outDecks });
  }

  /* A practice.json somewhere it does not belong is a silent no-op otherwise:
     it would simply never be discovered. */
  for (const f of fs.readdirSync(ROOT)) {
    const p = path.join(ROOT, f, 'practice.json');
    if (/^\d\d-/.test(f) || !fs.existsSync(p)) continue;
    problems.push(`${f}/practice.json: not a numbered lesson directory, so it is never loaded`);
  }

  return { lessons, problems, cards, decks };
}

/* ── build ──────────────────────────────────────────────────────────── */

function build() {
  let html = read('index.html');

  const { lessons, problems, cards, decks } = loadPractice();
  if (problems.length) {
    console.error('build: practice data is invalid —');
    problems.forEach(p => console.error('  ' + p));
    process.exit(1);
  }
  if (!PRACTICE.test(html)) throw new Error('index.html has no <script id="practice"> block');
  /* "</script>" inside a JSON island would end the island.  \\/ is a legal
     JSON escape for /, so this survives the round trip unchanged. */
  const island = o => JSON.stringify(o).replace(/<\//g, '<\\/');

  html = html.replace(PRACTICE,
    '<script id="practice" type="application/json">' + island({ lessons }) + '</script>');

  const references = loadReferences(lessons);
  if (!REFERENCE.test(html)) throw new Error('index.html has no <script id="references"> block');
  html = html.replace(REFERENCE,
    '<script id="references" type="application/json">' + island(references) + '</script>');

  for (const [tag, file, open, close] of [
    [LINK, 'styles.css', '<style>', '</style>'],
    [SCRIPT, 'app.js', '<script>', '</script>'],
    [LOGO, 'logo.svg', '', ''],
  ]) {
    if (!html.includes(tag)) throw new Error(`index.html has no ${tag}`);
    /* An inlined file must not quote the placeholder it is inlined at.  An
       HTML comment ends at its first "--" + ">" whatever the nesting, so a
       logo.svg whose header comment mentions <!--logo--> literally closes
       that comment early and spills its own prose into the page as text. */
    if (tag !== LINK && tag !== SCRIPT && read(file).includes(tag)) {
      throw new Error(`app/${file} quotes its own placeholder ${tag}; `
        + 'an HTML comment would end there and leak the rest into the page');
    }
    if (html.indexOf(tag) !== html.lastIndexOf(tag)) {
      throw new Error(`index.html repeats ${tag}; the build would inline it twice`);
    }
    html = html.replace(tag, open + '\n' + read(file).replace(/\s*$/, '') + '\n' + close);
  }
  /* Which build this is, stamped into the page so a report can name it.
     Derived from the output itself rather than from the clock: a timestamp
     would make --check fail every day for no reason. */
  const stamp = crypto.createHash('sha256').update(html).digest('hex').slice(0, 7);
  html = html.replace(BUILD, stamp);
  return { html, lessons, cards, decks, stamp, refs: Object.keys(references).length };
}

/* A page that reaches the network is a broken page here, so the build refuses
   to emit one.  Checks the output, not the source, so it also catches anything
   an inlined file smuggles in. */
function assertSelfContained(html) {
  const banned = [
    [/<link\b(?![^>]*rel=["']?icon)/i, 'a <link> to an external stylesheet'],
    [/<script\b[^>]*\bsrc=/i, 'a <script src=...>'],
    [/\bfetch\s*\(/, 'a fetch() call'],
    [/\bXMLHttpRequest\b/, 'an XMLHttpRequest'],
    [/\bnew\s+WebSocket\b/, 'a WebSocket'],
    [/@import\b/, 'a CSS @import'],
    [/url\(\s*["']?(?:https?:)?\/\//i, 'a remote url() asset'],
    [/["'](?:https?:)?\/\/[^"']*\.(?:css|js|woff2?|ttf|png|jpe?g|svg)\b/i, 'a remote asset reference'],
  ];
  for (const [re, what] of banned) {
    const m = html.match(re);
    if (m) throw new Error(`output is not self-contained: found ${what} — ${m[0].slice(0, 60)}`);
  }
}

const { html, lessons, cards, decks, stamp, refs } = build();
assertSelfContained(html);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (current === html) {
    console.log('build --check: dist/abhyasah.html is up to date');
    process.exit(0);
  }
  console.error('build --check: dist/abhyasah.html differs from a fresh build of app/');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(
  `build: dist/abhyasah.html  ${(html.length / 1024).toFixed(0)} KB  ` +
  `${lessons.length} lessons, ${decks} decks, ${cards} cards, ${refs} references  · ${stamp}`
);
