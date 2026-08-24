#!/usr/bin/env node
/* The lexical layer: relationships defined once, used everywhere.
 *
 * A word learnt on its own is a word learnt once.  `bhakti` beside `bhakta`
 * beside `bhajana` is one root learnt three times over, and `paṅkaja` stops
 * being a fourth word for the lotus the moment it is read as *mud-born*.
 * lexicon/ holds those relationships; this file is what joins them to the
 * curriculum and turns them into practice.
 *
 * It does three things, all at build time, and all from the same data:
 *
 *   1. VALIDATES the lexicon against the lessons it claims to describe.  The
 *      fifty roots and the twelve synonym sets live in the curriculum, not
 *      here, so a disagreement about a gaṇa or a set member fails the build
 *      rather than shipping two answers to one question.
 *   2. CLUES cards that already exist — a root or a compound reading appended
 *      to a card's own annotation, where the card does not already say it.
 *   3. GENERATES the lists that only the relationships make possible: the
 *      family of a root, the prefix that turns its sense, the synonym that is
 *      not a free swap, the compound read off its parts.
 *
 * Nothing here guesses.  A compound the data calls opaque gets no clue, a
 * card whose English cue would have more than one right Sanskrit answer is
 * dropped, and a generated list that comes out empty is not emitted at all.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEX = path.join(ROOT, 'lexicon');

const readJSON = f => JSON.parse(fs.readFileSync(path.join(LEX, f), 'utf8'));
const derive = require('./derive');
const readLesson = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── the Pāṇinian citation and the plain spelling ────────────────────
   The Dhātu-pāṭha files a root under its own citation form — ṇam for nam,
   ṣṭhā for sthā, pracch for prach, kṝt for kīrt, kṛp for kḷp — and the
   curriculum and the cards write the plain one.  That correspondence lives
   here and nowhere else: `citationsOf` folds a plain id towards the forms
   the extract may file it under, and `plainsOf` folds a citation towards
   the spellings a card may write, canonical spelling first.  A lookup that
   knows neither reports a root missing when it is there — which is how six
   cards came to name a root the popover could not gloss. */
function citationsOf(id) {
  const tries = [id];
  if (/^n/.test(id)) tries.push('ṇ' + id.slice(1));
  if (/^s/.test(id)) {
    tries.push('ṣ' + id.slice(1));
    if (/^st/.test(id)) tries.push('ṣṭ' + id.slice(2));
  }
  if (/c$/.test(id)) tries.push(id + 'ch');
  if (/ch$/.test(id)) tries.push(id.slice(0, -2) + 'cch');   // prach → pracch
  if (/ai$/.test(id)) tries.push(id.slice(0, -2) + 'ā');
  if (/īr/.test(id)) tries.push(id.replace('īr', 'ṝ'));      // kīrt → kṝt
  if (/ūr/.test(id)) tries.push(id.replace('ūr', 'ṝ'));
  if (/ḷ/.test(id)) tries.push(id.replace('ḷ', 'ṛ'));        // kḷp → kṛp
  return [...new Set(tries)];
}
function plainsOf(citation) {
  let plain = citation;
  if (/^ṇ/.test(plain)) plain = 'n' + plain.slice(1);
  else if (/^ṣṭ/.test(plain)) plain = 'st' + plain.slice(2);
  else if (/^ṣ/.test(plain)) plain = 's' + plain.slice(1);
  if (/cch$/.test(plain)) plain = plain.slice(0, -3) + 'ch';
  if (/ṝ/.test(plain)) plain = plain.replace('ṝ', 'īr');
  const out = [plain, citation];
  /* ḷ ⇄ ṛ is an alternation rather than a citation convention — kḷp and kṛp
     are both written — so both spellings are offered, neither replacing the
     other. */
  if (/ṛ/.test(plain)) out.push(plain.replace('ṛ', 'ḷ'));
  return [...new Set(out)];
}

/* ── stems ──────────────────────────────────────────────────────────
   The curriculum writes a headword in its citation form — `śivaḥ`, `cakram`,
   `kapardī` — and the lexicon writes stems.  Matching them is the whole join,
   so it is one function and it is generous in one direction only: it folds a
   citation form towards its stem, and never the other way. */
function stems(word) {
  const w = String(word || '').trim().replace(/^√/, '');
  if (!w) return [];
  const out = [w];
  const bare = w.replace(/[ḥṃ]$/, '');                // śivaḥ → śiva
  out.push(bare);
  out.push(bare.replace(/m$/, ''));                   // cakram → cakra
  if (/ī$/.test(bare)) out.push(bare.replace(/ī$/, 'in'));   // kapardī → kapardin
  if (/ā$/.test(bare)) out.push(bare.replace(/ā$/, 'a'));    // durgā → durga
  /* An -an stem is cited without its n — karman is written karma on a card,
     janman janma, nāman nāma — so a card looking its own headword up has to
     reach the stem the lexicon files it under.  Without this the two words
     the reference itself names as derivatives of √kṛ and √jan were invisible
     to the layer that exists to link them. */
  if (/a$/.test(bare)) out.push(bare + 'n');                 // karma → karman
  return [...new Set(out)].filter(Boolean);
}
/* The form a stem is FILED under: the citation form folded once, which is
   what the lexicon writes.  Looking a card up goes through `find`, which
   tries every fold, because a card may be written any of these ways. */
const key = word => String(word || '').trim().replace(/^√/, '').replace(/[ḥṃ]$/, '');

/* ── load and validate ──────────────────────────────────────────────── */

