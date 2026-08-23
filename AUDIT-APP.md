# Abhyāsa — functional and pedagogical audit

Audit of the practice app as built (`dist/abhyasah.html`, build from `app/` at
commit `38cfa7f`), against the standard of an adaptive tutor built for
long-term retention. Every claim below was checked against the actual
implementation; the critical ones were verified end-to-end in headless
Chromium against the shipped page, through the app's own grading path rather
than by seeding state.

Baseline: `node scripts/build.js --check` passes; `node scripts/test.js`
passes **408 of 408**. Inventory: 28 lessons, 176 decks, 2,332 cards
(1,955 reveal · 372 choice · 5 sequence).

---

## Overall assessment

The app is functionally coherent and unusually well-guarded. Data integrity
is enforced at build time (stable ids, schema, orphan detection, offline
self-containment) and by a test suite that re-derives paradigm answers and
synonym sets from the lesson sources, enforces taught-before-tested for a
dozen grammatical equivalences, checks metalanguage staging, deck ordering,
touch targets, and the migration chain v1→v7. Distractor hygiene is real:
across all 372 choice cards there is no length bias (answer is the unique
longest option 17% of the time, unique shortest 17% — at/below chance), no
2-option cards, and options are shuffled per showing. The scaffold-withdrawal
mechanic (stem class shown until its own card has asked for it), the
syncretism collapse, and the choice-instead-of-self-graded-production
rationale for paradigm cells are genuinely good instructional design.

The gap is concentrated in one place: **the adaptive loop between a miss and
the next scheduled encounter.** The review scheduler (rest ladder, overdue
ordering, round-robin) is sound in isolation — and the test suite proves it
in isolation — but the integrated loop breaks the system's own first
promise: a card missed in Abhyāsa leaves the review pool entirely, so the
weakest material gets the *least* scheduled practice. Around that sit three
mastery-inflation paths (immediate-relearning rounds, choice-card guessing,
session-counted rather than time-counted spacing) that let "learned" and
"retained" be earned without the retention they claim to certify. All are
small, localized corrections; none requires new architecture.

Sequencing is mechanically consistent but has two learner-facing problems:
the guided path walks 41 vocabulary lists (609 cards, 26% of the course)
before the first grammatical concept, and the within-lesson ordering rule
forces production drills above the recognition tables they are a "second
pass" over.

---

## Critical issues

### C1. A card missed in review is ejected from review

- **Evidence.** `reviewPool()` (`app/app.js:456`) is exactly the set of
  `SAVED.mastered` cards. `didntKnow()` (`app.js:2366`) calls
  `unmarkMastered` (`:2373`) on every first miss, in every round type —
  review rounds included. Verified end-to-end: a card missed through the real
  UI path in a mixed review ends with `mastered:false`, `inPool:false`,
  `inNextDraw:false`, and — because a draw "keeps no list's books"
  (`finish()`, `:2488`) — `inDeckPile:false`. Its only persistent trace is
  one trouble strike (`w:1` of the 3 needed to enter the drill).
- **Contradiction.** The review window and the shipped page promise the
  opposite: *"Cards you remember return later; cards you miss return sooner,
  so review stays focused"* (`renderReviewPanel`, present twice in
  `dist/abhyasah.html`). The suite's pacing test ("a missed card comes back
  in the next session", `scripts/test.js:2759`) passes only because it calls
  `recordReview()` directly, bypassing `didntKnow()` — it tests the
  scheduler, not the loop.
- **Learner impact.** This inverts adaptive review. Stable cards are
  rescheduled on the [0,1,2,4,8,16] ladder; a lapsed card gets *no* scheduled
  path back. Between 1 and 3 lifetime misses it is in limbo: not in the pool,
  not in the trouble drill, not in any deck's missed pile. The only repair
  routes are the optional "Practise these again" button on the results
  screen, or noticing the source list regressed to 99% and replaying all
  ~15 cards to re-earn one. Weakness resurfacing — the core of the
  requirement that weak concepts recur more often — silently fails at
  exactly the moment the system has its best evidence of weakness.
