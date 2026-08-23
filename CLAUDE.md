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
exists only in `02-varna-vidya`, `05-rupa`, and `06-kriya`. 27 of the 36 carry
a `practice.json`; the 9 without are all avadhāna performance stages
(28–36), where open-ended production is the point and the workbook is the
right home — every one of their badges asks the learner to *compose*,
*narrate* or *perform*.

**A stage is carded when its workbook holds a bounded operation to card.**
That is the rule, not a backlog, and it has now been applied three more
times. Stage 22 joined when the classical metres moved to the stage that
names them. Stotra II looked like a gap next to Stotra I and was one — its
sections A and D are bounded, B and C are composition and stay in the
workbook. And the same reading of Kāvya-Racanā's three uncarded stages found
bounded sections in all three:

| | |
|:--|:--|
| **16 · Prārthanā** | section A's nine loṭ forms, and section B's five prayer lines completed by choosing the right imperative |
| **18 · Kathā** | section A's nine laṅ forms, the past tense a story is told in |
| **23 · Paryāya-Chandas** | sections A and B: the synonym that fits a slot of a given weight — the intersection of Paryāya and Chandas I, and the one drill in the app that cards do better than a workbook can, since the options can be shuffled |

Every card in the three is the workbook's own answer, distractors included:
`kamalam ∪∪∪ · padmam – – · paṅkajam – ∪∪` are all three the answer key's.
Kāvya-Racanā went from 8 carded stages to 11, and from 233 cards to 267.

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
app/logo.png           the brand logo artwork — edit this
app/logo.svg           app/logo.png, base64-wrapped for the build
app/styles.css
app/app.js
scripts/build.js       discovers, validates and inlines -> dist/abhyasah.html
scripts/markdown.js    reference.md -> HTML, at build time, for Study
scripts/demo.js        repackages the distributable for publishing as an Artifact
NN-lesson/practice.json   the lesson's curated practice
NN-lesson/reference.md    the lesson's reference, shown by Study
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

### The page declares its own colour scheme

`:root { color-scheme: dark; }` is load-bearing, not decoration. Chrome and
Brave auto-darken any page that does not declare a scheme, and this one looks
to them like a light page worth darkening — so they repainted the palm-leaf
card a muddy olive with inverted text, on the phone where the app is mostly
used. The page paints its own dark ground and puts a deliberately light card
on it; declaring the scheme says so and opts out of being second-guessed.

Nothing in the cascade changes when a browser does this — `getComputedStyle`
still reports `#e9dcbe` — so no ordinary test could see it. `scripts/test.js`
launches Chromium a second time with `--enable-features=WebContentsForceDark`
and reads the pixel actually painted at the card's corner. Without the
declaration it reads `rgb(60, 51, 28)`.

### The practice screen

The exercise is the page. Everything above the card is small, left-aligned on
the card's own edge, and adds up to about 140px on a 390px phone — a test
asserts the card starts within 165px, because this is the kind of thing that
creeps back.

```
☰ Sandhi · Practice ›                    अभ्यास  (◎)
                                         ABHYĀSA
JOINS AND SPLITS            31 LEFT  0 LEARNED  0 MISSED
┌──────────────────────────────────────────────────────┐
│                       the card                        │
└──────────────────────────────────────────────────────┘
                      [ ✕ ]      [ ✓ ]      ← kumkuma / patra
                 ⇄ join → result    ☑ IAST
```

- **Navigation top left, the logo top right**, on one row. There is no centred
  logo during practice; a test asserts there is no `h1` at all.
- **The branding is secondary.** The lockup runs 34px tall, stepping down to
  26px below 400px, 22px below 385px and 17px below 360px. At 360px the bar is
  genuinely full — the longest list name leaves room for nothing taller — so
  the increase lands at 375px and above. It shrinks rather than shedding any
  part of itself — it is one image, so there is no "mark alone" to fall back
  to. The bar is not wide enough on a phone for the full-size lockup *and* the
  longest list name, and the list name is what the bar is for: a test walks
  every deck at 390, 375 and 360px and fails if any name is clipped.
- **The two toggles sit below the card, centred.** They change how a card is
  shown, so they belong under the thing they change; above it they competed
  with the prompt.
