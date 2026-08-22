/* Practice data lives in the <script id="practice" type="application/json">
   block above, inlined by scripts/build.js from every lesson's practice.json.
   Its shape:

     { "lessons": [
         { "lesson": "06-kriya", "stage": 6,
           "decks": [ { "name": "...", "cards": [ … ] } ] } ] }

   Lessons arrive already ordered by curriculum directory, so deck order in
   the picker is the curriculum's own order — the build owns that, not this
   file.  A card carries a stable `id`; every other field is presentation.
   Cards with no `type` are `reveal`, which is what every migrated card is. */
const CARD_TYPES = ["reveal", "choice", "sequence"];

const [DECKS, DECK_STAGE, DECK_LESSON, LESSON_LABEL, PARSE] = (() => {
  const decks = {}, stages = {}, lessons = {}, labels = {}, skipped = [];
  const fail = why => [decks, stages, lessons, labels, { count: 0, decks: 0, skipped, fatal: why }];

  const src = document.getElementById('practice');
  if (!src) return fail("the <script id=\"practice\"> block is missing");

  let data;
  try { data = JSON.parse(src.textContent); }
  catch (e) { return fail("the practice block is not valid JSON: " + e.message); }

  (data.lessons || []).forEach(L => {
    labels[L.lesson] = L.label || L.lesson;
    (L.decks || []).forEach(d => {
      if (!d.name || !Array.isArray(d.cards) || !d.cards.length) return;
      const cards = d.cards.filter(c => {
        // The build validates far more strictly; this is the last line of
        // defence so one bad card cannot blank the whole page.
        const why = !c.id ? "no id"
          : c.type && !CARD_TYPES.includes(c.type) ? "unknown type " + c.type
          : !c.devanagari && !c.front ? "nothing to show"
          : null;
        if (why) { skipped.push({ id: c.id || "(none)", why, deck: d.name }); return false; }
        return true;
      });
      if (!cards.length) return;
      decks[d.name] = cards;
      stages[d.name] = L.stage;
      lessons[d.name] = L.lesson;
    });
  });

  const count = Object.values(decks).reduce((a, b) => a + b.length, 0);
  return [decks, stages, lessons, labels, { count, decks: Object.keys(decks).length, skipped }];
})();

/* Which list a card came from.  Card objects are made once, per line, so
   object identity is a safe key — and the mixed review needs it to say
   where a missed card came from once the decks are shuffled together. */
const DECK_OF = new Map();
Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => DECK_OF.set(c, n)));

/* ── state ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* the mixed review: a random draw across every list already finished.
   MIX is the picker value it hides behind — \u00a6 cannot occur in a deck
   header, so it can never collide with a real name. */
const MIX = '\u00a6mix';
const TROUBLE = '\u00a6trouble';
const REVIEW_SIZE = 20;
/* Below this many distinct cards to draw from, a "random" draw is most of
   the pool and proves nothing.  The button stays on show regardless,
   counting up — a feature nobody can see is a feature nobody uses. */
const REVIEW_MIN = 40;

let queue = [];        // cards still to be shown this round
let missed = [];       // cards answered "didn't know" this round
let learned = 0;       // cards retired
let current = null;
let roundSource = null; // the card set this round was built from
let reviewing = false;  // true when the round is a replay of missed cards only
let lastRound = null;   // the round just finished, for the share summary
let deckName = null;    // the list the current round belongs to
let mixed = false;      // true when the round draws across lists, not from one
let trouble = false;    // true when that cross-list round is a trouble drill
let clearedAt = 0;      // the cleared tally as the round began, for the delta

/* remembered across visits: last deck, direction, per-deck best score and
   missed pile.  localStorage may be absent or full — every touch is guarded. */
const STORE_KEY = 'abhyāsaḥ';
/* every name this page has carried, newest first — progress is lifted out
   of the first one still holding it, so a rename never costs a streak */
const OLD_KEYS = ['smṛtiḥ', 'śabdakośa'];
const SAVED = (() => {
  try {
    const cur = localStorage.getItem(STORE_KEY);
    if (cur) return JSON.parse(cur) || {};
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (!old) continue;
      localStorage.setItem(STORE_KEY, old);
      localStorage.removeItem(k);
      return JSON.parse(old) || {};
    }
    return {};
  } catch (e) { return {}; }
})();
SAVED.decks = SAVED.decks || {};

/* Deck names key SAVED.decks, so renaming one would silently drop its best
   score and its missed pile.  Every rename this app has made is listed here
   and applied once, the same way OLD_KEYS rescues state from an earlier
   storage key.  Never rename a deck without adding a line here. */
const DECK_RENAMES = {
  'Rūpa practice — case and form':               'Practice — case and form',
  'V21 · Deity vibhakti — the eight baseplates': 'Table mastery — the eight baseplates',
  'Kriyā practice — person, tense and mood':     'Practice — person, tense and mood',
  /* The sentence-order sequence decks were removed, not renamed: handing the
     learner every correct word and asking only for the workbook's arrangement
     tested nothing that can be graded honestly. Their scores are deliberately
     left orphaned rather than carried onto different practice. */
  'Sandhi practice — joins and splits':          'Practice — joins and splits',
  'Guṇa practice — agreement':                   'Practice — agreement',
  'Kāraka practice — roles in a sentence':       'Practice — roles in a sentence',
  'Sambodhana practice — direct address':        'Practice — direct address',
  'Pratyāhāra practice — what each covers':      'Practice — pratyāhāras',
  'Samāsa practice — name the compound':         'Practice — name the compound',
  'Suffix practice — kṛt and taddhita':          'Practice — kṛt and taddhita',
  'Chandas practice — scan and name':            'Practice — scan and name',
  'Vṛtta practice — name the metre':             'Practice — name the metre',
};
Object.entries(DECK_RENAMES).forEach(([from, to]) => {
  if (SAVED.decks[from] && !SAVED.decks[to]) SAVED.decks[to] = SAVED.decks[from];
  delete SAVED.decks[from];
  if (SAVED.deck === from) SAVED.deck = to;
});
SAVED.review = SAVED.review || { runs: 0, right: 0, seen: 0 };   // mixed-review tally
SAVED.trouble = SAVED.trouble || {};       // per-card history, keyed by card
SAVED.cleared = SAVED.cleared || 0;        // cards that have left the trouble list
SAVED.mastered = SAVED.mastered || {};     // card ids answered right on a cold showing
if (SAVED.deck === MIX) delete SAVED.deck;      // the review is no longer a picker choice
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SAVED)); } catch (e) {}
}
/* A card's stable identity, assigned in practice.json and never derived from
   what the card happens to display.  Before ids existed the key was the
   visible text, so trouble history is lifted across once, below. */
const cardKey = c => c.id;
const deckState = name => SAVED.decks[name] = SAVED.decks[name] || {};

/* \u2500\u2500 saved-progress migration \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   v1 keyed trouble history by devanagari + '\u00a6' + gloss.  Rebuild that key
   for every card we now hold, and move the record onto the card's id.  Runs
   once; a record whose card no longer exists is left where it is rather than
   thrown away, in case a later build brings the card back.

   SAVED.decks is keyed by deck NAME, and deck names did not change in the
   migration, so per-deck best scores need no rescue. */
const SAVED_VERSION = 3;
if ((SAVED.v || 1) < 2) {
  let moved = 0;
  Object.values(DECKS).forEach(cards => cards.forEach(c => {
    if (!c.devanagari || !c.gloss) return;
    const old = c.devanagari + '\u00a6' + c.gloss;
    if (SAVED.trouble[old] && !SAVED.trouble[c.id]) {
      SAVED.trouble[c.id] = SAVED.trouble[old];
      delete SAVED.trouble[old];
      moved++;
    }
  }));
  SAVED.v = 2;                        // this step only — v3 runs below
  save();
  if (moved) console.info("abhy\u0101sa\u1e25: carried " + moved + " trouble records onto stable ids");
}

/* v3 introduced SAVED.mastered, and nothing before it recorded which cards
   came back cold — only how many did, in ds.best.  One case can be resolved
   exactly rather than guessed at: a deck whose best round was perfect had
   every one of its cards right on the first showing, and that is the mastery
   signal itself.  So those decks are seeded and no others.

   The size check matters.  A best score is compared as a ratio, so a perfect
   one may have been set on a smaller version of the deck; seeding from it
   would hand mastery to cards that were never in the round.  Anything
   partial, and anything set on a deck that has since changed size, starts
   from nothing — which is what an unrecorded card honestly is. */
if ((SAVED.v || 1) < 3) {
  let seeded = 0;
  Object.entries(DECKS).forEach(([name, cards]) => {
    const best = (SAVED.decks[name] || {}).best;
    if (!best || best[0] !== best[1] || best[1] !== cards.length) return;
    cards.forEach(c => { if (!SAVED.mastered[c.id]) { SAVED.mastered[c.id] = 1; seeded++; } });
  });
  SAVED.v = SAVED_VERSION;
  save();
  if (seeded) console.info("abhy\u0101sa\u1e25: seeded " + seeded + " mastered cards from perfect rounds");
}

/* ── trouble cards ─────────────────────────────────────────
   A card lands on the list after TROUBLE_WRONG wrong answers and leaves
   after TROUBLE_CLEAR right ones, each in a different session — three
   right answers in one sitting is recognition, not memory.  A wrong
   answer starts that count over: it is still trouble.

   Keyed by card rather than by card-in-a-list, so a word you keep losing
   is one problem however many lists happen to carry it. */
const TROUBLE_WRONG = 3, TROUBLE_CLEAR = 3;
const SESSION = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function markWrong(card) {
  const k = cardKey(card);
  const rec = SAVED.trouble[k] = SAVED.trouble[k] || { w: 0, r: 0, s: "" };
  rec.w++;
  rec.r = 0; rec.s = "";               // the run of clean recalls starts again
  save();
}

function markRight(card) {
  const k = cardKey(card), rec = SAVED.trouble[k];
  if (!rec || rec.w < TROUBLE_WRONG) return;   // only cards on the list count out
  if (rec.s === SESSION) return;               // one credit per session, however many rounds
  rec.s = SESSION;
  if (++rec.r >= TROUBLE_CLEAR) { delete SAVED.trouble[k]; SAVED.cleared++; }
  save();
}

/* The list itself: the worst first, one entry per distinct card. */
function troubleCards() {
  const out = [], seen = new Set();
  Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
    const k = cardKey(c), rec = SAVED.trouble[k];
    if (seen.has(k) || !rec || rec.w < TROUBLE_WRONG) return;
    seen.add(k);
    out.push(c);
  }));
  return out.sort((a, b) => SAVED.trouble[cardKey(b)].w - SAVED.trouble[cardKey(a)].w);
}

