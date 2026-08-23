/* Practice data lives in the <script id="practice" type="application/json">
   block above, inlined by scripts/build.js from every lesson's practice.json.
   Its shape:

     { "lessons": [
         { "lesson": "06-kriya", "stage": 6,
           "decks": [ { "name": "...", "cards": [ … ] } ] } ] }

   Lessons arrive already ordered by curriculum directory, so deck order in
   the picker is the curriculum's own order — the build owns that, not this
   file.  A card carries a stable `id`; every other field is presentation.
   Cards with no `type` are `reveal`, which is what every migrated card is. */
const CARD_TYPES = ["reveal", "choice", "sequence"];

const [DECKS, DECK_STAGE, DECK_LESSON, LESSON_LABEL, LESSON_GLOSS, DECK_PAIR, DECK_ROLE, PARSE] = (() => {
  const decks = {}, stages = {}, lessons = {}, labels = {}, glosses = {}, pairs = {},
        /* "terms": the list teaches the vocabulary a later list assumes, so it
           leads its lesson.  Nothing else reads this; it is the progression
           written down where the progression lives. */
        roles = {}, skipped = [];
  const fail = why => [decks, stages, lessons, labels, glosses, pairs, roles,
                       { count: 0, decks: 0, skipped, fatal: why }];

  const src = document.getElementById('practice');
  if (!src) return fail("the <script id=\"practice\"> block is missing");

  let data;
  try { data = JSON.parse(src.textContent); }
  catch (e) { return fail("the practice block is not valid JSON: " + e.message); }

  (data.lessons || []).forEach(L => {
    labels[L.lesson] = L.label || L.lesson;
    glosses[L.lesson] = L.gloss || '';
    (L.decks || []).forEach(d => {
      if (!d.name || !Array.isArray(d.cards) || !d.cards.length) return;
      const cards = d.cards.filter(c => {
        // The build validates far more strictly; this is the last line of
        // defence so one bad card cannot blank the whole page.
        const why = !c.id ? "no id"
          : c.type && !CARD_TYPES.includes(c.type) ? "unknown type " + c.type
          : !c.devanagari && !c.front ? "nothing to show"
          : null;
        if (why) { skipped.push({ id: c.id || "(none)", why, deck: d.name }); return false; }
        return true;
      });
      if (!cards.length) return;
      decks[d.name] = cards;
      stages[d.name] = L.stage;
      lessons[d.name] = L.lesson;
      if (d.pair) pairs[d.name] = d.pair;
      if (d.role) roles[d.name] = d.role;
    });
  });

  const count = Object.values(decks).reduce((a, b) => a + b.length, 0);
  return [decks, stages, lessons, labels, glosses, pairs, roles,
          { count, decks: Object.keys(decks).length, skipped }];
})();

/* Which list a card came from.  Card objects are made once, per line, so
   object identity is a safe key — and the mixed review needs it to say
   where a missed card came from once the decks are shuffled together. */
const DECK_OF = new Map();
Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => DECK_OF.set(c, n)));

/* ── state ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* the mixed review: a random draw across every list already finished.
   MIX is the picker value it hides behind — \u00a6 cannot occur in a deck
   header, so it can never collide with a real name. */
const MIX = '\u00a6mix';
const TROUBLE = '\u00a6trouble';
const REVIEW_SIZE = 20;
/* Below this many distinct cards to draw from, a "random" draw is most of
   the pool and proves nothing.  The button stays on show regardless,
   counting up — a feature nobody can see is a feature nobody uses. */
const REVIEW_MIN = 40;

let queue = [];        // cards still to be shown this round
let missed = [];       // cards answered "didn't know" this round
let learned = 0;       // cards retired
let current = null;
let roundSource = null; // the card set this round was built from
let reviewing = false;  // true when the round is a replay of missed cards only
let lastRound = null;   // the round just finished, for the share summary
let deckName = null;    // the list the current round belongs to
let mixed = false;      // true when the round draws across lists, not from one
let trouble = false;    // true when that cross-list round is a trouble drill
let clearedAt = 0;      // the cleared tally as the round began, for the delta

/* remembered across visits: last deck, direction, per-deck best score and
   missed pile.  localStorage may be absent or full — every touch is guarded. */
const STORE_KEY = 'abhyāsaḥ';
/* every name this page has carried, newest first — progress is lifted out
   of the first one still holding it, so a rename never costs a streak */
const OLD_KEYS = ['smṛtiḥ', 'śabdakośa'];
const SAVED = (() => {
  try {
    const cur = localStorage.getItem(STORE_KEY);
    if (cur) return JSON.parse(cur) || {};
    for (const k of OLD_KEYS) {
      const old = localStorage.getItem(k);
      if (!old) continue;
      localStorage.setItem(STORE_KEY, old);
      localStorage.removeItem(k);
      return JSON.parse(old) || {};
    }
    return {};
  } catch (e) { return {}; }
})();
SAVED.decks = SAVED.decks || {};

/* Deck names key SAVED.decks, so renaming one would silently drop its best
   score and its missed pile.  Every rename this app has made is listed here
   and applied once, the same way OLD_KEYS rescues state from an earlier
   storage key.  Never rename a deck without adding a line here. */
const DECK_RENAMES = {
  'Rūpa practice — case and form':               'Practice — case and form',
  /* Both of these targets were later split into chunks of 25 cards or fewer,
     so the score this rescues now names a deck that no longer exists and sits
     inert.  The entries stay: they are the record of what was renamed, and a
     split has no single successor to carry a score onto — see below. */
  'V21 · Deity vibhakti — the eight baseplates': 'Table mastery — the eight baseplates',
  'Kriyā practice — person, tense and mood':     'Practice — person, tense and mood',
  /* The sentence-order sequence decks were removed, not renamed: handing the
     learner every correct word and asking only for the workbook's arrangement
     tested nothing that can be graded honestly. Their scores are deliberately
     left orphaned rather than carried onto different practice. */
  'Sandhi practice — joins and splits':          'Practice — joins and splits',
  'Guṇa practice — agreement':                   'Practice — agreement',
  'Kāraka practice — roles in a sentence':       'Practice — roles in a sentence',
  'Sambodhana practice — direct address':        'Practice — direct address',
  'Pratyāhāra practice — what each covers':      'Practice — pratyāhāras',
  /* The drawer showed this one as "Samāsa · Samāsa" — the lesson's name
     twice, saying nothing about what the list asks for. */
  '14 · Samāsa — compound types':                '14 · Form compounds — the six types',
  /* Rūpa production was reduced from every cell to every distinct form, with
     delta and transfer checks where the source derives one table from
     another, so each of these lists names a smaller count than it did. The
     drill and the stem are unchanged, so the score carries over — `ds.best`
     is compared as a ratio. */
  'Form mastery · Śiva — all 24 cells':         'Form mastery · Śiva — all 17 forms',
  'Form mastery · Phala — all 24 cells':        'Form mastery · Phala — 4 key forms',
  'Form mastery · Mālā — all 21 cells':         'Form mastery · Mālā — all 14 forms',
  'Form mastery · Devī — all 21 cells':         'Form mastery · Devī — all 15 forms',
  'Form mastery · Agni — all 21 cells':         'Form mastery · Agni — all 15 forms',
  'Form mastery · Viṣṇu — all 21 cells':        'Form mastery · Viṣṇu — 7 key forms',
  'Form mastery · Pitṛ — all 21 cells':         'Form mastery · Pitṛ — all 15 forms',
  'Form mastery · Bhagavat — all 21 cells':     'Form mastery · Bhagavat — all 14 forms',
  'Form mastery · Asmad — the first person':    'Form mastery · Asmad — all 17 forms',
  'Form mastery · Yuṣmad — the second person':  'Form mastery · Yuṣmad — all 17 forms',
  'Form mastery · Saḥ — tad, masculine':        'Form mastery · Saḥ — all 16 forms',
  'Form mastery · Sā — tad, feminine':          'Form mastery · Sā — all 14 forms',
  'Form mastery · Tat — tad, neuter':           'Form mastery · Tat — 3 key forms',
  'Samāsa practice — name the compound':         'Practice — name the compound',
  'Suffix practice — kṛt and taddhita':          'Practice — kṛt and taddhita',
  'Chandas practice — scan and name':            'Practice — scan and name',
  'Vṛtta practice — name the metre':             'Practice — name the metre',
  /* "Practice" led every one of these, which told a learner nothing: the word
     is not used consistently enough across the lessons to mean anything on its
     own, and it buried the skill the list actually drills.  The skill leads
     now and "practice" is the descriptor.  Applied in order, so a deck renamed
     twice still finds its way — these run after the entries above. */
  'Practice — pratyāhāras':                        'Pratyāhāras — practice',
  'Practice · joins — combine the two words':      'Joins — practice, combine the two words',
  'Practice · splits & rules — take apart and name': 'Splits & rules — practice, take apart and name',
  'Practice — agreement':                          'Agreement — practice',
  'Practice — case and form':                      'Case and form — practice',
  'Practice — person, tense and mood':             'Person, tense and mood — practice',
  'Practice — roles in a sentence':                'Roles in a sentence — practice',
  'Practice — direct address':                     'Direct address — practice',
  'Practice — kṛt and taddhita':                   'Kṛt and taddhita — practice',
  'Practice — name the compound':                  'Name the compound — practice',
  'Practice — case, form and connector':           'Case, form and connector — practice',
  /* Split straight after this rename into Scan / Name the gaṇa, one skill
     each, so this target no longer exists either — see the split note above. */
  'Practice — scan and name':                      'Scan and name — practice',
  'Practice — name the metre':                     'Name the metre — practice',

  /* One naming rule for every list: a Sanskrit head, the English in the
     descriptor.  121 lists were renamed in that pass; each keeps its score
     because the drill behind it did not change. */
  '14 · Form compounds — the six types':                '14 · Racanā — form the compound · the six types',
  'Agreement — practice':                               'Viśeṣaṇa — adjective agreement · practice',
  'Case and form — practice':                           'Vibhakti-rūpa — recognise and produce · practice',
  'Case as relation — the seven stances':               'Sambandha — case as relation · the seven stances',
  'Case, form and connector — practice':                'Vākya-pūraṇa — case, form and connector · practice',
  'Conjugation mastery · √bhū — laṭ, all 9 forms':      'Dhātu-rūpa · √bhū — laṭ, all 9 forms',
  'Conjugation mastery · √nam — laṭ, all 9 forms':      'Dhātu-rūpa · √nam — laṭ, all 9 forms',
  'Conjugation mastery · √pūj — laṭ, all 9 forms':      'Dhātu-rūpa · √pūj — laṭ, all 9 forms',
  'Derivation — order the stages':                      'Prakriyā — order the stages · practice',
  'Direct address — practice':                          'Āmantraṇa — form the vocative · practice',
  'Form mastery · Agni — all 15 forms':                 'Rūpa-siddhi · Agni — all 15 forms',
  'Form mastery · Asmad — all 17 forms':                'Rūpa-siddhi · Asmad — all 17 forms',
  'Form mastery · Bhagavat — all 14 forms':             'Rūpa-siddhi · Bhagavat — all 14 forms',
  'Form mastery · Devī — all 15 forms':                 'Rūpa-siddhi · Devī — all 15 forms',
  'Form mastery · Mālā — all 14 forms':                 'Rūpa-siddhi · Mālā — all 14 forms',
  'Form mastery · Phala — 4 key forms':                 'Rūpa-siddhi · Phala — 4 key forms',
  'Form mastery · Pitṛ — all 15 forms':                 'Rūpa-siddhi · Pitṛ — all 15 forms',
  'Form mastery · Saḥ — all 16 forms':                  'Rūpa-siddhi · Saḥ — all 16 forms',
  'Form mastery · Sā — all 14 forms':                   'Rūpa-siddhi · Sā — all 14 forms',
  'Form mastery · Tat — 3 key forms':                   'Rūpa-siddhi · Tat — 3 key forms',
  'Form mastery · Viṣṇu — 7 key forms':                 'Rūpa-siddhi · Viṣṇu — 7 key forms',
  'Form mastery · Yuṣmad — all 17 forms':               'Rūpa-siddhi · Yuṣmad — all 17 forms',
  'Form mastery · Śiva — all 17 forms':                 'Rūpa-siddhi · Śiva — all 17 forms',
  'Joins — practice, combine the two words':            'Saṃyoga — combine the two words · practice',
  'Name the compound — practice':                       'Samāsa-bheda — name the type · practice',
  'Name the gaṇa — practice, the eight feet':           'Gaṇa-nāma — name the foot · practice',
  'Name the vibhakti — practice':                       'Vibhakti-jñāna — name the case a line turns on · practice',
  'Person, tense and mood — practice':                  'Puruṣa-lakāra — person, tense and mood · practice',
  'Pratyāhāras — practice':                             'Pratyāhāra-vistāra — expand and test membership · practice',
  'Roles in a sentence — practice':                     'Kāraka-vicāra — roles in a sentence · practice',
  'Scan — practice, syllable weight':                   'Mātrā — scan the syllables · practice',
  'Set membership — practice':                          'Paryāya-varga — which set is whole · practice',
  'Splits & rules — practice, take apart and name':     'Viccheda — take apart and name · practice',
  'Spot the intruder — practice':                       'Bhinna-pada — which name does not belong · practice',
  'Table mastery · Bhagavat — at-stem, all 24 cells':   'Śabda-rūpa · Bhagavat — at-stem, all 24 cells',
  'Table mastery · Durgā — ā-stem, all 24 cells':       'Śabda-rūpa · Durgā — ā-stem, all 24 cells',
  'Table mastery · Hari — i-stem, all 24 cells':        'Śabda-rūpa · Hari — i-stem, all 24 cells',
  'Table mastery · Lakṣmī — ī-stem, all 24 cells':      'Śabda-rūpa · Lakṣmī — ī-stem, all 24 cells',
  'Table mastery · Mātṛ — ṛ-stem, all 24 cells':        'Śabda-rūpa · Mātṛ — ṛ-stem, all 24 cells',
  'Table mastery · Pitṛ — ṛ-stem, all 24 cells':        'Śabda-rūpa · Pitṛ — ṛ-stem, all 24 cells',
  'Table mastery · Rāma — a-stem, all 24 cells':        'Śabda-rūpa · Rāma — a-stem, all 24 cells',
  'Table mastery · Viṣṇu — u-stem, all 24 cells':       'Śabda-rūpa · Viṣṇu — u-stem, all 24 cells',
  'Table mastery · Ātman — an-stem, all 24 cells':      'Śabda-rūpa · Ātman — an-stem, all 24 cells',
  'V01 · Abiding forms I — DM 5 litany':                'V01 · Saṃsthitā I — the DM 5 litany',
  'V01 · Abiding forms II — DM 5 litany':               'V01 · Saṃsthitā II — the DM 5 litany',
  'V01 · Cosmic functions — creatrix and protectress':  'V01 · Pañca-kṛtya — creatrix and protectress · LS',
  'V01 · Goddess names I — the great names':            'V01 · Devī-nāma — the great names · LS',
  'V01 · Goddess names II — Kālī and Tantric forms':    'V01 · Kālī-nāma — Kālī and Tantric forms · LS',
  'V01 · Lalitā epithets — LS':                         'V01 · Lalitā — epithets · LS',
  'V01 · The all-pervading — sarva- epithets':          'V01 · Sarva-pada — the sarva- epithets · LS',
  'V01 · The eight Mātṛkās — the śaktis':               'V01 · Mātṛkā — the eight śaktis · LS',
  'V02 · Cosmic epithets — VS':                         'V02 · Viśva — cosmic epithets · VS',
  'V02 · Maker and orderer — VS':                       'V02 · Dharma — maker and orderer · VS',
  'V02 · Sages and celestials — DM':                    'V02 · Ṛṣi — sages and celestials · DM',
  'V02 · The devas — VS · DM':                          'V02 · Deva-gaṇa — the devas · VS · DM',
  'V02 · Viṣṇu names — VS':                             'V02 · Viṣṇu-nāma — the thousand names · VS',
  'V03 · Demon hosts and slayings — DM':                'V03 · Daitya-senā — hosts and slayings · DM',
  'V03 · Demon kinds — DM':                             'V03 · Asura — demon kinds · DM',
  'V03 · Named demons — DM':                            'V03 · Asura-nāma — named demons · DM',
  'V04 · Arrows and archery — DM':                      'V04 · Śara — arrows and archery · DM',
  'V04 · Emblems and instruments — DM':                 'V04 · Vādya — emblems and instruments · DM',
  'V04 · Weapons — DM':                                 'V04 · Śastra — weapons · DM',
  'V05 · Head and face — DM · LS':                      'V05 · Śiras — head and face · DM · LS',
  'V05 · Limbs and body — DM · LS':                     'V05 · Gātra — limbs and body · DM · LS',
  'V05 · Ornament and adornment — DM · LS':             'V05 · Ābharaṇa — ornament and adornment · DM · LS',
  'V06 · Directions and realms — DM · LS':              'V06 · Diś — directions and realms · DM · LS',
  'V06 · Earth, sky and waters — DM · LS':              'V06 · Pṛthivī — earth, sky and waters · DM · LS',
  'V06 · Fire, light and mountains — DM · LS':          'V06 · Tejas — fire, light and mountains · DM · LS',
  'V06 · Trees and flowers — DM · LS':                  'V06 · Vana — trees and flowers · DM · LS',
  'V07 · Battle and warriors — DM':                     'V07 · Yuddha — battle and warriors · DM',
  'V07 · Destruction — DM':                             'V07 · Saṃhāra — destruction · DM',
  'V07 · Rage and devouring — DM':                      'V07 · Garjana — rage and devouring · DM',
  'V07 · Verbs of striking — DM':                       'V07 · Prahāra — verbs of striking · DM',
  'V08 · Praise and recitation — DM · LS':              'V08 · Stuti — praise and recitation · DM · LS',
  'V08 · Saying and speech — DM · LS':                  'V08 · Vacana — saying and speech · DM · LS',
  'V08 · Sounds and cries — DM · LS':                   'V08 · Nāda — sounds and cries · DM · LS',
  'V08 · Speech formulae — DM':                         'V08 · Uvāca — speech formulae · DM',
  'V09 · Anger and fear — DM · LS':                     'V09 · Krodha — anger and fear · DM · LS',
  'V09 · Delusion and desire — DM · LS':                'V09 · Moha — delusion and desire · DM · LS',
  'V09 · Joy and sorrow — DM · LS':                     'V09 · Harṣa-śoka — joy and sorrow · DM · LS',
  'V09 · Virtues of the heart — LS':                    'V09 · Sad-guṇa — virtues of the heart · LS',
  'V10 · Giving, living and dying — DM':                'V10 · Dāna-grahaṇa — giving, living and dying · DM',
  'V10 · Motion and position — DM':                     'V10 · Gati — motion and position · DM',
  'V10 · Perception and speech — DM':                   'V10 · Jñāna — perception and speech · DM',
  'V10 · Protecting and dwelling — DM':                 'V10 · Rakṣaṇa — protecting and dwelling · DM',
  'V10 · Worship and pleasing — DM':                    'V10 · Pūjana — worship and pleasing · DM',
  'V11 · Beautiful and radiant — DM · LS':              'V11 · Sundara — beautiful and radiant · DM · LS',
  'V11 · Colours — DM · LS':                            'V11 · Varṇa — colours · DM · LS',
  'V11 · Fierce and terrible — DM':                     'V11 · Ugra — fierce and terrible · DM',
  'V11 · The negations — LS':                           'V11 · Niṣedha — the nir- epithets · LS',
  'V11 · Vast, pure and auspicious — LS':               'V11 · Mahat — vast, pure and auspicious · LS',
  'V12 · Fruits and grace — DM · LS':                   'V12 · Phala-śruti — fruits and grace · DM · LS',
  'V12 · Mantra and bīja — LS':                         'V12 · Bīja-mantra — mantra and bīja · LS',
  'V12 · Rites and observances — DM · LS':              'V12 · Arcana — rites and observances · DM · LS',
  'V12 · Texts and knowledge — LS':                     'V12 · Śāstra — texts and knowledge · LS',
  'V12 · Upacāra offerings — DM · LS':                  'V12 · Dravya — the upacāra offerings · DM · LS',
  'V13 · Brahman and māyā — LS · VS':                   'V13 · Brahman — brahman and māyā · LS · VS',
  'V13 · Guṇas and the five acts — LS':                 'V13 · Guṇa — the guṇas and the five acts · LS',
  'V13 · Knowledge and bondage — LS · VS':              'V13 · Jñāna-bandha — knowledge and bondage · LS · VS',
  'V13 · Śakti and Śrīvidyā — LS':                      'V13 · Śakti — śakti and Śrīvidyā · LS',
  'V14 · Beasts and birds — DM':                        'V14 · Paśu-pakṣin — beasts and birds · DM',
  'V14 · More creatures — DM':                          'V14 · Mṛga — more creatures · DM',
  'V14 · Mounts and chariots — DM · LS':                'V14 · Vāhana — mounts and chariots · DM · LS',
  'V15 · Particles and emphatics — DM':                 'V15 · Nipāta — particles and emphatics · DM',
  'V15 · Place adverbs — DM':                           'V15 · Deśa-avyaya — place adverbs · DM',
  'V15 · Questions and connectives — DM':               'V15 · Praśna — questions and connectives · DM',
  'V15 · Time adverbs — DM':                            'V15 · Kāla-avyaya — time adverbs · DM',
  'V16 · Feminine suffixes — LS':                       'V16 · Strī-pratyaya — feminine suffixes · LS',
  'V16 · Suffix forms — kṛt and taddhita':              'V16 · Pratyaya-rūpa — kṛt and taddhita forms',
  'V16 · Upasargas — the verbal prefixes':              'V16 · Upasarga — the verbal prefixes',
  'V17 · Avyayībhāva and address — LS':                 'V17 · Avyayībhāva — adverbial compounds · LS',
  'V18 · Refrains and colophons — DM · LS':             'V18 · Dhruva-pada — refrains and colophons · DM · LS',
  'V18 · Speech tags and fury — DM':                    'V18 · Uvāca — speech tags and fury · DM',
  'V19 · Numbers — DM':                                 'V19 · Saṅkhyā — numbers · DM',
  'V19 · Ordinals and multiples — DM':                  'V19 · Pūraṇa — ordinals and multiples · DM',
  'V19 · Place and seat — DM':                          'V19 · Sthāna — place and seat · DM',
  'V19 · Time — DM':                                    'V19 · Kāla — time · DM',
  'V20 · Offerings and abodes — LS':                    'V20 · Naivedya — offerings and abodes · LS',
  'V20 · Plants and fragrances — DM · LS':              'V20 · Oṣadhi — plants and fragrances · DM · LS',
  'V20 · Sacred objects — LS':                          'V20 · Divya-vastu — sacred objects · LS',
  'V20 · Sacred places and rivers — DM · LS':           'V20 · Tīrtha — sacred places and rivers · DM · LS',
  /* Stage 5's case list grew the number terms alongside the case terms, so
     it is no longer "the seven cases". */
  '11 · Vibhakti — the seven cases':             '11 · Vibhakti-vacana — case and number terms',
};
/* A SPLIT is not a rename and has no entry here.  When a long list is broken
   into chunks, no one chunk is the old deck, so its best score and missed pile
   are deliberately orphaned rather than carried onto practice they were not
   earned on.  Nothing else is lost: mastery and trouble history are keyed by
   card id, and every id survives a split untouched, so lesson and track
   percentages do not move at all. */