- **Correction (smallest).** Let the pool retain lapsed cards: include in
  `reviewPool()` any card that has a review record (its streak is already 0,
  so `overdueBy` makes it due next session). A right first-try answer in that
  next draw re-marks it mastered through the existing `knew()` path with no
  further change; the list-completion regression ("a wrong answer takes back
  the tick") is preserved. Add one integrated test that drives a miss through
  `didntKnow()` and asserts the card is drawn next session.

---

## High-priority issues

### H1. The cold-recall rule is defeated at the round boundary

`knew()` refuses mastery on a within-round re-show (`:2359`,
"relearning, not remembering"), but "Practise these again" (`:2964`) and the
missed pile (`:3046`) start *new* rounds with fresh flags. Verified: a card
missed in review, replayed via the offered button, and answered correctly
**seconds after its answer was shown** is re-mastered and back in the pool
(`victimMasteredAgain:true`). The same applies after any deck round. Since
mastery feeds coverage, list completion, awards, and the review pool, the
system's central signal — "right on a cold showing" — is one button-press
deep. Correction: rounds started with `{review:true}` should not grant
mastery for cards missed in the same page session (the `SESSION` guard in
`markRight` (`:425`) is the existing pattern to reuse). *Pedagogy /
engineering · effort small.*

### H2. Spacing is counted in sessions the learner can mint at will

`REST` (`:1593`) indexes review *runs*, not time; nothing stores a
timestamp. Verified: three back-to-back full draws — 22 ms of wall-clock —
took `runs` 0→3 and marked 16 cards **retained**, the tier the UI and
CLAUDE.md describe as "right first try in two separate review sessions …
*days apart*". Repeated same-evening draws both mature streaks early and age
every other card's rest (runs inflation). One-line-of-concept fix: advance
`runs` at most once per calendar day (the `bumpStreak()`/`today()` pattern
already exists at `:823`), so "Draw 20 more" still works but same-day draws
count as one session for pacing and retention. *Pedagogy · effort small.*

### H3. A correct guess is a cold recall

`answerChoice` → `knew()` treats a 1-in-3 / 1-in-4 guess identically to
recall: instant `markMastered`, review-accuracy credit. 372 cards (16%) —
including every Rūpa-siddhi production deck, i.e. the paradigm mastery the
badges demand — can be part-"completed" by chance, and the ratchet keeps
each lucky hit until it is missed again somewhere. Correction: for
choice-type cards require two first-showing successes (distinct sessions)
before `markMastered`; reveal cards, where the learner attests recall, stay
single-success. *Pedagogy · effort medium.*

### H4. Production is never scheduled; mastery is direction-blind

`SAVED.mastered` has no direction dimension: a card answered once,
Devanagari→meaning, is "learned" — and later "retained" — though the
produce direction was never attempted. The direction toggle exists and the
pair/cue system supports it well, but reversal is entirely learner-initiated
and defaults to recognition; Abhyāsa draws in whatever direction the toggle
happens to sit. The badges ask for production ("through all 8 vibhaktis × 3
vacanas"). Smallest correction with real effect: alternate the review draw's
direction (per session, or per card once its streak ≥ 1), so retention is
certified in both directions without new state. *Pedagogy · effort medium.*

### H5. The guided path is a 609-card vocabulary wall

Stage 1 holds 41 lists / 609 cards (26% of the course; Bhāṣā-Vidyā overall
is 137 of 176 lists). `nextList()` recommends strictly the first unfinished
list in track order, so the "Continue —" path walks all 41 deity-name lists
before Varṇa-Vidyā introduces the sound system, and hours before the first
grammatical concept. The track prose promises "Nothing here has to be
finished before the next thing makes sense," but the recommendation engine
never acts on that. Everything *is* unlocked (gating is track-level only —
good), so this is a recommendation problem, not a lock problem. Correction:
after the lesson's curated lists (the 7 non-`V` lists), let "Next" advance
to the following stage and leave the V-bank breadth lists to the drawer and
to review; or interleave one breadth list per later stage. *Pedagogy / UX ·
effort medium.*

---

## Progression and prerequisites

- **Gating** is two gates only (Home → track), deliberate and
  well-implemented; test mode opens everything; `SAVED.begun` is seeded from
  prior progress on migration so returning learners are not re-gated.
  Verified by tests; no locked-content dead ends found.
- **Taught-before-tested** is enforced mechanically (case names, class
  notation, compound types, metre staging, the twelve equivalences) — the
  strongest prerequisite discipline I have seen in an app this size. The
  in-card popover glossary (case/type/gender/stem notes) covers the
  remaining jargon well.
- **M1 — Stage 5/6 order inversion.** The test rule "an exercise may never
  sit below a plain recall list" (`test.js:1872`) classifies decks
  core/interactive/reveal and forces every choice deck above every reveal
  deck in a lesson. In Stage 5 that puts 13 production decks (~180 choice
  cards) above the 9 `Śabda-rūpa` recognition tables that CLAUDE.md itself
  calls the first pass ("deliberately a second pass over the same tables");
  in Stage 6 the person/tense practice sits above the three `Dhātu-rūpa`
  paradigm decks. A learner following "Continue" meets *Form the caturthī
  singular of devī-* before ever drilling a declension table. Correction:
  exempt mastery-table decks from the interactive-above-reveal rule (or
  order Stage 5 as table→production per paradigm) and encode that in the
  test. *Pedagogy / content · Medium · effort medium.*
- **M2 — the rule "carded when the workbook holds a bounded operation" has
  two unapplied cases.** Stage 24 (Alaṅkāra) workbook §A: identify the
  alaṅkāra in five given lines; Stage 25 (Rasa) §A: identify the rasa in
  five passages. Both have answer keys with reasons — the same shape that
  earned Stotra II, Prārthanā, Kathā and Paryāya-Chandas their cards — yet
  both stages card only term→definition. Assessment does not match the
  lesson objective (identification in context). Stage 26 §A is already
  covered by its vocabulary decks. *Content · Medium · effort small.*
- Stages 28–36 uncarded is correct per the curriculum (open-ended
  performance); no finding.

## Retrieval and difficulty

- Retrieval-first is honored: nothing reveals before an attempt (tap-to-flip
  gated on interactive cards; tests assert no premature reveal); Study is
  lookup-only and carries no cards; theory is deliberately not inlined.
- Desirable difficulty is mostly right: distractors are neighboring
  paradigm cells or same-verb forms; set-membership and intruder cards are
  a genuinely hard discrimination; scaffold withdrawal raises difficulty
  within a round; the missed-card re-queue at distance ≤4 with a "second
  look" badge is honest relearning.
- Recognition skews the totals: 84% of cards are self-graded reveal, and
  the default direction is the easier one (see H4). The reversal machinery
  is excellent — it just needs to be *driven* by the system, not only
  offered.
- Minor: `Prārthanā-pada` (5 cards) reuses the same three options across
  cards, so within-round elimination sets in by card 3 (*Low*). The
  trouble drill runs the whole list at once — a struggling learner can be
  handed a 40+ card round, past the app's own 25-card sitting principle
  (*Low · cap the drill at ~20, worst first*).

## Adaptive mastery

- The scheduler itself — overdue-first, ties shuffled, round-robin across
  lists, fill-to-full-session — is well-designed and tested; new material
  correctly leads (never-reviewed = maximally overdue).
- The loop around it is where C1/H1/H2/H3 live: misses eject rather than
  accelerate; "sessions" are mintable; relearning and guessing feed the
  pool. Together they mean review cadence responds to performance in the
  *stable* direction (intervals expand: true) but not in the *unstable*
  direction (weakness does not resurface: false).
- **Interval ceiling.** REST caps at 16 sessions and a session is 20 cards,
  so the scheduler can *pace* at most ~320 cards; beyond that, stable cards
  simply queue by longest-overdue. Graceful degradation, but at full course
  scale (2,332 cards) intervals are effectively queue latency, not the
  ladder. Worth extending the ladder (32, 64) and/or scaling session size
  with pool size eventually. *Low · engineering.*
- Review accuracy (`masteryPct`, `:2658`) is a lifetime average — early
  fumbling permanently depresses the rank a learner sees; it cannot reflect
  current ability. A rolling window (e.g., last 200 reviewed) is the
  smallest fix. *Medium · effort small.*
- Over-review of mastered material is largely avoided (rest ladder,
  "20+ due" framing, no review button inside a review). The one deliberate
  exception — filling an all-rested pool to a full 20 — is acceptable and
  self-correcting (extra successes lengthen rests).
- Trouble mechanics: entry at 3 cumulative wrongs is reasonable, but
  clearing is keyed to `SESSION` — a *page load* (`:412`, `:425`) — not a
  sitting. A phone tab that stays alive for a week can credit only one of
  the three required "separate sittings" no matter how many days the
  learner practises; conversely three quick reloads clear a card in
  minutes. Key the credit to `today()` instead. *Medium · effort small.*

## Metacognition

The binary self-grade on reveal cards is the app's one confidence signal,
and it *is* used — it drives mastery, piles, trouble, and review. Nothing
collected goes unused except two trivia: `ds.last` (`:2513`) is written and
never read, and the identity of the distractor a learner picked (a specific
confusion, e.g. dative-for-ablative) is discarded at the round boundary.
The design decision to route paradigm production through choice cards
*because* self-grading is least reliable there ("devyai… or was it
devyāḥ?") is exactly right. What is missing is any guard on self-grading
optimism elsewhere — which is why H1–H3 matter: the system's counterweight
to a generous self-grade is supposed to be the cold-recall rule and the
review, and those are the two places that leak. No new confidence UI is
needed; fixing the leaks is the metacognitive correction.

## Card and lesson findings

Sampled across Stages 3, 5, 6, 12, 16, 18, 21, 23 and the vocab bank: card
quality is consistently high — tasks named before items, both-level answers
in kāraka cards, syncretism named on collapsed cards, sourced provenance,
per-deck pairs and cues correct. Recurring smaller issues:

- The results screen after a review names weak *lists* ("practise") but the
  regressed list's own missed pile stays empty (by design, `finish()`
  keeps no books for draws) — so the pointer leads to a full-list replay
  to repair one card. If C1 is fixed, this resolves itself; otherwise the
  draw should write the deck pile it already knows about. *(folds into C1)*
- The first card of the app (`कामाक्षी`) carries `feminine · ī-stem`
  annotation before Stage 5 exists — mitigated well by the tappable
  popover glossary; no action needed, noted as working as intended.
- "One direction only" greying, IAST per-line rules, and cue derivation are
  all correct in the shipped page (spot-checked and covered by tests).

## Core mechanics

- **Scoring/progress/completion:** sound and honest post-"complete means
  learned" refactor; counted from cards up; rounding guards correct. One
  inconsistency: the scoreboard panel says "N of 176 lists completed"
  counting decks *played through at any score* (`:2751`) while the drawer
  row under it counts truly-complete lists (`:2788`) — the two can
  contradict each other on adjacent surfaces, reviving exactly the
  ambiguity the refactor removed. Rename the panel line ("N lists scored")
  or count `finishedDecks()`. *Medium · UX · small.*
- **Persistence:** localStorage guarded everywhere; migration chain v1→v7
  correct and tested; renames/splits policy consistently applied; card ids
  stable. A mid-round refresh loses the round (queue is in-memory) — cheap
  to accept; misses of an abandoned round are not recorded anywhere
  (*Low*, note only).
- **Navigation:** two-page model, folding rules, locked-row messaging,
  panel back-stack, and returning-user flows all verified by the suite;
  the end-of-round handoff (Next / Abhyāsa · N due) closes the dead end it
  was built for. Between-track handoff is manual (a finished track offers
  only the review; nothing points at the next track) — *Low*.
- **Mobile/offline:** enforced by build (self-containment scan) and tests
  (360/375/390px walks, 44px targets, force-dark paint check).
- **Abhyāsa:** the one system carrying long-term retention; see C1/H2. Its
  framing (due-as-a-session, first-answer-only, no weighting toward misses
  with the trouble drill as the weighted counterpart) is coherent once the
  pool-ejection bug is fixed.

## Streamlining opportunities

- Remove `ds.last` (dead state) — or read it (e.g., "last 12/15" beside
  "best") if wanted; currently it is write-only.
- The three mastery-adjacent surfaces (drawer button, review window, track
  page) each restate the model in slightly different sentence forms; the
  wording is centralized enough (dueLabel) that no action is urgent.
- `dist/` demo accumulation (11 files, ~11 MB) is git-ignored and harmless;
  prune locally at will.
- No functionality found that is duplicated, disconnected, or superficial;
  the app's restraint (no streak-fire, no XP, two-state mastery) is a
  feature. Resist adding a third tier or confidence sliders — the fixes
  above close the gaps without new mechanics.

## Additional audits worth running

1. **Integrated review-loop tests** — the suite's one blind spot (C1
   evidence): drive miss→next-draw, replay-loophole, and same-day
   multi-draw scenarios through the UI grading path, not `recordReview`.
2. **Vocab-bank drift** — the 60-odd `V` decks are described as generated
   from `vocab/*.md`, but no build or test ties them to their sources the
   way Stage 5 forms and Paryāya sets are re-derived. A one-time
   reconciliation script (and ideally a test) would close the last
   unverified content pipeline.
3. After C1/H1–H3 land: a short longitudinal replay (simulated learner over
   ~30 sessions) to confirm interval/coverage dynamics at scale — cheap to
   script against the real page.

## Priorities

| # | Finding | Priority | Effort | Area |
|---|---------|----------|--------|------|
| C1 | Review miss ejects card from review pool; promise inverted | **Critical** | small | pedagogy/engineering |
| H1 | Replay rounds grant mastery moments after answer shown | High | small | pedagogy/engineering |
| H2 | Session-counted spacing; "retained" attainable in one sitting | High | small | pedagogy |
| H3 | Choice-card guessing counts as cold recall | High | medium | pedagogy |
| H4 | Production direction never scheduled; mastery direction-blind | High | medium | pedagogy |
| H5 | Guided path fronts 609 vocab cards before any grammar | High | medium | pedagogy/UX |
| M1 | Stage 5/6: production forced above recognition tables by order rule | Medium | medium | content/pedagogy |
| M2 | Alaṅkāra/Rasa bounded identification sections uncarded | Medium | small | content |
| M3 | Trouble-clear "sitting" = page load (long-lived tab never clears) | Medium | small | engineering |
| M4 | Lifetime review-accuracy average never reflects current ability | Medium | small | pedagogy |
| M5 | Scoreboard "lists completed" ≠ drawer "lists complete" | Medium | small | UX |
| L1 | Trouble drill uncapped round size | Low | small | UX |
| L2 | REST ceiling ~320-card pacing capacity at course scale | Low | medium | engineering |
| L3 | `ds.last` dead state; distractor-choice signal discarded | Low | small | data |
| L4 | Prārthanā deck option reuse enables elimination | Low | small | content |
| L5 | No between-track handoff; mid-round refresh loses round | Low | small | UX |

No changes were made to the application in this audit.