/* The lists that have been played through to the end at least once.  Only
   these feed the review — there is no point testing what was never learnt. */
const finishedDecks = () => Object.keys(DECKS).filter(n => (SAVED.decks[n] || {}).best);
/* Everything the review can draw on: one entry per distinct card across
   the finished lists.  The same word can sit in more than one list, and
   meeting it twice would waste two of the twenty. */
function reviewPool() {
  const seen = new Map();
  finishedDecks().forEach(n => DECKS[n].forEach(c => {
    const k = cardKey(c);
    if (!seen.has(k)) seen.set(k, c);
  }));
  return [...seen.values()];
}

/* ── mastery ───────────────────────────────────────
   A card is mastered once it has come back right on its FIRST showing in a
   round — the same cold-recall signal a deck's best score is built from, and
   the same one that counts a card out of the trouble list.  A wrong answer
   takes it back: a percentage that could only ever rise would leave a lesson
   ticked long after it had gone, which is not what a tick is for.

   Every kind of round feeds this, review draws and trouble drills included.
   Whether a card came back cold is a fact about the card, not about which
   round it happened to turn up in. */
function markMastered(card) {
  const k = cardKey(card);
  if (SAVED.mastered[k]) return;
  SAVED.mastered[k] = 1; save();
}
function unmarkMastered(card) {
  const k = cardKey(card);
  if (!SAVED.mastered[k]) return;
  delete SAVED.mastered[k]; save();
}

/* ── the five course tracks ─────────────────────────────
   The curriculum's own shape, one level above the numbered lessons.  A stage
   belongs to exactly one track, and the drawer is built from this table and
   nothing else, so the navigation cannot drift from the curriculum.

   Stage 20 is the one place the source diagram is ambiguous: Svara-Vidyā is
   drawn as a track in its own right, yet the poetic track's range is written
   "18–26", which contains it.  Stage 17 is carved out of its neighbouring
   range in exactly the same way, and there it is unambiguous because
   "14–16, 18–26" simply skips it.  Reading 20 the same way — a named track
   lifted out of the range around it — is what the diagram means, so it is
   excluded from the poetic track here rather than counted twice. */
const TRACKS = [
  { id: 'bhasha',   name: 'Language Acquisition', range: 'stages 1–13',
    blurb: 'Nouns → free composition, grounded in devotional context',
    has: s => s >= 1 && s <= 13 },
  { id: 'kavya',    name: 'Poetic Composition', range: 'stages 14–16, 18–26',
    blurb: 'Stotra, chandas, alaṅkāra, rasa, darśana',
    has: s => (s >= 14 && s <= 16) || (s >= 18 && s <= 26 && s !== 20) },
  { id: 'puja',     name: 'Pūjā-Vāk — ritual literacy', range: 'stage 17',
    blurb: 'Saṅkalpa, nyāsa, dhyāna, upacāra grammar',
    has: s => s === 17 },
  { id: 'svara',    name: 'Svara-Vidyā — Vedic literacy', range: 'stage 20',
    blurb: 'Udātta / anudātta / svarita, vikṛtis',
    has: s => s === 20 },
  { id: 'avadhana', name: 'Avadhāna', range: 'stages 27–36',
    blurb: 'Eight challenges → full Aṣṭāvadhāna; stage 36, mastery as living practice',
    has: s => s >= 27 && s <= 36 }
];
/* Cross-cutting practice sits outside the stage sequence, so it is not a
   sixth track: it is listed after the five, and belongs to no track's
   percentage.  The five are the course; this is what runs alongside it. */
const CROSS_TRACK = {
  id: 'vyakaranam', name: 'Vyākaraṇam', range: 'cross-cutting',
  blurb: 'Formal grammar, alongside the stages rather than inside them'
};
const trackOf = stage => TRACKS.find(t => t.has(stage)) || CROSS_TRACK;

/* Lessons in curriculum order — the order the build handed the decks over —
   each carrying its decks and the distinct cards they hold. */
const DECK_IDS = {};
Object.keys(DECKS).forEach(n => { DECK_IDS[n] = new Set(DECKS[n].map(cardKey)); });

const LESSONS = (() => {
  const by = new Map();
  Object.keys(DECKS).forEach(name => {
    const key = DECK_LESSON[name];
    if (!by.has(key)) by.set(key, {
      lesson: key, stage: DECK_STAGE[name],
      label: LESSON_LABEL[key] || key, decks: [], ids: new Set()
    });
    const L = by.get(key);
    L.decks.push(name);
    DECK_IDS[name].forEach(k => L.ids.add(k));
  });
  return [...by.values()];
})();

/* The drawer's spine: each track that has any practice at all, with its
   lessons and the union of their cards.  A track with no practice yet is
   left out rather than shown as an empty 0% — the drawer navigates what
   exists. */
const TRACK_ROWS = (() => {
  const rows = [];
  [...TRACKS, CROSS_TRACK].forEach(track => {
    const lessons = LESSONS.filter(L => trackOf(L.stage) === track);
    if (!lessons.length) return;
    const ids = new Set();
    lessons.forEach(L => L.ids.forEach(k => ids.add(k)));
    rows.push({ track, lessons, ids });
  });
  return rows;
})();
const ALL_IDS = (() => {
  const s = new Set();
  TRACK_ROWS.forEach(r => r.ids.forEach(k => s.add(k)));
  return s;
})();

/* Progress is mastered cards over cards held, counted from cards the whole
   way up: a track's figure is the union of its lessons' cards, never the
   average of their percentages — that would give a five-card lesson the same
   weight as a hundred-card one.

   Every card the app carries counts towards it.  What is here is curated
   practice plus the paradigm tables the badges ask for whole; reference
   material was never brought in, so there is nothing to filter out and
   nothing to dilute the figure. */
function progressOf(ids) {
  const total = ids.size;
  let done = 0;
  ids.forEach(k => { if (SAVED.mastered[k]) done++; });
  let pct = total ? Math.round(done / total * 100) : 0;
  /* Rounding must not hand out a tick's worth of progress that has not been
     earned, nor swallow the first card of a long list. */
  if (pct === 100 && done < total) pct = 99;
  if (pct === 0 && done > 0) pct = 1;
  return { done, total, pct, full: total > 0 && done === total };
}

/* Two independent settings now:
     DIR  — which way round the card runs: 'reveal' (word → meaning)
            or 'produce' (meaning → word).  One button flips it.
     IAST — whether the transliteration is shown at all.  A checkbox.
   Migrate anyone carrying the old three-way mode: 'script' was
   really "word → meaning with the transliteration off". */
if (SAVED.mode && SAVED.dir === undefined) {
  SAVED.dir  = SAVED.mode === 'produce' ? 'produce' : 'reveal';
  SAVED.iast = SAVED.mode !== 'script';
  delete SAVED.mode;
  save();
}
let DIR  = SAVED.dir === 'produce' ? 'produce' : 'reveal';
let IAST = SAVED.iast !== false;

function setDir(d) {
  DIR = d; SAVED.dir = d; save();
  document.body.classList.toggle('mode-produce', d === 'produce');
  const label = d === 'produce' ? "meaning → word" : "word → meaning";
  $('dir-label').textContent = label;
  $('dir').setAttribute('aria-label', "Direction: " + label + ". Tap to reverse.");
  if (current) paint();
}

function setIast(on) {
  IAST = !!on; SAVED.iast = IAST; save();
  $('iast-on').checked = IAST;
  if (current) paint();
}

/* A deck's full name is its key — it keys DECKS and the saved per-deck
   progress — but it is too long to head a row on a phone.  The short form
   drops the leading number and the "— descriptor" tail, keeping the phrase
   before an "&" if it is still long.  The descriptor is not thrown away:
   DECK_DESC returns it, and the drawer prints it on the row's second line.

   Within a lesson this ordering is load-bearing.  DECK_SHORT displays the
   text before the em dash, which is what puts "Practice" above "Table
   mastery" and "Conjugation mastery" in the drawer. */
const DECK_DESC = name => {
  const m = name.match(/^.*?\s+—\s+(.*)$/);
  return m ? m[1] : "";
};
const DECK_SHORT = name => {
  /* The lesson optgroup now says which stage a deck belongs to, so the deck's
     own leading number is dropped from the display — it buys nothing and
     costs width on a phone.  The VALUE keeps it. */
  const m = name.match(/^((?:V?\d+|S)\s*·\s*)?(.*)$/);
  let t = m[2].split(/\s+—\s+/)[0];
  const room = 26;
  if (t.length > room && t.includes(" & ")) t = t.split(" & ")[0];
  if (t.length > room) t = t.slice(0, room).replace(/\s+\S*$/, "");
  t = t.replace(/[\s,&·—]+$/, "");
  return t || name;
};

/* ── the drawer ─────────────────────────────────────────
   Navigation is track → lesson → deck, opened from the button that names
   the list you are on.  A left drawer rather than a fixed sidebar: this page
   is used on a phone, where a permanent panel would eat the card.

   Everything below the mode buttons is rebuilt each time the drawer opens,
   because every percentage in it can have moved since it was last seen. */
const openTracks = new Set();
const openLessons = new Set();
const drawerOpen = () => !$('drawer').hidden;

const toggleIn = (set, key) => { set.has(key) ? set.delete(key) : set.add(key); };

/* The button where the picker used to be, naming the list in play.  It
   carries the lesson as well as the deck: within a lesson the decks are
   called "Practice" and "Table mastery", so the deck name on its own would
   not say whose practice you are in. */
function syncNav() {
  const label = deckName ? LESSON_LABEL[DECK_LESSON[deckName]] : '';
  $('nav-label').textContent =
      deckName === MIX     ? 'mixed review'
    : deckName === TROUBLE ? 'trouble cards'
    : deckName             ? [label, DECK_SHORT(deckName)].filter(Boolean).join(' \u00b7 ')
    :                        'lists';
}

function fillRow(el, parts) {
  Object.entries(parts).forEach(([sel, text]) => {
    const t = el.querySelector(sel);
    if (t) t.textContent = text;
  });
}
const setBar = (el, pct) => { const i = el.querySelector('.bar i'); if (i) i.style.width = pct + '%'; };

