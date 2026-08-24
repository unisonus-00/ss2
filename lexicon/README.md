# The lexical layer

A word learnt on its own is a word learnt once. `bhakti` beside `bhakta`
beside `bhajana` is one root learnt three times over, and `paṅkaja` stops
being a fourth word for the lotus the moment a learner reads it as *mud-born*.
This directory holds the relationships that make that possible, in one place,
so that a lesson can use them without a second copy being written into it.

```
roots.json      52 verbal roots — sense, semantic development, family,
                upasarga family
dhatupatha.json the Dhātu-pāṭha entire — 1,159 entries over 888 roots, the
                canonical source for what a root means (see scripts/dhatupatha.js)
compounds.json  87 words readable off their parts, and 32 deliberately not
nirukti.json    traditional derivations the rules cannot confirm — kṛṣṇa from
                √kṛṣ — hand-checked, each saying why and citing where
synonyms.json   how the reference's 12 synonym sets are to be read
sources.json    what a `source` id means
```

## What is authoritative

**The curriculum is.** `09-dhatu/reference.md` is where the fifty roots live,
with their gaṇa, pada, present form and key derivatives; `10-paryaya/reference.md`
is where the synonym sets live. Neither is copied here — `scripts/lexicon.js`
reads them out of the lesson at build time and **fails the build** if this
directory disagrees with them. A dictionary is an enrichment and a check on
the enrichment; it never overrules a lesson.

So `roots.json` carries the gaṇa in order to be checked against the reference,
not in order to replace it, and `synonyms.json` carries no members at all.

Two roots are the exception and say so: `√vad` and `√vand` are taught by the
app and are not among the reference's fifty, so their gaṇa, pada and present
form are the dictionary's and are marked `extra`. Everything else in the
mechanical half is the curriculum's, checked cell by cell.

## What a source id means

Every enriched claim names one, and the ids are defined in `sources.json`:

| | |
|:--|:--|
| `curriculum` | a lesson file in this repository states it |
| `mw` | Monier-Williams states it |
| `mw-parts` | Monier-Williams does not split this compound, but attests every member of it, and the reading is the sum of them |

The last one exists because the difference matters. Monier-Williams splits a
compound it recognises in its own headword field — `niśā—kara`, `giri—śa` —
and 61 of the 87 analyses here are its. The other 26 are read off parts it
attests, which is a weaker claim, and saying so is the whole point of carrying
a source.

## What is deliberately absent

**A compound nobody can read off its parts is not explained.** `dāmodara` is
lexicalized out of a story, `govinda` has two traditional analyses and the app
already gives both, `anala`'s *a-nala* is a folk etymology. Thirty-two such
words are listed in `compounds.json` under `opaque`, each with the reason, and
the generator will not build a clue for any of them. An invented derivation is
worse than none: it is memorable, and wrong.

**No name-against-epithet line is drawn.** Nearly every Sanskrit deity name
describes — `hara` is the remover, `rudra` the howler, `īśa` the lord — so
sorting a set into names and descriptions cannot be done honestly, and a card
that did it would be teaching a distinction that is not there. What *is* clean
is the difference between a set of epithets of one being and a set of words
for one thing, and `kind` carries that.

**Nothing here is a dictionary.** The entries carry what a learner can use —
the sense a word turns on, the family it belongs to, the one other thing it
also means. Attestation strings, homonym numbers, Vedic accents and the rest
of the apparatus stay in the dictionary they came from.

## How it reaches a learner

`scripts/lexicon.js` joins this data to the practice cards by their stems and
emits two things, both at build time:

- **clues on cards that already exist** — a root or a compound reading
  appended to a card's own annotation, where the card does not already say it;
- **generated lists** — the root families, the prefix transfers and the
  synonym discriminations, in the lessons that own them.

Nothing is generated that the data does not support, and the generator drops a
card rather than guess: see `scripts/lexicon.js` for the checks, which include
refusing any card whose English cue would have more than one right Sanskrit
answer.

## The tooltip guarantee

Every vocabulary card whose dhātu this layer can establish carries it, and a
dhātu is never shown without its meaning. The division of labour is fixed:
the **chip** carries the form alone — `from √kṛṣ` — and the **popover**
carries the meaning, taken from the Dhātu-pāṭha (or the curriculum, where it
words the root itself). A link comes from one of three places, in order:

1. the curriculum — `roots.json` families and prefix families;
2. the rules — `scripts/derive.js` must rebuild the headword exactly AND the
   root's sense must share a word with the card's gloss, both always;
3. `nirukti.json` — the traditional derivation, hand-checked and sourced, for
   the names whose gloss is an epithet the root's sense can never share a
   word with.

`scripts/lexicon.js` **fails the build** if a card names a root the popover
cannot gloss, if a card that could carry its root ships without it, or if the
count of vocabulary cards carrying their dhātu falls below the recorded floor
(`TOOLTIP_ROOT_FLOOR`) — so no future change can quietly lose this. The floor
only ever moves up.
