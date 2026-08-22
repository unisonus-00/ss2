# CLAUDE.md

## Mission

Build **Abhyāsa** as the lightweight practice layer for Sanskrit School.

Follow the repository curriculum. Do not create a parallel curriculum.

## Curriculum hierarchy

Each numbered lesson directory is the unit of organization.

Use its materials according to purpose:

| File | Purpose |
|:-----|:--------|
| `theory.md` | teach |
| `reference.md` | comprehensive lookup |
| `bricks.md` | deeper structure, where present |
| `workbook-questions.md` | exercise patterns |
| `workbook-answers.md` | verification |
| `badge.md` | mastery target |
| `practice.json` | curated Abhyāsa practice |

When these disagree about stage numbering or content, report the conflict; do
not silently guess.

## Pedagogy

Flashcards are curated practice, not exhaustive copies of reference tables.

**Except within a selected paradigm.** Declension tables and conjugation
paradigms are finite closed systems where a gap is a real gap, and the badges
demand them whole: Rūpa asks for a noun "through all 8 vibhaktis × 3 vacanas",
Kriyā for "3 dhātus in laṭ lakāra (all 9 parasmaipada forms)". The scope rule
is:

> Exhaustive **within** a selected paradigm, not exhaustive **across** the
> language.

- **Table mastery** — every cell of a selected model paradigm, syncretic forms
  included. A learner who takes up Rāma should eventually retrieve the whole
  table.
- **Conjugation mastery** — for a selected dhātu + lakāra + pada, every person
  × number. Nine forms are nine learnable relationships.
- **Everything else stays curated.** Sandhi, samāsa, chandas and vocabulary
  must not drift into exhaustive databases.
- **Never** every root × every lakāra × both padas. That explodes
  combinatorially. The curriculum decides which paradigms deserve mastery;
  those are then tested completely.
- **Mixed review draws round-robin across lists**, so a table is covered over
  many sessions rather than dumped into one.

### `sequence` is only for orders the grammar forces

Sanskrit constituent order is free. An exercise that hands the learner every
correct word and asks only for the workbook's arrangement tests nothing that
can be graded honestly — no case to choose, no verb to conjugate, no
distractor to reject — and marking a grammatical alternative wrong asserts
something false. That is interaction without learning, which **Keep it simple**
forbids.

> Use `sequence` only where the order is **forced by the grammar**, not by
> convention.

Sandhi derivation is such a place: `jagat` cannot reach `jagan` without
passing through `jagad`, because the nasal cannot apply to `t` directly. There
the order is determinate, so a misplaced stage really is misplaced and is
marked so.

**Ordinary sentence building belongs to `choice`,** testing the decision the
sentence actually turns on:

```
"The guru teaches the students."
guruḥ śiṣyān ___
    pāṭhayati ✓    pāṭhayāmi    pāṭhayanti
```

Case selection, agreement, conjugation, connector, completion — these are the
prerequisites for constructing a sentence. Producing the whole sentence, where
alternative orders are naturally acceptable, is the workbook's job, and a human
reader can accept what a stored string cannot.

Any note on a card must describe what the card actually stores: one removed
card claimed "subject → object → verb" over an answer that was
subject → recipient → object → verb.

## Keep it simple

Do not add without a demonstrated need:

- frameworks
- runtime network dependencies
- free-text Sanskrit grading
- drag-and-drop
- category-specific exercise engines
- exhaustive paradigm generation

Reuse `reveal`, `choice`, or `sequence` before inventing another interaction.

## Architecture

Keep curriculum data beside its lesson.

Keep application code separate from curriculum content.

Modular source is encouraged, but distribution must remain:

```
dist/abhyasah.html
```

One self-contained file, offline-capable, usable from `file://`.

Prefer a small structure such as:

```
app/
  index.html
  styles.css
  app.js
scripts/
  build.js
dist/
  abhyasah.html
```