function deckRow(name) {
  const p = progressOf(DECK_IDS[name]);
  const b = document.createElement('button');
  b.className = 'dk' + (name === deckName ? ' on' : '') + (p.full ? ' full' : '');
  b.innerHTML = '<span class="dk-name"></span><span class="dk-pct"></span>'
              + '<span class="dk-sub"></span>';
  fillRow(b, {
    '.dk-name': DECK_SHORT(name),
    '.dk-pct': p.full ? '✓' : p.pct + '%',
    '.dk-sub': [DECK_DESC(name), DECKS[name].length + ' cards'].filter(Boolean).join(' · ')
  });
  b.title = name;                        // the full name, where there is a pointer
  b.addEventListener('click', () => chooseDeck(name));
  return b;
}

function lessonRow(L) {
  const p = progressOf(L.ids), open = openLessons.has(L.lesson);
  const wrap = document.createElement('div');
  wrap.className = 'ls' + (p.full ? ' full' : '');

  const head = document.createElement('button');
  head.className = 'ls-head';
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  head.innerHTML = '<span class="ls-name"></span><span class="ls-pct"></span>'
                 + '<span class="bar"><i></i></span>';
  fillRow(head, { '.ls-name': L.label, '.ls-pct': p.full ? '✓' : p.pct + '%' });
  setBar(head, p.pct);
  head.addEventListener('click', () => { toggleIn(openLessons, L.lesson); renderDrawer(); });
  wrap.appendChild(head);

  const body = document.createElement('div');
  body.className = 'ls-body';
  body.hidden = !open;
  L.decks.forEach(name => body.appendChild(deckRow(name)));
  wrap.appendChild(body);
  return wrap;
}

function renderDrawer() {
  const all = progressOf(ALL_IDS);
  fillRow(document, { '#dp-pct': all.pct + '%',
                      '#dp-sub': all.done + ' of ' + all.total + ' cards mastered' });
  $('dp-bar').style.width = all.pct + '%';

  const host = $('dr-tracks');
  host.innerHTML = '';
  TRACK_ROWS.forEach(row => {
    const t = row.track, p = progressOf(row.ids), open = openTracks.has(t.id);
    const wrap = document.createElement('div');
    wrap.className = 'tr' + (p.full ? ' full' : '');

    const head = document.createElement('button');
    head.className = 'tr-head';
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    head.innerHTML = '<span class="tr-range"></span><span class="tr-pct"></span>'
                   + '<span class="tr-name"></span><span class="tr-blurb"></span>'
                   + '<span class="bar"><i></i></span>';
    fillRow(head, { '.tr-range': t.range, '.tr-name': t.name,
                    '.tr-blurb': t.blurb, '.tr-pct': p.pct + '%' });
    setBar(head, p.pct);
    head.addEventListener('click', () => { toggleIn(openTracks, t.id); renderDrawer(); });
    wrap.appendChild(head);

    const body = document.createElement('div');
    body.className = 'tr-body';
    body.hidden = !open;
    row.lessons.forEach(L => body.appendChild(lessonRow(L)));
    wrap.appendChild(body);
    host.appendChild(wrap);
  });
}

function openDrawer() {
  closePop();
  /* Land on where you are rather than on a wall of shut headings: the track
     and lesson holding the current list are opened on the way in. */
  const L = LESSONS.find(x => x.lesson === DECK_LESSON[deckName]);
  if (L) { openTracks.add(trackOf(L.stage).id); openLessons.add(L.lesson); }
  renderDrawer();
  relabelAll();
  $('dveil').hidden = false;
  $('drawer').hidden = false;
  $('nav').setAttribute('aria-expanded', 'true');
  $('dr-close').focus();
}

function closeDrawer(to) {
  if (!drawerOpen()) return;
  $('dveil').hidden = true;
  $('drawer').hidden = true;
  $('nav').setAttribute('aria-expanded', 'false');
  /* Focus must not be left on a row that is now hidden.  It returns to the
     handle, except when a list was picked: there it goes to the card, so
     space flips it straight away instead of re-opening the drawer. */
  $(to === 'card' ? 'card' : 'nav').focus();
}

/* Picking a list from the drawer, with the same guard the picker carried:
   a round that has been graded is not thrown away without asking. */
async function chooseDeck(name) {
  if (name === deckName && !mixed) { closeDrawer('card'); return; }   // already here
  if (roundInProgress()
      && !await ask('Leave this round? Your progress in it will be lost.', 'Leave it')) return;
  closeDrawer('card');
  loadDeck(name);
}

/* Review, trouble and the scoreboard all open from the drawer, which then
   gets out of the way. */
function openFromDrawer(fn) {
  closeDrawer();
  fn();
}

/* The row is live from the first load whether the mode is or not: a locked
   one opens the panel that says what it is and what unlocks it, exactly as
   the trouble row does with an empty list. */
function syncReviewUI() {
  const pool = reviewPool().length;
  $('dm-review').textContent = '\u092A\u0930\u0940\u0915\u094D\u0937\u093E \u2014 review mode'
    + (pool >= REVIEW_MIN ? '' : ' \u00b7 ' + pool + ' of ' + REVIEW_MIN);
  $('dr-review').classList.toggle('on', panelOpen === 'reviewpanel');
}

/* ── the review window ──────────────────────────────────────
   What the mode is, whether it can run yet, and the button that runs it. */
function renderReviewPanel() {
  const pool = reviewPool().length, ready = pool >= REVIEW_MIN;
  const lists = finishedDecks().length, s = lists > 1 ? "s" : "";
  $('rp-sub').textContent = ready
    ? "ready \u00b7 drawing from " + pool + " cards across " + lists + " finished list" + s
    : "locked \u00b7 " + pool + " of " + REVIEW_MIN + " cards finished";
  $('rp-note').textContent = REVIEW_SIZE + " cards drawn at random from every list you "
    + "have finished, shuffled out of their decks so nothing is guessable from its "
    + "neighbour. No list's best score changes \u2014 what you know cold feeds the review "
    + "mastery figure on the scoreboard."
    + (ready ? "" : " Unlocks at " + REVIEW_MIN + " unique cards finished.");
  $('rp-actions').hidden = false;
  $('rp-draw').hidden = !ready;
  $('rp-draw').textContent = "Draw " + REVIEW_SIZE
    + (mixed && !trouble ? " more" : " cards");
}

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ── round control ─────────────────────────────────────── */
function startRound(cards, opt) {
  opt = opt || {};
  closePop();
  if (panelOpen) closePanel();          // never start a round behind a panel
  roundSource = cards;
  reviewing = !!opt.review;
  mixed = !!opt.mixed;
  trouble = !!opt.trouble;
  clearedAt = SAVED.cleared;
  queue = shuffle(cards.map(card => ({ card, missedThisRound: false })));
  missed = []; learned = 0;
  if (trouble)            $('stage').textContent = "trouble cards \u00b7 " + cards.length
                                                 + (reviewing ? " you missed" : " to clear");
  else if (reviewing && mixed) $('stage').textContent = "mixed review \u00b7 " + cards.length + " you missed in the draw";
  else if (reviewing)     $('stage').textContent = "review \u00b7 " + cards.length + " cards you missed";
  $('review').style.display = 'none';
  $('card').style.display = 'flex';
  $('after').hidden = true;
  $('tally').style.visibility = 'visible';
  $('keys').hidden = false;
  next();
}

function loadDeck(name) {
  if (!Object.keys(DECKS).length) {              // nothing parsed — say so instead of dying
    $('dn').textContent = "रिक्तम्";
    $('iast').textContent = "riktam — no cards";
    $('gloss').textContent = PARSE.fatal || "every line was skipped — check the card block";
    $('card').classList.add('open');
    $('tally').style.visibility = 'hidden';
    return;
  }
  /* Called with no name on first load: fall back to the list last used, and
     to the first one in the curriculum if that list is gone. */
  if (!name || !DECKS[name]) name = DECKS[SAVED.deck] ? SAVED.deck : Object.keys(DECKS)[0];
  deckName = name;
  SAVED.deck = name; save();
  mixed = trouble = false;
  relabelAll();
  $('restart').textContent = "Whole deck again";
  const src = DECKS[name];
  const st = DECK_STAGE[name];
  const best = deckState(name).best;
  $('stage').textContent = [
    DECK_DESC(name),
    st === 0 ? "vyākaraṇam track" : st ? "stage " + st : "",
    src.length + " cards",
    best ? "best " + best[0] + "/" + best[1] : ""
  ].filter(Boolean).join(" · ");
  refreshPile();
  startRound([...src], {});
}

/* ── mixed review ──────────────────────────────────────────
   Every card of every finished list, pooled, shuffled, and the first
   REVIEW_SIZE taken.  A flat draw on purpose: weighting it towards the
   cards you keep missing would flatter the number, and the whole point
   of this mode is to measure what actually stayed. */
/* Drawn round-robin across the finished lists rather than flat across their
   cards, so one large list cannot swamp a session.  That matters now the
   paradigm decks exist: a complete declension table is a hundred-odd cards,
   and a flat draw would make every review mostly that table.

   Still unweighted WITHIN a list — the draw measures what stayed, and
   favouring the cards you keep missing would flatter the number.  Weighted
   practice is what the trouble drill is for.  Exhaustive coverage of a table
   therefore happens across many sessions, not in any one of them. */
function mixCards() {
  const byDeck = new Map();
  reviewPool().forEach(c => {
    const d = DECK_OF.get(c) || '';
    if (!byDeck.has(d)) byDeck.set(d, []);
    byDeck.get(d).push(c);
  });
  const piles = shuffle([...byDeck.values()].map(cs => shuffle(cs)));
  const out = [];
  for (let i = 0; out.length < REVIEW_SIZE; i++) {
    let took = false;
    for (const pile of piles) {
      if (i >= pile.length) continue;
      out.push(pile[i]);
      took = true;
      if (out.length === REVIEW_SIZE) break;
    }
    if (!took) break;                    // every list exhausted
  }
  return out;
}

function startMixedReview() {
  if (reviewPool().length < REVIEW_MIN) return;      // the button is disabled, but still
  const lists = finishedDecks().length;
  const cards = mixCards();
  deckName = MIX;
  relabelAll();
  $('stage').textContent = ["mixed review", cards.length + " cards",
                            lists + " list" + (lists > 1 ? "s" : "")].join(" \u00b7 ");
  $('pile').hidden = true;
  $('restart').textContent = "Draw " + REVIEW_SIZE + " more";
  startRound(cards, { mixed: true });
}

/* ── the trouble drill ──────────────────────────────────────
   A cross-list round like the review, and like it, it keeps no list's
   books.  Unlike it, it never feeds review mastery: these are the cards
   you already know you are losing, so counting them would flatter it. */
function startTroubleDrill() {
  const cards = troubleCards();
  if (!cards.length) return;
  deckName = TROUBLE;
  $('pile').hidden = true;
  $('restart').textContent = "Drill these again";
  startRound(cards, { review: true, mixed: true, trouble: true });
  relabelAll();
}