function load() {
  const problems = [];
  const sources = readJSON('sources.json');
  const roots = readJSON('roots.json').roots;
  const dhatupatha = readJSON('dhatupatha.json');
  const comp = readJSON('compounds.json');
  const syn = readJSON('synonyms.json');
  const nir = readJSON('nirukti.json');

  const SOURCE_IDS = new Set(Object.keys(sources.sources));
  const sourced = (where, obj) => {
    Object.entries(obj || {}).forEach(([field, id]) => {
      String(id).split('+').forEach(one => {
        if (!SOURCE_IDS.has(one)) {
          problems.push(`${where}: "${field}" cites unknown source "${one}"`);
        }
      });
    });
  };

  /* 1. the roots agree with 09-dhatu/reference.md, which owns them ------ */
  const REF9 = readLesson('09-dhatu/reference.md');
  const table = new Map();
  for (const m of REF9.matchAll(
        /^\|\s*\d+\s*\|\s*√(\S+)\s*\|([^|]*)\|\s*(\d+)([PUĀ])\s*\|([^|]*)\|([^|]*)\|/gm)) {
    table.set(m[1], { gana: +m[3], pada: m[4], present: m[5].trim(),
                      key: m[6].trim() === '—' ? [] : m[6].split(',').map(s => s.trim()) });
  }
  if (table.size !== 50) problems.push(`09-dhatu/reference.md: ${table.size} roots, expected 50`);

  const PADA = { P: 'parasmaipada', U: 'both padas', 'Ā': 'ātmanepada' };
  /* ── the Dhātu-pāṭha, as a check ──────────────────────────────────────
     A secondary canonical source for roots, and the only one here that
     states a root's own sense in English.  It agrees with the reference on
     the gaṇa and the present of every one of the fifty; this keeps it that
     way, and where the two ever diverge the LESSON wins — the disagreement
     is reported so a person decides, never silently applied. */
  /* The Dhātu-pāṭha files a root under its own citation form, which is often
     the Pāṇinian one — ṇam for nam, ṣṭhā for sthā, pracch for prach — and it
     lists homonyms separately, so one root id can have several entries with
     different gaṇas.  A lookup that knows neither reports a root missing when
     it is there, and a disagreement when there is none. */
  const DP = new Map();
  dhatupatha.roots.forEach(d => {
    (DP.get(d.id) || DP.set(d.id, []).get(d.id)).push(d);
  });
  const dpFind = id => {
    for (const t of citationsOf(id)) if (DP.has(t)) return DP.get(t);
    return null;
  };
  const notAttested = new Set(dhatupatha.notAttested || []);
  roots.forEach(r => {
    const ds = dpFind(r.id);
    const at = `lexicon/dhatupatha.json ${r.iast}`;
    if (!ds) {
      if (!notAttested.has(r.id)) problems.push(`${at}: not in the Dhātu-pāṭha, and not listed as unattested`);
      return;
    }
    /* it agrees if ANY of its homonymous entries does — the reference names
       one root of a set the Dhātu-pāṭha keeps apart */
    if (!ds.some(d => d.gana === r.gana)) {
      problems.push(`${at}: gaṇa ${ds.map(d => d.gana).join('/')}, but roots.json says ${r.gana}`
        + ` — the lesson wins, so either fix roots.json or record the disagreement`);
    }
    const pres = ds.filter(d => d.present);
    if (pres.length && r.present && !pres.some(d => d.present === r.present)) {
      problems.push(`${at}: present ${pres.map(d => `"${d.present}"`).join('/')}, `
        + `but roots.json says "${r.present}"`);
    }
  });
  const byRoot = new Map();
  roots.forEach(r => {
    const at = `lexicon/roots.json ${r.iast}`;
    byRoot.set(r.id, r);
    const t = table.get(r.id);
    /* A few roots the app needs are not among the reference's fifty.  They
       are allowed, and they must say so: everything about them is sourced to
       a dictionary rather than to a curriculum table that does not carry
       them, and the gaṇa — the one thing a lesson would have settled — has
       to name which. */
    const ROOT_SOURCES = ['mw', 'dhatupatha'];
    if (!t) {
      if (!r.extra) problems.push(`${at}: not one of the reference's fifty roots`);
      else if (ROOT_SOURCES.indexOf(r.source.gana) < 0) {
        problems.push(`${at}: an extra root must cite its gaṇa to ${ROOT_SOURCES.join(' or ')}`);
      }
      sourced(at, r.source);
      return;
    }
    if (r.extra) problems.push(`${at}: marked extra, but the reference has it`);
    if (r.gana !== t.gana) problems.push(`${at}: gaṇa ${r.gana}, reference says ${t.gana}`);
    if (r.pada !== PADA[t.pada]) problems.push(`${at}: pada "${r.pada}", reference says "${PADA[t.pada]}"`);
    if (r.present !== t.present) problems.push(`${at}: present "${r.present}", reference says "${t.present}"`);
    /* the reference cites a stem in -an by its nominative (karma for karman),
       so the family is matched on the shared stem rather than on the string */
    const fold = w => w.replace(/n$/, '');
    const fam = (r.family || []).map(f => fold(f.iast));
    t.key.forEach(k => {
      if (!fam.includes(fold(k))) {
        problems.push(`${at}: the reference's key derivative "${k}" is not in its family`);
      }
    });
    if (!r.sense) problems.push(`${at}: no core sense`);
    sourced(at, r.source);
  });
  table.forEach((_, id) => {
    if (!byRoot.has(id)) problems.push(`lexicon/roots.json: the reference's √${id} is missing`);
  });

  /* 2. a word is analysed or refused, never both ----------------------- */
  /* The six the curriculum teaches at Stage 11, plus the one thing a word
     can be that is not a compound at all.  A type outside this list would be
     metalanguage no lesson has taught. */
  const TYPES = new Set(['tatpuruṣa', 'karmadhāraya', 'dvigu', 'bahuvrīhi',
                         'dvandva', 'avyayībhāva', 'derivative']);
  const opaque = new Map(comp.opaque.map(o => [o.iast, o.why]));
  const compounds = new Map();
  comp.compounds.forEach(c => {
    const at = `lexicon/compounds.json ${c.iast}`;
    if (opaque.has(c.iast)) problems.push(`${at}: both analysed and listed as opaque`);
    if (compounds.has(c.iast)) problems.push(`${at}: analysed twice`);
    if (!c.parts || c.parts.length < 2) problems.push(`${at}: fewer than two parts`);
    if (!c.clue) problems.push(`${at}: no clue`);
    if (!TYPES.has(c.type)) problems.push(`${at}: "${c.type}" is not a type Stage 11 teaches`);
    /* the clue has to be readable off the parts, or it is not a clue.  Every
       part must contribute either its own sense or its own letters. */
    (c.parts || []).forEach(p => {
      if (!p.iast || !p.sense) problems.push(`${at}: a part with no sense`);
    });
    sourced(at, c.source);
    compounds.set(c.iast, c);
  });
  comp.opaque.forEach(o => {
    if (!o.why) problems.push(`lexicon/compounds.json ${o.iast}: refused with no reason`);
  });

  /* 3. the synonym sets are the reference's, and are read consistently -- */
  const REF10 = readLesson('10-paryaya/reference.md');
  const cats = new Map();
  for (const m of REF10.matchAll(/^### Deities — (\S+).*\n(.+)$/gm)) {
    cats.set(m[1], m[2].split(',').map(s => s.trim()).filter(Boolean));
  }
  for (const m of REF10.matchAll(/^\*\*(\w+):\*\*[ \t]*(.+)$/gm)) {
    cats.set(m[1], m[2].split(',').map(s => s.trim()).filter(Boolean));
  }
  const home = new Map();
  cats.forEach((ws, k) => ws.forEach(w => home.set(w, k)));

  const category = new Map();
  syn.categories.forEach(c => {
    const at = `lexicon/synonyms.json ${c.key}`;
    if (!cats.has(c.key)) { problems.push(`${at}: no such category in 10-paryaya/reference.md`); return; }
    sourced(at, c.source);
    category.set(c.key, { ...c, members: cats.get(c.key) });
  });
  const cautions = new Map();
  syn.cautions.forEach(c => {
    const at = `lexicon/synonyms.json ${c.iast}`;
    if (!category.has(c.category)) { problems.push(`${at}: unknown category "${c.category}"`); return; }
    if (!cats.get(c.category).includes(c.iast)) {
      problems.push(`${at}: not in the reference's ${c.category} list`);
    }
    if (!c.alsoMeans) problems.push(`${at}: a caution that says nothing`);
    if (!c.also && !c.ask) problems.push(`${at}: nothing a card could ask for`);
    sourced(at, c.source);
    cautions.set(c.iast, c);
  });

  /* 4. a curated derivation is verified before it is trusted -------------
     nirukti.json carries the traditional derivations the rules cannot
     confirm — kṛṣṇa from √kṛṣ, viṣṇu from √viṣ — where the epithet's gloss
     and the root's sense share no word, so the automatic link (which
     requires both the form and the meaning to agree) rightly stays silent.
     Each entry names its root, says why the link holds, and cites a source;
     and the root must be one the Dhātu-pāṭha or roots.json actually senses,
     because a dhātu the popover cannot gloss is worse than none. */
  /* A root neither canonical list senses may still stand behind a card —
     √vadh has no present and no Dhātu-pāṭha row, yet vadha is its noun — so
     nirukti may carry the root itself, sense and source and all.  Only
     where neither list already senses it: a second wording of a root both
     know would be two answers to one question. */
  const niruktiRoots = new Map();
  const senseless = id => {
    if (byRoot.has(id) && byRoot.get(id).sense) return false;
    if (niruktiRoots.has(id)) return false;
    const ds = dpFind(id);
    return !(ds && ds.some(d => d.sense));
  };
  (nir.roots || []).forEach(e => {
    const at = `lexicon/nirukti.json √${e.id}`;
    if (!e.id || !e.sense) { problems.push(`${at}: a root entry needs id and sense`); return; }
    sourced(at, { sense: e.source });
    if (!senseless(e.id)) {
      problems.push(`${at}: already sensed by the Dhātu-pāṭha or roots.json — say it there`);
      return;
    }
    niruktiRoots.set(e.id, e);
  });
  const nirukti = new Map();
  (nir.words || []).forEach(e => {
    const at = `lexicon/nirukti.json ${e.iast}`;
    if (!e.iast || !e.root) { problems.push(`${at}: an entry needs iast and root`); return; }
    if (!e.why) problems.push(`${at}: a derivation with no reason given`);
    sourced(at, { root: e.source });
    if (senseless(e.root)) {
      problems.push(`${at}: √${e.root} has no sense in the Dhātu-pāṭha or roots.json, `
        + 'so the popover could name it but never gloss it');
      return;
    }
    if (nirukti.has(key(e.iast))) { problems.push(`${at}: derived twice`); return; }
    nirukti.set(key(e.iast), e);
  });
  const niruktiMembers = new Map();
  (nir.members || []).forEach(e => {
    const at = `lexicon/nirukti.json member ${e.member}`;
    if (!e.member || !e.root) { problems.push(`${at}: an entry needs member and root`); return; }
    sourced(at, { root: e.source });
    if (senseless(e.root)) {
      problems.push(`${at}: √${e.root} has no sense in the Dhātu-pāṭha or roots.json`);
      return;
    }
    niruktiMembers.set(e.member, e.root);
  });

  return { problems, sources, roots, byRoot, compounds, opaque, category,
           cautions, home, dhatupatha, nirukti, niruktiMembers, niruktiRoots };
}

/* ── the relationship index ─────────────────────────────────────────────
   word ↔ root ↔ upasarga ↔ suffix ↔ derivative ↔ compound component ↔
   synonym set ↔ curriculum occurrence, built once from the lexicon and the
   practice data together.  Everything below reads this rather than the files.
*/
function index(lex, lessons) {
  const of = new Map();                       // stem → what is known about it
  const note = (k, add) => {
    const cur = of.get(k) || { stem: k, occurs: [] };
    of.set(k, Object.assign(cur, add));
    return of.get(k);
  };

  lex.roots.forEach(r => {
    note(r.id, { root: r });
    (r.family || []).forEach(f => {
      const e = note(key(f.iast), { fromRoot: r, formation: f });
      e.word = e.word || f.iast;
    });
    (r.upasarga || []).forEach(u => {
      const e = note(key(u.iast), { fromRoot: r, prefixed: u });
      e.word = e.word || u.iast;
    });
  });
  lex.compounds.forEach((c, w) => {
    const e = note(key(w), { compound: c });
    e.word = e.word || w;
  });
  lex.opaque.forEach((why, w) => note(key(w), { opaque: why }));
  /* A set lists its members in citation form — paṅkajam, śivaḥ — and the
     roots and compounds above are filed under stems.  Filing the citation
     under its own spelling would split paṅkaja in two, and the compound half
     would then be invisible to a card that looks the answer up.  So a member
     joins the entry that is already there whenever one of its folds finds
     one. */
  const at = w => stems(w).find(st => of.has(st)) || key(w);
  lex.category.forEach((c, k) => c.members.forEach(m => {
    note(at(m), { set: k, citation: m });
  }));
  lex.cautions.forEach((c, w) => note(at(w), { caution: c }));

  /* where the curriculum actually says the word.  This is what makes the
     selections below facts about the course rather than about taste: a family
     is worth carding when the learner meets it, and a compound is worth
     reading off its parts when the parts are taught somewhere. */
  const met = (word, L, d, c) => {
    let e;
    for (const st of stems(word)) if (of.has(st)) { e = of.get(st); break; }
    if (e && !e.occurs.some(o => o.id === c.id)) {
      e.occurs.push({ lesson: L.lesson, deck: d.name, id: c.id });
    }
  };
  lessons.forEach(L => L.decks.forEach(d => d.cards.forEach(c => {
    if ((c.type || 'reveal') === 'reveal') { met(c.iast || '', L, d, c); return; }
    /* An interactive card teaches its words too — a synonym is met as an
       option quite as much as as a headword — so the words on one count as
       occurrences.  This is what "the learner meets it" has to mean, or the
       eleven words for the lotus would read as material the course never
       carries. */
    const words = [c.front, c.answer, ...(c.options || []), ...(c.parts || [])]
      .filter(x => typeof x === 'string').join(' ')
      .split(/[^a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]+/i).filter(w => w.length > 2);
    [...new Set(words)].forEach(w => met(w, L, d, c));
  })));

  const find = word => { for (const st of stems(word)) if (of.has(st)) return of.get(st); };
  const taught = k => { const e = find(k); return !!(e && e.occurs.length); };
  return { of, find, taught };
}

/* ── the root behind an ordinary word ─────────────────────────────────
   `roots.json` links a word to its root only where the curriculum spells the
   pair out — 180 derivatives across the fifty — so most of the vocabulary
   carried no root at all.  The Dhātu-pāṭha names 888 of them with a sense
   apiece, and Stage 3 states the rules a word is built by, so the link can be
   established rather than guessed:

     1. the grade and join rules must REBUILD the headword exactly from the
        root and one of the suffixes vocab/16 names, and
     2. the root's own sense and the card's own gloss must share a word.

   Both, always.  The second is what makes it safe: dropping it links `mātā`
   to √man, `patiḥ` to √pat "to fall" and `karṇa` to √kṛ "to hurt".  With it,
   the layer offers √mā "to measure" for `māyā`, √ram "to delight" for
   `rāmaḥ`, √śuc "to grieve" for `śokaḥ` — each confirmed twice over.

   A root the curriculum teaches is preferred to one it does not, so where the
   course has an opinion the course wins; where two roots of the same standing
   both agree, nothing is offered at all. */
const STOP = new Set(('a an the of to and or in on for with that which who is are '
  + 'be being one what its as by from at').split(' '));
const senseWords = t => new Set(String(t || '').toLowerCase().match(/[a-z]{3,}/g)
  ?.filter(w => !STOP.has(w)).map(w => w.slice(0, 4)) || []);
const shareSense = (a, b) => {
  const A = senseWords(a);
  for (const w of senseWords(b)) if (A.has(w)) return true;
  return false;
};

function rootFinder(lex) {
  /* Every sensed entry is filed under every spelling a card might write —
     the Dhātu-pāṭha's citation AND its plain fold, so ṇaś's derivatives are
     found under naś and kṝt's under kīrt.  The spellings of one root share
     one group, or the same root would stand as two candidates and silence
     itself as an ambiguity. */
  const groups = new Map();                   // canonical plain id → group
  const spell = new Map();                    // any spelling → its group
  lex.dhatupatha.roots.forEach(d => {
    if (!d.gana || !d.sense) return;
    const plains = plainsOf(d.id);
    let g = spell.get(plains[0]);
    if (!g) {
      g = { id: plains[0], senses: [] };
      groups.set(g.id, g);
      plains.forEach(p => { if (!spell.has(p)) spell.set(p, g); });
    }
    if (g.senses.indexOf(d.sense) < 0) g.senses.push(d.sense);
  });
  const taught = new Set(lex.roots.map(r => r.id));
  /* Every sense the root is attested in — the curriculum's own wording AND
     each of the Dhātu-pāṭha's homonymous entries.  hari is √hṛ, and the
     match is in the extract's "to take, remove, steal" even though the
     curriculum words the root "to take, carry": one attested sense agreeing
     is agreement, and only one root may have it. */
  const senseOf = id => {
    const r = lex.roots.find(x => x.id === id);
    const g = spell.get(id);
    return [r && r.sense, ...(g ? g.senses : [])].filter(Boolean).join('; ');
  };
  const made = derive.indexOf([...spell.keys()]);
  return function find(word, gloss) {
    const cands = made.get(word);
    if (!cands) return null;
    const ids = [...new Set(cands.map(c => spell.get(c.root).id))];
    for (const pool of [ids.filter(i => taught.has(i)), ids.filter(i => !taught.has(i))]) {
      const agree = pool.filter(i => shareSense(senseOf(i), gloss));
      if (agree.length === 1) {
        return { root: agree[0], sense: senseOf(agree[0]),
                 suffix: cands.find(c => spell.get(c.root).id === agree[0]).suffix };
      }
      if (agree.length > 1) return null;      // two equals — say nothing
    }
    return null;
  };
}

/* ── 2. clues on cards that already exist ────────────────────────────── */

/* A clue is appended to the card's own annotation, in the idiom the cards
   already use — `· from √hṛ`, `· mahā + īśvara`.  Three rules keep it honest:
   a card that already says it is left alone, a word the lexicon refuses to
   analyse gets nothing, and the clue never repeats the gloss it sits under. */
const words = t => (String(t || '').toLowerCase().match(/[a-z]{4,}/g) || []);
/* Whether the card's own gloss already says what the clue would say.  Then
   the reading is not news and only the PARTS are — `padmanābha → lotus-
   navelled` needs `padma + nābha`, not the gloss again in other words. */
const alreadySays = (gloss, clue) => {
  const has = new Set(words(gloss).map(w => w.slice(0, 5)));
  const want = words(clue);
  return want.length > 0 && want.every(w => has.has(w.slice(0, 5)));
};

function clueFor(entry, card) {
  const note = card.note || '';
  if (entry.compound) {
    const parts = entry.compound.parts.map(p => p.iast).join(' + ');
    if (note.includes(parts) || note.includes(entry.compound.clue)) return null;
    return alreadySays(card.gloss, entry.compound.clue)
      ? parts : `${parts} — ${entry.compound.clue}`;
  }
  /* A prefixed form is asked about first, because it says more: anugraha is
     √grah with anu- on it, and "from √grah" leaves out the half that makes
     the word mean grace. */
  if (entry.fromRoot && entry.prefixed) {
    const u = entry.prefixed;
    if (note.includes(entry.fromRoot.iast)) return null;
    return `${u.prefix}- + ${entry.fromRoot.iast} — ${u.literally}`;
  }
  if (entry.fromRoot && entry.formation) {
    const r = entry.fromRoot.iast;
    if (note.includes(r)) return null;
    return `from ${r}`;
  }
  return null;
}

/* Whether a deck is a vocabulary list: its pair answers with a MEANING.
   This is the one definition of "vocabulary" the layer has — the clue pass,
   the tooltip guarantee and the tests all read it, so they cannot drift. */
function isVocabDeck(d) {
  const want = (d.pair || 'word → meaning').split(' → ')[1];
  return ['meaning', 'definition', 'sense'].includes(want);
}

/* The root the layer can establish for a card beyond what the curriculum
   states — nirukti's curated derivation first, then the rules (form rebuilt
   AND sense agreeing).  One function, used both to WRITE the clue and to
   CHECK that every card that could carry one does, so the two cannot
   disagree. */
function establishedRoot(lex, findRoot, c) {
  if (/√/.test(c.note || '') || /√/.test(c.gloss || '')) return null;
  /* a root's own card is not a vocabulary word — "from √sthā" on √sthā
     would explain the thing by itself */
  if (/^√/.test(String(c.iast || '').trim())) return null;
  /* a headword may offer alternatives — nāśa / vināśa — and the FIRST is
     the one the chip describes, so the first must be the one that resolves:
     a root true only of a later alternative would sit under the wrong word.
     And a later alternative that resolves to a DIFFERENT root makes any
     clue a half-truth, so it silences it. */
  const words = String(c.iast || '').trim().split(/\s*\/\s*/).filter(Boolean);
  if (!words.length) return null;
  const resolve = (w, gloss) => {
    /* a curādi root spelt like its own noun — rūpa/√rūpa, kathā/√katha —
       explains the thing by itself, which is no explanation.  Tested
       against every fold of the headword, not just the one that matched:
       kathā resolves through its own -ā fold and would otherwise pass. */
    const self = new Set(stems(w));
    for (const st of stems(w)) {
      const cur = lex.nirukti.get(st);
      if (cur) return { root: cur.root };
      const f = findRoot(st, gloss);
      if (f && !self.has(f.root)) return f;
    }
    return null;
  };
  if (words.some(w => /[\s+]/.test(w))) return null;
  const found = resolve(words[0], c.gloss);
  if (!found) return null;
  for (const w of words.slice(1)) {
    const f = resolve(w, c.gloss);
    if (f && f.root !== found.root) return null;
  }
  return found;
}

function addClues(lex, ix, lessons, findRoot) {
  let n = 0;
  lessons.forEach(L => {
    L.decks.forEach(d => {
      /* A clue belongs where the word is being learnt as vocabulary, and the
         deck's own pair says whether it is.  A paradigm cell answers with an
         analysis, a sandhi rule with a join, and a compound list with its
         vigraha — where a clue naming the parts would hand over the answer. */
      if (!isVocabDeck(d)) return;
      d.cards.forEach(c => {
      if ((c.type || 'reveal') !== 'reveal') return;
      const e = ix.find(c.iast || '');
      if (e && e.opaque) return;
      let clue = e ? clueFor(e, c) : null;
      /* Nothing the curriculum states reached this card.  A curated
         derivation or the rules may still establish its root. */
      if (!clue) {
        const f = establishedRoot(lex, findRoot, c);
        if (f) clue = 'from √' + f.root;
      }
      if (!clue) return;
      /* A card that already said "from bhaga" and now gets "bhaga + -vatī"
         would say the same thing twice, the weaker way first.  The fuller
         reading replaces it rather than trailing after it. */
      const first = (e && e.compound ? e.compound.parts[0].iast : '').trim();
      const weaker = first && new RegExp('(?:^| · )from ' + first.replace(
        /[.*+?^${}()|[\]\\]/g, '\\$&') + '(?= · |$)');
      if (weaker && weaker.test(c.note || '')) {
        c.note = c.note.replace(weaker, '').replace(/^ · | · $/g, '');
      }
      c.note = c.note ? c.note + ' · ' + clue : clue;
      n++;
      });
    });
  });
  return n;
}

/* An interactive card has an annotation too, and it is the one place a
   transformation can say what the word it turns on actually is.  Stage 23
   asks which word for the lotus scans ∪∪∪; that the answer is paṅka + ja,
   mud-born, is exactly the thing that makes it stick.  Only the answer, only
   where the lexicon reads it, and only after the card has been answered. */
function clueAnswers(lex, ix, lessons) {
  let n = 0;
  lessons.forEach(L => L.decks.forEach(d => d.cards.forEach(c => {
    if ((c.type || 'reveal') !== 'choice') return;
    const ans = String(c.answer || '');
    if (!ans || ans.includes(' · ') || /[A-Z]/.test(ans[0])) return;
    const e = ix.find(ans);
    if (!e || e.opaque || !e.compound) return;
    const parts = e.compound.parts.map(p => p.iast).join(' + ');
    const note = c.note || '';
    if (note.includes(parts) || note.includes(e.compound.clue)) return;
    c.note = note ? note + ' · ' + parts + ' — ' + e.compound.clue
                  : parts + ' — ' + e.compound.clue;
    n++;
  })));
  return n;
}

/* The root cards of Stage 9 are enriched rather than clued: the annotation is
   put in one shape — `dhātu · class 1 · both padas · bhajati · bhakti,
   bhakta` — and the semantic development goes on `detail`, which is a second
   line of the ANSWER and so stays on the back whichever way the card runs. */
function enrichRoots(lex, lessons) {
  let n = 0, chains = 0;
  lessons.forEach(L => {
    if (L.lesson !== '09-dhatu') return;
    L.decks.forEach(d => d.cards.forEach(c => {
      const m = /^√(\S+)$/.exec((c.iast || '').trim());
      if (!m) return;
      const r = lex.byRoot.get(m[1]);
      if (!r) return;
      const key = (r.keyDerivatives || []).join(', ');
      c.note = ['dhātu', 'class ' + r.gana, r.pada, r.present, key]
        .filter(Boolean).join(' · ');
      if (r.development && r.development.length > 1) {
        c.detail = r.development.join(' → ');
        chains++;
      }
      n++;
    }));
  });
  return { n, chains };
}

/* ── 3. generated lists ──────────────────────────────────────────────── */

/* Distractors are never random.  Each generator draws them from the same
   paradigm as the answer — other roots that look alike, other prefixes on the
   same root, other words in the same synonym set — so a miss is a specific
   confusion rather than a blank. */
const near = (want, pool, n) => pool
  .filter(x => x !== want)
  .map(x => [score(want, x), x])
  .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1))
  .slice(0, n).map(x => x[1]);