- **The artwork is `app/logo.png`** — the project's own logo lockup entire,
  Devanagari wordmark, small-caps ABHYĀSA and ring mark together, exactly as
  the logo sets them. Nothing is re-set as type beside it. The background is
  keyed to transparent and the ink recoloured to the app's `--leaf` token, so
  it sits on the palette exactly rather than carrying the source image's own
  tan. `app/logo.svg` base64-wraps that PNG in an
  `<svg class="brand-logo"><image .../></svg>` so the build can inline one
  piece of text at the `<!--logo-->` placeholder; regenerate it (a one-line
  `base64.b64encode`, given in the file's own header comment) if the artwork
  changes.

  **An inlined file must never quote the placeholder it is inlined at.** An
  HTML comment ends at its first `-->` whatever the nesting, so a `logo.svg`
  whose header comment mentioned `<!--logo-->` literally closed that comment
  early and spilled the rest of its own prose into the page as visible text —
  which also blew the brand box out to 457px and clipped every list name. The
  build now refuses such a file by name, and a test asserts the brand box
  stays as wide as its logo and no wider.
- **The selector gets a row to itself.** Sharing one with the tally clipped the
  list name to an ellipsis on a phone, and the list name is the point of it.
- **The tally is one line**, paired with the deck's descriptor. It was three
  stacked blocks taller than everything around them; it is status, not the
  exercise.
- **Branding is out of the drawer.** Navigation stays functional and compact,
  and a test asserts the drawer holds neither the name nor the mark.

### Recognising a form is not producing one

`DIR` is the learner's own setting, and for ordinary practice it decides. A
review is different: it is the app asking, and it asks harder as a card holds
up.

The badges want production — a noun *through all 8 vibhaktis × 3 vacanas* —
but reversal was entirely learner-driven, the setting defaults to recognition,
and a draw ran in whichever way the toggle happened to be sitting. So a card
could be learned, reviewed twice and called **retained** with the produce
direction never once attempted: the strongest claim the app makes rested on
the easier half of the card.

So in a review, **a card that has already come back right once is asked the
other way round.** The first return re-establishes it; every return after that
is production. `retained` therefore now means what it sounds like — two review
sessions days apart, at least one of them producing the form rather than
recognising it.

- **Nothing is stored for it.** The run of first-try corrects is already kept
  per card, and it is exactly the right signal: difficulty rises as the card
  proves it can carry it. `askedDir()` is the whole rule.
- **The toggle states what is being asked, and does not offer to change it.**
  A third state was needed: the learner's to change, the review's to state, or
  none at all. `one direction only` would be false on a reveal card and a
  blank would be worse, so a locked toggle shows the real pair (`meaning →
  word`) with a title saying Abhyāsa chose it.
- **The learner's own setting is untouched.** `SAVED.dir` is not written by a
  review; ordinary practice comes back exactly as they left it.
- **Two rounds are deliberately exempt.** An interactive card runs one way by
  construction, and the trouble drill is not escalated — those are cards the
  learner is already losing, and the harder direction is the last thing they
  need.
- **The typography follows the direction actually asked**, not the stored
  setting: `mode-produce` decides which side is set in Devanagari, so it is
  applied per card during a review and cleared for interactive cards.

The flip prompt moved into `paint()` for the same reason. `next()` sets it
before the card is dequeued, which was harmless while the direction was one
global setting and wrong the moment it became a fact about the card.

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
Fifty-five decks carry one: `form → analysis`, `join → result`,
`term → definition`, `pattern → gaṇa`, `pattern → metre`, `parts → compound`,
`compound → vigraha`, `sūtra → sounds`, `root → meaning`, `affix → sense`,
`affix → form`, `form → sense`, `line → relation`, `line → vibhakti`.

It now carries a second job: the task cue on the card is read off it.

Reversing is worth having on all of them — `analysis → form` is the drill a
paradigm table exists for, and `result → join` is the split exercise.

### The task cue

A reveal card shows an item and nothing else, so the operation being asked for
lived only in the direction button *below* the card — and the same front wants
quite different things in different lists: `रामाय` asks for an analysis in a
paradigm table and a translation in a vocabulary list. One quiet line above the
item names it.

```
ANALYZE THE FORM              PRODUCE THE FORM
रामम्                          rāma- · dvitīyā · ekavacana
rāmam
```

**It is derived from the deck's `pair`, not written on 2000 cards**, and it
keys off the pair's **destination** half — the thing the learner has to produce
— so both directions fall out of one table and a list that already names its
pair needs nothing added to it. `CUES` in `app.js` holds one entry per
destination noun actually in use; `meaning`, `definition` and `sense` share a
cue, because they ask for the same act of recall. A destination the table does
not know shows no cue at all, which is the right failure: better silent than
wrong.

- **Interactive cards get none.** A `choice` or `sequence` prompt already names
  its task — `Join: nara + indraḥ`, `Identify the case: śivam` — and a cue over
  the top would only repeat it.
- **A cross-list draw falls back with the pair.** Review and trouble rounds run
  on `word → meaning`, so they cue `Recall the meaning` / `Produce the word`.
- `29 · Gaṇa` was re-paired `pattern → name` → **`pattern → gaṇa`**: the cue is
  read off the destination noun, and `name` names nothing.

`scripts/test.js` walks every list in both directions and fails if a reveal
card shows no cue, if an interactive one does, or if the cue is not above the
item and smaller than it.

Two rules beyond that:

- **A list that runs one way says so.** On a `choice` or `sequence` card both
  toggles grey out and the button reads `one direction only` rather than
  naming a pair it cannot offer. A transformation runs one way, and the IAST
  on those cards *is* the content rather than a gloss of it. A deck of nothing
  but interactive cards is therefore greyed for its whole round, which is what
  "disabled by lesson structure" amounts to.
- **A cross-list draw falls back to `word → meaning`.** Review and trouble
  rounds mix decks, so no single pair describes them.

### The IAST toggle

It hides a **transliteration**, and nothing else. Two things follow, and both
were once wrong:

- **The transliteration is a line on the card**, on whichever side the
  Devanagari is. In the produce direction it used to be appended to the
  morphology annotation instead, so the card showed no IAST at all and
  toggling the box looked like it was rewriting the grammar. `#iast` carries
  it on the front, `#iast-back` on the back; `renderTag` now only ever
  receives `c.note`, and a test asserts the annotation is byte-identical with
  the toggle on and off.
- **A card with no Devanagari has no transliteration to hide.** Its `iast`
  field is a second content line: a gaṇa's `laghu guru guru` *reads*
  `◡ — —`, it does not transliterate it, and hiding it left the card as bare
  marks. `transliterates(c)` tests the card's own `devanagari` for Devanagari
  codepoints, so the toggle governs a card only when there is something to
  govern — the 8 cards of `29 · Gaṇa`. On those the box is greyed and shown
  checked, with a `title` saying why.
- **The rule is per line, not per card.** A card holds up to two such pairs:
  its headword, and the optional `detail` line. A vṛtta card's front pair is a
  laghu/guru pattern over `19 syllables` — nothing to transliterate — while its
  answer pair is `म · स · ज · स · त · त · ग` over
  `ma · sa · ja · sa · ta · ta · ga`, which is a transliteration exactly. So
  the box is live there and hides the second of those lines alone.
  `detailTransliterates(c)` is the same test applied to `detail`, and
  `hasIastToggle(c)` is the two together.

This is a fact about the **card**, not the list: `28 · Vṛtta` holds twelve
pattern cards and two ordinary headwords (`उपजातिः`, `आर्या`), and each
behaves as what it is. A per-deck flag would have got that deck wrong, and a
future card needs no flag to be handled correctly.

### Study

**Practice is retrieval, Study is lookup, the workbook is production, the badge
is the demonstration.** Study is a reference *viewer* and holds to that: it
carries no cards, tracks no progress, grades nothing, and generates nothing
from what it shows.

A book icon opens the lesson's own `reference.md` in a panel, rendered at build
time by `scripts/markdown.js` and inlined like everything else — the page still
has nothing to fetch. `theory.md` is deliberately not carried: teaching is not
lookup.

- **The renderer is narrow on purpose.** Headings, paragraphs, pipe tables,
  bullet and numbered lists, blockquotes, fenced blocks, rules and `**`/`*`
  emphasis — exactly what the reference files use. Anything else falls through
  as paragraph text rather than being guessed at. **An inconsistency in a
  reference is a content bug to fix in the lesson**, never something the reader
  reinterprets.
- **Line breaks inside a paragraph are kept.** Every multi-line paragraph in
  these files is line-significant — verse pādas, parallel epithet lists — so
  reflowing them the way Markdown normally would is not "verbatim".
  `scripts/test.js` checks 6256 fragments across all 36 references against the
  rendered output and fails if any goes missing.
- **The panel is titled from the lesson, not from the file's own `h1`**, so
  Study and the drawer cannot disagree about what a lesson is called. The `h1`
  is dropped from the body, since it would be the same words twice.
- **A contents list appears at five top-level sections**, which is where these
  files start needing one. Thirteen of the twenty-three get one.
- **Hidden, not greyed, where there is nothing to look up** — a lesson with no
  `reference.md`, and mixed or trouble rounds, which belong to no one lesson.
- **The button sits on the status row, not beside the selector.** The top row
  is genuinely full: below 375px *no* logo size leaves room for a fourth
  control **and** the longest list name, and the list name is what that row is
  for. On the status row it reads as what it is — the lesson's reference beside
  the lesson's descriptor — and it costs no height, because the glyph is 17px
  with a 44px tap area laid over it. (`min-height` beats `height`, so the
  shared `button` rule's 44px has to be cleared explicitly or the control sets
  the row's height.)

Three reference headings disagree with the directory scheme and are **left for
upstream**: `03-sandhi` heads itself `Chapter 2: Sandhi -- Reference Guide`
(the vyākaraṇam numbering, and an ASCII dash), while `02-varna-vidya`,
`17-puja-vak` and `20-svara-vidya` carry no `Stage N:` at all. None reaches the
reader, because the panel titles itself from the lesson. `03-sandhi` cannot be
fixed on its own in any case: `build.py` holds it byte-identical to
`vyakaranam/ch02-sandhi/reference.md`, where "Chapter 2" is correct.

### Navigation and progress

**Two pages, and nothing under them.** The landing card opens the tracks; a
track's own page opens its lists. A stage is not somewhere a learner has to be
introduced to twice, so nothing below a track has a page of its own — the
walk is **home → track → stage → list**, with prose at the first two levels
and navigation at the last two.

| | |
|:--|:--|
| a track row | **opens its page**, and leaves the track expanded for the way back |
| a lesson row | expands to its lists |
| a list row | starts the round |

**Each level is shut until the level above has been read.** Before the landing
card's `Begin` the track names are greyed; before a track's `Begin` its lists
are. Nothing is hidden — a learner should see what is coming — and one line at
the top of the shut group says what opens it, naming whichever gate is
actually closed: *Open Home and press Begin to start*, then *Tap the name
above and press Begin to open these*.

`SAVED.begun` is the whole mechanism: `home`, and a track id per track begun.
Pressing a track's `Begin` sets both, because you cannot be inside a track
without having got past the door.

**A menu of one is not a menu.** A track that comes down to a single list —
`Svara-Vidyā`, `Avadhāna` — draws no row under its name at all: the page's own
`Begin` is the way to it, and drawing it would repeat the name above it.

**One child is folded away.** A level that has a single child adds a step
without adding information, so the drawer skips it: **a track with one lesson
*is* that lesson**, and its lists stand directly under the track's name —
`Pūjā-Vāk` inside `Pūjā-Vāk` was the same name twice. `Svara-Vidyā` and
`Avadhāna` fold the same way, and then fold again by the rule above.

**Folded by what exists, never by a list of exceptions.** `soleLesson` and
`soleDeck` read the tree, so the level reappears by itself the moment a second
lesson or a second list does, and the curriculum stays the only thing driving
the drawer. A track that folds counts what it actually holds — `· 11 lists` —
rather than `· 1 lesson`.

Where a folded lesson's name differs from its track's, the subheading keeps it
(`Avadhāna` / *Samasyāpūraṇa · 1 list*) so nothing is silently lost.

### The track page

A track says what it gives you before it asks anything of you, and **it is not
optional**: tapping the track name in the drawer opens this page, and the
track's lists stay shut until `Begin` is pressed on it.

```
13 STAGES · 137 LISTS
Bhāṣā-Vidyā · Language Acquisition
This is the track that teaches you to read. You start with words…

HOW THIS TRACK RUNS
1. Words first. Nāma gives you several hundred of them…
2. Then the two things that change a word's shape…
│ Nothing here has to be finished before the next thing makes sense…

WHILE YOU PRACTISE
noun · neuter · a-stem   The red line under an answer. Tap it and it says
                         what the word is and why the form is the form it is.
        📖               The Study icon, beside the list name. It opens this
                         lesson's own reference to read while you practise.

TRACK PROGRESS                                                        12%
[ Continue — Vibhakti-rūpa ]  [ Abhyāsa review ]
Abhyāsa mixes cards from every list you have completed, so what you learn
here keeps coming back.
```

- **The prose lives in `TRACKS`**, beside the definition of the track it
  describes. A track is the app's own grouping rather than a curriculum
  object — two of the five names were coined here — so its introduction
  belongs with it, not in a lesson's `practice.json`. Each carries `lead`,
  `plan`, an optional `note`, and two couplings that keep the prose honest:
  `lessons`, what the track should hold, and `mentions`, the names the plan
  leans on. **A test fails when either goes stale**, because prose does not
  rewrite itself when a stage is added or a list renamed.
- **It is written for someone who has never met the material.** The lead says
  what the track gives you, the plan says how it runs in three or four steps
  and names the stages where naming them helps, and one optional italic aside
  defuses the thing most likely to put a learner off.
- **The page shows the two controls rather than naming them.** The red line
  and the Study icon are the two things a learner cannot discover on their
  own, and prose describing them taught nothing: the page carries a real
  annotation, in kumkuma under its dotted rule, and the Study glyph itself.
  A test resolves the colour and the border style off the sample and fails if
  either stops matching a card's own.
- **A track with nothing left to finish offers the review.** `Continue —
  <first list>` pointed back at list one once every list was complete, which
  is the one moment the review is exactly the right next thing.
- **The prompt changes once the track has been begun.** Untouched, the page
  reports nothing and reads `Begin — <first list>`; that press is what opens
  the track. After it, the page carries **one** figure — track progress — and
  the button reads `Continue — <first unfinished list>`. `Begin` is never
  offered twice.
- **It carries no list menu.** The lists are in the drawer, where navigation
  lives; repeating all 137 of them here would make an orientation page into a
  directory. One aggregate figure, and the next action.
- **Abhyāsa is a reminder, not a section.** One line under the actions saying
  that completed lists come back, and a button that opens the review. It is
  deliberately the smaller of the two buttons: the track's own next list is
  what this page is for.
- **No binding holes.** They mark a flashcard as a leaf of the manuscript; on
  a page that is read rather than answered they are two dots interrupting the
  prose. The landing card lost them too.

Stages had a page of their own for one build, one per lesson, with the prose
in each `practice.json`. It was a page too many: the learner met an
introduction, then another introduction, before reaching a card. The
per-lesson `overview` blocks were removed with it (they are in the history at
`749a342` if a stage-level page is ever wanted again), and `scripts/build.js`
no longer validates them.

### The landing card

The app opens on a card, not on a menu — and the first one is a welcome
rather than a flashcard. It is the same palm-leaf surface, set as prose
because it is read once rather than answered:

```
अभ्यास
Welcome to Abhyāsa!
Learn Sanskrit through practice, from your first words to composition,
poetry, Vedic recitation, and Avadhāna.
…
OVERALL MASTERY                    0%
LISTS COMPLETE                      0
[ Begin — Bhāṣā-Vidyā ]   [ Scoreboard ]
```

- **It shows the menu rather than describing it.** A learner who has never
  opened the drawer has no way to know the tracks, the track pages or their
  progress are in there — so the card carries the selector itself, drawn as it
  sits in the top bar (`☰ Nāma · Devī ›`, inked for the leaf and inert), beside
  one line saying what it is for: it names the list you are on, opens the five
  tracks, and marks your progress against every track, stage and list. Same
  principle as the two controls on a track page, and a test asserts the sample
  is there, carries its bars and caret, and is not a second `button`.
- **It is reachable again from the drawer.** Every page in the app has to
  stay open after it has been read, and this is the only one no row in the
  tracks leads to — so `Home` is the first of the mode rows, above
  `Scoreboard`.
- **Anything that starts a round dismisses it.** `loadDeck()` and
  `startRound()` both call `leaveWelcome()`, so every other surface — the
  drawer, a review draw, the trouble drill — reaches the cards without
  knowing the landing card exists. It is never something to get past.
- **It is the first of the two gates.** With nothing begun there is nothing
  in progress, and `In progress` would have dropped a first-time learner into
  a list with no idea what it was for — boot loads `SAVED.deck` behind the
  welcome whether or not it has ever been opened. So on a first visit the
  button reads `Begin — <first track>` and opens that track's page, whose own
  `Begin` opens its lists.
- **`In progress` resumes the list you were on**, once anything has been
  begun. Boot has already loaded and labelled the round behind the welcome,
  so the button only has to uncover it. Its `title` names the list.
- **A panel opened from it returns to it.** `openPanel` records the welcome's
  state alongside the card's, so the scoreboard closes back onto the landing
  card rather than onto cards the learner never chose.
- **Its buttons carry the card's palette.** The app's buttons are inked
  `--leaf` for the dark ground, which is invisible on a light card — the same
  reason the choice options carry their own colours.
- **The mastery figure reads `0%`, not `Unranked`.** This is the one place
  the drawer's vocabulary is not followed: a beginner reading *Unranked*
  beside *Lists complete 0* reads it as a fault, and before the first review
  the figure really is nought. The drawer keeps `Unranked`, where the word
  has the room to mean something.

`scripts/test.js` opens the page raw for this — the suite's `open()` helper
loads a deck, which is exactly what dismisses the landing card.

Navigation is a **left drawer**, opened
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

**Every list is headed in Sanskrit, with its English in the descriptor.** The
drawer draws a list as its head over `<descriptor> · N cards`, so a list called
`Goddess names I` said the same thing twice and left the subtext saying
nothing. 121 of the 168 were renamed in one pass:

```
Devī-nāma                 Śastra                   Rūpa-siddhi · Śiva
the great names · LS      weapons · DM             all 17 forms
· 15 cards                · 21 cards               · 18 cards
```

Each head is **the shortest Sanskrit word that says what the list holds**, and
is taken from a word the list itself teaches wherever one exists — `Śara` for
arrows, `Uvāca` for the speech tags, `Saṃsthitā` for the DM 5 litany, `Yuddha`
for battle. Provenance follows the English in the descriptor (`weapons · DM`),
so the sigla still reach the learner.

Three families needed a term the repo did not already carry, and they take the
traditional ones: **`Śabda-rūpa`** for a declension table, **`Dhātu-rūpa`** for
a conjugation table, **`Rūpa-siddhi`** for deriving a form. The exercise lists
are headed by the operation — `Saṃyoga` and `Viccheda` for joining and
splitting, **`Prakriyā`** for ordering a derivation, `Mātrā` for scansion,
`Paryāya-varga` and `Bhinna-pada` for the two set drills.

**These heads are coinage where the curriculum has no name**, exactly as
`Bhāṣā-Vidyā` and `Kāvya-Racanā` are. Rename any of them freely; each is one
line in its `practice.json` plus a `DECK_RENAMES` entry.

`scripts/test.js` fails if a head contains an English function word, if a list
has no descriptor, or if a head is long enough that `DECK_SHORT` clips it —
tokenised on separators rather than matched with `\b`, because JS word
boundaries are ASCII and would find a bare `a` at the end of `Guṇa`.

`Mātrā` was `Laghu-guru` for one build, until the rule that **a deck's
descriptor must not answer a question the deck asks** caught `guru` in it.

**Curriculum items are named in Sanskrit; the app's own functions are named in
English.** A track or a lesson takes the Sanskrit in IAST as its heading and
the English as an italic subheading beside a count — `Pūjā-Vāk` / *Ritual
Literacy · 1 lesson*, `Rūpa` / *Case, Number, and Gender · 3 lists*. A
lesson's pair is read straight out of its `theory.md` heading, which always
has the shape `Stage N: Name — English`, so the two cannot drift from the
curriculum.

The mode rows are **not** curriculum, and were briefly given the same
treatment: `Aṅkāḥ`, `Parīkṣā`, `Kliṣṭāni`. That named the concepts correctly
and made the features unfindable — nobody scanning for a scoreboard finds
`Aṅkāḥ`, and the scoreboard read as simply missing. They are `Scoreboard` and
`Trouble cards`, in English, and so are the headings of the panels they open.
Abhyāsa is the deliberate exception, and the section above says why.

Each row's subheading carries that mode's live state, so the drawer answers
the obvious question without being opened into:

| | |
|:--|:--|
| `Scoreboard` | *best scores · 3 of 153 lists finished* |
| `Trouble cards` | *7 cards to clear · 2 cleared* |

### Abhyāsa, and overall mastery

**The mastery mode carries the app's own name**, so it is not one row among
three: it is the section the drawer opens with. Tapping it opens the review.

```
┌──────────────────────────────────────────┐
│ ABHYĀSA                                  │
│                                          │
│ OVERALL MASTERY             3% · Novice  │
│ ▬▬───────────────────────────────     ›  │
│                                          │
│ LISTS COMPLETE                 5 of 153  │
│ ▬▬▬──────────────────────────────────    │
└──────────────────────────────────────────┘
```

**Two measures, two bars.** Each is a labelled row with its value on the same
line and its own bar directly beneath it. One bar sitting *between* two
figures belongs to neither, and that is exactly how it read.

**The figure is kept to the drawer's own scale.** At `1.15rem` `3% · Novice`
was the largest type in the panel and behaved like a headline over everything
under it; it is `.92rem` now, and a test fails if it grows past a list name.

**It is drawn as a button, not as another row.** Abhyāsa is the one thing in
the drawer you *act on* rather than navigate to, so it is a raised panel with
an arrow on it — visibly a different kind of object from the rows below, which
are a list. A test asserts the border and the arrow. It is **palm-leaf, barely
tinted, not kumkuma**: the accent is the app's *wrong* colour, and a block of
it at this size reads as an alarm rather than an invitation.

**The drawer carries the figure and its rank; the card carries what they are
made of.** Two numbers side by side, each needing its own explanation, is the
same crowding the old layout had. So `65% review accuracy · 4% course
coverage` lives on the card the button opens, and a test fails if either word
appears in the drawer at all.

**The interface states the meaning; it never exposes the calculation.** Every
figure is labelled before it is given, and the two readings the mastery number
is made of are *named* rather than multiplied. `65% × 4%` and `cold recall`
made the learner reverse-engineer the system to find out what they were
looking at. The multiplication lives in `rankOf()` and appears nowhere on
screen — a test asserts that.

The whole model is one sentence:

> Get a card right cold → it enters Abhyāsa → Abhyāsa keeps it alive.

Keeping it alive includes keeping hold of it when it slips: a card missed in
a review loses its tick but **not** its place in the draw, and comes back at
the front of the next session. See **What a review draws**.

Every number follows from it:

| | |
|:--|:--|
| **review accuracy** | correct on the first try, over the **last ten review sessions** |
| **course coverage** | how much of the material has entered review — which is the cards you have got right cold at least once |
| **overall mastery** | the two together, as one figure with a rank beside it |
| **course progress** | lists complete, out of all of them |

**The pool is cards, not lists, and that is a correction.** A list used to
enter the review by being *completed*, and `finishedDecks()` read completion
off `ds.best` — which is set on the first finish at **any** score. A 15-card
list played through at 0/15 was therefore complete: it counted in `Lists
complete`, its cards fed the review, and it moved coverage and the mastery
figure on the strength of material the learner had never once got right. One
careless pass through Nāma's 609 cards put a beginner at 26% coverage.

So a card enters when it comes back cold, and **a list is complete when every
card in it has**. The model is shorter than the one it replaces, the review
unlocks *sooner* for an honest learner — 40 mastered cards is three small
lists — and it can no longer be handed material nobody has learnt. A test
plays a list to the end at zero and fails if either figure moves.

**`rankOf(ids)` takes a set of cards**, so the same figure in the same words
can be given for one track against its own material. Over 2332 cards nothing
a learner does in an evening visibly moves the number, which is why it read
as dead; over one track's it moves. The track page carries it as `TRACK
MASTERY 8% · Learner` under its own progress figure.

**Cards are the evidence; lists are the unit of completion.** The top
statistic was *873 of 2079 cards mastered*, which competed with the mastery
figure above it and named the wrong unit. Cards still drive the per-lesson and
per-track percentages down the drawer, where fine grain is what is wanted.

Before there is a figure the drawer reads `Unranked`, and the card says what
to do instead — *Learn 40 cards to unlock — 12 so far*, then *Reviewing 20
cards from 59 learned · 12 due now*. **The mode's own name is never the thing
being explained.**

**Accuracy is a window, not a lifetime.** It was the running average over
every card ever drawn, and after a few hundred that figure could not move: a
bad first week was permanent, a good month invisible. `masteryPct()` now sums
the last `RECENT_SESSIONS` (10) sessions' results out of `SAVED.review.recent`
— the same arithmetic over less — so it answers the question a learner
actually asks. The lifetime tally stays for *N cards reviewed*, which is a
count rather than a rate.

**Abhyāsa says what is waiting.** The drawer's button reads `abhyāsa · 12 due`
and the track page's reminder counts the same cards; `dueCount()` is
`overdueBy(c) >= 0` over the pool, which the draw already computed and never
said out loud. A figure that changes on its own, without the learner doing
anything, is the one thing on these surfaces worth coming back for.

The review window says the same things in the same words:

```
Abhyāsa
MASTERY REVIEW
65% correct on first try
Reviewing 20 cards from 59 learned · 12 due now

Abhyāsa checks how well your studied material is holding up over time.
It mixes cards from completed lists and counts only your first answer.
Cards you remember return later; cards you miss return sooner, so
review stays focused without becoming repetitive.
────────────────────────────────────────────────
Overall mastery 1% · Novice
65% review accuracy · 2% course coverage
```

### What a review draws

The paragraph above is a promise, and four small rules keep it. They live in
`mixCards()`, `overdueBy()` and `urgencyOf()`; the per-card history is
`SAVED.review.cards[id] = [session last reviewed, run of first-try corrects]`.

1. **REST** — `[0, 1, 2, 4, 8, 16]` sessions, indexed by that run, so what is
   holding up is asked less and less often. A miss resets the run to zero, and
   a rest of zero means *the very next session*. **A session is a day you
   reviewed** — see below; a card already seen in the running session is not
   due again within it, whatever its rest says.
2. **Overdue first** — among cards whose rest is up, the longest-waiting goes
   first; a card never reviewed waits longest of all, so new material leads.
   Ties are shuffled before a stable sort, so a session is never a replay.
3. **Urgency decides the front of the session** — three tiers, and they are
   the three things the review knows about a card: **lapsed** (learned, and
   the last review took it back), **never checked**, then **holding up**.
   Proven weakness outranks unmeasured, and both outrank proven strength.
4. **Round-robin across lists** — piles are drawn from one at a time, so one
   large list cannot swamp a session. A complete declension table is a
   hundred-odd cards; a flat draw would make every review mostly that table.
   Broad representation is a property of the draw, not of luck.

5. **The direction rises with the card** — a card the review has never checked
   is asked for recognition; one that has already come back right is asked to
   **produce** the form instead. `askedDir()` reads the run of first-try
   corrects that is already stored, so nothing new is kept.

Rules 3 and 4 divide the work: **the round-robin decides the spread, urgency
decides what leads.** The tier sort is applied to the finished round-robin
order, stably, so the spread survives inside each tier.

If fewer cards are due than a session holds, the rest of the session is filled
with the longest-rested cards anyway — a short pool should still give a full
review. The draw is still **not** weighted towards the cards you keep missing
— a card that has been failed ten times gets no more of the session than one
failed once, and the trouble drill is where weighted practice lives. What
rule 3 fixes is narrower and was a real bug: see below.

**A missed card used to leave Abhyāsa altogether.** Missing a card un-masters
it — a lesson has to be able to lose its tick — and the pool was
`SAVED.mastered` exactly, so the one card a review had just proved was weak
became the one card it would never show again. It reached no list's missed
pile either, because a draw keeps no list's books, and nothing brought it
back until three separate misses had built it a trouble record. That is the
opposite of the promise printed on the review card.

So the pool is split, and neither half stores anything new:

| | |
|:--|:--|
| `masteredPool()` | the cards currently held. This is what **learned** counts and what **coverage** is measured against — a card lost again is not coverage still held, and counting it would let coverage *rise* on a miss |
| `reviewPool()` | what a draw may show: the learned cards **plus the lapsed ones**, recognised by having a review record at all |

A lapsed card's run of first-try corrects is already zero, so `overdueBy` puts
it in the very next session and rule 3 puts it at the front of one; answering
it right there re-masters it through the ordinary `knew()` path. Readiness
(the 40-card unlock) counts the wider pool, so a bad session can never re-lock
the mode; the review card's *learned* figure counts the narrower one, so every
word on it stays true.

`scripts/test.js` grades a card wrong the way a learner does — through
`didntKnow()` — and then asks whether the review ever shows it again. The
older pacing test drives `recordReview()` directly, which is the scheduler in
isolation, and that is exactly why it passed while the loop around it was
broken. The new one runs against a 600-card mid-course store, because "due"
alone was not enough: with 176 piles and one round-robin pass of twenty, a
lapsed card that merely led its own pile still waited several sessions.

### A session is a day you reviewed, not a round you played

`REST` is indexed by `SAVED.review.runs`, and every finished draw used to
advance it. So three draws back to back — twenty-two milliseconds of them —
aged every card in the pool by three sessions and carried sixteen cards to
**retained**, which is supposed to mean two review sessions *days apart*. The
spacing a learner was meant to be waiting out could simply be minted, and
every rest in the ladder shortened for material that had not been away at all.

The rule is one line — `runs` advances at most once a calendar day, stamped by
`SAVED.review.day` — but it only holds if all three readings of a session
agree, and each was a separate leak:

| | |
|:--|:--|
| **the ladder** | `runs` advances once a day, so `[0, 1, 2, 4, 8, 16]` is a ladder in days rather than in button presses |
| **what is due** | a card already seen in the running session is not due again within it. A missed card rests zero, so without this it was due again the moment the results screen closed, and came back in *every* draw for the rest of the day — the repetition the mode exists to avoid. Relearning on the spot is what the in-round re-show and *Practise these again* are for |
| **what counts** | a success advances the run **once** per session; drawing the same card twice in a day is one day's evidence, not two. A **miss** always counts, because it is evidence whenever it lands, and holding it back would flatter the figure rather than guard it |

**Days you reviewed, not calendar days between**, and that half is deliberate:
a gap of a fortnight advances nothing, so coming back cannot manufacture a
backlog of hundreds due — the same reason `dueLabel` stops counting at a
session's worth. The ladder is in study-days: sit down eight times and a card
at rest 8 comes round, whenever those eight were.

**The count is banked at the end of a session**, when there is a result to
record, so every *reading* goes through `sessionNow()` — the banked count plus
the session this day would open. A raw read of `runs` would leave the due
figure a session stale until the learner had already drawn, and that figure is
an invitation to come back: it has to be true before the visit, not after it.

`SAVED.review.day` is additive and absent-tolerant — an older store simply
rolls on its next review — so it needs no version bump and nothing to migrate.

`SAVED.v` 3→4 adds that history. There is nothing to recover — before it only
the running totals were kept, and no record survives of *which* cards a past
session showed — so it starts empty, every card is due, and the first session
after upgrading draws from the whole pool exactly as it used to.

### A paradigm is shown before it is produced from

The `Rūpa-siddhi` lists are **deliberately a second pass** over the same
tables — the `Śabda-rūpa` tables being the first, and the section above says
why the second pass earns its place. The order had them the wrong way round.

The ordering rule read its bands off the **card type**: core first, then
anything interactive, then plain recall. That was a proxy for "the exercises,
then the breadth lists", and it held while breadth was the only thing made of
recall cards. A paradigm table is recall too, and a production deck is
interactive, so the rule forced all thirteen `Rūpa-siddhi` decks above all
nine `Śabda-rūpa` tables — and `Continue —` reached *Form the caturthī
singular of devī-* before a single declension table had been drilled. Stage 6
had the same shape, with the person-and-tense practice above the three
conjugation tables.

The bands are now read off `role`, which is a fact about the source rather
than a guess from the cards:

| | |
|:--|:--|
| **core** | the equivalences, or the raw material an exercise draws from |
| **table** | a paradigm shown whole — recognition, before anything produces out of it |
| *(unmarked)* | the lesson's exercises and its other lists |
| **breadth** | the vocab bank, which widens rather than carries |

Stage 5 now runs terms → nine tables → the sampler exercise → thirteen
production lists, and Stage 6 terms → three conjugations → the practice.
Nothing was rewritten to do it: the decks were reordered and twelve gained a
`role`, with every card, name and pair untouched — deck names key the saved
scores and card ids key everything else, so no learner history moves.

Making `breadth` explicit is what let the rule be stated properly. The old
proxy existed because there was no way to say "this list widens rather than
carries"; now there is, and the rule says what it means.

### The course leads, the vocabulary follows

`Continue —` is the one instruction the app gives, and it walked a track in
flat curriculum order. **82 of the 176 lists widen the vocabulary rather than
carrying the course, and 34 of those sit in Nāma** — so the recommended path
ran all 41 of Stage 1's lists, 609 cards and a quarter of the whole app,
before Varṇa-Vidyā so much as introduced the sound system. A learner
following the one instruction they are given met several hundred deity names
before their first grammatical idea, which is not what the track's own prose
promises them.

So there are now two orders, and they are different things:

| | |
|:--|:--|
| **navigation** | the drawer, unchanged: the curriculum's own shape, every list at its own place |
| **recommendation** | `recommendOrder()`: the spine in curriculum order, then the breadth that widens it |

Seven lists — about a hundred cards — now reach the alphabet, and sandhi
follows four lists later. The breadth is reached once the spine is done,
which is the point at which the vocabulary is worth having: by then the
learner can read the grammar it is set in.

**The drawer marks it, and marks nothing else.** `recommendedSet()` is the
first unfinished list of each begun track in that order, and the row carries
`· next` in the drawer's own ink rather than the faded tone the rest of the
descriptor takes. It is guidance, not a gate — a learner facing Nāma's 41
rows needs to be told where to start, and the other 40 stay open. Computed
once per render: `finishedDecks()` walks every card in the app, and asking it
again for each of 178 rows is the kind of thing that makes a phone feel slow.

**Nothing is hidden, locked or reordered by this.** Every breadth list is in
the drawer from the start, at its curriculum position, unlocked with the rest
of its track; a learner who wants deity names takes them whenever they like.
This decides one button's target, and the button is a recommendation. The
order is a **permutation** of the track, so nothing is dropped — a test
asserts that, along with the marking not drifting from the `V01 ·` naming
convention it was derived from.

### The end of a round is not a dead end

`Practise these again` / `Whole deck again` / `Share score` was every way on
from a finished round, so a session stopped there: the next list and the
review were both behind the drawer, and nothing on the screen said so. Two
more buttons:

- **`Next — <list>`** is the first unfinished list in the same track, taken in
  curriculum order from where you are. A finished track has none, and a
  cross-list round has none either — nothing is "next" to a draw.
- **`Abhyāsa · 20+ due`** appears once the review is unlocked and something is
  waiting, and never inside a review, where it would be the button you just
  pressed.

**The due figure is said as a session, not as a queue.** A card that has never
been reviewed is `Infinity` overdue, so on a first pass *every* card in the
pool is due — a mid-course learner was being told `abhyāsa · 920 due`, which
is a backlog to feel guilty about rather than an invitation. Past a full draw
the figure stops counting and reads `20+ due`; below it, the true number.
`dueLabel()` is the one place that decides, and the drawer, the track page and
the review window all read it.

### The two controls a tester needs

Not for the learner, and deliberately in the Scoreboard rather than anywhere
a learner is working:

- **`Copy my progress`** puts the whole store on the clipboard. A report that
  cannot be reproduced cannot be acted on.
- **`Reset progress`**, in kumkuma behind a confirm, removes the store and
  every earlier key and reloads. Seeing the first run again should not require
  knowing where a browser keeps its site data.
- **The build stamp** — `build 3ce8096` at the foot of the Scoreboard, and on
  the build line. It is a hash of the page's own bytes, not a timestamp:
  several demos are in the wild at once, a report has to name one, and a clock
  would make `--check` fail every day for no reason.

### Two strengths, and what completing something gets you

A faultless run says a card can be produced minutes after being taught. It
does not say it will be there next week — and the review already measured
that and told nobody: `SAVED.review.cards[id]` keeps, per card, how many
consecutive Abhyāsa sessions it has come back right on the first try, and it
was feeding nothing but the rest interval.

| | |
|:--|:--|
| **learned** | right on a first showing at least once, on a day it was not lost — `SAVED.mastered` |
| **retained** | and right first try in **two** separate review sessions since, days apart, drawn out of its list — a session being a day you reviewed, so this cannot be earned in one sitting |

Neither stores anything new. A third tier was considered and cut: two states
a learner can name are worth more than three they have to look up.

**A list, a stage and a track are each complete when every card in them is
learned, and retained when every card is retained.** The drawer marks a
retained list in its descriptor (`the eight śaktis · LS · 8 cards ·
retained`), and finishing any of the six things announces itself once, on the
results screen, in the right-answer pigment:

```
समाप्तम् — clean round
Mātṛkā complete · every card known cold
Known on the first showing: 8 of 8
```

- **Once, and biggest first.** `claimAwards()` stamps each key the first time
  it is true, so nothing is announced twice; a track finishing is the news,
  not the list that happened to complete it. Three at a time is the cap.
- **An award is kept.** Losing a card later moves the drawer's percentage,
  which is what a live figure is for; it does not un-finish what was
  finished. `SAVED.awards[key]` holds the day it was earned.
- **The day streak counts days, not rounds.** One finished round marks the
  day; two on the same day change nothing; a gap resets it. It is on the
  landing card and nowhere else, because a streak is a reason to come back
  rather than a thing to look at while working.

### Test mode

The two gates — the landing card opens the tracks, a track opens its lists —
are one setting, and the switch is named for what turning it **on** is for:
*Test mode — opens every track and list at once, instead of reading a track
before its lists open.* It sits at the foot of the landing card, off by
default, in **kumkuma**: it is the one control on the page that takes the app
out of the state a learner should be in, and the colour says so. A test
asserts nothing in the drawer is left shut while it is on.

`SAVED.guided` is still the stored flag — the switch is its inverse, which
keeps the gate code reading the way it does everywhere else (`!SAVED.guided
|| begun`).

This is deliberately the only gating in the app. Locking stage by stage would
make it hostile to the person building it and to anyone who already reads
some Sanskrit; the recommendation the learner needs is `Continue — <next
list>`, which the track page already carries.

### The end of a review

A review crosses lists, so "which cards went wrong" is the wrong question at
the end of one. The results lead with a per-list breakdown, weakest first:

```
HOW EACH LIST HELD UP
Deva                                  1 / 4    practise
Āyudha                                2 / 4    practise
Devī                                  4 / 4    strong
```

Counted in cards, because that is what a round contains, but reported per
list, because that is the unit the learner finishes and the drawer measures.
The missed cards still follow underneath — they are the evidence, not the
headline. A `strong` row takes `--patra`, the right-answer pigment, rather
than the accent the scoreboard uses to mark a finished list. The breakdown is
skipped when a round touched only one list, which is not a comparison.

The ladder is `RANKS` in `app.js`, in English like the modes rather than in
Sanskrit like the curriculum: **Novice, Learner (10), Skilled (30), Expert
(55), Master (80)**. Five steps, each one a plain word for how far along
someone is — the earlier seven included two ("Starting out", "Beginning")
that named the same place.

Naming the mode in Sanskrit is the one exception to the rule above, and it
earns the exception by being the project's own name rather than a term looked
up for the occasion: nobody hunting for a scoreboard has to guess that
`Aṅkāḥ` is one, but the app is *Abhyāsa* and this is what Abhyāsa is. The
round it starts is labelled `abhyāsa` too, in the selector and the status row,
where it used to read `mixed review`.

**The vocabulary is fixed and shared across every surface** — drawer, review
window, scoreboard, shared score:

| was | is |
|:--|:--|
| cold recall | correct on first try |
| cold recall (as a metric) | review accuracy |
| cards drawn | cards reviewed |
| finished lists | completed lists |
| consistent mastery | overall mastery |
| % of the course mastered | % course coverage |
| Draw 20 cards | Review 20 cards |

`rankOf()` reads `masteryPct()` and `coverageOf()`, both derived from state the
app already kept, so this adds **no stored state and nothing to migrate**. It
carries the same two guards `progressOf` does: it will not round up to a
finished figure, and will not round a real start away to nothing.

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
does that instead — and it sits **below** the panel's own action, never above
it. It used to come first in the markup, so the review window described the
mode and then offered nothing but *Back to the cards*: what it read as
offering was leaving. The mode's button leads; the way out follows.

For the same reason the unlocked-but-unused review row names the action rather
than the mode. *ready · a 20-card draw* was one more definition to someone who
had just read three; it is *ready · draw 20 cards*. The mastery figure appears
on the row **and** in the window it comes from, as soon as there is one.

**Progress is mastered cards over cards held.** A card is mastered once it
comes back right on its **first** showing in a round — the same cold-recall
signal a deck's best score is built from, and the one that counts a card out
of the trouble list. A wrong answer takes it back; a percentage that could
only ever rise would leave a lesson ticked long after it had gone. Every kind
of round feeds this, review draws and trouble drills included: whether a card
came back cold is a fact about the card, not about the round it turned up in.

Three rules keep the figure honest:

- **Counted from cards the whole way up.** A track's figure is the union of its
  lessons' cards, never the average of their percentages — that would give a
  five-card lesson the same weight as a hundred-card one.
- **A tick means all of it.** 100% is `done === total`, not a rounded 99.6;
  `progressOf` holds a not-quite-finished list at 99% and a barely-started one
  at 1% rather than letting either round away.
- **A guess is not a recall.** A reveal card asks the learner to produce the
  answer and then say whether they had it. A **choice** card puts the answer on
  screen among three or four, so a tap is right one time in three or four with
  no knowledge at all — and a single cold win marked the card learned for good,
  the tick only coming off if it was missed somewhere later. Every lucky tap
  stuck. So a choice card wants the evidence **twice, on two different days**:
  chance then has to land twice, one time in nine or sixteen, and a miss in
  between resets it rather than pausing it. `SAVED.pending[id]` holds the day
  of the first win until the second confirms it.
- **A right answer has to be cold, and the unit is the day.** `knew()` already
  refused a card missed earlier in the same round. But a round is not what
  makes a recall cold: *Practise these again* and the missed pile both start a
  **fresh** round with fresh per-round flags, so the same card answered right
  seconds after being told counted as a cold recall, and the app's central
  signal was one button-press deep.

`markWrong` stamps the day a card was lost and `lostToday` reads it back; a
right answer on that day earns no tick. This is the project's own rule applied
where it was missing — the trouble list already refuses three right answers in
one sitting, because *three right answers in one sitting is recognition, not
memory*.

**The day, not the page-load id `SESSION`.** A page load is not a unit of time
at all: a phone tab left open for a week holds one session for as long as it
lives, so a card lost on Monday could never be counted again all week — a
worse fault than the one being fixed — while a reload would hand out a free
pass. The day rolls over on its own and cannot be minted. Nothing new is
stored: the stamp goes on the trouble record `markWrong` already creates, and
a missing stamp reads as "not lost today", so no store needs migrating.

Two things follow, and both are the point rather than side effects:

| | |
|:--|:--|
| **the card says so** | the `second look` badge is shown for a card lost earlier *today* as well as earlier in the round — the only warning that a right answer here is relearning. The round tally still counts it; it is mastery that waits |
| **the pile holds it** | a card leaves the missed pile when it is **won**, not when it is merely met again. Clearing it on a relearn would leave it in limbo — not learned, and no longer pointed at by the one control that exists to point at it |

So a first pass that misses three of eight ends the day at 63% however many
times those three are replayed, and the pile still names them; run the pile
the next day and the list completes. A round with no misses is untouched.

**Choice cards only, and the reason is the arithmetic.** A four-piece
`sequence` assembled at random comes out right one time in twenty-four, and
there are five such cards in the app; a `reveal` card is not picked from
anything. The exposure is all in the one type — 372 cards, the thirteen
`Rūpa-siddhi` lists among them entirely so, which makes the paradigm
production the badges actually ask for the most guessable material here — so
the friction goes there and nowhere else. This is the app's own idiom rather
than a new one: `retained` already means right on the first try in two
separate review sessions, and the trouble list already refuses three right
answers in one sitting.

**A list of choice cards therefore reads 0% after a faultless first round,
and that has to be said rather than left to be discovered.** An unexplained
nought after a clean round reads as a fault, so both surfaces that would show
it say what it means instead: the results screen adds *16 waiting to be
confirmed — answer them right again another day*, and the drawer's row carries
`· 16 to confirm` where a finished list carries `retained`. A blind run
through a 16-card list now masters nothing where it used to master the five it
happened to guess.

`SAVED.pending` is additive and absent-tolerant, and mastery already held is
deliberately **not** revoked — a learner's history is not invalidated to apply
a new rule to it, so the requirement governs what is earned from here on.

Every card the app carries counts towards the denominator. What is here is
curated practice plus the paradigm tables the badges ask for whole — reference
material was never brought in, so there is nothing to filter out.

### Producing a form is not recognising one

`Table mastery` decks show an inflected form and ask what it is. **`Form
mastery` decks hand over the bare stem and ask for one named cell**, which is
the direction the badge actually demands — *a noun through all 8 vibhaktis × 3
vacanas* — and the direction the workbook drills in sections B and C.

```
Form the caturthī singular of:
devī-
feminine · ī-stem
        devyai ✓      devyā       devyāḥ      devīm
```

This is deliberately a **second pass over the same tables**, and the rule that
a `choice` card must not repeat a `reveal` card is not the objection it looks
like. A reveal card reversed asks the learner to produce the form and then
grade themselves on it, and self-grading is at its least reliable exactly
here — *devyai… or was it devyāḥ?* ticks "knew it" far too often. Three things
the reveal card cannot do:

| | |
|:--|:--|
| **it grades** | the right option is `knew()`, a wrong one `didntKnow()` — the same single retrieval event as everything else |
| **it forces a discrimination** | the distractors are other cells of *this* paradigm, so a miss is a specific confusion (dative for ablative) rather than a blank |
| **it withdraws a scaffold** | see below; there is nowhere on a reveal card to put one |

**Distractors are the nearest cells, not random forms.** Same number first,
ordered by distance in the vibhakti sequence, then the same vibhakti in
another number, then whatever is left — and never a form equal to the answer,
which syncretism makes a live hazard. A learner's real confusion is the cell
next door.

#### Full mastery for new patterns, shorter checks for derived ones

Every cell of every paradigm was 289 cards, and most of them drilled a fact
already drilled. Two reductions cut it to 180, and **both are computed from
the tables rather than judged**:

**Syncretism collapses.** A paradigm has more cells than forms — three of
śiva's duals are `śivābhyām` — so asking for the same form three times drills
one fact three times. One card per distinct **form**; its prompt names the
first cell it fills and its note names the rest (`· also caturthī dvivacana,
pañcamī dvivacana`), so nothing the table says leaves the app. This is the
same collapse the `Table mastery` reveal decks already made: 24 cells, 17
cards.

**Derived tables get a delta or a transfer check**, and the tier is decided by
the source, never by taste:

| | | |
|:--|:--|:--|
| **full** | a new pattern, or an irregular one | masc -a, fem -ā, fem -ī, masc -i, ṛ, -at, and all four pronoun paradigms |
| **delta** | the source itself says the table repeats another | neuter -a, `tad` neuter |
| **transfer** | the same shape with one vowel changed | masc -u |

A **delta** list asks only the rows that differ, plus one card for the rule
itself — `Which cases does a neuter a-stem share with the masculine?` The
reference writes neuter -a's rows 3–7 as *"same as masculine"* and `bricks.md`
writes tad neuter's the same way, so these two are the only deltas in Stage 5:
4 and 3 forms, against 14 apiece before.

A **transfer** list drills the cells where the correspondence is *not* a plain
vowel swap. The u-stem endings are the i-stem's with u for i, but `-aye`
becomes `-ave`, `-eḥ` becomes `-oḥ`, `-yoḥ` becomes `-voḥ` — and saptamī
singular is `-au` in both, where a learner expecting a shift is caught. Seven
forms, each noting its i-stem counterpart, against 15 before. Every viṣṇu form
still lives in `Table mastery · Viṣṇu`, so nothing is lost.

**Pronouns keep full coverage.** `asmad` is suppletive — `aham`, `mām`,
`mayā`, `mahyam` share no stem — so no cell predicts another and there is
nothing to collapse but the syncretism.

`scripts/test.js` re-derives all 168 answers from the source files, and fails
if a full list misses a form the table supplies, if any list asks for the same
form twice, if a collapsed card does not name the cells it fills, or if a
transfer list reaches for a cell outside its own paradigm.

#### The stem class is a scaffold, and it is withdrawn

A stem plus a case name is answerable only if you know which table, so the
gender and stem class are printed under the stem. Leaving them implied would
test two skills and grade one — the card would silently be an inference
question with a declension attached.

But a permanent label is not a scaffold. Each nominal deck carries one card
that **asks** for the class, and once it has come up in a round the rest of
that round stops printing it:

```
Which class does devī- belong to?
        feminine · ī-stem ✓    feminine · ā-stem     masculine · i-stem
```

A card that asks is recognised by carrying its own `stemClass` among its
options — no flag was added for it — and `established` resets with every
round. Nothing is withdrawn that was never asked for: **`tad-` has no gender
of its own**, its referent supplies it, so asking would be circular and the
pronoun decks' stem lines always show.

**A deck's descriptor must not answer a question the deck asks.** The status
row prints it for the whole round, so `— feminine ī-stem` on the deck would
have handed over the class card and undone the scaffold on every other card in
it. The nominal decks are counted (`— all 21 cells`), not classified; the
pronoun decks, which never ask, may say `— tad, masculine`. A test scans every
deck in the app for a name containing one of its own cards' answers.

#### The forms are re-derived, never authored

Every answer is an ending from `05-rupa/reference.md` applied to the model stem
the deck is named for, and `scripts/test.js` re-derives all 168 answers from the
source files independently and fails on any disagreement — see
**Full mastery for new patterns** above for what else it checks.

Which model stem each table takes is **decided by the table, not by taste**:

| | |
|:--|:--|
| ṛ-stem → **pitṛ** | the reference gives `-arau`/`-araḥ`, the kinship pattern; `kartṛ` would need the vṛddhi (`kartārau`) it does not state |
| -at → **bhagavat** | `-antau` yields `bhagavantau` correctly and `mahāntau` only if the ā is lengthened |
| neuter -a → **phala** | the reference's own first example; `puṣpa` would need ṇatva (`puṣpāṇi`) for its plural, which is Stage 3's rule and not in this table |

That last one is the rule in miniature: where a stem cannot be declined from
the Stage 5 table alone, the model stem changes, rather than the form being
quietly corrected from outside the source.

**Sambodhana appears only where the reference tables it** — masculine and
neuter -a. The other tables stop at row 7, so those decks hold 21 cells and not
24. The `Table mastery` decks do carry vocatives (`viṣṇo`, `pitaḥ`,
`bhagavan`) that these tables do not supply; every other form in them agrees
with the reference exactly, which is how these thirteen were checked.

Thirteen paradigms are carded: the eight nominal types the reference tables,
plus `asmad`, `yuṣmad` and `tad` in all three genders — masculine and feminine
from `reference.md`, neuter from `bricks.md`, whose tad tables agree with the
reference cell for cell. `bricks.md` also declines `etad`, `yad`, `kim`, `idam`
and `sarva` in three genders each; those are **deliberately not carded**, being
sixteen more paradigms and some 340 more cards for a stage that already holds
the largest share of the app.

### A choice card must not repeat a reveal card

A `choice` card that hands over the same item and expects the same answer as a
`reveal` card in the same lesson is strictly the weaker of the two. The reveal
card asks for free recall, and its `pair` reverses it into the opposite drill;
the choice card shows the answer among three options. Twenty-one such pairs had
accumulated, and every one of them was removed in favour of the reveal card:

| | |
|:--|:--|
| `Build: √gam + ktvā` → `gatvā` | `35 · Kṛt` already held `gam + ktvā → gatvā` |
| `Name the metre: 11 syllables · ta ta ja ga ga` | `28 · Vṛtta` already held that whole card |
| `Join: nara + indraḥ` → `narendraḥ` | `S · Ac sandhi` already held the rule |
| `Split: narendraḥ` → `nara + indraḥ` | the same card, reversed |

Two whole decks went with them — `Kṛt and taddhita — practice` and `Name the
metre — practice` — because every card in them was a duplicate. The lists that
replaced them say so in their `pair`: `35 · Kṛt` and `36 · Taddhita` run
`affix → form`, so reversing them *is* the build drill, and `28 · Vṛtta` runs
`pattern → metre`, so its forward direction *is* naming the metre.

`scripts/test.js` compares every choice card against every reveal card of its
lesson, in both directions, and fails if one repeats the other.

The `Form mastery` decks are the one deliberate exception, and
**Producing a form is not recognising one** above says what earns it: they
grade what a reveal card can only ask the learner to grade themselves, they
force a discrimination against the neighbouring cell, and they carry a
scaffold a reveal card has nowhere to put.

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

`detail` and `detailIast` are a **second line of the answer**, and they are
rendered from `c.detail` rather than from whichever side the Devanagari is on,
so they stay on the back in *both* directions. That is the whole reason they
exist. A metre is identified by its gaṇa formula as much as by its name, so a
`gloss` carrying both would hand the learner the answer the moment the card
was reversed:

```json
{ "devanagari": "— — — ◡ ◡ — ◡ — ◡ ◡ ◡ — — — ◡ — — ◡ —",
  "iast": "19 syllables",
  "gloss": "शार्दूलविक्रीडितम् · śārdūlavikrīḍitam",
  "detail": "म · स · ज · स · त · त · ग",
  "detailIast": "ma · sa · ja · sa · ta · ta · ga",
  "note": "19 syllables · atidhṛti" }
```

**The front of a metre card shows the pattern and the count, and nothing
else.** The gaṇa sequence used to sit on the front beside the syllable count,
where it *was* the answer written out in another notation — a learner who can
read `ma sa ja sa ta ta ga` has already identified the metre and is only being
asked to recall a name for it. Reversed, the card runs metre → pattern, which
is the composition drill, and the formula stays on the back there too. The
class (`atidhṛti`) is in the `note` chip, which is small, uppercased and
kumkuma — secondary by construction.

The reference gives gaṇas and metre names in IAST only; the Devanagari is
added beside it, never in place of it, on the same principle the IAST toggle
runs on. The pattern itself stays in `◡` and `—`: those are symbols, and
setting them in Devanagari would teach nothing.

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

### term → equivalent → relationship → application

An applied card must rest on vocabulary the learner has already been taught.
Stage 7 asked **“Which vibhakti carries karaṇa?”** with three bare Sanskrit
options, which fails twice over: nothing had taught that `tṛtīyā` is the
instrumental, and the wording quietly equates a *kāraka* with a *vibhakti*.
They are different levels — a role in the action, and the case ending that
carries it — and `07-karaka/reference.md` keeps them in separate columns.

The card now reads:

```
Which vibhakti (case) typically expresses karaṇa (instrument)?
    tṛtīyā · instrumental · 3rd case  ✓
    dvitīyā · accusative · 2nd case
    caturthī · dative · 4th case
```

**Both labels on the option**, so the level being tested is visible on the
card rather than depending on the order lists happen to be taken in. Every
part of it is sourced: `instrumental` from Stage 5's own case list, `3rd`
from the reference's `#` column and from the kāraka table's `3rd (tṛtīyā)`.

**A list marked `"role": "table"` is a paradigm shown whole**, and comes
before anything that asks the learner to produce out of it. Twelve lists
carry it: the nine `Śabda-rūpa` declensions and the three `Dhātu-rūpa`
conjugations. See **A paradigm is shown before it is produced from**.

**A list marked `"role": "breadth"` follows the course rather than carrying
it.** The 82 vocab-bank lists carry it, and it decides one thing: what
`Continue —` points at next. See **The course leads, the vocabulary follows**.

**A list marked `"role": "core"` leads its lesson.** It holds what the
lesson's own tests rest on, and `DECK_ROLE` carries the mark into the app so
`scripts/test.js` can assert the order — see **Fundamentals lead** below.
Seventeen lists across eleven lessons carry it.

What the audit found missing, and what was added:

| | |
|:--|:--|
| **puruṣa** | nothing taught `prathama puruṣa = 3rd person`. Sanskrit counts the persons the other way round, so a learner meeting `prathama ekavacana` on a conjugation card would read it as *first* person. `06-kriya/reference.md` heads its rows `3rd (prathama)`, so the equivalence was there to teach. |
| **vacana** | `ekavacana ↔ singular` was shown on hundreds of cards and taught by none; `05-rupa/theory.md` tables all three. |
| **pada** | `parasmaipada` appears in almost every verb note; `theory.md` glosses it *(active)* and `ātmanepada` *(middle voice)*. |
| **the case ordinal** | the case list gave `tṛtīyā → instrumental` but never `3rd case`, which is how both the reference's summary card and the kāraka table name it. |

And what was **removed**: the case list's notes read `karaṇa`, `sampradāna`,
`apādāna` — the kāraka name asserted as the meaning of the case. They carry
the reference's own case marker now (`marker -ena`). The relationship is
Stage 7's to teach, and Stage 7 teaches it.

`scripts/test.js` fails if a terms list sits below an exercise, if any of the
twelve equivalences above is not taught by a card of its own, if a case card
asserts a bare kāraka name, or if a kāraka-to-vibhakti card names only one
level.

### Fundamentals lead, and the chip explains the term

Two rules, both about a beginner who has never met this material.

**A lesson shows before it tests.** Nine of the thirteen lessons that carry an
exercise used to open with it, and in seven the list supplying the exercise's
raw material sat directly below: Stage 2 asked the learner to *expand ik*
above the Maheśvara sūtras, Stage 19 to *name the gaṇa* above the eight
gaṇas, Stage 10 which set is entirely Śiva above the synonym sets themselves.
A list marked **`"role": "core"`** is what the lesson's own tests rest on —
the equivalences, or the raw material the exercise draws from — and it leads
the lesson. The order is **fundamentals → tests → breadth**, and
`scripts/test.js` fails if a core list sits below an exercise, if an exercise
sits below a breadth list, or if a lesson tests with no core list at all.

Stages 15 and 21 are the two exceptions the test names: both rest on
fundamentals taught in an earlier stage, which is the progression working
rather than failing.

**A card that names an English grammatical term says what the term does.**
Knowing the word *optative* is not knowing what an optative is, and the
annotation chip is already the card's own "why" slot:

```
gacchet
liṅ (vidhiliṅ) · लिङ् — optative
lakāra · what should or may happen — “he should go” · vidhi · 3.3.161
```

The gloss stays short, because it is the answer; the chip carries the
explanation, because it is where the card already explains itself. Six of the
ten lakāra cards already did this (`liṭ · remote past, unwitnessed`) — the
other four were brought into line, along with `parasmaipada`/`ātmanepada`,
the participle and feminine suffixes, `lopa`, `dantya`/`oṣṭhya`, and `laghu`
and `guru`, which were the cue on every gaṇa card and defined by none.

**None of the wording was invented.** `vyakaranam/ch04-kriyapada` tables every
lakāra with a plain meaning — *Imperative (command/request)*, *Optative /
potential*, *Conditional*, *sāmānya-bhūta* — and Stage 2's reference glosses
`dantya` and `oṣṭhya` as *Teeth* and *Lips*. Those grammar chapters are among
the sixteen the build publishes nowhere, so this is the first of their content
to reach a learner.

`scripts/test.js` fails if a gloss names a mood, voice or participle and the
chip beside it adds nothing but a citation.

**Stage 12 shows the operation before asking for it.** Its exercise completes
a sentence, but the lists below it were pronoun and particle vocabulary rather
than a worked example, so it now leads with six sentences from workbook A1 and
A2 shown whole, each word's case named on the chip — `bhaktaḥ — prathamā ·
puṣpeṇa — tṛtīyā, with what · pūjayati — 3 sg.` This is the only place in
these two passes where new cards were the right answer.

### A card may not use a term its stage has not taught

A project-wide scan compared where each piece of grammatical metalanguage is
first **used** against where a card **teaches** it. Five gaps, all fixed by
subtraction or by moving something to the stage that owns it:

| | |
|:--|:--|
| **case names, 159 cards** | every vocabulary annotation read `prathamā \| nom. sg. · …` from Stage 1, four stages before Stage 5 defines `prathamā`. The Sanskrit went, and later the English with it — see below. |
| **case abbreviations, 157 cards** | dropping the Sanskrit left `nom. sg. · f. · stem: kāmākṣī- · ī-stem` on the first card of the app. `nom. sg.` is jargon a beginner has not met, and below Stage 5 it is a **constant** besides: every headword there is nominative singular, so the field carried nothing until Stage 5 gave it meaning. All 157 now read `noun · feminine · ī-stem · stem: kāmākṣī-`, the shape the other 738 already had; number is kept where it is real (`plural`, `dual`), and the gender line yields `adjective` where a word has none. A test fails any note below Stage 5 that starts with a case abbreviation. |
| **compound types** | `bahuvrīhi` and `tatpuruṣa` annotated demon names at Stage 1 and were *answers* at Stage 11, and no card defined either. Six terms cards now lead Stage 11, from the reference's own *Compound Types at a Glance*; the three early notes dropped the word. |
| **the class notation** | `1P`, `9U`, `10P` sat on 70 cards and were unpacked nowhere. Stage 6 does not test a root's class, so it lost the notation; Stage 9, which does, spells it out — `dhātu · class 1 · parasmaipada · bhavati`. |
| **the classical metres** | `28 · Vṛtta` sat in Stage 21, whose theory and badge are anuṣṭubh only, while Stage 22 — *Multiple Meters* — had no practice at all. The list moved to 22 with its ids intact, and 21 gained six cards on the śloka pattern from its own theory. |
| **one mood, two names** | Stage 6 practice said `vidhiliṅ`, the lakāra list taught `liṅ`. The gloss now reads `liṅ (vidhiliṅ) · लिङ् — optative`. |

**`U` is glossed `both padas`** — the one gloss no source states. The
reference tables a `Class` column and never explains its letters; `P` is
`parasmaipada`, which Stage 6 teaches, and `both padas` describes the
notation rather than naming a term the repo does not carry.

`scripts/test.js` holds all five: no note may name a vibhakti below Stage 5
or a compound type below Stage 11, Stage 6 may not carry the class notation
and Stage 9 may not leave it unexpanded, each of the six types must be taught
at Stage 11, and no `Vṛtta` list may sit earlier than Stage 22.

**Where a forward reference is unavoidable, put it on the card.** Stage 4's
adjective agreement genuinely needs Stage 5's gender and case, and every card
carries it inline — `Make it agree: sundara + devī (f.)`. That is the pattern,
not reordering the curriculum.

### A reversed deck must still have one answer per cue

Every reveal deck can be run backwards, and in that direction **the gloss is
the prompt**. Three cards glossed `battle` therefore ask a question with three
right answers, which no amount of knowing the vocabulary can fix — the learner
cannot tell which of `yuddha`, `saṃgrāma`, `samara` is wanted, and marks
themselves wrong for being right.

An audit found 17 such groups, 35 cards. They divide into two kinds, and the
kinds want opposite fixes:

| | |
|:--|:--|
| **lexical synonyms** | merge onto one card — the convention 153 vocabulary cards already used (`sūrya / āditya / ravi / bhānu / divākara` → *sun*) |
| **a set the curriculum enumerates** | keep the cards and make the gloss carry what tells them apart |

Thirteen groups merged, 14 cards fewer. The merged card lists its words on
both scripts, so a reversed round shows every acceptable answer and the
learner can grade honestly.

Four groups were **not** merged, because merging would have cost something the
lesson owes:

- `Dhātu II` and `Dhātu IV` hold the curriculum's own **50 core dhātus**, and a
  test fails if one goes missing. `√jñā` and `√vid` both gloss *know* in the
  reference, so the gloss takes the reference's present 3sg beside it — `to
  know · jānāti` against `to know · vetti`. Naming the root from its present
  form is the drill that deck exists for.
- `31 · Sambodhana` teaches **one vocative ending per stem class**, so `amba`
  and `mātaḥ` are not interchangeable: the gloss says which stem it wants,
  `O mother! · from ambā-` against `· from mātṛ-`.

`scripts/test.js` fails if any two reveal cards in a deck share a gloss, and if
a merged card carries a different number of words in Devanagari and IAST.

**Cross-deck collisions are left alone.** 73 meanings appear in two lists of
the same lesson — `04 · Āyudha` and `V04 · Weapons` both teach *bow*. A round
runs one deck, so the cue is unambiguous where it is asked; only a reversed
mixed review could pair them, and there the two lists are deliberately
different treatments of the same word.

An audit re-raised eight of these in `17-puja-vak` — *hand* answers `hastaḥ`
in `08 · Aṅga` and `kara / hasta / pāṇi` in `V05 · Gātra` — and they were
left alone on inspection, because the two lists are not duplicates: **Aṅga
carries the inflected form nyāsa uses, V05 the stem and its synonyms.** That
is the difference the rule above is about.

### The annotation names what a word is, not that it is a card

The morphology chip read `HEADWORD | N. · STEM: YUDDHA- · A-STEM · FROM
√YUDH`. `HEADWORD` said only that this card is a headword card, which the card
already is; `N.` was opaque next to a stem spelled out in full two words
later. All 627 now read:

```
noun · neuter · a-stem · stem: yuddha- · from √yudh · DM 2.3
```

**157 cards were still on the older shape** — the vocabulary of Stages 1, 2
and 4 and the vyākaraṇam lists, which is to say everything a learner meets
first. They now match: `noun · feminine · ī-stem · stem: kāmākṣī-`. See
**A card may not use a term its stage has not taught** for why the case had
to go rather than be translated.

The first field was already carrying the distinction — `m.`/`f.`/`n.` for
nouns, `adj.`, `pp.` — so the part of speech is read off it rather than
invented. A further 38 cards began with a bare `m. ·`; those are the
already-merged multi-word cards, and they were expanded the same way, except
where the card holds a phrase rather than words and calling it a noun would be
false.

**The chip is set in lower case**, like the choice note and for the same
reason: it is mostly IAST, nobody writes `√YUDH` in capitals, and the wide
uppercase tracking ran a two-clause annotation to four shouting lines under
the answer.

**A back has three parts at most: the answer, what it is, then why.** The
compound cards used to put all three in the `gloss` — `नीलोत्पलम् ·
karmadhāraya — "blue lotus"` — so flipping the card produced the answer, a
classification and a grammar lesson in one breath, and the answer itself was
the part hardest to pick out. Split across the slots the schema already has:
`gloss` carries the answer alone (`नीलोत्पल · nīlotpala`), `detail` says what
kind it is and what it means (`karmadhāraya · blue lotus`), and the structural
formula goes on the `note` chip, which is small, secondary and tappable —
which is what a chip is for. Nothing was added to the schema to do this.

**Compound members are stems, on both sides of the arrow.** `theory.md` and
`reference.md` write every example that way — `rāja-putra`, `nīla-utpala`,
`tri-loka`, `pīta-ambara` — and the deck had been showing inflected members
(`nīla + utpalam`), which misrepresents how a compound is built. Only dvandva
and avyayībhāva carry an ending in the sources, and for a reason the card can
state: `rāmalakṣmaṇau` is dual because they are two, `upakūlam` is adverbial.

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

### An option may be a set

A `choice` option is a string, so it can carry three names as easily as one —
and that turns the same renderer into a test of **membership** rather than
recognition. Nothing in `app.js`, the schema or the CSS changed to allow it;
what changed is what an option is allowed to hold.

```
Which set consists entirely of names for Śiva?
    haraḥ · śambhuḥ · rudraḥ      ✓
    hariḥ · keśavaḥ · mādhavaḥ        (all Viṣṇu)
    induḥ · somaḥ · vidhuḥ            (all the moon)
    ambā · gaurī · lalitā             (all Devī)
```

**Recognising one word and knowing a set are different skills.** `induḥ →
moon` can be answered from a half-memory of having seen the word; deciding
that `śambhuḥ · induḥ · bhairavaḥ` is *not* a Śiva set cannot. Every member
has to be checked, and one false member is enough to reject the whole option.
That is the skill Paryāya is actually for, and the badge asks for it outright
— *ten names for a single deity, five synonyms each for sun, water, lotus.*

Two constructions, in one deck because they ask the identical question and
differ only in how hard the rejection is:

| | |
|:--|:--|
| **rival sets** | every distractor is itself a pure set of some *other* category — tests whether the categories are distinct in the learner's head |
| **contaminated sets** | a distractor is the target category but for one intruder — `haraḥ · rudraḥ · keśavaḥ`, where only `keśavaḥ` is wrong |

The second is much the harder, and the interesting one: gist is enough for the
first and useless for the second.

**The inverse gets its own deck**, because it is the inverse operation rather
than a harder version of the same one — the category is not named, and the
learner has to infer it from three of the four names before rejecting the
fourth:

```
Which name does NOT belong with the others?
    haraḥ    mahādevaḥ    nīlakaṇṭhaḥ    padmanābhaḥ ✓
```

The pairs that make these worth setting are the ones where a shared morpheme
points the wrong way: `nīraja` and `jalaja` mean *water-born* and name the
**lotus**; `divākara` makes the day and `niśākara` the night; `candraśekhara`
carries the moon and is **Śiva**; `giriśa` is lord of the mountain and not a
mountain; `umā` is Devī and `umāpati` her husband. A distractor built any
other way is answerable by elimination and teaches nothing.

**Every option holds the same number of members.** An option of two among
options of three is answerable from its shape alone, without reading a word of
it.

#### A set question is checked, not trusted

A one-word question is wrong in a way an author can see. A set question is
wrong invisibly: one misfiled name and it has two right answers, or none, and
the card still looks perfectly reasonable. So the answer is not the author's —
it is the lesson's reference, and `scripts/test.js` re-derives it.

`10-paryaya/reference.md` lists its categories outright, so it parses into 12
disjoint sets over 189 names, and every card is checked against them:

- every member of the answer is in the named category
- every distractor holds at least one member that is not — so exactly one
  option is true
- every word on the card appears in the reference at all, so no vocabulary is
  invented at the card
- on an intruder card, the three kept names share exactly one category and the
  answer sits outside it
- the category the prompt names is one the reference actually carries

The 4 pratyāhāra cards are checked the same way against `02-varna-vidya`'s own
`ik` row. **A pratyāhāra is a set by definition**, which is why the format
belongs there too — and membership is not the same drill as `Expand: ik`, which
the deck already had: reciting the expansion is recall, deciding whether `e` is
inside it is the thing guṇa turns on.

Where else this fits, when the content is ready for it: gaṇa membership in
`09-dhatu`, the ac / hal / viśeṣa categories in `03-sandhi`, the semantic
fields of the `vocab/` bank. It does **not** fit anywhere the categories
overlap — a word in two sets makes the question unanswerable, and the parse
above fails loudly rather than shipping it.

**A set option must still set on one line.** Three names and two separators is
a far longer option than `namāmi`; at 360px the longest in use
(`bhāskaraḥ · divākaraḥ · mārtaṇḍaḥ`) fits with room to spare, and a test walks
every set card at that width and fails if any option wraps — a wrapped option
puts its `✓` on a line of its own. Keep sets to three members.

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
  once on load, **in insertion order** — so a new entry goes at the END, or a
  deck renamed twice resolves its second hop before its first and loses the
  score anyway, the same way `OLD_KEYS` rescues state from an earlier storage
  key. **Never rename a deck without adding a line there.** Vocab-bank decks
  still carry their `V01 ·` prefixes; the drawer hides them from display.
- **Deck order carries the progression.** Within a lesson the drawer reads the
  **fundamentals first**, then the exercises, then the breadth lists — because that is the order they sit in `practice.json`,
  which the build preserves. Practice prepares generalisation; mastery closes
  known finite gaps. A test walks every lesson and fails if a set of
  interactive cards ends up below a recall list.
- **The skill leads a name, not the word "Practice".** Every exercise list was
  once called `Practice — <skill>`, which put an uninformative word in the one
  slot the drawer displays, and the word is not applied consistently enough
  across the lessons to mean anything on its own. They read
  `Case and form — practice`, `Name the metre — practice` now: the skill in the
  heading, `practice` as the descriptor beside the card count.
- **Progress lives in `localStorage`** under the key `abhyāsaḥ` — chosen before
  the brand settled on the bare stem **Abhyāsa**, and left alone: it is
  invisible plumbing, not displayed text, and renaming it would only add
  migration risk for no visible benefit. Versioned by `SAVED.v`
  (now 7). v1 keyed trouble history by `devanagari + '¦' + gloss`; the app
  lifts those records onto stable ids on first load. v2→v3 seeds `SAVED.mastered`
  from the one case that can be resolved exactly rather than guessed at — a
  deck whose best round was perfect *and* whose size has not changed since.
  v3→v4 adds the per-card review history that paces the draw, starting empty
  because no record of *which* cards a past session showed ever existed.
  v7→v8 windows the accuracy figure, carrying an older store's lifetime tally
  in whole as the window's first entry so the number does not move at the
  moment of upgrade. It also seeds the awards, because **v7 never ran in the
  wild**: the v6 step stamped `SAVED_VERSION` instead of 6, so it wrote
  whatever the newest version happened to be and every step after it was
  skipped. That is exactly what the rule below exists to prevent, and the two
  latest steps now sit after `DECK_SHORT` because they read what a list is
  called — a migration that throws takes the rest of the page with it.
  v6→v7 adds `SAVED.awards` (seeded from what is already true, so upgrading
  mid-course does not hand back a wall of announcements for work finished
  weeks ago), `SAVED.streak`, and `SAVED.guided`.
  v4→v5 added `SAVED.begun`, and v5→v6 re-keyed it from stages to tracks when
  the introduction moved up a level: a v5 store's lesson keys are lifted onto
  their tracks rather than thrown away. Both steps seed it from progress — a
  learner already practising in a track has plainly met it and must not be
  sent back to the door — so any track holding a mastered card, a list with a
  best score or a missed pile, or the list that was open when the app was last
  closed, is marked begun, along with `home`.
  `OLD_KEYS` separately lifts state out of earlier storage key names. Keep every
  chain, and keep each step stamping its own version rather than the newest;
  every `localStorage` touch stays guarded, since it can be absent or full.

The app carries 28 lessons, 178 decks, and 2344 cards — 1955 `reveal`, 384
`choice` and 5 `sequence`, spread over 34 interactive decks in 16 lessons,
plus the mastery decks holding complete paradigms.
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
  table transcribed. Beside them 180 cards in 13 `Form mastery` decks, which
  are the opposite: every distinct form the reference tables, asked for by
  name, with a delta or transfer check where one table derives from another. See
  **Producing a form is not recognising one**.
- `07-karaka` — 11 cards: the role a word plays in a real sentence, plus the
  role→vibhakti mapping and the fact that ṣaṣṭhī is not a kāraka at all. Each
  answer names **both** the semantic role and the morphological case
  (`karaṇa · instrument · tṛtīyā · instr. sg.`), which is the distinction the
  lesson exists to teach.
- `02-varna-vidya` — 11 cards: what each pratyāhāra covers, and how one is
  formed, plus 4 set cards asking whether a given handful of sounds falls
  inside `ik`, `ac` or `hal`. No articulation widget, as the plan forbids.
- `17-puja-vak` — 12 cards in two decks, and the stage's first exercises of
  any kind: the offering formula (`śrī-___ namaḥ · gandhaṃ samarpayāmi`,
  which is the dative-against-accusative discrimination the badge turns on)
  and the five closing words of aṅga-nyāsa. Every answer and every distractor
  is the workbook's own — sections D1–D3 and B2 — and the three numbered
  lists that feed them are marked `core`.
- `10-paryaya` — 21 cards in two decks, and the lesson's first exercises of
  any kind: pick the set that is entirely one category, and spot the one name
  that does not belong. See **An option may be a set**.
- `08-sambodhana` — 9 cards: form the vocative across five stem types. The
  confusable pair is i-stems (`agne`) against u-stems (`viṣṇo`).
- `09-dhatu` — the curriculum's **50 core dhātus**, all of them. The
  reference's own table names 50; the app carried 14, so 36 were added from it
  with their class and present 3sg (`dhātu · 1P · bhavati · bhava, bhūta`),
  and a test now fails if the reference lists a root the app does not carry.
  They sit in four lists by what the root does — being and motion, knowing and
  speaking, worship and offering, doing and holding — plus `√vad` and `√vand`,
  which the app already taught and which the reference's fifty do not include.
- `11-samasa` — 11 cards: name the compound type, and the vibhakti a
  tatpuruṣa unpacks with. `choice` before any compound builder, as the plan
  requires.
- `19-chandas-i` — 11 cards: scan a word into laghu/guru, then name the gaṇa.
  Scansion is the operation the lesson exists to teach.
- `12-vakya` — 18 cards: a sentence with a hole in it, and options that force
  a grammatical decision — case, agreement, verb form, connector. Constituent
  order is deliberately *not* tested; see **`sequence` is only for orders the
  grammar forces**.
- `03-sandhi` — 5 `sequence` cards: order the stages of a derivation. The only
  use of `sequence` in the app, because it is the only place where the order
  is determinate.

Roughly the last third of the decks are generated from the `vocab/` bank and
marked as such.

**On deck size.** A list is a sitting, and **no list runs past 25 cards** — a
test asserts it. That is not a limit on how much a lesson may hold; it is a
limit on how much is handed over at once. `01-nama` still legitimately holds a
third of the app, but as 41 lists rather than 15, and the paradigm table still
holds every cell the badge asks for, as nine complete paradigms rather than one
deck of 140.

**Chunks are categorical, never arithmetic.** A list is cut where its own
content divides — one model stem per declension list, one dhātu per
conjugation list, the three badge categories for the sandhi rules, semantic
fields for vocabulary (`Weapons`, `Arrows and archery`, `Emblems and
instruments`). Cutting `V01` into five equal piles of 23 would have satisfied
the number and taught nothing.

**A split is not a rename.** No chunk is the old deck, so the old deck's best
score and missed pile are orphaned rather than carried onto practice they were
not earned on, and `DECK_RENAMES` gets no entry. Nothing else moves: mastery
and trouble history are keyed by card id, every id survives a split untouched,
and lesson and track percentages therefore do not change at all.

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

**Each pigment has a light tint for the dark ground.** `--kumkuma` and
`--patra` were chosen to sit on the light card, where they read as wrong and
right. On the dark ground both fall to about 2.4:1 — right for a border, far
too low for a glyph — so each has an ink token lightened to about 7.5:1 with
its own hue and saturation kept: `--kumkuma-ink` `#e2a08e`, `--patra-ink`
`#a2b983`. The two grade buttons use the pair, bordered in the pigment and
inked in the tint.

A `var()` that does not resolve is not an error; it falls back silently to
the inherited colour, which is how a self-referential token went unnoticed
until the cross came out cream. A test reads the resolved `rgb` off both
buttons rather than trusting the declarations.

Neither a choice note nor a reveal card's morphology chip is uppercased —
a sandhi rule prints vowel values (`guṇa · a + i → e`), and IAST is written
lowercase.

**Testing** — `node scripts/test.js` drives the built file in headless
Chromium from `file://` and checks the compatibility list above: saved
progress and its migration, trouble cards, review replay, both toggles,
morphology, mobile touch targets, the choice interaction, drawer navigation
down to a deck, and the mastery figure at every level. It needs
`playwright-core` on the path but is deliberately not in a `package.json`; the
app itself has no dependencies and should keep none. Run it after any change
to `app/`.

**Publishing a testable demo** — `node scripts/demo.js` rewrites
`dist/abhyasah.html` into `dist/abhyasa-demo-v<N>.html`, stripping the
`<!doctype>`/`<html>`/`<head>`/`<body>` wrapper that the Artifact host supplies
itself. Publish that file to give the learner a live page to try on a phone.
The demo is generated and git-ignored; `dist/abhyasah.html` remains the real
distributable. **The version counts up on every run** — `demo-version` is
tracked, so the number keeps going across sessions and a published demo can be
named in a message without ambiguity.

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