/* the persisted "missed last time" pile for the current deck */
function pileCards() {
  const src = DECKS[deckName];
  if (!src) return [];                   // the mixed review keeps no pile of its own
  const keys = new Set(deckState(deckName).pile || []);
  return src.filter(c => keys.has(cardKey(c)));
}
function refreshPile() {
  const n = pileCards().length;
  $('pile').hidden = !n;
  if (n) $('pile').textContent = "practise the " + n + " missed last time";
}

function updateTally() {
  $('t-left').textContent = queue.length + (current ? 1 : 0);
  $('t-knew').textContent = learned;
  $('t-miss').textContent = missed.length;
}


/* ── the seven cases, plus direct address ──────────────────────────
   What each case does, for the popover behind a tapped case name in the
   red annotation.  Kept to a few sentences and one worked example: this
   is a reminder for someone mid-round, not a grammar chapter. */
const CASE_NOTES = {
  'prathamā': { en: 'nominative',
    body: "The subject of the sentence. Also the plain naming form, used when you simply name a thing." },
  'dvitīyā': { en: 'accusative',
    body: "The direct object — what the action falls on. Also marks where motion is heading." },
  'tṛtīyā': { en: 'instrumental',
    body: "By or with — the means an act is done by. Also the agent of a passive verb." },
  'caturthī': { en: 'dative',
    body: "To or for — who receives, or who benefits. The case of the deity in a namaḥ formula." },
  'pañcamī': { en: 'ablative',
    body: "From — what something moves or is separated from. Also source, cause, and the thing compared against." },
  'ṣaṣṭhī': { en: 'genitive',
    body: "Of — usually possession. It links one noun to another rather than to the verb." },
  'saptamī': { en: 'locative',
    body: "In, on or at — place, time, or the situation something holds in." },
  'sambodhana': { en: 'vocative',
    body: "Direct address — calling out to someone. Its forms match the nominative except in the singular." }
};


/* ── what kind of card this is ─────────────────────────────────────
   A headword is not a form in use, a root is not a noun, and an
   indeclinable has no paradigm at all.  Saying so keeps a declension
   table off cards that have no business showing one. */
const TYPE_NOTES = {
  'headword': { en: 'citation form',
    body: "The stem as a word list gives it, not a form in use. Add a case ending before it can stand in a sentence." },
  'adj.': { en: 'adjective',
    body: "An adjective takes the gender, number and case of the noun it describes, so one stem yields all three genders." },
  'pp.': { en: 'past participle',
    body: "A verbal adjective in -ta or -na. It agrees with its noun exactly as an adjective does." },
  'indeclinable': { en: 'avyaya — does not decline',
    body: "One fixed form, whatever its place in the sentence. Particles, conjunctions and most adverbs behave this way." },
  'upasarga': { en: 'verbal prefix',
    body: "A prefix fixed to a root, often reshaping its sense entirely. It is never used on its own.",
    dn: 'नमति → प्रणमति', iast: 'namati → praṇamati', tr: 'he bows → he prostrates' },
  'suffix': { en: 'suffix',
    body: "Added after a base to build a new word. The card shows what it makes." },
  'kṛt suffix': { en: 'primary suffix',
    body: "Added straight to a verbal root to make a noun, adjective or participle: root → suffix → new word.",
    dn: 'गम् + क्त्वा → गत्वा', iast: 'gam + ktvā → gatvā', tr: 'root · suffix · having gone' },
  'taddhita suffix': { en: 'secondary suffix',
    body: "Added to a finished nominal stem, not to a root, to derive a further word from it.",
    dn: 'शिव + अण् → शैवः', iast: 'śiva + aṇ → śaivaḥ', tr: 'stem · suffix · relating to Śiva' },
  'sandhi rule': { en: 'a joining rule',
    body: "What happens where two sounds meet. The card gives the join it governs: input, rule, output.",
    dn: 'नर + इन्द्रः → नरेन्द्रः', iast: 'nara + indraḥ → narendraḥ', tr: 'a + i becomes e' },
  'samāsa': { en: 'compound type',
    body: "How two or more stems join into one word, and which member carries the sense.",
    dn: 'नील + उत्पलम् → नीलोत्पलम्', iast: 'nīla + utpalam → nīlotpalam', tr: 'blue · lotus · a blue lotus' },
  'dhātu': { en: 'verbal root',
    body: "A root, not a word: never used bare, and reshaped by every tense and mood. The card lists forms built on it.",
    dn: 'गम् → गच्छति · जगाम · गत्वा', iast: 'gam → gacchati · jagāma · gatvā', tr: 'present · perfect · absolutive' },
  'pratyāhāra': { en: 'a sound-class abbreviation',
    body: "A shorthand for a run of sounds in the Maheśvara sūtras: a first letter, plus a marker letter that closes the run.",
    dn: 'इ उ ऋ ऌ → इक्', iast: 'i u ṛ ḷ → ik', tr: 'the four vowels the yaṇ rule acts on' },
  'gaṇa': { en: 'metrical foot',
    body: "A group of three syllables, each light or heavy. Eight are possible, and a metre is described as a sequence of them.",
    dn: '⏑ – – = य', iast: '⏑ – – = ya', tr: 'light, heavy, heavy' },
  'vṛtta': { en: 'syllable-counted metre',
    body: "A metre fixed by the number of syllables in a quarter-verse and by which are light and which heavy." },
  'sthāna': { en: 'place of articulation',
    body: "Where in the mouth a sound is made. Each row of the consonant table shares one place, and so do the vowels that belong with it." },
  'kāraka': { en: 'semantic role',
    body: "The part a word plays in the action, as against the case ending that expresses it. The two usually agree, but not always." },
  'lakāra': { en: 'tense-mood slot',
    body: "One of the ten slots Pāṇini names with an l-, each replaced by a set of endings. The card gives the sūtra that assigns it." },
  'numeral': { en: 'number word',
    body: "One to four agree with their noun in gender and case. Five and above take one form for nominative and accusative, and no gender.",
    dn: 'एकम् · द्वे · पञ्च', iast: 'ekam · dve · pañca', tr: 'one · two · five' }
};

/* Gender, stated in its own right: for a neuter it decides the paradigm. */
const GENDER_NOTES = {
  'm.': { en: 'masculine',
    body: "A masculine noun. Its nominative and accusative are always distinct forms." },
  'f.': { en: 'feminine',
    body: "A feminine noun. In the ā- and ī-classes the ablative and genitive singular are the same form." },
  'n.': { en: 'neuter',
    body: "A neuter noun. Nominative and accusative are always identical, in all three numbers, which is why this card carries both readings. Elsewhere it follows the masculine of its class." },
  'f./n.': { en: 'feminine or neuter',
    body: "Attested in both genders, declining as its class does for each." },
  'm./f.': { en: 'masculine or feminine',
    body: "Attested in both genders, declining as its class does for each." }
};

/* ── the baseplates ────────────────────────────────────────────────
   A stem class is the shape of the socket a noun's endings snap into.
   Learn the model word and every noun of that class follows it. */