Object.entries(DECK_RENAMES).forEach(([from, to]) => {
  if (SAVED.decks[from] && !SAVED.decks[to]) SAVED.decks[to] = SAVED.decks[from];
  delete SAVED.decks[from];
  if (SAVED.deck === from) SAVED.deck = to;
});
SAVED.review = SAVED.review || { runs: 0, right: 0, seen: 0 };   // the review tally
/* Per-card review history: id -> [session it was last reviewed, how many
   sessions running it has come back right on the first try].  This is what
   lets a card rest after it is remembered and return sooner after a miss. */
SAVED.review.cards = SAVED.review.cards || {};
SAVED.trouble = SAVED.trouble || {};       // per-card history, keyed by card
SAVED.cleared = SAVED.cleared || 0;        // cards that have left the trouble list
SAVED.mastered = SAVED.mastered || {};     // card ids answered right on a cold showing
/* Stages whose introduction has been read: a stage's lists stay shut until
   the learner has been through what the stage is for and pressed Begin. */
SAVED.begun = SAVED.begun || {};
SAVED.awards = SAVED.awards || {};             // what has been completed, and when
SAVED.streak = SAVED.streak || { last: '', run: 0 };   // consecutive days practised
if (SAVED.guided === undefined) SAVED.guided = true;   // the two gates, on by default
if (SAVED.deck === MIX) delete SAVED.deck;      // the review is no longer a picker choice
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SAVED)); } catch (e) {}
}
/* A card's stable identity, assigned in practice.json and never derived from
   what the card happens to display.  Before ids existed the key was the
   visible text, so trouble history is lifted across once, below. */
const cardKey = c => c.id;
const deckState = name => SAVED.decks[name] = SAVED.decks[name] || {};

/* \u2500\u2500 saved-progress migration \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   v1 keyed trouble history by devanagari + '\u00a6' + gloss.  Rebuild that key
   for every card we now hold, and move the record onto the card's id.  Runs
   once; a record whose card no longer exists is left where it is rather than
   thrown away, in case a later build brings the card back.

   SAVED.decks is keyed by deck NAME, and deck names did not change in the
   migration, so per-deck best scores need no rescue. */
const SAVED_VERSION = 7;
if ((SAVED.v || 1) < 2) {
  let moved = 0;
  Object.values(DECKS).forEach(cards => cards.forEach(c => {
    if (!c.devanagari || !c.gloss) return;
    const old = c.devanagari + '\u00a6' + c.gloss;
    if (SAVED.trouble[old] && !SAVED.trouble[c.id]) {
      SAVED.trouble[c.id] = SAVED.trouble[old];
      delete SAVED.trouble[old];
      moved++;
    }
  }));
  SAVED.v = 2;                        // this step only — v3 runs below
  save();
  if (moved) console.info("abhy\u0101sa\u1e25: carried " + moved + " trouble records onto stable ids");
}

/* v3 introduced SAVED.mastered, and nothing before it recorded which cards
   came back cold — only how many did, in ds.best.  One case can be resolved
   exactly rather than guessed at: a deck whose best round was perfect had
   every one of its cards right on the first showing, and that is the mastery
   signal itself.  So those decks are seeded and no others.

   The size check matters.  A best score is compared as a ratio, so a perfect
   one may have been set on a smaller version of the deck; seeding from it
   would hand mastery to cards that were never in the round.  Anything
   partial, and anything set on a deck that has since changed size, starts
   from nothing — which is what an unrecorded card honestly is. */
if ((SAVED.v || 1) < 3) {
  let seeded = 0;
  Object.entries(DECKS).forEach(([name, cards]) => {
    const best = (SAVED.decks[name] || {}).best;
    if (!best || best[0] !== best[1] || best[1] !== cards.length) return;
    cards.forEach(c => { if (!SAVED.mastered[c.id]) { SAVED.mastered[c.id] = 1; seeded++; } });
  });
  SAVED.v = 3;                        // this step only — v4 runs below
  save();
  if (seeded) console.info("abhy\u0101sa\u1e25: seeded " + seeded + " mastered cards from perfect rounds");
}

/* v4 added the per-card review history that paces the draw.  There is
   nothing to recover: before it, only the running totals were kept, and no
   record survives of WHICH cards a past session showed.  So it starts empty,
   which makes every card due — the first session after upgrading draws from
   the whole pool, exactly as it did before, and pacing begins from there. */
if ((SAVED.v || 1) < 4) {
  SAVED.review.cards = SAVED.review.cards || {};
  SAVED.v = 4;                        // this step only — v5 runs below
  save();
}

/* ── trouble cards ─────────────────────────────────────────
   A card lands on the list after TROUBLE_WRONG wrong answers and leaves
   after TROUBLE_CLEAR right ones, each in a different session — three
   right answers in one sitting is recognition, not memory.  A wrong
   answer starts that count over: it is still trouble.

   Keyed by card rather than by card-in-a-list, so a word you keep losing
   is one problem however many lists happen to carry it. */
const TROUBLE_WRONG = 3, TROUBLE_CLEAR = 3;
const SESSION = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function markWrong(card) {
  const k = cardKey(card);
  const rec = SAVED.trouble[k] = SAVED.trouble[k] || { w: 0, r: 0, s: "" };
  rec.w++;
  rec.r = 0; rec.s = "";               // the run of clean recalls starts again
  save();
}

function markRight(card) {
  const k = cardKey(card), rec = SAVED.trouble[k];
  if (!rec || rec.w < TROUBLE_WRONG) return;   // only cards on the list count out
  if (rec.s === SESSION) return;               // one credit per session, however many rounds
  rec.s = SESSION;
  if (++rec.r >= TROUBLE_CLEAR) { delete SAVED.trouble[k]; SAVED.cleared++; }
  save();
}

/* The list itself: the worst first, one entry per distinct card. */
function troubleCards() {
  const out = [], seen = new Set();
  Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
    const k = cardKey(c), rec = SAVED.trouble[k];
    if (seen.has(k) || !rec || rec.w < TROUBLE_WRONG) return;
    seen.add(k);
    out.push(c);
  }));
  return out.sort((a, b) => SAVED.trouble[cardKey(b)].w - SAVED.trouble[cardKey(a)].w);
}

/* The lists every card of which has come back cold at least once.  Playing a
   list to the end used to be enough — `ds.best` exists at any score, so a
   list scored 0/15 counted as complete, entered the review and moved the
   mastery figure.  "Complete" now means what the word says. */
const finishedDecks = () => Object.keys(DECKS).filter(n => progressOf(DECK_IDS[n]).full);
/* Everything the review can draw on: one entry per distinct card that has
   been answered right on a first showing.  The same word can sit in more
   than one list, and meeting it twice would waste two of the twenty.

   The pool is cards rather than lists, which makes the whole model one
   sentence: get a card right cold, and Abhyāsa keeps it alive.  It also
   keeps the mode honest — there is no point testing what was never learnt,
   which is exactly what a list finished at 0/15 used to feed it. */
function reviewPool() {
  const seen = new Map();
  Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
    const k = cardKey(c);
    if (SAVED.mastered[k] && !seen.has(k)) seen.set(k, c);
  }));
  return [...seen.values()];
}
/* How many of those are due now.  `overdueBy` already paces the draw; this
   is the same test, counted rather than sorted, so the mode can say what is
   waiting instead of only saying what it is. */
const dueCount = () => reviewPool().filter(c => overdueBy(c) >= 0).length;
/* A session is twenty cards, so a pool of 920 waiting is not news the learner
   can act on — every card that has never been reviewed is due at once, which
   on a first pass is all of them.  Past a full draw the figure stops counting
   and says there is a session there. */
const dueLabel = n => (n > REVIEW_SIZE ? REVIEW_SIZE + '+' : n) + ' due';

/* ── mastery ───────────────────────────────────────
   A card is mastered once it has come back right on its FIRST showing in a
   round — the same cold-recall signal a deck's best score is built from, and
   the same one that counts a card out of the trouble list.  A wrong answer
   takes it back: a percentage that could only ever rise would leave a lesson
   ticked long after it had gone, which is not what a tick is for.

   Every kind of round feeds this, review draws and trouble drills included.
   Whether a card came back cold is a fact about the card, not about which
   round it happened to turn up in. */
function markMastered(card) {
  const k = cardKey(card);
  if (SAVED.mastered[k]) return;
  SAVED.mastered[k] = 1; save();
}
function unmarkMastered(card) {
  const k = cardKey(card);
  if (!SAVED.mastered[k]) return;
  delete SAVED.mastered[k]; save();
}

/* ── how strongly a card is held ───────────────────────────
   A faultless run says the card can be produced minutes after being taught.
   It does not say it will be there next week, and that is what the review
   already measures: `SAVED.review.cards[id]` keeps, per card, how many
   consecutive Abhyāsa sessions it has come back right on the first try.

   So two strengths, and no new stored state for either:

     learned    right on a first showing at least once  (SAVED.mastered)
     retained   and right on the first try in RETAIN separate review
                sessions since, days apart, drawn out of its list

   A third tier was considered and cut: two states a learner can name are
   worth more than three they have to look up. */
const RETAIN = 2;
/* The per-card history, always a map: a store written before v4, or one a
   test has replaced wholesale, has no `cards` at all, and three separate
   readers would each have to remember that. */
const reviewCards = () => (SAVED.review.cards = SAVED.review.cards || {});
const streakOf = k => (reviewCards()[k] || [0, 0])[1];
const isRetained = k => !!SAVED.mastered[k] && streakOf(k) >= RETAIN;
const countIn = (ids, test) => { let n = 0; ids.forEach(k => { if (test(k)) n++; }); return n; };
const allRetained = ids => ids.size > 0 && countIn(ids, isRetained) === ids.size;

/* ── the five course tracks ─────────────────────────────
   The curriculum's own shape, one level above the numbered lessons.  A stage
   belongs to exactly one track, and the drawer is built from this table and
   nothing else, so the navigation cannot drift from the curriculum.

   Each track is named as the lessons are: the Sanskrit in IAST, with the
   English as its gloss.  Stage ranges are deliberately not among the fields
   — which directory numbers a track spans is how this repository is laid
   out, not something a learner has any use for.

   Pūjā-Vāk, Svara-Vidyā and Avadhāna are the curriculum's own names.
   Bhāṣā-Vidyā and Kāvya-Racanā are not: nothing in the repository names
   those two groupings, so they were coined here to match. Rename them
   freely — this table is the only place either appears.

   Stage 20 is the one place the source diagram is ambiguous: Svara-Vidyā is
   drawn as a track in its own right, yet the poetic track's range is written
   "18–26", which contains it.  Stage 17 is carved out of its neighbouring
   range in exactly the same way, and there it is unambiguous because
   "14–16, 18–26" simply skips it.  Reading 20 the same way — a named track
   lifted out of the range around it — is what the diagram means, so it is
   excluded from the poetic track here rather than counted twice. */
/* ── the five tracks, and what each of them is for ──────────
   A track is the app's own grouping, not a curriculum object, so its prose
   lives here beside its definition rather than in a lesson's practice.json.
   Each carries what the introduction page shows: a lead, the plan, one
   optional aside, and the two couplings that keep the prose honest —
   `lessons` is what the track should hold, and `mentions` the lesson names
   the plan leans on.  A test fails when either goes stale, because prose
   does not rewrite itself when a stage is added or renamed. */
