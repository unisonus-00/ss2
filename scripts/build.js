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
const lexicon = require('./lexicon');
const iconry = require('./icons');
const pwaOut = require('./pwa');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist', 'abhyasah.html');
/* The one thing the installable layer cannot inline: a service worker is
   registered from a script URL, so it has to be a file of its own beside the
   page.  See scripts/pwa.js — the page works without it, and does not look
   for it at all unless it is being served. */
const SW = path.join(ROOT, 'dist', 'sw.js');

const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const LINK = '<link rel="stylesheet" href="styles.css">';
const SCRIPT = '<script src="app.js"></script>';
const PRACTICE = /<script id="practice" type="application\/json">[\s\S]*?<\/script>/;
const LEXICON  = /<script id="lexicon" type="application\/json">[\s\S]*?<\/script>/;
const THEORY   = /<script id="theory-md" type="application\/json">[\s\S]*?<\/script>/;
const MANIFEST = /<script id="manifest" type="application\/json">[\s\S]*?<\/script>/;
/* A contents list earns its place on a long reference and clutters a short
   one.  Five top-level sections is where these files start needing one. */
const TOC_FROM = 5;
/* The brand mark is a separate source file so it can be redrawn or replaced
   without touching the markup, and is inlined here — the distributable has to
   stay one file with nothing to fetch. */
const LOGO = '<!--logo-->';
const BUILD = '<!--build-->';
const PWA = '<!--pwa-->';

const CARD_TYPES = new Set(['reveal', 'choice', 'sequence']);
/* The five streams a list can be in: the core acquisition path (the default,
   and what a track's percentage is measured against), the enrichment that
   widens it, the formal grammar drawn under Vyākaraṇam, the paradigm
   production drawn under Rūpa-siddhi, and the script literacy drawn under
   Devanagari, ahead of the course.  See `streamOf` in app.js. */
const STREAMS = new Set(['core', 'enrichment', 'grammar', 'mastery', 'script']);

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

/* A lesson's theory.md, rendered.  Where reference.md is lookup, theory.md is
   the lesson's own teaching — what the stage is for, the objective, the worked
   examples — and it is what a learner reads to understand a lesson before (or
   while) practising it.  It goes through the same narrow renderer as the
   reference, verbatim, no cards made from it.  A lesson with no theory.md
   simply gets none, and the app hides its book-link rather than opening an
   empty panel.

   The `00-overview` "lesson" is not a directory but the root `00-overview.md`;
   it is the terminology used throughout, so its own file stands in as its
   teaching where a directory theory.md would sit. */
function loadTheory(lessons) {
  const out = {};
  for (const { lesson } of lessons) {
    let f = path.join(ROOT, lesson, 'theory.md');
    if (!fs.existsSync(f)) {
      const flat = path.join(ROOT, lesson + '.md');   // 00-overview.md and the like
      if (fs.existsSync(flat)) f = flat; else continue;
    }
    const { html, toc } = markdown.render(fs.readFileSync(f, 'utf8'));
    /* Titled from the lesson in the panel, so the file's own h1 would be the
       same words twice — dropped here, exactly as the reference's is, so the
       contents list underneath cannot pick it up either. */
    const sections = toc.filter(t => t.level === 2);
    out[lesson] = {
      html: html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\n?/, ''),
      toc: sections.length >= TOC_FROM ? sections : []
    };
  }
  return out;
}

/* ── the installable layer ──────────────────────────────────────────
   Every icon the launcher needs travels inside the page as a data: URI, so
   a single file dropped on any host installs — see scripts/pwa.js for why
   the service worker is the one piece that cannot travel with them.

   The two <link>s go in the head; the manifest goes in as a JSON island
   instead, because it is the page that has to finish it.  It has one field
   the build cannot know — where the app starts, which is wherever the file
   was opened from — and app.js writes that in and links the result. */
function pwaBuild() {
  const built = iconry.icons(path.join(APP, 'logo.png'));
  const find = n => built.find(i => i.name === n);
  const uri = n => iconry.dataUri(find(n).png);
  const entry = (n, purpose) => ({
    src: uri(n), sizes: `${find(n).size}x${find(n).size}`,
    type: 'image/png', purpose,
  });
  return {
    html: [
      `<link rel="icon" type="image/png" href="${uri('favicon.png')}">`,
      `<link rel="apple-touch-icon" href="${uri('apple-touch-icon.png')}">`,
    ].join('\n'),
    manifest: pwaOut.manifest([
      entry('icon-192.png', 'any'),
      entry('icon-512.png', 'any'),
      entry('icon-maskable.png', 'maskable'),
    ]),
    icons: built.length,
    bytes: built.reduce((n, i) => n + i.png.length, 0),
  };
}

/* ── validate ───────────────────────────────────────────────────────── */

/* Read every lesson's practice.json.  Nothing is validated here: the lexical
   layer adds lists and clues after this, and generated practice has to face
   exactly the checks authored practice does — so validation runs over the
   finished set, below. */
function readPractice() {
  const problems = [];
  const lessons = [];

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

    lessons.push({ lesson: dir, stage, ...lessonTitle(dir),
                   where, decks: data.decks });
  }

  /* A practice.json somewhere it does not belong is a silent no-op otherwise:
     it would simply never be discovered. */
  for (const f of fs.readdirSync(ROOT)) {
    const p = path.join(ROOT, f, 'practice.json');
    if (/^\d\d-/.test(f) || !fs.existsSync(p)) continue;
    problems.push(`${f}/practice.json: not a numbered lesson directory, so it is never loaded`);
  }

  return { lessons, problems };
}