const STEM_NOTES = {
  'a-stem': { en: 'masculine or neuter',
    egA: { dn: 'नित्यः · नित्यम् · नित्या', iast: 'nityaḥ · nityam · nityā', tr: 'm. · n. · f.' },
    egN: { dn: 'फलम् · फलेन · फलाय', iast: 'phalam · phalena · phalāya', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "The commonest class: stems ending in -a, such as rāma- or phala-. Its endings are the pattern the other classes are measured against.",
    dn: 'रामः · रामेण · रामाय', iast: 'rāmaḥ · rāmeṇa · rāmāya', tr: 'nom. · instr. · dat. sg.' },
  'ā-stem': { en: 'feminine',
    body: "A feminine stem ending in -ā, such as durgā- or mālā-. The nominative singular is the bare stem.",
    dn: 'दुर्गा · दुर्गायै · दुर्गायाम्', iast: 'durgā · durgāyai · durgāyām', tr: 'nom. · dat. · loc. sg.' },
  'i-stem': { en: 'masculine or feminine',
    egA: { dn: 'शुचिः · शुचि · शुचिः', iast: 'śuciḥ · śuci · śuciḥ', tr: 'm. · n. · f.' },
    egN: { dn: 'वारि · वारिणा · वारिणे', iast: 'vāri · vāriṇā · vāriṇe', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in short -i, such as hari- or agni-. Its ablative and genitive singular are the same form.",
    dn: 'हरिः · हरये · हरेः', iast: 'hariḥ · haraye · hareḥ', tr: 'nom. · dat. · abl./gen. sg.' },
  'ī-stem': { en: 'feminine',
    body: "A feminine stem ending in long -ī, such as devī- or lakṣmī-. The -ī becomes -y- before a vowel ending.",
    dn: 'लक्ष्मीः · लक्ष्म्यै · लक्ष्मीभिः', iast: 'lakṣmīḥ · lakṣmyai · lakṣmībhiḥ', tr: 'nom. sg. · dat. sg. · instr. pl.' },
  'u-stem': { en: 'masculine or neuter',
    egA: { dn: 'साधुः · साधु · साध्वी', iast: 'sādhuḥ · sādhu · sādhvī', tr: 'm. · n. · f.' },
    egN: { dn: 'मधु · मधुना · मधुने', iast: 'madhu · madhunā · madhune', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in short -u, such as viṣṇu- or guru-. It follows the same pattern as the i-stem.",
    dn: 'विष्णुः · विष्णवे · विष्णोः', iast: 'viṣṇuḥ · viṣṇave · viṣṇoḥ', tr: 'nom. · dat. · abl./gen. sg.' },
  'ū-stem': { en: 'feminine',
    body: "A feminine stem ending in long -ū, such as bhrū- or vadhū-. A small class, parallel to the ī-stem.",
    dn: 'भ्रूः · भ्रुवा', iast: 'bhrūḥ · bhruvā', tr: 'nom. sg. · instr. sg.' },
  'ṛ-stem': { en: 'kinship and agent nouns',
    body: "A stem ending in -ṛ: kinship words such as mātṛ- and pitṛ-, and agent nouns in -tṛ such as kartṛ-. The nominative singular ends in -ā.",
    dn: 'माता · मातरम् · मातुः', iast: 'mātā · mātaram · mātuḥ', tr: 'nom. · acc. · abl./gen. sg.' },
  'at-stem': { en: 'consonant stem',
    egA: { dn: 'श्रीमान् · श्रीमत् · श्रीमती', iast: 'śrīmān · śrīmat · śrīmatī', tr: 'm. · n. · f.' },
    body: "A stem ending in -at, -mat or -vat, such as bhagavat- or śrīmat-. The masculine nominative singular ends in -ān; the neuter is the bare stem.",
    dn: 'भगवान् · भगवत् · भगवता', iast: 'bhagavān · bhagavat · bhagavatā', tr: 'nom. sg. m. · nom./acc. sg. n. · instr. sg.' },
  'an-stem': { en: 'consonant stem',
    egN: { dn: 'नाम · नाम्ना · नाम्ने', iast: 'nāma · nāmnā · nāmne', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in -an, -man or -van, such as ātman- or nāman-. The masculine nominative singular ends in -ā; the neuter drops the -n.",
    dn: 'आत्मा · नाम · आत्मना', iast: 'ātmā · nāma · ātmanā', tr: 'nom. sg. m. · nom./acc. sg. n. · instr. sg.' },
  'as-stem': { en: 'neuter consonant stem',
    body: "A stem ending in -as, usually neuter, such as manas- or tejas-. It shows as -aḥ at the end of a word.",
    dn: 'मनः · मनसा', iast: 'manaḥ · manasā', tr: 'nom./acc. sg. · instr. sg.' },
  'is-stem': { en: 'neuter consonant stem',
    body: "A neuter stem ending in -is, such as jyotis-. It shows as -iḥ at the end of a word.",
    dn: 'ज्योतिः · ज्योतिषा', iast: 'jyotiḥ · jyotiṣā', tr: 'nom./acc. sg. · instr. sg.' },
  'us-stem': { en: 'neuter consonant stem',
    body: "A neuter stem ending in -us, such as dhanus- or cakṣus-. It shows as -uḥ at the end of a word.",
    dn: 'धनुः · धनुषा', iast: 'dhanuḥ · dhanuṣā', tr: 'nom./acc. sg. · instr. sg.' },
  'in-stem': { en: 'possessive consonant stem',
    egA: { dn: 'योगी · योगि · योगिनी', iast: 'yogī · yogi · yoginī', tr: 'm. · n. · f.' },
    body: "A stem ending in -in, meaning 'one who has': yogin-, tejasvin-. The nominative singular ends in -ī.",
    dn: 'योगी · योगिनम्', iast: 'yogī · yoginam', tr: 'nom. sg. · acc. sg.' }
};

/* ── the kārakas ───────────────────────────────────────────────────
   The semantic role a word plays, as against the case-ending that
   expresses it: the two are related but not the same thing. */
const KARAKA_NOTES = {
  'kartṛ': { en: 'agent',
    body: "The one who acts. Nominative in an active sentence, instrumental in a passive one." },
  'karma': { en: 'object',
    body: "What the action affects. Accusative in an active sentence, nominative in a passive one." },
  'karaṇa': { en: 'instrument',
    body: "The means by which something is done. Expressed by the instrumental." },
  'sampradāna': { en: 'recipient',
    body: "The one an act is meant for. Expressed by the dative." },
  'apādāna': { en: 'source',
    body: "The fixed point something moves away from. Expressed by the ablative." },
  'adhikaraṇa': { en: 'locus',
    body: "Where or when the action takes place. Expressed by the locative." },
  'sambandha': { en: 'relation',
    body: "The link between one noun and another, expressed by the genitive. Not counted a kāraka, since it relates nouns rather than acting in the event." }
};

/* ── the verb-form tags that appear in a note ─────────────────────── */
const FORM_NOTES = {
  'pp.': { en: 'past participle',
    body: "A verbal adjective in -ta or -na. It declines like an a-stem, and often stands where English uses a past tense.",
    dn: 'कृतम् · गतः', iast: 'kṛtam · gataḥ', tr: 'done · gone' },
  'perf.': { en: 'perfect',
    body: "A past tense for remote or reported events. Built by reduplicating the root.",
    dn: 'जगाम · उवाच', iast: 'jagāma · uvāca', tr: 'he went · he said' },
  'impf.': { en: 'imperfect',
    body: "A plain past tense. Built on the present stem with a- in front.",
    dn: 'गच्छति → अगच्छत्', iast: 'gacchati → agacchat', tr: 'he goes → he went' },
  'abs.': { en: 'absolutive',
    body: "Indeclinable, meaning 'having done X'. Takes -tvā on a plain root, -ya after a prefix.",
    dn: 'गत्वा · प्रणम्य', iast: 'gatvā · praṇamya', tr: 'having gone · having bowed' },
  'caus.': { en: 'causative',
    body: "'Cause to X', formed with -aya-.",
    dn: 'पतति → पातयति', iast: 'patati → pātayati', tr: 'he falls → he fells' }
};


/* Other names for the same explanation: the English abbreviation a phrase
   note uses instead of the Sanskrit case name, and the combined class
   label.  Both resolve to one entry, so a line naming a case twice — once
   in each language — still gets a single section. */
const CLASS_ALIAS = {
  'nom.':'prathamā', 'acc.':'dvitīyā', 'instr.':'tṛtīyā', 'dat.':'caturthī',
  'abl.':'pañcamī', 'gen.':'ṣaṣṭhī', 'loc.':'saptamī', 'voc.':'sambodhana',
  'ā-/ī-stem':'ā-stem'
};

/* Where a verb's ending sends its result: to another, or back to the agent. */
const VOICE_NOTES = {
  'parasmaipada': { en: 'active endings',
    body: "The ordinary active endings, used when the result of the act goes to someone else.",
    dn: 'गच्छामि · गच्छसि · गच्छति', iast: 'gacchāmi · gacchasi · gacchati', tr: 'I, you, he go.' },
  'ātmanepada': { en: 'middle endings',
    body: "Endings used when the result of the act comes back to the agent.",
    dn: 'वन्दे · लभते', iast: 'vande · labhate', tr: 'I venerate · he obtains' },
  'pres.': { en: 'present tense',
    body: "The present tense. How its stem is built depends on the root's class.",
    dn: 'गच्छति · शृणोति', iast: 'gacchati · śṛṇoti', tr: 'he goes · he hears' },
  'impv.': { en: 'imperative',
    body: "Commands, requests and prayers — the mood most of a stotra uses.",
    dn: 'रक्ष · प्रसीद', iast: 'rakṣa · prasīda', tr: 'protect! · be gracious!' },
  'pronoun': { en: 'pronominal declension',
    body: "Pronouns follow their own patterns, not the noun classes. Some build their cases from more than one stem.",
    dn: 'त्वाम् · तुभ्यम्', iast: 'tvām · tubhyam', tr: 'you (acc.) · to you' },
  'interrogative pronoun': { en: 'question word',
    body: "The stem kim-, declined like a pronoun. Its forms open questions, and with api or cana they become indefinite: 'someone', 'anything'.",
    dn: 'किम् · कः · कस्मै', iast: 'kim · kaḥ · kasmai', tr: 'what? · who? · to whom?' },
  'fut.': { en: 'future',
    body: "The simple future, formed with -sya- before the endings.",
    dn: 'करिष्यति · गमिष्यति', iast: 'kariṣyati · gamiṣyati', tr: 'he will do · he will go' }
};

/* Everything the red annotation can explain, in one table.  Longest names
   first, so "adhikaraṇa" is never mistaken for the "karaṇa" inside it. */
const GLOSSARY = Object.assign({}, TYPE_NOTES, CASE_NOTES, GENDER_NOTES, STEM_NOTES,
                               KARAKA_NOTES, FORM_NOTES, VOICE_NOTES);
Object.keys(CLASS_ALIAS).forEach(k => GLOSSARY[k] = GLOSSARY[CLASS_ALIAS[k]]);
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const LETTER = /[A-Za-z\u00C0-\u024F\u0900-\u097F\u1E00-\u1EFF]/;

function termAt(text, i) {
  if (i && LETTER.test(text[i - 1])) return null;
  for (const t of TERMS) {
    if (!text.startsWith(t, i)) continue;
    const after = text[i + t.length];
    if (after && LETTER.test(after)) continue;
    return t;
  }
  return null;
}

/* Read an annotation into the pieces worth explaining, in the order they
   appear: the glossary terms it names, the stem it is built on, and the
   root a verb form comes from.  Anything the glossary does not know —
   sūtra numbers, sandhi rule names, source citations — is passed over,
   which is what keeps a sandhi or metre card out of the noun schema. */
function readAnnotation(text) {
  const parts = [], seen = new Set();
  const stem = text.match(/stem:\s*([^·]+)/);
  if (stem) parts.push({ at: stem.index, kind: 'stem', value: stem[1].trim().replace(/,\s*$/, '') });
  const root = text.match(/(?:(\w+)\s*\+\s*)?√(\S+)/);
  if (root) parts.push({ at: root.index, kind: 'root', value: root[0] });
  for (let i = 0; i < text.length; ) {
    const t = termAt(text, i);
    if (!t) { i++; continue; }
    const key = CLASS_ALIAS[t] || t;
    if (!seen.has(key)) { seen.add(key); parts.push({ at: i, kind: 'term', value: t }); }
    i += t.length;
  }
  return parts.sort((a, b) => a.at - b.at);
}

function section(title, en, body, eg) {
  const d = document.createElement('div');
  d.className = 'sec';
  const h = document.createElement('div');
  h.className = 'sec-h';
  const t = document.createElement('span'); t.className = 'sec-t'; t.textContent = title;
  const e = document.createElement('span'); e.className = 'sec-e'; e.textContent = en;
  h.appendChild(t); h.appendChild(e);
  d.appendChild(h);
  const b = document.createElement('p'); b.className = 'sec-b'; b.textContent = body;
  d.appendChild(b);
  if (eg) {
    const g = document.createElement('div'); g.className = 'sec-eg';
    [['eg-dn', eg.dn], ['eg-iast', eg.iast], ['eg-tr', eg.tr]].forEach(([cls, val]) => {
      const sp = document.createElement('span'); sp.className = cls; sp.textContent = val;
      g.appendChild(sp);
    });
    d.appendChild(g);
  }
  return d;
}

/* Build the red annotation.  The whole line becomes one tap target when
   there is anything to say about it, and stays plain text otherwise. */
function renderTag(text) {
  const tag = $('tag');
  closePop();                            // any popover open is about the old line
  tag.textContent = '';
  if (!text) return;
  if (!readAnnotation(text).length) { tag.textContent = text; return; }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ann';
  b.textContent = text;
  b.dataset.ann = text;
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'What this annotation means');
  tag.appendChild(b);
}

/* The popover.  Tap to open, tap the same chip or anywhere off it to
   close — no hover anywhere, since a phone has none to give. */
let popFor = null;

function closePop() {
  if (!popFor) return;
  popFor.setAttribute('aria-expanded', 'false');
  $('pop').hidden = true;
  popFor = null;
}

function placePop(btn) {
  const pop = $('pop'), r = btn.getBoundingClientRect(), m = 10;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(m, Math.min(left, window.innerWidth - w - m));
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - m) top = r.top - h - 8;   // no room below
  top = Math.max(m, Math.min(top, window.innerHeight - h - m));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function openPop(btn) {
  const parts = readAnnotation(btn.dataset.ann);
  if (!parts.length) return;
  /* The one example a tooltip carries must match the card: an adjective is
     shown its three genders, a neuter its neuter paradigm, and a headword,
     a root or an indeclinable is shown no declension at all. */
  const ann  = btn.dataset.ann;
  const adj  = /(?:^|[\s|·])(adj\.|pp\.)(?:[\s·]|$)/.test(ann);
  const cite = /^headword \|/.test(ann);
  const neut = /(?:^|[\s·])n\.(?:[\s·]|$)/.test(ann);
  closePop();
  const pop = $('pop');
  pop.textContent = '';
  pop.scrollTop = 0;
  parts.forEach(part => {
    if (part.kind === 'stem') {
      pop.appendChild(section(part.value, 'stem', cite
        ? "The card shows this stem itself, as a word list gives it. Case endings are added "
          + "to it to make a form that can stand in a sentence."
        : "The dictionary stem underlying the displayed form. Case endings are added to this "
          + "stem; the stem itself may sometimes also appear as a complete form.", null));
    } else if (part.kind === 'root') {
      pop.appendChild(section(part.value, 'root',
        "The verbal root the form is built from. A root is never used bare — each tense "
        + "and mood reshapes it.", null));
    } else {
      const c = GLOSSARY[part.value];
      if (!c) return;
      const eg = adj  ? (c.egA || null)
               : neut  ? (c.egN || (c.dn ? c : null))
               :         (c.dn ? c : null);
      pop.appendChild(section(part.value, c.en, c.body, eg));
    }
  });
  pop.hidden = false;
  placePop(btn);
  btn.setAttribute('aria-expanded', 'true');
  popFor = btn;
}

function paint() {
  const c = current.card;
  closePop();                            // the chip about to be replaced
  const kind = c.type || 'reveal';
  if (kind === 'choice')   { paintChoice(c); return; }
  if (kind === 'sequence') { paintSequence(c); return; }

  $('card').classList.remove('choice', 'seq-card');
  $('seq').hidden = true;
  $('choices').hidden = true;
  $('choices').textContent = '';
  $('keys').textContent = KEYS_REVEAL;
  $('dir').disabled = false;
  $('src').textContent = '';
  if (DIR === 'produce') {
    $('dn').textContent    = c.gloss;
    $('iast').textContent  = '';
    $('gloss').textContent = c.devanagari;
    renderTag([IAST ? c.iast : '', c.note].filter(Boolean).join(' \u00b7 '));
  } else {
    $('dn').textContent    = c.devanagari;
    $('iast').textContent  = IAST ? c.iast : '';
    $('gloss').textContent = c.gloss;
    renderTag(c.note);
  }
}

/* \u2500\u2500 choice cards \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One renderer for every use of the interaction: recognition ("which
   analysis?") and controlled transformation ("make it 'I'") differ only in
   the prompt, never in the machinery.

   Grading is not a separate scheme.  Tapping the right option is a cold
   recall and ends as knew(); tapping a wrong one ends as didntKnow().  So
   the trouble list, the missed pile, review mastery and the scoreboard all
   see a choice card as exactly one retrieval event, the same as a reveal.

   The direction toggle does not apply: a transformation only runs one way,
   and the IAST toggle does not either, because here the IAST *is* the
   content rather than a transliteration of it. */
let choiceRight = null;                  // null until answered, then true/false
const KEYS_REVEAL = $('keys').textContent;

function paintChoice(c) {
  choiceRight = null;
  $('seq').hidden = true;
  $('card').classList.remove('seq-card');
  $('card').classList.add('choice');
  $('card').setAttribute('aria-label', 'Choose the answer');
  $('dn').textContent   = c.front || '';
  $('iast').textContent = '';
  $('gloss').textContent = '';
  renderTag(c.note);
  $('src').textContent = c.source || '';
  /* Flipping a transformation makes no sense \u2014 it only runs one way. */
  $('dir').disabled = true;
  $('keys').textContent = 'tap an answer \u00b7 1\u2013' + c.options.length + ' \u2014 choose';

  const box = $('choices');
  box.textContent = '';
  box.hidden = false;
  /* Shuffled per showing, so the answer's position is never the thing
     remembered \u2014 on the second look within a round especially. */
  shuffle([...c.options]).forEach(opt => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.textContent = opt;
    b.addEventListener('click', () => answerChoice(c, opt));
    box.appendChild(b);
  });
}

function answerChoice(c, picked) {
  if (choiceRight !== null) return;      // already answered; the card is locked
  choiceRight = picked === c.answer;

  [...$('choices').children].forEach(b => {
    b.disabled = true;
    if (b.textContent === c.answer) b.classList.add('right');
    else if (b.textContent === picked) b.classList.add('wrong');
  });

  $('card').classList.add('open');       // uncovers the rule and the note
  $('graded-next').hidden = false;
  $('g-next').focus();
}

function choiceNext() {
  if (choiceRight === null) return;
  $('graded-next').hidden = true;
  const right = choiceRight;
  choiceRight = null;
  if (right) knew(); else didntKnow();
}

/* ── sequence cards ────────────────────────────────────────
   Assemble supplied pieces in order.  The same shared grading as everything
   else: a correct assembly ends as knew(), a wrong one as didntKnow(), so a
   sequence card is one retrieval event to the trouble list and the
   scoreboard like any other.

   Built pieces are tracked by their INDEX in `parts`, not by their text, so
   a card whose bank repeats a word (two `ca`, say) still knows which chip
   came from where. */
let seqBuilt = null;                     // array of part indices, or null
let seqRight = null;                     // null until checked, then true/false

function paintSequence(c) {
  seqBuilt = [];
  seqRight = null;
  $('choices').hidden = true;
  $('choices').textContent = '';
  $('card').classList.remove('choice');
  $('card').classList.add('seq-card');
  $('card').setAttribute('aria-label', 'Build the answer by tapping pieces');
  $('dn').textContent = c.front || '';
  $('iast').textContent = '';
  $('gloss').textContent = '';
  renderTag(c.note);
  $('src').textContent = c.source || '';
  $('dir').disabled = true;
  $('keys').textContent = 'tap the pieces in order';
  $('seq').hidden = false;
  $('seq-actions').hidden = false;
  drawSequence(c);
}

/* The bank is drawn from whatever is not currently placed, shuffled once per
   showing so the authored order is never the answer. */
let seqOrder = null;

function drawSequence(c) {
  const built = $('built'), bank = $('bank');
  built.textContent = '';
  bank.textContent = '';

  if (!seqOrder || seqOrder.length !== c.parts.length) {
    seqOrder = shuffle(c.parts.map((_, i) => i));
  }

  seqBuilt.forEach((partIdx, pos) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = c.parts[partIdx];
    if (seqRight === null) {
      b.addEventListener('click', () => { seqBuilt.splice(pos, 1); drawSequence(c); });
    } else {
      b.disabled = true;
      /* `sequence` is only ever used where the order is forced by the
         grammar — derivational stages — so a misplaced piece really is
         misplaced and is marked as such. Free constituent order is not
         tested by this interaction at all; see CLAUDE.md. */
      b.classList.add(c.parts[partIdx] === c.answer[pos] ? 'right' : 'wrong');
    }
    built.appendChild(b);
  });

  if (seqRight === null) {
    seqOrder.filter(i => !seqBuilt.includes(i)).forEach(partIdx => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = c.parts[partIdx];
      b.addEventListener('click', () => { seqBuilt.push(partIdx); drawSequence(c); });
      bank.appendChild(b);
    });
  }

  $('s-back').disabled  = seqBuilt.length === 0;
  $('s-reset').disabled = seqBuilt.length === 0;
  $('s-check').disabled = seqBuilt.length === 0;
}