/* How confusable two words are: a shared opening counts double, a shared
   ending once, and the case ending is folded away first so that every
   citation form does not look alike for sharing its visarga. */
function score(a, b) {
  a = String(a).replace(/[ḥṃ]$/, ''); b = String(b).replace(/[ḥṃ]$/, '');
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] !== b[i]) break; s += 2; }
  for (let i = 1; i <= Math.min(a.length, b.length); i++) {
    if (a[a.length - i] !== b[b.length - i]) break;
    s += 1;
  }
  /* and a tie is broken on letters shared anywhere, so √car is never offered
     against √as for want of anything better */
  const bag = [...b];
  for (const ch of a) {
    const i = bag.indexOf(ch);
    if (i >= 0) { bag.splice(i, 1); s += 0.1; }
  }
  return s;
}

/* A family is worth carding when the learner MEETS it: three or more members
   in the lexicon, and at least two of them said somewhere in the app.  That
   is a fact about the course, not a judgement about the root. */
function familyDeck(lex, ix) {
  const ids = [...lex.byRoot.keys()];
  const cards = [];
  lex.roots.forEach(r => {
    const fam = r.family || [];
    if (fam.length < 3) return;
    const met = fam.filter(f => ix.taught(key(f.iast)));
    if (met.length < 2) return;
    /* Distractors are roots that look like this one — √jan and √jap against
       √jñā — so a miss is the confusion a learner actually has. */
    const wrong = near(r.id, ids, 2).map(x => '√' + x);
    if (wrong.length < 2) return;
    cards.push({
      id: `09-dhatu:kula:${r.id}`,
      type: 'choice',
      front: `Name the root: ${fam.slice(0, 3).map(f => f.iast).join(' · ')}`,
      options: [r.iast, ...wrong],
      answer: r.iast,
      /* the formation is the kṛt machinery at work — bhakti IS √bhaj with
         -ti on it — except where the word is the bare root put to work as a
         noun, which has no suffix to name */
      note: `${r.iast} — ${r.sense} · ${fam[0].iast} is `
          + (/^-?$/.test(fam[0].formation) ? `${r.iast} itself` : `${r.iast} + ${fam[0].formation}`)
          + `, ${fam[0].sense}`,
      source: 'reference · 50 core dhātus · Monier-Williams',
    });
  });
  return cards;
}

