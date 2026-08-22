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
exists only in `02-varna-vidya`, `05-rupa`, and `06-kriya`. 23 of the 36 carry
a `practice.json`; the 13 without are composition and avadhāna stages, where
open-ended production is the point and the workbook is the right home — every
one of their badges asks the learner to *compose*, *narrate* or *rewrite*.
That is the rule, not a backlog: a stage is carded when its workbook holds a
bounded operation to card. Stotra II looked like a gap next to Stotra I and
was one — its workbook sections A and D (dative and genitive across stem
types, and naming the vibhakti a devotional line turns on) are exactly that
kind of operation, and are now carded, while its sections B and C stay in the
workbook where composition belongs.

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

**One child is folded away.** A level that has a single child adds a step
without adding information, so the drawer skips it:

| | |
|:--|:--|
| a track with one lesson | shows that lesson's lists directly — `Pūjā-Vāk` inside `Pūjā-Vāk` was the same name twice |
| a lesson with one list | *is* that list; the row loads it instead of expanding |
| both at once | the track row loads the list — `Svara-Vidyā`, `Avadhāna` |

**Folded by what exists, never by a list of exceptions.** `soleLesson` and
`soleDeck` read the tree, so the level reappears by itself the moment a second
lesson or a second list does, and the curriculum stays the only thing driving
the drawer. A track that folds counts what it actually holds — `· 11 lists`,
`· 12 cards` — rather than `· 1 lesson`.

Where a folded lesson's name differs from its track's, the subheading keeps it
(`Avadhāna` / *Samasyāpūraṇa · 1 list*) so nothing is silently lost.

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
│ OVERALL MASTERY                       ›  │
│ 3% · Novice                              │
│ ▬▬▬──────────────────────────────────    │
│ 5 of 153 lists complete                  │
└──────────────────────────────────────────┘
```

**It is drawn as a button, not as another row.** Abhyāsa is the one thing in
the drawer you *act on* rather than navigate to, so it is a raised panel with
an arrow on it — visibly a different kind of object from the rows below, which
are a list. A test asserts the border and the arrow. It is **palm-leaf, barely
tinted, not kumkuma**: the accent is the app's *wrong* colour, and a block of
it at this size reads as an alarm rather than an invitation.

**The bar is overall mastery**, and the line under it is the concrete thing
that moves it: lists complete. One block, so a learner reads the figure, sees
how far along the bar it is, and sees what it is built from without a second
heading competing for the same space.

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

> Practise a list → complete it → it enters Abhyāsa → review performance
> maintains its mastery.

Every number follows from it:

| | |
|:--|:--|
| **review accuracy** | correct on the first try, across everything reviewed |
| **course coverage** | how much of the material has actually entered review — which is the cards of the lists you have completed |
| **overall mastery** | the two together, as one figure with a rank beside it |
| **course progress** | lists complete, out of all of them |

Coverage used to be *cards mastered*, which was a second and invisible notion
of progress sitting next to the visible one. Reading it off the review pool
instead makes it the same act the learner already understands — finish a list
and it starts coming back — and it is why completing a list moves two numbers
at once.

**Cards are the evidence; lists are the unit of completion.** The top
statistic was *873 of 2079 cards mastered*, which competed with the mastery
figure above it and named the wrong unit. Cards still drive the per-lesson and
per-track percentages down the drawer, where fine grain is what is wanted.

Before there is a figure the drawer reads `Unranked`, and the card says what
to do instead — *Complete more lists — 12 of 40 cards so far*, then *Reviewing
20 cards from 4 completed lists*. **The mode's own name is never the thing
being explained.**

The review window says the same things in the same words:

```
Abhyāsa
MASTERY REVIEW
65% correct on first try
Reviewing 20 cards from 4 completed lists

Abhyāsa checks how well your studied material is holding up over time.
It mixes cards from completed lists and counts only your first answer.
Cards you remember return later; cards you miss return sooner, so
review stays focused without becoming repetitive.
────────────────────────────────────────────────
Overall mastery 1% · Novice
65% review accuracy · 2% course coverage
```

### What a review draws

The paragraph above is a promise, and three small rules keep it. They live in
`mixCards()` and `overdueBy()`; the per-card history is
`SAVED.review.cards[id] = [session last reviewed, run of first-try corrects]`.

1. **REST** — `[0, 1, 2, 4, 8, 16]` sessions, indexed by that run, so what is
   holding up is asked less and less often. A miss resets the run to zero, and
   a rest of zero means *the very next session*.
2. **Overdue first** — among cards whose rest is up, the longest-waiting goes
   first; a card never reviewed waits longest of all, so new material leads.
   Ties are shuffled before a stable sort, so a session is never a replay.
3. **Round-robin across lists** — piles are drawn from one at a time, so one
   large list cannot swamp a session. A complete declension table is a
   hundred-odd cards; a flat draw would make every review mostly that table.
   Broad representation is a property of the draw, not of luck.

If fewer cards are due than a session holds, the rest of the session is filled
with the longest-rested cards anyway — a short pool should still give a full
review. The draw is deliberately **not** weighted towards the cards you keep
missing: it measures what stayed, and favouring the weak ones would flatter
the figure. Weighted practice is what the trouble drill is for.

`SAVED.v` 3→4 adds that history. There is nothing to recover — before it only
the running totals were kept, and no record survives of *which* cards a past
session showed — so it starts empty, every card is due, and the first session
after upgrading draws from the whole pool exactly as it used to.

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
- **Deck order carries the product structure.** Within a lesson the drawer
  reads the exercises first, then `Table mastery` / `Conjugation mastery`, then
  the recall lists — because that is the order they sit in `practice.json`,
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
  (now 4). v1 keyed trouble history by `devanagari + '¦' + gloss`; the app
  lifts those records onto stable ids on first load. v2→v3 seeds `SAVED.mastered`
  from the one case that can be resolved exactly rather than guessed at — a
  deck whose best round was perfect *and* whose size has not changed since.
  v3→v4 adds the per-card review history that paces the draw, starting empty
  because no record of *which* cards a past session showed ever existed.
  `OLD_KEYS` separately lifts state out of earlier storage key names. Keep every
  chain, and keep each step stamping its own version rather than the newest;
  every `localStorage` touch stays guarded, since it can be absent or full.

The app carries 24 lessons, 153 decks, and 2079 cards — 1929 `reveal`, 145
`choice` and 5 `sequence`, spread over 13 interactive decks in 10 lessons,
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

A choice note is not uppercased the way a reveal card's morphology chip is —
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
