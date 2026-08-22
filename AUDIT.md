# Curriculum audit — Milestone 1

Produced before any restructuring, per the refinement plan's instruction to
report discrepancies rather than guess at corrections. Nothing in this audit
has been *fixed*; every item below is a decision waiting on the maintainer.

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
| `theory.md`, `reference.md`, both workbooks | 32 | **no — drifts in 32 of 36** |
| `00-overview.md` build sequence | 36 slots | **no — different membership** |
| `README.md` | mixed | no (reported previously) |

### 2a. The 32-stage drift

`theory.md`, `reference.md`, `workbook-questions.md`, and `workbook-answers.md`
carry `Stage N` headings from an **earlier 32-stage curriculum**. The offset is
not random — it steps at exactly four points:

| Lessons | Heading offset | Because these were inserted |
|:--------|:---------------|:----------------------------|
| `01-nama` | 0 | — |
| `04-guna` … `16-prarthana` | −2 | `02-varna-vidya`, `03-sandhi` |
| `18-katha` … `19-chandas-i` | −3 | + `17-puja-vak` |
| `21-chandas-ii` … `36-avadhana-seva` | −4 | + `20-svara-vidya` |

32 old stages + 4 inserted = 36 directories. The four inserted lessons carry no
`Stage N` in their own headings at all (`02`, `17`, `20`) or were updated by
hand (`03-sandhi`'s `theory.md` alone says "Stage 3").

So `04-guna/theory.md` is titled "Stage 2: Guṇa", `06-kriya/theory.md` is titled
"Stage 4: Kriyā", and `36-avadhana-seva/theory.md` is titled "Stage 32".

**This is the single largest metadata problem in the repository.** A learner
opening stage 6 reads "Stage 4" at the top of three of its files.

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

**`vyakaranam/` duplicates the merged content byte-for-byte.** Verified by
checksum:

| Chapter file | Lesson file | |
|:---|:---|:---|
| `vyakaranam/ch01-varnavicharah/theory.md` | `02-varna-vidya/bricks.md` | identical |
| `vyakaranam/ch03-sarvanaamani/theory.md` | `05-rupa/bricks.md` | identical |
| `vyakaranam/ch04-kriyapada/theory.md` | `06-kriya/bricks.md` | identical |
| `vyakaranam/ch02-sandhi/reference.md` | `03-sandhi/reference.md` | identical |

Two copies of the same text, either of which could drift from the other.

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

## 6. Proposed minimal migration

Deliberately small, and in this order:

1. **Change nothing about numbering yet.** The drift is in prose headings, not
   in machine identity. The app can key on directory identifiers today and be
   correct regardless of how §2 is resolved.
2. Split the source mechanically (Milestone 2), no pedagogical change.
3. Give each lesson a `practice.json`; the build discovers them by directory.
4. Move existing decks into their `practice.json` as `type: reveal`, keeping
   card identity so no learner history is lost.
5. Assign stable IDs of the form `06-kriya:person:nam-1sg`, with a versioned
   localStorage migration from the current `devanagari + '¦' + gloss` key.
6. Only then add `choice` (Kriyā), then Sandhi, then `sequence`.

## 7. Decisions needed before proceeding

These are held deliberately — the plan forbids silent guessing.

1. **Repair the 32-stage drift?** Rewriting `Stage N` in four files across 32
   lessons is mechanical and low-risk, but it is exactly the "broad metadata
   correction" the plan says to hold until the audit is reviewed. Recommended:
   yes, matching directory and badge numbers.
2. **`Sva-Avadhāna`** — create `35-sva-avadhana` and renumber, or delete the row
   from `00-overview.md`? Recommended: delete the row; the directories and
   badges are self-consistent without it.
3. **Sandhi in the overview** — add it as a numbered stage? Recommended: yes,
   it is a full lesson everywhere else.
4. **The four `@stage 0` decks** — adopt Lakāra into `06-kriya`, Kṛt and
   Taddhita into `09-dhatu`, and leave grammar terminology cross-cutting?
5. **`08-sambodhana`'s badge name** — rename from Prārthanākāra?
6. **`vyakaranam/`** — keep the duplicate tree, or make the lesson copy
   canonical and leave the chapter tree as a pointer?