/* The prefix families, asked as a TRANSFER rather than as vocabulary: one
   member is handed over worked, and the learner applies the prefix to reach
   another.  Testing every member of a predictable family would be the same
   inference asked five times. */
function upasargaDeck(lex, ix) {
  const cards = [];
  lex.roots.forEach(r => {
    const u = r.upasarga || [];
    if (u.length < 3) return;
    /* Four or more members leave enough room to hand one over worked and ask
       the learner to apply a second prefix themselves — the transfer the
       whole idea rests on. */
    if (u.length >= 4) {
      const asks = u.length >= 5 ? [1, u.length - 1] : [1];
      asks.forEach(i => {
        const want = u[i], given = u[0];
        const wrong = u.filter(x => x !== want && x !== given).slice(0, 2);
        if (wrong.length < 2) return;
        cards.push({
          id: `09-dhatu:upasarga:${r.id}-${want.prefix.replace(/\+/g, '-')}`,
          type: 'choice',
          front: `${given.prefix} + ${r.iast} is ${given.iast}, ${given.sense}. `
               + `What does ${want.prefix} + ${r.iast} give?`,
          options: [want.sense, ...wrong.map(x => x.sense)],
          answer: want.sense,
          note: `${want.iast} · ${want.literally} — ${r.iast} is ${r.sense}`,
          source: 'reference · 22 upasargas · Monier-Williams',
        });
      });
      return;
    }
    /* Exactly three: handing one over would leave a single distractor, so the
       family is asked the other way round — the same inference, from the
       sense back to the prefix that produces it. */
    const want = u[0];
    cards.push({
      id: `09-dhatu:upasarga:${r.id}-${want.prefix.replace(/\+/g, '-')}`,
      type: 'choice',
      front: `Which prefix on ${r.iast} gives “${want.sense}”?`,
      options: u.map(x => `${x.prefix}- · ${x.literally}`),
      answer: `${want.prefix}- · ${want.literally}`,
      note: `${want.iast} — ${r.iast} is ${r.sense}`,
      source: 'reference · 22 upasargas · Monier-Williams',
    });
  });
  return cards;
}

