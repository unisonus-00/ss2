<div align="center">

# संस्कृत शाला

**sanskrit school**

*From first syllable to Aṣṭāvadhāna — a 36-stage path through the living language.*

---

Language acquisition · Mantric science · Vedic recitation · Classical poetry · Avadhāna

</div>

<br>

## Overview

Sanskrit is learned here by describing your iṣṭadevatā, not by translating textbook sentences. Every letter has a place in the mouth, an elemental correspondence, and a mantric function. Grammar connects to living worship. The accent system of the Kṛṣṇa Yajurveda is learned by ear and by rule.

Work through the stages sequentially. Master each milestone before moving on.

<br>

## Curriculum

```
 ┌──────────────────────────────────────────────────────────┐
 │  STAGE 0        Devanāgarī: Script Literacy   (optional) │
 │                 Reading the page — letters, vowel signs, │
 │                 conjuncts. Skip it if you already read   │
 ├──────────────────────────────────────────────────────────┤
 │  STAGES 1–13    Language Acquisition                     │
 │                 Nouns → free composition,                │
 │                 grounded in devotional context           │
 ├──────────────────────────────────────────────────────────┤
 │  STAGES 14–16   Poetic Composition                       │
 │  STAGES 18–26   Stotra, chandas, alaṅkāra, rasa, darśana │
 ├──────────────────────────────────────────────────────────┤
 │  STAGE 17       Pūjā-Vāk: Ritual Literacy                │
 │                 Saṅkalpa, nyāsa, dhyāna, upacāra grammar │
 ├──────────────────────────────────────────────────────────┤
 │  STAGE 20       Svara-Vidyā: Vedic Literacy              │
 │                 Udātta / anudātta / svarita, vikṛtis     │
 ├──────────────────────────────────────────────────────────┤
 │  STAGES 27–36   Avadhāna                                 │
 │                 Eight challenges → full Aṣṭāvadhāna      │
 │                 Stage 36: Avadhāna-Sevā — Mastery as     │
 │                 Living Practice                          │
 └──────────────────────────────────────────────────────────┘
```

<br>

## Stage Format

Each stage contains:

| File | Purpose |
|:-----|:--------|
| `theory.md` | Concepts, explanations, examples |
| `reference.md` | Quick-lookup tables, paradigms, lists |
| `bricks.md` | Deeper formal analysis, where present |
| `workbook-questions.md` | Exercises |
| `workbook-answers.md` | Answer key |
| `badge.md` | The mastery target for the stage |
| `practice.json` | Curated Abhyāsa practice |

A `vocab/` library provides 22 thematic word lists — goddess names, weapons, nature, ritual, philosophy, and more.

<br>

## Two Tracks

The curriculum has two complementary tracks:

- **Numbered stages (01–36)** — the applied learning path. Each stage teaches Sanskrit through devotional context, composition, and practice. You learn by describing your iṣṭadevatā, writing stotras, parsing ritual texts, and building toward Aṣṭāvadhāna.

- **vyākaraṇam/** — formal Pāṇinian grammar. Deeper and more systematic, this section covers the Aṣṭādhyāyī's rule system, sandhi, samāsa, and kāraka theory in full technical detail. It is designed to complement (not replace) the stages.

**Cross-references between tracks:**

Each chapter below is merged into its stage — as `bricks.md`, or in Sandhi's
case as the stage's own reference and workbooks.

| Stage | vyākaraṇam chapter | Merged as |
|:------|:-------------------|:----------|
| Stage 2 (Varṇa-Vidyā) | Ch. 1 — Varṇavicāraḥ | `02-varna-vidya/bricks.md` |
| Stage 3 (Sandhi) | Ch. 2 — Sandhi | `03-sandhi/reference.md`, workbooks |
| Stage 5 (Rūpa) | Ch. 3 — Sarvanāmāni | `05-rupa/bricks.md` |
| Stage 6 (Kriyā) | Ch. 4 — Kriyāpada | `06-kriya/bricks.md` |

`vyakaranam/ch00-introduction` belongs to no stage.

<br>

## Usage

**Practice — `dist/abhyasah.html`**

अभ्यास, the flashcard layer. Open it directly in a browser; it is a single
self-contained file with no network dependencies, so it works offline and from
`file://` — including on a phone. Decks are tied to the numbered stages, and
progress, trouble cards, and scores are saved in the browser.

Its source is `app/` — rebuild with `node scripts/build.js` after editing.

**Reading — `index.html`**

The full curriculum as one page. Open it directly, or serve locally:

```bash
python3 -m http.server 8080
```

Rebuild it from the markdown sources with `python3 build.py`.

<br>

<div align="center">

---

*śabda-brahman — sound as the ground of reality*

</div>