const TRACKS = [
  { id: 'bhasha',   name: 'Bhāṣā-Vidyā',  gloss: 'Language Acquisition',
    has: s => s >= 1 && s <= 13,
    lead: 'This is the track that teaches you to read. You start with words — the '
        + 'names of the divine, the things on an altar, the parts of a day — and '
        + 'end able to assemble a Sanskrit sentence of your own and follow one you '
        + 'have never seen. Nothing here assumes you already know grammar: every '
        + 'term is taught before it is used.',
    plan: [
      'Words first. Nāma gives you several hundred of them, and Varṇa-Vidyā the '
      + 'order the alphabet is really in — by where in the mouth each sound is made.',
      'Then the two things that change a word\u2019s shape. Sandhi is what happens '
      + 'where words touch; Rūpa is the eight cases that say what a word is doing '
      + 'in its sentence. Rūpa is the big one, and the one that unlocks reading.',
      'Kriyā and Dhātu do the same for verbs — person and number marked on the '
      + 'verb itself, and the one-syllable roots underneath almost every word.',
      'Kāraka, Samāsa and Vākya put it to work: the part a word plays in an '
      + 'action, how two words weld into one, and finally sentences of your own.',
    ],
    note: 'Nothing here has to be finished before the next thing makes sense. A '
        + 'list is a sitting of a dozen or two cards, and what slips comes back on '
        + 'its own in later rounds.',
    mentions: ['Nāma', 'Varṇa-Vidyā', 'Sandhi', 'Rūpa', 'Kriyā', 'Dhātu',
               'Kāraka', 'Samāsa', 'Vākya'],
    lessons: 13 },

  { id: 'kavya',    name: 'Kāvya-Racanā', gloss: 'Poetic Composition',
    has: s => (s >= 14 && s <= 16) || (s >= 18 && s <= 26 && s !== 20),
    lead: 'Here the language you have becomes something you make. Praise first — '
        + 'the shapes devotional poetry actually uses — then metre, then the '
        + 'figures and flavours that separate a correct verse from a good one.',
    plan: [
      'Stotra I and Stotra II are composition in one case and then in all of '
      + 'them: “I bow to X” is most of a genre, and each vibhakti gives a '
      + 'different relation to the deity.',
      'Chandas I teaches you to hear a syllable as light or heavy. Chandas II '
      + 'gives you the śloka, which most Sanskrit verse is written in, and '
      + 'Chandas III the fixed metres, where every syllable\u2019s weight is set.',
      'Alaṅkāra and Rasa name what makes a verse land — simile, repeated sound, '
      + 'the flavour a piece leaves — and Darśana gives the philosophical '
      + 'vocabulary those verses lean on.',
    ],
    note: 'The composing itself belongs to the workbook, where a good verse can be '
        + 'read as one however you have written it. These lists give you the '
        + 'bounded things worth knowing by heart first.',
    mentions: ['Stotra I', 'Stotra II', 'Chandas I', 'Chandas II', 'Chandas III',
               'Alaṅkāra', 'Rasa', 'Darśana'],
    lessons: 8 },

  { id: 'puja',     name: 'Pūjā-Vāk',     gloss: 'Ritual Literacy',
    has: s => s === 17,
    lead: 'Ritual Sanskrit is not simply prayers said in Sanskrit. It is a precise '
        + 'vocabulary in which the grammar, the mantra and the physical act line '
        + 'up — and this track gives you that vocabulary.',
    plan: [
      'Upacāra names the ritual acts, Aṅga the body and its placements, and '
      + 'Saṅkalpa-vāk the formulae that declare an intention.',
      'Then the wider bank: ornament and offering, rites, mantra and bīja, the '
      + 'texts, and the fruits of practice.',
    ],
    note: 'One stage, eleven lists. Take them in any order — each is a field of '
        + 'its own, and none depends on the one before it.',
    mentions: ['Upacāra', 'Aṅga', 'Saṅkalpa-vāk'],
    lessons: 1 },

  { id: 'svara',    name: 'Svara-Vidyā',  gloss: 'Vedic Literacy',
    has: s => s === 20,
    lead: 'Vedic recitation carries pitch as well as sound. Three accents, marked '
        + 'in the text itself, are what distinguish Vedic from classical Sanskrit '
        + '— and they change what a line means.',
    plan: [
      'One list: Svara, giving the three accents, the modes of recitation and the '
      + 'terms that describe them.',
    ],
    note: 'Classical Sanskrit — everything else in Abhyāsa — does not use these '
        + 'accents. This is a door into a different kind of text, not a '
        + 'prerequisite for anything else.',
    mentions: ['Svara'],
    lessons: 1 },

  { id: 'avadhana', name: 'Avadhāna',     gloss: 'Attention Under Pressure',
    has: s => s >= 27 && s <= 36,
    lead: 'Avadhāna is composition under constraint, performed live: a verse '
        + 'completed from its last line, or built round words handed to you by '
        + 'someone trying to break your concentration.',
    plan: [
      'One list to start: the vocabulary of the discipline — the eight challenges, '
      + 'and the roles in a performance.',
    ],
    note: 'The performing is the badge, and it belongs to the workbook. What is '
        + 'carded here is what you need to be able to name before you try it.',
    mentions: ['Avadhāna'],
    lessons: 1 },
];
/* Cross-cutting practice sits outside the stage sequence, so it is not a
   sixth track: it is listed after the five, and belongs to no track's
   percentage.  The five are the course; this is what runs alongside it. */
const CROSS_TRACK = {
  id: 'vyakaranam', name: 'Vyākaraṇam', gloss: 'Formal Grammar',
  lead: 'Vyākaraṇam is the grammarians\u2019 own vocabulary — the words Sanskrit '
      + 'uses to talk about itself. It cuts across every stage rather than '
      + 'belonging to one, which is why it sits apart at the end of the list.',
  plan: [
    'Vyākaraṇam I gives the building blocks: root, suffix, prefix, stem, junction.',
    'Vyākaraṇam II gives the words for what a sentence is made of, and the terms '
    + 'grammarians use about their own terms.',
    'Take these whenever a word in a red annotation is doing more work than you '
    + 'can follow. Nothing else depends on them.',
  ],
  note: 'This is not a track and it is not required. It is the shortest way to '
      + 'make the annotations on every other card readable.',
  mentions: ['Vyākaraṇam I', 'Vyākaraṇam II'],
  lessons: 1,
};
const trackOf = stage => TRACKS.find(t => t.has(stage)) || CROSS_TRACK;

/* Lessons in curriculum order — the order the build handed the decks over —
   each carrying its decks and the distinct cards they hold. */
const DECK_IDS = {};
Object.keys(DECKS).forEach(n => { DECK_IDS[n] = new Set(DECKS[n].map(cardKey)); });

const LESSONS = (() => {
  const by = new Map();
  Object.keys(DECKS).forEach(name => {
    const key = DECK_LESSON[name];
    if (!by.has(key)) by.set(key, {
      lesson: key, stage: DECK_STAGE[name],
      label: LESSON_LABEL[key] || key, decks: [], ids: new Set()
    });
    const L = by.get(key);
    L.decks.push(name);
    DECK_IDS[name].forEach(k => L.ids.add(k));
  });
  return [...by.values()];
})();

/* The drawer's spine: each track that has any practice at all, with its
   lessons and the union of their cards.  A track with no practice yet is
   left out rather than shown as an empty 0% — the drawer navigates what
   exists. */
const TRACK_ROWS = (() => {
  const rows = [];
  [...TRACKS, CROSS_TRACK].forEach(track => {
    const lessons = LESSONS.filter(L => trackOf(L.stage) === track);
    if (!lessons.length) return;
    const ids = new Set();
    lessons.forEach(L => L.ids.forEach(k => ids.add(k)));
    rows.push({ track, lessons, ids });
  });
  return rows;
})();
const ALL_IDS = (() => {
  const s = new Set();
  TRACK_ROWS.forEach(r => r.ids.forEach(k => s.add(k)));
  return s;
})();

/* ── the gate ──────────────────────────────────────────────
   Each level says what it is for before the level under it opens.  The
   landing card opens the tracks; a track's own page opens its lists.  Two
   pages, and nothing under them: a stage is not a place you have to be
   introduced to twice.

   `SAVED.begun` holds what has been opened — `home`, and a track id for each
   track whose Begin has been pressed. */
const trackIdOf = name => trackOf(DECK_STAGE[name]).id;
/* Guided order off opens everything at once: nothing to press through when
   the point is to reach a particular list — checking a change, or testing. */
const trackBegun = id => !SAVED.guided || !!SAVED.begun[id];
const deckLocked = name => !trackBegun(trackIdOf(name));
const started = () => !SAVED.guided || !!SAVED.begun.home;

function beginHome() {
  if (SAVED.begun.home) return;
  SAVED.begun.home = 1;
  save();
  renderDrawer();
}
function beginTrack(id) {
  if (SAVED.begun[id] && SAVED.begun.home) return;
  SAVED.begun[id] = 1;
  SAVED.begun.home = 1;             // you cannot be inside a track without
  save();
  renderDrawer();                   // its lists are open now, and the drawer says so
}

/* v5 kept this by lesson, when every stage had a page of its own.  The gate
   is a track's now, so those keys are lifted onto their tracks rather than
   thrown away — and the seed from progress runs again in the same terms: a
   learner already practising in a track has plainly met it. */
if ((SAVED.v || 1) < 6) {
  const lift = id => { SAVED.begun[id] = 1; SAVED.begun.home = 1; };
  Object.keys(SAVED.begun).forEach(k => {
    const L = LESSONS.find(x => x.lesson === k);
    if (!L) return;
    delete SAVED.begun[k];
    lift(trackOf(L.stage).id);
  });
  Object.keys(DECKS).forEach(n => {
    const ds = SAVED.decks[n];
    if ((ds && (ds.best || ds.missed)) || DECKS[n].some(c => SAVED.mastered[c.id]))
      lift(trackIdOf(n));
  });
  if (SAVED.deck && DECKS[SAVED.deck]) lift(trackIdOf(SAVED.deck));
  SAVED.v = SAVED_VERSION;
  save();
}

/* Progress is mastered cards over cards held, counted from cards the whole
   way up: a track's figure is the union of its lessons' cards, never the
   average of their percentages — that would give a five-card lesson the same
   weight as a hundred-card one.

   Every card the app carries counts towards it.  What is here is curated
   practice plus the paradigm tables the badges ask for whole; reference
   material was never brought in, so there is nothing to filter out and
   nothing to dilute the figure. */
function progressOf(ids) {
  const total = ids.size;
  let done = 0;
  ids.forEach(k => { if (SAVED.mastered[k]) done++; });
  let pct = total ? Math.round(done / total * 100) : 0;
  /* Rounding must not hand out a tick's worth of progress that has not been
     earned, nor swallow the first card of a long list. */
  if (pct === 100 && done < total) pct = 99;
  if (pct === 0 && done > 0) pct = 1;
  return { done, total, pct, full: total > 0 && done === total };
}

/* ── what has been completed ───────────────────────────────
   Three levels, two states each, all derived from cards: a list, a stage and
   a track are complete when every card in them has come back cold, and
   retained when every card has held up in Abhyāsa as well.

   An award is kept once earned.  The drawer already shows what is true now;
   this is the record of what was done, which is the thing worth keeping. */
const today = () => new Date().toISOString().slice(0, 10);

function completable() {
  const out = [];
  Object.keys(DECKS).forEach(n => out.push(['list:' + n, DECK_SHORT(n), 'list', DECK_IDS[n]]));
  LESSONS.forEach(L => out.push(['stage:' + L.lesson, L.label, 'stage', L.ids]));
  TRACK_ROWS.forEach(r => out.push(['track:' + r.track.id, r.track.name, 'track', r.ids]));
  return out;
}

/* Everything true right now, as award keys.  `+` is the retained tier. */
function earnedNow() {
  const out = [];
  completable().forEach(([key, label, level, ids]) => {
    if (!ids.size) return;
    if (progressOf(ids).full) out.push({ key: key, label: label, level: level, tier: 'complete' });
    if (allRetained(ids)) out.push({ key: key + '+', label: label, level: level, tier: 'retained' });
  });
  return out;
}

/* Newly earned since the last round, stamped with the day so it is announced
   once and only once.  Biggest first: finishing a track is the news, not the
   list that happened to complete it. */
const AWARD_ORDER = { track: 0, stage: 1, list: 2 };
function claimAwards() {
  const fresh = earnedNow().filter(a => !SAVED.awards[a.key]);
  if (!fresh.length) return fresh;
  fresh.forEach(a => { SAVED.awards[a.key] = today(); });
  save();
  return fresh.sort((a, b) => AWARD_ORDER[a.level] - AWARD_ORDER[b.level]);
}

/* Days in a row with a round finished.  Not an achievement to chase past the
   point of use: one round counts, and the figure is the only reward. */
function bumpStreak() {
  const now = today(), st = SAVED.streak;
  if (st.last === now) return;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  st.run = st.last === yesterday ? st.run + 1 : 1;
  st.last = now;
  save();
}

/* v7 adds all three.  The awards are seeded from what is already true, so a
   learner who upgrades mid-course is not handed a wall of announcements for
   work they finished weeks ago. */
if ((SAVED.v || 1) < 7) {
  earnedNow().forEach(a => { SAVED.awards[a.key] = SAVED.awards[a.key] || 'earlier'; });
  SAVED.v = SAVED_VERSION;
  save();
}

/* Two independent settings now:
     DIR  — which way round the card runs: 'reveal' (word → meaning)
            or 'produce' (meaning → word).  One button flips it.
     IAST — whether the transliteration is shown at all.  A checkbox.
   Migrate anyone carrying the old three-way mode: 'script' was
   really "word → meaning with the transliteration off". */
if (SAVED.mode && SAVED.dir === undefined) {
  SAVED.dir  = SAVED.mode === 'produce' ? 'produce' : 'reveal';
  SAVED.iast = SAVED.mode !== 'script';
  delete SAVED.mode;
  save();
}
let DIR  = SAVED.dir === 'produce' ? 'produce' : 'reveal';
let IAST = SAVED.iast !== false;

/* What a reveal card runs between.  Most lists are a word and its meaning,
   but plenty are not: a paradigm cell answers with an analysis, a sandhi rule
   with the result of a join, a gaṇa with its name.  Saying "word → meaning"
   over those was simply wrong, so each list can name its own pair in
   practice.json and both labels are read off that one string.

   A list with no reveal cards at all runs one way by construction — see
   setDirFor, which greys the button rather than labelling it falsely. */
const DEFAULT_PAIR = 'word \u2192 meaning';
const pairOf = name => DECK_PAIR[name] || DEFAULT_PAIR;
/* A cross-list draw has no single pair, so it falls back to the general one. */
const currentPair = () => (mixed || !deckName ? DEFAULT_PAIR : pairOf(deckName));

function dirLabel() {
  const half = currentPair().split(' \u2192 ');
  return DIR === 'produce' ? half[1] + ' \u2192 ' + half[0]
                           : half[0] + ' \u2192 ' + half[1];
}

/* The task cue.
   A reveal card shows an item and nothing else, so the operation being asked
   for lived only in the direction button under the card — and the same front
   can want quite different things: `ramaya` asks for an analysis in one list
   and a translation in another.  One line above the item names it.

   The cue is DECK-level and derived, not written on 2000 cards.  It keys off
   the pair's DESTINATION half — the thing the learner has to produce — so
   both directions fall out of the one table, and a list that already names
   its pair needs nothing added to it at all.

   Deliberately small: one entry per destination noun actually in use, with
   `meaning`, `definition` and `sense` sharing a cue because they ask for the
   same act of recall.  A pair naming a destination not in the table shows no
   cue, which is the right failure — better silent than wrong. */
const CUES = {
  meaning: 'Recall the meaning', definition: 'Recall the meaning',
  sense:   'Recall the meaning', word:      'Produce the word',
  analysis: 'Analyze the form',  form:      'Produce the form',
  metre:   'Identify the metre', pattern:   'Recall the pattern',
  'ga\u1e47a': 'Name the ga\u1e47a',
  compound: 'Form the compound', vigraha:   'Give the vigraha',
  parts:   'Split the compound', term:      'Name the term',
  result:  'Join them',          join:      'Split the join',
  root:    'Give the root',      affix:     'Give the affix',
  's\u016btra': 'Name the s\u016btra', sounds: 'List the sounds',
  line:    'Recall the line',    relation:  'Give the relation',
  vibhakti: 'Name the vibhakti'
};
/* The half the learner is being asked FOR, which is the back in the forward
   direction and the front in the reverse one. */
function cueText() {
  const half = currentPair().split(' \u2192 ');
  return CUES[DIR === 'produce' ? half[0] : half[1]] || '';
}

/* The IAST toggle hides a TRANSLITERATION.  A card whose front carries no
   Devanagari has none to hide: its second line is content in its own right.
   A gaṇa's "laghu guru guru" reads a pattern of marks, it does not
   transliterate one, and hiding it left the card with nothing but the marks.
   So the toggle governs a card only when there is Devanagari to transliterate,
   which is a fact about the card rather than about the list — the vṛtta deck
   holds twelve pattern cards and two ordinary headwords, and each behaves as
   what it is. */
const DEVANAGARI = /[\u0900-\u097F]/;
/* A card can hold two such pairs — its headword, and the optional `detail`
   line that stays on the answer side in both directions — and they need not
   agree.  A vṛtta card's front is a laghu/guru pattern with "19 syllables"
   beneath it, which is a second reading of the pattern rather than a
   transliteration of it; its answer is the metre's name in Devanagari over
   the gaṇa formula म · स · ज · स · त · त · ग, and *that* line's
   `ma · sa · ja · sa · ta · ta · ga` is a transliteration exactly. So the
   rule is applied per line: the toggle governs whichever pairs have
   Devanagari to transliterate, and leaves the others alone. */
const transliterates = c => DEVANAGARI.test(c.devanagari || '');
const detailTransliterates = c => DEVANAGARI.test(c.detail || '');
const hasIastToggle = c => transliterates(c) || detailTransliterates(c);
const showIast = c => IAST || !transliterates(c);
const showDetailIast = c => IAST || !detailTransliterates(c);

/* Both toggles are meaningless on an interactive card: a transformation runs
   one way, and the IAST there *is* the content rather than a gloss of it.
   They are greyed for as long as one is showing, and the direction button
   stops claiming a pair it cannot offer. */
function setToggles(dirOn, iastOn) {
  if (iastOn === undefined) iastOn = dirOn;
  $('dir').disabled = !dirOn;
  $('iast-on').disabled = !iastOn;
  $('dir-label').textContent = dirOn ? dirLabel() : 'one direction only';
  $('dir').setAttribute('aria-label', dirOn
    ? 'Direction: ' + dirLabel() + '. Tap to reverse.'
    : 'This list runs one way, so the direction cannot be reversed.');
  $('iast-on').title = iastOn ? ''
    : 'This card has no Devanagari, so its second line is content rather than '
      + 'a transliteration, and is always shown.';
}

function setDir(d) {
  DIR = d; SAVED.dir = d; save();
  document.body.classList.toggle('mode-produce', d === 'produce');
  setToggles(!$('dir').disabled);
  if (current) paint();
}

function setIast(on) {
  IAST = !!on; SAVED.iast = IAST; save();
  $('iast-on').checked = IAST;
  if (current) paint();
}

/* A deck's full name is its key — it keys DECKS and the saved per-deck
   progress — but it is too long to head a row on a phone.  The short form
   drops the leading number and the "— descriptor" tail, keeping the phrase
   before an "&" if it is still long.  The descriptor is not thrown away:
   DECK_DESC returns it, and the drawer prints it on the row's second line.

   Within a lesson this ordering is load-bearing.  DECK_SHORT displays the
   text before the em dash, which is what puts "Practice" above "Table
   mastery" and "Conjugation mastery" in the drawer. */
const DECK_DESC = name => {
  const m = name.match(/^.*?\s+—\s+(.*)$/);
  return m ? m[1] : "";
};
const DECK_SHORT = name => {
  /* The lesson optgroup now says which stage a deck belongs to, so the deck's
     own leading number is dropped from the display — it buys nothing and
     costs width on a phone.  The VALUE keeps it. */
  const m = name.match(/^((?:V?\d+|S)\s*·\s*)?(.*)$/);
  let t = m[2].split(/\s+—\s+/)[0];
  const room = 26;
  if (t.length > room && t.includes(" & ")) t = t.split(" & ")[0];
  if (t.length > room) t = t.slice(0, room).replace(/\s+\S*$/, "");
  t = t.replace(/[\s,&·—]+$/, "");
  return t || name;
};

/* ── the drawer ─────────────────────────────────────────
   Navigation is track → lesson → deck, opened from the button that names
   the list you are on.  A left drawer rather than a fixed sidebar: this page
   is used on a phone, where a permanent panel would eat the card.

   Everything below the mode buttons is rebuilt each time the drawer opens,
   because every percentage in it can have moved since it was last seen. */
const openTracks = new Set();
const openLessons = new Set();
const drawerOpen = () => !$('drawer').hidden;

const toggleIn = (set, key) => { set.has(key) ? set.delete(key) : set.add(key); };

function syncStudyUI() {
  $('study-btn').classList.toggle('on', panelOpen === 'study');
}

