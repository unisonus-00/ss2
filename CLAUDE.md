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

**Abhyāsaḥ** — the primary project file, distributed as `dist/abhyasah.html`.
It is one self-contained page with no external references of any kind: no CDN,
no fonts, no `fetch`, no stylesheets. It opens from `file://` and works
offline, and it must stay that way.

Application code lives in `app/`; **edit there, never in `dist/`**. Curriculum
content lives beside its lesson:

```
app/index.html         markup only — ~120 lines, no card data
app/styles.css
app/app.js
scripts/build.js       discovers, validates and inlines -> dist/abhyasah.html
scripts/demo.js        repackages the distributable for publishing as an Artifact
NN-lesson/practice.json   the lesson's curated practice
practice.json             cross-cutting practice, beside 00-overview.md
```

`node scripts/build.js` inlines the CSS, the JS, and every `practice.json` into
one file. `--check` builds in memory and fails if `dist/` is stale, without
writing.

Practice files are **discovered, not listed** — any numbered lesson directory
holding a `practice.json` is picked up, in directory order, so adding a
lesson's practice needs no build change. Directory order *is* the app's
navigation order: the deck picker groups decks under one optgroup per lesson,
labelled from that lesson's own `theory.md` heading, so the picker and the
curriculum cannot drift apart.

The build refuses to ship a broken or non-offline page. It rejects duplicate
card ids, unknown types, a `choice` without options or whose answer is not
among them, a `sequence` whose answer uses pieces absent from `parts`, a
`practice.json` naming a lesson it does not sit in, and one in a directory that
is never loaded. It then scans its own output for `<script src>`, `fetch`,
`@import`, remote `url()` and the like, so an accidental network dependency
fails the build rather than shipping.

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

A card with no `type` is `reveal`, which is what all 1871 migrated cards are.
`choice` adds `front`, `options`, `answer`; `sequence` adds `front`, `parts`,
`answer` (an array). Add nothing else without a demonstrated need.

Three things here are load-bearing for the compatibility list above:

- **`id` is the card's identity.** It is written in `practice.json`, never
  derived from what the card displays. Change an id and you retire that card's
  history.
- **Deck names key saved scores.** `SAVED.decks` is keyed by the deck's full
  name, so renaming a deck silently drops its best score. The names still carry
  their original `01 ·` / `V01 ·` prefixes for exactly this reason; the picker
  hides them from display but the value keeps them.
- **Progress lives in `localStorage`** under `abhyāsaḥ`, versioned by `SAVED.v`
  (now 2). v1 keyed trouble history by `devanagari + '¦' + gloss`; the app
  lifts those records onto stable ids on first load. `OLD_KEYS` separately
  lifts state out of earlier storage key names. Keep both chains; every
  `localStorage` touch stays guarded, since it can be absent or full.

The app carries 23 lessons, 57 decks, and 1871 cards. Roughly the last third of
the decks are generated from the `vocab/` bank and marked as such.

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
  an earlier **32-stage** curriculum, drifting in 31 of the 36 lessons.
  **Repaired** — all 36 now agree. Body cross-references still mix old and new
  numbers and were deliberately left alone.
- `00-overview.md` lists 36 slots but a different *set*: no Sandhi, plus a
  phantom `Sva-Avadhāna` at 35 with no directory.
- `README.md` mixes both schemes.
- `vyakaranam/` is a byte-identical duplicate of the `bricks.md` files merged
  into lessons 02, 05, 06 and of `03-sandhi/reference.md`.

None of this has been corrected — the audit holds six decisions that need a
maintainer's judgement. Do not perform broad metadata corrections until they
are answered.