function seqCheck() {
  if (!current || seqRight !== null || !seqBuilt.length) return;
  const c = current.card;
  const got = seqBuilt.map(i => c.parts[i]);
  seqRight = got.length === c.answer.length && got.every((w, i) => w === c.answer[i]);

  /* Spell the chain out when it was wrong — seeing which stage feeds which
     is the whole lesson, and a marked-up chip line does not give it. */
  $('gloss').textContent = seqRight ? '' : 'Correct order: ' + c.answer.join('  →  ');
  $('card').classList.add('open');
  $('keys').textContent = KEYS_REVEAL;
  $('seq-actions').hidden = true;
  $('graded-next').hidden = false;
  drawSequence(c);
  $('g-next').focus();
}

function seqBack()  { if (seqRight === null && seqBuilt.length) { seqBuilt.pop(); drawSequence(current.card); } }
function seqReset() { if (seqRight === null) { seqBuilt = []; drawSequence(current.card); } }

function seqNext() {
  if (seqRight === null) return;
  $('graded-next').hidden = true;
  const right = seqRight;
  seqRight = null;
  seqBuilt = null;
  if (right) knew(); else didntKnow();
}

/* One button serves both interactive types. */
function gradedNext() {
  if (choiceRight !== null) return choiceNext();
  if (seqRight !== null) return seqNext();
}

function next() {
  $('card').classList.remove('open');
  $('card').setAttribute('aria-label',
    DIR === 'produce' ? 'Show the word' : 'Show the meaning');
  $('grade').hidden = true;
  $('graded-next').hidden = true;
  $('seq-actions').hidden = true;
  choiceRight = null;
  seqRight = null;
  seqBuilt = null;
  seqOrder = null;
  if (!queue.length) { current = null; finish(); return; }
  current = queue.shift();
  $('relearn').hidden = !current.missedThisRound;
  paint();
  updateTally();
}

function reveal() {
  if (!current || $('card').classList.contains('open')) return;
  /* An interactive card is uncovered by answering it, not by flipping it — a
     tap anywhere else on the panel must not hand over the answer. */
  if ((current.card.type || 'reveal') !== 'reveal') return;
  $('card').classList.add('open');
  $('card').setAttribute('aria-label', 'Answer shown — grade yourself');
  $('grade').hidden = false;
}

/* "Knew it" — retire the card; it will not come back this round. */
function knew() {
  if (!current) return;
  /* only a cold recall counts towards clearing: getting it right on the
     re-show, moments after being told, is relearning, not remembering */
  if (!current.missedThisRound) { markRight(current.card); markMastered(current.card); }
  learned++;
  next();
}