/* Study material: every loaded lesson's reference.md, rendered to HTML at
   build time and inlined here.  A reference VIEWER, not a second learning
   system — it holds no cards, tracks nothing and grades nothing.  Practice is
   retrieval, Study is lookup, the workbook is production and the badge is the
   demonstration; this keeps to its own job. */
const REFERENCES = (() => {
  const src = document.getElementById('references');
  if (!src) return {};
  try { return JSON.parse(src.textContent) || {}; }
  catch (e) { return {}; }
})();
/* A mixed or trouble round belongs to no one lesson, so there is nothing to
   look up and the button is not offered. */
const studyFor = () => (deckName && deckName !== MIX && deckName !== TROUBLE
  ? REFERENCES[DECK_LESSON[deckName]] : null) || null;

/* The button where the picker used to be, naming the list in play.  It
   carries the lesson as well as the deck: within a lesson the decks are
   called "Practice" and "Table mastery", so the deck name on its own would
   not say whose practice you are in. */
function syncNav() {
  const label = deckName ? LESSON_LABEL[DECK_LESSON[deckName]] : '';   // the lesson, in IAST
  $('nav-label').textContent =
      deckName === MIX     ? 'abhyāsa'
    : deckName === TROUBLE ? 'trouble cards'
    : deckName             ? [label, DECK_SHORT(deckName)].filter(Boolean).join(' \u00b7 ')
    :                        'lists';
  /* Hidden outright rather than greyed: a lesson with no reference.md has
     nothing behind the button, and a disabled control still takes the room
     the list name needs on a phone. */
  const ref = studyFor();
  $('study-btn').hidden = !ref;
  if (ref) $('study-btn').title =
    'Study \u00b7 ' + LESSON_LABEL[DECK_LESSON[deckName]] + ' reference';
}

function fillRow(el, parts) {
  Object.entries(parts).forEach(([sel, text]) => {
    const t = el.querySelector(sel);
    if (t) t.textContent = text;
  });
}
const setBar = (el, pct) => { const i = el.querySelector('.bar i'); if (i) i.style.width = pct + '%'; };

/* A level that has one child adds a step without adding information: a track
   with a single lesson repeats itself (Pūjā-Vāk inside Pūjā-Vāk), and a lesson
   with a single list is just that list wearing a second name.  Both are folded
   away here.

   Folded by what exists, never by a list of exceptions — so the level comes
   back on its own the moment a second lesson or a second list does, and the
   curriculum's own shape is still the only thing driving the drawer. */
const soleLesson = row => row.lessons.length === 1 ? row.lessons[0] : null;
const soleDeck   = L   => L.decks.length === 1 ? L.decks[0] : null;
/* A row that has folded a level away keeps that level's name: `inner` leads
   the subheading unless it merely repeats the name already on the row, in
   which case the row's own gloss stands in.  Nothing about the curriculum
   should be reachable only by knowing it used to be there. */
function foldedSub(inner, outer, fallback, rest) {
  const lead = inner && inner !== outer ? inner : fallback;
  return [lead].concat(rest).filter(Boolean).join(' · ');
}
const count = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

/* One row of the drawer.  `cls` is the level it is drawn at, so a list
   standing in for its lesson keeps the lesson's size and indent. */
function rowButton(cls, { name, pct, sub, full, on, bar, title }) {
  const b = document.createElement('button');
  b.className = (cls === 'dk' ? 'dk' : cls + '-head') + (on ? ' on' : '');
  b.innerHTML = `<span class="${cls}-name"></span><span class="${cls}-pct"></span>`
              + `<span class="${cls}-sub"></span>` + (bar ? '<span class="bar"><i></i></span>' : '');
  fillRow(b, { ['.' + cls + '-name']: name,
               ['.' + cls + '-pct']: full ? '✓' : pct + '%',
               ['.' + cls + '-sub']: sub });
  if (bar) setBar(b, pct);
  if (title) b.title = title;
  return b;
}

/* A list, drawn at whatever level it has been folded up to. */
function deckRow(name, cls) {
  cls = cls || 'dk';
  const p = progressOf(DECK_IDS[name]);
  const b = rowButton(cls, {
    name: DECK_SHORT(name), pct: p.pct, full: p.full,
    /* a shut list is not "where you are", whatever was loaded behind the
       landing card */
    on: name === deckName && !deckLocked(name),
    bar: cls !== 'dk', title: name,
    sub: [DECK_DESC(name), DECKS[name].length + ' cards',
          allRetained(DECK_IDS[name]) ? 'retained' : ''].filter(Boolean).join(' · ')
  });
  b.classList.add('leaf');
  /* Shut until the stage has been begun.  The learner meets the stage before
     its lists, so a list that has not been introduced is greyed rather than
     hidden — what is coming is visible, and one press opens all of it. */
  if (deckLocked(name)) {
    b.disabled = true;
    b.classList.add('locked');
    b.title = name + ' — begin ' + trackOf(DECK_STAGE[name]).name + ' to open it';
  } else b.addEventListener('click', () => chooseDeck(name));
  return b;
}

/* A lesson's row IS its stage page.  The stage says what it gives you before
   it asks anything, so the tap that used to expand a heading opens that page
   instead — and the page carries the lesson's lists, so nothing moved further
   away: track \u2192 stage \u2192 list is the same three taps expanding was. */
/* A track's row IS its page.  Tapping it says what the track gives you and,
   on a first visit, is the only thing that opens its lists; it leaves the
   track standing expanded for the way back. */
function trackRow(row, over) {
  const t = row.track, p = progressOf(row.ids);
  const b = rowButton('tr', Object.assign({
    name: t.name, pct: p.pct, full: p.full, bar: true,
    sub: t.gloss + ' · ' + count(row.lessons.length, 'lesson'),
  }, over || {}));
  b.classList.add('leaf');
  if (!started()) {
    /* Before the landing card has been read there is nowhere to go: it names
       the first track, and that is the way in. */
    b.disabled = true;
    b.classList.add('locked');
    b.title = t.name + ' — open Home and press Begin';
  } else b.addEventListener('click', () => {
    openTracks.add(t.id);           // its stages are there on the way back
    closeDrawer();
    showTrack(t.id);
  });
  return b;
}

function lessonRow(L) {
  const one = soleDeck(L);
  if (one) {
    /* The lesson IS that list — but the row still has to say which lesson.
       Folding may not silently delete a curriculum name: `Chandas II` read
       simply `Vṛtta`, and the drawer then had a Chandas I and no Chandas II. */
    const r = deckRow(one, 'ls');
    fillRow(r, { '.ls-name': L.label,
      '.ls-sub': foldedSub(DECK_SHORT(one), L.label, DECK_DESC(one),
                           [DECKS[one].length + ' cards']) });
    return r;
  }
  const p = progressOf(L.ids), open = openLessons.has(L.lesson);
  const wrap = document.createElement('div');
  wrap.className = 'ls' + (p.full ? ' full' : '');
  const head = rowButton('ls', {
    name: L.label, pct: p.pct, full: p.full, bar: true,
    sub: [LESSON_GLOSS[L.lesson], count(L.decks.length, 'list')].filter(Boolean).join(' · ')
  });
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  head.addEventListener('click', () => { toggleIn(openLessons, L.lesson); renderDrawer(); });
  wrap.appendChild(head);
  const body = document.createElement('div');
  body.className = 'ls-body';
  body.hidden = !open;
  L.decks.forEach(name => body.appendChild(deckRow(name)));
  wrap.appendChild(body);
  return wrap;
}

/* One line at the top of a track that has not been begun, saying what opens
   what is under it.  The lists below stay visible and greyed: a learner
   should see what is coming and still be told what it is for first. */
function shutNote(text) {
  const el = document.createElement('div');
  el.className = 'ls-shut';
  el.textContent = text;
  return el;
}

function renderDrawer() {
  const r = rankOf(), all = Object.keys(DECKS).length;
  /* Lists, not cards.  A card is the evidence underneath; a list is what a
     learner finishes, and it is the same act that puts the list into review —
     so one number carries the whole model. */
  const done = finishedDecks().length;
  const due = reviewPool().length >= REVIEW_MIN ? dueCount() : 0;
  fillRow(document, {
    /* the figure and its rank, and nothing else: what it is made of is on
       the card this button opens.  Beside the name, the one thing that
       changes on its own and is worth coming back for. */
    '#dp-label': due ? 'abhyāsa · ' + dueLabel(due) : 'abhyāsa',
    '#dp-pct': r.score === null ? 'Unranked' : r.score + '% \u00b7 ' + r.name,
    '#dp-cards': done + ' of ' + all
  });
  $('dp-bar').style.width = (r.score === null ? 0 : r.score) + '%';
  $('dp-lbar').style.width = (all ? done / all * 100 : 0) + '%';

  const host = $('dr-tracks');
  host.innerHTML = '';
  TRACK_ROWS.forEach(row => {
    const t = row.track, open = openTracks.has(t.id);
    const only = soleLesson(row);
    const wrap = document.createElement('div');
    wrap.className = 'tr' + (progressOf(row.ids).full ? ' full' : '');

    /* A track with a single lesson IS that lesson: naming both would say the
       same thing twice, so the row keeps the track's name and the lesson's
       goes in the subheading where it differs. */
    const head = trackRow(row, only ? {
      sub: foldedSub(only.label, t.name, t.gloss, [count(only.decks.length, 'list')]),
    } : null);
    if (started()) head.setAttribute('aria-expanded', open ? 'true' : 'false');
    wrap.appendChild(head);

    /* A menu of one is not a menu: a track that comes down to a single list
       has nothing to choose between, and the page's own Begin is the way to
       it.  Drawing the row would only repeat the name above it. */
    if (only && only.decks.length === 1) {
      head.removeAttribute('aria-expanded');
      host.appendChild(wrap);
      return;
    }
    const body = document.createElement('div');
    body.className = 'tr-body';
    body.hidden = !open;
    /* Say what actually opens them.  Before the landing card has been read
       the name above is shut too, and pointing at it would be a dead end. */
    if (!trackBegun(t.id))
      body.appendChild(shutNote(started()
        ? 'Tap the name above and press Begin to open these.'
        : 'Open Home and press Begin to start.'));
    /* one lesson: its lists stand directly under the track */
    if (only) only.decks.forEach(n => body.appendChild(deckRow(n)));
    else row.lessons.forEach(L => body.appendChild(lessonRow(L)));
    wrap.appendChild(body);
    host.appendChild(wrap);
  });
}

function openDrawer() {
  closePop();
  /* Land on where you are rather than on a wall of shut headings: the track
     and lesson holding the current list are opened on the way in. */
  const L = LESSONS.find(x => x.lesson === DECK_LESSON[deckName]);
  if (L) { openTracks.add(trackOf(L.stage).id); openLessons.add(L.lesson); }
  renderDrawer();
  relabelAll();
  $('dveil').hidden = false;
  $('drawer').hidden = false;
  $('nav').setAttribute('aria-expanded', 'true');
  $('dr-close').focus();
}

function closeDrawer(to) {
  if (drawerOpen()) {
    $('dveil').hidden = true;
    $('drawer').hidden = true;
    $('nav').setAttribute('aria-expanded', 'false');
  } else if (to !== 'card') return;
  /* Focus must not be left on a row that is now hidden.  It returns to the
     handle, except when a list was picked: there it goes to the card, so
     space flips it straight away instead of re-opening the drawer.  A list
     picked from the stage page leaves a hidden row behind just as the drawer
     does, and the drawer is already shut by then — hence the second arm. */
  $(to === 'card' ? 'card' : 'nav').focus();
}

/* Picking a list from the drawer, with the same guard the picker carried:
   a round that has been graded is not thrown away without asking. */
async function chooseDeck(name) {
  /* Already on this list — except while a page is up over the cards, where
     picking your current list is exactly how you leave it. */
  if (name === deckName && !mixed && !onPage()) { closeDrawer('card'); return; }
  if (roundInProgress()
      && !await ask('Leave this round? Your progress in it will be lost.', 'Leave it')) return;
  /* Load first, close second: closeDrawer('card') moves focus onto the card,
     and focus does not land on an element that is still display:none. */
  loadDeck(name);
  closeDrawer('card');
}

/* Review, trouble and the scoreboard all open from the drawer, which then
   gets out of the way. */
function openFromDrawer(fn) {
  closeDrawer();
  fn();
}

/* The row is live from the first load whether the mode is or not: a locked
   one opens the panel that says what it is and what unlocks it, exactly as
   the trouble row does with an empty list. */
function syncReviewUI() {
  $('dr-prog').classList.toggle('on', panelOpen === 'reviewpanel');
}

/* ── the review window ──────────────────────────────────────
   What the mode is, whether it can run yet, and the button that runs it. */
function renderReviewPanel() {
  const pool = reviewPool().length, ready = pool >= REVIEW_MIN;
  const due = dueCount();
  /* What just happened, and what a review is: two plain statements rather
     than a figure the learner has to reverse-engineer. */
  const m = masteryPct();
  $('rp-sub').textContent = !ready ? "Not yet unlocked"
    : m === null ? "Ready to review"
    : m + "% correct on first try";
  $('rp-what').textContent = !ready
    ? "Learn " + REVIEW_MIN + " cards to unlock \u2014 " + pool + " so far"
    : "Reviewing " + REVIEW_SIZE + " cards from " + pool + " learned \u00b7 "
      + dueLabel(due) + " now";
  $('rp-note').textContent = "Abhy\u0101sa checks how well your studied material is "
    + "holding up over time. A card joins it the moment you answer it right "
    + "first time, and only your first answer counts here. Cards you remember "
    + "return later; cards you miss return sooner, so review stays focused "
    + "without becoming repetitive.";
  /* Stated here as well as in the drawer, and in the same words: the figure
     and its two readings.  Never the multiplication. */
  const r = rankOf();
  $('rp-rank-top').textContent = r.acc === null
    ? "Overall mastery \u2014 \u00b7 Unranked"
    : "Overall mastery " + r.score + "% \u00b7 " + r.name;
  $('rp-rank-sub').textContent = r.acc === null
    ? "A review sets it."
    : r.acc + "% review accuracy \u00b7 " + r.cov + "% course coverage";
  $('rp-actions').hidden = false;
  $('rp-draw').hidden = !ready;
  $('rp-draw').textContent = "Review " + REVIEW_SIZE
    + (mixed && !trouble ? " more" : " cards");
}

const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ── round control ─────────────────────────────────────── */
function startRound(cards, opt) {
  leaveWelcome();
  opt = opt || {};
  closePop();
  if (panelOpen) closePanel();          // never start a round behind a panel
  roundSource = cards;
  reviewing = !!opt.review;
  mixed = !!opt.mixed;
  trouble = !!opt.trouble;
  clearedAt = SAVED.cleared;
  established = new Set();              // the scaffold returns with a new round
  queue = shuffle(cards.map(card => ({ card, missedThisRound: false })));
  missed = []; learned = 0;
  if (trouble)            $('stage').textContent = "trouble cards \u00b7 " + cards.length
                                                 + (reviewing ? " you missed" : " to clear");
  else if (reviewing && mixed) $('stage').textContent = "abhyāsa \u00b7 " + cards.length + " you missed in the draw";
  else if (reviewing)     $('stage').textContent = "review \u00b7 " + cards.length + " cards you missed";
  $('review').style.display = 'none';
  $('card').style.display = 'flex';
  $('after').hidden = true;
  $('tally').style.visibility = 'visible';
  $('keys').hidden = false;
  next();
}

/* ── the landing card ──────────────────────────────────────
   The app opens on a card rather than a menu, and this is the first one: it
   says what Abhyāsa is, carries the same two figures the drawer does, and
   offers the one thing a returning learner wants — the list they were on.
   Anything that starts a round dismisses it, so it is never in the way. */
function renderWelcome() {
  const r = rankOf();
  /* A beginner reading "Unranked" beside "Lists complete 0" reads it as a
     fault.  Before the first review the figure really is nought, so it is
     printed as one; the drawer keeps `Unranked`, where the word has the room
     to mean something. */
  $('w-mastery').textContent = (r.score === null ? 0 : r.score) + '%';
  $('w-lists').textContent = finishedDecks().length;
  $('w-streak').textContent = SAVED.streak.run || 0;
  $('w-test').checked = !SAVED.guided;
  /* The first of the two gates.  With nothing begun there is nothing in
     progress, and "In progress" would drop a first-time learner into a list
     with no idea what it was for; the button opens the first track instead,
     and that track's own Begin opens its lists. */
  const go = $('w-go');
  const first = TRACK_ROWS[0].track;
  if (started()) {
    go.textContent = 'In progress';
    go.title = deckName ? 'Continue ' + DECK_SHORT(deckName) : 'Continue where you left off';
    go.onclick = leavePage;
  } else {
    go.textContent = 'Begin — ' + first.name;
    go.title = 'Read what ' + first.name + ' gives you, then start its first list';
    go.onclick = () => { beginHome(); showTrack(first.id); };
  }
  go.setAttribute('aria-label', go.title);
}


/* ── the track page ────────────────────────────────────────
   A track says what it gives you before it asks anything, and its Begin is
   what opens its lists.  On a first visit it ends in "Begin — <first list>";
   after that it reports the track's own progress and offers the next
   unfinished list instead.  There is no page below this one: a stage is not
   somewhere you have to be introduced to twice. */
let trackShown = null;

/* Every list in a track, in curriculum order. */
function trackDecks(row) {
  return [].concat(...row.lessons.map(L => L.decks));
}