/* Every check the practice data has to pass, run over the finished set —
   what the lessons carry plus what the lexical layer added, so a generated
   list is held to exactly what an authored one is. */
function validate(lessons) {
  const problems = [];
  const ids = new Map();          // id -> where it was first seen
  let cards = 0, decks = 0;

  for (const L of lessons) {
    const where = L.where;
    const outDecks = [];
    L.decks.forEach((deck, di) => {
      const at = `${where} deck ${di}`;
      if (!deck.name) { problems.push(`${at}: no name`); return; }
      if (!Array.isArray(deck.cards) || !deck.cards.length) {
        problems.push(`${at} ("${deck.name}"): no cards`); return;
      }
      /* Which of the four streams the list is in.  Absent is the core
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
    L.decks = outDecks;
    delete L.where;
  }

  return { problems, cards, decks };
}

/* ── build ──────────────────────────────────────────────────────────── */

function build() {
  let html = read('index.html');

  const { lessons, problems: unread } = readPractice();
  /* The lexical layer goes on before anything is validated: it clues cards
     the lessons already carry and adds the lists the relationships make
     possible, and both have to face the same checks. */
  const lex = lessons.length ? lexicon.apply(lessons) : { problems: [] };
  const { problems: bad, cards, decks } = validate(lessons);
  const problems = [...unread, ...lex.problems, ...bad];
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

  if (!LEXICON.test(html)) throw new Error('index.html has no <script id="lexicon"> block');
  html = html.replace(LEXICON,
    '<script id="lexicon" type="application/json">'
    + island(lex.glossary || { members: {}, roots: {}, from: {} }) + '</script>');

  const theory = loadTheory(lessons);
  if (!THEORY.test(html)) throw new Error('index.html has no <script id="theory-md"> block');
  html = html.replace(THEORY,
    '<script id="theory-md" type="application/json">' + island(theory) + '</script>');

  if (!html.includes(PWA)) throw new Error(`index.html has no ${PWA}`);
  const pwaBits = pwaBuild();
  html = html.replace(PWA, pwaBits.html);
  if (!MANIFEST.test(html)) throw new Error('index.html has no <script id="manifest"> block');
  html = html.replace(MANIFEST,
    '<script id="manifest" type="application/json">' + island(pwaBits.manifest) + '</script>');

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
  return { html, lessons, cards, decks, stamp, lex, pwa: pwaBits,
           theory: Object.keys(theory).length };
}

/* A page that reaches the network is a broken page here, so the build refuses
   to emit one.  Checks the output, not the source, so it also catches anything
   an inlined file smuggles in. */
function assertSelfContained(html) {
  /* The installable layer adds three <link>s to the head, and every one of
     them carries its payload inline as a data: URI — so "nothing to fetch"
     is unchanged and the rule can say exactly that: an icon, a touch icon or
     a manifest may be linked, and only from a data: URI. */
  const INLINE_LINK =
    /<link\b[^>]*\brel=["']?(?:icon|apple-touch-icon|manifest)["']?[^>]*\bhref=["']data:/i;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (/\brel=["']?(?:icon|apple-touch-icon|manifest)\b/i.test(tag) && !INLINE_LINK.test(tag)) {
      throw new Error('output is not self-contained: an icon or manifest <link> '
        + 'that is not a data: URI — ' + tag.slice(0, 80));
    }
  }
  const banned = [
    [/<link\b(?![^>]*rel=["']?(?:icon|apple-touch-icon|manifest))/i,
     'a <link> to an external stylesheet'],
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

const { html, lessons, cards, decks, stamp, theory, lex, pwa: pwaBits } = build();
assertSelfContained(html);

if (process.argv.includes('--check')) {
  const at = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  const stale = [
    at(OUT) === html ? null : 'dist/abhyasah.html',
    at(SW) === pwaOut.worker(stamp) ? null : 'dist/sw.js',
  ].filter(Boolean);
  if (!stale.length) {
    console.log('build --check: dist/ is up to date');
    process.exit(0);
  }
  console.error(`build --check: ${stale.join(' and ')} differs from a fresh build of app/`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
/* Beside the page, never inside it: see scripts/pwa.js.  Named by the build
   stamp, so a new build is a new cache and the last one is dropped. */
fs.writeFileSync(SW, pwaOut.worker(stamp));
console.log(
  `build: dist/abhyasah.html  ${(html.length / 1024).toFixed(0)} KB  ` +
  `${lessons.length} lessons, ${decks} decks, ${cards} cards, ${theory} theory  · ${stamp}`
);
console.log(
  `       pwa: ${pwaBits.icons} icons (${(pwaBits.bytes / 1024).toFixed(0)} KB) and the ` +
  `manifest inlined · dist/sw.js written`
);
if (lex && lex.made) {
  console.log(
    `       lexicon: ${lex.words} words indexed · ${lex.clued} cards clued · ` +
    `${lex.rooted} vocabulary cards carry their dhātu · ` +
    `${lex.roots.n} roots enriched, ${lex.chains} with a sense chain · ` +
    lex.made.map(m => `${m.cards} ${m.name.split(' — ')[0]}`).join(', ')
  );
}