Split further only when maintenance clearly benefits.

## Compatibility

Preserve unless intentionally changing them:

- existing card behavior
- mobile usability
- IAST toggle
- morphology/tooltips
- immediate relearning
- trouble cards
- mixed review
- scoreboard
- saved progress
- track / lesson / deck navigation
- mastery percentages

Use stable card IDs. Do not casually invalidate learner history.

## Change discipline

Before a substantial change:

1. Inspect the relevant lesson sources.
2. Identify the lesson goal and workbook/badge skill.
3. Make the smallest change that supports that skill.
4. Build and test the offline artifact.
5. Avoid unrelated refactors.

Optimize for learning value per unit of complexity.

---

## Repository as it stands

Accurate as of the last update to this file; verify before relying on it.

**Curriculum content** — 36 numbered lesson directories (`01-nama` …
`36-avadhana-seva`), plus `00-overview.md`, a `vocab/` library of 22 thematic
lists, and `vyakaranam/` (formal Pāṇinian grammar, chapters `ch00`–`ch04`),
which complements the numbered stages rather than replacing them.

Every lesson directory carries `theory.md`, `reference.md`,
`workbook-questions.md`, `workbook-answers.md`, and `badge.md`. `bricks.md`
exists only in `02-varna-vidya`, `05-rupa`, and `06-kriya`. 22 of the 36 carry
a `practice.json`; the 14 without are mostly composition and avadhāna stages,
where open-ended production is the point and the workbook is the right home.

Stage numbering is now consistent: directory number, `badge.md`, and every
lesson file heading agree across all 36. See `AUDIT.md` for what was repaired
and what is still open.

**Sanskrit School reader** — `build.py` concatenates every lesson's markdown
into the single-page `index.html` at the repository root. It already knows the
`bricks` and `badge` tabs (`tab_order` in `build.py`), and skips files that are
absent, so adding `bricks.md` to a lesson needs no build change. Run it with
`python3 build.py`.

**Abhyāsa** — the primary project file, distributed as `dist/abhyasah.html`.
It is one self-contained page with no external references of any kind: no CDN,
no fonts, no `fetch`, no stylesheets. It opens from `file://` and works
offline, and it must stay that way.

Application code lives in `app/`; **edit there, never in `dist/`**. Curriculum
content lives beside its lesson:

```
app/index.html         markup only — ~190 lines, no card data
app/logo-mark.png      the brand mark artwork — edit this
app/logo.svg           app/logo-mark.png, base64-wrapped for the build
app/styles.css
app/app.js
scripts/build.js       discovers, validates and inlines -> dist/abhyasah.html
scripts/demo.js        repackages the distributable for publishing as an Artifact
NN-lesson/practice.json   the lesson's curated practice
practice.json             cross-cutting practice, beside 00-overview.md
```

`node scripts/build.js` inlines the CSS, the JS, the mark, and every
`practice.json` into one file. `--check` builds in memory and fails if `dist/` is stale, without
writing.

Practice files are **discovered, not listed** — any numbered lesson directory
holding a `practice.json` is picked up, in directory order, so adding a
lesson's practice needs no build change. Directory order *is* the app's
navigation order: the drawer groups decks under one heading per lesson,
labelled from that lesson's own `theory.md` heading, so the navigation and the
curriculum cannot drift apart.

The build refuses to ship a broken or non-offline page. It rejects duplicate
card ids, unknown types, a `choice` without options or whose answer is not
among them, a `sequence` whose answer uses pieces absent from `parts`, a
`practice.json` naming a lesson it does not sit in, and one in a directory that
is never loaded. It then scans its own output for `<script src>`, `fetch`,
`@import`, remote `url()` and the like, so an accidental network dependency
fails the build rather than shipping.

### The practice screen

The exercise is the page. Everything above the card is small, left-aligned on
the card's own edge, and adds up to about 140px on a 390px phone — a test
asserts the card starts within 165px, because this is the kind of thing that
creeps back.