function renderTrack(id) {
  const row = TRACK_ROWS.find(r => r.track.id === id);
  if (!row || !row.track.lead) return false;
  const t = row.track, names = trackDecks(row);
  /* Aggregate only: what is in the track, never a directory of it. */
  const held = t === CROSS_TRACK ? count(names.length, 'list')
    : count(row.lessons.length, 'stage') + ' · ' + count(names.length, 'list');
  fillRow(document, {
    '#s-held': held,
    '#s-name': t.name + ' · ' + t.gloss,
    '#s-lead': t.lead,
    '#s-note': t.note || '',
  });
  const ol = $('s-plan');
  ol.textContent = '';
  (t.plan || []).forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    ol.appendChild(li);
  });
  /* First visit: the track is shut, and Begin is what opens it — its lists
     are greyed in the drawer until it is pressed.  Every visit after: where
     you have got to, and the next list to take.  Begin is not offered twice,
     and only one figure is given — the track as a whole. */
  const begun = trackBegun(id);
  const p = progressOf(row.ids);
  $('s-stats').hidden = !begun;
  if (begun) $('s-pct').textContent = p.pct + '%';
  /* Two aggregates, never a directory: what of this track you have learnt,
     and — once a review has set an accuracy — the same mastery figure the
     drawer carries, measured against this track alone. */
  const rank = rankOf(row.ids);
  $('s-rankrow').hidden = !begun || rank.score === null;
  if (rank.score !== null) $('s-rank').textContent = rank.score + '% \u00b7 ' + rank.name;
  /* A count, never a list of which ones: the drawer is where you look them
     up.  A one-stage track has nothing to count. */
  const stages = row.lessons.filter(L => progressOf(L.ids).full).length;
  $('s-stagerow').hidden = !begun || row.lessons.length < 2;
  $('s-stages').textContent = stages + ' of ' + row.lessons.length;
  const next = names.find(n => finishedDecks().indexOf(n) < 0) || names[0];
  const go = $('s-go');
  go.textContent = (begun ? 'Continue — ' : 'Begin — ') + DECK_SHORT(next);
  go.onclick = () => { beginTrack(id); chooseDeck(next); };
  /* Abhyāsa is a reminder here, not a section: one line and a way in — and
     the line says what is waiting rather than only what the mode is. */
  const due = reviewPool().length >= REVIEW_MIN ? dueCount() : 0;
  $('s-review').hidden = !begun;
  $('s-review').textContent = due ? 'Abhyāsa \u00b7 ' + dueLabel(due) : 'Abhyāsa review';
  $('s-side').hidden = !begun;
  $('s-side').textContent = due
    ? (due > REVIEW_SIZE
        ? 'Abhyāsa has a full session waiting: cards you have already got right, '
          + 'brought back before they fade.'
        : 'Abhyāsa has ' + due + ' card' + (due === 1 ? '' : 's') + ' waiting: cards you '
          + 'have already got right, brought back before they fade.')
    : 'A card joins Abhyāsa the moment you get it right first time, and comes '
      + 'back later to see whether it stayed.';
  $('s-review').onclick = () => openPanel('reviewpanel');
  trackShown = id;
  return true;
}

function showTrack(id) {
  if (!renderTrack(id)) return;
  leavePage();
  $('trackcard').hidden = false;
  quietChrome();
}

/* everything a running card owns, put away */
function quietChrome() {
  $('card').style.display = 'none';
  $('review').style.display = 'none';
  $('tally').style.visibility = 'hidden';
  $('grade').hidden = true;
  $('after').hidden = true;
  $('keys').hidden = true;
  $('controls').hidden = true;
  $('stage').textContent = '';
  $('study-btn').hidden = true;
}

/* Is a page — the landing card or a track — standing over the cards? */
const onPage = () => !$('welcome').hidden || !$('trackcard').hidden;

function showWelcome() {
  leavePage();
  renderWelcome();
  $('welcome').hidden = false;
  quietChrome();
}

/* Leaves whichever page is showing — the landing card or a track page — and
   gives the cards their chrome back.  Every surface that starts a round calls
   it, so none of them has to know a page exists. */
function leavePage() {
  const on = onPage();
  $('welcome').hidden = true;
  $('trackcard').hidden = true;
  trackShown = null;
  if (!on) return;
  relabelAll();                     // Study reappears if the lesson has a reference
  $('card').style.display = 'flex';
  $('tally').style.visibility = 'visible';
  $('keys').hidden = false;
  $('controls').hidden = false;
}
const leaveWelcome = leavePage;     // the name the rest of the app grew up with

function loadDeck(name) {
  leaveWelcome();
  if (!Object.keys(DECKS).length) {              // nothing parsed — say so instead of dying
    $('dn').textContent = "रिक्तम्";
    $('iast').textContent = "riktam — no cards";
    $('gloss').textContent = PARSE.fatal || "every line was skipped — check the card block";
    $('card').classList.add('open');
    $('tally').style.visibility = 'hidden';
    return;
  }
  /* Called with no name on first load: fall back to the list last used, and
     to the first one in the curriculum if that list is gone. */
  if (!name || !DECKS[name]) name = DECKS[SAVED.deck] ? SAVED.deck : Object.keys(DECKS)[0];
  deckName = name;
  SAVED.deck = name; save();
  mixed = trouble = false;
  relabelAll();
  setToggles(true);            // the new list names its own pair
  $('restart').textContent = "Whole deck again";
  const src = DECKS[name];
  const best = deckState(name).best;
  /* The lesson is named by the selector directly above this line, and a
     stage number — how this repository orders its directories — used to be
     printed here and tells a learner nothing.  So the caption is left with
     what neither of those says. */
  $('stage').textContent = [
    DECK_DESC(name),
    best ? "best " + best[0] + "/" + best[1] : ""
  ].filter(Boolean).join(" · ");
  refreshPile();
  startRound([...src], {});
}

/* ── mixed review ──────────────────────────────────────────
   Every card of every finished list, pooled, shuffled, and the first
   REVIEW_SIZE taken.  A flat draw on purpose: weighting it towards the
   cards you keep missing would flatter the number, and the whole point
   of this mode is to measure what actually stayed. */
/* ── what a review draws ────────────────────────────────────
   The promise the card makes is that material is checked repeatedly over
   time, but not too often: remembered cards rest, missed cards come back
   sooner, and the draw stays spread across every completed list.  Three
   small rules do all of it.

   1. REST — how many sessions a card sits out, by its run of first-try
      correct answers, so what is holding up is asked less and less.  A miss
      resets the run to zero, and a rest of zero means the very next session.

   2. Overdue first.  Among the cards whose rest is up, the one that has
      waited longest goes first; a card never reviewed at all waits longest
      of all.  Within a tie the order is shuffled, so a session is never a
      replay of the last.

   3. Round-robin across lists.  Piles are drawn from one at a time, so one
      large list cannot swamp a session — a complete declension table is a
      hundred-odd cards, and a flat draw would make every review mostly that
      table.  Broad representation is a property of the draw, not of luck.

   If fewer cards are due than a session holds, the rest of the session is
   filled with the longest-rested cards anyway: a short pool should still
   give a full review rather than a stunted one.

   The draw is deliberately NOT weighted towards the cards you keep missing.
   It measures what stayed, and favouring the weak cards would flatter the
   figure.  Weighted practice is what the trouble drill is for. */
const REST = [0, 1, 2, 4, 8, 16];
const restFor = streak => REST[Math.min(Math.max(streak, 0), REST.length - 1)];

/* How many sessions past its rest a card is.  0 is due exactly now, negative
   is still resting, and a card never reviewed is treated as maximally
   overdue so new material leads. */
function overdueBy(card) {
  const rec = reviewCards()[cardKey(card)];
  if (!rec) return Infinity;
  return (SAVED.review.runs - rec[0]) - restFor(rec[1]);
}

function mixCards() {
  const byDeck = new Map();
  reviewPool().forEach(c => {
    const d = DECK_OF.get(c) || '';
    if (!byDeck.has(d)) byDeck.set(d, []);
    byDeck.get(d).push(c);
  });
  /* Shuffle first so equally overdue cards come out in a different order
     each session, then sort — Array#sort is stable, so the shuffle survives
     within each tier. */
  const piles = shuffle([...byDeck.values()].map(cs =>
    shuffle(cs).sort((a, b) => overdueBy(b) - overdueBy(a))));

  /* one pass round-robin: pile 1's first card, pile 2's first, and so on */
  const order = [];
  for (let i = 0; ; i++) {
    let took = false;
    for (const pile of piles) {
      if (i < pile.length) { order.push(pile[i]); took = true; }
    }
    if (!took) break;
  }

  const due = order.filter(c => overdueBy(c) >= 0);
  const out = due.slice(0, REVIEW_SIZE);
  /* Not enough rested yet: fill the session out with the next longest
     rested rather than handing back a short round. */
  if (out.length < REVIEW_SIZE) {
    const taken = new Set(out);
    for (const c of order) {
      if (out.length === REVIEW_SIZE) break;
      if (!taken.has(c)) { out.push(c); taken.add(c); }
    }
  }
  return out;
}

/* Record what the session found.  Only the FIRST answer counts: that is the
   retention signal the whole mode is built on, and it is the same signal a
   deck's best score and the trouble list already use. */
function recordReview(cards, missedSet) {
  const now = SAVED.review.runs;
  cards.forEach(c => {
    const k = cardKey(c), prev = reviewCards()[k];
    const streak = missedSet.has(c) ? 0 : ((prev && prev[1]) || 0) + 1;
    reviewCards()[k] = [now, streak];
  });
}

function startMixedReview() {
  if (reviewPool().length < REVIEW_MIN) return;      // the button is disabled, but still
  const cards = mixCards();
  const lists = new Set(cards.map(c => DECK_OF.get(c))).size;
  deckName = MIX;
  relabelAll();
  $('stage').textContent = ["abhyāsa", cards.length + " cards",
                            lists + " list" + (lists > 1 ? "s" : "")].join(" \u00b7 ");
  $('pile').hidden = true;
  $('restart').textContent = "Draw " + REVIEW_SIZE + " more";
  startRound(cards, { mixed: true });
}

/* ── the trouble drill ──────────────────────────────────────
   A cross-list round like the review, and like it, it keeps no list's
   books.  Unlike it, it never feeds review mastery: these are the cards
   you already know you are losing, so counting them would flatter it. */
function startTroubleDrill() {
  const cards = troubleCards();
  if (!cards.length) return;
  deckName = TROUBLE;
  $('pile').hidden = true;
  $('restart').textContent = "Drill these again";
  startRound(cards, { review: true, mixed: true, trouble: true });
  relabelAll();
}

/* the persisted "missed last time" pile for the current deck */
function pileCards() {
  const src = DECKS[deckName];
  if (!src) return [];                   // the mixed review keeps no pile of its own
  const keys = new Set(deckState(deckName).pile || []);
  return src.filter(c => keys.has(cardKey(c)));
}
function refreshPile() {
  const n = pileCards().length;
  $('pile').hidden = !n;
  if (n) $('pile').textContent = "practise the " + n + " missed last time";
}

function updateTally() {
  $('t-left').textContent = queue.length + (current ? 1 : 0);
  $('t-knew').textContent = learned;
  $('t-miss').textContent = missed.length;
}


/* ── the seven cases, plus direct address ──────────────────────────
   What each case does, for the popover behind a tapped case name in the
   red annotation.  Kept to a few sentences and one worked example: this
   is a reminder for someone mid-round, not a grammar chapter. */
const CASE_NOTES = {
  'prathamā': { en: 'nominative',
    body: "The subject of the sentence. Also the plain naming form, used when you simply name a thing." },
  'dvitīyā': { en: 'accusative',
    body: "The direct object — what the action falls on. Also marks where motion is heading." },
  'tṛtīyā': { en: 'instrumental',
    body: "By or with — the means an act is done by. Also the agent of a passive verb." },
  'caturthī': { en: 'dative',
    body: "To or for — who receives, or who benefits. The case of the deity in a namaḥ formula." },
  'pañcamī': { en: 'ablative',
    body: "From — what something moves or is separated from. Also source, cause, and the thing compared against." },
  'ṣaṣṭhī': { en: 'genitive',
    body: "Of — usually possession. It links one noun to another rather than to the verb." },
  'saptamī': { en: 'locative',
    body: "In, on or at — place, time, or the situation something holds in." },
  'sambodhana': { en: 'vocative',
    body: "Direct address — calling out to someone. Its forms match the nominative except in the singular." }
};


/* ── what kind of card this is ─────────────────────────────────────
   A headword is not a form in use, a root is not a noun, and an
   indeclinable has no paradigm at all.  Saying so keeps a declension
   table off cards that have no business showing one. */
const TYPE_NOTES = {
  'headword': { en: 'citation form',
    body: "The stem as a word list gives it, not a form in use. Add a case ending before it can stand in a sentence." },
  'adj.': { en: 'adjective',
    body: "An adjective takes the gender, number and case of the noun it describes, so one stem yields all three genders." },
  'pp.': { en: 'past participle',
    body: "A verbal adjective in -ta or -na. It agrees with its noun exactly as an adjective does." },
  'indeclinable': { en: 'avyaya — does not decline',
    body: "One fixed form, whatever its place in the sentence. Particles, conjunctions and most adverbs behave this way." },
  'upasarga': { en: 'verbal prefix',
    body: "A prefix fixed to a root, often reshaping its sense entirely. It is never used on its own.",
    dn: 'नमति → प्रणमति', iast: 'namati → praṇamati', tr: 'he bows → he prostrates' },
  'suffix': { en: 'suffix',
    body: "Added after a base to build a new word. The card shows what it makes." },
  'kṛt suffix': { en: 'primary suffix',
    body: "Added straight to a verbal root to make a noun, adjective or participle: root → suffix → new word.",
    dn: 'गम् + क्त्वा → गत्वा', iast: 'gam + ktvā → gatvā', tr: 'root · suffix · having gone' },
  'taddhita suffix': { en: 'secondary suffix',
    body: "Added to a finished nominal stem, not to a root, to derive a further word from it.",
    dn: 'शिव + अण् → शैवः', iast: 'śiva + aṇ → śaivaḥ', tr: 'stem · suffix · relating to Śiva' },
  'sandhi rule': { en: 'a joining rule',
    body: "What happens where two sounds meet. The card gives the join it governs: input, rule, output.",
    dn: 'नर + इन्द्रः → नरेन्द्रः', iast: 'nara + indraḥ → narendraḥ', tr: 'a + i becomes e' },
  'samāsa': { en: 'compound type',
    body: "How two or more stems join into one word, and which member carries the sense.",
    dn: 'नील + उत्पलम् → नीलोत्पलम्', iast: 'nīla + utpalam → nīlotpalam', tr: 'blue · lotus · a blue lotus' },
  'dhātu': { en: 'verbal root',
    body: "A root, not a word: never used bare, and reshaped by every tense and mood. The card lists forms built on it.",
    dn: 'गम् → गच्छति · जगाम · गत्वा', iast: 'gam → gacchati · jagāma · gatvā', tr: 'present · perfect · absolutive' },
  'pratyāhāra': { en: 'a sound-class abbreviation',
    body: "A shorthand for a run of sounds in the Maheśvara sūtras: a first letter, plus a marker letter that closes the run.",
    dn: 'इ उ ऋ ऌ → इक्', iast: 'i u ṛ ḷ → ik', tr: 'the four vowels the yaṇ rule acts on' },
  'gaṇa': { en: 'metrical foot',
    body: "A group of three syllables, each light or heavy. Eight are possible, and a metre is described as a sequence of them.",
    dn: '⏑ – – = य', iast: '⏑ – – = ya', tr: 'light, heavy, heavy' },
  'vṛtta': { en: 'syllable-counted metre',
    body: "A metre fixed by the number of syllables in a quarter-verse and by which are light and which heavy." },
  'sthāna': { en: 'place of articulation',
    body: "Where in the mouth a sound is made. Each row of the consonant table shares one place, and so do the vowels that belong with it." },
  'kāraka': { en: 'semantic role',
    body: "The part a word plays in the action, as against the case ending that expresses it. The two usually agree, but not always." },
  'lakāra': { en: 'tense-mood slot',
    body: "One of the ten slots Pāṇini names with an l-, each replaced by a set of endings. The card gives the sūtra that assigns it." },
  'numeral': { en: 'number word',
    body: "One to four agree with their noun in gender and case. Five and above take one form for nominative and accusative, and no gender.",
    dn: 'एकम् · द्वे · पञ्च', iast: 'ekam · dve · pañca', tr: 'one · two · five' }
};

/* Gender, stated in its own right: for a neuter it decides the paradigm. */
const GENDER_NOTES = {
  'm.': { en: 'masculine',
    body: "A masculine noun. Its nominative and accusative are always distinct forms." },
  'f.': { en: 'feminine',
    body: "A feminine noun. In the ā- and ī-classes the ablative and genitive singular are the same form." },
  'n.': { en: 'neuter',
    body: "A neuter noun. Nominative and accusative are always identical, in all three numbers, which is why this card carries both readings. Elsewhere it follows the masculine of its class." },
  'f./n.': { en: 'feminine or neuter',
    body: "Attested in both genders, declining as its class does for each." },
  'm./f.': { en: 'masculine or feminine',
    body: "Attested in both genders, declining as its class does for each." }
};

/* ── the baseplates ────────────────────────────────────────────────
   A stem class is the shape of the socket a noun's endings snap into.
   Learn the model word and every noun of that class follows it. */
