# CLAUDE.md

## Mission

Build **Abhyāsaḥ** as the lightweight practice layer for Sanskrit School.

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
| `practice.json` | curated Abhyāsaḥ practice |

When these disagree about stage numbering or content, report the conflict; do
not silently guess.

## Pedagogy

Flashcards are curated practice, not exhaustive copies of reference tables.

Prefer the smallest interaction that tests the actual skill:

- **reveal** — recall
- **choice** — recognition or controlled transformation
- **sequence** — assemble supplied pieces

If the learner ultimately needs to *do* something, test the operation rather
than only its name.

Examples:

- Sandhi: `nara + indraḥ → narendraḥ`
- Kriyā: `namati → "I" → namāmi`
- Rūpa: stem + case/number → form
- Guṇa: adjective agreement
- Kāraka: sentence → semantic role
- Chandas: pattern → gaṇa/metre

Leave unrestricted composition and other open-ended production to workbooks
and badges.

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

Every lesson directory currently carries `theory.md`, `reference.md`,
`workbook-questions.md`, `workbook-answers.md`, and `badge.md`. `bricks.md`
exists only in `02-varna-vidya`, `05-rupa`, and `06-kriya`. **No lesson has a
`practice.json` yet** — the curated practice sets described above are still to
be written.

**Sanskrit School reader** — `build.py` concatenates every lesson's markdown
into the single-page `index.html` at the repository root. It already knows the
`bricks` and `badge` tabs (`tab_order` in `build.py`), and skips files that are
absent, so adding `bricks.md` to a lesson needs no build change. Run it with
`python3 build.py`.

**Abhyāsaḥ** — the primary project file, distributed as `dist/abhyasah.html`.
It is one self-contained page with no external references of any kind: no CDN,
no fonts, no `fetch`, no stylesheets. It opens from `file://` and works
offline, and it must stay that way.

Source lives in `app/`; **edit there, never in `dist/`**:

```
app/index.html    markup, plus the card data block (until practice.json lands)
app/styles.css
app/app.js
scripts/build.js  inlines the two into dist/abhyasah.html
scripts/demo.js   repackages the distributable for publishing as an Artifact
```

`app/index.html` links `styles.css` and `app.js` with ordinary relative paths,
so it opens directly from `file://` during development. `node scripts/build.js`
swaps those two tags for the inlined contents; `--check` builds in memory and
fails if `dist/` is stale, without writing. The build refuses to emit a page
that reaches the network — it scans its own output for `<script src>`, `fetch`,
`@import`, remote `url()`, and the like, so an accidental dependency fails the
build rather than shipping.

Its cards live in a `<script id="cards" type="text/plain">` block as
pipe-delimited rows:

```
# deck name @stage N
देवनागरी | iast | gloss | note
```

`FIELDS` in that page is the one place the column order is defined; the last
field absorbs any further `|`, so a note may contain bars of its own. Rows
missing devanāgarī, IAST, or gloss are skipped and reported rather than
dropped silently.

Two details there are load-bearing for the compatibility list above:

- Card identity is `devanagari + '¦' + gloss`. That string is the stable card
  ID — changing either field retires a learner's history for that card.
- Progress lives in `localStorage` under the key `abhyāsaḥ`, with a migration
  chain (`OLD_KEYS`) that lifts saved state out of earlier key names. Keep the
  chain when renaming; every `localStorage` touch stays guarded, since it can
  be absent or full.

The page carries 57 decks and 1871 cards, all `type: reveal`. Each deck header
may end with `@stage N`, which ties it to a numbered lesson directory; these
stage numbers already agree with the directories, so use them, not README's
table, when in doubt. Roughly the last third are generated from the `vocab/`
bank and marked as such in the source.

**Publishing a testable demo** — `node scripts/demo.js` rewrites
`dist/abhyasah.html` into `dist/abhyasah.demo.html`, stripping the
`<!doctype>`/`<html>`/`<head>`/`<body>` wrapper that the Artifact host supplies
itself. Publish that file to give the learner a live page to try on a phone.
The demo is generated and git-ignored; `dist/abhyasah.html` remains the real
distributable.

Card data still lives in `app/index.html` rather than in per-lesson
`practice.json` files. Migrating it out — one `practice.json` beside each
lesson, discovered by the build — is the next structural step, and it is what
empties `app/index.html` down to actual markup.

### Known conflicts

**`AUDIT.md` is the full record** — read it before touching stage metadata. The
short version:

The **directory identifier is the canonical stage identity**, and `badge.md`
agrees with it in all 36 lessons. Key on directory names and you are always
correct. Everything else disagrees somewhere:

- `theory.md`, `reference.md`, and both workbooks carry `Stage N` headings from
  an earlier **32-stage** curriculum, drifting by −2, −3, or −4 in 32 of the 36
  lessons. `06-kriya/theory.md` is titled "Stage 4"; `36-avadhana-seva/theory.md`
  is titled "Stage 32".
- `00-overview.md` lists 36 slots but a different *set*: no Sandhi, plus a
  phantom `Sva-Avadhāna` at 35 with no directory.
- `README.md` mixes both schemes.
- `vyakaranam/` is a byte-identical duplicate of the `bricks.md` files merged
  into lessons 02, 05, 06 and of `03-sandhi/reference.md`.

None of this has been corrected — the audit holds six decisions that need a
maintainer's judgement. Do not perform broad metadata corrections until they
are answered.
