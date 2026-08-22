# Curriculum audit — Milestone 1

Produced before any restructuring, per the refinement plan's instruction to
report discrepancies rather than guess at corrections.

> **Status: all six decisions in §7 have been acted on.** The tables below
> describe the repository *as audited*, which is why they are written in the
> past tense where something has been fixed.
>
> Two things remain open, and neither was in the original audit — both surfaced
> while repairing it:
>
> - **§2a-bis** — lesson prose cites stages by number, mixing old and new
>   schemes with no mechanical rule to separate them.
> - **§3a** — roughly 110 KB of unique vyākaraṇam material that no build
>   publishes, while the documentation promises a Grammar section.
>
> §3 also carries a **correction** to this audit's own earlier claim about the
> `vyakaranam/` tree.

## 1. Canonical stage order

The directory identifier is the stable machine identity, as the plan requires:

```
01-nama              13-bhava             25-rasa
02-varna-vidya       14-stotra-i          26-darshana
03-sandhi            15-stotra-ii         27-samasyapurana
04-guna              16-prarthana         28-dattapadi
05-rupa              17-puja-vak          29-nishiddhakshari
06-kriya             18-katha             30-citra-kavya
07-karaka            19-chandas-i         31-dharana-i
08-sambodhana        20-svara-vidya       32-dharana-ii
09-dhatu             21-chandas-ii        33-aprastuta-prasanga
10-paryaya           22-chandas-iii       34-multi-devata
11-samasa            23-paryaya-chandas   35-ashtavadhana
12-vakya             24-alankara          36-avadhana-seva
```

`badge.md` agrees with the directory number in **all 36 lessons**. Directory
number and badge number together are the reconciled spine; everything else in
the repository is measured against them.

## 2. Four competing numbering systems

| Source | Stages | Agrees with directories? |
|:-------|:-------|:-------------------------|
| Directory name | 36 | canonical |
| `badge.md` | 36 | yes, all 36 |
| `theory.md`, `reference.md`, both workbooks | 32 | **no — drifted in 31 of 36** |
| `00-overview.md` build sequence | 36 slots | **no — different membership** |
| `README.md` | mixed | no (reported previously) |

### 2a. The 32-stage drift

`theory.md`, `reference.md`, `workbook-questions.md`, and `workbook-answers.md`
carried `Stage N` headings from an **earlier 32-stage curriculum**, in 31 of the
36 lessons. The offset was not random — it stepped at exactly four points:

| Lessons | Heading offset | Because these were inserted |
|:--------|:---------------|:----------------------------|
| `01-nama` | 0 | — |
| `04-guna` … `16-prarthana` | −2 | `02-varna-vidya`, `03-sandhi` |
| `18-katha` … `19-chandas-i` | −3 | + `17-puja-vak` |
| `21-chandas-ii` … `36-avadhana-seva` | −4 | + `20-svara-vidya` |