const STEM_NOTES = {
  'a-stem': { en: 'masculine or neuter',
    egA: { dn: 'नित्यः · नित्यम् · नित्या', iast: 'nityaḥ · nityam · nityā', tr: 'm. · n. · f.' },
    egN: { dn: 'फलम् · फलेन · फलाय', iast: 'phalam · phalena · phalāya', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "The commonest class: stems ending in -a, such as rāma- or phala-. Its endings are the pattern the other classes are measured against.",
    dn: 'रामः · रामेण · रामाय', iast: 'rāmaḥ · rāmeṇa · rāmāya', tr: 'nom. · instr. · dat. sg.' },
  'ā-stem': { en: 'feminine',
    body: "A feminine stem ending in -ā, such as durgā- or mālā-. The nominative singular is the bare stem.",
    dn: 'दुर्गा · दुर्गायै · दुर्गायाम्', iast: 'durgā · durgāyai · durgāyām', tr: 'nom. · dat. · loc. sg.' },
  'i-stem': { en: 'masculine or feminine',
    egA: { dn: 'शुचिः · शुचि · शुचिः', iast: 'śuciḥ · śuci · śuciḥ', tr: 'm. · n. · f.' },
    egN: { dn: 'वारि · वारिणा · वारिणे', iast: 'vāri · vāriṇā · vāriṇe', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in short -i, such as hari- or agni-. Its ablative and genitive singular are the same form.",
    dn: 'हरिः · हरये · हरेः', iast: 'hariḥ · haraye · hareḥ', tr: 'nom. · dat. · abl./gen. sg.' },
  'ī-stem': { en: 'feminine',
    body: "A feminine stem ending in long -ī, such as devī- or lakṣmī-. The -ī becomes -y- before a vowel ending.",
    dn: 'लक्ष्मीः · लक्ष्म्यै · लक्ष्मीभिः', iast: 'lakṣmīḥ · lakṣmyai · lakṣmībhiḥ', tr: 'nom. sg. · dat. sg. · instr. pl.' },
  'u-stem': { en: 'masculine or neuter',
    egA: { dn: 'साधुः · साधु · साध्वी', iast: 'sādhuḥ · sādhu · sādhvī', tr: 'm. · n. · f.' },
    egN: { dn: 'मधु · मधुना · मधुने', iast: 'madhu · madhunā · madhune', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in short -u, such as viṣṇu- or guru-. It follows the same pattern as the i-stem.",
    dn: 'विष्णुः · विष्णवे · विष्णोः', iast: 'viṣṇuḥ · viṣṇave · viṣṇoḥ', tr: 'nom. · dat. · abl./gen. sg.' },
  'ū-stem': { en: 'feminine',
    body: "A feminine stem ending in long -ū, such as bhrū- or vadhū-. A small class, parallel to the ī-stem.",
    dn: 'भ्रूः · भ्रुवा', iast: 'bhrūḥ · bhruvā', tr: 'nom. sg. · instr. sg.' },
  'ṛ-stem': { en: 'kinship and agent nouns',
    body: "A stem ending in -ṛ: kinship words such as mātṛ- and pitṛ-, and agent nouns in -tṛ such as kartṛ-. The nominative singular ends in -ā.",
    dn: 'माता · मातरम् · मातुः', iast: 'mātā · mātaram · mātuḥ', tr: 'nom. · acc. · abl./gen. sg.' },
  'at-stem': { en: 'consonant stem',
    egA: { dn: 'श्रीमान् · श्रीमत् · श्रीमती', iast: 'śrīmān · śrīmat · śrīmatī', tr: 'm. · n. · f.' },
    body: "A stem ending in -at, -mat or -vat, such as bhagavat- or śrīmat-. The masculine nominative singular ends in -ān; the neuter is the bare stem.",
    dn: 'भगवान् · भगवत् · भगवता', iast: 'bhagavān · bhagavat · bhagavatā', tr: 'nom. sg. m. · nom./acc. sg. n. · instr. sg.' },
  'an-stem': { en: 'consonant stem',
    egN: { dn: 'नाम · नाम्ना · नाम्ने', iast: 'nāma · nāmnā · nāmne', tr: 'nom./acc. · instr. · dat. sg.' },
    body: "A stem ending in -an, -man or -van, such as ātman- or nāman-. The masculine nominative singular ends in -ā; the neuter drops the -n.",
    dn: 'आत्मा · नाम · आत्मना', iast: 'ātmā · nāma · ātmanā', tr: 'nom. sg. m. · nom./acc. sg. n. · instr. sg.' },
  'as-stem': { en: 'neuter consonant stem',
    body: "A stem ending in -as, usually neuter, such as manas- or tejas-. It shows as -aḥ at the end of a word.",
    dn: 'मनः · मनसा', iast: 'manaḥ · manasā', tr: 'nom./acc. sg. · instr. sg.' },
  'is-stem': { en: 'neuter consonant stem',
    body: "A neuter stem ending in -is, such as jyotis-. It shows as -iḥ at the end of a word.",
    dn: 'ज्योतिः · ज्योतिषा', iast: 'jyotiḥ · jyotiṣā', tr: 'nom./acc. sg. · instr. sg.' },
  'us-stem': { en: 'neuter consonant stem',
    body: "A neuter stem ending in -us, such as dhanus- or cakṣus-. It shows as -uḥ at the end of a word.",
    dn: 'धनुः · धनुषा', iast: 'dhanuḥ · dhanuṣā', tr: 'nom./acc. sg. · instr. sg.' },
  'in-stem': { en: 'possessive consonant stem',
    egA: { dn: 'योगी · योगि · योगिनी', iast: 'yogī · yogi · yoginī', tr: 'm. · n. · f.' },
    body: "A stem ending in -in, meaning 'one who has': yogin-, tejasvin-. The nominative singular ends in -ī.",
    dn: 'योगी · योगिनम्', iast: 'yogī · yoginam', tr: 'nom. sg. · acc. sg.' }
};

/* ── the kārakas ───────────────────────────────────────────────────
   The semantic role a word plays, as against the case-ending that
   expresses it: the two are related but not the same thing. */
const KARAKA_NOTES = {
  'kartṛ': { en: 'agent',
    body: "The one who acts. Nominative in an active sentence, instrumental in a passive one." },
  'karma': { en: 'object',
    body: "What the action affects. Accusative in an active sentence, nominative in a passive one." },
  'karaṇa': { en: 'instrument',
    body: "The means by which something is done. Expressed by the instrumental." },
  'sampradāna': { en: 'recipient',
    body: "The one an act is meant for. Expressed by the dative." },
  'apādāna': { en: 'source',
    body: "The fixed point something moves away from. Expressed by the ablative." },
  'adhikaraṇa': { en: 'locus',
    body: "Where or when the action takes place. Expressed by the locative." },
  'sambandha': { en: 'relation',
    body: "The link between one noun and another, expressed by the genitive. Not counted a kāraka, since it relates nouns rather than acting in the event." }
};

/* ── the verb-form tags that appear in a note ─────────────────────── */
const FORM_NOTES = {
  'pp.': { en: 'past participle',
    body: "A verbal adjective in -ta or -na. It declines like an a-stem, and often stands where English uses a past tense.",
    dn: 'कृतम् · गतः', iast: 'kṛtam · gataḥ', tr: 'done · gone' },
  'perf.': { en: 'perfect',
    body: "A past tense for remote or reported events. Built by reduplicating the root.",
    dn: 'जगाम · उवाच', iast: 'jagāma · uvāca', tr: 'he went · he said' },
  'impf.': { en: 'imperfect',
    body: "A plain past tense. Built on the present stem with a- in front.",
    dn: 'गच्छति → अगच्छत्', iast: 'gacchati → agacchat', tr: 'he goes → he went' },
  'abs.': { en: 'absolutive',
    body: "Indeclinable, meaning 'having done X'. Takes -tvā on a plain root, -ya after a prefix.",
    dn: 'गत्वा · प्रणम्य', iast: 'gatvā · praṇamya', tr: 'having gone · having bowed' },
  'caus.': { en: 'causative',
    body: "'Cause to X', formed with -aya-.",
    dn: 'पतति → पातयति', iast: 'patati → pātayati', tr: 'he falls → he fells' }
};


/* Other names for the same explanation: the English abbreviation a phrase
   note uses instead of the Sanskrit case name, and the combined class
   label.  Both resolve to one entry, so a line naming a case twice — once
   in each language — still gets a single section. */
const CLASS_ALIAS = {
  'nom.':'prathamā', 'acc.':'dvitīyā', 'instr.':'tṛtīyā', 'dat.':'caturthī',
  'abl.':'pañcamī', 'gen.':'ṣaṣṭhī', 'loc.':'saptamī', 'voc.':'sambodhana',
  'ā-/ī-stem':'ā-stem'
};

/* Where a verb's ending sends its result: to another, or back to the agent. */
const VOICE_NOTES = {
  'parasmaipada': { en: 'active endings',
    body: "The ordinary active endings, used when the result of the act goes to someone else.",
    dn: 'गच्छामि · गच्छसि · गच्छति', iast: 'gacchāmi · gacchasi · gacchati', tr: 'I, you, he go.' },
  'ātmanepada': { en: 'middle endings',
    body: "Endings used when the result of the act comes back to the agent.",
    dn: 'वन्दे · लभते', iast: 'vande · labhate', tr: 'I venerate · he obtains' },
  'pres.': { en: 'present tense',
    body: "The present tense. How its stem is built depends on the root's class.",
    dn: 'गच्छति · शृणोति', iast: 'gacchati · śṛṇoti', tr: 'he goes · he hears' },
  'impv.': { en: 'imperative',
    body: "Commands, requests and prayers — the mood most of a stotra uses.",
    dn: 'रक्ष · प्रसीद', iast: 'rakṣa · prasīda', tr: 'protect! · be gracious!' },
  'pronoun': { en: 'pronominal declension',
    body: "Pronouns follow their own patterns, not the noun classes. Some build their cases from more than one stem.",
    dn: 'त्वाम् · तुभ्यम्', iast: 'tvām · tubhyam', tr: 'you (acc.) · to you' },
  'interrogative pronoun': { en: 'question word',
    body: "The stem kim-, declined like a pronoun. Its forms open questions, and with api or cana they become indefinite: 'someone', 'anything'.",
    dn: 'किम् · कः · कस्मै', iast: 'kim · kaḥ · kasmai', tr: 'what? · who? · to whom?' },
  'fut.': { en: 'future',
    body: "The simple future, formed with -sya- before the endings.",
    dn: 'करिष्यति · गमिष्यति', iast: 'kariṣyati · gamiṣyati', tr: 'he will do · he will go' }
};

/* Everything the red annotation can explain, in one table.  Longest names
   first, so "adhikaraṇa" is never mistaken for the "karaṇa" inside it. */
const GLOSSARY = Object.assign({}, TYPE_NOTES, CASE_NOTES, GENDER_NOTES, STEM_NOTES,
                               KARAKA_NOTES, FORM_NOTES, VOICE_NOTES);
Object.keys(CLASS_ALIAS).forEach(k => GLOSSARY[k] = GLOSSARY[CLASS_ALIAS[k]]);
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const LETTER = /[A-Za-z\u00C0-\u024F\u0900-\u097F\u1E00-\u1EFF]/;

function termAt(text, i) {
  if (i && LETTER.test(text[i - 1])) return null;
  for (const t of TERMS) {
    if (!text.startsWith(t, i)) continue;
    const after = text[i + t.length];
    if (after && LETTER.test(after)) continue;
    return t;
  }
  return null;
}

/* Read an annotation into the pieces worth explaining, in the order they
   appear: the glossary terms it names, the stem it is built on, and the
   root a verb form comes from.  Anything the glossary does not know —
   sūtra numbers, sandhi rule names, source citations — is passed over,
   which is what keeps a sandhi or metre card out of the noun schema. */
function readAnnotation(text) {
  const parts = [], seen = new Set();
  const stem = text.match(/stem:\s*([^·]+)/);
  if (stem) parts.push({ at: stem.index, kind: 'stem', value: stem[1].trim().replace(/,\s*$/, '') });
  const root = text.match(/(?:(\w+)\s*\+\s*)?√(\S+)/);
  if (root) parts.push({ at: root.index, kind: 'root', value: root[0] });
  for (let i = 0; i < text.length; ) {
    const t = termAt(text, i);
    if (!t) { i++; continue; }
    const key = CLASS_ALIAS[t] || t;
    if (!seen.has(key)) { seen.add(key); parts.push({ at: i, kind: 'term', value: t }); }
    i += t.length;
  }
  return parts.sort((a, b) => a.at - b.at);
}

function section(title, en, body, eg) {
  const d = document.createElement('div');
  d.className = 'sec';
  const h = document.createElement('div');
  h.className = 'sec-h';
  const t = document.createElement('span'); t.className = 'sec-t'; t.textContent = title;
  const e = document.createElement('span'); e.className = 'sec-e'; e.textContent = en;
  h.appendChild(t); h.appendChild(e);
  d.appendChild(h);
  const b = document.createElement('p'); b.className = 'sec-b'; b.textContent = body;
  d.appendChild(b);
  if (eg) {
    const g = document.createElement('div'); g.className = 'sec-eg';
    [['eg-dn', eg.dn], ['eg-iast', eg.iast], ['eg-tr', eg.tr]].forEach(([cls, val]) => {
      const sp = document.createElement('span'); sp.className = cls; sp.textContent = val;
      g.appendChild(sp);
    });
    d.appendChild(g);
  }
  return d;
}

/* Build the red annotation.  The whole line becomes one tap target when
   there is anything to say about it, and stays plain text otherwise. */
function renderTag(text) {
  const tag = $('tag');
  closePop();                            // any popover open is about the old line
  tag.textContent = '';
  if (!text) return;
  if (!readAnnotation(text).length) { tag.textContent = text; return; }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ann';
  b.textContent = text;
  b.dataset.ann = text;
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'What this annotation means');
  tag.appendChild(b);
}

/* The popover.  Tap to open, tap the same chip or anywhere off it to
   close — no hover anywhere, since a phone has none to give. */
let popFor = null;

function closePop() {
  if (!popFor) return;
  popFor.setAttribute('aria-expanded', 'false');
  $('pop').hidden = true;
  popFor = null;
}

function placePop(btn) {
  const pop = $('pop'), r = btn.getBoundingClientRect(), m = 10;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(m, Math.min(left, window.innerWidth - w - m));
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - m) top = r.top - h - 8;   // no room below
  top = Math.max(m, Math.min(top, window.innerHeight - h - m));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function openPop(btn) {
  const parts = readAnnotation(btn.dataset.ann);
  if (!parts.length) return;
  /* The one example a tooltip carries must match the card: an adjective is
     shown its three genders, a neuter its neuter paradigm, and a headword,
     a root or an indeclinable is shown no declension at all. */
  const ann  = btn.dataset.ann;
  const adj  = /(?:^|[\s|·])(adj\.|pp\.)(?:[\s·]|$)/.test(ann);
  const cite = /^headword \|/.test(ann);
  const neut = /(?:^|[\s·])n\.(?:[\s·]|$)/.test(ann);
  closePop();
  const pop = $('pop');
  pop.textContent = '';
  pop.scrollTop = 0;
  parts.forEach(part => {
    if (part.kind === 'stem') {
      pop.appendChild(section(part.value, 'stem', cite
        ? "The card shows this stem itself, as a word list gives it. Case endings are added "
          + "to it to make a form that can stand in a sentence."
        : "The dictionary stem underlying the displayed form. Case endings are added to this "
          + "stem; the stem itself may sometimes also appear as a complete form.", null));
    } else if (part.kind === 'root') {
      pop.appendChild(section(part.value, 'root',
        "The verbal root the form is built from. A root is never used bare — each tense "
        + "and mood reshapes it.", null));
    } else {
      const c = GLOSSARY[part.value];
      if (!c) return;
      const eg = adj  ? (c.egA || null)
               : neut  ? (c.egN || (c.dn ? c : null))
               :         (c.dn ? c : null);
      pop.appendChild(section(part.value, c.en, c.body, eg));
    }
  });
  pop.hidden = false;
  placePop(btn);
  btn.setAttribute('aria-expanded', 'true');
  popFor = btn;
}

function paint() {
  const c = current.card;
  closePop();                            // the chip about to be replaced
  const kind = c.type || 'reveal';
  if (kind === 'choice')   { paintChoice(c); return; }
  if (kind === 'sequence') { paintSequence(c); return; }

  $('card').classList.remove('choice', 'seq-card');
  $('stemclass').hidden = true;          // a reveal card carries no stem class
  $('seq').hidden = true;
  $('choices').hidden = true;
  $('choices').textContent = '';
  $('keys').textContent = KEYS_REVEAL;
  setToggles(true, hasIastToggle(c));
  $('src').textContent = '';
  /* The transliteration goes on whichever side the Devanagari is, as its own
     line.  It used to be appended to the annotation in the produce direction,
     so the card showed no IAST at all and the toggle appeared to rewrite the
     morphology instead. */
  const iast = showIast(c) ? c.iast : '';
  if (DIR === 'produce') {
    $('dn').textContent        = c.gloss;
    $('iast').textContent      = '';
    $('gloss').textContent     = c.devanagari;
    $('iast-back').textContent = iast;
  } else {
    $('dn').textContent        = c.devanagari;
    $('iast').textContent      = iast;
    $('gloss').textContent     = c.gloss;
    $('iast-back').textContent = '';
  }
  /* `detail` is part of the ANSWER, so it stays on the back whichever way
     round the card is running.  A metre is identified by its gaṇa formula as
     much as by its name; putting the formula on the front handed the learner
     the answer they were being asked for. */
  $('cue').textContent         = cueText();
  $('detail').textContent      = c.detail || '';
  $('detail-iast').textContent = c.detail && showDetailIast(c) ? c.detailIast || '' : '';
  renderTag(c.note);
  /* The box reflects what is on the card, which is not always the setting:
     a card with nothing to transliterate shows its second line regardless. */
  $('iast-on').checked = hasIastToggle(c) ? IAST : true;
}

/* \u2500\u2500 choice cards \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One renderer for every use of the interaction: recognition ("which
   analysis?") and controlled transformation ("make it 'I'") differ only in
   the prompt, never in the machinery.

   Grading is not a separate scheme.  Tapping the right option is a cold
   recall and ends as knew(); tapping a wrong one ends as didntKnow().  So
   the trouble list, the missed pile, review mastery and the scoreboard all
   see a choice card as exactly one retrieval event, the same as a reveal.

   The direction toggle does not apply: a transformation only runs one way,
   and the IAST toggle does not either, because here the IAST *is* the
   content rather than a transliteration of it. */
let choiceRight = null;                  // null until answered, then true/false
const KEYS_REVEAL = $('keys').textContent;

/* ── the stem class ────────────────────────────
   A declension card hands over a stem and asks for one cell of its table,
   which is answerable only if you know which table.  Naming the gender and
   stem class under the stem is what keeps the card testing the declension:
   inferring the class is a different skill, and leaving it implied would
   test two things while grading one.

   It is a scaffold, so it is withdrawn once it has been earned.  A card that
   ASKS for the class carries that same string among its options — which is
   how one is recognised, no flag needed — and once such a card has come up
   in a round, the rest of the round stops printing the class it established.
   Nothing is withdrawn that was never asked for: a pronoun takes its gender
   from its referent rather than from its stem, so `tad-` is never asked and
   its line always shows. */
let established = new Set();             // stem classes asked so far this round
const asksClass = c => !!c.stemClass && (c.options || []).indexOf(c.stemClass) >= 0;
function paintStemClass(c) {
  const show = c.stemClass && !asksClass(c) && !established.has(c.stemClass);
  $('stemclass').textContent = show ? c.stemClass : '';
  $('stemclass').hidden = !show;
  if (asksClass(c)) established.add(c.stemClass);
}

function paintChoice(c) {
  choiceRight = null;
  $('seq').hidden = true;
  $('card').classList.remove('seq-card');
  $('card').classList.add('choice');
  $('card').setAttribute('aria-label', 'Choose the answer');
  $('dn').textContent   = c.front || '';
  $('iast').textContent = '';
  /* An interactive card carries its task in its own prompt — "Join: nara +
     indrah" — so a cue over the top would only repeat it. */
  $('cue').textContent = '';
  paintStemClass(c);
  $('gloss').textContent = '';
  $('iast-back').textContent = '';
  $('detail').textContent = '';
  $('detail-iast').textContent = '';
  renderTag(c.note);
  $('src').textContent = c.source || '';
  setToggles(false);
  $('keys').textContent = 'tap an answer \u00b7 1\u2013' + c.options.length + ' \u2014 choose';

  const box = $('choices');
  box.textContent = '';
  box.hidden = false;
  /* Shuffled per showing, so the answer's position is never the thing
     remembered \u2014 on the second look within a round especially. */
  shuffle([...c.options]).forEach(opt => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.textContent = opt;
    b.addEventListener('click', () => answerChoice(c, opt));
    box.appendChild(b);
  });
}

function answerChoice(c, picked) {
  if (choiceRight !== null) return;      // already answered; the card is locked
  choiceRight = picked === c.answer;

  [...$('choices').children].forEach(b => {
    b.disabled = true;
    if (b.textContent === c.answer) b.classList.add('right');
    else if (b.textContent === picked) b.classList.add('wrong');
  });

  $('card').classList.add('open');       // uncovers the rule and the note
  $('graded-next').hidden = false;
  $('g-next').focus();
}

function choiceNext() {
  if (choiceRight === null) return;
  $('graded-next').hidden = true;
  const right = choiceRight;
  choiceRight = null;
  if (right) knew(); else didntKnow();
}

/* ── sequence cards ────────────────────────────────────────
   Assemble supplied pieces in order.  The same shared grading as everything
   else: a correct assembly ends as knew(), a wrong one as didntKnow(), so a
   sequence card is one retrieval event to the trouble list and the
   scoreboard like any other.

   Built pieces are tracked by their INDEX in `parts`, not by their text, so
   a card whose bank repeats a word (two `ca`, say) still knows which chip
   came from where. */
let seqBuilt = null;                     // array of part indices, or null
let seqRight = null;                     // null until checked, then true/false

function paintSequence(c) {
  seqBuilt = [];
  seqRight = null;
  $('choices').hidden = true;
  $('choices').textContent = '';
  $('card').classList.remove('choice');
  $('card').classList.add('seq-card');
  $('card').setAttribute('aria-label', 'Build the answer by tapping pieces');
  $('dn').textContent = c.front || '';
  $('iast').textContent = '';
  /* An interactive card carries its task in its own prompt — "Join: nara +
     indrah" — so a cue over the top would only repeat it. */
  $('cue').textContent = '';
  paintStemClass(c);
  $('gloss').textContent = '';
  $('iast-back').textContent = '';
  $('detail').textContent = '';
  $('detail-iast').textContent = '';
  renderTag(c.note);
  $('src').textContent = c.source || '';
  setToggles(false);
  $('keys').textContent = 'tap the pieces in order';
  $('seq').hidden = false;
  $('seq-actions').hidden = false;
  drawSequence(c);
}

/* The bank is drawn from whatever is not currently placed, shuffled once per
   showing so the authored order is never the answer. */
let seqOrder = null;

function drawSequence(c) {
  const built = $('built'), bank = $('bank');
  built.textContent = '';
  bank.textContent = '';

  if (!seqOrder || seqOrder.length !== c.parts.length) {
    seqOrder = shuffle(c.parts.map((_, i) => i));
  }

  seqBuilt.forEach((partIdx, pos) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = c.parts[partIdx];
    if (seqRight === null) {
      b.addEventListener('click', () => { seqBuilt.splice(pos, 1); drawSequence(c); });
    } else {
      b.disabled = true;
      /* `sequence` is only ever used where the order is forced by the
         grammar — derivational stages — so a misplaced piece really is
         misplaced and is marked as such. Free constituent order is not
         tested by this interaction at all; see CLAUDE.md. */
      b.classList.add(c.parts[partIdx] === c.answer[pos] ? 'right' : 'wrong');
    }
    built.appendChild(b);
  });

  if (seqRight === null) {
    seqOrder.filter(i => !seqBuilt.includes(i)).forEach(partIdx => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = c.parts[partIdx];
      b.addEventListener('click', () => { seqBuilt.push(partIdx); drawSequence(c); });
      bank.appendChild(b);
    });
  }

  $('s-back').disabled  = seqBuilt.length === 0;
  $('s-reset').disabled = seqBuilt.length === 0;
  $('s-check').disabled = seqBuilt.length === 0;
}