/* One word, two things.  Every distractor is a word from the same set that
   IS a free swap, so the card asks exactly the discrimination its list is
   for: which of these synonyms is not simply a synonym. */
function anekarthaDeck(lex, ix) {
  const cards = [];
  const used = new Map();                 // spread the distractors across a set
  lex.cautions.forEach(c => {
    const cat = lex.category.get(c.category);
    const clean = cat.members.filter(m => !lex.cautions.has(m) && m !== c.iast);
    if (clean.length < 2) return;
    /* The question NAMES the second sense rather than asking which word has
       one.  "Which of these also means something else" would be false the
       moment a distractor turned out to have a second sense of its own — and
       most of them do.  Asking for a named sense is only wrong if two words
       carry it, which the set rules out. */
    const seen = used.get(c.category) || 0;
    const pool = clean.slice(seen % clean.length).concat(clean.slice(0, seen % clean.length));
    const others = pool.slice(0, 2);
    used.set(c.category, seen + 2);
    cards.push({
      id: `10-paryaya:aneka:${key(c.iast).replace(/[^a-zāīūṛṝḷṅñṭḍṇśṣ]/g, '')}`,
      type: 'choice',
      front: `${[c.iast, ...others].sort().join(', ')} all name ${cat.english}. `
           + `Which of them ${c.ask || 'also means ' + c.also}?`,
      options: [c.iast, ...others],
      answer: c.iast,
      note: `${c.iast} — ${c.alsoMeans}`,
      source: 'reference · Synonyms by Category · Monier-Williams',
    });
  });
  return cards;
}