The 31 drifted lessons plus `01-nama` — which kept stage 1 either way — are the
32 old stages; 32 + 4 inserted = 36 directories. The inserted lessons carry no
`Stage N` in their headings at all (`02`, `17`, `20`) or were updated by hand
(`03-sandhi`'s `theory.md` alone said "Stage 3").

So `04-guna/theory.md` was titled "Stage 2: Guṇa", `06-kriya/theory.md` "Stage
4: Kriyā", and `36-avadhana-seva/theory.md` "Stage 32".

**This was the single largest metadata problem in the repository.**

**Resolved** — 124 headings across those 31 lessons now match their directory
and badge. All 36 lessons agree.

### 2a-bis. Body cross-references — still open

Found while making the repair, and *not* corrected. Beyond the headings, the
lesson prose refers to other stages by number ("apply sandhi rules from Stage
3", "using everything learned through Stage 7"), and those references are
**mixed**: most already use the new directory numbering, a few still use the
old.

New, and correct: `03-sandhi/theory.md` cites "letter-knowledge from Stage 2",
which can only mean Varṇa-Vidyā, a lesson that did not exist in the 32-stage
scheme. Every `badge.md` unlock line ("unlocks Stage N content") is likewise
already correct.

Old, and now wrong: `01-nama/theory.md` calls adjectives "(preview of Stage 2)"
when Guṇa is stage 4; `05-rupa/theory.md` cites "a verb brick from Stage 4"
when Kriyā is stage 6.

There is no mechanical rule that separates the two — each reference has to be
read against what it is actually pointing at. Left alone rather than
blanket-remapped, which would have broken the many already-correct ones.

### 2b. `00-overview.md` has different membership

Its build sequence is 36 numbered slots, but the *set* differs from the
directories by two entries:

- **Sandhi is absent.** It appears only as a prose subsection, "The Snap-Rules
  (Sandhi)", not as a numbered stage — yet `03-sandhi/` is a full lesson with
  theory, reference, both workbooks, and a badge.
- **`Sva-Avadhāna` is present at slot 35** ("Self-directed avadhāna — design
  your own challenges"). No such directory exists. Directory 35 is
  `35-ashtavadhana`.

Relative ordering is otherwise identical to the directories. The overview also
states each stage folder contains four files (all 36 carry five or six) and that
`vocab/` holds 20 lists (it holds 22).

## 3. Smaller inconsistencies

**Badge name collision.** `08-sambodhana/badge.md` awards **Prārthanākāra**
("maker of prayers"), but `16-prarthana` is the Prārthanā stage, awarding
**Prārthanāsiddha**. Every other badge echoes its own stage name — Nāmavit,
Sandhikāra, Guṇavit, Rūpavit, Kriyāvit, Kārakavit. Stage 8's badge appears to
be left over from a different stage.

**Imported vyākaraṇam identity is still visible.** `03-sandhi/reference.md`,
`workbook-questions.md`, and `workbook-answers.md` are titled "Chapter 2:
Sandhi", not "Stage 3". The `bricks.md` files legitimately keep chapter titles
(they *are* the chapters), but the sandhi reference and workbooks were adopted
wholesale as the stage's own material while keeping chapter identity.

**Part of `vyakaranam/` duplicates the merged content byte-for-byte** — but
only part. Checksumming all 22 files in the tree against every lesson file
gives **6 duplicates and 16 unique files**:

| Chapter file | Lesson file |
|:---|:---|
| `vyakaranam/ch01-varnavicharah/theory.md` | `02-varna-vidya/bricks.md` |
| `vyakaranam/ch02-sandhi/reference.md` | `03-sandhi/reference.md` |
| `vyakaranam/ch02-sandhi/workbook-questions.md` | `03-sandhi/workbook-questions.md` |
| `vyakaranam/ch02-sandhi/workbook-answers.md` | `03-sandhi/workbook-answers.md` |
| `vyakaranam/ch03-sarvanaamani/theory.md` | `05-rupa/bricks.md` |
| `vyakaranam/ch04-kriyapada/theory.md` | `06-kriya/bricks.md` |

> **Correction.** An earlier revision of this audit called the whole tree a
> byte-identical duplicate. That was wrong: it generalised from four spot
> checks. Two thirds of the tree is unique material.

**Resolved** — both copies are wanted where they sit, so the risk was never
duplication itself but silent drift. `build.py` now fails if any of the six
pairs stops matching; the lesson copy is canonical, because it is the one the
reader ships.

### 3a. The bigger finding underneath it — still open

The 16 unique files are roughly **110 KB of formal Pāṇinian grammar that
nothing publishes**. `build.py` never reads `vyakaranam/` — it collects
`stages` and `vocab` only, and there is no Grammar section in the built
`index.html` at all. The largest single file in the tree,
`vyakaranam/ch02-sandhi/theory.md` at 35 KB, has no reader.

Both `README.md` and `00-overview.md` describe vyākaraṇam to the learner as a
complementary track — the overview even says "The **Grammar** section covers
Pāṇinian vyākaraṇam" — so the documentation promises a section the build does
not produce.

Publishing it means a third top-level section in the reader alongside Stages
and Vocab, with its own navigation, search and ordering, plus a decision about
how chapters relate to the stages that already absorbed four of their files.
That is a curriculum-publishing decision, not a mechanical fix, and it is left
for the maintainer.

## 4. Current Abhyāsaḥ decks and their lesson mapping

57 decks, 1871 cards, all `type: reveal`. The good news: the `@stage N` markers
already agree with directory numbers, so **no deck needs renumbering**.

### 4a. Decks with no lesson (`@stage 0`)

| Deck | Cards | Natural home |
|:-----|------:|:-------------|
| Vyākaraṇam — grammar terms | 29 | cross-cutting; no single lesson |
| Lakāra — the ten tense-moods | 11 | `06-kriya` |
| Kṛt — primary suffixes | 11 | `09-dhatu` |
| Taddhita — secondary suffixes | 8 | `09-dhatu` |

The refinement plan names Kṛt/Taddhita as a practice target, but the repository
has no Kṛt/Taddhita lesson. `09-dhatu` ("Roots and Upasargas") is the closest
fit, and already holds the `V16 · Upasargas & suffixes` deck.

### 4b. Lessons with no practice at all (14)

`15-stotra-ii`, `16-prarthana`, `18-katha`, `22-chandas-iii`,
`23-paryaya-chandas`, `28-dattapadi`, `29-nishiddhakshari`, `30-citra-kavya`,
`31-dharana-i`, `32-dharana-ii`, `33-aprastuta-prasanga`, `34-multi-devata`,
`35-ashtavadhana`, `36-avadhana-seva`.

Most of these are composition and avadhāna stages where open-ended production is
the point, and the plan explicitly leaves that to workbook and badge. **Only
`22-chandas-iii` and `23-paryaya-chandas` look like genuine gaps** — both have
recognizable constrained-retrieval skills (metre identification, synonym
substitution under metrical constraint).

### 4c. Curation debt

Deck sizes are uneven in a way the plan's §6 speaks to directly. The
vocab-generated `V` decks are exhaustive imports:

| Lesson | Cards | Note |
|:-------|------:|:-----|
| `01-nama` | 625 | across 15 decks; 519 of those cards are vocab imports |
| `17-puja-vak` | 180 | 5 decks |
| `05-rupa` | 147 | 139 of them one deck of full declension tables |
| `11-samasa` | 51 | but only 6 on compound *types* |
| `03-sandhi` | 27 | one card per rule — names only, no joins |
| `19-chandas-i` | 20 | 2 decks |
| `24-alankara` | 10 | thinnest deck in the app |

A third of the entire app — 625 of 1871 cards — sits on `01-nama`, while the
operational lessons the refinement targets hold 27 (Sandhi), 75 (Kriyā), and 90
(Guṇa).

`03-sandhi` is the clearest illustration of the problem the refinement is meant
to solve: 27 cards that name the rules, and not one that performs a join. Its
workbook, by contrast, is richly operational.

## 5. Workbook structure at the pilot lessons

Both Milestone 4 and 5 pilots have strong exercise patterns to draw from.

`06-kriya/workbook-questions.md` — Conjugation, Translation, Sentence Building,
Negation & Questions, Past Tense (Laṅ-lakāra), Imperative & Optative,
Composition. Sections A, F, and G map directly onto `choice` transformations;
Section C maps onto `sequence`.

`03-sandhi/workbook-questions.md` — organised by named rule (Yaṇ,
Savarṇadīrgha, Guṇa, Vṛddhi, Pūrvarūpa/Pararūpa, Śchutva/Ṣṭutva, Jaśtva,
Anunāsika, Anusvāra, Parasavarṇa, Chartva, and six visarga varieties), each with
a mixed-identification subsection. This is `choice` practice almost verbatim.

## 6. The minimal migration — completed

Steps 1–5 are done; step 6 is Milestones 4–6 and has not started.

1. ~~Change nothing about numbering yet~~ — superseded once decision 1 was
   approved. The headings are now repaired, and the app keys on directory
   identifiers regardless.
2. **Split the source mechanically** (Milestone 2) — done, verified
   byte-identical.
3. **Give each lesson a `practice.json`; the build discovers them by
   directory** — done. 23 files, discovered not listed, so a new lesson's
   practice needs no build change.
4. **Move existing decks in as `type: reveal`, keeping card identity** — done.
   57 decks and 1871 cards moved with their deck names byte-for-byte, because
   `SAVED.decks` is keyed by deck name and a rename would drop the best score.
5. **Stable IDs plus a versioned localStorage migration** — done. Every card
   carries an id like `19-chandas-i:gana:laghu-guru-guru`; on first load the
   app lifts trouble history off the old `devanagari + '¦' + gloss` key onto
   the id and stamps `v: 2`.
6. Only then add `choice` (Kriyā), then Sandhi, then `sequence`. **Not
   started.**

## 7. Decisions

Decisions 1–4 were approved and applied. 5 and 6 carried no recommendation —
each needs a judgement in the maintainer's own voice — and are untouched.

1. **Repair the 32-stage drift** — *done.* 124 headings across 31 lessons now
   match directory and badge. Only the first heading of each file was touched;
   body cross-references are a separate, genuinely ambiguous problem (§2a-bis)
   and were left alone.
2. **`Sva-Avadhāna`** — *done.* The row is gone from `00-overview.md`. The
   directories and badges are self-consistent without it, and creating a stage
   would have renumbered everything after 34.
3. **Sandhi in the overview** — *done.* Added as stage 3, with the phase
   ranges, the source cross-reference table, the file list, and the vocab count
   all brought in line. `README.md` was corrected to match.
4. **The four `@stage 0` decks** — *done.* Lakāra moved into `06-kriya`; Kṛt
   and Taddhita into `09-dhatu`; grammar terminology stayed cross-cutting, in a
   root `practice.json` beside `00-overview.md`.
5. **`08-sambodhana`'s badge name** — *done.* Renamed from Prārthanākāra,
   which collided with stage 16's Prārthanā, to **Sambodhanavit** ("Invoker").
   It now echoes its own stage like every other badge, and follows the `-vit`
   pattern used by Nāmavit, Guṇavit, Rūpavit, Kriyāvit and Kārakavit. The
   Discord role of the old name will need renaming to match.
6. **`vyakaranam/`** — *duplication resolved, publication still open.* Only 6
   of its 22 files were duplicates; `build.py` now guards those six against
   drift. The 16 unique files remain unpublished — see §3a, which is the real
   problem and needs a maintainer's decision.

### Discovered during the repair

- **Body cross-references** mix old and new stage numbers (§2a-bis). Not
  mechanically separable; left alone.
- **`README.md` cited a vyākaraṇam "Ch. 5"** for Vākya. No `ch05` exists — the
  tree stops at `ch04-kriyapada`. The phantom row was removed and the table
  rewritten to show what is actually merged where.
- **`README.md`'s chapter table mislabelled two rows**: "Stage 3 (Guṇa)" for
  ch2 and "Stage 6 (Kāraka)" for ch4. The numbers were right but the names
  belonged to different stages — stage 3 is Sandhi, stage 6 is Kriyā.
