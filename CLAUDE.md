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

**Abhyāsaḥ** — the primary project file, at `dist/abhyasah.html`. It is one
self-contained page with no external references of any kind: no CDN, no fonts,
no `fetch`, no stylesheets. It opens from `file://` and works offline, and it
must stay that way.

There is no `app/` or `scripts/build.js` yet — the page is currently hand-
maintained rather than built, so `dist/abhyasah.html` is both source and
distribution. Splitting it into the layout under **Architecture** is the next
structural step; until then, edit the page directly.

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

The page carries 58 decks. Each deck header may end with `@stage N`, which ties
it to a numbered lesson directory; these stage numbers already agree with the
directories, so use them, not README's table, when in doubt. Roughly the last
third are generated from the `vocab/` bank and marked as such in the source.

Card data still lives in the page rather than in per-lesson `practice.json`
files. Migrating it out — one `practice.json` beside each lesson, assembled at
build time — is the other half of the architecture work above.

### Known conflicts

Reported rather than guessed, per **Curriculum hierarchy** above. The lesson
directory names and `build.py`'s `stage_meta` agree with each other; `README.md`
is the outlier in each case.

- README's cross-reference table places Guṇa at stage 3, Kāraka at 6, and Vākya
  at 11. The directories are `03-sandhi`, `04-guna`, `06-kriya`, `07-karaka`,
  `11-samasa`, `12-vakya` — so those three are each off by one.
- README's curriculum map puts Pūjā-Vāk at stage 16 (`17-puja-vak`) and
  Svara-Vidyā at 19 (`20-svara-vidya`), and gives the avadhāna block as stages
  26–36 when `26-darshana` is still Darśana and avadhāna begins at
  `27-samasyapurana`.
- README's "Stage Format" section says each stage contains four files. All 36
  carry a fifth, `badge.md`, and three also carry `bricks.md`.

Resolve these at the source before building practice sets that depend on stage
numbers.