```
☰ Sandhi · Practice ›                       अभ्यास  [◎]
                                            abhyāsa
JOINS AND SPLITS            31 LEFT  0 LEARNED  0 MISSED
┌──────────────────────────────────────────────────────┐
│                       the card                        │
└──────────────────────────────────────────────────────┘
              [ Didn't know it ]  [ Knew it ]
                 ⇄ join → result    ☑ IAST
```

- **Navigation top left, the mark top right**, on one row. There is no centred
  logo during practice; a test asserts there is no `h1` at all.
- **The branding is secondary.** A 30px mark and the name in two small lines.
  Below 400px the wordmark drops and the mark holds the corner alone: the bar
  is not wide enough on a phone for both the lockup and the longest list name,
  and the list name is what the bar is for. A test walks every deck at 390px
  and fails if any name is clipped.
- **The two toggles sit below the card, centred.** They change how a card is
  shown, so they belong under the thing they change; above it they competed
  with the prompt.
- **The mark's artwork is `app/logo-mark.png`** — the project's own logo,
  cropped to the circular mark alone (not the wordmark, which is set as type
  beside it), background keyed to transparent and recoloured to the app's
  `--leaf` token so it sits on the palette exactly rather than the source
  photo's own tan. `app/logo.svg` just base64-wraps that PNG in an
  `<svg class="mark"><image .../></svg>` so the build can inline one small
  piece of text at the `<!--logo-->` placeholder; regenerate it (a one-line
  `base64.b64encode`, in the file's own header comment) if the artwork ever
  changes.
- **The selector gets a row to itself.** Sharing one with the tally clipped the
  list name to an ellipsis on a phone, and the list name is the point of it.
- **The tally is one line**, paired with the deck's descriptor. It was three
  stacked blocks taller than everything around them; it is status, not the
  exercise.
- **Branding is out of the drawer.** Navigation stays functional and compact,
  and a test asserts the drawer holds neither the name nor the mark.

### The direction toggle

`word → meaning` was printed over lists that hold no meanings. A paradigm cell
answers with an analysis (`Lakṣmī — saptamī bahuvacana`), a sandhi rule with
the result of a join, a gaṇa with its name. Reversed, those read
`meaning → word`, which was simply false.

A deck may therefore name its own pair, and **both labels come off that one
string** — the reverse is the halves swapped:

```json
{ "name": "Table mastery — the eight baseplates",
  "pair": "form → analysis",
  "cards": [ … ] }
```

`pair` is optional and defaults to `word → meaning`, which is right for most
of the app. The build rejects a `pair` that is not exactly `front → back`.
Twenty-four decks carry one: `form → analysis`, `join → result`,
`term → definition`, `pattern → name`, `pattern → metre`, `parts → compound`,
`compound → vigraha`, `sūtra → sounds`, `root → meaning`, `affix → sense`.

Reversing is worth having on all of them — `analysis → form` is the drill a
paradigm table exists for, and `result → join` is the split exercise.

Two rules beyond that:

- **A list that runs one way says so.** On a `choice` or `sequence` card both
  toggles grey out and the button reads `one direction only` rather than
  naming a pair it cannot offer. A transformation runs one way, and the IAST
  on those cards *is* the content rather than a gloss of it. A deck of nothing
  but interactive cards is therefore greyed for its whole round, which is what
  "disabled by lesson structure" amounts to.
- **A cross-list draw falls back to `word → meaning`.** Review and trouble
  rounds mix decks, so no single pair describes them.

### Navigation and progress

The app opens on a card, not on a menu. Navigation is a **left drawer**, opened
from a selector at the top left — aligned with the card, not centred over it —
which names the lesson and list in play. Inside is the curriculum's own shape:
**track → lesson → deck**.

The five tracks are the course. Stage ranges are given here because this is a
maintainer's file; **they are not shown in the app**:

| Track | | Stages |
|:------|:--|:-------|
| Bhāṣā-Vidyā | *Language Acquisition* | 1–13 |
| Kāvya-Racanā | *Poetic Composition* | 14–16, 18–19, 21–26 |
| Pūjā-Vāk | *Ritual Literacy* | 17 |
| Svara-Vidyā | *Vedic Literacy* | 20 |
| Avadhāna | *Attention Under Pressure* | 27–36 |

`TRACKS` in `app.js` is the only place this lives, and the drawer is built from
it alone, so navigation cannot drift from the curriculum. Cross-cutting
vyākaraṇam practice is **not a sixth track**: it is listed after the five and
counts towards no track's percentage. A track with no practice yet is left out
rather than shown as an empty 0% — the drawer navigates what exists, and a
track's subheading counts the lessons actually in it, not the stages it spans.

**Pūjā-Vāk, Svara-Vidyā and Avadhāna are the curriculum's own names.
Bhāṣā-Vidyā and Kāvya-Racanā are not** — nothing in the repository names those
two groupings, so they were coined to match the other three. Rename them
freely; `TRACKS` is the only place either appears.

**Everything in the drawer is named the same way:** the Sanskrit in IAST as the
heading, the English as an italic subheading beside a count. It holds at all
three levels and for the mode rows too — `Pūjā-Vāk` / *Ritual Literacy · 1
lesson*, `Rūpa` / *Case, Number, and Gender · 3 lists*, `Parīkṣā` / *proof of
mastery*. A lesson's pair is read straight out of its `theory.md` heading,
which always has the shape `Stage N: Name — English`, so the two cannot drift
from the curriculum either.

Two things are deliberately absent from the drawer, and tests assert both:

- **No Devanagari.** It is chrome, not content; Devanagari belongs on the
  cards, where it is the thing being learnt.
- **No stage numbers.** A stage number is how this repository orders its
  directories. It is gone from the header caption, the scoreboard rows and the
  shared score summary as well, replaced in each by the lesson's own name —
  which still tells a `Practice` deck in Rūpa from one in Kriyā. `DECK_STAGE`
  survives only to map a lesson to its track.

Review, trouble and the scoreboard live in the drawer too, above the tracks,
with the scoreboard first. A panel is opened from the drawer, which then
closes, so the way back cannot be the button that opened it: `#panel-back`
does that instead.

**Progress is mastered cards over cards held.** A card is mastered once it
comes back right on its **first** showing in a round — the same cold-recall
signal a deck's best score is built from, and the one that counts a card out
of the trouble list. A wrong answer takes it back; a percentage that could
only ever rise would leave a lesson ticked long after it had gone. Every kind
of round feeds this, review draws and trouble drills included: whether a card
came back cold is a fact about the card, not about the round it turned up in.

Two rules keep the figure honest:

- **Counted from cards the whole way up.** A track's figure is the union of its
  lessons' cards, never the average of their percentages — that would give a
  five-card lesson the same weight as a hundred-card one.
- **A tick means all of it.** 100% is `done === total`, not a rounded 99.6;
  `progressOf` holds a not-quite-finished list at 99% and a barely-started one
  at 1% rather than letting either round away.

Every card the app carries counts towards the denominator. What is here is
curated practice plus the paradigm tables the badges ask for whole — reference
material was never brought in, so there is nothing to filter out.

### Card schema

```json
{
  "id": "06-kriya:kriya:namami",
  "devanagari": "नमामि",
  "iast": "namāmi",
  "gloss": "I bow",
  "note": "1 sg. pres. · √nam · parasmaipada"
}
```

A card with no `type` is `reveal`. `choice` adds `front`, `options`, `answer`;
`sequence` adds `front`, `parts`, `answer` (an array). Both take an optional
`source`. Add nothing else without a demonstrated need.

```json
{
  "id": "06-kriya:person:nam-1sg",
  "type": "choice",
  "front": "namati → make it “I”",
  "options": ["namāmi", "namasi", "namanti"],
  "answer": "namāmi",
  "note": "1 sg. laṭ · √nam · parasmaipada",
  "source": "workbook A2"
}
```

**A prompt names the task, then the item.** `Split: jagan nāthaḥ`, not
`jagan nāthaḥ came from ?`. The learner is mid-round and reading fast; the
operation should be the first thing on the card and the item the thing they
dwell on. Three shapes are allowed and `scripts/test.js` asserts that every
`choice` card is one of them:

| | |
|:--|:--|
| a task label and its item | `Change to 1st singular: namati` |
| a direct question | `Which vibhakti is NOT a kāraka?` |
| a meaning over a frame | `"I bow to Rāma"` ⏎ `___ namāmi` |

The label stays short — five words at most where an item follows it — so the
item is what gets read. A prompt that *ends* at its colon is a lead-in to the
options and is a sentence by design, so the length rule does not apply to it.

**`choice` is one renderer, not one per lesson.** Recognition ("which
analysis?") and controlled transformation ("make it 'I'") differ only in the
prompt. Options are shuffled per showing, so position is never what gets
remembered. Grading is not a separate scheme: the right option ends as
`knew()`, a wrong one as `didntKnow()`, so the trouble list, missed pile,
review mastery and scoreboard all see one retrieval event — the same as a
reveal. Neither the direction toggle nor the IAST toggle applies, since a
transformation runs one way and the IAST here *is* the content.

Distractors must be other forms of the same verb or paradigm. A learner's real
confusion is person, number or lakāra, never a random unrelated word.

`source` is provenance and renders on its own line, deliberately outside the
morphology annotation chip — `renderTag` turns a whole note into one tappable
popover, and "workbook F1" is not morphology.

```json
{
  "id": "12-vakya:sentence:mata-grhe",
  "type": "sequence",
  "front": "Build: “Mother cooks food at home.”",
  "parts": ["mātā", "gṛhe", "bhojanaṃ", "pacati"],
  "answer": ["mātā", "gṛhe", "bhojanaṃ", "pacati"],
  "note": "subject → object → verb · the unmarked order; Sanskrit permits others",
  "source": "workbook A1"
}
```

**`sequence` is tap-only.** Chips move from the bank into the line by tapping;
tapping a placed chip sends it back; Back, Reset and Check sit below. There is
no dragging and no typing — the plan rules both out, and the tests assert that
nothing in the sequence UI is `draggable` and that it contains no input.
Pieces are tracked by their **index in `parts`**, not by their text, so a bank
that repeats a word still knows which chip came from where. The bank is
shuffled per showing.

A wrong assembly spells the correct sentence out; a right one does not need
to. Grading is the same shared path: `knew()` or `didntKnow()`.

**Word order is a real hazard here.** Sanskrit permits orders other than the
one a card marks correct, so a `sequence` card must not imply its answer is
the only grammatical one. `12-vakya/theory.md` tells the learner to "think in
Subject-Object-Verb order" and every workbook answer follows it, so the cards
ask for that order and the note says it is the *unmarked* one rather than the
only one. Keep chip sets to three or four; beyond that the exercise stops
being retrieval and becomes visual search.

Three things here are load-bearing for the compatibility list above:

- **`id` is the card's identity.** It is written in `practice.json`, never
  derived from what the card displays. Change an id and you retire that card's
  history.
- **Deck names key saved scores.** `SAVED.decks` is keyed by the deck's full
  name, so renaming a deck would silently drop its best score and missed pile.
  `DECK_RENAMES` in `app.js` lists every rename the app has made and applies it
  once on load, the same way `OLD_KEYS` rescues state from an earlier storage
  key. **Never rename a deck without adding a line there.** Vocab-bank decks
  still carry their `V01 ·` prefixes; the drawer hides them from display.
- **Deck names carry the product structure.** Within a lesson the drawer reads
  `Practice`, then `Table mastery` / `Conjugation mastery`, then the rest —
  because `DECK_SHORT` displays the text before the em dash. Practice prepares
  generalisation; mastery closes known finite gaps.
- **Progress lives in `localStorage`** under the key `abhyāsaḥ` — chosen before
  the brand settled on the bare stem **Abhyāsa**, and left alone: it is
  invisible plumbing, not displayed text, and renaming it would only add
  migration risk for no visible benefit. Versioned by `SAVED.v`
  (now 3). v1 keyed trouble history by `devanagari + '¦' + gloss`; the app
  lifts those records onto stable ids on first load. v2→v3 seeds `SAVED.mastered`
  from the one case that can be resolved exactly rather than guessed at — a
  deck whose best round was perfect *and* whose size has not changed since.
  `OLD_KEYS` separately lifts state out of earlier storage key names. Keep every
  chain, and keep each step stamping its own version rather than the newest;
  every `localStorage` touch stays guarded, since it can be absent or full.

The app carries 23 lessons, 71 decks, and 2041 cards — 1876 `reveal`, 160
`choice` and 5 `sequence`, spread over 14 interactive decks in 11 lessons,
plus two mastery decks holding complete paradigms.
They are curated practice, not conversions of the reference tables:

- `06-kriya` — 21 cards: person, tense, imperative, optative, and parsing.
- `03-sandhi` — 31 cards: joins, splits, naming the rule, and the
  ac / hal / viśeṣa categories, mapping onto the three badge requirements.
  The 27 rule-name `reveal` cards stay as their own deck; the plan keeps
  terminology where terminology is the point, and the operation is now
  drilled separately.

- `04-guna` — 11 cards: adjective agreement, including the contrast that
  `sundara` takes a feminine in -ī where `divya` takes -ā. Adjective
  *vocabulary* stays `reveal`.
- `05-rupa` — 15 cards: recognise a case, produce a form, and pick the case a
  devotional phrase needs. Selected contrasts across stems, never a paradigm
  table transcribed.
- `07-karaka` — 11 cards: the role a word plays in a real sentence, plus the
  role→vibhakti mapping and the fact that ṣaṣṭhī is not a kāraka at all. Each
  answer names **both** the semantic role and the morphological case
  (`karaṇa · instrument · tṛtīyā · instr. sg.`), which is the distinction the
  lesson exists to teach.
- `02-varna-vidya` — 7 cards: what each pratyāhāra covers, and how one is
  formed. No articulation widget, as the plan forbids.
- `08-sambodhana` — 9 cards: form the vocative across five stem types. The
  confusable pair is i-stems (`agne`) against u-stems (`viṣṇo`).
- `09-dhatu` — 11 cards: kṛt and taddhita suffixes as operations
  (`√gam + ktvā → gatvā`). Kṛt/Taddhita has no lesson of its own, so it lives
  here beside the upasarga material, per the audit's decision 4.
- `11-samasa` — 11 cards: name the compound type, and the vibhakti a
  tatpuruṣa unpacks with. `choice` before any compound builder, as the plan
  requires.
- `19-chandas-i` — 11 cards: scan a word into laghu/guru, then name the gaṇa.
  Scansion is the operation the lesson exists to teach.
- `21-chandas-ii` — 4 cards: name the metre from its gaṇa sequence. No metre
  engine; full scansion and composition stay in the workbook.
- `12-vakya` — 18 cards: a sentence with a hole in it, and options that force
  a grammatical decision — case, agreement, verb form, connector. Constituent
  order is deliberately *not* tested; see **`sequence` is only for orders the
  grammar forces**.
- `03-sandhi` — 5 `sequence` cards: order the stages of a derivation. The only
  use of `sequence` in the app, because it is the only place where the order
  is determinate.

Roughly the last third of the decks are generated from the `vocab/` bank and
marked as such.

**On deck size.** A large deck is not automatically bloat. A word list is not
a reference table, and nobody learns Sanskrit from fifteen nouns — `01-nama`
legitimately holds a third of the app. A paradigm deck is large for a
different and equally good reason: the table is finite and the badge wants all
of it.

What is bloat is the same card twice in one lesson, and unbounded expansion of
the *curated* sets. `scripts/test.js` asserts that no card appears twice
within a lesson, and — the other way round — that every declension stem covers
all 24 cells and every conjugated dhātu all 9 laṭ forms.

**Removing a card does not destroy its history.** The v1→v2 migration leaves
records it does not recognise alone, `pileCards()` resolves a pile against the
deck rather than the other way round, and `ds.best` is compared as a ratio —
so a best score set on a larger version of a deck stays meaningful. A card
that is removed and later restored brings its trouble history back with it.
Tests cover all four.

A choice note is not uppercased the way a reveal card's morphology chip is —
a sandhi rule prints vowel values (`guṇa · a + i → e`), and IAST is written
lowercase.

**Testing** — `node scripts/test.js` drives the built file in headless
Chromium from `file://` and checks the compatibility list above: saved
progress and its migration, trouble cards, review replay, the IAST toggle,
morphology, mobile touch targets, the choice interaction, drawer navigation
down to a deck, and the mastery figure at every level. It needs
`playwright-core` on the path but is deliberately not in a `package.json`; the
app itself has no dependencies and should keep none. Run it after any change
to `app/`.

**Publishing a testable demo** — `node scripts/demo.js` rewrites
`dist/abhyasah.html` into `dist/abhyasah.demo.html`, stripping the
`<!doctype>`/`<html>`/`<head>`/`<body>` wrapper that the Artifact host supplies
itself. Publish that file to give the learner a live page to try on a phone.
The demo is generated and git-ignored; `dist/abhyasah.html` remains the real
distributable.

### Known conflicts

**Stage 20 is drawn in two places.** The course-track diagram gives
Svara-Vidyā a track of its own at stage 20, while the poetic track's range is
written "18–26", which contains it. Stage 17 is carved out of its neighbouring
range in exactly the same way, and there it is unambiguous because
"14–16, 18–26" simply skips 17. Reading 20 the same way — a named track lifted
out of the range around it — is what the diagram means, so `TRACKS` excludes it
from the poetic track rather than counting it twice, and a test asserts no
stage belongs to two tracks. Say so if the diagram is ever meant literally.


**`AUDIT.md` is the full record** — read it before touching stage metadata. The
short version:

The **directory identifier is the canonical stage identity**, and `badge.md`
agrees with it in all 36 lessons. Key on directory names and you are always
correct. Everything else disagrees somewhere:

- `theory.md`, `reference.md`, and both workbooks carry `Stage N` headings from
  an earlier **32-stage** curriculum, drifting in 31 of the 36 lessons.
  **Repaired** — all 36 now agree. Body cross-references still mix old and new
  numbers and were deliberately left alone.
- `00-overview.md` lists 36 slots but a different *set*: no Sandhi, plus a
  phantom `Sva-Avadhāna` at 35 with no directory.
- `README.md` mixed both schemes. **Repaired.**
- `vyakaranam/` holds 6 files that duplicate merged lesson material and 16 that
  are unique. `build.py` now **fails if any of the six pairs drifts**; the
  lesson copy is canonical.

All six decisions in `AUDIT.md` §7 have been acted on. Two problems remain
open, both found while repairing the others:

- Lesson **prose** cites stages by number, mixing old and new schemes. There is
  no mechanical rule separating them, so they were deliberately left alone.
  Read each reference against what it points at before touching it.
- The 16 unique `vyakaranam/` files — about 110 KB — are **published nowhere**.
  `build.py` collects `stages` and `vocab` only, so there is no Grammar section
  in `index.html`, though `README.md` and `00-overview.md` both promise one.
