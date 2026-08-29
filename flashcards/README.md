# Flashcards

Progressive, stage-aligned flashcard decks for spaced-repetition review of the curriculum.

## Files

| File | Coverage | Stages | Count |
|------|----------|--------|-------|
| [`esg2-flashcards.csv`](esg2-flashcards.csv) | Phonetics, Pāṇinian notation, and the 27 sandhis | Stage 2 (Varṇa-Vidyā) → Stage 3 (Sandhi) | 86 |

## How the deck is built

The deck was rebuilt from an outside third-party "ESG Vol. 2" flashcard set. Two changes were made:

1. **Replaced** — where the outside card was a bare textbook definition, we asked a **related question** that also tests the sthāna / element / mantric layer the curriculum teaches (e.g., not just *"what is a palatal called?"* but *"which vowel and śakti-sibilant are tālavya, and what element is the palate?"*).

2. **Added** — where a subject was present in the outside set but missing from the project's theory (Ayavāyāva sandhi, Lopaḥ Śākalyasya, Na-lopa 8.2.7, Ku-tvam 8.2.30, Utsarga/Apavāda, saṃvṛta prayatna, the udātta/anudātta/svarita accents), we added it both to the deck **and** to the corresponding theory file so the flashcard has a home to point back to.

3. **Added — project-native** — cards for subjects the outside set did not carry but which are part of this course's approach: bīja architecture, krīṃ letter-by-letter, krīṃ vs klīṃ, aham as the whole varṇamālā, the sandhi walkthroughs `namaḥ + te → namaste` and `mahā + īśvara → maheśvara`.

Card IDs are `SS2-###`. Where a card is adapted from the ESG set, its tags carry the source topic; where a card is project-native, its `source_title` says so and `source_refs` points at the theory file that anchors it.

## Progressive ordering

Cards are ordered so that each card only depends on prior cards in the deck:

```
Stage 2 · Varṇa-Vidyā  (SS2-001 → SS2-047)
  · Sthānas (six places, elements)              001–008
  · The 5×5 varga matrix                        009–015
  · Antaḥstha, ūṣman, ayogavāha                 016–018
  · Vowel length, accent, savarṇa, guṇa/vṛddhi  019–024
  · Prayatna — internal and external            025–035
  · Bīja anatomy (project-native)               036–039
  · Māheśvara sūtras, it, pratyāhāras           040–047

Stage 3 · Sandhi         (SS2-048 → SS2-086)
  · What sandhi is, three kārya, three
    categories, where it is compulsory,
    utsarga vs apavāda                          048–052
  · Vowel (ac) sandhi                            053–066
  · Visarga sandhi                               067–076
  · Terminal & consonant sandhi                  077–084
  · Two synthesis traces                         085–086
```

## Schema

```
schema_version, card_id, source_title, source_refs, category, subtopic,
card_type, concept, front, answer, condition, result, symbolic_rule,
example_input, example_output, tags
```

Rule cards fill `condition / result / symbolic_rule / example_input / example_output`. Definition, enumeration, mapping, contrast, and synthesis cards leave those blank.

## Anchoring back to theory

Every card's `source_refs` names a file in the project (e.g. `02-varna-vidya/theory.md`, `03-sandhi/theory.md`) so a learner reviewing a card can jump straight to the passage it was drawn from.