function seqCheck() {
  if (!current || seqRight !== null || !seqBuilt.length) return;
  const c = current.card;
  const got = seqBuilt.map(i => c.parts[i]);
  seqRight = got.length === c.answer.length && got.every((w, i) => w === c.answer[i]);

  /* Spell the chain out when it was wrong — seeing which stage feeds which
     is the whole lesson, and a marked-up chip line does not give it. */
  $('gloss').textContent = seqRight ? '' : 'Correct order: ' + c.answer.join('  →  ');
  $('card').classList.add('open');
  $('keys').textContent = KEYS_REVEAL;
  $('seq-actions').hidden = true;
  $('graded-next').hidden = false;
  drawSequence(c);
  $('g-next').focus();
}

function seqBack()  { if (seqRight === null && seqBuilt.length) { seqBuilt.pop(); drawSequence(current.card); } }
function seqReset() { if (seqRight === null) { seqBuilt = []; drawSequence(current.card); } }

function seqNext() {
  if (seqRight === null) return;
  $('graded-next').hidden = true;
  const right = seqRight;
  seqRight = null;
  seqBuilt = null;
  if (right) knew(); else didntKnow();
}

/* One button serves both interactive types. */
function gradedNext() {
  if (choiceRight !== null) return choiceNext();
  if (seqRight !== null) return seqNext();
}

function next() {
  $('card').classList.remove('open');
  $('card').setAttribute('aria-label',
    DIR === 'produce' ? 'Show the word' : 'Show the meaning');
  $('grade').hidden = true;
  $('graded-next').hidden = true;
  $('seq-actions').hidden = true;
  choiceRight = null;
  seqRight = null;
  seqBuilt = null;
  seqOrder = null;
  if (!queue.length) { current = null; finish(); return; }
  current = queue.shift();
  $('relearn').hidden = !current.missedThisRound;
  paint();
  updateTally();
}

function reveal() {
  if (!current || $('card').classList.contains('open')) return;
  /* An interactive card is uncovered by answering it, not by flipping it — a
     tap anywhere else on the panel must not hand over the answer. */
  if ((current.card.type || 'reveal') !== 'reveal') return;
  $('card').classList.add('open');
  $('card').setAttribute('aria-label', 'Answer shown — grade yourself');
  $('grade').hidden = false;
}

/* "Knew it" — retire the card; it will not come back this round. */
function knew() {
  if (!current) return;
  /* only a cold recall counts towards clearing: getting it right on the
     re-show, moments after being told, is relearning, not remembering */
  if (!current.missedThisRound) { markRight(current.card); markMastered(current.card); }
  learned++;
  next();
}

/* "Didn't know it" — log it for review and put it back a few cards later,
   so you meet it again before the round ends. */
function didntKnow() {
  if (!current) return;
  const secondLook = current.missedThisRound;
  if (!secondLook) {
    current.missedThisRound = true;
    missed.push(current.card);
    markWrong(current.card);           // one strike per round, not per showing
    unmarkMastered(current.card);      // a lesson must be able to lose its tick
  }
  /* Re-queue for one more meeting — once.  A card missed on that second
     look is left where it is: it is already on the review list, and the
     "practise these again" button exists for another pass.  Re-queueing
     it a third time made a round you were failing impossible to finish —
     the queue never emptied, so the tally never came. */
  if (!secondLook) {
    queue.splice(Math.min(4, queue.length), 0, current);
  }
  next();
}

/* How each list held up in a cross-list round, weakest first — the answer to
   "where do I go back to?".  Counted in cards because that is what a round
   contains, but reported per list because that is the unit the learner
   finishes and the drawer measures. */
function byListSummary(host, cards, missedCards) {
  const bad = new Set(missedCards);
  const rows = new Map();
  cards.forEach(c => {
    const n = DECK_OF.get(c);
    if (!n) return;
    if (!rows.has(n)) rows.set(n, { right: 0, total: 0 });
    const r = rows.get(n);
    r.total++;
    if (!bad.has(c)) r.right++;
  });
  if (rows.size < 2) return;            // one list is not a comparison

  const head = document.createElement('div');
  head.className = 'missed-head';
  head.textContent = "How each list held up";
  host.appendChild(head);

  [...rows.entries()]
    .sort((a, b) => (a[1].right / a[1].total) - (b[1].right / b[1].total)
                 || a[0].localeCompare(b[0]))
    .forEach(([name, r]) => {
      const full = r.right === r.total;
      const d = document.createElement('div');
      d.className = 'brow' + (full ? ' full' : '');
      d.innerHTML = '<span class="b-name"></span><span class="b-score"></span>'
                  + '<span class="b-pct"></span>';
      d.querySelector('.b-name').textContent = DECK_SHORT(name);
      d.querySelector('.b-score').textContent = r.right + " / " + r.total;
      d.querySelector('.b-pct').textContent = full ? "strong" : "practise";
      host.appendChild(d);
    });
}

/* ── end of round ──────────────────────────────────────── */
/* One line per thing just finished, above the score it came from.  Nothing
   is announced twice: `claimAwards` stamps each key the first time it is
   true.  Three at once is already a rare evening; more than that would be a
   wall rather than news. */
function renderAwards() {
  const fresh = claimAwards().slice(0, 3);
  const host = $('r-awards');
  host.textContent = '';
  host.hidden = !fresh.length;
  const WHY = {
    'list:complete':     'every card known cold',
    'list:retained':     'and it has held up in Abhyāsa',
    'stage:complete':    'every list in the stage',
    'stage:retained':    'the whole stage has held up in Abhyāsa',
    'track:complete':    'every stage in the track',
    'track:retained':    'the whole track has held up in Abhyāsa',
  };
  fresh.forEach(a => {
    const el = document.createElement('div');
    el.innerHTML = '<b></b> <span></span>';
    el.querySelector('b').textContent = a.label + ' ' + a.tier;
    el.querySelector('span').textContent = '\u00b7 ' + WHY[a.level + ':' + a.tier];
    host.appendChild(el);
  });
}

/* The next list worth opening after this one: the first unfinished list in
   the same track, taken in curriculum order from where you are.  A track you
   have finished has none, and neither does a cross-list round — a draw does
   not belong to a list, so there is nothing to be "next" to. */
function nextList(name) {
  const row = TRACK_ROWS.find(r => r.track.id === trackIdOf(name));
  if (!row) return null;
  const names = trackDecks(row);
  const here = names.indexOf(name);
  const done = finishedDecks();
  const after = names.slice(here + 1).find(n => done.indexOf(n) < 0);
  return after || names.find(n => n !== name && done.indexOf(n) < 0) || null;
}

/* The two handoffs at the end of a round: on to the next list, and over to
   whatever Abhyāsa has waiting.  Without them the results screen is where a
   session stops — every other way on is behind the drawer. */
function renderHandoff() {
  const onward = mixed ? null : nextList(deckName);
  const go = $('next-list');
  go.hidden = !onward;
  if (onward) {
    go.textContent = 'Next \u2014 ' + DECK_SHORT(onward);
    go.title = onward;
    go.onclick = () => chooseDeck(onward);
  }
  /* not offered inside a review: "review 20 due" while reviewing is the
     button you already pressed */
  const due = !mixed && reviewPool().length >= REVIEW_MIN ? dueCount() : 0;
  const rev = $('review-due');
  rev.hidden = !due;
  if (due) {
    rev.textContent = 'Abhyāsa \u00b7 ' + dueLabel(due);
    rev.onclick = () => { leavePage(); startMixedReview(); };
  }
}

function finish() {
  const total = roundSource.length;
  const firstPass = total - missed.length;
  const justCleared = SAVED.cleared - clearedAt;
  lastRound = { deck: deckName, lesson: LESSON_LABEL[DECK_LESSON[deckName]], firstPass, total,
                reviewing, mixed, trouble, justCleared,
                lists: mixed && !trouble
                  ? new Set(roundSource.map(c => DECK_OF.get(c))).size : 0 };

  if (mixed) {
    /* A draw measures; it does not keep books.  No list's best score and no
       list's missed pile moves on the strength of a review — and only the
       fresh draw counts towards mastery, since re-drilling the cards you
       just missed would make the figure say nothing. */
    if (!reviewing && !trouble) {
      const r = SAVED.review;
      r.runs++; r.right += firstPass; r.seen += total;
      recordReview(roundSource, new Set(missed));
      save();
    }
  } else {
    /* remember the outcome: best score on full rounds; the missed pile
       always — cards practised this round leave it, cards missed re-enter */
    const ds = deckState(deckName);
    if (!reviewing) {
      ds.last = [firstPass, total];
      if (!ds.best || firstPass / total > ds.best[0] / ds.best[1]) ds.best = [firstPass, total];
    }
    const practised = new Set(roundSource.map(cardKey));
    ds.pile = (ds.pile || []).filter(k => !practised.has(k));
    missed.forEach(c => { const k = cardKey(c); if (!ds.pile.includes(k)) ds.pile.push(k); });
    save();
  }
  bumpStreak();                       // a day with a round finished in it
  relabelAll();                       // a finished list may have opened the review
  refreshPile();
  $('card').style.display = 'none';
  $('review').style.display = 'block';
  $('tally').style.visibility = 'hidden';
  $('grade').hidden = true;
  $('keys').hidden = true;
  $('after').hidden = false;

  const isReview = reviewing || mixed;
  $('r-title').textContent = trouble
    ? (missed.length ? "समाप्तम् — drill finished" : "समाप्तम् — drill clear")
    : missed.length
    ? (isReview ? "समाप्तम् — review finished" : "समाप्तम् — round finished")
    : (isReview ? "समाप्तम् — review clear" : "समाप्तम् — clean round");
  let scoreLine = (reviewing ? "Cleared on the first showing this time: " : "Known on the first showing: ")
    + "<b>" + firstPass + " of " + total + "</b>";
  if (mixed && !reviewing && !trouble)
    scoreLine += "<br>Review accuracy: <b>" + masteryPct() + "%</b> over "
               + SAVED.review.seen + " cards reviewed";
  if (justCleared)
    scoreLine += "<br><b>" + justCleared + "</b> left the trouble list";
  $('r-score').innerHTML = scoreLine;
  renderAwards();
  renderHandoff();

  const list = $('r-list');
  list.innerHTML = "";
  /* A review crosses lists, so the useful question at the end is not which
     cards went wrong but which LISTS are holding up.  Card-level detail is
     the evidence underneath; the learner-facing unit is the list, and this
     is what says where to go back to. */
  if (mixed && !trouble) byListSummary(list, roundSource, missed);
  if (!missed.length) {
    list.insertAdjacentHTML('beforeend', '<div class="clean">' + (
        trouble
      ? 'Every one of them on the first showing. Two more sittings like that and they leave the list.'
      : mixed && !reviewing
      ? 'Every card cold, straight out of its list. Draw again, or go back to a list.'
      : reviewing
      ? 'All of them clear this time. Back to the whole deck, or pick another list.'
      : 'Every card on the first showing. Pick another list, or run this one again.') + '</div>');
    $('again-missed').hidden = true;
    return;
  }
  $('again-missed').hidden = false;
  $('again-missed').textContent = missed.length === 1
    ? "Practise this one again" : "Practise these " + missed.length + " again";

  const head = document.createElement('div');
  head.className = 'missed-head';
  head.textContent = "For review — " + missed.length + " card" + (missed.length > 1 ? "s" : "");
  list.appendChild(head);

  missed.forEach(card => {
    const d = document.createElement('div');
    d.className = 'row';
    d.innerHTML =
      '<span class="r-dn"></span><span class="r-iast"></span>' +
      '<span class="r-gloss"></span><span class="r-tag"></span>';
    d.querySelector('.r-dn').textContent    = card.devanagari;
    d.querySelector('.r-iast').textContent  = card.iast;
    d.querySelector('.r-gloss').textContent = card.gloss;
    const from = mixed ? DECK_OF.get(card) : "";      // a cross-list round needs the label
    d.querySelector('.r-tag').textContent   =
      [from ? DECK_SHORT(from) : "", card.note].filter(Boolean).join(" \u00b7 ");
    list.appendChild(d);
  });
}

/* ── sharing ───────────────────────────────────────────────
   A plain-text summary, handed to the system share sheet where there is
   one and to the clipboard otherwise.  Nothing leaves the page on its
   own: no network, no new stored state, no library.            */
function scoreText() {
  const r = lastRound;
  if (!r) return "";
  const pct = Math.round(r.firstPass / r.total * 100);
  const filled = Math.round(pct / 10);
  if (r.trouble) {
    return "अभ्यास · sanskrit flashcards\n"
         + "Trouble cards — a drill of the " + r.total + " giving me most trouble\n"
         + "Known on the first showing: " + r.firstPass + " of " + r.total + " · " + pct + "%\n"
         + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled)
         + (r.justCleared ? "\n" + r.justCleared + " left the list" : "");
  }
  if (r.mixed) {
    const m = masteryPct();
    return "अभ्यास · sanskrit flashcards\n"
         + "Mixed review — a random draw across " + r.lists
         + " list" + (r.lists > 1 ? "s" : "") + "\n"
         + "Known cold: " + r.firstPass + " of " + r.total + " · " + pct + "%\n"
         + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled)
         + (m === null ? "" : "\nReview mastery: " + m + "%");
  }
  return "अभ्यास · sanskrit flashcards\n"
       + r.deck + (r.lesson ? "  (" + r.lesson + ")" : "") + "\n"
       + (r.reviewing ? "Review cleared: " : "Known on the first showing: ")
       + r.firstPass + " of " + r.total + " · " + pct + "%\n"
       + "\u25cf".repeat(filled) + "\u25cb".repeat(10 - filled);
}

function flashShare(msg) {
  const b = $('share');
  b.textContent = msg;
  setTimeout(() => { b.textContent = "Share score"; }, 1800);
}

/* Clipboard, with the file:// fallback older browsers still need. */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