/* "Didn't know it" — log it for review and put it back a few cards later,
   so you meet it again before the round ends. */
function didntKnow() {
  if (!current) return;
  const secondLook = current.missedThisRound;
  if (!secondLook) {
    current.missedThisRound = true;
    missed.push(current.card);
    markWrong(current.card);           // one strike per round, not per showing
    unmarkMastered(current.card);      // a lesson must be able to lose its tick
  }
  /* Re-queue for one more meeting — once.  A card missed on that second
     look is left where it is: it is already on the review list, and the
     "practise these again" button exists for another pass.  Re-queueing
     it a third time made a round you were failing impossible to finish —
     the queue never emptied, so the tally never came. */
  if (!secondLook) {
    queue.splice(Math.min(4, queue.length), 0, current);
  }
  next();
}

/* ── end of round ──────────────────────────────────────── */
function finish() {
  const total = roundSource.length;
  const firstPass = total - missed.length;
  const justCleared = SAVED.cleared - clearedAt;
  lastRound = { deck: deckName, stage: DECK_STAGE[deckName], firstPass, total,
                reviewing, mixed, trouble, justCleared,
                lists: mixed && !trouble ? finishedDecks().length : 0 };

  if (mixed) {
    /* A draw measures; it does not keep books.  No list's best score and no
       list's missed pile moves on the strength of a review — and only the
       fresh draw counts towards mastery, since re-drilling the cards you
       just missed would make the figure say nothing. */
    if (!reviewing && !trouble) {
      const r = SAVED.review;
      r.runs++; r.right += firstPass; r.seen += total;
      save();
    }
  } else {
    /* remember the outcome: best score on full rounds; the missed pile
       always — cards practised this round leave it, cards missed re-enter */
    const ds = deckState(deckName);
    if (!reviewing) {
      ds.last = [firstPass, total];
      if (!ds.best || firstPass / total > ds.best[0] / ds.best[1]) ds.best = [firstPass, total];
    }
    const practised = new Set(roundSource.map(cardKey));
    ds.pile = (ds.pile || []).filter(k => !practised.has(k));
    missed.forEach(c => { const k = cardKey(c); if (!ds.pile.includes(k)) ds.pile.push(k); });
    save();
  }
  relabelAll();                       // a finished list may have opened the review
  refreshPile();
  $('card').style.display = 'none';
  $('review').style.display = 'block';
  $('tally').style.visibility = 'hidden';
  $('grade').hidden = true;
  $('keys').hidden = true;
  $('after').hidden = false;

  const isReview = reviewing || mixed;
  $('r-title').textContent = trouble
    ? (missed.length ? "समाप्तम् — drill finished" : "समाप्तम् — drill clear")
    : missed.length
    ? (isReview ? "समाप्तम् — review finished" : "समाप्तम् — round finished")
    : (isReview ? "समाप्तम् — review clear" : "समाप्तम् — clean round");
  let scoreLine = (reviewing ? "Cleared on the first showing this time: " : "Known on the first showing: ")
    + "<b>" + firstPass + " of " + total + "</b>";
  if (mixed && !reviewing && !trouble)
    scoreLine += "<br>Review mastery: <b>" + masteryPct() + "%</b> over "
               + SAVED.review.seen + " cards drawn";
  if (justCleared)
    scoreLine += "<br><b>" + justCleared + "</b> left the trouble list";
  $('r-score').innerHTML = scoreLine;

  const list = $('r-list');
  list.innerHTML = "";
  if (!missed.length) {
    list.innerHTML = '<div class="clean">' + (
        trouble
      ? 'Every one of them on the first showing. Two more sittings like that and they leave the list.'
      : mixed && !reviewing
      ? 'Every card cold, straight out of its list. Draw again, or go back to a list.'
      : reviewing
      ? 'All of them clear this time. Back to the whole deck, or pick another list.'
      : 'Every card on the first showing. Pick another list, or run this one again.') + '</div>';
    $('again-missed').hidden = true;
    return;
  }
  $('again-missed').hidden = false;
  $('again-missed').textContent = missed.length === 1
    ? "Practise this one again" : "Practise these " + missed.length + " again";

  const head = document.createElement('div');
  head.className = 'missed-head';
  head.textContent = "For review — " + missed.length + " card" + (missed.length > 1 ? "s" : "");
  list.appendChild(head);

  missed.forEach(card => {
    const d = document.createElement('div');
    d.className = 'row';
    d.innerHTML =
      '<span class="r-dn"></span><span class="r-iast"></span>' +
      '<span class="r-gloss"></span><span class="r-tag"></span>';
    d.querySelector('.r-dn').textContent    = card.devanagari;
    d.querySelector('.r-iast').textContent  = card.iast;
    d.querySelector('.r-gloss').textContent = card.gloss;
    const from = mixed ? DECK_OF.get(card) : "";      // a cross-list round needs the label
    d.querySelector('.r-tag').textContent   =
      [from ? DECK_SHORT(from) : "", card.note].filter(Boolean).join(" \u00b7 ");
    list.appendChild(d);
  });
}

/* ── sharing ───────────────────────────────────────────────
   A plain-text summary, handed to the system share sheet where there is
   one and to the clipboard otherwise.  Nothing leaves the page on its
   own: no network, no new stored state, no library.            */
function scoreText() {
  const r = lastRound;
  if (!r) return "";
  const pct = Math.round(r.firstPass / r.total * 100);
  const filled = Math.round(pct / 10);
  if (r.trouble) {
    return "अभ्यासः · sanskrit flashcards\n"
         + "Trouble cards — a drill of the " + r.total + " giving me most trouble\n"
         + "Known on the first showing: " + r.firstPass + " of " + r.total + " · " + pct + "%\n"
         + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled)
         + (r.justCleared ? "\n" + r.justCleared + " left the list" : "");
  }
  if (r.mixed) {
    const m = masteryPct();
    return "अभ्यासः · sanskrit flashcards\n"
         + "Mixed review — a random draw from " + r.lists
         + " finished list" + (r.lists > 1 ? "s" : "") + "\n"
         + "Known cold: " + r.firstPass + " of " + r.total + " · " + pct + "%\n"
         + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled)
         + (m === null ? "" : "\nReview mastery: " + m + "%");
  }
  const place = r.stage === 0 ? "vyākaraṇam track"
              : r.stage       ? "stage " + r.stage : "";
  return "अभ्यासः · sanskrit flashcards\n"
       + r.deck + (place ? "  (" + place + ")" : "") + "\n"
       + (r.reviewing ? "Review cleared: " : "Known on the first showing: ")
       + r.firstPass + " of " + r.total + " · " + pct + "%\n"
       + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled);
}

function flashShare(msg) {
  const b = $('share');
  b.textContent = msg;
  setTimeout(() => { b.textContent = "Share score"; }, 1800);
}

/* Clipboard, with the file:// fallback older browsers still need. */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