/* A compound read off its parts.  Carded only where BOTH parts are taught
   somewhere in the app: otherwise the card is a vocabulary question wearing
   an analysis, and the learner has no way to do the inference. */
function vyutpattiDeck(lex, ix, cap) {
  /* What a compound names decides what it can be confused with.  An epithet
     answers with a god, so its distractors are the other two gods; a nature
     word answers with a thing, so its distractors are other things.  A pool
     of "everything" would make half of these answerable by elimination. */
  const bucketOf = c => /Śiva|Viṣṇu|Devī/.test(c.names || '') ? 'deity'
    : [...lex.category.values()].some(x => x.kind === 'thing' && c.names === x.english)
      ? 'thing' : 'other';
  const pools = {};
  lex.compounds.forEach(c => {
    if (!c.names) return;
    (pools[bucketOf(c)] = pools[bucketOf(c)] || new Set()).add(c.names);
  });

  const made = [];
  lex.compounds.forEach((c, w) => {
    /* `names` is what the compound turns out to be — "the lotus", "Śiva" —
       and it is this deck's answer.  An analysis may perfectly well exist
       without one: rājarājeśvarī is read off its parts, but "the Goddess" is
       the answer to a dozen other epithets and asking it would be a question
       with a dozen right answers.  Those enrich a card's chip and its
       popover, and are not made into a riddle. */
    if (!c.names) return;
    const parts = c.parts.filter(p => !p.iast.startsWith('-'));
    if (parts.length !== c.parts.length) return;         // a suffix, not a compound
    const b = bucketOf(c);
    const opts = near(c.names, [...pools[b]].filter(x => x !== c.names), 2);
    if (opts.length < 2) return;
    /* Rank by how surely the learner meets the word: carded in the app first,
       then named in a synonym set of the reference, then the rest.  The cap
       then takes the top of that rather than the top of the file. */
    const e = ix.find(w) || { occurs: [] };
    const rank = e.occurs.length ? 0 : e.set ? 1 : 2;
    made.push({ rank, bucket: b, card: {
      id: `11-samasa:vyutpatti:${key(w).replace(/[^a-zāīūṛṝḷṅñṭḍṇśṣ]/g, '')}`,
      type: 'choice',
      front: `Read the compound: ${parts.map(p => `${p.iast} (${p.sense})`).join(' + ')}`,
      options: [c.names, ...opts],
      answer: c.names,
      note: `${w} · ${c.clue} · ${c.type}`,
      source: 'reference · Epithet-Building Patterns · Monier-Williams',
    } });
  });

  /* Taken round-robin across the buckets so the list is not all epithets:
     45 of the 87 analyses name a god, and a list of nothing but those would
     drill one question. */
  made.sort((a, b) => a.rank - b.rank || (a.card.id < b.card.id ? -1 : 1));
  /* One derivation, carded once.  jaladhi, vāridhi, udadhi and abdhi are one
     reading — "holder of waters" — with the word for water swapped, and a
     learner who reads the first is not going to miss the fourth. */
  const seen = new Set();
  const kept = made.filter(m => {
    const k = m.card.answer + ' ¦ ' + m.card.note.split(' · ')[1];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const by = {};
  kept.forEach(m => (by[m.bucket] = by[m.bucket] || []).push(m.card));
  const out = [];
  const keys = Object.keys(by).sort();
  for (let i = 0; out.length < (cap || 20); i++) {
    const left = keys.filter(k => by[k][i]);
    if (!left.length) break;
    left.forEach(k => { if (out.length < (cap || 20)) out.push(by[k][i]); });
  }
  return out;
}

/* ── the ambiguity guard ─────────────────────────────────────────────────
   A generated card is dropped, never shipped, when its cue could be answered
   two ways: two cards in a list asking the same question, or an option that
   is also the right answer to the same card.  The build's own checks catch a
   duplicate id; this catches a duplicate QUESTION, which nothing else would.
*/
function unambiguous(cards, where, problems) {
  const seen = new Map(), out = [];
  cards.forEach(c => {
    const cue = (c.front || '').trim().toLowerCase();
    if (seen.has(cue)) {
      problems.push(`${where}: two cards ask "${c.front}" — ${seen.get(cue)} and ${c.id}`);
      return;
    }
    seen.set(cue, c.id);
    const opts = (c.options || []).map(o => o.trim().toLowerCase());
    if (new Set(opts).size !== opts.length) {
      problems.push(`${where}: ${c.id} repeats an option`);
      return;
    }
    out.push(c);
  });
  return out;
}

/* ── put it together ─────────────────────────────────────────────────── */

const GENERATED = [
  { lesson: '09-dhatu', after: 'Dhātu IV',
    name: 'Kula — the words a root grows · practice',
    build: familyDeck, cap: 25 },
  { lesson: '09-dhatu', after: 'Kula',
    name: 'Upasarga-artha — what a prefix does to a root · practice',
    build: upasargaDeck, cap: 25 },
  { lesson: '10-paryaya', after: 'Bhinna-pada',
    name: 'Anekārtha — one word, two things · practice',
    stream: 'enrichment', build: anekarthaDeck, cap: 25 },
  { lesson: '11-samasa', after: 'Samāsa-bheda',
    name: 'Vyutpatti — the compound read off its parts · practice',
    build: (lex, ix) => vyutpattiDeck(lex, ix, 18), cap: 18 },
];

function apply(lessons) {
  const lex = load();
  const problems = lex.problems.slice();
  if (problems.length) return { problems };

  const ix = index(lex, lessons);
  const findRoot = rootFinder(lex);
  const clued = addClues(lex, ix, lessons, findRoot) + clueAnswers(lex, ix, lessons);
  const roots = enrichRoots(lex, lessons);

  const made = [];
  GENERATED.forEach(g => {
    const L = lessons.find(x => x.lesson === g.lesson);
    if (!L) { problems.push(`lexicon: no lesson ${g.lesson} to put "${g.name}" in`); return; }
    let cards = unambiguous(g.build(lex, ix), g.name, problems);
    if (!cards.length) { problems.push(`lexicon: "${g.name}" generated nothing`); return; }
    if (cards.length > g.cap) {
      problems.push(`lexicon: "${g.name}" generated ${cards.length} cards, past its cap of ${g.cap}`);
      return;
    }
    const deck = { name: g.name, cards };
    if (g.stream) deck.stream = g.stream;
    const at = L.decks.findIndex(d => d.name.startsWith(g.after));
    if (at < 0) { problems.push(`lexicon: no list starting "${g.after}" in ${g.lesson}`); return; }
    L.decks.splice(at + 1, 0, deck);
    made.push({ name: g.name, cards: cards.length });
  });

  /* Every reveal list can be run backwards, and in that direction the gloss
     is the prompt.  Two cards in one list glossed "battle" therefore ask a
     question with two right answers, which no amount of knowing the
     vocabulary can fix.  Flagged here rather than only in the tests, so a
     generated card can never introduce one and ship. */
  lessons.forEach(L => L.decks.forEach(d => {
    const by = new Map();
    d.cards.forEach(c => {
      if ((c.type || 'reveal') !== 'reveal') return;
      const k = (c.gloss || '').trim().toLowerCase();
      if (!k) return;
      (by.get(k) || by.set(k, []).get(k)).push(c.iast);
    });
    by.forEach((ws, k) => {
      if (ws.length > 1) {
        problems.push(`"${d.name}": the cue "${k}" has ${ws.length} right answers `
          + `— ${ws.join(', ')}`);
      }
    });
  }));

  /* ── the tooltip guarantee ─────────────────────────────────────────────
     Every vocabulary card whose dhātu the layer can establish carries it,
     and no card ever names a root its own popover cannot gloss.  The chip
     stays form-only — `from √kṛṣ` — and the MEANING lives in the popover,
     which is exactly the division the app is built on.  Checked here, at
     build time, so no future change to the lessons, the lexicon or this
     file can quietly ship a vocabulary round that lost its roots. */
  const glossed = glossary(lex, findRoot);
  let rooted = 0;
  lessons.forEach(L => L.decks.forEach(d => {
    if (!isVocabDeck(d)) return;
    d.cards.forEach(c => {
      if ((c.type || 'reveal') !== 'reveal') return;
      const at = `"${d.name}" ${c.iast}`;
      const said = tooltipRoot(glossed, c.note);
      if (said && !(glossed.roots[said] && glossed.roots[said].sense)) {
        problems.push(`${at}: the chip names √${said}, which the popover cannot gloss — `
          + 'a dhātu is never shown without its meaning');
        return;
      }
      if (said) { rooted++; return; }
      const could = establishedRoot(lex, findRoot, c);
      if (could) {
        problems.push(`${at}: √${could.root} is established for this card but the chip `
          + 'does not carry it — every vocabulary card that can name its dhātu must');
      }
    });
  }));
  if (rooted < TOOLTIP_ROOT_FLOOR) {
    problems.push(`the tooltip guarantee: ${rooted} vocabulary cards carry their dhātu, `
      + `below the floor of ${TOOLTIP_ROOT_FLOOR} — a change has cost cards their roots. `
      + 'Restore the links; the floor in scripts/lexicon.js only ever moves up.');
  }
  /* a curated derivation no card uses is dead data, and dead data drifts */
  lex.nirukti.forEach((e, k) => {
    const used = lessons.some(L => L.decks.some(d => isVocabDeck(d)
      && d.cards.some(c => (c.note || '').includes('from √' + e.root)
        && String(c.iast || '').split(/\s*\/\s*/)
             .some(w => stems(w).includes(k)))));
    if (!used) problems.push(`lexicon/nirukti.json ${e.iast}: no vocabulary card carries it`);
  });

  return { problems, clued, roots, made, glossary: glossed,
           words: ix.of.size, chains: roots.chains, rooted };
}

/* What the popover would say a card's root is, reading the annotation the
   way app.js reads it: a √ in the chip, or failing that a compound member
   the glossary can chain to its root.  Kept in step with `readAnnotation`
   in app/app.js — the test suite opens the real popover to prove it. */
function tooltipRoot(glossed, note) {
  const t = String(note || '');
  const m = t.match(/√([^\s·]+)/);
  if (m) return m[1];
  const cx = t.match(/(?:^|·\s*)([^·]*?\s\+\s[^·]*?)(?:\s+—\s+([^·]+))?(?=\s*·|$)/);
  if (cx && !/√/.test(cx[1])) {
    for (const w of cx[1].split(/\s*\+\s*/)) {
      const mm = w.trim();
      if (mm && glossed.members[mm] && glossed.from[mm]) return glossed.from[mm];
    }
  }
  return null;
}

/* The floor under the tooltip guarantee: how many vocabulary cards carry
   their dhātu.  It records what has been achieved so a regression fails the
   build; raise it when coverage genuinely grows, never lower it to make a
   build pass. */
const TOOLTIP_ROOT_FLOOR = 249;

/* ── what the card's own annotation can be asked about ────────────────
   The chip already reads "kāma + akṣi — loving-eyed" and "· from √hṛ", and
   until this the popover could say nothing about either: it explained the
   grammar words around them and left the Sanskrit itself unglossed, which is
   the half a learner cannot look up for themselves.

   So the analyses go into the page as a glossary the popover reads — one
   entry per compound member and one per root.  It is small (a couple of
   hundred short strings) because it holds only what is already claimed on a
   card, and it is derived rather than authored: every sense here is the one
   `compounds.json` and `roots.json` already carry, so a clue and its
   explanation cannot drift apart.

   A member with two attested senses keeps both, separated as the cards
   separate them — `pati` is husband and lord, and choosing one would make
   half the compounds that use it read wrongly. */
function glossary(lex, findRoot) {
  const parts = {};
  lex.compounds.forEach(c => c.parts.forEach(p => {
    const at = parts[p.iast] = parts[p.iast] || [];
    if (at.indexOf(p.sense) < 0) at.push(p.sense);
  }));
  const members = {};
  Object.keys(parts).sort().forEach(k => { members[k] = parts[k].join('; '); });

  const roots = {};
  /* Every root the Dhātu-pāṭha names, so a card clued with one can always be
     asked about.  888 short entries — the page carries the whole list rather
     than a subset, because a clue that cannot be explained is worse than no
     clue.  Three rules govern an entry:
     - a root with homonymous entries keeps every distinct sense, as a
       compound member keeps both of its (kāma is love AND desire): viṣ is
       "to sprinkle; to pervade", and choosing one would gloss viṣṇu wrongly;
     - each entry is filed under every spelling a card may write — the
       citation and its plain fold — so √naś and √kīrt gloss although the
       extract files ṇaś and kṝt;
     - the curriculum's own wording wins where it has one. */
  const PADA = { P: 'parasmaipada', A: 'ātmanepada', U: 'both padas' };
  lex.dhatupatha.roots.forEach(d => {
    if (!d.sense) return;
    plainsOf(d.id).forEach(id => {
      const at = roots[id];
      if (!at) {
        roots[id] = { sense: d.sense, gana: d.gana, pada: PADA[d.pada] || d.pada,
                      present: d.present };
      } else {
        /* joined sense by sense, not entry by entry: kṛṣ is "to plough" and
           "to plough; to pull, attract", and the join is "to plough; to
           pull, attract" — never the same sense twice */
        d.sense.split('; ').forEach(s => {
          if (at.sense.split('; ').indexOf(s) < 0) at.sense += '; ' + s;
        });
      }
    });
  });
  lex.roots.forEach(r => {
    roots[r.id] = { sense: r.sense, gana: r.gana, pada: r.pada, present: r.present };
  });
  /* and the roots nirukti itself carries, for the few — √vadh — that stand
     behind a card but outside both canonical lists */
  lex.niruktiRoots.forEach((e, id) => {
    if (!roots[id]) roots[id] = { sense: e.sense };
  });
  /* And where a member is itself a word grown from a root, the popover can
     carry the last step of the derivation too: saras is a member of
     sarasvatī, and saras is √sṛ's.  That is how a chain reaches a learner —
     one link per section, each of them separately sourced.  The link comes
     from roots.json where the curriculum states it, from nirukti.json where
     tradition does, and from the rules — the member's own sense agreeing
     with the root's — where they can establish it. */
  const from = {};
  lex.roots.forEach(r => (r.family || []).forEach(f => {
    const k = key(f.iast);
    if (members[k] && !from[k]) from[k] = r.id;
    if (members[f.iast] && !from[f.iast]) from[f.iast] = r.id;
  }));
  lex.niruktiMembers.forEach((rid, m) => {
    if (members[m] && !from[m]) from[m] = rid;
  });
  Object.keys(members).forEach(m => {
    if (from[m] || /-/.test(m)) return;       // a suffix or prefix has no root
    const f = findRoot(m, members[m]);
    /* a curādi root spelt like its own noun — aṅka, √aṅka — is no chain */
    if (f && !stems(m).includes(f.root) && roots[f.root]) from[m] = f.root;
  });
  return { members, roots, from };
}

module.exports = { apply, load, index, stems, key,
                   isVocabDeck, tooltipRoot, TOOLTIP_ROOT_FLOOR };

if (require.main === module) {
  const { problems } = load();
  if (problems.length) {
    console.error('lexicon: invalid —');
    problems.forEach(p => console.error('  ' + p));
    process.exit(1);
  }
  console.log('lexicon: valid');
}