async function shareScore() {
  const text = scoreText();
  if (!text) return;
  if (navigator.share) {                       // phones: the native sheet
    try { await navigator.share({ text }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user backed out
  }
  flashShare(await copyText(text) ? "copied \u2713" : "press \u2318/Ctrl+C");
}

/* Review mastery: every card ever drawn in a review, against the ones
   answered on the first showing.  One running average, not per list —
   the draw crosses lists by design. */
const masteryPct = () => {
  const r = SAVED.review;
  return r.seen ? Math.round(r.right / r.seen * 100) : null;
};

/* ── rank ──────────────────────────────────────────────────
   Review is the mastery system, and the rank is what it produces.  Two things
   have to be true to know a language's forms, and neither is mastery on its
   own:

     accuracy   how much comes back cold in a review draw, where the cards
                arrive shuffled out of their decks and days after the round
                that taught them
     coverage   how much of the course has been mastered at all

   A learner who recalls 95% of the fifty cards they have seen has not
   mastered the course, and one who has been through everything at 40% recall
   has not either.  So the two multiply rather than averaging: neither can
   carry the figure by itself.

   Both halves already exist and are already displayed elsewhere — this adds
   no new stored state, and nothing to migrate. */
const RANKS = [
  [80, 'Master'], [55, 'Expert'], [30, 'Skilled'], [10, 'Learner'], [0, 'Novice']
];

/* Course coverage: how much of the material has actually entered review.
   A list enters when it is completed, so this is the pool over everything —
   the same act the learner already understands ("finish a list and it starts
   coming back"), rather than a second, invisible notion of mastery. */
function coverageOf(ids) {
  const pool = new Set(reviewPool().map(cardKey));
  const within = ids || ALL_IDS;
  let done = 0;
  within.forEach(k => { if (pool.has(k)) done++; });
  const total = within.size;
  let pct = total ? Math.round(done / total * 100) : 0;
  if (pct === 100 && done < total) pct = 99;
  if (pct === 0 && done > 0) pct = 1;
  return { done: done, total: total, pct: pct, full: total > 0 && done === total };
}

/* Over the whole course by default, or over one track's cards when it is
   asked for one.  Same two readings and the same words either way: what
   changes is only how much material the figure is measured against, and
   over 2298 cards nothing a learner does in an evening visibly moves it. */
function rankOf(ids) {
  const acc = masteryPct();                  // null until the first review
  const cov = coverageOf(ids);
  if (acc === null) return { acc: null, cov: cov.pct, score: null, name: 'Unranked' };
  let score = Math.round(acc * cov.pct / 100);
  /* the same two guards progressOf uses: a figure may not round up to
     finished, nor round a real start away to nothing */
  if (score === 100 && !(acc === 100 && cov.full)) score = 99;
  if (score === 0 && acc > 0 && cov.done > 0) score = 1;
  return { acc: acc, cov: cov.pct, score: score,
           name: RANKS.find(r => score >= r[0])[1] };
}

/* ── scoreboard ────────────────────────────────────────────
   Nothing new is stored: every finished round already records its best
   result for that deck.  A deck appears only once it has been played
   through to the end — review rounds and abandoned rounds never set it,
   and the review mastery line above the list comes from the same tally
   the draws keep. */
function renderBoard() {
  /* Each panel shows its own action bar; closePanel hides whichever the
     open panel declared. */
  $('b-actions').hidden = false;
  /* Always on show, in one of three states, so the review is legible as a
     thing that exists well before there is a figure to put against it. */
  const mastery = masteryPct(), pool = reviewPool().length;
  $('b-mastery').hidden = false;
  $('b-mastery').classList.toggle('waiting', mastery === null);
  if (mastery !== null) {
    const r = SAVED.review;
    $('b-mpct').textContent = mastery + "%";
    $('b-msub').textContent = r.right + " of " + r.seen + " cards reviewed \u00b7 "
                            + r.runs + " session" + (r.runs > 1 ? "s" : "");
  } else {
    $('b-mpct').textContent = "";
    $('b-msub').textContent = pool >= REVIEW_MIN
      ? "unlocked \u00b7 open Abhyāsa from the drawer"
      : "locked \u00b7 " + pool + " of " + REVIEW_MIN + " cards from completed lists";
  }

  const rows = Object.keys(DECKS)
    .map(name => ({ name, best: (SAVED.decks[name] || {}).best }))
    .filter(d => d.best)
    .sort((a, b) => (b.best[0] / b.best[1]) - (a.best[0] / a.best[1])
                 || a.name.localeCompare(b.name));

  $('b-sub').textContent = rows.length
    ? rows.length + " of " + Object.keys(DECKS).length + " lists completed"
    : "";

  const list = $('b-list');
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = '<div class="clean">Nothing here yet — finish a list '
                   + 'and its best score will appear.</div>';
    return;
  }
  rows.forEach(d => {
    const pct = Math.round(d.best[0] / d.best[1] * 100);
    const lesson = LESSON_LABEL[DECK_LESSON[d.name]];
    const row = document.createElement('div');
    row.className = 'brow' + (pct === 100 ? ' full' : '');
    row.innerHTML = '<span class="b-name"></span>'
                  + '<span class="b-score"></span><span class="b-pct"></span>';
    const nm = row.querySelector('.b-name');
    nm.textContent = DECK_SHORT(d.name);
    if (lesson) {
      const tag = document.createElement('span');
      tag.className = 'b-stage';
      tag.textContent = lesson;
      nm.appendChild(tag);
    }
    row.querySelector('.b-score').textContent = d.best[0] + " / " + d.best[1];
    row.querySelector('.b-pct').textContent = pct + "%";
    list.appendChild(row);
  });
}

/* Opening a panel only hides things — the round in progress is left
   untouched, so closing it puts you back exactly where you were. */
let panelWas = null, panelOpen = null;
function syncBoardUI() {
  const done = finishedDecks().length, all = Object.keys(DECKS).length;
  $('dm-board').textContent = done
    ? 'best scores \u00b7 ' + done + ' of ' + all + ' lists completed'
    : 'best scores \u00b7 no list finished yet';
  $('dr-board').classList.toggle('on', panelOpen === 'board');
}

/* Each window: what renders it, which button opens it, and the action bar
   that belongs to it.  Every relabel() runs on every open and close, so a
   button can never be left reading "back to the cards" for a shut panel. */
const PANELS = {
  study:       { render: renderStudy,       relabel: syncStudyUI },
  board:       { render: renderBoard,       relabel: syncBoardUI,   actions: 'b-actions' },
  reviewpanel: { render: renderReviewPanel, relabel: syncReviewUI,  actions: 'rp-actions' },
  trouble:     { render: renderTrouble,     relabel: syncTroubleUI, actions: 't-actions' }
};
const relabelAll = () => { syncNav(); Object.values(PANELS).forEach(x => x.relabel()); };

function closePanel() {
  if (!panelOpen) return;
  const spec = PANELS[panelOpen];
  $(panelOpen).style.display = 'none';
  if (spec.actions) $(spec.actions).hidden = true;
  $('panel-back').hidden = true;
  panelOpen = null;
  relabelAll();
  $('welcome').hidden = panelWas.welcome;
  $('trackcard').hidden = panelWas.trackcard;
  $('card').style.display = panelWas.card;
  $('review').style.display = panelWas.review;
  $('tally').style.visibility = panelWas.tally;
  $('grade').hidden = panelWas.grade;
  $('after').hidden = panelWas.after;
  $('keys').hidden = panelWas.keys;
  $('controls').hidden = panelWas.controls;
  panelWas = null;
}

/* Opened from the drawer rather than from a button that stays on screen, so
   the button cannot double as the way out — #panel-back does that instead. */
function openPanel(which) {
  closePop();
  if (panelOpen === which) { PANELS[which].render(); return; }
  if (panelOpen) closePanel();                  // swapping one panel for the other
  panelWas = {
    welcome: $('welcome').hidden, trackcard: $('trackcard').hidden,
    card: $('card').style.display, review: $('review').style.display,
    tally: $('tally').style.visibility, grade: $('grade').hidden,
    after: $('after').hidden, keys: $('keys').hidden,
    controls: $('controls').hidden
  };
  $('welcome').hidden = true;
  $('trackcard').hidden = true;
  $('card').style.display = 'none';
  $('review').style.display = 'none';
  $('tally').style.visibility = 'hidden';
  $('grade').hidden = true;
  $('after').hidden = true;
  $('keys').hidden = true;
  $('controls').hidden = true;      // they change a card; none is showing
  $(which).style.display = 'block';
  $('panel-back').hidden = false;
  panelOpen = which;
  relabelAll();
  PANELS[which].render();
}
/* ── Study ──────────────────────────────────────────────────
   The lesson's own reference.md, as written.  Everything here was decided at
   build time; this only puts it on screen, so an inconsistency in a reference
   is a content bug to fix in the lesson rather than something to reinterpret
   in the reader. */
function renderStudy() {
  const ref = studyFor();
  const key = deckName ? DECK_LESSON[deckName] : null;
  /* Titled from the lesson, not from the reference's own h1: the drawer and
     Study then cannot disagree about what a lesson is called, whatever a
     given reference file happens to head itself with. */
  $('st-title').textContent = key ? LESSON_LABEL[key] : 'Study';
  $('st-sub').textContent = key && LESSON_GLOSS[key]
    ? LESSON_GLOSS[key] + ' \u00b7 reference' : 'reference';
  $('st-body').innerHTML = ref ? ref.html : '';

  /* A contents list is built only for a reference long enough to need one —
     the build decides, and hands over an empty list otherwise. */
  const toc = $('st-toc');
  toc.innerHTML = '';
  toc.hidden = !ref || !ref.toc.length;
  if (toc.hidden) return;
  ref.toc.forEach(t => {
    const a = document.createElement('button');
    a.className = 'st-link';
    a.textContent = t.text;
    a.addEventListener('click', () => {
      const h = document.getElementById(t.id);
      if (h) h.scrollIntoView({ block: 'start' });
    });
    toc.appendChild(a);
  });
  $('st-body').scrollTop = 0;
}

/* ── the trouble window ─────────────────────────────────────
   The list, what it takes to get off it, and how many have. */
function renderTrouble() {
  const cards = troubleCards();
  $('t-sub').textContent = (cards.length
      ? cards.length + " on the list"
      : "nothing on the list")
    + " \u00b7 " + SAVED.cleared + " cleared";
  $('t-note').textContent = "A card lands here after " + TROUBLE_WRONG
    + " wrong answers, and leaves after " + TROUBLE_CLEAR
    + " right ones in separate sittings. A wrong answer starts that count again.";

  const list = $('t-list');
  list.innerHTML = "";
  $('t-actions').hidden = false;
  $('t-drill').hidden = !cards.length;
  $('t-copy').hidden = !cards.length;
  if (!cards.length) {
    list.innerHTML = '<div class="clean">Nothing is giving you trouble yet.</div>';
    return;
  }
  cards.forEach(card => {
    const d = document.createElement('div');
    d.className = 'row';
    d.innerHTML = '<span class="r-dn"></span><span class="r-iast"></span>'
                + '<span class="t-count"></span>'
                + '<span class="r-gloss"></span><span class="r-tag"></span>';
    d.querySelector('.r-dn').textContent    = card.devanagari;
    d.querySelector('.r-iast').textContent  = card.iast;
    d.querySelector('.t-count').textContent = SAVED.trouble[cardKey(card)].w + " wrong";
    d.querySelector('.r-gloss').textContent = card.gloss;
    d.querySelector('.r-tag').textContent   =
      [DECK_SHORT(DECK_OF.get(card) || ""), card.note].filter(Boolean).join(" \u00b7 ");
    list.appendChild(d);
  });
}

/* The copyable form: the same pipe-delimited shape as the card data, so a
   pasted list drops straight back into a deck file. */
function troubleText() {
  const cards = troubleCards();
  return "अभ्यास \u00b7 trouble cards (" + cards.length + ")\n"
       + SAVED.cleared + " cleared so far\n\n"
       + cards.map(c => [c.devanagari, c.iast, c.gloss].join(" | ")).join("\n");
}

function syncTroubleUI() {
  const n = troubleCards().length;
  $('dm-trouble').textContent =
    (n ? n + ' card' + (n > 1 ? 's' : '') + ' to clear' : 'nothing on the list')
    + (SAVED.cleared ? ' \u00b7 ' + SAVED.cleared + ' cleared' : '');
  $('dr-trouble').classList.toggle('on', panelOpen === 'trouble');
}

/* ── wiring ────────────────────────────────────────────── */
$('card').addEventListener('click', reveal);

/* the case popover: the chip swallows its own tap so the document
   listener below does not close what was just opened */
$('tag').addEventListener('click', e => {
  const b = e.target.closest('.ann');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  if (popFor === b) closePop(); else openPop(b);
});
$('pop').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', closePop);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
window.addEventListener('resize', () => { if (popFor) placePop(popFor); });
window.addEventListener('scroll', () => { if (popFor) placePop(popFor); }, { passive: true });
$('knew').addEventListener('click', knew);
$('g-next').addEventListener('click', gradedNext);
$('s-back').addEventListener('click', seqBack);
$('s-reset').addEventListener('click', seqReset);
$('s-check').addEventListener('click', seqCheck);
$('miss').addEventListener('click', didntKnow);
$('again-missed').addEventListener('click', () => {
  if (!missed.length) return;          // nothing to review — should be unreachable
  startRound([...missed], { review: true, mixed, trouble });   // only the ones marked "Didn't know it"
});
$('nav').addEventListener('click', () => drawerOpen() ? closeDrawer() : openDrawer());
$('dr-close').addEventListener('click', closeDrawer);
$('dveil').addEventListener('click', closeDrawer);
$('dr-home').addEventListener('click', () => openFromDrawer(showWelcome));
$('dr-board').addEventListener('click', () => openFromDrawer(() => openPanel('board')));
$('dr-prog').addEventListener('click', () => openFromDrawer(() => openPanel('reviewpanel')));
$('dr-trouble').addEventListener('click', () => openFromDrawer(() => openPanel('trouble')));
$('study-btn').addEventListener('click',
  () => panelOpen === 'study' ? closePanel() : openPanel('study'));
$('p-back').addEventListener('click', closePanel);
$('rp-draw').addEventListener('click', async () => {
  if (roundInProgress() && !await ask('Leave this round to review?', 'Leave it')) return;
  startMixedReview();
});
$('restart').addEventListener('click',
  () => trouble ? startTroubleDrill() : mixed ? startMixedReview() : loadDeck(deckName));
$('t-drill').addEventListener('click', async () => {
  if (roundInProgress() && !await ask('Leave this round for the drill?', 'Leave it')) return;
  startTroubleDrill();
});
$('t-copy').addEventListener('click', async () => {
  const b = $('t-copy'), ok = await copyText(troubleText());
  b.textContent = ok ? "copied \u2713" : "press \u2318/Ctrl+C";
  setTimeout(() => { b.textContent = "Copy the list"; }, 1800);
});
$('share').addEventListener('click', shareScore);

/* ── the two controls a tester needs ───────────────────────
   A report that cannot be reproduced is a report you cannot act on, and a
   tester who wants to see the first run again should not have to know where
   a browser keeps its site data. */
$('b-copy').addEventListener('click', async () => {
  const b = $('b-copy'), ok = await copyText(JSON.stringify(SAVED));
  b.textContent = ok ? 'copied \u2713' : 'press \u2318/Ctrl+C';
  setTimeout(() => { b.textContent = 'Copy my progress'; }, 1800);
});
$('b-reset').addEventListener('click', async () => {
  if (!await ask('Start over? Every score, every card learnt and every list '
                 + 'completed will be forgotten. This cannot be undone.',
                 'Erase everything')) return;
  try { localStorage.removeItem(STORE_KEY); OLD_KEYS.forEach(k => localStorage.removeItem(k)); }
  catch (e) {}
  location.reload();
});

/* switching lists or jumping to the pile discards a round in progress —
   ask first once anything has been graded */
function roundInProgress() {
  return current !== null && (learned + missed.length) > 0;
}

/* Our own dialog rather than window.confirm.  A page opened inside an app's
   file viewer may have no handler for confirm() at all, in which case it
   returns false without ever showing anything — and the round it was
   guarding could not be left until it had been played out. */
let askResolve = null;
function ask(message, yes) {
  closePop();
  $('ask-msg').textContent = message;
  $('ask-yes').textContent = yes;
  $('veil').hidden = false;
  $('ask').hidden = false;
  /* focus the harmless button: space is "flip the card" everywhere else in
     this app, and a stray one must not be what throws the round away */
  $('ask-no').focus();
  return new Promise(resolve => { askResolve = resolve; });
}
function answer(v) {
  if (!askResolve) return;
  $('ask').hidden = true;
  $('veil').hidden = true;
  const done = askResolve; askResolve = null;
  done(v);
}
$('ask-yes').addEventListener('click', () => answer(true));
$('ask-no').addEventListener('click', () => answer(false));
$('veil').addEventListener('click', () => answer(false));

$('pile').addEventListener('click', async () => {
  if (roundInProgress()
      && !await ask('Leave this round for the missed pile?', 'Leave it')) return;
  const cards = pileCards();
  if (cards.length) startRound(cards, { review: true });
});
$('dir').addEventListener('click', () => setDir(DIR === 'produce' ? 'reveal' : 'produce'));
$('iast-on').addEventListener('change', e => setIast(e.target.checked));
document.addEventListener('keydown', e => {
  if (askResolve) {                      // a question is on screen; answer that
    if (e.key === 'Escape') { e.preventDefault(); answer(false); }
    return;
  }
  if (drawerOpen()) {                    // the drawer is modal over the round
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
    return;
  }
  const t = e.target.tagName;
  if (t === 'BUTTON' || t === 'SELECT' || t === 'INPUT' || t === 'TEXTAREA') return;   // let native activation work

  /* On an interactive card the keys drive the interaction rather than grade a
     flip, so these arms run first and return. */
  const kind = current ? (current.card.type || 'reveal') : 'reveal';

  if (current && kind === 'choice') {
    if (choiceRight === null) {
      const n = +e.key;
      const opts = $('choices').children;
      if (n >= 1 && n <= opts.length) { e.preventDefault(); opts[n - 1].click(); }
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); choiceNext();
    }
    return;
  }

  if (current && kind === 'sequence') {
    if (seqRight !== null) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); seqNext(); }
      return;
    }
    const n = +e.key;
    const bank = $('bank').children;
    if (n >= 1 && n <= bank.length) { e.preventDefault(); bank[n - 1].click(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); seqBack(); return; }
    if (e.key === 'Enter') { e.preventDefault(); seqCheck(); return; }
    return;
  }

  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
  if (!$('grade').hidden && e.key === '1') didntKnow();
  if (!$('grade').hidden && e.key === '2') knew();
});

setDir(DIR);
setIast(IAST);
loadDeck(SAVED.deck);        // resolves the list, its labels and its toggles
relabelAll();
/* ...and then land on the welcome, so the list is one tap away rather than
   already running.  loadDeck() above has left the app ready for it. */
showWelcome();
$('w-board').addEventListener('click', () => openPanel('board'));
/* Test mode opens every track and list at once; turning it off again
   restores whichever gates have not been pressed through. */
$('w-test').addEventListener('change', e => {
  SAVED.guided = !e.target.checked;
  save();
  renderDrawer();
});

/* Load-time validation.  Silent while the card block is clean — the counts
   are for whoever edits the deck data, not for whoever is studying — but
   still loud the moment a line fails to parse, so a typo cannot pass
   unnoticed. */
(() => {
  const el = $('validate');
  if (PARSE.count && !PARSE.skipped.length) return;
  el.textContent = PARSE.fatal
    ? PARSE.fatal
    : PARSE.count + " cards \u00b7 " + PARSE.decks + " decks \u00b7 "
      + PARSE.skipped.length + " cards skipped";
  el.classList.add('bad');
  if (PARSE.skipped.length) {
    const ul = document.createElement('div');
    ul.className = 'skiplist';
    PARSE.skipped.forEach(sk => {
      const d = document.createElement('div');
      d.textContent = sk.id + " in \u201c" + sk.deck + "\u201d (" + sk.why + ")";
      ul.appendChild(d);
    });
    el.appendChild(ul);
    console.warn("skipped cards", PARSE.skipped);
  }
})();