async function shareScore() {
  const text = scoreText();
  if (!text) return;
  if (navigator.share) {                       // phones: the native sheet
    try { await navigator.share({ text }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user backed out
  }
  flashShare(await copyText(text) ? "copied \u2713" : "press \u2318/Ctrl+C");
}

/* Review mastery: every card ever drawn in a review, against the ones
   answered on the first showing.  One running average, not per list —
   the draw crosses lists by design. */
const masteryPct = () => {
  const r = SAVED.review;
  return r.seen ? Math.round(r.right / r.seen * 100) : null;
};

/* ── scoreboard ────────────────────────────────────────────
   Nothing new is stored: every finished round already records its best
   result for that deck.  A deck appears only once it has been played
   through to the end — review rounds and abandoned rounds never set it,
   and the review mastery line above the list comes from the same tally
   the draws keep. */
function renderBoard() {
  /* Always on show, in one of three states, so the review is legible as a
     thing that exists well before there is a figure to put against it. */
  const mastery = masteryPct(), pool = reviewPool().length;
  $('b-mastery').hidden = false;
  $('b-mastery').classList.toggle('waiting', mastery === null);
  if (mastery !== null) {
    const r = SAVED.review;
    $('b-mpct').textContent = mastery + "%";
    $('b-msub').textContent = r.right + " of " + r.seen + " cards \u00b7 "
                            + r.runs + " draw" + (r.runs > 1 ? "s" : "");
  } else {
    $('b-mpct').textContent = "";
    $('b-msub').textContent = pool >= REVIEW_MIN
      ? "unlocked \u00b7 use review mode below"
      : "locked \u00b7 " + pool + " of " + REVIEW_MIN + " cards finished";
  }

  const rows = Object.keys(DECKS)
    .map(name => ({ name, best: (SAVED.decks[name] || {}).best }))
    .filter(d => d.best)
    .sort((a, b) => (b.best[0] / b.best[1]) - (a.best[0] / a.best[1])
                 || a.name.localeCompare(b.name));

  $('b-sub').textContent = rows.length
    ? rows.length + " of " + Object.keys(DECKS).length + " lists finished"
    : "";

  const list = $('b-list');
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = '<div class="clean">Nothing here yet — finish a list '
                   + 'and its best score will appear.</div>';
    return;
  }
  rows.forEach(d => {
    const pct = Math.round(d.best[0] / d.best[1] * 100);
    const st = DECK_STAGE[d.name];
    const row = document.createElement('div');
    row.className = 'brow' + (pct === 100 ? ' full' : '');
    row.innerHTML = '<span class="b-name"></span>'
                  + '<span class="b-score"></span><span class="b-pct"></span>';
    const nm = row.querySelector('.b-name');
    nm.textContent = DECK_SHORT(d.name);
    if (st !== undefined) {
      const tag = document.createElement('span');
      tag.className = 'b-stage';
      tag.textContent = st === 0 ? 'vyākaraṇam' : 'stage ' + st;
      nm.appendChild(tag);
    }
    row.querySelector('.b-score').textContent = d.best[0] + " / " + d.best[1];
    row.querySelector('.b-pct').textContent = pct + "%";
    list.appendChild(row);
  });
}

/* Opening a panel only hides things — the round in progress is left
   untouched, so closing it puts you back exactly where you were. */
let panelWas = null, panelOpen = null;
function syncBoardUI() {
  $('dr-board').classList.toggle('on', panelOpen === 'board');
}

/* Each window: what renders it, which button opens it, and the action bar
   that belongs to it.  Every relabel() runs on every open and close, so a
   button can never be left reading "back to the cards" for a shut panel. */
const PANELS = {
  board:       { render: renderBoard,       relabel: syncBoardUI },
  reviewpanel: { render: renderReviewPanel, relabel: syncReviewUI,  actions: 'rp-actions' },
  trouble:     { render: renderTrouble,     relabel: syncTroubleUI, actions: 't-actions' }
};
const relabelAll = () => { syncNav(); Object.values(PANELS).forEach(x => x.relabel()); };

function closePanel() {
  if (!panelOpen) return;
  const spec = PANELS[panelOpen];
  $(panelOpen).style.display = 'none';
  if (spec.actions) $(spec.actions).hidden = true;
  $('panel-back').hidden = true;
  panelOpen = null;
  relabelAll();
  $('card').style.display = panelWas.card;
  $('review').style.display = panelWas.review;
  $('tally').style.visibility = panelWas.tally;
  $('grade').hidden = panelWas.grade;
  $('after').hidden = panelWas.after;
  $('keys').hidden = panelWas.keys;
  panelWas = null;
}

/* Opened from the drawer rather than from a button that stays on screen, so
   the button cannot double as the way out — #panel-back does that instead. */
function openPanel(which) {
  closePop();
  if (panelOpen === which) { PANELS[which].render(); return; }
  if (panelOpen) closePanel();                  // swapping one panel for the other
  panelWas = {
    card: $('card').style.display, review: $('review').style.display,
    tally: $('tally').style.visibility, grade: $('grade').hidden,
    after: $('after').hidden, keys: $('keys').hidden
  };
  $('card').style.display = 'none';
  $('review').style.display = 'none';
  $('tally').style.visibility = 'hidden';
  $('grade').hidden = true;
  $('after').hidden = true;
  $('keys').hidden = true;
  $(which).style.display = 'block';
  $('panel-back').hidden = false;
  panelOpen = which;
  relabelAll();
  PANELS[which].render();
}
/* ── the trouble window ─────────────────────────────────────
   The list, what it takes to get off it, and how many have. */
function renderTrouble() {
  const cards = troubleCards();
  $('t-sub').textContent = (cards.length
      ? cards.length + " on the list"
      : "nothing on the list")
    + " \u00b7 " + SAVED.cleared + " cleared";
  $('t-note').textContent = "A card lands here after " + TROUBLE_WRONG
    + " wrong answers, and leaves after " + TROUBLE_CLEAR
    + " right ones in separate sittings. A wrong answer starts that count again.";

  const list = $('t-list');
  list.innerHTML = "";
  $('t-actions').hidden = false;
  $('t-drill').hidden = !cards.length;
  $('t-copy').hidden = !cards.length;
  if (!cards.length) {
    list.innerHTML = '<div class="clean">Nothing is giving you trouble yet.</div>';
    return;
  }
  cards.forEach(card => {
    const d = document.createElement('div');
    d.className = 'row';
    d.innerHTML = '<span class="r-dn"></span><span class="r-iast"></span>'
                + '<span class="t-count"></span>'
                + '<span class="r-gloss"></span><span class="r-tag"></span>';
    d.querySelector('.r-dn').textContent    = card.devanagari;
    d.querySelector('.r-iast').textContent  = card.iast;
    d.querySelector('.t-count').textContent = SAVED.trouble[cardKey(card)].w + " wrong";
    d.querySelector('.r-gloss').textContent = card.gloss;
    d.querySelector('.r-tag').textContent   =
      [DECK_SHORT(DECK_OF.get(card) || ""), card.note].filter(Boolean).join(" \u00b7 ");
    list.appendChild(d);
  });
}

/* The copyable form: the same pipe-delimited shape as the card data, so a
   pasted list drops straight back into a deck file. */
function troubleText() {
  const cards = troubleCards();
  return "अभ्यासः \u00b7 trouble cards (" + cards.length + ")\n"
       + SAVED.cleared + " cleared so far\n\n"
       + cards.map(c => [c.devanagari, c.iast, c.gloss].join(" | ")).join("\n");
}

function syncTroubleUI() {
  const n = troubleCards().length;
  $('dm-trouble').textContent = '\u0915\u094D\u0932\u093F\u0937\u094D\u091F\u093E\u0928\u093F \u2014 trouble cards'
    + (n ? ' (' + n + ')' : '');
  $('dr-trouble').classList.toggle('on', panelOpen === 'trouble');
}

/* ── wiring ────────────────────────────────────────────── */
$('card').addEventListener('click', reveal);

/* the case popover: the chip swallows its own tap so the document
   listener below does not close what was just opened */
$('tag').addEventListener('click', e => {
  const b = e.target.closest('.ann');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  if (popFor === b) closePop(); else openPop(b);
});
$('pop').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', closePop);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
window.addEventListener('resize', () => { if (popFor) placePop(popFor); });
window.addEventListener('scroll', () => { if (popFor) placePop(popFor); }, { passive: true });
$('knew').addEventListener('click', knew);
$('g-next').addEventListener('click', gradedNext);
$('s-back').addEventListener('click', seqBack);
$('s-reset').addEventListener('click', seqReset);
$('s-check').addEventListener('click', seqCheck);
$('miss').addEventListener('click', didntKnow);
$('again-missed').addEventListener('click', () => {
  if (!missed.length) return;          // nothing to review — should be unreachable
  startRound([...missed], { review: true, mixed, trouble });   // only the ones marked "Didn't know it"
});
$('nav').addEventListener('click', () => drawerOpen() ? closeDrawer() : openDrawer());
$('dr-close').addEventListener('click', closeDrawer);
$('dveil').addEventListener('click', closeDrawer);
$('dr-board').addEventListener('click', () => openFromDrawer(() => openPanel('board')));
$('dr-review').addEventListener('click', () => openFromDrawer(() => openPanel('reviewpanel')));
$('dr-trouble').addEventListener('click', () => openFromDrawer(() => openPanel('trouble')));
$('p-back').addEventListener('click', closePanel);
$('rp-draw').addEventListener('click', async () => {
  if (roundInProgress() && !await ask('Leave this round for a review draw?', 'Leave it')) return;
  startMixedReview();
});
$('restart').addEventListener('click',
  () => trouble ? startTroubleDrill() : mixed ? startMixedReview() : loadDeck(deckName));
$('t-drill').addEventListener('click', async () => {
  if (roundInProgress() && !await ask('Leave this round for the drill?', 'Leave it')) return;
  startTroubleDrill();
});
$('t-copy').addEventListener('click', async () => {
  const b = $('t-copy'), ok = await copyText(troubleText());
  b.textContent = ok ? "copied \u2713" : "press \u2318/Ctrl+C";
  setTimeout(() => { b.textContent = "Copy the list"; }, 1800);
});
$('share').addEventListener('click', shareScore);

/* switching lists or jumping to the pile discards a round in progress —
   ask first once anything has been graded */
function roundInProgress() {
  return current !== null && (learned + missed.length) > 0;
}

/* Our own dialog rather than window.confirm.  A page opened inside an app's
   file viewer may have no handler for confirm() at all, in which case it
   returns false without ever showing anything — and the round it was
   guarding could not be left until it had been played out. */
let askResolve = null;
function ask(message, yes) {
  closePop();
  $('ask-msg').textContent = message;
  $('ask-yes').textContent = yes;
  $('veil').hidden = false;
  $('ask').hidden = false;
  /* focus the harmless button: space is "flip the card" everywhere else in
     this app, and a stray one must not be what throws the round away */
  $('ask-no').focus();
  return new Promise(resolve => { askResolve = resolve; });
}
function answer(v) {
  if (!askResolve) return;
  $('ask').hidden = true;
  $('veil').hidden = true;
  const done = askResolve; askResolve = null;
  done(v);
}
$('ask-yes').addEventListener('click', () => answer(true));
$('ask-no').addEventListener('click', () => answer(false));
$('veil').addEventListener('click', () => answer(false));

$('pile').addEventListener('click', async () => {
  if (roundInProgress()
      && !await ask('Leave this round for the missed pile?', 'Leave it')) return;
  const cards = pileCards();
  if (cards.length) startRound(cards, { review: true });
});
$('dir').addEventListener('click', () => setDir(DIR === 'produce' ? 'reveal' : 'produce'));
$('iast-on').addEventListener('change', e => setIast(e.target.checked));
document.addEventListener('keydown', e => {
  if (askResolve) {                      // a question is on screen; answer that
    if (e.key === 'Escape') { e.preventDefault(); answer(false); }
    return;
  }
  if (drawerOpen()) {                    // the drawer is modal over the round
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
    return;
  }
  const t = e.target.tagName;
  if (t === 'BUTTON' || t === 'SELECT' || t === 'INPUT' || t === 'TEXTAREA') return;   // let native activation work

  /* On an interactive card the keys drive the interaction rather than grade a
     flip, so these arms run first and return. */
  const kind = current ? (current.card.type || 'reveal') : 'reveal';

  if (current && kind === 'choice') {
    if (choiceRight === null) {
      const n = +e.key;
      const opts = $('choices').children;
      if (n >= 1 && n <= opts.length) { e.preventDefault(); opts[n - 1].click(); }
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); choiceNext();
    }
    return;
  }

  if (current && kind === 'sequence') {
    if (seqRight !== null) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); seqNext(); }
      return;
    }
    const n = +e.key;
    const bank = $('bank').children;
    if (n >= 1 && n <= bank.length) { e.preventDefault(); bank[n - 1].click(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); seqBack(); return; }
    if (e.key === 'Enter') { e.preventDefault(); seqCheck(); return; }
    return;
  }

  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
  if (!$('grade').hidden && e.key === '1') didntKnow();
  if (!$('grade').hidden && e.key === '2') knew();
});

setDir(DIR);
setIast(IAST);
loadDeck(SAVED.deck);
relabelAll();

/* Load-time validation.  Silent while the card block is clean — the counts
   are for whoever edits the deck data, not for whoever is studying — but
   still loud the moment a line fails to parse, so a typo cannot pass
   unnoticed. */
(() => {
  const el = $('validate');
  if (PARSE.count && !PARSE.skipped.length) return;
  el.textContent = PARSE.fatal
    ? PARSE.fatal
    : PARSE.count + " cards \u00b7 " + PARSE.decks + " decks \u00b7 "
      + PARSE.skipped.length + " cards skipped";
  el.classList.add('bad');
  if (PARSE.skipped.length) {
    const ul = document.createElement('div');
    ul.className = 'skiplist';
    PARSE.skipped.forEach(sk => {
      const d = document.createElement('div');
      d.textContent = sk.id + " in \u201c" + sk.deck + "\u201d (" + sk.why + ")";
      ul.appendChild(d);
    });
    el.appendChild(ul);
    console.warn("skipped cards", PARSE.skipped);
  }
})();
