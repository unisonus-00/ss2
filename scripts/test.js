#!/usr/bin/env node
/* Regression tests for the built distributable.
 *
 * These guard the compatibility list in CLAUDE.md — saved progress, the
 * cards, review, the IAST toggle, mobile usability — which are exactly the
 * things a refactor breaks silently.
 *
 * Not wired to a test framework and deliberately not in package.json: the app
 * has no dependencies and should keep none.  To run:
 *
 *   npm i playwright-core          # once, anywhere on the path
 *   node scripts/build.js
 *   node scripts/test.js
 *
 * CHROME can point at any Chromium; it defaults to the one preinstalled in
 * the Claude Code environment.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'abhyasah.html');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DECK = 'Puruṣa-lakāra — person, tense and mood · practice';

/* Expected counts come from the practice files themselves, so adding a
   lesson's practice does not break the suite — what is checked is that the
   build carried across everything the sources declare.  The lexical layer is
   run here too, over the same lessons the build runs it over, so a generated
   list is counted exactly as an authored one is and a generator that stopped
   being deterministic shows up as a mismatch. */
const EXPECTED = (() => {
  const fs = require('fs');
  const root = path.resolve(__dirname, '..');
  const lexicon = require('./lexicon');
  const lessons = [];
  for (const d of fs.readdirSync(root).sort()) {
    if (/^\d\d-/.test(d) && fs.existsSync(path.join(root, d, 'practice.json'))) {
      lessons.push({ lesson: d, stage: +d.slice(0, 2),
                     decks: JSON.parse(fs.readFileSync(path.join(root, d, 'practice.json'), 'utf8')).decks });
    }
  }
  if (fs.existsSync(path.join(root, 'practice.json'))) {
    lessons.push({ lesson: '00-overview', stage: 0,
                   decks: JSON.parse(fs.readFileSync(path.join(root, 'practice.json'), 'utf8')).decks });
  }
  const lex = lexicon.apply(lessons);
  if (lex.problems.length) throw new Error('lexicon: ' + lex.problems.join(' | '));
  let decks = 0, cards = 0;
  for (const L of lessons) for (const d of L.decks) { decks++; cards += d.cards.length; }
  return { lessons: lessons.length, decks, cards, generated: lex.made, clued: lex.clued };
})();

const fail = [];
const ok = (name, cond, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ' + detail : ''));
  if (!cond) fail.push(name);
};

const open = async (browser, opts = {}) => {
  const p = await browser.newPage(opts);
  p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
  await p.goto(FILE, { waitUntil: 'load' });
  await p.evaluate(d => loadDeck(d), DECK);
  return p;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  // ── 1. loads clean ────────────────────────────────────────────────
  {
    const p = await browser.newPage();
    const errs = [], net = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('request', r => { if (!r.url().startsWith('file://')) net.push(r.url()); });
    await p.goto(FILE, { waitUntil: 'load' });

    const r = await p.evaluate(() => ({
      decks: Object.keys(DECKS).length,
      cards: Object.values(DECKS).reduce((a, b) => a + b.length, 0),
      skipped: PARSE.skipped.length,
      fatal: PARSE.fatal || null,
      validateShown: !!document.getElementById('validate').textContent,
      groups: LESSONS.map(L => L.label),
      options: LESSONS.reduce((a, L) => a + L.decks.length, 0),
      tracks: TRACK_ROWS.map(r => r.track.name),
      glossed: LESSONS.filter(L => LESSON_GLOSS[L.lesson]).length,
      idsOnCards: Object.values(DECKS).every(cs => cs.every(c => typeof c.id === 'string' && c.id.includes(':'))),
    }));

    ok('no JS errors', errs.length === 0, errs.join('; '));
    ok('no network requests', net.length === 0, net.join('; '));
    ok('every deck in the sources reached the build',
      r.decks === EXPECTED.decks, r.decks + ' of ' + EXPECTED.decks);
    ok('every card in the sources reached the build',
      r.cards === EXPECTED.cards, r.cards + ' of ' + EXPECTED.cards);
    ok('nothing skipped', r.skipped === 0 && !r.fatal, r.fatal || '');
    ok('validation banner silent', !r.validateShown);
    ok('every card has an id', r.idsOnCards);
    ok('navigation grouped by lesson', r.groups.length === EXPECTED.lessons,
      r.groups.length + ' of ' + EXPECTED.lessons + ' lessons');
    /* Devanāgarī comes first because the script comes before the words: a
       learner who cannot decode the page does not meet Nāma as vocabulary. */
    ok('groups are curriculum-ordered',
      JSON.stringify(r.groups.slice(0, 4)) ===
      JSON.stringify(['Devanāgarī', 'Nāma', 'Varṇa-Vidyā', 'Sandhi']),
      r.groups.slice(0, 4).join(' | '));
    ok('cross-cutting practice comes last',
      r.groups[r.groups.length - 1] === 'Saṃjñā',
      r.groups[r.groups.length - 1]);
    // a stage number is repository layout, not something a learner reads
    ok('no lesson name carries a stage number',
      r.groups.every(g => !/^\d+\s*·/.test(g)), r.groups.filter(g => /^\d+\s*·/.test(g)).join(' | '));
    ok('every lesson has an English gloss beside its name',
      r.glossed === r.groups.length, r.glossed + ' of ' + r.groups.length);
    ok('every deck reachable from the drawer', r.options === EXPECTED.decks,
      r.options + ' of ' + EXPECTED.decks);
    console.log('        groups: ' + r.groups.join(' | '));
    await p.close();
  }

  // ── 2. a full round still works ───────────────────────────────────
  {
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const first = Object.keys(DECKS)[0];
      loadDeck(first);
      const started = !!current, q0 = queue.length;
      reveal();
      knew();
      const afterKnew = { learned, q: queue.length };
      didntKnow();
      const afterMiss = { missed: missed.length };
      return { deck: first, started, q0, afterKnew, afterMiss };
    });
    ok('round starts', r.started, r.deck);
    ok('right answer retires a card', r.afterKnew.learned === 1 && r.afterKnew.q === r.q0 - 1);
    ok('wrong answer joins the missed pile', r.afterMiss.missed === 1);
    await p.close();
  }

  // ── 3. the loss record migrates off the old text key ──────────────
  {
    const p = await browser.newPage();
    // Seed v1-shaped saved state before the app script runs.
    await p.addInitScript(() => {
      try {
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          decks: { '01 · Devī — goddess names': { best: 12 } },
          trouble: { 'कामाक्षी¦she of loving eyes': { w: 3, r: 1, s: 'old' } },
          cleared: 4,
        }));
      } catch (e) {}
    });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('abhyāsaḥ'));
      return {
        version: raw.v,
        oldGone: !raw.trouble['कामाक्षी¦she of loving eyes'],
        newRec: raw.trouble['01-nama:devi:kamaksi'] || null,
        deckBestKept: raw.decks['01 · Devī — goddess names'],
        /* the gate: a learner already holding a best score in Nāma has
           plainly met the track it belongs to, and is not sent back to it */
        begun: raw.begun || {},
      };
    });
    // the chain runs to the end, not just to the step under test
    ok('saved state runs the whole migration chain', r.version === 8, 'v' + r.version);
    ok('a track already practised in is not re-gated',
      !!r.begun.bhasha && !!r.begun.home,
      Object.keys(r.begun).join(' | ') || 'none');
    ok('old text key removed', r.oldGone);
    ok('record moved onto the stable id', r.newRec && r.newRec.w === 3, JSON.stringify(r.newRec));
    ok('per-deck best score untouched', r.deckBestKept && r.deckBestKept.best === 12, JSON.stringify(r.deckBestKept));
    await p.close();
  }

  // ── 4. IAST toggle and morphology tooltips still there ────────────
  {
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      loadDeck(Object.keys(DECKS)[0]);
      reveal();
      const iastBox = document.getElementById('iast-on');
      const before = getComputedStyle(document.querySelector('.iast') || document.body).display;
      setIast(!IAST);
      const after = IAST;
      setIast(!IAST);
      return {
        hasIastControl: !!iastBox,
        toggled: after !== undefined,
        hasNote: !!document.querySelector('.tag, .note, #note'),
        cardHasId: !!(current && current.card && current.card.id),
      };
    });
    ok('IAST control present', r.hasIastControl);
    ok('IAST toggle runs', r.toggled);
    ok('morphology annotation rendered', r.hasNote);
    ok('current card carries its id', r.cardHasId);
    await p.close();
  }


  
  // ── renders as a choice, not a flashcard ──────────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => ({
      isChoice: document.getElementById('card').classList.contains('choice'),
      n: document.querySelectorAll('#choices .opt').length,
      prompt: document.getElementById('dn').textContent,
      choicesShown: !document.getElementById('choices').hidden,
      dirDisabled: document.getElementById('dir').disabled,
      keys: document.getElementById('keys').textContent,
      glossEmpty: document.getElementById('gloss').textContent === '',
      open: document.getElementById('card').classList.contains('open'),
    }));
    ok('card renders as a choice', r.isChoice);
    ok('2-4 options shown', r.n >= 2 && r.n <= 4, r.n + ' options');
    ok('prompt states a task', /^[^\n]+:/.test(r.prompt) || /\?$/.test(r.prompt),
      JSON.stringify(r.prompt));
    ok('options visible', r.choicesShown);
    ok('answer not shown before answering', !r.open && r.glossEmpty);
    ok('direction toggle disabled', r.dirDisabled);
    ok('key hint adapted', /tap an answer/.test(r.keys), JSON.stringify(r.keys));
    await p.close();
  }

  // ── tapping the card does NOT give the answer away ────────────────
  {
    const p = await open(browser);
    await p.click('#card', { position: { x: 10, y: 10 } });
    const stillClosed = await p.evaluate(() =>
      !document.getElementById('card').classList.contains('open')
      && document.getElementById('grade').hidden);
    ok('tapping the card does not reveal', stillClosed);
    await p.evaluate(() => { window.dispatchEvent(new Event('x')); });
    await p.keyboard.press('Space');
    const stillClosed2 = await p.evaluate(() =>
      !document.getElementById('card').classList.contains('open'));
    ok('space does not reveal', stillClosed2);
    await p.close();
  }

  // ── a correct tap grades as knew() ────────────────────────────────
  {
    const p = await open(browser);
    const before = await p.evaluate(() => ({ learned, missed: missed.length, id: current.card.id }));
    await p.evaluate(() => {
      const a = current.card.answer;
      [...document.querySelectorAll('#choices .opt')].find(b => b.textContent === a).click();
    });
    const mid = await p.evaluate(() => ({
      locked: [...document.querySelectorAll('#choices .opt')].every(b => b.disabled),
      right: document.querySelectorAll('#choices .opt.right').length,
      wrong: document.querySelectorAll('#choices .opt.wrong').length,
      open: document.getElementById('card').classList.contains('open'),
      note: document.getElementById('tag').textContent,
      nextShown: !document.getElementById('graded-next').hidden,
      gradeHidden: document.getElementById('grade').hidden,
    }));
    ok('options lock after answering', mid.locked);
    ok('correct option marked right', mid.right === 1 && mid.wrong === 0);
    ok('note revealed', mid.open && mid.note.length > 0, JSON.stringify(mid.note.slice(0, 48)));
    ok('single Next button, not the two grade buttons', mid.nextShown && mid.gradeHidden);

    await p.click('#g-next');
    const after = await p.evaluate(() => ({ learned, missed: missed.length }));
    ok('correct answer counts as one retrieval', after.learned === before.learned + 1);
    ok('correct answer adds nothing to the missed pile', after.missed === before.missed);
    await p.close();
  }

  // ── a wrong tap grades as didntKnow() and records the loss ────────
  {
    const p = await open(browser);
    const before = await p.evaluate(() => ({ learned, missed: missed.length, id: current.card.id }));
    await p.evaluate(() => {
      const a = current.card.answer;
      [...document.querySelectorAll('#choices .opt')].find(b => b.textContent !== a).click();
    });
    const mid = await p.evaluate(() => ({
      right: document.querySelectorAll('#choices .opt.right').length,
      wrong: document.querySelectorAll('#choices .opt.wrong').length,
    }));
    ok('wrong tap marks both the miss and the answer', mid.wrong === 1 && mid.right === 1);

    await p.click('#g-next');
    const after = await p.evaluate(() => ({
      learned, missed: missed.length,
      trouble: JSON.parse(localStorage.getItem('abhyāsaḥ')).trouble,
    }));
    ok('wrong answer joins the missed pile', after.missed === before.missed + 1);
    ok('wrong answer does not count as learned', after.learned === before.learned);
    ok('the loss is recorded against the card id, and dated',
      after.trouble[before.id] && after.trouble[before.id].w === 1
        && /^\d{4}-\d\d-\d\d$/.test(after.trouble[before.id].m),
      JSON.stringify(after.trouble[before.id]));
    await p.close();
  }

  // ── re-shown after a miss, still answerable ───────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const first = current.card.id;
      // miss it
      [...document.querySelectorAll('#choices .opt')].find(b => b.textContent !== current.card.answer).click();
      document.getElementById('g-next').click();
      // walk the queue until the missed card comes back
      let guard = 0, seen = false;
      while (current && guard++ < 40) {
        if (current.card.id === first) { seen = true; break; }
        const c = current.card;
        if ((c.type || 'reveal') === 'choice') {
          [...document.querySelectorAll('#choices .opt')].find(b => b.textContent === c.answer).click();
          document.getElementById('g-next').click();
        } else { reveal(); knew(); }
      }
      return {
        seen,
        relearnFlag: !document.getElementById('relearn').hidden,
        answerable: [...document.querySelectorAll('#choices .opt')].every(b => !b.disabled),
        clean: document.querySelectorAll('#choices .opt.right, #choices .opt.wrong').length === 0,
      };
    });
    ok('missed choice card comes back in the round', r.seen);
    ok('re-show is marked "second look"', r.relearnFlag);
    ok('re-show resets the options', r.answerable && r.clean);
    await p.close();
  }

  // ── keyboard picks an option ──────────────────────────────────────
  {
    const p = await open(browser);
    await p.evaluate(() => document.getElementById('card').blur());
    await p.keyboard.press('1');
    const r = await p.evaluate(() => ({
      answered: document.querySelectorAll('#choices .opt.right').length === 1,
      nextShown: !document.getElementById('graded-next').hidden,
    }));
    ok('number key answers', r.answered && r.nextShown);
    await p.keyboard.press('Enter');
    const advanced = await p.evaluate(() =>
      document.getElementById('graded-next').hidden
      && document.querySelectorAll('#choices .opt.right, #choices .opt.wrong').length === 0);
    ok('Enter advances after answering', advanced);
    await p.close();
  }

  // ── options are shuffled, not fixed in authored order ─────────────
  {
    const p = await open(browser);
    const orders = await p.evaluate(() => {
      const seen = new Set();
      for (let i = 0; i < 30; i++) {
        paintChoice(current.card);
        seen.add([...document.querySelectorAll('#choices .opt')].map(b => b.textContent).join('|'));
      }
      return [...seen].length;
    });
    ok('option order varies between showings', orders > 1, orders + ' distinct orders');
    await p.close();
  }

  // ── mixed round: reveal and choice cards side by side ─────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      // build a round mixing the choice deck with a reveal deck
      const mix = [...DECKS['Puruṣa-lakāra — person, tense and mood · practice'].slice(0, 3),
                   ...DECKS['10 · Kriyā — verbs in form'].slice(0, 3)];
      startRound(mix, {});
      const kinds = [];
      let guard = 0;
      while (current && guard++ < 20) {
        const c = current.card;
        const isChoice = (c.type || 'reveal') === 'choice';
        kinds.push(isChoice ? 'choice' : 'reveal');
        const cardIsChoice = document.getElementById('card').classList.contains('choice');
        if (isChoice !== cardIsChoice) return { mismatch: c.id };
        if (isChoice) {
          [...document.querySelectorAll('#choices .opt')].find(b => b.textContent === c.answer).click();
          document.getElementById('g-next').click();
        } else { reveal(); knew(); }
      }
      return { kinds, learned };
    });
    ok('reveal and choice cards interleave in one round', !r.mismatch, r.mismatch || (r.kinds || []).join(','));
    ok('every card in the mixed round graded', r.learned === 6, 'learned ' + r.learned);
    await p.close();
  }

  // ── mobile: options are real touch targets, no sideways scroll ─────
  {
    const p = await open(browser, { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
    const r = await p.evaluate(() => {
      const opts = [...document.querySelectorAll('#choices .opt')];
      return {
        minH: Math.min(...opts.map(b => b.getBoundingClientRect().height)),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        fits: opts.every(b => b.getBoundingClientRect().right <= window.innerWidth),
      };
    });
    ok('options meet the 44px touch target', r.minH >= 44, r.minH + 'px');
    ok('no horizontal overflow on a 360px screen', !r.overflow);
    ok('options fit the viewport', r.fits);
    /* Written to the OS temp dir, never into the repo — a test should not
       leave build products lying in the working tree. */
    if (process.env.SHOTS) {
      const out = path.join(require('os').tmpdir(), 'abhyasah-choice-mobile.png');
      await p.screenshot({ path: out });
      console.log('        screenshot: ' + out);
    }
    await p.close();
  }

  
  // ── choice cards feed the missed pile and its replay ──────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      // fail a short round outright
      startRound(DECKS['Puruṣa-lakāra — person, tense and mood · practice'].slice(0, 3), {});
      let g = 0;
      while (current && g++ < 30) {
        [...document.querySelectorAll('#choices .opt')].find(x => x.textContent !== current.card.answer).click();
        document.getElementById('g-next').click();
      }
      const finished = { done: current === null, missed: missed.length,
                         after: !document.getElementById('after').hidden };
      document.getElementById('again-missed').click();
      const replay = { len: queue.length + 1,
                       isChoice: document.getElementById('card').classList.contains('choice'),
                       opts: document.querySelectorAll('#choices .opt').length };
      return { finished, replay };
    });
    ok('a choice round finishes and offers the misses',
      r.finished.done && r.finished.missed === 3 && r.finished.after);
    ok('"practise these again" replays choice cards',
      r.replay.len === 3 && r.replay.isChoice && r.replay.opts >= 2);
    await p.close();
  }
  // ── the sandhi set drills the operation, not the rule names ───────
  {
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      /* The practice set spans more than one deck since it was chunked, so
         it is gathered from the lesson rather than named — a test that names
         a deck breaks the next time one is split. */
      const d = [];
      Object.keys(DECKS).forEach(n => {
        if (DECK_LESSON[n] === '03-sandhi') DECKS[n].forEach(c => {
          if ((c.type || 'reveal') === 'choice') d.push(c);
        });
      });
      if (!d.length) return { missing: true };
      const kinds = { join: 0, split: 0, name: 0, category: 0 };
      d.forEach(c => { const g = c.id.split(':')[1]; if (g in kinds) kinds[g]++; });
      // every card is a choice with a well-formed option set
      const bad = d.filter(c => c.type !== 'choice' || !c.options.includes(c.answer)
        || new Set(c.options).size !== c.options.length);
      // drive one join and one split
      const join = d.find(c => c.id.startsWith('03-sandhi:join:'));
      startRound([join], {});
      const joinPrompt = document.getElementById('dn').textContent;
      [...document.querySelectorAll('#choices .opt')].find(b => b.textContent === join.answer).click();
      const joinNote = document.getElementById('tag').textContent;
      document.getElementById('g-next').click();
      const split = d.find(c => c.id.startsWith('03-sandhi:split:'));
      startRound([split], {});
      const splitPrompt = document.getElementById('dn').textContent;
      const splitOpts = [...document.querySelectorAll('#choices .opt')].map(b => b.textContent);
      const home = DECK_OF.get(d[0]);
      return { kinds, bad: bad.map(c => c.id), joinPrompt, joinNote, splitPrompt, splitOpts,
               stage: DECK_STAGE[home], lesson: DECK_LESSON[home] };
    });
    ok('the sandhi practice deck is present', !r.missing);
    ok('it sits in lesson 03-sandhi', r.lesson === '03-sandhi' && r.stage === 3,
      r.lesson + ' / stage ' + r.stage);
    ok('every sandhi card is a well-formed choice', r.bad && r.bad.length === 0, (r.bad || []).join(', '));
    /* Splits sit at 3, not 5: two of them asked for a join the `S ·` rule
       lists already carry, and those lists reverse into the same split with
       free recall rather than three options.  The badge's three categories
       are still all covered. */
    ok('it covers joins, splits, naming and category',
      r.kinds && r.kinds.join >= 15 && r.kinds.split >= 3 && r.kinds.name >= 3 && r.kinds.category >= 2,
      JSON.stringify(r.kinds));
    ok('a join card asks for the combination',
      /^Join: .+ \+ /.test(r.joinPrompt), JSON.stringify(r.joinPrompt));
    ok('a join card names its rule on the answer',
      /sandhi|guṇa|vṛddhi|savarṇa|yan|jaśtva|anusvāra|anunāsika|śchutva|ādeśa|lopa/i.test(r.joinNote),
      JSON.stringify(r.joinNote));
    ok('a split card asks a form to be taken apart',
      /^Split: \S/.test(r.splitPrompt), JSON.stringify(r.splitPrompt));
    ok('split options are word pairs',
      r.splitOpts && r.splitOpts.every(o => o.includes(' + ')), JSON.stringify(r.splitOpts));
    await p.close();
  }

  // ── sequence: assemble supplied pieces by tapping ─────────────────
  const SEQ = 'Prakriyā — order the stages · practice';
  const openSeq = async (id) => {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.evaluate(([deck, cid]) => {
      loadDeck(deck);
      const d = DECKS[deck];
      startRound([cid ? d.find(c => c.id === cid) : d[0]], {});
    }, [SEQ, id]);
    return p;
  };

  {
    const p = await openSeq();
    const r = await p.evaluate(() => ({
      isSeq: document.getElementById('card').classList.contains('seq-card'),
      seqShown: !document.getElementById('seq').hidden,
      bank: [...document.querySelectorAll('#bank .chip')].map(c => c.textContent),
      builtEmpty: document.getElementById('built').children.length === 0,
      actionsShown: !document.getElementById('seq-actions').hidden,
      checkDisabled: document.getElementById('s-check').disabled,
      backDisabled: document.getElementById('s-back').disabled,
      dirDisabled: document.getElementById('dir').disabled,
      keys: document.getElementById('keys').textContent,
      answerHidden: document.getElementById('gloss').textContent === ''
        && !document.getElementById('card').classList.contains('open'),
      parts: current.card.parts.length,
    }));
    ok('card renders as a sequence', r.isSeq && r.seqShown);
    ok('all pieces start in the bank', r.bank.length === r.parts && r.builtEmpty, r.bank.join(' '));
    ok('Back/Check disabled while nothing is placed', r.checkDisabled && r.backDisabled);
    ok('build controls shown', r.actionsShown);
    ok('direction toggle disabled', r.dirDisabled);
    ok('key hint adapted', /tap the pieces/.test(r.keys), JSON.stringify(r.keys));
    ok('answer hidden before checking', r.answerHidden);
    await p.close();
  }

  {
    // no dragging anywhere: the plan forbids it outright
    const p = await openSeq();
    const r = await p.evaluate(() => {
      const all = [...document.querySelectorAll('#seq *')];
      return {
        draggable: all.filter(e => e.draggable || e.getAttribute('draggable') === 'true').length,
        inputs: document.querySelectorAll('#seq input, #seq textarea, #seq [contenteditable]').length,
        allButtons: [...document.querySelectorAll('#seq .chip')].every(e => e.tagName === 'BUTTON'),
        chips: document.querySelectorAll('#seq .chip').length,
      };
    });
    ok('nothing in the sequence UI is draggable', r.draggable === 0);
    ok('no text entry in the sequence UI', r.inputs === 0);
    ok('every piece is a real button', r.allButtons && r.chips > 0, r.chips + ' chips');
    await p.close();
  }

  {
    // tap to place, tap a placed chip to take it back, Back and Reset
    const p = await openSeq();
    const r = await p.evaluate(() => {
      const bank = () => [...document.querySelectorAll('#bank .chip')];
      const built = () => [...document.querySelectorAll('#built .chip')];
      const n0 = bank().length;
      bank()[0].click();
      const afterPlace = { bank: bank().length, built: built().length };
      built()[0].click();
      const afterTakeBack = { bank: bank().length, built: built().length };
      bank()[0].click(); bank()[0].click();
      const afterTwo = { built: built().length };
      document.getElementById('s-back').click();
      const afterBack = { built: built().length };
      document.getElementById('s-reset').click();
      const afterReset = { built: built().length, bank: bank().length };
      return { n0, afterPlace, afterTakeBack, afterTwo, afterBack, afterReset };
    });
    ok('tapping a bank chip places it', r.afterPlace.built === 1 && r.afterPlace.bank === r.n0 - 1);
    ok('tapping a placed chip returns it', r.afterTakeBack.built === 0 && r.afterTakeBack.bank === r.n0);
    ok('Back removes the last piece', r.afterTwo.built === 2 && r.afterBack.built === 1);
    ok('Reset clears the line', r.afterReset.built === 0 && r.afterReset.bank === r.n0);
    await p.close();
  }

  {
    // correct assembly grades as knew()
    const p = await openSeq();
    const r = await p.evaluate(() => {
      const before = learned;
      current.card.answer.forEach(w =>
        [...document.querySelectorAll('#bank .chip')].find(c => c.textContent === w).click());
      document.getElementById('s-check').click();
      const marks = {
        right: document.querySelectorAll('#built .chip.right').length,
        wrong: document.querySelectorAll('#built .chip.wrong').length,
        locked: [...document.querySelectorAll('#built .chip')].every(c => c.disabled),
        actionsHidden: document.getElementById('seq-actions').hidden,
        nextShown: !document.getElementById('graded-next').hidden,
        gloss: document.getElementById('gloss').textContent,
      };
      document.getElementById('g-next').click();
      return { before, marks, after: learned, missed: missed.length };
    });
    ok('a correct assembly marks every piece right',
      r.marks.right > 0 && r.marks.wrong === 0 && r.marks.locked);
    ok('build controls give way to Next', r.marks.actionsHidden && r.marks.nextShown);
    ok('a correct assembly does not spell the answer out', r.marks.gloss === '');
    ok('a correct assembly counts as one retrieval',
      r.after === r.before + 1 && r.missed === 0);
    await p.close();
  }

  {
    /* A derivation order IS determinate — jagat cannot reach jagan without
       passing through jagad — so a misplaced stage is marked misplaced. */
    const p = await openSeq('03-sandhi:derive:jagat-natyam');
    const r = await p.evaluate(() => {
      const c = current.card;
      const other = c.answer.slice().reverse();
      other.forEach(w =>
        [...document.querySelectorAll('#bank .chip')].find(x => x.textContent === w).click());
      document.getElementById('s-check').click();
      const out = {
        gloss: document.getElementById('gloss').textContent,
        crossed: document.querySelectorAll('#built .chip.wrong').length,
        id: c.id, chain: c.answer.join('  →  '),
      };
      document.getElementById('g-next').click();
      out.missed = missed.length; out.learned = learned;
      out.trouble = JSON.parse(localStorage.getItem('abhyāsaḥ')).trouble[out.id];
      return out;
    });
    ok('a wrong derivation order is marked wrong', r.crossed > 0, r.crossed + ' stages');
    ok('the feedback spells the chain out',
      r.gloss === 'Correct order: ' + r.chain, JSON.stringify(r.gloss));
    ok('it joins the missed pile', r.missed === 1 && r.learned === 0);
    ok('and records the loss', r.trouble && r.trouble.w === 1, JSON.stringify(r.trouble));
    await p.close();
  }

  {
    /* The project decision: sequence is reserved for orders the grammar
       forces. No sequence card may ask for the arrangement of a whole
       sentence's freely movable constituents. */
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const seqs = [];
      Object.entries(DECKS).forEach(([name, cards]) => cards.forEach(c => {
        if ((c.type || 'reveal') === 'sequence') seqs.push({ id: c.id, front: c.front, deck: name });
      }));
      return {
        total: seqs.length,
        lessons: [...new Set(seqs.map(s => s.id.split(':')[0]))],
        sentenceLike: seqs.filter(s => /^Build/i.test(s.front) || /model order/i.test(s.front))
          .map(s => s.id),
      };
    });
    ok('no sequence card asks for a sentence word order',
      r.sentenceLike.length === 0, r.sentenceLike.join(', '));
    ok('sequence is used only for derivations',
      r.lessons.length === 1 && r.lessons[0] === '03-sandhi',
      r.total + ' cards in ' + r.lessons.join(', '));
    await p.close();
  }

  {
    // mobile
    const p = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.evaluate(d => {
      loadDeck(d);
      // the widest sequence card there is — the tightest layout case
      const widest = DECKS[d].filter(c => c.parts)
        .sort((a, b) => b.parts.length - a.parts.length)[0];
      startRound([widest], {});
    }, SEQ);
    const r = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('#bank .chip')];
      return {
        minH: Math.min(...chips.map(c => c.getBoundingClientRect().height)),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        fits: chips.every(c => c.getBoundingClientRect().right <= window.innerWidth),
        chips: chips.length,
      };
    });
    ok('chips meet the 44px touch target', r.minH >= 44, r.minH + 'px');
    ok('no horizontal overflow at the widest chip count',
      !r.overflow && r.fits, r.chips + ' chips');
    await p.close();
  }

  // ── every interactive deck, checked generically ───────────────────
  // Structural, not a hardcoded list, so a deck added later is covered
  // without touching this file.
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const bad = [];
      const stats = { choice: 0, sequence: 0, reveal: 0, decks: 0 };
      Object.entries(DECKS).forEach(([name, cards]) => {
        const kinds = new Set(cards.map(c => c.type || 'reveal'));
        cards.forEach(c => stats[c.type || 'reveal']++);
        if (kinds.has('reveal') && kinds.size === 1) return;   // plain deck
        stats.decks++;
        const lesson = DECK_LESSON[name];
        cards.forEach(c => {
          const t = c.type || 'reveal';
          const why =
            !c.id.startsWith(lesson + ':') ? 'id does not start with its lesson'
            : !c.front ? 'no front'
            : !c.note ? 'no note'
            : !c.source ? 'no source'
            : t === 'choice' && (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4) ? 'bad option count'
            : t === 'choice' && !c.options.includes(c.answer) ? 'answer not among options'
            : t === 'choice' && new Set(c.options).size !== c.options.length ? 'repeated option'
            : t === 'sequence' && (!Array.isArray(c.parts) || c.parts.length > 4) ? 'bad parts'
            : t === 'sequence' && !Array.isArray(c.answer) ? 'sequence answer not an array'
            : null;
          if (why) bad.push(c.id + ': ' + why);
        });
      });
      return { bad, stats, lessons: [...new Set(Object.values(DECK_LESSON))].length };
    });
    ok('every interactive card is well-formed', r.bad.length === 0, r.bad.slice(0, 6).join(' | '));
    ok('interactive decks exist across the curriculum', r.stats.decks >= 10, r.stats.decks + ' decks');
    console.log('        ' + r.stats.choice + ' choice · ' + r.stats.sequence
      + ' sequence · ' + r.stats.reveal + ' reveal');
    await p.close();
  }

  // ── karaka notes must carry BOTH the role and the case ────────────
  {
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const d = DECKS['Kāraka-vicāra — roles in a sentence · practice'] || [];
      const sentence = d.filter(c => c.id.startsWith('07-karaka:role:'));
      return {
        n: sentence.length,
        bothNamed: sentence.every(c =>
          /kartā|karma|karaṇa|sampradāna|apādāna|adhikaraṇa/.test(c.note) &&
          /prathamā|dvitīyā|tṛtīyā|caturthī|pañcamī|saptamī/.test(c.note)),
        askAboutAWord: sentence.every(c => /^Role of \S.*:\n\S/.test(c.front)),
      };
    });
    ok('karaka cards ask about a word in a real sentence',
      r.n >= 5 && r.askAboutAWord, r.n + ' role cards');
    ok('karaka notes name both the role and the vibhakti', r.bothNamed);
    await p.close();
  }

  // ── curation must not destroy learner history ─────────────────────
  // Cards removed from a deck leave records behind in localStorage. Those
  // records are deliberately kept, so a card that comes back brings its
  // history with it — and a stale key must never break the page.
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    // 12-vakya:indeclinables-particles:api was removed as a duplicate
    const GONE = '12-vakya:indeclinables-particles:api';
    await p.addInitScript(g => {
      try {
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          v: 2,
          decks: { 'V15 · Indeclinables & particles — DM': { best: [55, 61], pile: [g] } },
          trouble: { [g]: { w: 4, r: 0, s: '' } },
          cleared: 7,
        }));
      } catch (e) {}
    }, GONE);
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(g => {
      const name = 'V15 · Indeclinables & particles — DM';
      loadDeck(name);
      const raw = JSON.parse(localStorage.getItem('abhyāsaḥ'));
      return {
        best: raw.decks[name].best,
        staleKept: !!raw.trouble[g],
        pile: pileCards().length,
      };
    }, GONE);
    ok('a removed card keeps its loss record', r.staleKept);
    ok('a best score set on the old, larger deck survives',
      r.best && r.best[0] === 55 && r.best[1] === 61, JSON.stringify(r.best));
    ok('stale pile keys resolve to nothing rather than breaking', r.pile === 0);
    await p.close();
  }

  // ── paradigm decks must be COMPLETE, not curated ──────────────────
  // The badges mandate this: Rūpa asks for a noun through all 8 vibhaktis ×
  // 3 vacanas, Kriyā for 3 dhātus in all 9 parasmaipada forms of laṭ. A gap
  // in a finite table is a real gap, so these decks are the one exception to
  // "curated, not exhaustive".
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const VIB = ['prathamā','dvitīyā','tṛtīyā','caturthī','pañcamī','ṣaṣṭhī','saptamī','sambodhana'];
      const NUM = { ekavacana: 'sg', dvivacana: 'du', bahuvacana: 'pl' };
      /* A table deck says in its own name whether it is a paradigm shown
         whole or a delta against one that is.  The reference gives ONE
         ṛ-stem table for mātṛ, pitṛ and kartṛ together, so declining both in
         full drills one paradigm twice; Mātṛ keeps the cell the feminine
         does not share.  Only the decks that claim all 24 cells are held to
         all 24. */
      const table = [], deltas = [];
      Object.keys(DECKS).forEach(n => {
        if (!n.startsWith('Śabda-rūpa')) return;
        (n.includes('all 24 cells') ? table : deltas).push(...DECKS[n]);
      });
      const cells = {};
      table.forEach(c => {
        const note = c.note || '';
        const stem = note.includes('stem: ') ? note.split('stem: ')[1].split(' ·')[0] : '?';
        cells[stem] = cells[stem] || new Set();
        (c.gloss.split('—').pop() || '').split(',').forEach(chunk => {
          const nums = Object.keys(NUM).filter(n => chunk.includes(n));
          VIB.filter(v => chunk.includes(v)).forEach(v =>
            nums.forEach(n => cells[stem].add(v + '.' + NUM[n])));
        });
      });
      const incomplete = Object.entries(cells)
        .filter(([, set]) => set.size !== 24)
        .map(([stem, set]) => stem + ':' + set.size);
      /* A delta is not a short table: every card in one has to name a real
         cell, and to say what it is a delta against. */
      const VIBRE = new RegExp('(' + VIB.join('|') + ')');
      const badDelta = deltas.filter(c =>
        !VIBRE.test(c.gloss || '')
        || !Object.keys(NUM).some(n => (c.gloss || '').includes(n))
        || !/\bas |declines as |where the masculine/.test(c.note || '')).map(c => c.id);

      const conj = [];
      Object.keys(DECKS).forEach(n => {
        if (n.startsWith('Dhātu-rūpa · ')) conj.push(...DECKS[n]);
      });
      const byRoot = {};
      conj.forEach(c => {
        const root = c.id.split(':')[1];
        byRoot[root] = byRoot[root] || new Set();
        byRoot[root].add(c.gloss.split('—').pop().trim());
      });
      const shortRoots = Object.entries(byRoot)
        .filter(([, set]) => set.size !== 9).map(([r, set]) => r + ':' + set.size);

      // no card appears twice within one lesson
      const perLesson = {}, dupes = [];
      Object.entries(DECKS).forEach(([name, cards]) => {
        const lesson = DECK_LESSON[name];
        cards.forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          const k = lesson + '|' + c.devanagari + '|' + c.gloss;
          if (perLesson[k]) dupes.push(c.id + ' == ' + perLesson[k]);
          else perLesson[k] = c.id;
        });
      });
      return { stems: Object.keys(cells).length, incomplete,
               deltas: deltas.length, badDelta,
               roots: Object.keys(byRoot).length, shortRoots, conj: conj.length, dupes };
    });
    ok('every declension stem covers all 24 cells',
      r.stems === 8 && r.incomplete.length === 0, r.stems + ' stems; short: ' + r.incomplete.join(', '));
    ok('a delta table names a real cell and what it derives from',
      r.deltas > 0 && r.badDelta.length === 0,
      r.deltas + ' delta cards; loose: ' + r.badDelta.join(', '));
    ok('every conjugated dhātu has all 9 laṭ forms',
      r.roots === 3 && r.conj === 27 && r.shortRoots.length === 0,
      r.roots + ' roots, ' + r.conj + ' forms; short: ' + r.shortRoots.join(', '));
    ok('no card appears twice within one lesson',
      r.dupes.length === 0, r.dupes.slice(0, 4).join(' | '));
    await p.close();
  }

  // ── a renamed deck keeps its score, and no table swamps a review ───
  {
    const p = await browser.newPage();
    await p.addInitScript(() => {
      try {
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          v: 2,
          deck: 'Rūpa practice — case and form',
          decks: { 'Rūpa practice — case and form': { best: [13, 15], pile: [] },
                   'Kriyā practice — person, tense and mood': { best: [18, 21], pile: [] } },
          trouble: {}, cleared: 0,
        }));
      } catch (e) {}
    });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('abhyāsaḥ'));
      return {
        /* Two hops: this deck was renamed once before and again in the
           curation pass, so the store has to walk the chain rather than stop
           at the first leg.  That only works while a new entry goes at the
           END of DECK_RENAMES, which is what this proves. */
        moved: raw.decks['Vibhakti-prayoga — the case a sentence calls for · practice'],
        movedKriya: raw.decks['Puruṣa-lakāra — person, tense and mood · practice'],
        oldGone: !raw.decks['Rūpa practice — case and form']
              && !raw.decks['Vibhakti-rūpa — recognise and produce · practice'],
        lastDeckMoved: raw.deck === 'Vibhakti-prayoga — the case a sentence calls for · practice',
        /* "finished" is now every card mastered rather than a best score at
           any score, so mastering both renamed decks is what proves it */
        finished: (() => {
          ['Vibhakti-prayoga — the case a sentence calls for · practice',
           'Puruṣa-lakāra — person, tense and mood · practice']
            .forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
          return finishedDecks().length;
        })(),
      };
    });
    ok('a renamed deck keeps its best score across two hops',
      r.moved && r.moved.best[0] === 13 && r.movedKriya && r.movedKriya.best[0] === 18,
      JSON.stringify(r.moved && r.moved.best));
    ok('the old deck name is cleared away', r.oldGone);
    ok('the remembered deck follows the rename', r.lastDeckMoved);
    ok('both renamed decks still count as finished', r.finished === 2, r.finished + ' finished');

    /* The draw must spread across lists rather than pour out of the biggest
       one, so the pool is seeded with a whole paradigm table and three small
       lists — a flat draw would make every session mostly the table. */
    const spread = await p.evaluate(() => {
      const big = Object.keys(DECKS).find(n => DECKS[n].length >= 20);
      const small = Object.keys(DECKS).filter(n => DECKS[n].length <= 12).slice(0, 3);
      [big, ...small].forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      const counts = [];
      for (let i = 0; i < 25; i++) {
        const drawn = mixCards();
        counts.push(drawn.filter(c => DECK_OF.get(c) === big).length / drawn.length);
      }
      return { worst: Math.max(...counts), size: mixCards().length, big };
    });
    ok('no one list dominates a 20-card draw',
      spread.worst <= 0.65, 'worst share ' + Math.round(spread.worst * 100) + '%');
    ok('the draw still fills a session', spread.size === 20, spread.size + ' cards');
    await p.close();
  }

  // ── the practice screen: branded top left, and compact ─────────────
  {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.evaluate(() => loadDeck(Object.keys(DECKS)[0]));   // off the landing card
    const r = await p.evaluate(() => {
      const box = s => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
      const brand = box('.brand'), card = box('.panel'), logo = box('.brand-logo');
      const nav = box('#nav'), ctl = box('.controls'), drawer = document.getElementById('drawer');
      /* the longest list name is what decides whether the bar is wide enough */
      const clipAt = () => {
        for (const n of Object.keys(DECKS)) {
          loadDeck(n);
          const e = document.getElementById('nav-label');
          if (e.scrollWidth > Math.ceil(e.getBoundingClientRect().width) + 1) return n;
        }
        return null;
      };
      const clipped = clipAt();
      window.__clipAt = clipAt;
      return {
        hasLogo: !!logo && logo.width > 0 && logo.height > 0,
        /* nothing to fetch: the artwork is a data: URI, not a URL */
        logoInline: [...document.querySelectorAll('.brand [href], .brand [src]')]
          .every(e => /^data:/.test(e.getAttribute('href') || e.getAttribute('src'))),
        /* The lockup is one image, so the box must size to the image as
           rendered.  A .brand far wider than its logo means stray markup has
           leaked into it — which is exactly what a malformed comment did. */
        logoFits: !!logo && !!brand && Math.round(brand.width) <= Math.round(logo.width) + 2,
        navLeft: nav && Math.round(nav.left),
        navTop: nav && Math.round(nav.top),
        brandRight: brand && Math.round(brand.right),
        brandWidth: brand && brand.width,
        logoWidth: logo && logo.width,
        brandTop: brand && Math.round(brand.top),
        brandHeight: brand && Math.round(brand.height),
        cardLeft: card && Math.round(card.left),
        cardRight: card && Math.round(card.right),
        cardTop: card && Math.round(card.top),
        cardBottom: card && Math.round(card.bottom),
        controlsTop: ctl && Math.round(ctl.top),
        controlsCentred: ctl && card
          && Math.abs((ctl.left + ctl.right) / 2 - (card.left + card.right) / 2) <= 1,
        // no centred logo during practice
        centred: !document.querySelector('h1'),
        /* The MARK is out of the drawer, and so is Devanagari — that is
           chrome, and Devanagari belongs on the cards where it is the thing
           being learnt.  The word "Abhyāsa" itself now names the mastery
           mode there, which is a mode name and not branding. */
        drawerBranded: /[\u0900-\u097F]/.test(drawer.textContent)
                       || !!drawer.querySelector('.brand, .brand-logo'),
        clipped,
      };
    });
    ok('the logo renders, with nothing to fetch', r.hasLogo && r.logoInline);
    /* Regression guard.  logo.svg's header comment once quoted index.html's
       own logo placeholder literally; an HTML comment ends at its first
       "--" + ">" whatever the nesting, so the rest of the comment escaped
       into the page as visible text and blew the brand box out to 457px. */
    ok('no stray markup leaks into the brand box', r.logoFits,
      'brand ' + Math.round(r.brandWidth) + 'px vs logo ' + Math.round(r.logoWidth) + 'px');
    ok('navigation is in the top left corner',
      r.navLeft === r.cardLeft && r.navTop < 30,
      'nav x' + r.navLeft + ' y' + r.navTop + ' · card x' + r.cardLeft);
    ok('the logo is in the top right corner',
      r.brandRight === r.cardRight && r.brandTop < 30,
      'brand right ' + r.brandRight + ' · card right ' + r.cardRight);
    ok('no centred logo during practice', r.centred);
    ok('the branding stays small', r.brandHeight <= 44, r.brandHeight + 'px tall');
    ok('branding is out of the drawer', !r.drawerBranded);
    // the whole point of the pass: the exercise begins near the top
    ok('the exercise starts high on a phone', r.cardTop <= 120, r.cardTop + 'px down');
    ok('no list name is truncated on a phone', !r.clipped, r.clipped || '');
    ok('the toggles sit below the card, centred',
      r.controlsTop > r.cardBottom && r.controlsCentred,
      'controls at ' + r.controlsTop + ', card ends ' + r.cardBottom);

    /* The lockup steps down a size at each phone breakpoint rather than
       dropping any part of itself, so check the narrow ones actually buy
       back enough room for the longest name. */
    for (const width of [375, 360]) {
      await p.setViewportSize({ width, height: 844 });
      const narrow = await p.evaluate(() => ({
        clipped: window.__clipAt(),
        logoH: Math.round(document.querySelector('.brand-logo').getBoundingClientRect().height),
      }));
      ok('no list name is truncated at ' + width + 'px',
        !narrow.clipped, (narrow.clipped || '') + ' · logo ' + narrow.logoH + 'px tall');
    }
    await p.close();
  }

  // ── one child is folded away, and comes back on its own ────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      openTracks.clear(); openLessons.clear();
      TRACK_ROWS.forEach(x => openTracks.add(x.track.id));
      renderDrawer();
      const rows = [...document.querySelectorAll('#dr-tracks .tr')].map(tr => {
        const h = tr.querySelector('.tr-head');
        const body = tr.querySelector('.tr-body');
        return {
          name: h.querySelector('.tr-name').textContent,
          leaf: h.classList.contains('leaf'),
          /* a child is a deck button, a lesson-level leaf button, or a
             wrapper holding a lesson heading — anything else (the note on a
             stage that has not been begun) is not a row */
          kids: body ? [...body.children]
            .map(c => c.matches('.dk, .ls-head') ? c : c.querySelector('.ls-head'))
            .filter(Boolean)
            .map(c => c.querySelector('.dk-name, .ls-name').textContent) : [],
        };
      });
      return {
        rows,
        /* the levels are folded from what exists, not from a hardcoded list */
        derived: typeof soleLesson === 'function' && typeof soleDeck === 'function',
        singleLessonTracks: TRACK_ROWS.filter(x => x.lessons.length === 1)
          .map(x => x.track.name),
        singleDeckLessons: LESSONS.filter(L => L.decks.length === 1).map(L => L.label),
        /* what the folded track actually holds, so the count is not a
           number the next list added has to chase */
        pujaLists: (LESSONS.find(L => L.lesson === '17-puja-vak') || { decks: [] }).decks.length,
      };
    });

    // a track whose one lesson repeats its own name must not show it twice
    const dup = r.rows.filter(x => x.kids.includes(x.name));
    ok('no track repeats its own name one level down', !dup.length,
      dup.map(x => x.name).join(' | '));

    /* A track that comes down to a single lesson IS that lesson: its lists
       stand directly under the track's name, with no heading between. */
    const puja = r.rows.find(x => x.name === 'Pūjā-Vāk');
    ok('a track of one lesson shows its lists directly',
      puja && puja.kids.length === r.pujaLists && !puja.kids.includes('Pūjā-Vāk'),
      puja ? puja.kids.length + ' rows' : 'missing');
    /* And one that comes down to a single list draws no row at all: the page
       the name opens has a Begin, and a menu of one is not a menu. */
    const singles = r.rows.filter(x => ['Svara-Vidyā', 'Avadhāna'].includes(x.name));
    ok('a track of one list is reached by its own Begin, not by a row',
      singles.length === 2 && singles.every(x => !x.kids.length),
      singles.map(x => x.name + ' ' + x.kids.length).join(' | '));
    const folded = await p.evaluate(() => {
      beginHome();
      renderDrawer();
      const row = [...document.querySelectorAll('.tr-head.leaf')]
        .find(b => b.querySelector('.tr-name').textContent === 'Pūjā-Vāk');
      row.click();
      return { page: !document.getElementById('trackcard').hidden,
               name: document.getElementById('s-name').textContent };
    });
    ok('a folded track still reaches its own page',
      folded.page && /Pūjā/.test(folded.name), folded.name);

    // a lesson holding one list is still drawn as the lesson
    const kavya = r.rows.find(x => x.name === 'Kāvya-Racanā');
    ok('a lesson of one list is still the lesson',
      kavya && kavya.kids.includes('Alaṅkāra') && kavya.kids.includes('Rasa'),
      kavya ? kavya.kids.join(' | ') : 'missing');

    /* Folding may shorten the tree; it may never delete a name from it.
       A lesson of one list used to be drawn under the LIST's name, so
       `Chandas II` read `Vṛtta` and the drawer had a Chandas I and no
       Chandas II at all. Every lesson the app carries must be findable. */
    const named = await p.evaluate(() => {
      openTracks.clear(); openLessons.clear();
      TRACK_ROWS.forEach(x => openTracks.add(x.track.id));
      renderDrawer();
      const text = document.getElementById('dr-tracks').innerText;
      return LESSONS.filter(L => !text.includes(L.label)).map(L => L.label);
    });
    ok('no lesson name is lost to folding', !named.length, named.join(' | '));

    ok('the folding is derived, not a list of exceptions', r.derived);
    console.log('        folded: ' + r.singleLessonTracks.join(', ')
      + ' · one-list lessons: ' + r.singleDeckLessons.join(', '));
    await p.close();
  }

  // ── a deck renamed twice still finds its score ─────────────────────
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.addInitScript(() => {
      try {
        // the name this deck carried two renames ago
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          v: 3, deck: 'Kriyā practice — person, tense and mood',
          decks: { 'Kriyā practice — person, tense and mood': { best: [17, 21], pile: [] } },
          review: { runs: 0, right: 0, seen: 0 }, trouble: {}, cleared: 0, mastered: {},
        }));
      } catch (e) {}
    });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('abhyāsaḥ'));
      return { landed: raw.decks['Puruṣa-lakāra — person, tense and mood · practice'],
               oldGone: !raw.decks['Kriyā practice — person, tense and mood']
                     && !raw.decks['Practice — person, tense and mood'],
               deck: raw.deck };
    });
    ok('a score survives two renames in one chain',
      r.landed && r.landed.best[0] === 17, JSON.stringify(r.landed));
    ok('and leaves no stale key behind', r.oldGone);
    ok('the remembered list follows the whole chain',
      r.deck === 'Puruṣa-lakāra — person, tense and mood · practice', r.deck);
    await p.close();
  }

  // ── the grade buttons are marks, and still say what they do ────────
  {
    const p = await open(browser, { viewport: { width: 360, height: 740 } });
    const r = await p.evaluate(() => {
      /* these two belong to a reveal card; a choice card grades itself and
         shows a single Next instead */
      loadDeck(Object.keys(DECKS).find(n =>
        DECKS[n].every(c => (c.type || 'reveal') === 'reveal')));
      reveal();
      return ['miss', 'knew'].map(id => {
        const e = document.getElementById(id), b = e.getBoundingClientRect();
        return { id, text: e.textContent.trim(), label: e.getAttribute('aria-label'),
                 w: b.width, h: b.height,
                 /* the glyph itself must be hidden from a screen reader, or it
                    reads the button twice — once as a name, once as content */
                 glyphHidden: !!e.querySelector('[aria-hidden="true"]') };
      });
    });
    const [miss, knew] = r;
    ok('the grade buttons carry the marks', miss.text === '✕' && knew.text === '✓',
      miss.text + ' / ' + knew.text);
    ok('and are still named for a screen reader',
      /didn/i.test(miss.label || '') && /knew/i.test(knew.label || ''),
      JSON.stringify([miss.label, knew.label]));
    ok('with the glyph itself hidden from it', miss.glyphHidden && knew.glyphHidden);
    ok('a mark is a bigger target than the phrase was',
      r.every(x => x.h >= 44 && x.w >= 64),
      r.map(x => Math.round(x.w) + '×' + Math.round(x.h)).join(' '));

    /* Each mark takes its own pigment: kumkuma for wrong, patra for right,
       bordered in the pigment and inked in its light tint.  Checked as
       resolved rgb, because a var() that does not resolve is not an error —
       it silently falls back to the inherited colour, which is what a
       self-referential token did here. */
    const ink = await p.evaluate(() => {
      const of = id => { const s = getComputedStyle(document.getElementById(id));
        return { border: s.borderTopColor, color: s.color }; };
      const root = getComputedStyle(document.documentElement);
      return { miss: of('miss'), knew: of('knew'),
        tokens: ['--kumkuma', '--kumkuma-ink', '--patra', '--patra-ink']
          .map(t => root.getPropertyValue(t).trim()) };
    });
    ok('every pigment token resolves', ink.tokens.every(v => /^#[0-9a-f]{6}$/i.test(v)),
      ink.tokens.join(' '));
    ok('the cross is bordered and inked in kumkuma',
      ink.miss.border === 'rgb(165, 52, 31)' && ink.miss.color === 'rgb(226, 160, 142)',
      JSON.stringify(ink.miss));
    ok('the check is bordered and inked in patra',
      ink.knew.border === 'rgb(79, 97, 55)' && ink.knew.color === 'rgb(162, 185, 131)',
      JSON.stringify(ink.knew));
    await p.close();
  }

  // ── the card survives a browser's own dark mode ────────────────────
  // Chrome and Brave auto-darken pages that do not declare a colour scheme,
  // and without one they would repaint an already-dark card a muddy olive
  // with inverted text. Nothing in the cascade changes when they do it —
  // getComputedStyle still reports the right colour — so this reads the
  // pixel that was painted.
  {
    const zlib = require('zlib');
    const firstPixel = png => {            // the one pixel of a 1×1 screenshot
      let i = 8; const idat = [];
      while (i < png.length) {
        const len = png.readUInt32BE(i);
        if (png.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(png.subarray(i + 8, i + 8 + len));
        i += 12 + len;
      }
      const raw = zlib.inflateSync(Buffer.concat(idat));
      return [raw[1], raw[2], raw[3]];     // byte 0 is the scanline filter
    };
    const SURFACE = [35, 29, 23];          // --surface, #231d17

    for (const [args, tag] of [[[], 'left alone'],
                               [['--enable-features=WebContentsForceDark'], 'forced dark']]) {
      const b2 = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', ...args] });
      const p = await b2.newPage({ viewport: { width: 390, height: 600 }, colorScheme: 'dark' });
      await p.goto(FILE, { waitUntil: 'load' });
      const at = await p.evaluate(() => {
        const r = document.querySelector('.panel').getBoundingClientRect();
        return { x: Math.round(r.x + 8), y: Math.round(r.y + 8) };
      });
      const got = firstPixel(await p.screenshot({ clip: { ...at, width: 1, height: 1 } }));
      ok('the card is painted --surface with the browser ' + tag,
        got.every((v, i) => Math.abs(v - SURFACE[i]) <= 2), 'rgb(' + got.join(', ') + ')');
      await b2.close();
    }
  }

  // ── a set question must have exactly one true answer ───────────────
  // Set membership and intruder cards carry an integrity property that a
  // one-word question does not: the answer is only right if EVERY member
  // belongs, and the card is only fair if every other option holds at least
  // one member that does not.  Get one word wrong and the question has two
  // answers or none, which no amount of reading the card would reveal.
  //
  // So they are checked against the lesson's own reference rather than
  // trusted.  10-paryaya/reference.md lists its categories outright, which
  // makes word -> category a lookup, and an invented word a hard failure.
  {
    const p = await open(browser);
    const cards = await p.evaluate(() => {
      const out = [];
      Object.entries(DECKS).forEach(([n, cs]) => {
        if (DECK_LESSON[n] !== '10-paryaya') return;
        cs.forEach(c => { if ((c.type || 'reveal') === 'choice') out.push(c); });
      });
      return out;
    });
    await p.close();

    const REF = require('fs').readFileSync(
      path.resolve(__dirname, '..', '10-paryaya', 'reference.md'), 'utf8');
    const cats = {};                       // "Śiva" -> [names]
    const add = (k, list) => { cats[k] = list.split(',').map(s => s.trim()).filter(Boolean); };
    for (const m of REF.matchAll(/^### Deities — (\S+).*\n(.+)$/gm)) add(m[1], m[2]);
    for (const m of REF.matchAll(/^\*\*(\w+):\*\*[ \t]*(.+)$/gm)) add(m[1], m[2]);
    const home = {};                       // name -> the one category holding it
    Object.entries(cats).forEach(([k, ws]) => ws.forEach(w => { home[w] = k; }));
    /* "names for Śiva", "synonyms for the lotus" -> the reference's own key.
       An author naming a category the reference does not carry fails here,
       which is the right failure: the card would be unanswerable. */
    const keyOf = phrase => {
      const last = phrase.trim().split(/\s+/).pop().toLowerCase();
      return Object.keys(cats).find(k => k.toLowerCase() === last);
    };

    const SET = /^Which set consists entirely of (.+)\?$/;
    const ODD = /^Which name does NOT belong with the others\?$/;
    const bad = [], counts = { set: 0, odd: 0 };

    cards.forEach(c => {
      const s = (c.front || '').match(SET);
      if (s) {
        counts.set++;
        const key = keyOf(s[1]);
        if (!key) { bad.push(c.id + ': no reference category for "' + s[1] + '"'); return; }
        const members = o => o.split(' · ');
        // every option is drawn as a set of the same size, so the shape of an
        // option can never be what gives the answer away
        const sizes = new Set(c.options.map(o => members(o).length));
        if (sizes.size !== 1) bad.push(c.id + ': options differ in size (' + [...sizes] + ')');
        members(c.answer).forEach(w => {
          if (!(w in home)) bad.push(c.id + ': "' + w + '" is in no reference list');
          else if (home[w] !== key) bad.push(c.id + ': answer holds ' + w + ' (' + home[w] + '), not ' + key);
        });
        c.options.filter(o => o !== c.answer).forEach(o => {
          members(o).forEach(w => {
            if (!(w in home)) bad.push(c.id + ': "' + w + '" is in no reference list');
          });
          if (members(o).every(w => home[w] === key))
            bad.push(c.id + ': distractor "' + o + '" is also entirely ' + key);
        });
        return;
      }
      if (ODD.test(c.front || '')) {
        counts.odd++;
        // options are bare words here, so the two formats stay distinguishable
        if (c.options.some(o => o.includes(' · ')))
          bad.push(c.id + ': an intruder card lists sets, not names');
        const keep = c.options.filter(o => o !== c.answer);
        const homes = new Set(keep.map(w => home[w]));
        keep.concat(c.answer).forEach(w => {
          if (!(w in home)) bad.push(c.id + ': "' + w + '" is in no reference list');
        });
        if (homes.size !== 1) bad.push(c.id + ': the other names span ' + [...homes].join('/'));
        else if (home[c.answer] === [...homes][0])
          bad.push(c.id + ': ' + c.answer + ' belongs with the rest');
      }
    });

    ok('the reference parses into disjoint categories',
      Object.keys(cats).length >= 10
      && Object.values(cats).reduce((a, b) => a + b.length, 0) === Object.keys(home).length,
      Object.keys(cats).length + ' categories');
    ok('every set question has exactly one true answer', !bad.length, bad.slice(0, 5).join(' | '));
    ok('both set formats are actually in use', counts.set >= 6 && counts.odd >= 4,
      counts.set + ' membership · ' + counts.odd + ' intruder');
    console.log('        ' + (counts.set + counts.odd) + ' set cards checked against '
      + Object.keys(home).length + ' reference words');
  }

  // ── the pratyāhāra sets agree with the reference's own row ─────────
  {
    const p = await open(browser);
    const cards = await p.evaluate(() =>
      (DECKS['Pratyāhāra-vistāra — expand and test membership · practice'] || []).filter(c =>
        /^Which (set is|sound is NOT) covered .*\bik\b/.test(c.front || '')));
    await p.close();
    const REF = require('fs').readFileSync(
      path.resolve(__dirname, '..', '02-varna-vidya', 'reference.md'), 'utf8');
    const row = REF.match(/^\|\s*\*\*ik\*\*\s*\|\s*([^|]+)\|/m);
    const ik = new Set((row ? row[1] : '').split(',').map(s => s.trim()).filter(Boolean));
    const bad = [];
    cards.forEach(c => {
      const inside = w => ik.has(w);
      if (/NOT covered/.test(c.front)) {
        if (inside(c.answer)) bad.push(c.id + ': ' + c.answer + ' IS in ik');
        c.options.filter(o => o !== c.answer).forEach(o => {
          if (!inside(o)) bad.push(c.id + ': ' + o + ' is not in ik either');
        });
      } else {
        c.answer.split(' · ').forEach(w => { if (!inside(w)) bad.push(c.id + ': ' + w + ' is not in ik'); });
        c.options.filter(o => o !== c.answer).forEach(o => {
          if (o.split(' · ').every(inside)) bad.push(c.id + ': distractor "' + o + '" is also all ik');
        });
      }
    });
    ok('the ik cards agree with the reference', ik.size === 4 && cards.length >= 2 && !bad.length,
      'ik = ' + [...ik].join(',') + (bad.length ? ' — ' + bad.join(' | ') : ''));
  }

  // ── a set option still fits a phone ────────────────────────────────
  // Three names and two separators is a much longer option than "namāmi",
  // and the card's visual language only survives if it still sets on one
  // line: a wrapped option puts its ✓ on a line of its own.
  {
    const p = await open(browser, { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    const r = await p.evaluate(() => {
      const names = Object.keys(DECKS).filter(n =>
        DECKS[n].some(c => /^Which set consists entirely of/.test(c.front || '')));
      const wide = [], wrapped = [];
      let seen = 0, overflow = false;
      names.forEach(name => {
        const deck = DECKS[name];
        for (let i = 0; i < deck.length; i++) {
          loadDeck(name);
          // walk to card i by answering correctly
          for (let k = 0; k < i; k++) {
            const b = [...document.querySelectorAll('#choices .opt')]
              .find(x => x.textContent === current.card.answer);
            if (!b) break;
            b.click(); document.getElementById('g-next').click();
          }
          [...document.querySelectorAll('#choices .opt')].forEach(o => {
            seen++;
            const box = o.getBoundingClientRect();
            if (box.right > innerWidth || box.left < 0) wide.push(o.textContent);
            // one line: the box has not grown past its own minimum height
            if (box.height > 50) wrapped.push(o.textContent + ' @' + Math.round(box.height));
          });
          if (document.documentElement.scrollWidth > innerWidth) overflow = true;
        }
      });
      return { wide, wrapped, seen, overflow, lists: names.length };
    });
    ok('every set option fits a 360px screen', !r.wide.length && !r.overflow,
      r.wide.slice(0, 3).join(' | '));
    ok('and sets on a single line', !r.wrapped.length, r.wrapped.slice(0, 3).join(' | '));
    console.log('        ' + r.seen + ' options measured across ' + r.lists + ' lists');
    await p.close();
  }

  // ── every declension form is the reference's, not the author's ─────
  // A production card asserts a form.  Getting one wrong teaches the wrong
  // paradigm, and no amount of reading the card would show it — so the
  // answers are re-derived here from Stage 5's own tables and compared,
  // rather than trusted.  reference.md supplies endings, which are applied
  // to the model stem the deck is named for; bricks.md supplies tad's
  // neuter whole.
  {
    const fs = require('fs');
    const read = f => fs.readFileSync(path.resolve(__dirname, '..', '05-rupa', f), 'utf8');
    const REF = read('reference.md'), BRICKS = read('bricks.md');
    const VIB = ['prathamā', 'dvitīyā', 'tṛtīyā', 'caturthī', 'pañcamī',
                 'ṣaṣṭhī', 'saptamī', 'sambodhana'];
    const NUM = ['ekavacana', 'dvivacana', 'bahuvacana'];

    const section = (text, head) => {
      const i = text.indexOf('### ' + head);
      if (i < 0) return null;
      const rest = text.slice(i + 4);
      const m = rest.match(/\n#{2,3}\s/);
      return m ? rest.slice(0, m.index) : rest;
    };
    const rowsOf = block => {
      const out = {};
      block.split('\n').filter(l => l.trim().startsWith('|')).forEach(l => {
        const cells = l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        if (cells.length < 2) return;
        if (/^[-: ]*$/.test(cells.join(''))) return;
        if (/^(vib\.?|vibhakti|#)$/i.test(cells[0])) return;
        out[cells[0]] = cells.slice(1);
      });
      return out;
    };
    // stem -> the paradigm it should decline as, keyed [vibhakti][number]
    const table = (head, stem, strip, inherit) => {
      const r = rowsOf(section(REF, head)), t = {};
      Object.keys(r).forEach(k => {
        if (k === '3–7') return;                     // "same as masculine"
        k.split('–').forEach(v => {
          t[+v] = r[k].map(c => stem.slice(0, stem.length - strip) + c.replace(/^-/, '').replace(/!$/, ''));
        });
      });
      if (inherit) for (let v = 3; v <= 7; v++) t[v] = inherit[v];
      return t;
    };
    const pron = (text, head, inherit) => {
      const r = rowsOf(section(text, head)), t = {};
      Object.keys(r).forEach(k => {
        let n;
        if (/^\d$/.test(k)) n = +k;
        else { const w = k.toLowerCase().split(/\s/)[0]; n = VIB.indexOf(w) + 1; if (!n) return; }
        t[n] = r[k].map(c => c.replace(/\s*\(.*?\)/g, '').trim());
      });
      if (inherit) for (let v = 3; v <= 7; v++) t[v] = inherit[v];
      return t;
    };
    const mA = table('Masculine -a (deva, śiva, rāma)', 'śiva', 1);
    const tadM = pron(REF, 'Pronoun: tad (3rd person, masculine)');
    const WANT = {
      'Śiva — all 17 forms': mA,
      'Phala — 4 key forms':
        table('Neuter -a (phala, puṣpa, jala)', 'phala', 1, table('Masculine -a (deva, śiva, rāma)', 'phala', 1)),
      'Mālā — all 14 forms': table('Feminine -ā (mālā, gaṅgā, latā)', 'mālā', 1),
      'Devī — all 15 forms': table('Feminine -ī (nadī, devī, lakṣmī)', 'devī', 1),
      'Agni — all 15 forms': table('Masculine -i (agni, muni)', 'agni', 1),
      'Viṣṇu — 7 key forms': table('Masculine -u (viṣṇu, guru)', 'viṣṇu', 1),
      'Pitṛ — all 15 forms': table('Ṛ-stem (mātṛ, pitṛ, kartṛ)', 'pitṛ', 1),
      'Bhagavat — all 14 forms': table('Consonant-stem -at (bhagavat, mahat)', 'bhagavat', 2),
      'Asmad — all 17 forms': pron(REF, 'Pronoun: asmad (1st person)'),
      'Yuṣmad — all 17 forms': pron(REF, 'Pronoun: yuṣmad (2nd person)'),
      'Saḥ — all 16 forms': tadM,
      'Sā — all 14 forms': pron(REF, 'Pronoun: tad (3rd person, feminine)'),
      'Tat — 3 key forms': pron(BRICKS, 'Napuṃsakaliṅga (Neuter)', tadM),
    };
    /* Full mastery for new patterns, a delta check where the source itself
       derives one table from another, a transfer check where a paradigm is
       another's with one vowel changed.  The rows each list owes: */
    const ROWS = {
      'Phala — 4 key forms': [1, 2, 8],   // "3–7 same as masculine"
      'Tat — 3 key forms':   [1, 2],      // likewise, in bricks.md
    };
    const PARTIAL = new Set(['Viṣṇu — 7 key forms']);

    const p = await open(browser);
    const got = await p.evaluate(names => {
      const out = {};
      names.forEach(n => { out[n] = (DECKS[n] || []).map(c => ({
        id: c.id, front: c.front, answer: c.answer, options: c.options,
        stemClass: c.stemClass, note: c.note })); });
      return out;
    }, Object.keys(WANT));
    await p.close();

    const bad = [], covered = {}, vibsSeen = new Set(), numsSeen = new Set();
    Object.entries(WANT).forEach(([name, want]) => {
      const cards = got[name] || [];
      if (!cards.length) { bad.push(name + ': deck missing'); return; }
      const cells = new Set();
      cards.forEach(c => {
        const m = (c.front || '').match(/^Form the (\S+) (singular|dual|plural) of:/);
        if (!m) return;                                    // the class card
        const v = VIB.indexOf(m[1]) + 1, n = ['singular', 'dual', 'plural'].indexOf(m[2]);
        if (!v) { bad.push(c.id + ': unknown vibhakti ' + m[1]); return; }
        const expect = want[v] && want[v][n];
        if (!expect) { bad.push(c.id + ': the source has no such cell'); return; }
        if (c.answer !== expect) bad.push(c.id + ': ' + c.answer + ' ≠ ' + expect);
        // distractors must be real cells of the SAME paradigm
        const real = new Set([].concat(...Object.values(want)));
        c.options.filter(o => o !== c.answer).forEach(o => {
          if (!real.has(o)) bad.push(c.id + ': "' + o + '" is not a cell of this paradigm');
        });
        cells.add(v + ':' + n);
        vibsSeen.add(VIB[v - 1]); numsSeen.add(NUM[n]);
      });
      /* Every distinct FORM the list owes is asked for exactly once.  Cells
         are not: three of śiva's duals are śivābhyām, and asking for the
         same form three times drills one fact three times. */
      const owed = new Map();                    // form -> the cells it fills
      (ROWS[name] || Object.keys(want).map(Number)).forEach(v =>
        (want[v] || []).forEach((f, n) => {
          if (f) owed.set(f, (owed.get(f) || []).concat(v + ':' + n));
        }));
      const asked = cards.filter(c => /^Form the /.test(c.front || ''))
                         .map(c => c.answer);
      const twice = asked.filter((f, k) => asked.indexOf(f) !== k);
      if (twice.length) bad.push(name + ': asks for ' + twice[0] + ' more than once');
      if (!PARTIAL.has(name)) {
        const missing = [...owed.keys()].filter(f => !asked.includes(f));
        if (missing.length) bad.push(name + ': never asks ' + missing.join(','));
      } else {
        const stray = asked.filter(f => !owed.has(f));
        if (stray.length) bad.push(name + ': asks ' + stray.join(',') + ', not a cell here');
      }
      /* a collapsed card names the other cells its form fills, so nothing the
         table says is lost from the app */
      cards.filter(c => /^Form the /.test(c.front || '')).forEach(c => {
        const fills = owed.get(c.answer) || [];
        if (fills.length > 1 && !/·\s*also\s/.test(c.note || ''))
          bad.push(c.id + ': fills ' + fills.length + ' cells but names only one');
      });
      covered[name] = asked.length;
    });

    ok('every produced form is the one Stage 5 tables', !bad.length, bad.slice(0, 5).join(' | '));
    ok('every distinct form is asked for, and only once',
      Object.values(covered).reduce((a, b) => a + b, 0) === 168, JSON.stringify(covered));
    ok('the reduction dropped cells, never forms',
      covered['Śiva — all 17 forms'] === 17
      && covered['Phala — 4 key forms'] === 4,
      JSON.stringify(covered));
    ok('the bank spans all eight vibhaktis and all three numbers',
      vibsSeen.size === 8 && numsSeen.size === 3,
      [...vibsSeen].join(',') + ' | ' + [...numsSeen].join(','));
    console.log('        ' + Object.values(covered).reduce((a, b) => a + b, 0)
      + ' cells re-derived across ' + Object.keys(WANT).length + ' paradigms');
  }

  // ── the stem class is a scaffold, and it is withdrawn ──────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const DECK = 'Devī — all 15 forms';
      const CLASS = '05-rupa:class:devi';
      const shown = () => document.getElementById('stemclass').hidden
        ? null : document.getElementById('stemclass').textContent;
      let before = null, onAsk = 'not reached', after = null, styleOK = false;
      for (let attempt = 0; attempt < 40 && after === null; attempt++) {
        loadDeck(DECK);
        let seenAsk = false;
        for (let i = 0; i < 8; i++) {
          if (current.card.id === CLASS) { onAsk = shown(); seenAsk = true; }
          else if (!seenAsk && before === null) {
            before = shown();
            const el = document.getElementById('stemclass'), item = document.getElementById('dn');
            styleOK = el.compareDocumentPosition(item) === Node.DOCUMENT_POSITION_PRECEDING
              && parseFloat(getComputedStyle(el).fontSize) < parseFloat(getComputedStyle(item).fontSize);
          } else if (seenAsk && after === null) after = shown();
          const b = [...document.querySelectorAll('#choices .opt')]
            .find(x => x.textContent === current.card.answer);
          if (!b) break;
          b.click(); document.getElementById('g-next').click();
        }
      }
      // a deck's descriptor must not answer a question the deck asks
      const leaks = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if (typeof c.answer === 'string' && c.answer.length > 3 && n.includes(c.answer))
          leaks.push(n + ' ⊃ ' + c.answer);
      }));
      // and a reveal card never carries one
      loadDeck('Śabda-rūpa · Rāma — a-stem, all 24 cells');
      const onReveal = shown();
      return { before, onAsk, after, styleOK, leaks, onReveal };
    });
    ok('the stem class is shown until it has been asked for',
      r.before === 'feminine · ī-stem', JSON.stringify(r.before));
    ok('it sits under the stem, smaller than it', r.styleOK);
    ok('the card that asks for it does not also print it', r.onAsk === null, JSON.stringify(r.onAsk));
    ok('and it is withdrawn once established', r.after === null, JSON.stringify(r.after));
    ok('a reveal card carries no stem class', r.onReveal === null, JSON.stringify(r.onReveal));
    ok('no deck name answers a question that deck asks',
      !r.leaks.length, r.leaks.slice(0, 3).join(' | '));
    await p.close();
  }

  // ── a reversed deck must still have one answer per cue ─────────────
  // Every reveal deck can be run backwards, and in that direction the gloss
  // IS the prompt.  Two cards glossed "battle" therefore ask a question with
  // two right answers, which no amount of knowing the vocabulary can fix.
  // Synonyms belong on one card — the convention 150-odd vocabulary cards
  // already use, "sūrya / āditya / ravi" — and where a deck must keep its
  // items apart (the 50 core dhātus; one vocative per stem class) the gloss
  // carries what tells them apart instead.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const clash = [], wide = [];
      Object.entries(DECKS).forEach(([name, cards]) => {
        const by = {};
        cards.forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          const k = norm(c.gloss);
          (by[k] = by[k] || []).push(c.iast);
        });
        Object.entries(by).forEach(([k, ws]) => {
          if (ws.length > 1) clash.push(name + ' · "' + k + '" ← ' + ws.join(', '));
        });
      });
      // a merged card lists its words on the side the reverse round answers with
      const multi = [];
      Object.values(DECKS).forEach(cards => cards.forEach(c => {
        if ((c.type || 'reveal') !== 'reveal') return;
        if (!(c.iast || '').includes(' / ')) return;
        multi.push(c);
        // as many transliterated words as Devanagari ones, so neither side is short
        if ((c.devanagari || '').split(' / ').length !== c.iast.split(' / ').length)
          wide.push(c.id + ': ' + c.devanagari + ' ¦ ' + c.iast);
      }));
      return { clash, wide, multi: multi.length };
    });
    ok('no two cards in a deck answer to the same cue',
      !r.clash.length, r.clash.slice(0, 5).join(' | '));
    ok('a merged card carries the same words on both scripts',
      !r.wide.length, r.wide.slice(0, 3).join(' | '));
    console.log('        ' + r.multi + ' cards carry more than one word');
    await p.close();
  }

  // ── the grammar annotation names what it is, not that it is a card ──
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const notes = [];
      Object.values(DECKS).forEach(cards => cards.forEach(c => {
        if (c.note) notes.push({ id: c.id, note: c.note });
      }));
      return {
        headword: notes.filter(n => /^headword\b/i.test(n.note)).map(n => n.id),
        // "n." and "adj." were opaque next to a stem that spells itself out
        abbrev: notes.filter(n => /^(m|f|n|adj|pp)\.\s*·/.test(n.note)).map(n => n.id),
        sample: (notes.find(n => n.id === '07-karaka:war-combat:rana')
              || notes.find(n => /raṇa/.test(n.id)) || {}).note,
        n: notes.length,
      };
    });
    ok('no annotation still begins "headword"', !r.headword.length,
      r.headword.slice(0, 4).join(' | '));
    ok('nor with a bare gender abbreviation', !r.abbrev.length,
      r.abbrev.slice(0, 4).join(' | '));
    ok('an annotation reads as part of speech, class, then stem',
      /^noun · neuter · a-stem · stem: raṇa-/.test(r.sample || ''), r.sample);
    await p.close();
  }

  // ── one naming rule for every list ─────────────────────────────────
  // A Sanskrit head, the English in the descriptor.  The drawer draws the
  // head over "<descriptor> · N cards", so a list whose head is already
  // English says the same thing twice and leaves the subtext to say nothing.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      /* English function words: none of them belong in a Sanskrit head, and
         between them they catch every shape the old names took — "Goddess
         names I", "Case and form", "Spot the intruder".  Tokenised rather
         than matched with \b, because JS word boundaries are ASCII and would
         find a bare "a" at the end of Guṇa. */
      const ENGLISH = new Set(['and','the','of','in','a','practice','name','names',
        'form','forms','mastery','word','words','spot','which','set','case','more',
        'all','key','cell','cells','intruder','goddess','demon','battle','time']);
      const bad = [], noDesc = [], wide = [];
      Object.keys(DECKS).forEach(n => {
        const head = DECK_SHORT(n), desc = DECK_DESC(n);
        if (!desc) noDesc.push(n);
        const tokens = head.toLowerCase().split(/[\s·\-]+/).filter(Boolean);
        if (tokens.some(t => ENGLISH.has(t))) bad.push(head);
        // DECK_SHORT truncates past its display budget; a clipped head is a
        // different name from the one the file carries
        const written = n.replace(/^(?:V?\d+|S)\s*·\s*/, '').split(' — ')[0];
        if (head !== written) wide.push(written + ' → ' + head);
      });
      return { bad, noDesc, wide, n: Object.keys(DECKS).length };
    });
    ok('every list is headed in Sanskrit', !r.bad.length, r.bad.slice(0, 6).join(' | '));
    ok('and carries its English in the descriptor',
      !r.noDesc.length, r.noDesc.slice(0, 4).join(' | '));
    ok('no head is clipped by the drawer', !r.wide.length, r.wide.slice(0, 3).join(' | '));
    console.log('        ' + r.n + ' list names checked');
    await p.close();
  }

  // ── the app lands on a welcome card ────────────────────────────────
  // Still a card rather than a menu — the same palm-leaf surface — but the
  // first one says what Abhyāsa is and offers the list you were on.
  {
    /* open() loads a deck for every other test, which is exactly what
       dismisses the landing card — so this one opens the page raw. */
    const p = await browser.newPage({ viewport: { width: 390, height: 940 } });
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const w = document.getElementById('welcome');
      const on = !w.hidden && getComputedStyle(document.getElementById('card')).display === 'none';
      const txt = w.textContent.replace(/\s+/g, ' ');
      const btn = [...w.querySelectorAll('button')];
      const ink = btn.map(b => getComputedStyle(b).color);
      const leaf = getComputedStyle(w).backgroundColor;
      return {
        on, txt,
        /* the controls change how a card is shown, and none is */
        quiet: document.getElementById('controls').hidden
            && document.getElementById('keys').hidden
            && getComputedStyle(document.getElementById('tally')).visibility === 'hidden',
        buttons: btn.map(b => b.textContent.trim()),
        /* buttons inked for the dark ground vanish on a light card */
        readable: ink.every(c => c !== leaf),
        mastery: document.getElementById('w-mastery').textContent,
        lists: document.getElementById('w-lists').textContent,
        nav: (() => {
          const el = document.querySelector('#welcome .navbtn');
          return { sample: !!el, bars: !!(el && el.querySelector('.bars')),
                   caret: !!(el && el.querySelector('.nav-caret')),
                   inert: !!el && el.tagName !== 'BUTTON' };
        })(),
        h1: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    ok('the app opens on the welcome card', r.on);
    /* what the app is, how it is laid out, and the promise the whole of it
       rests on — in the card's own words, whatever they happen to be */
    ok('it says what Abhyāsa is',
      /Welcome to Abhyāsa/.test(r.txt) && /five tracks/.test(r.txt)
      && /never required/.test(r.txt)
      && /comes back later/.test(r.txt), r.txt.slice(0, 60));
    /* And what it is FOR.  The curriculum is scriptural Sanskrit — read a
       verse, follow a rite, use the words in practice — and a learner should
       not have to reach Pūjā-Vāk to find that out. */
    ok('and what the Sanskrit is for',
      /scripture/.test(r.txt) && /rite/.test(r.txt) && /practice/.test(r.txt),
      r.txt.slice(0, 80));
    ok('it carries the two figures the drawer carries',
      /^\d+%$/.test(r.mastery) && /^\d+$/.test(r.lists), r.mastery + ' · ' + r.lists);
    /* Nothing has been begun on a first run, so there is nothing "in
       progress": the card opens the first stage instead of dropping a
       beginner into a list with no idea what it is for. */
    ok('a first visit offers the first stage and the scoreboard',
      /^Begin — /.test(r.buttons[0]) && r.buttons[1] === 'Scoreboard', r.buttons.join(' | '));
    ok('its buttons are legible on the leaf', r.readable);
    /* The control the whole app is navigated by, shown as it appears in the
       top bar rather than described — and inert, so there are never two of
       it on the page. */
    ok('it shows the menu control itself, not a description of it',
      r.nav.sample && r.nav.bars && r.nav.caret && /Finding your way/i.test(r.txt),
      JSON.stringify(r.nav));
    ok('and says it is what tracks progress and moves you on',
      /marks how far you have got/.test(r.txt) && /five tracks/.test(r.txt), '');
    ok('the sample is not a second navigation button', r.nav.inert);
    ok('nothing that belongs to a running card is showing', r.quiet);
    ok('and it adds no h1 to the page', r.h1 === 0, r.h1 + ' found');
    ok('it fits a phone without sideways scroll', !r.overflow);

    // the first-visit button hands over to the stage, not to a card
    await p.click('#w-go');
    const first = await p.evaluate(() => ({
      gone: document.getElementById('welcome').hidden,
      stage: !document.getElementById('trackcard').hidden,
      name: document.getElementById('s-name').textContent,
      go: document.getElementById('s-go').textContent,
    }));
    ok('“Begin” hands over to the stage, not straight to a card',
      first.gone && first.stage && /^Begin — /.test(first.go),
      first.name + ' · ' + first.go);

    /* Once a stage has been begun there IS something in progress, and the
       card offers it. */
    const resumed = await p.evaluate(() => {
      beginTrack(trackIdOf(deckName));
      showWelcome();
      const label = document.getElementById('w-go').textContent;
      document.getElementById('w-go').click();
      return { label,
               gone: document.getElementById('welcome').hidden,
               card: getComputedStyle(document.getElementById('card')).display,
               controls: document.getElementById('controls').hidden,
               running: !!current };
    });
    ok('“In progress” hands over to the cards',
      resumed.label === 'In progress' && resumed.gone && resumed.card !== 'none'
      && !resumed.controls && resumed.running,
      JSON.stringify(resumed));

    /* Picking the list you are already on is the case that nearly broke:
       chooseDeck() used to return early for it, which on the landing card
       would have closed the drawer and left the welcome up. */
    await p.reload({ waitUntil: 'load' });
    const picked = await p.evaluate(async () => {
      openDrawer();
      await chooseDeck(deckName);            // the very list the welcome offers
      return { gone: document.getElementById('welcome').hidden,
               shut: document.getElementById('drawer').hidden,
               focus: document.activeElement && document.activeElement.id,
               running: !!current };
    });
    ok('picking the list you are already on still leaves the welcome',
      picked.gone && picked.shut && picked.running, JSON.stringify(picked));
    ok('and focus lands on the card, not a hidden one', picked.focus === 'card', picked.focus);
    await p.close();
  }

  // ── a panel opened from the welcome returns to it ──────────────────
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.click('#w-board');
    const open1 = await p.evaluate(() => ({
      board: getComputedStyle(document.getElementById('board')).display !== 'none',
      welcome: document.getElementById('welcome').hidden,
    }));
    await p.click('#p-back');
    const back = await p.evaluate(() => ({
      welcome: !document.getElementById('welcome').hidden,
      card: getComputedStyle(document.getElementById('card')).display,
    }));
    ok('the scoreboard opens from the welcome', open1.board && open1.welcome);
    ok('and closing it returns to the welcome, not to a card',
      back.welcome && back.card === 'none', JSON.stringify(back));
    await p.close();
  }

  // ── fundamentals come before the cards that use them ───────────────
  // term → equivalent → relationship → application, in four bands:
  //
  //   core     the equivalences, or the raw material an exercise draws from
  //   table    a paradigm shown whole — recognition, before anything asks
  //            the learner to produce out of it
  //   (rest)   the lesson's exercises and its other lists
  //   breadth  the vocab bank, which widens rather than carries
  //
  // The bands are read off `role`, which is a fact about the source.  The
  // rule used to read them off the CARD TYPE — interactive above reveal —
  // which was a proxy for "exercise above breadth list" and got the two
  // paradigm lessons exactly backwards: every Rūpa-siddhi production deck
  // was forced above the Śabda-rūpa tables they are documented as a second
  // pass over, so "Continue" reached "Form the caturthī singular of devī-"
  // before any declension table had been drilled.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const byLesson = {};
      Object.keys(DECKS).forEach(n => {
        (byLesson[DECK_LESSON[n]] = byLesson[DECK_LESSON[n]] || []).push(n);
      });
      const late = [], early = [];
      Object.entries(byLesson).forEach(([L, names]) => {
        const kind = n => DECK_ROLE[n] === 'core' ? 0
                        : DECK_ROLE[n] === 'table' ? 1
                        : DECK_ROLE[n] === 'breadth' ? 3 : 2;
        const tests = n => DECKS[n].some(c => (c.type || 'reveal') !== 'reveal');
        const seq = names.map(kind);
        // a terms list may never sit below anything that leans on it
        seq.forEach((k, i) => {
          if (k === 0 && seq.slice(0, i).some(x => x > 0)) late.push(L);
        });
        // nor a paradigm below the exercises that produce out of it
        seq.forEach((k, i) => {
          if (k === 1 && seq.slice(0, i).some(x => x === 2)) late.push(L + ' (table below its exercises)');
        });
        /* Every lesson that tests must show its fundamentals somewhere first —
           in the lesson itself, or in an earlier one. Three rest entirely on
           earlier stages: Stotra II and Chandas II on the cases and the
           śloka, and Paryāya-Chandas on both of the stages it is named for —
           the synonym sets of Paryāya and the scansion of Chandas I. */
        const RESTS_EARLIER = ['15-stotra-ii', '21-chandas-ii', '23-paryaya-chandas'];
        if (names.some(tests) && !seq.includes(0) && !RESTS_EARLIER.includes(L))
          late.push(L + ' (no fundamentals list at all)');
        // and nothing that carries the course may sit below a breadth list
        seq.forEach((k, i) => {
          if (k < 3 && seq.slice(0, i).some(x => x === 3)) early.push(L);
        });
      });
      /* The equivalences a later stage leans on, each taught by its own
         card before anything applies it. */
      const taught = {};
      Object.values(DECKS).forEach(cs => cs.forEach(c => {
        if ((c.type || 'reveal') === 'reveal') taught[(c.iast || '').trim()] = c.gloss || '';
      }));
      const need = {
        'prathama puruṣaḥ': /3rd person/, 'madhyama puruṣaḥ': /2nd person/,
        'uttama puruṣaḥ': /1st person/,   'ekavacanam': /singular/,
        'dvivacanam': /dual/,             'bahuvacanam': /plural/,
        'parasmaipadam': /active/,        'ātmanepadam': /middle/,
        'tṛtīyā': /instrumental · 3rd case/, 'ṣaṣṭhī': /genitive · 6th case/,
        'kartā': /agent/,                 'karaṇam': /instrument/,
      };
      const untaught = Object.keys(need).filter(k => !need[k].test(taught[k] || ''));
      /* The two levels stay apart: a case card must not simply assert a
         kāraka name, which is what "tṛtīyā → karaṇa" used to do. */
      const conflated = [];
      (DECKS['11 · Vibhakti-vacana — case and number terms'] || []).forEach(c => {
        if (/^(kartā|karma|karaṇa|sampradāna|apādāna|adhikaraṇa|sambandha)$/.test((c.note || '').trim()))
          conflated.push(c.id);
      });
      /* and the applied card names both levels rather than one */
      const rel = (DECKS['Kāraka-vicāra — roles in a sentence · practice'] || [])
        .filter(c => c.id.startsWith('07-karaka:case:'));
      const monolingual = rel.filter(c => !/·.*·/.test(c.answer)).map(c => c.id);
      const asksBoth = rel.every(c => /vibhakti \(case\)/.test(c.front));
      /* A gloss may name an English technical term — "optative", "middle-voice
         endings" — only if the chip beside it says what that term does.  The
         chip is the card's own "why" slot, and a beginner who does not know
         the word has nowhere else to look mid-round. */
      const JARGON = /optative|imperative|aorist|conditional|subjunctive|middle-voice|active endings|participle|elision|indeclinable\b/i;
      const bare = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if ((c.type || 'reveal') !== 'reveal') return;
        if (!JARGON.test(c.gloss || '')) return;
        // the chip has to add something beyond a citation or a bare label
        const chip = (c.note || '').replace(/[\d.]+$/, '').trim();
        if (chip.replace(/[^ ]+/g, '').length < 5) bare.push(c.id);
      }));
      const worked = (DECKS['Vākya-siddhi — the sentence, worked through'] || []).length;
      return { late: [...new Set(late)], early: [...new Set(early)], bare, worked,
               untaught, conflated, monolingual, asksBoth, rel: rel.length };
    });
    ok('a fundamentals list leads its lesson', !r.late.length, r.late.join(' | '));
    ok('and the worked sentences lead Stage 12', r.worked >= 4, r.worked + ' cards');
    ok('no card names a grammatical mood or voice without saying what it does',
      !r.bare.length, r.bare.slice(0, 4).join(' | '));
    ok('and the breadth lists still trail the course', !r.early.length, r.early.join(' | '));
    ok('every equivalence a later card leans on is taught by a card',
      !r.untaught.length, r.untaught.join(' | '));
    ok('a case card does not simply assert a kāraka',
      !r.conflated.length, r.conflated.join(' | '));
    ok('the kāraka-to-vibhakti cards name both levels',
      r.rel >= 4 && !r.monolingual.length && r.asksBoth, r.monolingual.join(' | '));
    await p.close();
  }

  // ── no card uses metalanguage its stage has not been taught ────────
  // The audit's five findings, each held by the fact that caught it.  A
  // card may name a grammatical term only from the stage that teaches it:
  // vibhakti from 5, the compound types from 11, the class notation from 9.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const VIB = /prathamā|dvitīyā|tṛtīyā|caturthī|pañcamī|ṣaṣṭhī|saptamī|sambodhana/;
      const SAM = /tatpuruṣa|karmadhāraya|dvigu|bahuvrīhi|dvandva|avyayībhāva/;
      const CLS = /\b\d{1,2}[PUA]\b/;
      /* The English abbreviations are the same rule as the Sanskrit names:
         "nom. sg." is jargon a beginner has not met, and below Stage 5 it is
         a constant besides — every headword there is nominative singular, so
         the field carries nothing until Stage 5 gives it meaning. */
      const CASE = /^(nom|acc|instr|dat|abl|gen|loc|voc)\b/;
      const early = { vibhakti: [], samasa: [], klass: [], caseAbbr: [] };
      const plain = [];
      Object.keys(DECKS).forEach(n => {
        const st = DECK_STAGE[n];
        DECKS[n].forEach(c => {
          const note = c.note || '';
          if (st > 0 && st < 5 && VIB.test(note)) early.vibhakti.push(c.id);
          if (st < 5 && CASE.test(note)) early.caseAbbr.push(c.id);
          /* the list that TEACHES the types is allowed to name them */
          if (st > 0 && st < 11 && SAM.test(note) && DECK_ROLE[n] !== 'core')
            early.samasa.push(c.id);
          if (st === 6 && CLS.test(note)) early.klass.push(c.id);
          // and where it does belong it is spelled out, not left as "1P"
          if (st === 9 && CLS.test(note)) plain.push(c.id);
        });
      });
      const taught = {};
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if ((c.type || 'reveal') === 'reveal') taught[(c.iast || '').trim()] = DECK_STAGE[n];
      }));
      const types = ['tatpuruṣaḥ', 'karmadhārayaḥ', 'dviguḥ', 'dvandvaḥ',
                     'bahuvrīhiḥ', 'avyayībhāvaḥ'];
      const untaught = types.filter(t => taught[t] !== 11);
      const lakara = (DECKS['34 · Lakāra — the ten tense-moods'] || [])
        .find(c => /optative/.test(c.gloss || ''));
      // Stage 21 is anuṣṭubh; the classical metres belong to Stage 22
      const vrttaAt = Object.keys(DECKS).filter(n => n.includes('Vṛtta'));
      const anustubh = Object.keys(DECKS).find(n => n.startsWith('Anuṣṭubh'));
      return {
        early, plain, untaught,
        lakara: (lakara || {}).gloss || '',
        vrttaStage: vrttaAt.map(n => DECK_STAGE[n]),
        anustubhStage: anustubh ? DECK_STAGE[anustubh] : null,
        anustubhCards: anustubh ? DECKS[anustubh].length : 0,
      };
    });
    ok('no card names a vibhakti before Stage 5 teaches it',
      !r.early.vibhakti.length, r.early.vibhakti.slice(0, 3).join(' | '));
    ok('nor leads its annotation with a case abbreviation there',
      !r.early.caseAbbr.length, r.early.caseAbbr.slice(0, 3).join(' | '));
    ok('nor a compound type before Stage 11 teaches it',
      !r.early.samasa.length, r.early.samasa.slice(0, 3).join(' | '));
    ok('and the class notation is gone from Stage 6, which does not test it',
      !r.early.klass.length, r.early.klass.slice(0, 3).join(' | '));
    ok('where the class does belong it is spelled out, not left as "1P"',
      !r.plain.length, r.plain.slice(0, 3).join(' | '));
    ok('each of the six compound types is taught at Stage 11',
      !r.untaught.length, r.untaught.join(' | '));
    ok('the optative card names both liṅ and vidhiliṅ',
      /liṅ \(vidhiliṅ\)/.test(r.lakara), r.lakara);
    ok('the classical metres sit at Stage 22, and nowhere earlier',
      r.vrttaStage.length > 0 && r.vrttaStage.every(s => s === 22),
      'stages ' + r.vrttaStage.join(', '));
    ok('and Stage 21 practises the anuṣṭubh it is named for',
      r.anustubhStage === 21 && r.anustubhCards >= 4,
      'stage ' + r.anustubhStage + ' · ' + r.anustubhCards + ' cards');
    await p.close();
  }

  // ── a track says what it gives you before it asks anything ─────────
  // Two pages, and nothing under them: the landing card opens the tracks, a
  // track's own page opens its lists, and a stage is not somewhere a learner
  // has to be introduced to twice.
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const rows = TRACK_ROWS.map(x => x.track);
      const missing = rows.filter(t => !t.lead || !(t.plan || []).length);
      const thin = rows.filter(t => t.lead && t.lead.split(/\s+/).length < 15);
      /* the coupling that keeps the prose honest: what the track holds, and
         the names the plan leans on.  Prose does not rewrite itself when a
         stage is added or a list renamed, so a test says so instead. */
      const stale = [], unknown = [];
      TRACK_ROWS.forEach(x => {
        if (x.track.lessons !== x.lessons.length)
          stale.push(x.track.name + ': says ' + x.track.lessons
            + ', holds ' + x.lessons.length);
        const names = new Set(x.lessons.map(L => L.label));
        x.lessons.forEach(L => L.decks.forEach(n => {
          const h = DECK_SHORT(n);
          names.add(h);
          if (h.includes(' · ')) names.add(h.split(' · ').slice(1).join(' · '));
        }));
        (x.track.mentions || []).forEach(m => {
          if (!names.has(m)) unknown.push(x.track.name + ': "' + m + '"');
        });
      });
      /* nothing below a track has a page of its own */
      const pages = typeof showTrack === 'function' && typeof window.showStage === 'undefined';
      showTrack('bhasha');
      const card = document.getElementById('trackcard');
      const tools = card.querySelector('.s-tools');
      const shown = {
        on: !card.hidden
            && getComputedStyle(document.getElementById('card')).display === 'none',
        name: document.getElementById('s-name').textContent,
        held: document.getElementById('s-held').textContent,
        steps: document.querySelectorAll('#s-plan li').length,
        go: document.getElementById('s-go').textContent,
        stats: !document.getElementById('s-stats').hidden,
        review: !document.getElementById('s-review').hidden,
        /* Begin leads the page: the action sits above the orientation prose,
           so a returning learner reaches "Continue —" without scrolling it. */
        goAboveLead: document.getElementById('s-go').getBoundingClientRect().top
                   < card.querySelector('.w-lead').getBoundingClientRect().top,
        /* a course track has nothing to skip */
        skipHidden: document.getElementById('s-skip').hidden,
        /* the two controls, shown as they appear rather than named: the red
           dotted annotation and the Study glyph itself */
        tagInk: getComputedStyle(tools.querySelector('.ann')).color,
        tagLine: getComputedStyle(tools.querySelector('.ann')).borderBottomStyle,
        glyph: !!tools.querySelector('.studybtn svg'),
        /* no list menu on the page: the lists are in the drawer */
        menu: card.querySelectorAll('.dk').length,
        /* nor the decorative binding holes, which belong to a flashcard */
        holes: getComputedStyle(card, '::before').content,
        kumkumaInk: (() => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--kumkuma-ink)';
          card.appendChild(probe);
          const c = getComputedStyle(probe).color;
          probe.remove();
          return c;
        })(),
      };
      return { missing, thin, stale, unknown, pages, shown, tracks: rows.length };
    });
    ok('every track carries a lead and a plan',
      !r.missing.length, r.missing.map(t => t.name).join(' | '));
    ok('and each one leads with real prose', !r.thin.length,
      r.thin.map(t => t.name).join(' | '));
    ok('a track’s prose says what the track actually holds',
      !r.stale.length, r.stale.join(' | '));
    ok('and names only lessons and lists that are in it',
      !r.unknown.length, r.unknown.join(' | '));
    ok('nothing below a track has a page of its own', r.pages);
    ok('the track page opens over the cards', r.shown.on);
    /* A track that groups its stages into units says so: four units is what
       Bhāṣā-Vidyā asks of a learner, and thirteen stages is how the
       repository stores them. */
    ok('it names the track and what it holds',
      /Bhāṣā-Vidyā/.test(r.shown.name)
        && /^\d+ (stages|units) · \d+ lists$/.test(r.shown.held),
      r.shown.held + ' · ' + r.shown.name);
    ok('it walks through how the track runs', r.shown.steps >= 2, r.shown.steps + ' steps');
    ok('it shows the annotation as it appears — red, and underlined',
      r.shown.tagLine === 'dotted' && r.shown.kumkumaInk === r.shown.tagInk,
      r.shown.tagInk + ' · ' + r.shown.tagLine);
    ok('and the Study control as the glyph it is', r.shown.glyph);
    ok('the page carries no list menu', r.shown.menu === 0, r.shown.menu + ' rows');
    ok('and no binding holes: it is read, not answered',
      r.shown.holes === 'none', r.shown.holes);
    ok('an untouched track offers to begin, with no progress to report',
      /^Begin/.test(r.shown.go) && !r.shown.stats && !r.shown.review, r.shown.go);
    ok('Begin leads the page, above the orientation prose',
      r.shown.goAboveLead && r.shown.skipHidden);

    // an optional track offers a way past it, beside Begin and up top
    const opt = await p.evaluate(() => {
      showTrack('devanagari');
      const skip = document.getElementById('s-skip'), go = document.getElementById('s-go');
      const lead = document.querySelector('#trackcard .w-lead');
      const out = { shown: !skip.hidden,
               aboveLead: skip.getBoundingClientRect().top < lead.getBoundingClientRect().top,
               go: go.textContent };
      showTrack('bhasha');            // the assertions after this expect the course track
      return out;
    });
    ok('an optional track offers Skip beside Begin, up top',
      opt.shown && opt.aboveLead && /^Begin/.test(opt.go), opt.go);

    // until then its lists are visible in the drawer but shut
    const shut = await p.evaluate(() => {
      openDrawer();
      openTracks.add('bhasha'); openLessons.add('01-nama'); renderDrawer();
      const mine = Object.keys(DECKS).filter(n => trackIdOf(n) === 'bhasha');
      const drawn = [...document.querySelectorAll('.dk')]
        .filter(b => mine.some(n => b.title.indexOf(n) === 0));
      return { drawn: drawn.length, locked: drawn.filter(b => b.disabled).length,
               said: !!document.querySelector('.ls-shut') };
    });
    ok('the track’s lists are drawn under its name in the drawer',
      shut.drawn > 0, shut.drawn + ' rows');
    ok('and every one is shut until the track has been begun',
      shut.locked === shut.drawn && shut.said,
      shut.locked + ' of ' + shut.drawn + ' shut');

    // begin is lesson-first: it opens what the first lesson teaches, and the
    // teaching's own prompt carries the learner on to the first list
    await p.evaluate(() => closeDrawer());
    await p.click('#s-go');
    const teach = await p.evaluate(() => ({
      panel: document.getElementById('study').style.display,
      title: document.getElementById('st-title').textContent,
      go: document.getElementById('st-go').textContent,
      begun: !!SAVED.begun.bhasha,
    }));
    ok('“Begin” opens what the track’s first lesson teaches',
      teach.panel === 'block' && teach.title === 'Nāma' && /^(Begin|Continue) — /.test(teach.go),
      teach.title + ' · ' + teach.go);
    ok('and unlocks the track for good', teach.begun);
    await p.click('#st-go');
    const gone = await p.evaluate(() => ({
      page: document.getElementById('trackcard').hidden,
      panel: document.getElementById('study').style.display,
      card: getComputedStyle(document.getElementById('card')).display,
      deck: deckName, track: trackIdOf(deckName), running: !!current,
      open: [...document.querySelectorAll('.dk')].filter(b => !b.disabled).length,
    }));
    ok('and its prompt opens the track’s first list',
      gone.page && gone.panel === 'none' && gone.card !== 'none'
        && gone.running && gone.track === 'bhasha',
      JSON.stringify({ deck: gone.deck, running: gone.running }));
    ok('the track is open for good', gone.open > 0, gone.open + ' lists open');

    /* A mode the learner cannot open yet has no business on the page that
       introduces the track: the figures stay, the reminder waits. */
    const locked = await p.evaluate(() => {
      const held = SAVED.mastered;
      SAVED.mastered = {};
      showTrack('bhasha');
      const out = { review: !document.getElementById('s-review').hidden,
                    side: !document.getElementById('s-side').hidden,
                    stats: !document.getElementById('s-stats').hidden,
                    txt: document.getElementById('trackcard').innerText };
      SAVED.mastered = held;
      return out;
    });
    ok('a locked Abhyāsa is not offered on the track page',
      !locked.review && !locked.side && !/Abhyāsa/.test(locked.txt), locked.txt.slice(-40));
    ok('but the track still reports its own progress', locked.stats);

    // once there is progress the page reports it instead of offering to start
    const again = await p.evaluate(() => {
      Object.keys(DECKS).filter(n => trackIdOf(n) === 'bhasha').slice(0, 6)
        .forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      showTrack('bhasha');
      return { go: document.getElementById('s-go').textContent,
               stats: !document.getElementById('s-stats').hidden,
               pct: document.getElementById('s-pct').textContent,
               review: !document.getElementById('s-review').hidden,
               reviewLabel: document.getElementById('s-review').textContent,
               side: document.getElementById('s-side').textContent.replace(/\s+/g, ' ').trim(),
               menu: document.querySelectorAll('#trackcard .dk').length,
               figures: [...document.querySelectorAll('#s-stats .w-stat')]
                 .filter(e => !e.hidden).length };
    });
    ok('a track in progress reports it rather than offering to begin',
      /^Continue/.test(again.go) && again.stats && /^\d+%$/.test(again.pct),
      again.go + ' · ' + again.pct);
    ok('and reports aggregates, never a directory of what is in the track',
      again.figures <= 2 && !again.menu, again.figures + ' figures');
    ok('Abhyāsa is a reminder with a way in, not a section',
      again.review && /Abhy/.test(again.reviewLabel) && again.side.length < 40,
      again.side.slice(0, 40));

    // and that way in opens the review, returning to the track afterwards
    await p.click('#s-review');
    const rev = await p.evaluate(() => ({
      panel: getComputedStyle(document.getElementById('reviewpanel')).display !== 'none',
      page: document.getElementById('trackcard').hidden,
    }));
    await p.click('#p-back');
    const back = await p.evaluate(() => !document.getElementById('trackcard').hidden);
    ok('the reminder’s button opens Abhyāsa', rev.panel && rev.page);
    ok('and closing it returns to the track', back);

    /* A track with nothing left to finish points at the review rather than
       at its own first list again. */
    const finished = await p.evaluate(() => {
      const row = TRACK_ROWS.find(x => x.track.id === 'svara');
      row.lessons.forEach(L => L.decks.forEach(n =>
        DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; })));
      SAVED.begun.svara = 1;
      showTrack('svara');
      const go = document.getElementById('s-go');
      const label = go.textContent;
      go.click();
      const opened = panelOpen;
      closePanel();
      return { label: label, opened: opened };
    });
    ok('a finished track offers the review, not its first list again',
      /^Every list complete/.test(finished.label) && finished.opened === 'reviewpanel',
      finished.label + ' → ' + finished.opened);

    /* Both pages stay reachable once they have been read: the track by its
       own name in the drawer, the landing card by the row that leads to it. */
    const again2 = await p.evaluate(() => {
      openDrawer();
      openTracks.clear(); renderDrawer();
      const at = () => [...document.querySelectorAll('.tr-head')]
        .find(b => b.querySelector('.tr-name').textContent === 'Bhāṣā-Vidyā');
      at().click();                       // opens the page, and expands the row
      const first = { open: at().getAttribute('aria-expanded'),
                      shut: document.getElementById('drawer').hidden,
                      page: !document.getElementById('trackcard').hidden,
                      name: document.getElementById('s-name').textContent };
      at().click();                       // and the same tap collapses it again
      return Object.assign(first, {
        second: at().getAttribute('aria-expanded'),
        stillOpen: !document.getElementById('drawer').hidden,
        /* no row inside a track stands for an introduction */
        nested: [...document.querySelectorAll('.tr-body button, .ls-body button')]
          .filter(b => /about|introduction/i.test(b.textContent)).length });
    });
    ok('tapping a track name in the drawer opens its page',
      again2.page && /Bhāṣā/.test(again2.name), again2.name);
    /* and leaves the menu up.  A tap that navigated AND closed the drawer
       left no way to collapse a track at all, and threw the learner out of
       the place they were browsing. */
    ok('and leaves the menu open, expanding the row rather than leaving',
      !again2.shut && again2.open === 'true', JSON.stringify(again2));
    ok('and the same tap collapses it again',
      again2.second === 'false' && again2.stillOpen, again2.second);
    ok('and no row is nested under the name to stand for it',
      again2.nested === 0, again2.nested + ' rows');
    await p.click('#dr-home');
    const home = await p.evaluate(() => ({
      welcome: !document.getElementById('welcome').hidden,
      shut: document.getElementById('drawer').hidden,
      go: document.getElementById('w-go').textContent,
    }));
    ok('and the landing card is reachable again from the drawer',
      home.welcome && home.shut, JSON.stringify(home));
    ok('offering what is in progress rather than a first beginning',
      home.go === 'In progress', home.go);
    await p.close();
  }

  // ── no choice card repeats a reveal card ───────────────────────────
  // A choice card that hands over the same operation and the same answer as
  // a reveal card in the same lesson is strictly the weaker of the two: the
  // reveal card asks for free recall and reverses into the opposite drill,
  // while the choice card shows the answer among its options.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const norm = s => (s || '').replace(/[√!]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const rev = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if ((c.type || 'reveal') !== 'reveal') return;
        rev.push({ L: DECK_LESSON[n], deck: n, cue: norm(c.iast),
                   out: (c.gloss || '').split(/[·—]/).map(norm).filter(Boolean) });
      }));
      const dupes = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if ((c.type || 'reveal') !== 'choice') return;
        const L = DECK_LESSON[n];
        const item = norm((c.front || '').split(/:\s/).slice(1).join(': '));
        const ans = norm(c.answer);
        if (!item) return;                       // a bare question, nothing handed over
        const same = rev.find(x => x.L === L && x.cue === item && x.out.includes(ans));
        const flip = rev.find(x => x.L === L && x.cue === ans && x.out.includes(item));
        if (same || flip) dupes.push(c.id + ' ≡ ' + (same || flip).deck);
      }));
      return { dupes };
    });
    ok('no choice card repeats a reveal card of the same lesson',
      !r.dupes.length, r.dupes.slice(0, 4).join(' | '));
    await p.close();
  }

  // ── the gaṇa mnemonics agree with each other and with the phrase ───
  // theory.md and reference.md disagreed on two of the eight, and the app
  // had copied one file for its practice and the other for its recall, so
  // the same lesson taught ja-gaṇa two different ways.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      /* the phrase both curriculum files cite, and the weight of each
         syllable in it: a long vowel is guru, a short one laghu */
      const PHRASE = [['ya','∪'],['mā','–'],['tā','–'],['rā','–'],['ja','∪'],
                      ['bhā','–'],['na','∪'],['sa','∪'],['la','∪'],['gā','–']];
      const START = { ya:0, ma:1, ta:2, ra:3, ja:4, bha:5, na:6, sa:7 };
      const derive = g => PHRASE.slice(START[g], START[g] + 3);

      /* The name sits in the gloss on a recall card and in the note on a
         practice card, so look in both.  No \b anywhere near this: JS word
         boundaries are ASCII, and every one of these ends in a long vowel. */
      const said = {};          // gaṇa -> every mnemonic the app prints for it
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        const where = (c.gloss || '') + ' ¦ ' + (c.note || '');
        const m = where.match(/([a-zā]+)-gaṇa/);
        if (!m || !(m[1] in START)) return;
        const mn = ((c.note || '').match(/·[^·]*?([^\s·]+-[^\s·]+-[^\s·]+)/) || [])[1];
        if (mn) (said[m[1]] = said[m[1]] || new Set()).add(mn);
      }));

      const disagree = [], wrong = [];
      Object.entries(said).forEach(([g, set]) => {
        if (set.size > 1) disagree.push(g + ': ' + [...set].join(' vs '));
        const want = derive(g).map(x => x[0]).join('-');
        [...set].forEach(mn => { if (mn !== want) wrong.push(g + ': ' + mn + ' ≠ ' + want); });
      });

      /* and the pattern each gaṇa card shows must be the weights that
         mnemonic actually spells */
      const badPattern = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        const m = (c.gloss || '').match(/^([a-zā]+)-gaṇa/);
        if (!m || !(m[1] in START)) return;
        const want = derive(m[1]).map(x => x[1]).join(' ');
        const got = (c.devanagari || '').replace(/—/g, '–').replace(/◡/g, '∪');
        if (got !== want) badPattern.push(m[1] + ': ' + got + ' ≠ ' + want);
      }));
      return { seen: Object.keys(said).length, disagree, wrong, badPattern };
    });
    ok('one mnemonic per gaṇa across the whole app',
      !r.disagree.length, r.disagree.join(' | '));
    ok('every mnemonic is what the phrase spells', !r.wrong.length, r.wrong.join(' | '));
    ok('every gaṇa pattern is the weights of its own mnemonic',
      !r.badPattern.length, r.badPattern.join(' | '));
    console.log('        ' + r.seen + ' gaṇas checked against yamātārājabhānasalagām');
    await p.close();
  }

  // ── every list is a chunk a learner can finish ─────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const big = Object.entries(DECKS)
        .filter(([, cs]) => cs.length > 25)
        .map(([n, cs]) => n + ':' + cs.length);
      // and no two lists in one lesson look the same in the drawer
      const clash = [];
      const byLesson = {};
      Object.keys(DECKS).forEach(n => {
        const L = DECK_LESSON[n];
        (byLesson[L] = byLesson[L] || []).push(n);
      });
      Object.entries(byLesson).forEach(([L, names]) => {
        const seen = {};
        names.forEach(n => {
          const short = DECK_SHORT(n);
          if (seen[short]) clash.push(L + ' · ' + short);
          seen[short] = n;
        });
      });
      /* Guards against a chunking pass leaving a stray fragment behind.  The
         floor is 4, not something larger: the smallest lists here are the 5
         sandhi derivations and the 4 metres worth naming, and both are that
         size because the content is, not because a split went wrong. */
      const tiny = Object.entries(DECKS)
        .filter(([n, cs]) => cs.length < 4
          /* a delta table is short because the delta is: the reference gives
             one ṛ-stem table for mātṛ and pitṛ together, so the feminine list
             holds the cell it does not share and says so */
          && !(n.startsWith('Śabda-rūpa') && !n.includes('all 24 cells'))
          /* and the dative salutation is one card per stem class, of which
             the stotra uses three: śivāya, devyai, viṣṇave.  A second a-stem
             drills nothing the first did. */
          && !n.startsWith('Namaḥ'))
        .map(([n, cs]) => n + ':' + cs.length);
      return { big, clash, tiny, decks: Object.keys(DECKS).length,
               cards: Object.values(DECKS).reduce((a, b) => a + b.length, 0) };
    });
    ok('no list runs past 25 cards', !r.big.length, r.big.slice(0, 4).join(' | '));
    ok('no two lists in a lesson share a display name',
      !r.clash.length, r.clash.slice(0, 4).join(' | '));
    ok('no list is a stray fragment', !r.tiny.length, r.tiny.join(' | '));
    console.log('        ' + r.decks + ' lists · ' + r.cards + ' cards');
    await p.close();
  }

  // ── the curriculum's own 50 core dhātus are all present ────────────
  // 09-dhatu/reference.md names them; the app carried 14.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const roots = new Set();
      Object.keys(DECKS).forEach(n => {
        if (!n.startsWith('Dhātu ')) return;
        DECKS[n].forEach(c => roots.add((c.iast || '').replace(/^√/, '')));
      });
      return { roots: [...roots], n: roots.size };
    });
    const REF = require('fs').readFileSync(
      require('path').resolve(__dirname, '..', '09-dhatu', 'reference.md'), 'utf8');
    const core = [...REF.matchAll(/^\|\s*\d+\s*\|\s*√(\S+)\s*\|/gm)].map(m => m[1]);
    const missing = core.filter(x => !r.roots.includes(x));
    ok('the reference still lists 50 core dhātus', core.length === 50, core.length + '');
    ok('every core dhātu is in the app', !missing.length,
      missing.length + ' missing: ' + missing.slice(0, 6).join(', '));
    console.log('        ' + r.n + ' roots across the Dhātu lists');
    await p.close();
  }

  // ── the three modes are findable, and say what they hold ───────────
  // These carried their Sanskrit names — Aṅkāḥ, Parīkṣā, Kliṣṭāni — which
  // named the concepts but meant nobody scanning the drawer for a
  // "Scoreboard" could find one.  Curriculum items are named in Sanskrit;
  // the app's own functions are named in English.
  {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.addInitScript(st => {
      try { localStorage.setItem('abhyāsaḥ', JSON.stringify(st)); } catch (e) {}
    }, { v: 3,
         decks: { '20 · Bhāva — inner states': { best: [13, 15], pile: [] },
                  '01 · Devī — goddess names': { best: [15, 15], pile: [] },
                  'V09 · Krodha — anger and fear · DM · LS': { best: [12, 16], pile: [] } },
         review: { runs: 4, right: 63, seen: 80 }, trouble: {}, cleared: 2, mastered: {} });
    await p.goto(FILE, { waitUntil: 'load' });

    /* A best score no longer makes a list complete — every card in it has to
       have come back cold — so the seeded store is brought up to that here,
       with enough cards mastered to unlock the review as well. */
    await p.evaluate(() => {
      const pick = new Set(['20 · Bhāva — inner states', '01 · Devī — goddess names']);
      let n = 0;
      for (const d of Object.keys(DECKS)) { if (n >= 45) break; pick.add(d); n += DECKS[d].length; }
      pick.forEach(d => DECKS[d].forEach(c => { SAVED.mastered[c.id] = 1; }));
      save(); relabelAll();
    });
    const rows = await p.evaluate(() => [...document.querySelectorAll('.dr-mode')].map(x => ({
      name: x.querySelector('.dm-name').textContent,
      sub: x.querySelector('.dm-sub').textContent,
    })));
    /* Abhyāsa is lifted out of the mode rows into the section the drawer
       opens with; what is left is named in English. */
    ok('the mode rows are named in English',
      JSON.stringify(rows.map(r => r.name)) ===
        JSON.stringify(['Home', 'Scoreboard']),
      rows.map(r => r.name).join(' | '));
    const sub = n => (rows.find(r => r.name === n) || {}).sub || '';
    ok('the scoreboard row counts what it holds',
      /\d+ of \d+ lists completed/.test(sub('Scoreboard')), sub('Scoreboard'));

    await p.evaluate(() => loadDeck(Object.keys(DECKS)[0]));  // off the landing card
    // and every one of them still opens and renders
    for (const [btn, id, want] of [
      ['#dr-board', 'board', /lists complete · \d+ played/],
      ['#dr-prog', 'reviewpanel', /Reviewing \d+ cards from \d+ learned/],
    ]) {
      await p.click('#nav');
      await p.click(btn);
      const r = await p.evaluate(([id]) => ({
        open: panelOpen === id,
        shown: getComputedStyle(document.getElementById(id)).display !== 'none',
        heading: document.querySelector('#' + id + ' h2').textContent,
        text: document.getElementById(id).textContent,
        rows: document.querySelectorAll('#' + id + ' .brow, #' + id + ' .row').length,
        /* the toggles change how a card is shown, and none is */
        controlsHidden: document.getElementById('controls').hidden,
      }), [id]);
      ok(id + ' opens and renders its state', r.open && r.shown && want.test(r.text),
        r.text.replace(/\s+/g, ' ').slice(0, 56));
      /* Devanagari is chrome here; the panels head themselves in Latin
         script, whether the word is English or the mode's own name. */
      ok(id + ' heads itself in Latin script', !/[ऀ-ॿ]/.test(r.heading), r.heading);
      ok(id + ' hides the card toggles', r.controlsHidden);
      await p.click('#p-back');
    }

    const back = await p.evaluate(() => ({
      controls: document.getElementById('controls').hidden,
      card: document.getElementById('card').style.display,
    }));
    ok('the toggles come back with the cards', !back.controls && back.card !== 'none');

    // the scoreboard lists the finished decks, best first
    await p.click('#nav');
    await p.click('#dr-board');
    const board = await p.evaluate(() => ({
      rows: [...document.querySelectorAll('#board .brow')].map(r => r.textContent),
      mastery: document.getElementById('b-mpct').textContent,
    }));
    ok('the scoreboard lists every finished deck', board.rows.length === 3,
      board.rows.length + ' rows');
    ok('and still carries the review mastery figure', board.mastery === '79%', board.mastery);
    await p.close();
  }

  // ── the IAST toggle governs a transliteration, and only that ───────
  // Two bugs lived here.  In the produce direction the transliteration was
  // appended to the morphology annotation instead of being shown on the
  // card, so the card had no IAST and the toggle appeared to rewrite the
  // grammar.  And on a card whose front is a scansion pattern rather than
  // Devanagari, the second line is content — a gaṇa's "laghu guru guru"
  // reads the marks, it does not transliterate them — and hiding it left
  // the card with nothing but the marks.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const el = id => document.getElementById(id).textContent;
      const show = (deck, card, dir, iast) => {
        loadDeck(deck); setDir(dir); setIast(iast);
        startRound([card], {}); reveal();
        return { dn: el('dn'), iastFront: el('iast'), gloss: el('gloss'),
                 iastBack: el('iast-back'), tag: el('tag'),
                 detail: el('detail'), detailIast: el('detail-iast'),
                 boxOff: document.getElementById('iast-on').disabled,
                 boxOn: document.getElementById('iast-on').checked };
      };

      const bhava = '20 · Bhāva — inner states';
      const word = DECKS[bhava][0];
      const pOn  = show(bhava, word, 'produce', true);
      const pOff = show(bhava, word, 'produce', false);
      const rOn  = show(bhava, word, 'reveal', true);
      const rOff = show(bhava, word, 'reveal', false);

      const vrtta = '28 · Vṛtta — the classical metres';
      const pattern = DECKS[vrtta].find(c => !/[ऀ-ॿ]/.test(c.devanagari));
      const headword = DECKS[vrtta].find(c => /[ऀ-ॿ]/.test(c.devanagari));
      const patOff = show(vrtta, pattern, 'reveal', false);
      const patOn  = show(vrtta, pattern, 'reveal', true);
      const headOff = show(vrtta, headword, 'reveal', false);

      /* A gaṇa card is the pure case: pattern on the front, "laghu guru
         guru" beneath it, and nothing on the card in Devanagari to
         transliterate.  There the box really is greyed. */
      const gana = '29 · Gaṇa — the eight metrical feet';
      const gOff = show(gana, DECKS[gana][0], 'reveal', false);

      /* Swept across every reveal card: a second line that is not a
         transliteration must survive the toggle being off. */
      setIast(false);
      const lost = [];
      Object.entries(DECKS).forEach(([n, cards]) => cards.forEach(c => {
        if ((c.type || 'reveal') !== 'reveal' || !c.iast) return;
        if (/[ऀ-ॿ]/.test(c.devanagari || '')) return;   // has a translit
        startRound([c], {});
        if (!document.getElementById('iast').textContent) lost.push(c.id);
      }));

      return { pOn, pOff, rOn, rOff, patOff, patOn, headOff, gOff,
               lost: lost.slice(0, 3), nLost: lost.length,
               word: word.iast };
    });

    ok('the produce direction shows IAST on the card',
      r.pOn.iastBack === r.word && r.pOn.gloss && !r.pOn.iastFront,
      JSON.stringify(r.pOn.iastBack));
    ok('and not folded into the annotation',
      !r.pOn.tag.includes(r.word), r.pOn.tag.slice(0, 40));
    ok('toggling IAST never rewrites the annotation',
      r.pOn.tag === r.pOff.tag && r.rOn.tag === r.rOff.tag, r.pOff.tag.slice(0, 40));
    ok('the produce direction can still hide it', !r.pOff.iastBack, r.pOff.iastBack);
    ok('the reveal direction is unchanged',
      r.rOn.iastFront === r.word && !r.rOff.iastFront && !r.rOn.iastBack);

    ok('a scansion pattern keeps its reading with IAST off',
      !!r.patOff.iastFront, JSON.stringify(r.patOff.iastFront));
    /* The rule is per line, not per card.  A vṛtta card's front pair is a
       pattern and its syllable count — nothing to transliterate — but its
       ANSWER pair is the gaṇa formula in Devanagari over the same formula in
       IAST, which is a transliteration exactly.  So the box is live, and what
       it hides is the second of those two lines and nothing else. */
    ok('a vṛtta card keeps its gaṇa formula and hides only its IAST',
      !r.patOff.boxOff && r.patOff.detail && !r.patOff.detailIast
        && r.patOn.detail === r.patOff.detail && !!r.patOn.detailIast,
      JSON.stringify(r.patOff.detail) + ' / ' + JSON.stringify(r.patOff.detailIast));
    ok('and the metre is not given away on the front',
      !r.patOff.dn.includes(r.patOff.detail) && !r.patOff.iastFront.includes('ma'),
      JSON.stringify(r.patOff.iastFront));
    ok('a card with nothing to transliterate still greys the box',
      r.gOff.boxOff && r.gOff.boxOn && !!r.gOff.iastFront,
      'disabled ' + r.gOff.boxOff + ' · ' + JSON.stringify(r.gOff.iastFront));
    /* Reversed, the card runs metre → pattern.  `detail` belongs to the
       ANSWER, so it has to move with it: rendered from c.detail rather than
       from whichever side the Devanagari is on, it stays on the back. */
    const rev = await p.evaluate(() => {
      const vrtta = '28 · Vṛtta — the classical metres';
      const card = DECKS[vrtta].find(c => !/[ऀ-ॿ]/.test(c.devanagari));
      loadDeck(vrtta); setDir('produce'); setIast(true);
      startRound([card], {});
      const front = document.getElementById('dn').textContent
                  + ' ' + document.getElementById('iast').textContent;
      reveal();
      const d = document.getElementById('detail');
      return { front, detail: d.textContent,
               /* the slot the learner cannot see until the card is turned */
               hidden: !!d.closest('.back'),
               back: document.getElementById('gloss').textContent };
    });
    ok('reversed, the gaṇa formula stays on the answer side',
      rev.hidden && !rev.front.includes(rev.detail) && rev.detail.includes('·')
        && rev.back.includes('◡'),
      JSON.stringify(rev.front.trim()) + ' → ' + JSON.stringify(rev.detail));

    ok('a real headword in the same list still hides its IAST',
      !r.headOff.iastFront && !r.headOff.boxOff, JSON.stringify(r.headOff.iastFront));

    ok('no card loses a second line that is not a transliteration',
      r.nLost === 0, r.nLost + ' lost, eg ' + r.lost.join(', '));
    await p.close();
  }

  // ── the Study renderer drops nothing ──────────────────────────────
  // Study now shows the lesson's theory.md, and preserves it essentially
  // verbatim: it may strip the markup that makes a heading a heading, and
  // nothing else.  Checked line by line against the source rather than by eye,
  // because a renderer that quietly eats a table row would look perfectly fine
  // on screen.
  {
    const fs = require('fs');
    const markdown = require('./markdown');
    const root = path.resolve(__dirname, '..');
    const squash = x => x.replace(/\s+/g, '');
    const text = h => h.replace(/<[^>]+>/g, '\n')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&');

    const lost = [];
    let files = 0, fragments = 0;
    for (const d of fs.readdirSync(root).filter(x => /^\d\d-/.test(x))) {
      const f = path.join(root, d, 'theory.md');
      if (!fs.existsSync(f)) continue;
      const md = fs.readFileSync(f, 'utf8');
      const got = squash(text(markdown.render(md).html));
      files++;
      let fence = false;
      md.split('\n').forEach((raw, n) => {
        if (/^\s*```/.test(raw)) { fence = !fence; return; }
        /* a table's rule and a horizontal rule are markup, not content */
        if (!fence && /^\s*\|[\s|:-]*\|?\s*$/.test(raw) && raw.includes('-')) return;
        if (!fence && /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) return;
        const line = fence ? raw : raw
          .replace(/^(\s*)#{1,6}\s+/, '$1').replace(/^(\s*)>\s?/, '$1')
          .replace(/^(\s*)[-*+]\s+/, '$1').replace(/^(\s*)\d+\.\s+/, '$1');
        /* a table row's cells are separate fragments; everything else is one */
        /* emphasis markers become tags, so they are markup too — but a lone
           escaped star is content and comes through as one */
        const plain = x => squash(x.replace(/\\\*/g, '\u0001')
                                   .replace(/\*/g, '')
                                   .replace(/\u0001/g, '*'));
        const parts = (!fence && /^\s*\|/.test(line) ? line.split('|') : [line])
          .map(x => fence ? squash(x) : plain(x))
          .filter(Boolean);
        parts.forEach(x => {
          fragments++;
          if (!got.includes(x)) lost.push(d + ':' + (n + 1) + ' ' + JSON.stringify(x.slice(0, 40)));
        });
      });
    }
    ok('the Study renderer loses no teaching text', !lost.length,
      lost.length ? lost.slice(0, 3).join(' | ')
                  : fragments + ' fragments across ' + files + ' theory files');
  }

  // ── Abhyāsa is the drawer's opening section, not one row of three ──
  // The mastery mode carries the app's own name and the figure is read off
  // it, so it is lifted out of the mode list into the section the drawer
  // opens with.  Every number there is labelled before it is given: the UI
  // states the meaning, and the multiplication behind it never surfaces.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      openDrawer();
      const sec = document.getElementById('dr-prog');
      const modes = [...document.querySelectorAll('.dr-mode .dm-name')]
        .map(x => x.textContent);
      const out = {
        first: document.querySelector('#drawer .dr-prog, #drawer .dr-mode') === sec,
        name: document.getElementById('dp-label').textContent,
        heads: [...document.querySelectorAll('#drawer .dp-h')].map(x => x.textContent),
        pct: document.getElementById('dp-pct').textContent,
        cards: document.getElementById('dp-cards').textContent,
        bars: document.querySelectorAll('#dr-prog .bar').length,
        valueSize: parseFloat(getComputedStyle(document.getElementById('dp-pct')).fontSize),
        nameSize: parseFloat(getComputedStyle(document.querySelector('.dm-name')).fontSize),
        /* neither the arithmetic nor the readings it combines: the drawer
           carries the figure, the card carries what it is made of */
        formula: /[×x]\s*\d+%|cold recall|cards drawn|lists finished|accuracy|coverage/i
                   .test(document.getElementById('drawer').textContent),
        /* the button reads as a button, not as another row */
        raised: getComputedStyle(sec).borderTopWidth !== '0px'
             && !!sec.querySelector('.dp-go'),
        stat: document.getElementById('dp-cards').textContent,
        modes: modes,
        notAMode: !modes.some(x => /abhy/i.test(x)),
        tappable: sec.tagName === 'BUTTON',
      };
      sec.click();
      out.opens = document.getElementById('reviewpanel').style.display === 'block';
      out.heading = document.querySelector('#reviewpanel h2').textContent;
      closePanel();
      return out;
    });

    ok('the drawer opens with the Abhyāsa section',
      r.first && /abhy[aā]sa/i.test(r.name), r.name);
    ok('it is drawn as a button, not another row', r.raised);
    /* Each measure owns its own bar: one bar between two figures belongs to
       neither, which is exactly how it read. */
    ok('each measure is labelled, valued and barred separately',
      JSON.stringify(r.heads) === JSON.stringify(['Overall mastery', 'Lists complete'])
        && r.bars === 2 && /^\d+ of \d+$/.test(r.cards),
      r.heads.join(' | ') + ' · ' + r.cards + ' · ' + r.bars + ' bars');
    ok('the mastery figure is not the biggest type in the drawer',
      r.valueSize <= r.nameSize, r.valueSize + 'px vs ' + r.nameSize + 'px on a list name');
    ok('the drawer carries the figure and its rank alone',
      /^(Unranked|\d+% · [A-Z])/.test(r.pct) && !r.formula, r.pct);
    ok('it is the draw, one tap away', r.tappable && r.opens && r.heading === 'Abhyāsa',
      r.heading);
    ok('so it is no longer one of the mode rows', r.notAMode, r.modes.join(' | '));
    await p.close();
  }

  // ── what a review draws, and when a card comes back ───────────────
  // The card promises material is checked repeatedly over time but not too
  // often: remembered cards rest, missed cards return sooner, and the draw
  // stays spread across every completed list.  Each of those is asserted
  // against the draw itself rather than against the code that builds it.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const small = Object.keys(DECKS).filter(n => DECKS[n].length <= 15).slice(0, 6);
      /* a card enters the pool by having come back cold, not by sitting in
         a list that was played to the end */
      SAVED.decks = {}; SAVED.mastered = {};
      small.forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };

      /* with nothing recorded, every card is due and the draw is full */
      const first = mixCards();
      out.size = first.length;
      out.lists = new Set(first.map(c => DECK_OF.get(c))).size;
      out.listsAvailable = small.length;

      /* record the session: half remembered, half missed */
      const missed = new Set(first.filter((c, i) => i % 2));
      SAVED.review.runs++;
      recordReview(first, missed);

      const rested = new Set(first.filter(c => !missed.has(c)));
      /* Everything else in the pool is unseen, and unseen material leads the
         draw — rightly.  Mark it seen and remembered so the next draw is
         deciding between a miss and a success, which is the rule under
         test. */
      reviewPool().forEach(c => {
        const k = cardKey(c);
        if (!SAVED.review.cards[k]) SAVED.review.cards[k] = [SAVED.review.runs, 1];
      });
      const second = mixCards();
      const back = new Set(second);
      out.missedBack = first.filter(c => missed.has(c)).every(c => back.has(c));
      /* The remembered ones are resting, so they may only appear once the
         due cards run out — never ahead of a card that was missed. */
      const lastMissed = second.reduce((k, c, i) => missed.has(c) ? i : k, -1);
      out.restedAhead = second.slice(0, lastMissed + 1).filter(c => rested.has(c)).length;

      /* a card remembered repeatedly rests for longer and longer */
      const one = [...rested][0];
      delete SAVED.review.cards[cardKey(one)];      // measure the ladder from the start
      const restOf = () => {
        const rec = SAVED.review.cards[cardKey(one)];
        return restFor(rec[1]);
      };
      out.rests = [];
      for (let i = 0; i < 4; i++) {
        SAVED.review.runs++;
        recordReview([one], new Set());
        out.rests.push(restOf());
      }
      /* and one miss puts it straight back in the next session */
      SAVED.review.runs++;
      recordReview([one], new Set([one]));
      out.afterMiss = restOf();
      out.dueAfterMiss = overdueBy(one) >= 0;

      /* a short pool still hands back a full session rather than a stunted
         one — nothing is due, but the draw fills anyway */
      SAVED.review.runs = 1;
      SAVED.review.cards = {};
      reviewPool().forEach(c => { SAVED.review.cards[cardKey(c)] = [1, 4]; });
      out.filled = mixCards().length;

      /* and the draw is not a replay of the last one */
      SAVED.review.cards = {};
      const a = mixCards().map(cardKey).join('|');
      const b = mixCards().map(cardKey).join('|');
      out.varies = a !== b;
      return out;
    });

    ok('a review draws a full session', r.size === 20, r.size + ' cards');
    ok('spread across every completed list',
      r.lists === r.listsAvailable, r.lists + ' of ' + r.listsAvailable + ' lists');
    ok('a missed card comes back in the next session', r.missedBack);
    ok('while remembered cards yield to it', r.restedAhead === 0,
      r.restedAhead + ' cut ahead of a missed card');
    ok('and rest longer each time they are remembered',
      JSON.stringify(r.rests) === JSON.stringify([1, 2, 4, 8]), r.rests.join(' → '));
    ok('one miss puts it back in the very next session',
      r.afterMiss === 0 && r.dueAfterMiss);
    ok('a pool with nothing due still fills the session', r.filled === 20,
      r.filled + ' cards');
    ok('and no two draws are the same', r.varies);
    await p.close();
  }

  // ── a card missed in a review comes back, through the real path ────
  // The pacing test above drives recordReview() directly, which is the
  // scheduler in isolation.  This one grades a card WRONG the way a learner
  // does — didntKnow() — and then asks whether the review ever shows it
  // again.  It used not to: missing a card un-masters it, the pool was the
  // mastered set alone, and a draw keeps no list's books, so the one card
  // just proved weak left Abhyāsa altogether and reached no missed pile
  // either.  Nothing brought it back at all.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      /* A mid-course store: far more learned than one session can hold, so
         the lapsed card has to compete with hundreds the review has never
         asked about.  That is the case that stayed broken when the card was
         merely "due". */
      SAVED.mastered = {}; SAVED.decks = {}; SAVED.trouble = {};
      let n = 0;
      /* Reveal cards only.  What is measured here is the lapse-and-return
         path; a choice card deliberately wants a second right answer on a
         second day before it is mastered again, which is a different rule
         with a test of its own, and it would read here as the review failing
         to win the card back. */
      Object.keys(DECKS).forEach(d => DECKS[d].forEach(c => {
        if (n < 600 && (c.type || 'reveal') === 'reveal') { SAVED.mastered[c.id] = 1; n++; }
      }));
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };
      const covBefore = coverageOf().done;

      /* one real session, one real miss */
      startMixedReview();
      const victim = current.card;
      out.victim = victim.id;
      didntKnow();
      let g = 0;
      while (current && g++ < 100) knew();

      out.mastered = !!SAVED.mastered[victim.id];      // the tick is taken back
      out.inPool = reviewPool().some(c => c.id === victim.id);
      /* the three states the draw sorts on, read while they are all true:
         the lapsed card, one answered right in that same session, and one
         the review has never asked about */
      const held = reviewPool().find(c => (SAVED.review.cards[c.id] || [0, 0])[1] > 0);
      const unseen = reviewPool().find(c => !SAVED.review.cards[c.id]);
      out.tiers = { lapsed: urgencyOf(victim),
                    unseen: unseen ? urgencyOf(unseen) : null,
                    holding: held ? urgencyOf(held) : null };
      /* Not due again within the session that just showed it — a session is a
         day, and a card does not loop inside one. */
      out.dueSameSession = overdueBy(victim) >= 0;
      out.inSameSessionDraw = mixCards().some(c => c.id === victim.id);
      /* coverage may not rise on a miss: a lapsed card is material the
         review is chasing, not material already covered */
      out.covRose = coverageOf().done > covBefore;

      /* The next day: the session rolls, and so does the day it was lost on. */
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      SAVED.review.day = yesterday;
      SAVED.trouble[victim.id].m = yesterday;

      out.due = overdueBy(victim) >= 0;
      out.inNextDraw = mixCards().some(c => c.id === victim.id);
      out.leadsDraw = mixCards().findIndex(c => c.id === victim.id) < 20;

      /* shown there and answered right, it is learned again and then rests */
      startMixedReview();
      let g2 = 0, shown = false;
      while (current && g2++ < 100) { if (current.card.id === victim.id) shown = true; knew(); }
      out.shownAgain = shown;
      out.reMastered = !!SAVED.mastered[victim.id];
      out.wonBack = urgencyOf(victim);
      out.restsAfter = restFor((SAVED.review.cards[victim.id] || [0, 0])[1]);
      out.dueAfter = overdueBy(victim) >= 0;

      return out;
    });
    ok('a review miss takes the card\u2019s tick back', !r.mastered);
    ok('but never drops it out of Abhy\u0101sa', r.inPool && r.due);
    ok('without looping inside the session that showed it',
      !r.dueSameSession && !r.inSameSessionDraw,
      JSON.stringify({ due: r.dueSameSession, drawn: r.inSameSessionDraw }));
    ok('it returns in the very next session, mid-course pool and all',
      r.due && r.inNextDraw && r.leadsDraw,
      JSON.stringify({ due: r.due, inDraw: r.inNextDraw, leads: r.leadsDraw }));
    ok('and coverage does not rise on a miss', !r.covRose);
    ok('answered right there, it counts as learned again',
      r.shownAgain && r.reMastered,
      JSON.stringify({ shown: r.shownAgain, mastered: r.reMastered }));
    ok('and is won back rather than staying urgent', r.wonBack === 0,
      'tier ' + r.wonBack);
    ok('then rests instead of repeating', r.restsAfter === 1 && !r.dueAfter,
      'rest ' + r.restsAfter);
    ok('proven weak leads unmeasured, and both lead proven strong',
      r.tiers.lapsed === 2 && r.tiers.unseen === 1 && r.tiers.holding === 0,
      JSON.stringify(r.tiers));
    await p.close();
  }

  // ── a right answer moments after the answer was shown is not cold ──
  // knew() already refused a card missed earlier in the SAME round.  But
  // "Practise these again" and the missed pile start a FRESH round with
  // fresh per-round flags, so the identical card, answered right seconds
  // after being told, used to count as a cold recall — and mastery feeds
  // coverage, list completion, the awards and the review pool.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const name = Object.keys(DECKS).find(n => DECKS[n].length <= 10
        && DECKS[n].every(c => (c.type || 'reveal') === 'reveal'));
      SAVED.mastered = {}; SAVED.trouble = {}; SAVED.decks = {};
      loadDeck(name);

      /* miss one card the way a learner does, know the rest */
      const victim = current.card;
      out.victim = victim.id;
      didntKnow();
      let g = 0;
      while (current && g++ < 40) { reveal(); knew(); }
      out.afterMiss = !!SAVED.mastered[victim.id];

      /* the loophole: replay the misses at once and answer right */
      document.getElementById('again-missed').click();
      out.replayIsVictim = current.card.id === victim.id;
      out.badgeShown = !document.getElementById('relearn').hidden;
      reveal(); knew();
      out.afterReplay = !!SAVED.mastered[victim.id];
      out.roundStillCounted = learned > 0;   // the round tally is unaffected
      /* and the one control that points at it still does: a card met again
         but not won is exactly what the missed pile is for */
      out.pileAfterReplay = (SAVED.decks[name].pile || []).indexOf(victim.id) >= 0;

      /* a card never missed is untouched by any of this */
      const clean = DECKS[name].find(c => c.id !== victim.id);
      out.cleanMastered = !!SAVED.mastered[clean.id];

      /* the day rolls over: the same answer is now a real recall */
      SAVED.trouble[victim.id].m = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      startRound([DECKS[name].find(c => c.id === victim.id)], {});
      out.badgeNextDay = !document.getElementById('relearn').hidden;
      reveal(); knew();
      out.afterNextDay = !!SAVED.mastered[victim.id];
      out.pileAfterWin = (SAVED.decks[name].pile || []).indexOf(victim.id) >= 0;

      /* and a page-load id would not have done: a tab left open holds one
         SESSION for as long as it lives, so the stamp has to be the day */
      out.stampIsADay = /^\d{4}-\d\d-\d\d$/.test(SAVED.trouble[victim.id].m);
      return out;
    });
    ok('a missed card is not mastered by the round that missed it', !r.afterMiss);
    ok('nor by replaying the misses seconds later',
      r.replayIsVictim && !r.afterReplay,
      JSON.stringify({ replayed: r.replayIsVictim, mastered: r.afterReplay }));
    ok('the card says why — it is marked a second look', r.badgeShown);
    ok('though the round still counts it as answered', r.roundStillCounted);
    ok('and it stays in the missed pile, which is the way back',
      r.pileAfterReplay);
    ok('a card that was never missed is unaffected', r.cleanMastered);
    ok('a day later the same answer is a real recall',
      r.afterNextDay && !r.badgeNextDay,
      JSON.stringify({ mastered: r.afterNextDay, badge: r.badgeNextDay }));
    ok('which finally clears it out of the missed pile', !r.pileAfterWin);
    ok('and the stamp is a day, not a page load', r.stampIsADay);
    await p.close();
  }

  // ── a session is a day you reviewed, not a round you played ────────
  // REST is indexed by SAVED.review.runs, and every draw used to advance it,
  // so three draws back to back — milliseconds of them — aged the whole pool
  // by three sessions and carried cards to "retained", which is supposed to
  // mean two review sessions days apart.  The spacing a learner was meant to
  // be waiting out could simply be minted.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const names = Object.keys(DECKS).slice(0, 6);
      SAVED.mastered = {}; SAVED.trouble = {}; SAVED.decks = {};
      names.forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };

      /* five full draws in one sitting, everything answered right */
      const t0 = Date.now();
      for (let i = 0; i < 5; i++) {
        startMixedReview();
        let g = 0;
        while (current && g++ < 60) knew();
      }
      out.elapsedMs = Date.now() - t0;
      out.runsSameDay = SAVED.review.runs;
      out.maxStreakSameDay = Math.max.apply(null,
        Object.keys(SAVED.review.cards).map(k => SAVED.review.cards[k][1]));
      out.retainedSameDay = reviewPool().filter(c => isRetained(c.id)).length;
      out.seen = SAVED.review.seen;          // accuracy still counts every card
      out.drawsWereFull = out.seen === 100;

      /* the same five draws, one per day, do advance it */
      for (let i = 0; i < 3; i++) {
        SAVED.review.day = '2000-01-0' + (i + 1);
        startMixedReview();
        let g = 0;
        while (current && g++ < 60) knew();
      }
      out.runsAcrossDays = SAVED.review.runs;
      out.retainedAcrossDays = reviewPool().filter(c => isRetained(c.id)).length;

      /* and the due figure is true before the visit rather than after it:
         the count is banked at the end of a session, so a raw read of `runs`
         would leave the invitation a session stale all day */
      SAVED.review.day = '1999-12-31';
      out.dueBeforeDrawing = dueCount();
      return out;
    });
    ok('five draws in one sitting are one session',
      r.runsSameDay === 1, r.runsSameDay + ' sessions in ' + r.elapsedMs + 'ms');
    ok('so a run of first-try corrects cannot be minted',
      r.maxStreakSameDay === 1, 'longest run ' + r.maxStreakSameDay);
    ok('and nothing is retained the day it was learned',
      r.retainedSameDay === 0, r.retainedSameDay + ' retained');
    ok('though every card answered still counts towards accuracy',
      r.drawsWereFull, r.seen + ' cards reviewed');
    ok('while days apart do advance the ladder',
      r.runsAcrossDays === 4, r.runsAcrossDays + ' sessions');
    ok('and do earn the retained tier',
      r.retainedAcrossDays > 0, r.retainedAcrossDays + ' retained');
    ok('the due figure is true before the visit, not after it',
      r.dueBeforeDrawing > 0, r.dueBeforeDrawing + ' due');
    await p.close();
  }

  // ── a guess is not a recall ────────────────────────────────────────
  // A choice card puts the answer on screen among three or four, so a tap is
  // right one time in three with no knowledge at all — and a single cold win
  // used to mark a card learned for good, the tick only coming off if it was
  // missed somewhere later.  Every lucky tap stuck.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const name = Object.keys(DECKS).find(n =>
        DECKS[n].length >= 6 && DECKS[n].every(c => c.type === 'choice'));
      const ids = DECK_IDS[name];
      out.deck = name;
      const rightAnswer = () => {
        [...document.querySelectorAll('#choices .opt')]
          .find(x => x.textContent === current.card.answer).click();
        document.getElementById('g-next').click();
      };
      const playRight = () => {
        let g = 0;
        while (current && g++ < 60) rightAnswer();
      };
      const reset = () => {
        SAVED.mastered = {}; SAVED.pending = {}; SAVED.trouble = {}; SAVED.decks = {};
      };

      /* one faultless round earns no tick — only half the evidence */
      reset();
      loadDeck(name); playRight();
      out.day1 = { pct: progressOf(ids).pct, waiting: confirmingIn(ids) };
      out.day1Says = document.getElementById('r-score').textContent;

      /* and a second round the same day is still one day's evidence */
      loadDeck(name); playRight();
      out.sameDayAgain = progressOf(ids).pct;

      /* the drawer says how many are half-way rather than leaving a bare 0% */
      openDrawer(); renderDrawer();
      out.drawerSays = [...document.querySelectorAll('.dk')]
        .some(b => b.title.indexOf(name) === 0 && /to confirm/.test(b.textContent));
      closeDrawer();

      /* a day later, the same answers confirm them */
      Object.keys(SAVED.pending).forEach(k => { SAVED.pending[k] = '2000-01-01'; });
      loadDeck(name); playRight();
      out.day2 = { pct: progressOf(ids).pct, full: progressOf(ids).full,
                   waiting: confirmingIn(ids) };

      /* a miss resets the evidence rather than pausing it */
      reset();
      const card = DECKS[name][0];
      startRound([card], {});
      rightAnswer();                                  // half-way there
      out.halfWay = !!SAVED.pending[card.id];
      startRound([card], {});
      [...document.querySelectorAll('#choices .opt')]
        .find(x => x.textContent !== card.answer).click();
      document.getElementById('g-next').click();
      out.afterMiss = { pending: !!SAVED.pending[card.id],
                        mastered: !!SAVED.mastered[card.id] };

      /* chance alone now has to land twice: a blind run masters nothing */
      reset();
      loadDeck(name);
      let g = 0;
      while (current && g++ < 60) {
        document.querySelector('#choices .opt').click();   // always the first
        document.getElementById('g-next').click();
      }
      out.blind = { mastered: progressOf(ids).done, lucky: confirmingIn(ids) };

      /* and a reveal card, where the learner attests the recall, is untouched */
      reset();
      const rev = Object.keys(DECKS).find(n =>
        DECKS[n].every(c => (c.type || 'reveal') === 'reveal'));
      startRound([DECKS[rev][0]], {});
      reveal(); knew();
      out.revealMastered = !!SAVED.mastered[DECKS[rev][0].id];
      return out;
    });
    ok('a faultless first round on a choice list earns no tick yet',
      r.day1.pct === 0 && r.day1.waiting > 0, JSON.stringify(r.day1));
    ok('and says so, rather than leaving an unexplained 0%',
      /waiting to be confirmed/.test(r.day1Says) && r.drawerSays,
      JSON.stringify({ results: /waiting to be confirmed/.test(r.day1Says),
                       drawer: r.drawerSays }));
    ok('a second round the same day is still one day\u2019s evidence',
      r.sameDayAgain === 0, r.sameDayAgain + '%');
    ok('a day later the same answers confirm them',
      r.day2.full && r.day2.waiting === 0, JSON.stringify(r.day2));
    ok('a miss resets the evidence rather than pausing it',
      r.halfWay && !r.afterMiss.pending && !r.afterMiss.mastered,
      JSON.stringify(r.afterMiss));
    ok('so chance alone masters nothing, however lucky the run',
      r.blind.mastered === 0, r.blind.mastered + ' mastered, '
        + r.blind.lucky + ' lucky taps held half-way');
    ok('while a reveal card still counts on one cold showing', r.revealMastered);
    await p.close();
  }

  // ── the review asks harder as a card holds up ──────────────────────
  // Recognising a form and producing one are not the same skill, and the
  // badges want the second.  But reversal was entirely learner-driven, the
  // setting defaults to recognition, and a draw ran whichever way the toggle
  // happened to sit — so a card could be learned, reviewed twice and called
  // RETAINED without the produce direction ever being attempted.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      /* a small all-reveal pool, just over the unlock threshold, so cards
         come back rather than fresh material leading every draw */
      const names = [];
      let n = 0;
      for (const name of Object.keys(DECKS)) {
        if (!DECKS[name].every(c => (c.type || 'reveal') === 'reveal')) continue;
        names.push(name); n += DECKS[name].length;
        if (n >= 42) break;
      }
      SAVED.mastered = {}; SAVED.pending = {}; SAVED.trouble = {}; SAVED.decks = {};
      names.forEach(nm => DECKS[nm].forEach(c => { SAVED.mastered[c.id] = 1; }));
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };
      setDir('reveal');                       // the learner's own setting

      const dn = () => document.getElementById('dn').textContent;
      const DEVA = /[\u0900-\u097F]/;

      out.sessions = [];
      for (let sn = 0; sn < 4; sn++) {
        SAVED.review.day = '2000-01-0' + (sn + 1);       // a new day each time
        startMixedReview();
        const rec = { produced: 0, recognised: 0, latinFronts: 0 };
        let g = 0;
        while (current && g++ < 60) {
          if (askedDir(current.card) === 'produce') {
            rec.produced++;
            if (!DEVA.test(dn())) rec.latinFronts++;
            rec.cue = document.getElementById('cue').textContent;
            rec.toggle = document.getElementById('dir-label').textContent;
            rec.locked = document.getElementById('dir').disabled;
            rec.typography = document.body.classList.contains('mode-produce');
            reveal();
            rec.backIsDevanagari = DEVA.test(document.getElementById('gloss').textContent);
          } else {
            rec.recognised++;
            if (!rec.firstReturnFront) rec.firstReturnFront = DEVA.test(dn());
          }
          reveal(); knew();
        }
        out.sessions.push(rec);
      }
      out.settingUntouched = SAVED.dir;

      /* ordinary practice is still the learner's, and the toggle is live */
      loadDeck(names[0]);
      out.practice = { deva: DEVA.test(dn()),
                       live: !document.getElementById('dir').disabled,
                       label: document.getElementById('dir-label').textContent };

      /* an interactive card in a review runs one way, as it always did */
      const ch = Object.keys(DECKS).find(nm => DECKS[nm].every(c => c.type === 'choice'));
      const cc = DECKS[ch][0];
      SAVED.mastered[cc.id] = 1;
      SAVED.review.cards[cc.id] = [SAVED.review.runs, 3];
      startRound([cc], { mixed: true });
      out.choiceDir = askedDir(cc);
      out.choiceLabel = document.getElementById('dir-label').textContent;
      return out;
    });
    const later = r.sessions[3], early = r.sessions[0];
    ok('a card the review has never checked is asked for recognition',
      early.produced === 0 && early.recognised > 0, JSON.stringify(early));
    ok('and one that has come back once is asked to be produced',
      later.produced > 0, JSON.stringify({ produced: later.produced,
                                           recognised: later.recognised }));
    ok('the card really is reversed, not merely relabelled',
      later.latinFronts === later.produced && later.backIsDevanagari,
      JSON.stringify({ latinFronts: later.latinFronts, back: later.backIsDevanagari }));
    ok('the cue and the typography follow the direction asked',
      later.cue === 'Produce the word' && later.typography, later.cue);
    ok('the toggle states what is being asked rather than offering to change it',
      later.locked && /\u2192/.test(later.toggle) && later.toggle !== 'one direction only',
      later.toggle);
    ok('and the learner\u2019s own setting is left alone',
      r.settingUntouched === 'reveal' && r.practice.deva && r.practice.live,
      JSON.stringify(r.practice));
    ok('nor is an interactive card, which runs one way',
      r.choiceDir === 'reveal' && r.choiceLabel === 'one direction only',
      r.choiceLabel);
    await p.close();
  }

  // ── the course leads, the vocabulary follows ───────────────────────
  // "Continue —" is the one instruction the app gives, and it walked the
  // track in flat curriculum order.  82 of the 176 lists widen the
  // vocabulary rather than carrying the course, and 34 of those sit in Nāma,
  // so the recommended path ran all 41 of its lists — 609 cards, a quarter
  // of the app — before Varṇa-Vidyā introduced the sound system.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      SAVED.mastered = {}; SAVED.pending = {}; SAVED.trouble = {}; SAVED.decks = {};
      const row = TRACK_ROWS.find(x => x.track.id === 'bhasha');

      /* walk the recommended path from a cold start, completing as we go */
      const path = [];
      let name = recommendOrder(row)[0];
      for (let i = 0; i < 12 && name; i++) {
        path.push({ lesson: LESSON_LABEL[DECK_LESSON[name]],
                    cards: DECKS[name].length, breadth: isBreadth(name) });
        DECKS[name].forEach(c => { SAVED.mastered[c.id] = 1; });
        name = nextList(name);
      }
      const leave = path.findIndex(x => x.lesson !== path[0].lesson);
      out.listsBeforeSecondStage = leave;
      out.cardsBeforeSecondStage = path.slice(0, leave)
        .reduce((a, x) => a + x.cards, 0);
      out.noBreadthOnTheWay = path.slice(0, leave).every(x => !x.breadth);

      /* the track page recommends from the same order — and is lesson-first,
         so an untouched first lesson names the lesson it opens the teaching of,
         not the deck that teaching leads on to */
      SAVED.mastered = {};
      SAVED.begun = { home: 1, bhasha: 1 };
      showTrack('bhasha');
      out.trackGo = document.getElementById('s-go').textContent;
      out.wantGo = LESSON_LABEL[DECK_LESSON[recommendOrder(row)[0]]];

      /* nothing is hidden or reordered in the drawer by any of this */
      const nav = trackDecks(row);
      out.navUnchanged = nav.slice(0, 8).map(DECK_SHORT).join('|');
      /* every breadth list the track holds is still in the drawer, in place:
         a literal count here would only be a number to chase whenever a list
         is added or a duplicate removed */
      out.breadthInNav = nav.filter(isBreadth).length;
      out.breadthHeld = row.lessons.reduce(
        (n, L) => n + L.decks.filter(isBreadth).length, 0);
      openDrawer(); renderDrawer();
      const rows = [...document.querySelectorAll('.dk')].map(b => b.title);
      out.breadthDrawn = nav.filter(isBreadth)
        .every(n => rows.some(t => t.indexOf(n) === 0));
      out.breadthLocked = nav.filter(isBreadth).some(n => deckLocked(n));
      closeDrawer();

      /* and every list is still reached: the order is a permutation */
      const order = recommendOrder(row);
      out.isPermutation = order.length === nav.length
        && order.every(n => nav.indexOf(n) >= 0)
        && new Set(order).size === order.length;
      /* Within the path the spine still leads and its breadth follows; the
         whole optional stream then follows both.  "Continue —" walks the
         path alone, so nothing optional can appear in it at all. */
      const walked = recommendPath(row);
      /* Where a track separates its streams there is no breadth on the path
         at all, which is the stronger form of the same promise. */
      out.spineThenBreadth = walked.findIndex(isBreadth) < 0
        || walked.findIndex(isBreadth) > walked.map(isBreadth).lastIndexOf(false);
      out.pathIsCore = walked.every(isCore);
      out.pathThenRest = order.slice(0, walked.length).join('|') === walked.join('|');
      out.restIsOptional = order.slice(walked.length).every(n => !isCore(n));

      /* the marking is a property of the source, not of a name prefix read
         at runtime — but the two must agree, or one has drifted */
      const drift = Object.keys(DECKS).filter(n =>
        /^V\d/.test(n) !== (DECK_ROLE[n] === 'breadth'));
      out.drift = drift;
      return out;
    });
    ok('the recommended path reaches the second stage in a sitting or two',
      r.listsBeforeSecondStage > 0 && r.listsBeforeSecondStage <= 10
        && r.cardsBeforeSecondStage <= 150,
      r.listsBeforeSecondStage + ' lists, ' + r.cardsBeforeSecondStage + ' cards');
    ok('with no vocabulary-bank list standing in the way', r.noBreadthOnTheWay);
    ok('and the track page recommends the same first list',
      r.trackGo.indexOf(r.wantGo) >= 0, r.trackGo + ' vs ' + r.wantGo);
    ok('the drawer still navigates in curriculum order',
      r.navUnchanged.indexOf('Devī|Deva') === 0
        && r.breadthInNav === r.breadthHeld && r.breadthInNav > 0,
      r.breadthInNav + ' of ' + r.breadthHeld + ' breadth lists in place');
    ok('every breadth list is still drawn, and none is locked by this',
      r.breadthDrawn && !r.breadthLocked);
    ok('the recommendation is a permutation, so nothing is dropped',
      r.isPermutation && r.spineThenBreadth,
      'permutation ' + r.isPermutation + ' · spine-then-breadth ' + r.spineThenBreadth);
    ok('and what it walks is the core stream, with the optional after it',
      r.pathIsCore && r.pathThenRest && r.restIsOptional,
      [r.pathIsCore, r.pathThenRest, r.restIsOptional].join('/'));
    ok('and the breadth marking has not drifted from the naming convention',
      !r.drift.length, r.drift.slice(0, 4).join(' | '));
    await p.close();
  }

  // ── a paradigm is shown before it is produced from ─────────────────
  // The Rūpa-siddhi lists are documented as "deliberately a second pass over
  // the same tables" — the Śabda-rūpa tables being the first.  The old
  // ordering rule read the bands off the card type, so every production deck
  // (choice) was forced above every table (reveal) and the second pass came
  // first: "Continue" reached "Form the caturthī singular of devī-" before a
  // single declension table had been drilled.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const pos = (L, pat) => {
        const names = LESSONS.find(x => x.lesson === L).decks;
        return { first: names.findIndex(n => pat.test(n)),
                 last: names.map(n => pat.test(n)).lastIndexOf(true) };
      };
      const rupa = { table: pos('05-rupa', /^Śabda-rūpa/),
                     produce: pos('05-rupa', /^(Śiva|Phala|Mālā|Devī|Agni|Viṣṇu|Pitṛ|Bhagavat|Asmad|Yuṣmad|Saḥ|Sā|Tat) — /) };
      const kriya = { table: pos('06-kriya', /^Dhātu-rūpa/),
                      practice: pos('06-kriya', /practice$/) };
      out.rupaOrdered = rupa.table.last < rupa.produce.first;
      out.kriyaOrdered = kriya.table.last < kriya.practice.first;
      out.rupa = rupa; out.kriya = kriya;

      /* every list marked `table` really is a paradigm shown whole: all
         recall, and running form → analysis */
      out.tables = Object.keys(DECKS).filter(n => DECK_ROLE[n] === 'table');
      out.tablesAreRecall = out.tables.every(n =>
        DECKS[n].every(c => (c.type || 'reveal') === 'reveal')
        && DECK_PAIR[n] === 'form \u2192 analysis');

      /* and the learner walking the acquisition path meets the tables while
         never being asked to produce out of them: production is a track of
         its own now, resting on this stage rather than sitting inside it */
      SAVED.mastered = {}; SAVED.pending = {}; SAVED.decks = {};
      const row = TRACK_ROWS.find(x => x.track.id === 'bhasha');
      let name = recommendOrder(row)[0], firstTable = -1, firstProduce = -1, i = 0;
      for (; i < 40 && name; i++) {
        if (firstTable < 0 && DECK_ROLE[name] === 'table') firstTable = i;
        if (firstProduce < 0 && streamOf(name) === 'mastery') firstProduce = i;
        if (firstTable >= 0 && firstProduce >= 0) break;
        DECKS[name].forEach(c => { SAVED.mastered[c.id] = 1; });
        name = nextList(name);
      }
      out.path = { firstTable: firstTable, firstProduce: firstProduce };
      const m = TRACK_ROWS.find(x => x.track.id === 'siddhi');
      const mine = m ? [].concat(...m.groups.map(g => g.decks)) : [];
      out.mastery = {
        lists: mine.length,
        cards: mine.reduce((n, d) => n + DECKS[d].length, 0),
        inBhasha: [].concat(...TRACK_ROWS.find(x => x.track.id === 'bhasha')
          .groups.map(g => g.decks)).some(n => streamOf(n) === 'mastery'),
      };
      return out;
    });
    ok('Rūpa shows every declension table before asking for a form',
      r.rupaOrdered, JSON.stringify(r.rupa));
    ok('and Kriyā shows the conjugations before drilling person and tense',
      r.kriyaOrdered, JSON.stringify(r.kriya));
    ok('every list marked a table is a paradigm shown whole',
      r.tables.length === 12 && r.tablesAreRecall, r.tables.length + ' tables');
    ok('so the acquisition path meets the tables', r.path.firstTable >= 0,
      JSON.stringify(r.path));
    ok('and never asks for a form on the way through',
      r.path.firstProduce < 0, JSON.stringify(r.path));
    ok('the production lists are a track of their own, and it is not a course track',
      r.mastery.lists === 13 && r.mastery.cards === 180 && !r.mastery.inBhasha,
      JSON.stringify(r.mastery));
    await p.close();
  }

  // ── what "learned" means, and what Abhyāsa draws on ───────────────
  // A list played to the end used to be complete at any score, which fed the
  // review with material the learner had never got right and moved the
  // mastery figure on the strength of it.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const small = Object.keys(DECKS).find(n => DECKS[n].length <= 10);
      SAVED.mastered = {}; SAVED.decks = {};
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };

      /* played to the end and got nothing right */
      SAVED.decks[small] = { best: [0, DECKS[small].length], pile: [] };
      out.seenOnly = { complete: finishedDecks().length, pool: reviewPool().length };

      /* every card back cold */
      DECKS[small].forEach(c => { SAVED.mastered[c.id] = 1; });
      out.learned = { complete: finishedDecks().length, pool: reviewPool().length };

      /* one card lost again takes the list back with it */
      delete SAVED.mastered[DECKS[small][0].id];
      out.lost = { complete: finishedDecks().length, pool: reviewPool().length };
      SAVED.mastered[DECKS[small][0].id] = 1;

      /* due: everything unseen by the review is due at once */
      out.dueAll = dueCount();
      /* reviewed in the session that is running now — a session is a day, so
         the day has to be stamped for the state to be one that can occur */
      SAVED.review.runs = 1; SAVED.review.day = today();
      DECKS[small].forEach(c => { SAVED.review.cards[c.id] = [1, 1]; });
      out.dueRested = dueCount();

      /* retained is two review sessions, not one round */
      out.retainedAfterOne = allRetained(DECK_IDS[small]);
      SAVED.review.runs = 2;
      DECKS[small].forEach(c => { SAVED.review.cards[c.id] = [2, 2]; });
      out.retainedAfterTwo = allRetained(DECK_IDS[small]);
      openDrawer(); renderDrawer();
      out.saysSo = [...document.querySelectorAll('.dk')]
        .some(b => b.title.indexOf(small) === 0 && /retained/.test(b.textContent));
      closeDrawer();

      /* a track's rank is measured against its own cards */
      const row = TRACK_ROWS.find(x => x.track.id === 'svara');
      SAVED.mastered = {};
      row.lessons.forEach(L => L.decks.forEach(n =>
        DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; })));
      SAVED.review = { runs: 1, right: 9, seen: 10, cards: {}, recent: [[9, 10]] };
      out.track = rankOf(row.ids).score;
      out.course = rankOf().score;
      return out;
    });
    ok('a list played through at 0 is not complete',
      r.seenOnly.complete === 0 && r.seenOnly.pool === 0, JSON.stringify(r.seenOnly));
    ok('one whose cards have all come back cold is',
      r.learned.complete === 1 && r.learned.pool > 0, JSON.stringify(r.learned));
    ok('and losing a card takes it back', r.lost.complete === 0, JSON.stringify(r.lost));
    ok('Abhyāsa draws on the cards you have got right, not the lists you have seen',
      r.learned.pool === r.dueAll, r.learned.pool + ' vs ' + r.dueAll);
    ok('a card just reviewed is not due again', r.dueRested === 0, r.dueRested + ' due');
    ok('“retained” takes two review sessions, not one round',
      !r.retainedAfterOne && r.retainedAfterTwo,
      r.retainedAfterOne + ' → ' + r.retainedAfterTwo);
    ok('and the drawer says so on the list that earned it', r.saysSo);
    ok('a track is ranked against its own cards, not the whole course',
      r.track > r.course && r.track > 50, r.track + '% in track vs ' + r.course + '% overall');
    await p.close();
  }

  // ── what the learner gets back for finishing something ────────────
  // One announcement per thing completed, once; a day streak; and one switch
  // that opens both gates for anyone who needs to reach a list directly.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const small = Object.keys(DECKS).find(n => DECKS[n].length <= 10);
      SAVED.mastered = {}; SAVED.awards = {};
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };

      /* nothing finished, nothing to say */
      out.quiet = claimAwards().length;

      /* a list finished announces itself, with its stage and track still open */
      DECKS[small].forEach(c => { SAVED.mastered[c.id] = 1; });
      const first = claimAwards();
      out.first = first.map(a => a.key);
      out.tier = first.length ? first[0].tier : '';
      /* and never announces itself twice */
      out.again = claimAwards().length;

      /* the same list retained is a second, later thing */
      SAVED.review.runs = 2;
      DECKS[small].forEach(c => { SAVED.review.cards[c.id] = [2, 2]; });
      out.retained = claimAwards().map(a => a.tier);

      /* finishing a whole track announces the track, biggest first */
      const row = TRACK_ROWS.find(x => x.track.id === 'svara');
      SAVED.awards = {}; SAVED.mastered = {};
      row.lessons.forEach(L => L.decks.forEach(n =>
        DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; })));
      out.track = claimAwards().map(a => a.level);

      /* the day streak counts days, not rounds */
      SAVED.streak = { last: '', run: 0 };
      bumpStreak(); const one = SAVED.streak.run;
      bumpStreak(); out.sameDay = SAVED.streak.run === one && one === 1;
      SAVED.streak.last = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      bumpStreak(); out.nextDay = SAVED.streak.run;
      SAVED.streak.last = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      bumpStreak(); out.brokeIt = SAVED.streak.run;

      /* the switch opens both gates at once */
      SAVED.begun = {}; SAVED.guided = true;
      out.gated = { tracks: started(), lists: trackBegun('bhasha') };
      SAVED.guided = false;
      out.open = { tracks: started(), lists: trackBegun('bhasha') };
      openDrawer(); renderDrawer();
      out.noneLocked = document.querySelectorAll('#drawer .locked').length;
      closeDrawer();
      SAVED.guided = true;
      return out;
    });
    ok('nothing finished, nothing announced', r.quiet === 0, r.quiet + ' announced');
    ok('a list finished announces the list alone',
      r.first.length === 1 && /^list:/.test(r.first[0]) && r.tier === 'complete',
      r.first.join(' | '));
    ok('and never announces it twice', r.again === 0, r.again + ' repeated');
    ok('retained is a second thing, earned later',
      JSON.stringify(r.retained) === '["retained"]', r.retained.join(' | '));
    ok('a finished track is the news, not the list that completed it',
      r.track[0] === 'track', r.track.join(' → '));
    ok('the day streak counts days, not rounds',
      r.sameDay && r.nextDay === 2 && r.brokeIt === 1,
      'same day ' + r.sameDay + ' · next day ' + r.nextDay + ' · after a gap ' + r.brokeIt);
    ok('guided order gates both levels', r.gated.tracks === false && r.gated.lists === false);
    ok('and turning it off opens everything at once',
      r.open.tracks && r.open.lists && r.noneLocked === 0,
      r.noneLocked + ' rows still shut');
    await p.close();
  }

  // ── the gate is one state, at every level of the tree ─────────────
  // On a clean load the units stood in full ink between a greyed track
  // name and greyed lists — the one level the gate had missed, and it read
  // as the only thing on the page that was open.  And a track drawn
  // expanded carried no caret, so the row was visibly open while wearing
  // nothing to say so and answering no tap.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const survey = () => {
        const o = { ink: [], noCaret: [] };
        document.querySelectorAll('#dr-tracks .tr').forEach(w => {
          const h = w.querySelector('.tr-head');
          const nm = h.querySelector('.tr-name').textContent;
          if (!h.classList.contains('locked')) o.ink.push('track ' + nm);
          /* a row standing in for a single list has no body and rightly no
             caret; every row that HAS one must show it */
          if (w.querySelector('.tr-body') && !h.hasAttribute('aria-expanded')) o.noCaret.push(nm);
          w.querySelectorAll('.ls-head').forEach(lh => {
            if (!lh.classList.contains('locked')) {
              o.ink.push('unit ' + lh.querySelector('.ls-name').textContent);
            }
          });
          w.querySelectorAll('.dk').forEach(d => {
            if (!d.classList.contains('locked')) {
              o.ink.push('list ' + d.querySelector('.dk-name').textContent);
            }
          });
        });
        return o;
      };
      SAVED.guided = true; SAVED.begun = {};
      openDrawer();
      /* expand everything there is, so nothing is merely hidden */
      TRACK_ROWS.forEach(x => openTracks.add(x.track.id));
      renderDrawer();
      out.shut = survey();

      beginHome();
      TRACK_ROWS.forEach(x => openTracks.add(x.track.id));
      renderDrawer();
      const after = survey();
      out.openedTracks = [...new Set(after.ink.filter(x => /^track /.test(x)))].length;
      /* which tracks' LISTS the one press opened */
      out.reachable = [...new Set([...document.querySelectorAll('#dr-tracks .tr')]
        .filter(w => [...w.querySelectorAll('.dk')].some(d => !d.classList.contains('locked')))
        .map(w => w.querySelector('.tr-name').textContent))];
      out.stillShut = [...new Set([...document.querySelectorAll('#dr-tracks .ls-head.locked')]
        .map(e => e.querySelector('.ls-name').textContent))].length;
      closeDrawer();
      return out;
    });
    ok('nothing in the drawer is ungreyed before Begin is pressed',
      !r.shut.ink.length, r.shut.ink.slice(0, 5).join(' | '));
    ok('and every track that has a body still carries its caret',
      !r.shut.noCaret.length, r.shut.noCaret.join(' | '));
    /* Begin used to set `home` alone: every track NAME ungreyed and every
       list stayed shut, so the one press the landing card offers a beginner
       reached no card at all. */
    ok('Begin opens the script track and the first course track',
      r.reachable.length === 2 && r.reachable.indexOf('Devanāgarī') >= 0
        && r.reachable.indexOf('Bhāṣā-Vidyā') >= 0, r.reachable.join(' | '));
    ok('and leaves the rest of the course for its own page to open',
      r.stillShut > 0, r.stillShut + ' units still shut');
    await p.close();
  }

  // ── the end of a round is not a dead end ──────────────────────────
  // Practise these again / Whole deck again / Share was every way on, so a
  // session stopped there: the next list and the review were both behind the
  // drawer.  Both are on the results screen now.
  {
    const p = await open(browser);
    const r = await p.evaluate(async () => {
      const out = {};
      SAVED.mastered = {}; SAVED.decks = {};
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };
      beginHome(); beginTrack('bhasha');
      const names = trackDecks(TRACK_ROWS.find(x => x.track.id === 'bhasha'));
      /* nothing learnt yet: a next list, and no review to offer */
      loadDeck(names[0]);
      while (current) knew();
      out.next = $('next-list').hidden ? null : $('next-list').title;
      out.nextIsNotThisOne = out.next !== names[0];
      out.reviewShut = $('review-due').hidden;

      /* enough learnt to unlock: the review is offered too */
      names.slice(0, 6).forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      loadDeck(names[1]);
      while (current) knew();
      out.due = $('review-due').hidden ? null : $('review-due').textContent;
      /* and it is a session, never the whole backlog */
      out.pool = reviewPool().length;

      /* a review round offers neither: there is no list to be next to */
      $('review-due').click();
      while (current) knew();
      out.inReview = { next: $('next-list').hidden, review: $('review-due').hidden,
                       mixed: mixed };
      return out;
    });
    ok('a finished list points at the next one',
      !!r.next && r.nextIsNotThisOne, r.next);
    ok('with no review offered before it is unlocked', r.reviewShut);
    ok('and once it is, the review is offered too',
      /^Abhyāsa · \d+\+? due$/.test(r.due || ''), r.due);
    ok('as a session, not as a backlog of ' + r.pool,
      /20\+ due$/.test(r.due || ''), r.due);
    ok('a review round offers neither — nothing is next to a draw',
      r.inReview.mixed && r.inReview.next && r.inReview.review,
      JSON.stringify(r.inReview));
    await p.close();
  }

  // ── the two controls a tester needs ───────────────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      openPanel('board');
      return { actions: !document.getElementById('b-actions').hidden,
               copy: !!document.getElementById('b-copy'),
               reset: !!document.getElementById('b-reset'),
               danger: document.getElementById('b-reset').classList.contains('danger'),
               stamp: document.querySelector('.b-build').textContent.trim() };
    });
    ok('the scoreboard carries the tester’s two controls',
      r.actions && r.copy && r.reset && r.danger);
    ok('and names the build it is', /^build [0-9a-f]{7}$/.test(r.stamp), r.stamp);

    // copying reports back whether it got the state out
    await p.click('#b-copy');
    await p.waitForFunction(
      () => document.getElementById('b-copy').textContent !== 'Copy my progress');
    const label = await p.textContent('#b-copy');
    ok('copying says whether it worked', /copied|Ctrl/.test(label), label);

    // resetting erases the store and starts the app over
    const after = await p.evaluate(() => {
      SAVED.mastered['01-nama:devi:kamaksi'] = 1; SAVED.begun.home = 1; save();
      return !!JSON.parse(localStorage.getItem('abhyāsaḥ')).mastered['01-nama:devi:kamaksi'];
    });
    await p.click('#b-reset');
    await p.click('#ask-yes');
    await p.waitForLoadState('load');
    /* The store is written again the moment the reloaded page saves its own
       defaults — what has to be gone is the progress in it. */
    const fresh = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('abhyāsaḥ') || '{}');
      return { mastered: Object.keys(raw.mastered || {}).length,
               begun: Object.keys(raw.begun || {}).length,
               welcome: !document.getElementById('welcome').hidden,
               go: document.getElementById('w-go').textContent };
    });
    ok('progress was there to erase', after);
    ok('reset erases it and starts the app over',
      !fresh.mastered && !fresh.begun && fresh.welcome && /^Begin — /.test(fresh.go),
      JSON.stringify(fresh));
    await p.close();
  }

  // ── accuracy is what is happening now, not what always happened ────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {}, recent: [] };
      out.none = masteryPct();
      pushRecent(10, 20); out.one = masteryPct();
      pushRecent(20, 20); out.two = masteryPct();
      /* eleven perfect sessions push the bad one out of the window */
      for (let i = 0; i < 10; i++) pushRecent(20, 20);
      out.window = SAVED.review.recent.length;
      out.after = masteryPct();
      return out;
    });
    ok('no accuracy before the first review', r.none === null, String(r.none));
    ok('one session is the whole figure', r.one === 50, r.one + '%');
    ok('two are averaged', r.two === 75, r.two + '%');
    ok('and a bad session eventually falls out of the window',
      r.window === 10 && r.after === 100, r.window + ' kept · ' + r.after + '%');

    /* a v3 store carries its lifetime tally in whole, so the figure does not
       move at the moment of upgrade */
    const p2 = await browser.newPage();
    p2.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p2.addInitScript(() => {
      try {
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          v: 3, decks: {}, review: { runs: 4, right: 63, seen: 80 },
          trouble: {}, cleared: 0, mastered: {} }));
      } catch (e) {}
    });
    await p2.goto(FILE, { waitUntil: 'load' });
    const carried = await p2.evaluate(() => ({
      v: SAVED.v, recent: SAVED.review.recent, pct: masteryPct() }));
    ok('an older store keeps its figure to the digit',
      carried.v === 8 && carried.pct === 79,
      'v' + carried.v + ' · ' + carried.pct + '%');
    await p2.close();
    await p.close();
  }

  // ── the drawer marks the one list to take next ─────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      SAVED.mastered = {}; beginHome(); beginTrack('bhasha');
      const row = TRACK_ROWS.find(x => x.track.id === 'bhasha');
      const want = recommendOrder(row)[0];
      openDrawer(); openTracks.add('bhasha'); openLessons.add(DECK_LESSON[want]);
      renderDrawer();
      const marked = [...document.querySelectorAll('.dk')]
        .filter(b => /· next$/.test(b.querySelector('.dk-sub').textContent));
      return { want: want, marked: marked.map(b => b.title),
               /* one per begun track, never a row per list */
               shutTrack: !!recommendedSet && !recommendedSet().has(
                 recommendOrder(TRACK_ROWS.find(x => x.track.id === 'kavya'))[0]) };
    });
    ok('the recommended list is marked in the drawer',
      r.marked.indexOf(r.want) >= 0, r.marked.join(' | ') || 'none');
    ok('and only the recommended one', r.marked.length === 1, r.marked.length + ' marked');
    ok('a track that has not been begun recommends nothing', r.shutTrack);
    await p.close();
  }

  // ── the annotation is grammar, and provenance is not ──────────────
  // A chip reading "DM 5.17-18" is provenance dressed as grammar: the red
  // line promises what the word is, and the card has a slot of its own for
  // where it was found.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const CITE = /^(DM|LS|VS|MB|RV|KKS|KS)\b/;
      const CASE = /^[a-zāīūṛṭḍṇśṣñṅḥṃ/]+\s*\|/;
      const out = { chipIsCitation: [], headwordCase: [], bothLabels: [] };
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        if ((c.type || 'reveal') !== 'reveal') return;
        const note = (c.note || '').trim();
        if (CITE.test(note) && !/noun|adjective|verb|numeral|pronoun|stem/.test(note))
          out.chipIsCitation.push(c.id);
        /* and nothing is two parts of speech at once */
        if (/^(noun|adjective)\b/.test(note) && /\bpronoun\b/.test(note))
          out.bothLabels.push(c.id);
      }));
      /* The older `prathamā | nom. sg.` shape survives only where the case is
         the content — a paradigm cell, a kāraka, a vocative.  That is a fact
         about the LIST: if every one of a list's cards is a citation form,
         the field varies with the gender and says nothing. */
      Object.keys(DECKS).forEach(n => {
        const noted = DECKS[n].filter(c => CASE.test((c.note || '').trim()));
        if (!noted.length) return;
        const allCitationForms = noted.every(c =>
          /^prathamā(\/(dvitīyā|sambodhana))*\s*\|/.test(c.note.trim()));
        if (allCitationForms) out.headwordCase.push(n);
      });
      return out;
    });
    ok('no card’s whole annotation is a citation',
      !r.chipIsCitation.length, r.chipIsCitation.slice(0, 3).join(' | '));
    ok('no list of citation forms leads its annotations with a case',
      !r.headwordCase.length, r.headwordCase.slice(0, 3).join(' | '));
    ok('and nothing is labelled two parts of speech at once',
      !r.bothLabels.length, r.bothLabels.slice(0, 3).join(' | '));
    await p.close();
  }

  // ── a loss is stamped with the day it happened ────────────────────
  // The unit is the day, not a page-load id: a tab left open for a week is
  // one page load, so a card lost on Monday could never count again all
  // week, and a reload between two rounds would hand out a free pass.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      const c = DECKS[Object.keys(DECKS)[0]][0];
      SAVED.trouble = {};
      markWrong(c); markWrong(c); markWrong(c);
      out.counted = (SAVED.trouble[c.id] || {}).w === 3;
      out.stampsADay = /^\d{4}-\d{2}-\d{2}$/.test(SAVED.trouble[c.id].m);
      out.lostToday = lostToday(c);
      /* yesterday's loss does not stand in the way of today's recall */
      SAVED.trouble[c.id].m = '2020-01-01';
      out.notToday = !lostToday(c);
      return out;
    });
    ok('every wrong answer counts, however close together', r.counted);
    ok('the loss is stamped as a day, not a page load', r.stampsADay);
    ok('a card lost today is known to have been', r.lostToday);
    ok('and one lost on another day is not', r.notToday);
    await p.close();
  }

  // ── "complete" means the same thing on every surface ──────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const small = Object.keys(DECKS).find(n => DECKS[n].length <= 8);
      SAVED.mastered = {}; SAVED.decks = {};
      /* played to the end at 0 — a best score, and nothing learned */
      SAVED.decks[small] = { best: [0, DECKS[small].length], pile: [] };
      openDrawer(); renderDrawer();
      const drawer = document.getElementById('dp-cards').textContent;
      closeDrawer();
      openPanel('board');
      const board = document.getElementById('b-sub').textContent;
      const row = document.getElementById('dm-board').textContent;
      closePanel();
      return { drawer: drawer, board: board, row: row };
    });
    /* the drawer says 0 complete; the board must not say 1 completed */
    const n = s => (s.match(/\d+/) || [])[0];
    ok('the scoreboard and the drawer agree on how many lists are complete',
      n(r.board) === n(r.drawer) && n(r.drawer) === '0',
      r.drawer + '  vs  ' + r.board);
    ok('and the board still says what it holds, which is scores',
      / \d+ played$/.test(r.board), r.board);
    /* the row has a zero state of its own; what it may never do is claim a
       completed list when the other two say there is none */
    ok('and so does the row that opens it',
      /no list finished yet/.test(r.row) || /^best scores · 0 of/.test(r.row), r.row);
    await p.close();
  }

  // ── one fact, carded once ─────────────────────────────────────────
  // Two lists of the same lesson holding the same word with the same meaning
  // is the same card twice: mastery of one is mastery of the other, and the
  // second only costs the learner a sitting.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      /* One word, two senses — these are not duplicates, and the substring
         test cannot tell the difference on its own. */
      const SENSES = ['śakti', 'kāla', 'madhu'];
      /* Nor is a name of Viṣṇu the same card as the god it usually names:
         in the Sahasranāma rudra and maheśvara are Viṣṇu's. */
      const VS = n => /^V02 · Viṣṇu-nāma|^V02 · Viśva|^V02 · Dharma/.test(n);
      const norm = s => (s || '').toLowerCase().replace(/[^a-zāīūṛṅñṭḍṇśṣḥṃ ]/g, '').trim();
      /* Keyed by the stem, not by the Devanagari: viṣṇuḥ in a curated list and
         viṣṇu in a bank list are one word in two citation forms, and comparing
         the strings is how twenty of these went unnoticed. */
      /* `jñānam` and `jñāna` are one word in two citation forms, and folding
         only the visarga let six such pairs sit in one lesson unnoticed. */
      const stem = s => norm(s).replace(/[ḥṃ]$/, '').replace(/m$/, '');
      const byLesson = {};
      Object.keys(DECKS).forEach(n => {
        const L = DECK_LESSON[n];
        DECKS[n].forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          /* a card that merges synonyms carries words the other one does not */
          if ((c.iast || '').indexOf(' / ') >= 0) return;
          const w = stem(c.iast || '');
          if (!w) return;
          ((byLesson[L] = byLesson[L] || {})[w] = byLesson[L][w] || []).push(
            { deck: n, gloss: norm(c.gloss), iast: (c.iast || '').trim(), id: c.id });
        });
      });
      const twice = [];
      Object.keys(byLesson).forEach(L => Object.keys(byLesson[L]).forEach(w => {
        const v = byLesson[L][w];
        for (let i = 0; i < v.length; i++) for (let k = i + 1; k < v.length; k++) {
          if (SENSES.indexOf(stem(v[i].iast)) >= 0) continue;
          if (VS(v[i].deck) || VS(v[k].deck)) continue;
          const a = v[i].gloss, b = v[k].gloss;
          if (!a || !b) continue;
          const same = a === b || (a.length > 3 && b.length > 3
            && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0));
          if (same) twice.push(v[i].id + ' & ' + v[k].id);
        }
      }));
      /* and the fifty core roots are carded at the stage that owns them,
         not again as vocabulary a few stages earlier */
      const roots = new Set();
      Object.keys(DECKS).forEach(n => {
        if (DECK_LESSON[n] !== '09-dhatu') return;
        DECKS[n].forEach(c => roots.add((c.iast || '').trim()));
      });
      const rootsTwice = [];
      Object.keys(DECKS).forEach(n => {
        if (DECK_LESSON[n] === '09-dhatu') return;
        DECKS[n].forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          if (/^√/.test(c.iast || '') && roots.has((c.iast || '').trim())) rootsTwice.push(c.id);
        });
      });
      return { twice: twice, rootsTwice: rootsTwice };
    });
    ok('no lesson holds the same word and meaning in two of its lists',
      !r.twice.length, r.twice.slice(0, 3).join(' | '));
    ok('and a core dhātu is carded at the stage that owns roots, once',
      !r.rootsTwice.length, r.rootsTwice.slice(0, 3).join(' | '));
    await p.close();
  }

  // ── one operation, carded once ────────────────────────────────────
  // The eight Mātṛkās were seven cards of "X → śakti of X": one derivation,
  // asked seven times, with the answer sitting in the prompt.  A learner who
  // gets the second is not going to miss the sixth.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      /* blank any gloss word built out of the headword; what is left is the
         card's own contribution */
      const skeleton = (front, gloss) => {
        const fs = fold(front).split(/[^a-z]+/).filter(w => w.length >= 4);
        return gloss.split(/(\W+)/).map(w => {
          const s = fold(w);
          return s.length >= 4
            && fs.some(f => f.startsWith(s.slice(0, 4)) || s.startsWith(f.slice(0, 4)))
            ? '§' : w;
        }).join('');
      };
      const bad = [];
      Object.keys(DECKS).forEach(n => {
        const g = {};
        DECKS[n].forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          const k = skeleton(c.iast || '', (c.gloss || '').trim());
          /* a skeleton with no words of its own is not a template — the case
             endings of a vigraha differ where a four-letter prefix does not */
          if (k.indexOf('§') < 0 || !/[a-z]{2}/i.test(k.replace(/§/g, ''))) return;
          (g[k] = g[k] || []).push(c.iast);
        });
        Object.keys(g).forEach(k => {
          if (g[k].length >= 4) bad.push(n + ' · "' + k + '" ×' + g[k].length);
        });
      });
      return bad;
    });
    ok('no list asks for the same derivation four times over',
      !r.length, r.slice(0, 3).join(' | '));
    await p.close();
  }

  // ── the lexical layer says where it got everything ────────────────
  // The relationships — root, prefix, suffix, derivative, compound member,
  // synonym set — are defined once in lexicon/ and used everywhere.  What is
  // checked here is that they agree with the curriculum they claim to
  // describe, and that every enriched claim names a source.
  {
    const lexicon = require('./lexicon');
    const lex = lexicon.load();
    ok('the lexicon agrees with the lessons it describes',
      !lex.problems.length, lex.problems.slice(0, 4).join(' | '));

    const fs = require('fs');
    const at = f => JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '..', 'lexicon', f), 'utf8'));
    const ids = new Set(Object.keys(at('sources.json').sources));
    const unsourced = [], unknown = [];
    const check = (what, o) => {
      if (!o.source) { unsourced.push(what); return; }
      Object.values(o.source).forEach(v => String(v).split('+').forEach(one => {
        if (!ids.has(one)) unknown.push(what + ' → ' + one);
      }));
    };
    at('roots.json').roots.forEach(r => check(r.iast, r));
    at('compounds.json').compounds.forEach(c => check(c.iast, c));
    at('synonyms.json').categories.forEach(c => check(c.key, c));
    at('synonyms.json').cautions.forEach(c => check(c.iast, c));
    ok('every enriched claim names where it came from',
      !unsourced.length, unsourced.slice(0, 4).join(' | '));
    ok('and names one the registry defines',
      !unknown.length, unknown.slice(0, 4).join(' | '));

    /* An analysis the dictionary does not itself state is labelled as read
       off its parts.  Conflating the two would report a reading of ours as
       one Monier-Williams gives. */
    const kinds = new Set(at('compounds.json').compounds.map(c => c.source.analysis));
    ok('a reading off the parts is not reported as the dictionary’s',
      kinds.has('mw') && kinds.has('mw-parts')
        && [...kinds].every(k => ids.has(k)),
      [...kinds].join(' | '));
    /* A split the curriculum itself supplies — the regular sandhi of two
       members the app already glosses — is sourced to the curriculum, and
       then every sense in it must be too.  Half a claim from the lesson and
       half from somewhere else is the conflation this section exists to
       stop. */
    const mixed = at('compounds.json').compounds
      .filter(c => c.source.analysis === 'curriculum' && c.source.sense !== 'curriculum')
      .map(c => c.iast);
    ok('and a curriculum analysis takes its senses from the curriculum',
      !mixed.length, mixed.slice(0, 4).join(' | '));

    /* And the refusals are refusals: a word listed as unreadable is never
       also analysed, and every one says why. */
    const opaque = at('compounds.json').opaque;
    const analysed = new Set(at('compounds.json').compounds.map(c => c.iast));
    ok('a word is analysed or refused, never both',
      !opaque.some(o => analysed.has(o.iast)),
      opaque.filter(o => analysed.has(o.iast)).map(o => o.iast).join(' | '));
    ok('and every refusal says why',
      opaque.length > 0 && opaque.every(o => o.why && o.why.length > 10),
      opaque.length + ' words left alone');
  }

  // ── a clue has to be readable off the word it sits on ──────────────
  // "paṅka + ja" is a clue because paṅka and ja are in paṅkaja.  A clue
  // whose parts are not in the headword is an invention, and an invention is
  // worse than no clue at all: it is memorable, and wrong.  Checked against
  // what the lexical layer ADDS — the sources' own annotations are the
  // curriculum's, and are not this file's to police.
  {
    const fs = require('fs');
    const lexicon = require('./lexicon');
    const root = path.resolve(__dirname, '..');
    const before = new Map(), lessons = [];
    for (const d of fs.readdirSync(root).sort()) {
      const f = path.join(root, d, 'practice.json');
      if (!/^\d\d-/.test(d) || !fs.existsSync(f)) continue;
      const decks = JSON.parse(fs.readFileSync(f, 'utf8')).decks;
      /* the note as a STRING: apply() mutates the very cards this holds */
      decks.forEach(k => k.cards.forEach(c => before.set(c.id, c.note || '')));
      lessons.push({ lesson: d, stage: +d.slice(0, 2), decks });
    }
    lexicon.apply(lessons);

    const fold = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '')
                       .replace(/[^a-z]/gi, '').toLowerCase();
    const bad = [], onOpaque = [], added = [];
    const lex = lexicon.load();
    lessons.forEach(L => L.decks.forEach(d => d.cards.forEach(c => {
      const was = before.get(c.id);
      if (was === undefined || (c.note || '') === was) return;
      const clue = (c.note || '').slice(was.length).replace(/^ · /, '');
      added.push(clue);
      /* a word the lexicon refuses to analyse must never pick up an analysis */
      if (lex.opaque.has(lexicon.key(c.iast || c.answer || ''))) onOpaque.push(c.id);
      const parts = /^(.+?) \+ (.+?)(?: — |$)/.exec(clue);
      if (!parts) return;
      /* an interactive card is clued off its ANSWER; a reveal card off its
         own headword */
      const word = c.iast || c.answer;
      if (typeof word !== 'string') return;
      /* Sandhi meets in the middle — mahā + īśvara is maheśvara — so the
         first member has to open the word and the last has to close it,
         which is what survives any join. */
      const w = fold(word).replace(/[hm]$/, '');     // drop the citation ending
      const head = fold(parts[1]), tail = fold(parts[2]);
      if (head.length >= 2 && !w.startsWith(head.slice(0, 2))) {
        bad.push(c.id + ': ' + parts[1] + ' does not open ' + word);
      }
      /* A root is followed by whatever built the word out of it — durgama is
         dur- and √gam and an -a — so a root member has to be IN the word
         where a stem member has to end it. */
      const isRoot = parts[2].trim().startsWith('√');
      const ok2 = tail.length < 3 || /^-/.test(parts[2].trim())
        || (isRoot ? w.includes(tail) : w.endsWith(tail.slice(-3)));
      if (!ok2) bad.push(c.id + ': ' + parts[2] + ' does not close ' + word);
    })));
    ok('the lexical layer clued cards that were carrying nothing',
      added.length >= 40, added.length + ' clues added');
    ok('every compound clue opens and closes the word it explains',
      !bad.length, bad.slice(0, 4).join(' | '));
    ok('and a word the lexicon refuses to analyse is left alone',
      !onOpaque.length, onOpaque.slice(0, 4).join(' | '));
  }

  // ── the root cards carry the whole of what the reference gives ─────
  // Stage 9 is where the class and the pada are spelled out rather than
  // written "4Ā", and where a root's sense is allowed to travel: the chain
  // goes on `detail`, which is part of the ANSWER, so a reversed card cannot
  // be answered by reading it.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const shape = /^dhātu · class \d+ · (parasmaipada|ātmanepada|both padas) · \S+/;
      const cards = [];
      Object.keys(DECKS).forEach(n => {
        if (!n.startsWith('Dhātu ')) return;
        DECKS[n].forEach(c => cards.push(c));
      });
      const chains = cards.filter(c => c.detail && c.detail.includes(' → '));
      /* and the chain is on the back in both directions */
      const one = chains[0];
      const front = ['reveal', 'produce'].map(d => {
        setDir(d); startRound([one], {});
        return document.getElementById('dn').textContent
             + '¦' + document.getElementById('detail').textContent;
      });
      return {
        n: cards.length,
        misshapen: cards.filter(c => !shape.test(c.note || '')).map(c => c.iast),
        chains: chains.length,
        hidden: front.every(f => !f.split('¦')[0].includes('→')),
        shownAfter: (() => {
          setDir('reveal'); startRound([one], {}); reveal();
          return document.getElementById('detail').textContent;
        })(),
      };
    });
    ok('every root card names its class and pada in words',
      r.n >= 50 && !r.misshapen.length, r.misshapen.slice(0, 4).join(' | '));
    ok('and the ones whose sense travels carry the chain',
      r.chains >= 20, r.chains + ' chains');
    ok('the chain is part of the answer, not the prompt',
      r.hidden && r.shownAfter.includes(' → '), r.shownAfter);
    await p.close();
  }

  // ── a generated list is held to what an authored one is ───────────
  // The lexical layer writes cards, so the ways a card can be wrong have to
  // be checked on what it writes: two options that are the same answer, two
  // cards that ask the same question, an English cue with more than one
  // right Sanskrit answer.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const MADE = ['Kula', 'Upasarga-artha', 'Anekārtha', 'Vyutpatti'];
      const decks = Object.keys(DECKS).filter(n => MADE.some(m => n.startsWith(m)));
      const dupOption = [], dupCue = [], notChoice = [], sourceless = [];
      decks.forEach(n => {
        const asked = new Map();
        DECKS[n].forEach(c => {
          if ((c.type || 'reveal') !== 'choice') { notChoice.push(c.id); return; }
          if (!c.source) sourceless.push(c.id);
          const opts = c.options.map(o => o.trim().toLowerCase());
          if (new Set(opts).size !== opts.length) dupOption.push(c.id);
          /* an option that CONTAINS the answer is the answer twice over —
             "Devī" beside "Devī, the unassailable" has two right taps */
          c.options.filter(o => o !== c.answer).forEach(o => {
            if (o.includes(c.answer) || c.answer.includes(o)) dupOption.push(c.id + ': ' + o);
          });
          const cue = c.front.trim().toLowerCase();
          if (asked.has(cue)) dupCue.push(n + ': ' + cue);
          asked.set(cue, c.id);
        });
      });
      /* the reverse-recall guard, over the whole app: within one list, one
         English cue may have only one Sanskrit answer */
      const clash = [];
      Object.entries(DECKS).forEach(([n, cs]) => {
        const by = {};
        cs.forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          const k = (c.gloss || '').trim().toLowerCase();
          (by[k] = by[k] || []).push(c.iast);
        });
        Object.entries(by).forEach(([k, ws]) => {
          if (ws.length > 1) clash.push(n + ' · "' + k + '"');
        });
      });
      return { decks: decks.length, dupOption, dupCue, notChoice, sourceless, clash,
               cards: decks.reduce((a, n) => a + DECKS[n].length, 0) };
    });
    ok('the lexical layer put its lists in the app',
      r.decks === 4 && r.cards >= 50, r.decks + ' lists · ' + r.cards + ' cards');
    ok('no generated option is the answer a second time',
      !r.dupOption.length, r.dupOption.slice(0, 4).join(' | '));
    ok('no two generated cards ask the same question',
      !r.dupCue.length, r.dupCue.slice(0, 4).join(' | '));
    ok('every generated card is graded, and says where it came from',
      !r.notChoice.length && !r.sourceless.length,
      r.notChoice.concat(r.sourceless).slice(0, 4).join(' | '));
    ok('and no English cue in any list has two Sanskrit answers',
      !r.clash.length, r.clash.slice(0, 4).join(' | '));
    await p.close();
  }

  // ── the annotation explains its own Sanskrit ──────────────────────
  // The chip read "kāma + akṣi — loving-eyed" and "· from √hṛ", and the
  // popover explained the grammar words around them while leaving the
  // Sanskrit itself unglossed — which is the half a learner cannot look up.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      out.size = { members: Object.keys(LEXICON.members).length,
                   roots: Object.keys(LEXICON.roots).length };
      const read = t => readAnnotation(t).map(x => x.kind + ':' + x.value);
      out.compound = read('noun · feminine · ī-stem · stem: kāmākṣī- · kāma + akṣi — loving-eyed');
      out.root = read('noun · masculine · a-stem · stem: hara- · from √hṛ');
      /* a prefixed root is one part, not a member split at the plus */
      out.prefixed = read('noun · masculine · anu- + √grah — seize after');

      /* and the popover renders a section per member, each with its sense */
      const card = { devanagari: 'क', iast: 'kāmākṣī', gloss: 'she of loving eyes',
                     note: 'noun · feminine · ī-stem · stem: kāmākṣī- · kāma + akṣi — loving-eyed' };
      startRound([card], {}); reveal();
      openPop(document.querySelector('#tag .ann'));
      out.heads = [...document.querySelectorAll('#pop .sec-t')].map(e => e.textContent);
      out.senses = [...document.querySelectorAll('#pop .sec-e')].map(e => e.textContent);
      /* the paragraph is said once, not once per member */
      out.bodies = document.querySelectorAll('#pop .sec-b').length;

      const rc = { devanagari: 'ह', iast: 'haraḥ', gloss: 'the remover',
                   note: 'noun · masculine · a-stem · stem: hara- · from √hṛ' };
      startRound([rc], {}); reveal();
      openPop(document.querySelector('#tag .ann'));
      out.rootSense = [...document.querySelectorAll('#pop .sec-e')].pop().textContent;
      out.rootEg = [...document.querySelectorAll('#pop .eg-iast')].pop().textContent;
      return out;
    });
    /* the fifty the curriculum teaches, plus the few the lexicon carries
       beyond them and marks `extra` */
    ok('the page carries a glossary of members and roots',
      r.size.members > 100 && r.size.roots >= 50,
      JSON.stringify(r.size));
    ok('a compound clue is read as one part per member',
      r.compound.join(' ') === 'term:ī-stem stem:kāmākṣī- member:kāma member:akṣi',
      r.compound.join(' '));
    ok('a root clue is one part, and a prefixed root still one',
      r.root.indexOf('root:√hṛ') >= 0 && r.prefixed.length === 1,
      r.root.join(' ') + ' || ' + r.prefixed.join(' '));
    /* A member attested in two senses keeps both — kāma is love and desire,
       pati husband and lord — because choosing one would make half the
       compounds that use it read wrongly. */
    ok('every member of the compound gets its own meaning',
      r.heads.indexOf('kāma') >= 0 && r.heads.indexOf('akṣi') >= 0
        && r.senses.some(x => /love/.test(x)) && r.senses.some(x => /eye/.test(x)),
      r.heads.join(' | ') + ' → ' + r.senses.join(' | '));
    ok('and the compound paragraph is said once, not per member',
      r.bodies === r.heads.length - 1, r.bodies + ' bodies for ' + r.heads.length + ' sections');
    ok('a root is glossed with its own sense and cited by its present',
      /carry/.test(r.rootSense) && r.rootEg === 'harati',
      r.rootSense + ' · ' + r.rootEg);
    await p.close();
  }

  // ── the tooltip guarantee ─────────────────────────────────────────
  // Every vocabulary card whose dhātu the layer can establish carries it,
  // and the popover always has the MEANING behind the form: the chip says
  // `from √kṛṣ` and the popover says what √kṛṣ means, off the Dhātu-pāṭha.
  // The build enforces this (scripts/lexicon.js fails on a regression);
  // this proves the shipped page and the real popover agree with it.
  {
    const FLOOR = require('./lexicon').TOOLTIP_ROOT_FLOOR;
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = { naked: [], rooted: 0 };
      const vocab = n => ['meaning', 'definition', 'sense']
        .includes((DECK_PAIR[n] || 'word → meaning').split(' → ')[1]);
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        /* the annotation is read exactly as the popover reads it */
        const parts = readAnnotation(c.note || '');
        const root = parts.find(x => x.kind === 'root');
        if (root && !(LEXICON.roots[root.id] && LEXICON.roots[root.id].sense)) {
          out.naked.push(c.id + ' names ' + root.value);
        }
        if (!vocab(n) || (c.type || 'reveal') !== 'reveal') return;
        const chained = parts.some(x => x.kind === 'member' && LEXICON.from[x.value]);
        if (root || chained) out.rooted++;
      }));

      /* and the popover itself: the god names of the very first list carry
         their dhātu with its meaning — form on the chip, sense behind it */
      const card = { devanagari: 'कृष्णः', iast: 'kṛṣṇaḥ', gloss: 'the dark one',
                     note: 'noun · masculine · a-stem · stem: kṛṣṇa- · from √kṛṣ' };
      startRound([card], {}); reveal();
      openPop(document.querySelector('#tag .ann'));
      const heads = [...document.querySelectorAll('#pop .sec-t')].map(e => e.textContent);
      const at = heads.indexOf('√kṛṣ');
      out.pop = at < 0 ? '(no √kṛṣ section)'
        : document.querySelectorAll('#pop .sec-e')[at].textContent;

      /* the chain form of the same promise: a compound member's root and
         sense reach the popover — durgā is hard to GO through, √gam */
      const dc = { devanagari: 'दुर्गा', iast: 'durgā', gloss: 'the unassailable',
                   note: 'noun · feminine · ā-stem · stem: durgā- · dur- + ga — hard to go through' };
      startRound([dc], {}); reveal();
      openPop(document.querySelector('#tag .ann'));
      out.chain = [...document.querySelectorAll('#pop .eg-iast')].map(e => e.textContent).join(' ');
      out.chainSense = [...document.querySelectorAll('#pop .eg-tr')].map(e => e.textContent).join(' ');

      return out;
    });
    ok('no card anywhere names a root the popover cannot gloss',
      !r.naked.length, r.naked.slice(0, 4).join(' | '));
    ok('the vocabulary cards carrying their dhātu hold the build’s floor',
      r.rooted >= FLOOR, r.rooted + ' rooted, floor ' + FLOOR);
    ok('the popover glosses √kṛṣ under kṛṣṇa with the Dhātu-pāṭha’s sense',
      /plough/.test(r.pop), r.pop);
    ok('a compound member chains to its root and sense in the popover',
      /√gam/.test(r.chain) && /to go/.test(r.chainSense),
      r.chain + ' · ' + r.chainSense);
    await p.close();
  }

  // ── a stem is a stem ──────────────────────────────────────────────
  // "stem: sāvarṇiḥ-" is a citation form with a hyphen after it, not a stem,
  // and the chip is the one place on the card that claims to say what the
  // word is underneath its ending.
  {
    const p = await open(browser);
    const bad = await p.evaluate(() => {
      const out = [];
      Object.keys(DECKS).forEach(n => DECKS[n].forEach(c => {
        const m = /stem: (\S+?)-/.exec(c.note || '');
        if (m && /[ḥṃ]$/.test(m[1])) out.push(c.id + ' · ' + m[0]);
      }));
      return out;
    });
    ok('a stem annotation carries a stem, not a citation form',
      !bad.length, bad.slice(0, 3).join(' | '));
    await p.close();
  }

  // ── a meaning has to be in English ────────────────────────────────
  // A deck that runs word → meaning promises a meaning on the back, and
  // "skandaḥ → Kārttikeya" is not one: it renames the god in Sanskrit and
  // leaves a learner who does not already know the second name with nothing.
  // Decks that pair Sanskrit with Sanskrit by design say so in their own
  // pair — join → result, compound → vigraha, pattern → metre — and are not
  // asked this question.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const DIA = 'āīūṛṝḷḹṅñṭḍṇśṣṃḥĀĪŪṚṜṄÑṬḌṆŚṢṂḤ';
      const sanskrit = t => [...t].some(ch => DIA.indexOf(ch) >= 0);
      const bad = [];
      Object.keys(DECKS).forEach(n => {
        if ((DECK_PAIR[n] || 'word → meaning') !== 'word → meaning') return;
        DECKS[n].forEach(c => {
          if ((c.type || 'reveal') !== 'reveal') return;
          /* Every word of the gloss carrying diacritics means the whole back
             is Sanskrit.  A numeral, an "O …!" or a plain English word beside
             the name is what makes it a meaning. */
          const words = (c.gloss || '').split(/[^A-Za-z\u00C0-\u1EFF]+/).filter(Boolean);
          if (words.length && words.every(sanskrit)) bad.push(c.id + ' → ' + c.gloss);
        });
      });
      /* and the rule has teeth: the card that prompted it, as it was */
      const caught = ['Kārttikeya', 'māyā-bīja', 'Vārāṇasī'].every(g => {
        const w = g.split(/[^A-Za-z\u00C0-\u1EFF]+/).filter(Boolean);
        return w.length && w.every(sanskrit);
      }) && !['the city of Vārāṇasī', 'O Rāma!', 'Kerala', 'Sarasvatī river']
        .some(g => {
          const w = g.split(/[^A-Za-z\u00C0-\u1EFF]+/).filter(Boolean);
          return w.length && w.every(sanskrit);
        });
      return { bad: bad, caught: caught };
    });
    ok('a word → meaning card answers with a meaning, not another Sanskrit word',
      !r.bad.length, r.bad.slice(0, 3).join(' | '));
    ok('and the rule catches a Sanskrit gloss without catching an English one',
      r.caught);
    await p.close();
  }

  // ── the paradigm workshop is its own track ───────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const row = TRACK_ROWS.find(x => x.track.id === 'siddhi');
      const mine = [].concat(...row.groups.map(g => g.decks));
      const bhasha = TRACK_ROWS.find(x => x.track.id === 'bhasha');
      showTrack('siddhi');
      return {
        lists: mine.length,
        /* still Stage 5's lists on disk — only the row they are drawn under
           changed, and the subheading keeps saying which lesson they are */
        stillRupa: mine.every(n => DECK_LESSON[n] === '05-rupa'),
        sub: row.track.gloss,
        folded: row.lessons.length === 1 && row.lessons[0].label === 'Rūpa',
        /* the tables stayed on the acquisition path */
        tablesOnPath: [].concat(...bhasha.groups.map(g => g.decks))
          .filter(n => DECK_ROLE[n] === 'table').length,
        /* no production list counts towards any course track */
        inACourseTrack: TRACKS.some(t => {
          const x = TRACK_ROWS.find(y => y.track === t);
          return x && [].concat(...x.groups.map(g => g.decks))
            .some(n => streamOf(n) === 'mastery');
        }),
        /* and none of them repeats the track's name any more */
        prefixed: mine.filter(n => /^Rūpa-siddhi/.test(n)).length,
        page: { name: document.getElementById('s-name').textContent,
                held: document.getElementById('s-held').textContent,
                plan: [...document.querySelectorAll('#s-plan li')].map(x => x.textContent),
                go: document.getElementById('s-go').textContent },
      };
    });
    /* lesson-first: it opens what Rūpa teaches, and that teaching's prompt leads
       on to Śiva — the pattern everything else is compared to */
    await p.evaluate(() => showTrack('siddhi'));
    await p.click('#s-go');
    const step = await p.evaluate(() => ({
      panel: document.getElementById('study').style.display,
      title: document.getElementById('st-title').textContent,
      go: document.getElementById('st-go').textContent,
    }));
    ok('the production lists are drawn as a track of their own',
      r.lists === 13 && !r.inACourseTrack, r.lists + ' lists');
    ok('and are still Stage 5 lists, under a row that says so',
      r.stillRupa && r.folded, JSON.stringify(r.folded));
    ok('the tables stayed on the acquisition path', r.tablesOnPath >= 9,
      r.tablesOnPath + ' tables');
    ok('no list repeats the name of the track it sits in',
      r.prefixed === 0, r.prefixed + ' prefixed');
    ok('the page names the track and counts what it holds',
      /Rūpa-siddhi · Form Production/.test(r.page.name) && /^13 lists$/.test(r.page.held),
      r.page.held + ' · ' + r.page.name);
    ok('and its plan says what it rests on, first',
      /^Take Rūpa first/.test(r.page.plan[0] || ''), (r.page.plan[0] || '').slice(0, 40));
    ok('it opens the teaching it rests on, which leads to the first pattern',
      /Begin — Rūpa/.test(r.page.go)
        && step.panel === 'block' && /Begin — Śiva/.test(step.go),
      r.page.go + ' → ' + step.title + ' → ' + step.go);
    await p.close();
  }

  // ── the results say which lists held up ───────────────────────────
  // A review crosses lists, so "which cards went wrong" is the wrong
  // question at the end of one; the learner-facing unit is the list.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const small = Object.keys(DECKS).filter(n => DECKS[n].length <= 15).slice(0, 5);
      /* a card enters the pool by having come back cold, not by sitting in
         a list that was played to the end */
      SAVED.decks = {}; SAVED.mastered = {};
      small.forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      SAVED.review = { runs: 0, right: 0, seen: 0, cards: {} };
      startMixedReview();
      /* miss everything from the first list drawn, know the rest */
      const weak = DECK_OF.get(current.card);
      let n = 0;
      while (current && n++ < 200) (DECK_OF.get(current.card) === weak ? didntKnow : knew)();

      const rows = [...document.querySelectorAll('#r-list .brow')].map(x => ({
        name: x.querySelector('.b-name').textContent,
        score: x.querySelector('.b-score').textContent,
        verdict: x.querySelector('.b-pct').textContent,
        full: x.classList.contains('full'),
      }));
      const strong = [...document.querySelectorAll('#r-list .brow.full .b-pct')][0];
      return { rows: rows, weak: DECK_SHORT(weak),
               strongInk: strong ? getComputedStyle(strong).color : '',
               /* resolved, not declared — a var() that fails to resolve is
                  not an error, it just inherits */
               patraInk: (() => { const d = document.createElement('div');
                 d.style.color = 'var(--patra-ink)'; document.body.appendChild(d);
                 const c = getComputedStyle(d).color; d.remove(); return c; })(),
               head: (document.querySelector('#r-list .missed-head') || {}).textContent,
               score: document.getElementById('r-score').textContent,
               /* card-level detail is evidence, not the headline */
               cardsInSummary: /\d+ cards mastered/.test(document.getElementById('r-list').textContent) };
    });

    ok('the results break the round down by list', r.rows.length >= 2,
      r.rows.length + ' lists');
    ok('headed as such', /How each list held up/.test(r.head || ''), r.head);
    ok('weakest first, and named as needing practice',
      r.rows[0].name === r.weak && r.rows[0].verdict === 'practise',
      r.rows[0].name + ' ' + r.rows[0].score + ' · ' + r.rows[0].verdict);
    ok('a list that held up is marked strong, in the right-answer pigment',
      r.rows.some(x => x.full && x.verdict === 'strong') && r.strongInk === r.patraInk,
      r.rows.map(x => x.name + ' ' + x.score).join(' | ') + ' · ' + r.strongInk);
    ok('the review score is still stated', /Review accuracy/.test(r.score),
      r.score.replace(/\s+/g, ' ').slice(0, 60));
    ok('and no card-level progress leaks into it', !r.cardsInSummary);
    await p.close();
  }

  // ── overall mastery: review accuracy against course coverage ──────
  // Neither half is mastery alone — 95% accuracy over fifty cards is not a
  // mastered course, and neither is the whole course at 40% accuracy — so the
  // two combine rather than averaging.  Coverage is material that has ENTERED
  // review, which is the same act the learner already understands: finish a
  // list and it starts coming back.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      /* accuracy is read off the last few sessions now, so a fixture states
         one session at the ratio it wants */
      const acc = (right, seen) => {
        SAVED.review = { runs: 1, right: right, seen: seen, cards: {},
                         recent: [[right, seen]] };
      };
      /* a list is complete when every card in it has come back cold */
      const complete = names => {
        SAVED.decks = {}; SAVED.mastered = {};
        names.forEach(n => DECKS[n].forEach(c => { SAVED.mastered[c.id] = 1; }));
      };
      const all = Object.keys(DECKS);
      const upTo = frac => {
        const want = ALL_IDS.size * frac, taken = [];
        let n = 0;
        for (const d of all) { if (n >= want) break; taken.push(d); n += DECKS[d].length; }
        return taken;
      };

      /* before any review there is no figure, and the section says why */
      complete([]); acc(0, 0);
      openDrawer();
      out.unranked = { pct: document.getElementById('dp-pct').textContent,
                       bar: document.getElementById('dp-bar').style.width };
      closeDrawer();
      /* the detail lives on the card the button opens, not in the drawer */
      openPanel('reviewpanel');
      out.unranked.card = document.getElementById('rp-what').textContent;
      closePanel();

      complete(upTo(0.4)); acc(8, 10);
      out.cov = coverageOf().pct;
      out.acc80 = rankOf();

      complete(all);
      acc(10, 10); out.perfect = rankOf();
      acc(4, 10);  out.lowAccuracy = rankOf();
      complete(upTo(0.5));
      acc(10, 10); out.halfCovered = rankOf();
      complete([all.find(n => DECKS[n].length < 10)]);
      acc(10, 10); out.barely = rankOf();

      out.notRounded = out.lowAccuracy.score < 100 && out.halfCovered.score < 100;
      out.notZeroed = out.barely.score >= 1;

      /* and the panel states the figure in the same words as the drawer */
      complete(upTo(0.5)); acc(8, 10);
      openPanel('reviewpanel');
      out.panelTop = document.getElementById('rp-rank-top').textContent;
      out.panelSub = document.getElementById('rp-rank-sub').textContent;
      out.panelNote = document.getElementById('rp-note').textContent;
      out.panelWhat = document.getElementById('rp-what').textContent;
      out.panelScore = document.getElementById('rp-sub').textContent;
      return out;
    });

    ok('no figure before the first review', r.unranked.pct === 'Unranked',
      r.unranked.pct);
    ok('and the card says what to do instead',
      /^Learn \d+ cards to unlock — \d+ so far$/.test(r.unranked.card),
      r.unranked.card);
    ok('mastery is accuracy against coverage',
      r.acc80.score === Math.round(80 * r.cov / 100) && r.acc80.acc === 80,
      '80% accuracy, ' + r.cov + '% covered → ' + r.acc80.score + '%');
    ok('a fully covered course at full accuracy is 100%',
      r.perfect.score === 100 && r.perfect.name === 'Master', JSON.stringify(r.perfect));
    ok('coverage alone does not carry it', r.lowAccuracy.score === 40,
      JSON.stringify(r.lowAccuracy));
    ok('nor does accuracy alone', r.halfCovered.score <= 51 && r.halfCovered.acc === 100,
      JSON.stringify(r.halfCovered));
    ok('neither rounds up to finished nor away to nothing',
      r.notRounded && r.notZeroed, 'barely ' + r.barely.score + '% · ' + r.barely.name);

    /* the panel says what a review is and what it costs, in plain words */
    ok('the review card states the score plainly',
      /^\d+% correct on first try$/.test(r.panelScore), r.panelScore);
    ok('and what it is drawing on, and what is waiting',
      /^Reviewing \d+ cards from \d+ learned · \d+\+? due now$/.test(r.panelWhat), r.panelWhat);
    /* the mechanism in the learner's terms — what a card is measured on, and
       what makes it come back — with none of the arithmetic behind it */
    ok('the explanation describes the mode, not the arithmetic',
      /^Abhyāsa checks/.test(r.panelNote)
        && /first answer counts/.test(r.panelNote)
        && /come back later/.test(r.panelNote) && /come back\s+sooner/.test(r.panelNote)
        && !/[×x] \d/.test(r.panelNote) && !/%/.test(r.panelNote),
      r.panelNote.slice(0, 48));
    ok('the panel names the figure exactly as the drawer does',
      /^Overall mastery \d+% · [A-Z]/.test(r.panelTop)
        && /^\d+% review accuracy · \d+% course coverage$/.test(r.panelSub),
      r.panelTop + ' / ' + r.panelSub);
    ok('and never shows the multiplication',
      !/[×x]\s*\d+%/.test(r.panelTop + r.panelSub + r.panelNote));
    await p.close();
  }

  // ── a panel's own action leads, and its state is on the row ───────
  // The review window described the mode and then offered only "Back to the
  // cards", because #panel-back sat above #rp-actions in the DOM: what it
  // read as offering was leaving.  The mode's button comes first now.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const out = {};
      /* finish four small lists cold, which is what unlocks review */
      let n = 0;
      for (const d of Object.keys(DECKS)) {
        if (n >= 4) break;
        if (DECKS[d].length > 20) continue;
        n++; loadDeck(d);
        while (current) knew();
      }
      const rows = () => [...document.querySelectorAll('.actions')]
        .filter(e => !e.hidden).map(e => e.id);

      openPanel('reviewpanel');
      out.reviewRows = rows();
      out.drawShown = !document.getElementById('rp-draw').hidden;
      out.reviewSub = document.getElementById('rp-sub').textContent;
      /* unlocked but never reviewed: the card says what it will draw on */
      out.cardBefore = document.getElementById('rp-what').textContent;

      /* and once a draw has happened the figure is on the row and in the
         window it came from */
      openPanel('reviewpanel');
      document.getElementById('rp-draw').click();
      let g = 0;
      while (current && g++ < 60) (g % 3 ? knew : didntKnow)();
      openDrawer();
      out.rankRow = document.getElementById('dp-pct').textContent;
      closeDrawer();
      openPanel('reviewpanel');
      out.rowAfter = document.getElementById('rp-rank-sub').textContent;
      out.subAfter = document.getElementById('rp-sub').textContent;
      out.mastery = masteryPct();
      return out;
    });

    const leads = (rows, own) => rows.indexOf(own) >= 0
      && rows.indexOf(own) < rows.indexOf('panel-back');
    ok('review offers the draw above the way out',
      r.drawShown && leads(r.reviewRows, 'rp-actions'), r.reviewRows.join(' | '));
    ok('unlocked and unused, the card says what it draws on',
      /^Reviewing \d+ cards from \d+ learned · \d+\+? due now$/.test(r.cardBefore),
      JSON.stringify(r.cardBefore));
    ok('the drawer carries only the figure and its rank',
      /^\d+% · (Novice|Learner|Skilled|Expert|Master)$/.test(r.rankRow),
      JSON.stringify(r.rankRow));
    /* the two plain readings, never the multiplication that combines them */
    ok('and the card names both readings once there is a figure',
      r.mastery !== null
        && new RegExp('^' + r.mastery + '% review accuracy · \\d+% course coverage$')
             .test(r.rowAfter)
        && r.subAfter === r.mastery + '% correct on first try',
      JSON.stringify(r.rowAfter) + ' / ' + JSON.stringify(r.subAfter));
    await p.close();
  }

  // ── Study is the lesson-first presentation ───
  // Study now shows the lesson's own theory.md — what it teaches, rendered at
  // build time and inlined — and the tray below carries the one prompt on to
  // the lesson's first list.  A viewer, not a second learning system: no cards,
  // no grading, no toggles.  Reached by the Study icon during practice and by
  // the book-link at the head of a lesson's lists in the drawer; there is no
  // separate reference surface any more.
  {
    const p = await open(browser, { viewport: { width: 360, height: 740 } });
    const r = await p.evaluate(() => {
      const el = id => document.getElementById(id);
      const out = {};

      /* the icon studies the lesson in play: teaching shown, prompt on to the
         first list */
      loadDeck('S · Ac sandhi — vowel joins');
      out.offered = !el('study-btn').hidden;
      el('study-btn').click();
      const body = el('st-body');
      out.opened = el('study').style.display === 'block';
      out.title = el('st-title').textContent;             // titled from the lesson
      out.h1 = body.querySelectorAll('h1').length;         // the file's h1 is the panel heading
      out.scrolls = body.scrollHeight > body.clientHeight + 10;
      out.sideways = document.documentElement.scrollWidth > window.innerWidth;
      out.back = !el('panel-back').hidden;
      out.noCard = el('card').style.display === 'none'
                && el('grade').hidden && el('controls').hidden;
      out.promptShown = !el('st-actions').hidden;
      out.prompt = el('st-go').textContent;

      /* the prompt starts the round and closes the panel */
      el('st-go').click();
      out.started = !!current && el('study').style.display === 'none'
                 && el('card').style.display !== 'none';
      out.startedLesson = deckName && DECK_LESSON[deckName] === '03-sandhi';

      /* a long teaching gets a contents list addressing real headings */
      loadDeck(Object.keys(DECKS).find(n => DECK_LESSON[n] === '06-kriya'));
      el('study-btn').click();
      out.toc = [...document.querySelectorAll('#st-toc .st-link')].length;
      out.tocHits = [...document.querySelectorAll('#st-body h2')].length;
      out.kriyaTitle = el('st-title').textContent;
      el('p-back').click();

      /* the drawer book-link opens the same surface for any lesson */
      SAVED.guided = false; save();
      openDrawer(); openTracks.add('bhasha'); openLessons.add('bhasha/vakya'); renderDrawer();
      const link = [...document.querySelectorAll('.th-link')].find(b => /Sandhi/.test(b.title));
      out.linkShown = !!link;
      if (link) link.click();
      out.linkOpened = el('study').style.display === 'block'
                    && el('st-title').textContent === 'Sandhi';
      el('p-back').click();

      /* a mixed round belongs to no lesson, so nothing to study */
      deckName = MIX; syncNav();
      out.hiddenMixed = el('study-btn').hidden;

      /* every carried teaching has real content, and the book-link is absent
         (not broken) for a lesson with none */
      const empty = [];
      Object.keys(THEORY).forEach(k => {
        if (!THEORY[k].html || THEORY[k].html.length < 200) empty.push(k);
      });
      out.count = Object.keys(THEORY).length;
      out.empty = empty;
      out.linkFns = typeof theoryLink === 'function'
                 && theoryLink('does-not-exist') === null;
      return out;
    });

    ok('Study is offered for a lesson, showing its teaching', r.offered && r.opened);
    ok('titled from the lesson, its own h1 dropped',
      r.title === 'Sandhi' && r.h1 === 0, JSON.stringify(r.title));
    ok('it reads inside itself, not down the page', r.scrolls && !r.sideways);
    ok('Study holds no exercise', r.noCard && r.back);
    ok('it prompts on to the lesson first list',
      r.promptShown && /^(Begin|Continue) — /.test(r.prompt), r.prompt);
    ok('and that prompt starts the round in the same lesson',
      r.started && r.startedLesson);
    ok('a long teaching gets a contents list', r.toc >= 5 && r.toc <= r.tocHits,
      r.kriyaTitle + ': ' + r.toc + ' of ' + r.tocHits + ' sections');
    ok('the drawer book-link opens the same teaching for any lesson',
      r.linkShown && r.linkOpened);
    ok('a mixed round has no lesson to study', r.hiddenMixed);
    ok('every carried teaching has content', r.count >= 28 && !r.empty.length,
      r.count + ' lessons' + (r.empty.length ? ', empty: ' + r.empty.join(', ') : ''));
    ok('a lesson with no theory gets no book-link', r.linkFns);
    await p.close();
  }

  // ── every reveal card names the operation before it is answered ────
  // A reveal card shows an item and nothing else, so the task lived only in
  // the direction button below the card.  The cue is derived from the deck's
  // pair rather than written on each card, which means it can only be right
  // for every list if the table covers every destination half in use.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const missing = [], onInteractive = [];
      Object.keys(DECKS).forEach(n => {
        const cards = DECKS[n];
        const interactive = cards.every(c => (c.type || 'reveal') !== 'reveal');
        loadDeck(n);
        ['reveal', 'produce'].forEach(d => {
          setDir(d);
          const c = interactive ? cards[0]
                                : cards.find(x => (x.type || 'reveal') === 'reveal');
          startRound([c], {});
          const cue = document.getElementById('cue').textContent;
          if (interactive || (c.type || 'reveal') !== 'reveal') {
            if (cue) onInteractive.push(n + ' / ' + d);
          } else if (!cue) missing.push(n + ' / ' + d);
        });
      });
      /* the cue names the destination half, so it must differ by direction */
      loadDeck('28 · Vṛtta — the classical metres');
      const card = DECKS['28 · Vṛtta — the classical metres'][0];
      const both = ['reveal', 'produce'].map(d => {
        setDir(d); startRound([card], {});
        return document.getElementById('cue').textContent;
      });
      /* and it must sit above the item, not below it */
      const cue = document.getElementById('cue');
      const dn = document.getElementById('dn');
      const above = cue.getBoundingClientRect().bottom
                 <= dn.getBoundingClientRect().top + 1;
      const quiet = parseFloat(getComputedStyle(cue).fontSize)
                  < parseFloat(getComputedStyle(dn).fontSize);
      return { missing: missing.slice(0, 4), nMissing: missing.length,
               onInteractive: onInteractive.slice(0, 4),
               nOn: onInteractive.length, both, above, quiet,
               cues: new Set(Object.values(CUES)).size };
    });

    ok('every reveal list names its task, both ways round',
      r.nMissing === 0, r.nMissing + ' without a cue, eg ' + r.missing.join(' | '));
    ok('an interactive card gets no cue over its own prompt',
      r.nOn === 0, r.nOn + ' doubled up, eg ' + r.onInteractive.join(' | '));
    ok('the cue names the direction, not the list',
      r.both[0] === 'Identify the metre' && r.both[1] === 'Recall the pattern',
      r.both.join(' / '));
    ok('the cue sits above the item and stays secondary', r.above && r.quiet);
    console.log('        ' + r.cues + ' distinct cues across every pair in use');
    await p.close();
  }

  // ── the direction toggle means something on every list ─────────────
  // "word → meaning" was printed over lists that hold no meanings: a
  // paradigm cell answers with an analysis, a sandhi rule with the result of
  // a join.  Each list names its own pair, and a list that runs one way says
  // so instead of offering a flip it cannot make.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const label = () => document.getElementById('dir-label').textContent;
      const off = () => document.getElementById('dir').disabled
                     && document.getElementById('iast-on').disabled;
      const read = n => {
        loadDeck(n);
        setDir('reveal');  const fwd = label(), fwdOff = off();
        setDir('produce'); const rev = label();
        setDir('reveal');
        return { fwd, rev, off: fwdOff };
      };
      const seen = {};
      Object.keys(DECKS).forEach(n => { seen[n] = read(n); });

      const revealDecks = Object.keys(DECKS).filter(n =>
        DECKS[n].some(c => (c.type || 'reveal') === 'reveal'));
      const interactive = Object.keys(DECKS).filter(n =>
        DECKS[n].every(c => (c.type || 'reveal') !== 'reveal'));

      // a cross-list draw has no single pair to name
      startRound([DECKS[revealDecks[0]][0]], { mixed: true });
      const mixedLabel = label();

      return {
        pairs: [...new Set(revealDecks.map(n => seen[n].fwd))].sort(),
        // every reveal list offers a flip, and the flip is the pair reversed
        flips: revealDecks.every(n => {
          const h = seen[n].fwd.split(' → ');
          return h.length === 2 && seen[n].rev === h[1] + ' → ' + h[0];
        }),
        revealOn: revealDecks.every(n => !seen[n].off),
        interactiveOff: interactive.every(n => seen[n].off),
        interactiveSays: [...new Set(interactive.map(n => seen[n].fwd))],
        nInteractive: interactive.length,
        mixedLabel,
      };
    });
    ok('every reveal list can be flipped', r.revealOn && r.flips);
    ok('a list that runs one way greys both toggles',
      r.nInteractive > 0 && r.interactiveOff, r.nInteractive + ' interactive lists');
    ok('and says so rather than naming a pair',
      r.interactiveSays.length === 1 && r.interactiveSays[0] === 'one direction only',
      r.interactiveSays.join(' | '));
    ok('lists name more than one kind of pair', r.pairs.length >= 5, r.pairs.join(' | '));
    ok('a paradigm list runs form to analysis, not word to meaning',
      r.pairs.includes('form → analysis') && r.pairs.includes('join → result'),
      r.pairs.join(' | '));
    ok('a cross-list draw falls back to the general pair',
      r.mixedLabel === 'word → meaning', r.mixedLabel);
    console.log('        pairs: ' + r.pairs.join(' | '));
    await p.close();
  }

  // ── prompts are task prompts ───────────────────────────────────────
  // A prompt names the operation and then the item: "Split: jagan nāthaḥ",
  // not "jagan nāthaḥ came from ?".  Checked over every choice card rather
  // than a sample, so a conversational one added later is caught.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const all = [];
      Object.values(DECKS).forEach(cards => cards.forEach(c => {
        if ((c.type || 'reveal') === 'choice') all.push(c);
      }));
      const head = f => f.split('\n')[0];
      /* Three shapes are allowed, and nothing else:
           a task label and its item   "Split: jagan nāthaḥ"
           a direct question           "Which vibhakti is NOT a kāraka?"
           a meaning over a frame      "“I bow to Rāma”" / "___ namāmi"
         In the third the blank is the task, so it needs no label. */
      const shaped = f =>
        /:/.test(head(f)) || /\?$/.test(head(f)) || f.includes('___');
      return {
        n: all.length,
        shapeless: all.filter(c => !shaped(c.front)).map(c => c.id + ' — ' + c.front),
        // the conversational shapes this pass removed
        chatty: all.filter(c => /came from|which analysis|→ \?$|play\?$|make it/.test(c.front))
                   .map(c => c.id + ' — ' + c.front),
        /* A task label is short, so the item is what gets read.  Only where
           the item follows on the same line: a prompt that ENDS at its colon
           is a lead-in to the options, and is a sentence by design. */
        longLabel: all.filter(c => {
          const m = head(c.front).match(/^([^:]+):\s*\S/);
          return m && m[1].split(/\s+/).length > 5;
        }).map(c => c.id + ' — ' + c.front),
      };
    });
    ok('every choice card names its task or asks outright',
      !r.shapeless.length, r.shapeless.slice(0, 3).join(' | '));
    ok('no conversational prompt survives',
      !r.chatty.length, r.chatty.slice(0, 3).join(' | '));
    ok('a task label stays short', !r.longLabel.length, r.longLabel.slice(0, 3).join(' | '));
    console.log('        ' + r.n + ' choice prompts checked');
    await p.close();
  }

  // ── the five course tracks ─────────────────────────────────────────
  // The drawer is built from TRACKS alone, so what is checked here is that
  // the table matches the curriculum and that every stage lands in exactly
  // one place — a stage in two tracks would be counted twice.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const stages = [];
      for (let n = 1; n <= 36; n++) stages.push({ n, hits: TRACKS.filter(t => t.has(n)).map(t => t.id) });
      return {
        names: TRACKS.map(t => t.name),
        glosses: TRACKS.map(t => t.gloss),
        doubled: stages.filter(x => x.hits.length > 1).map(x => x.n),
        homeless: stages.filter(x => !x.hits.length).map(x => x.n),
        stage20: TRACKS.filter(t => t.has(20)).map(t => t.id),
        stage17: TRACKS.filter(t => t.has(17)).map(t => t.id),
        rowNames: TRACK_ROWS.map(r => r.track.name),
        crossLast: TRACK_ROWS[TRACK_ROWS.length - 1].track.id,
        crossStages: TRACK_ROWS[TRACK_ROWS.length - 1].lessons.map(L => L.stage),
        /* Whatever stage a list in this section came from, it is here
           because it is grammar — never because a stage was moved. */
        crossNotGrammar: [].concat(...TRACK_ROWS[TRACK_ROWS.length - 1]
          .lessons.map(L => L.decks))
          .filter(n => DECK_STAGE[n] !== 0 && streamOf(n) !== 'grammar'),
      };
    });
    ok('there are five course tracks', r.names.length === 5, r.names.join(' | '));
    ok('the five tracks are named in IAST, glossed in English',
      JSON.stringify(r.names) === JSON.stringify([
        'Bhāṣā-Vidyā', 'Kāvya-Racanā', 'Pūjā-Vāk', 'Svara-Vidyā', 'Avadhāna'])
      && r.glosses.every(Boolean), r.names.join(' | '));
    ok('no stage belongs to two tracks', !r.doubled.length, r.doubled.join(', '));
    ok('every stage 1–36 has a track', !r.homeless.length, r.homeless.join(', '));
    // the one ambiguity in the source diagram, resolved the way stage 17 is
    ok('stage 20 is Svara-Vidyā, not poetic composition',
      JSON.stringify(r.stage20) === '["svara"]', r.stage20.join(', '));
    ok('stage 17 is Pūjā-Vāk', JSON.stringify(r.stage17) === '["puja"]', r.stage17.join(', '));
    // cross-cutting grammar is listed after the five, and is not a sixth track
    ok('cross-cutting practice trails the tracks', r.crossLast === 'vyakaranam', r.crossLast);
    /* A stage's own formal layer is drawn here — the Maheśvara sūtras, the
       named sandhi rules, the kṛt and taddhita affixes, the ten lakāras — so
       the section reaches into four stages.  What it may never do is take a
       list that is on the acquisition path. */
    ok('only grammar-stream lists are drawn as cross-cutting',
      !r.crossNotGrammar.length, r.crossNotGrammar.join(', '));
    await p.close();
  }

  // ── the script comes before the words ──────────────────────────────
  // Every card in the app is set in Devanagari, so a learner who cannot
  // decode it meets Stage 1 as a wall rather than as vocabulary.  The script
  // track takes the wall down and does nothing else: it leads the drawer,
  // it belongs to no course track's percentage, and — the rule the whole
  // track turns on — it never shows a transliteration beside a glyph the
  // learner is being asked to read.
  {
    const fs = require('fs');
    const nama = new Set();
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '01-nama', 'practice.json'), 'utf8'))
      .decks.forEach(d => d.cards.forEach(c => { if (c.devanagari) nama.add(c.devanagari); }));

    const p = await open(browser);
    const r = await p.evaluate(() => {
      const mine = Object.keys(DECKS).filter(n => streamOf(n) === 'script');
      const out = { decks: mine.length, cards: 0, first: TRACK_ROWS[0].track.id,
                    counted: [], carriesIast: [], toggleLive: [], frontIast: [],
                    known: [], unknown: [], mixed: [], sets: {} };
      mine.forEach(n => DECKS[n].forEach(c => { out.cards++; }));

      /* it is drawn above the five, and none of its cards is in any course
         track's denominator */
      const ids = new Set();
      mine.forEach(n => DECK_IDS[n].forEach(k => ids.add(k)));
      TRACK_ROWS.forEach(x => {
        if (x.track.id === 'devanagari') return;
        x.pathIds.forEach(k => { if (ids.has(k)) out.counted.push(x.track.id); });
      });

      /* the IAST toggle governs a transliteration shown BESIDE the item.
         Here the transliteration is the answer, so there is none to show and
         the box is greyed — checked on every card, both ways round. */
      const was = SAVED.iast;
      setIast(true);
      ['reveal', 'produce'].forEach(d => {
        setDir(d);
        mine.forEach(n => {
          loadDeck(n);
          DECKS[n].forEach(c => {
            if (c.iast !== undefined) out.carriesIast.push(c.id);
            startRound([c], {});
            if (!document.getElementById('iast-on').disabled) out.toggleLive.push(c.id + ' / ' + d);
            if (document.getElementById('iast').textContent) out.frontIast.push(c.id + ' / ' + d);
          });
        });
      });
      out.prefKept = SAVED.iast === true;          // setIast above, and nothing since
      setIast(was);

      /* a list is one kind of card throughout — the app's own rule, and the
         reason an interactive deck can require a note and a source */
      mine.forEach(n => {
        if (new Set(DECKS[n].map(c => c.type || 'reveal')).size !== 1) out.mixed.push(n);
      });

      /* the decoding lists say what they are: one reuses Stage 1 vocabulary,
         the other deliberately does not */
      out.known = DECKS['Pada-pāṭha — reading a word you have met'].map(c => c.devanagari);
      out.unknown = DECKS['Apūrva-pada — reading a word you have not met'].map(c => c.devanagari);

      /* Drawn EXACTLY as a course track is drawn — same name colour, same
         bar, same behaviour.  The only mark is the word "optional" leading
         the subheading: a section at the top of the drawer that is greyed
         reads as disabled rather than as elective. */
      /* the boot state, which is what "open by default" means — openTracks is
         seeded once at load, so a learner who shuts the section keeps it shut */
      openLessons.clear(); renderDrawer();
      const opt = document.querySelector('.tr.elective');
      const course = document.querySelector('.tr:not(.elective) .tr-name');
      out.optName = opt && opt.querySelector('.tr-name').textContent;
      out.optSub = opt && opt.querySelector('.tr-sub').textContent;
      out.optSameInk = !!opt && !!course
        && getComputedStyle(opt.querySelector('.tr-name')).color
           === getComputedStyle(course).color;
      /* and the rest of the row matches too, so nothing else drifts back in */
      const face = e => { const c = getComputedStyle(e);
        return [c.fontSize, c.fontWeight, c.fontStyle, c.opacity].join(' '); };
      out.optFace = !!opt && !!course && face(opt.querySelector('.tr-name')) === face(course);
      out.optSubInk = !!opt && getComputedStyle(opt.querySelector('.tr-sub')).color
        === getComputedStyle(document.querySelector('.tr:not(.elective) .tr-sub')).color;
      out.optHasBar = !!opt && !!opt.querySelector('.tr-head .bar, .tr-head .pct, .tr-pct');
      /* the box the row must NOT have: `.opt` is the choice card's answer
         button, and a drawer row that shared the class inherited it whole */
      const box = e => { const c = getComputedStyle(e);
        return [c.borderTopWidth, c.borderLeftWidth, c.borderRightWidth,
                c.borderRadius, c.minHeight, c.textAlign].join(' '); };
      out.optBox = !!opt && !!course
        && box(opt) === box(document.querySelector('.tr:not(.elective)'));
      /* and nothing in the drawer may carry the answer-button class at all */
      out.leaked = [...document.querySelectorAll('.drawer .opt')].length;
      /* shut on arrival, like every other section: this is a mark on the
         row, not a layout of its own */
      out.anyOpen = [...document.querySelectorAll('.tr')]
        .filter(x => x.querySelector('.tr-body') && !x.querySelector('.tr-body').hidden)
        .length;
      /* the same word the enrichment row uses, so the two read as one idea */
      out.enrich = [...document.querySelectorAll('.ls.elective .ls-sub')]
        .map(e => e.textContent).find(Boolean) || '';

      /* both members of every confusable set, because picking one out does
         not mean you can pick out the other */
      DECKS['Sadṛśa — the letters that look alike · practice'].forEach(c => {
        const set = c.id.split(':')[2];
        out.sets[set] = (out.sets[set] || 0) + 1;
      });
      return out;
    });

    ok('the script track leads the drawer', r.first === 'devanagari', r.first);
    ok('and no course track counts its cards', !r.counted.length,
      [...new Set(r.counted)].join(', '));
    ok('no card in it carries a transliteration beside the glyph',
      !r.carriesIast.length, r.carriesIast.slice(0, 3).join(' | '));
    ok('so the IAST toggle is greyed on every one of its cards, both ways round',
      !r.toggleLive.length, r.toggleLive.slice(0, 3).join(' | '));
    ok('and nothing on the front of a card transliterates it',
      !r.frontIast.length, r.frontIast.slice(0, 3).join(' | '));
    ok('the learner’s own IAST setting is left as they had it', r.prefKept);
    ok('every list in it holds one kind of card', !r.mixed.length, r.mixed.join(' | '));
    ok('the words you have met are Stage 1 vocabulary',
      r.known.length >= 20 && r.known.every(w => nama.has(w)),
      r.known.filter(w => !nama.has(w)).join(' '));
    ok('and the words you have not met are not',
      r.unknown.length >= 10 && !r.unknown.some(w => nama.has(w)),
      r.unknown.filter(w => nama.has(w)).join(' '));
    ok('it is named as the optional section it is',
      r.optName === 'Devanāgarī' && /^optional · /.test(r.optSub || ''),
      r.optName + ' · ' + r.optSub);
    /* It used to be faded to match the enrichment row inside a track, and at
       the top of the drawer that read as disabled rather than as elective. */
    ok('but styled identically to a course track, never faded',
      r.optSameInk && r.optFace && r.optSubInk,
      'ink ' + r.optSameInk + ' · face ' + r.optFace + ' · sub ' + r.optSubInk);
    /* It carried a 1px box, a radius and a 46px floor, in a light-card
       colour, because its marker class was spelt the same as the choice
       card's answer button.  Two unrelated things sharing a class name. */
    ok('and its box is a track’s box, not the answer button’s',
      r.optBox && r.leaked === 0,
      'box ' + r.optBox + ' · ' + r.leaked + ' rows wearing .opt');
    ok('and shut on arrival, like every other section',
      r.anyOpen === 0, r.anyOpen + ' sections open');
    ok('in the same words the enrichment row uses',
      /^optional · /.test(r.enrich), r.enrich);
    ok('every confusable set is drilled from both sides',
      Object.keys(r.sets).length === 8
        && Object.values(r.sets).every(n => n === 2),
      JSON.stringify(r.sets));
    console.log('        ' + r.decks + ' lists · ' + r.cards + ' cards, counting towards no track');
    await p.close();

    /* And the app does not LAND in it.  With nothing remembered, loadDeck
       fell back to the first list in DECKS — which this track now is — and
       openDrawer lands on the track holding the current list, so the drawer
       opened with the optional section expanded and the five shut: the one
       row in there behaving unlike its neighbours. */
    const q = await browser.newPage();
    q.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await q.goto(FILE, { waitUntil: 'load' });
    await q.click('#nav');
    const boot = await q.evaluate(() => ({
      deck: deckName,
      stream: streamOf(deckName),
      open: [...document.querySelectorAll('.tr')]
        .filter(x => x.querySelector('.tr-body') && !x.querySelector('.tr-body').hidden)
        .map(x => x.querySelector('.tr-name').textContent),
    }));
    ok('a first load lands on the course, not on the optional section',
      boot.stream === 'core', boot.deck + ' · ' + boot.stream);
    ok('so the drawer opens on a course track and the optional one stays shut',
      boot.open.length === 1 && boot.open[0] !== 'Devanāgarī', boot.open.join(' | '));
    await q.close();
  }

  // ── progress is counted from cards, at every level ─────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      // master every card of the smallest lesson, and nothing else
      const small = LESSONS.slice().sort((a, b) => a.ids.size - b.ids.size)[0];
      small.ids.forEach(k => { SAVED.mastered[k] = 1; });
      save();
      const row = TRACK_ROWS.find(x => x.lessons.some(L => L.lesson === small.lesson));
      const lessonP = progressOf(small.ids);
      const trackP = progressOf(row.ids);
      // what an average of lesson percentages would have said instead
      const avg = row.lessons.reduce((a, L) => a + progressOf(L.ids).pct, 0) / row.lessons.length;
      const cardWeighted = Math.round(
        row.lessons.reduce((a, L) => a + progressOf(L.ids).done, 0) / row.ids.size * 100);
      return { lesson: small.label, lessonP, trackP, avg: Math.round(avg), cardWeighted,
               lessons: row.lessons.length };
    });
    ok('a fully mastered lesson reads 100% and ticks',
      r.lessonP.pct === 100 && r.lessonP.full, r.lesson + ' ' + r.lessonP.pct + '%');
    ok('a track counts cards, not an average of its lessons',
      r.trackP.pct === r.cardWeighted && (r.lessons < 2 || r.trackP.pct !== r.avg),
      'track ' + r.trackP.pct + '% · card-weighted ' + r.cardWeighted
        + '% · lesson average ' + r.avg + '%');
    await p.close();
  }

  // ── mastery follows cold recall, and can be lost again ─────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      /* a reveal deck: the learner attests the recall, so one cold win is the
         evidence.  A choice card is picked from three or four and wants the
         evidence twice — that rule has a block of its own below. */
      const deck = DECKS[Object.keys(DECKS).find(n => DECKS[n].length >= 4
        && DECKS[n].every(c => (c.type || 'reveal') === 'reveal'))];
      const ids = new Set(deck.map(c => c.id));
      startRound(deck.slice(0, 3), {});
      const first = current.card.id;
      reveal(); knew();                       // cold: mastered
      const afterCold = !!SAVED.mastered[first];
      const second = current.card.id;
      reveal(); didntKnow();                  // missed, then met again
      let guard = 0;
      while (current && current.card.id !== second && guard++ < 20) { reveal(); knew(); }
      const relearned = current && current.card.id === second;
      if (relearned) { reveal(); knew(); }    // right on the second look
      const afterRelearn = !!SAVED.mastered[second];
      // and losing one already held
      startRound(deck.filter(c => c.id === first), {});
      reveal(); didntKnow();
      return { afterCold, relearned, afterRelearn, afterMiss: !!SAVED.mastered[first],
               pctFalls: progressOf(ids).done };
    });
    ok('a cold right answer masters the card', r.afterCold);
    ok('a card missed then relearned is not mastered', r.relearned && !r.afterRelearn);
    ok('a wrong answer takes mastery back', r.afterMiss === false);
    await p.close();
  }

  // ── 100% is exact, never a rounding artefact ───────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const big = LESSONS.slice().sort((a, b) => b.ids.size - a.ids.size)[0];
      const ids = [...big.ids];
      ids.slice(0, ids.length - 1).forEach(k => { SAVED.mastered[k] = 1; });
      const nearly = progressOf(big.ids);
      SAVED.mastered[ids[ids.length - 1]] = 1;
      const done = progressOf(big.ids);
      // and the other end: one card in a long list must not round to nothing
      const one = {};
      Object.keys(SAVED.mastered).forEach(k => delete SAVED.mastered[k]);
      SAVED.mastered[ids[0]] = 1;
      one.pct = progressOf(big.ids).pct;
      return { size: big.ids.size, nearly, done, one };
    });
    ok('one card short never shows 100%',
      r.nearly.pct === 99 && !r.nearly.full, r.nearly.done + ' of ' + r.nearly.total);
    ok('all of them shows 100% and ticks', r.done.pct === 100 && r.done.full);
    ok('one card in a long list is not rounded away', r.one.pct === 1, r.one.pct + '%');
    await p.close();
  }

  // ── three streams, and a track that asks for one of them ──────────
  // A track used to be one flat run of lessons: Bhāṣā-Vidyā drew thirteen
  // stage rows over 137 lists, more than half of them vocabulary bank, and
  // every one of them counted against the track's percentage.  The streams
  // separate what the track asks for from what it merely offers, and the
  // units say what the asking adds up to.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const row = TRACK_ROWS.find(x => x.track.id === 'bhasha');
      const cross = TRACK_ROWS.find(x => x.track.id === 'vyakaranam');
      const opt = row.groups.filter(g => g.optional);
      const pathNames = recommendPath(row);
      /* what the drawer actually draws under the track */
      openTracks.clear(); openLessons.clear();
      openTracks.add('bhasha');
      row.groups.forEach(g => openLessons.add(g.lesson));
      SAVED.guided = false;
      renderDrawer();
      const tr = [...document.querySelectorAll('#dr-tracks .tr')]
        .find(x => x.querySelector('.tr-name').textContent === 'Bhāṣā-Vidyā');
      const heads = [...tr.querySelectorAll('.tr-body > .ls > .ls-head .ls-name')]
        .map(e => e.textContent);
      /* every stage a unit gathers is captioned inside it, so folding the
         stage level away does not delete a curriculum name */
      const captioned = new Set([...tr.querySelectorAll('.ls-cap')].map(e => e.textContent));
      const stagesInUnits = new Set();
      row.groups.forEach(g => {
        if (g.optional) return;
        g.parts.forEach(part => stagesInUnits.add(part.label));
      });
      /* the streams, as the source declares them */
      const byStream = {};
      Object.keys(DECKS).forEach(n => {
        const k = streamOf(n);
        byStream[k] = (byStream[k] || 0) + DECKS[n].length;
      });
      return {
        units: row.units.map(g => g.label),
        heads,
        optional: opt.map(g => g.label),
        /* the enrichment stream is in the track and out of its figure */
        enrichIn: opt.reduce((a, g) => a + g.ids.size, 0),
        pathCards: row.pathIds.size,
        allCards: row.ids.size,
        pathLists: pathNames.length,
        allLists: trackDecks(row).length,
        pathHasOptional: pathNames.some(n => !isCore(n)),
        /* every stage a unit gathers is named somewhere the learner can see */
        uncaptioned: [...stagesInUnits].filter(x => !captioned.has(x)),
        /* the formal layer is drawn under Vyākaraṇam, whatever stage it is in */
        grammarStages: [...new Set(Object.keys(DECKS).filter(n => streamOf(n) === 'grammar')
          .map(n => DECK_STAGE[n]))].sort((a, b) => a - b),
        grammarUnderCross: Object.keys(DECKS).filter(n => streamOf(n) === 'grammar')
          .every(n => trackIdOf(n) === 'vyakaranam'),
        crossHolds: cross.groups.map(g => g.label),
        byStream,
        /* the two dependencies the ordering had backwards: a root before the
           verb built on it, and the case system before agreeing with it */
        order: pathNames.map(n => DECK_LESSON[n]),
      };
    });
    const first = l => r.order.indexOf(l);
    ok('the track shows four units, not thirteen stages',
      r.units.length === 4 && r.heads.length === 5, r.heads.join(' | '));
    ok('and the fifth row is the optional one',
      r.optional.length === 1 && r.optional[0] === 'Enrichment'
        && r.heads[4] === 'Enrichment', r.optional.join(' | '));
    ok('every stage a unit gathers is still named inside it',
      !r.uncaptioned.length, r.uncaptioned.join(' | '));
    ok('enrichment is in the track and out of its figure',
      r.enrichIn > 0 && r.pathCards + r.enrichIn === r.allCards
        && r.pathCards < r.allCards / 2,
      r.pathCards + ' of ' + r.allCards + ' cards asked for');
    ok('and out of the workload the track recommends',
      !r.pathHasOptional && r.pathLists < r.allLists,
      r.pathLists + ' of ' + r.allLists + ' lists on the path');
    ok('the formal grammar of four stages is drawn under Vyākaraṇam',
      r.grammarUnderCross && r.grammarStages.length === 4
        && r.byStream.grammar > 0,
      'stages ' + r.grammarStages.join(', ') + ' · ' + r.byStream.grammar + ' cards');
    ok('and the terminology lists still lead that section',
      r.crossHolds[0] === 'Saṃjñā', r.crossHolds.join(' | '));
    ok('a root is recommended before the verb built on it',
      first('09-dhatu') >= 0 && first('09-dhatu') < first('06-kriya'),
      '09-dhatu at ' + first('09-dhatu') + ', 06-kriya at ' + first('06-kriya'));
    ok('and the case system before agreeing an adjective with it',
      first('05-rupa') >= 0 && first('05-rupa') < first('04-guna'),
      '05-rupa at ' + first('05-rupa') + ', 04-guna at ' + first('04-guna'));

    /* Finishing what the track asks for finishes the track: the percentage,
       the tick and the award all read the same set of cards, or the drawer
       says 100% beside an award that never arrives. */
    const done = await p.evaluate(() => {
      const row = TRACK_ROWS.find(x => x.track.id === 'bhasha');
      SAVED.mastered = {}; SAVED.awards = {};
      row.pathIds.forEach(k => { SAVED.mastered[k] = 1; });
      renderDrawer();
      const tr = [...document.querySelectorAll('#dr-tracks .tr')]
        .find(x => x.querySelector('.tr-name').textContent === 'Bhāṣā-Vidyā');
      showTrack('bhasha');
      return {
        pct: progressOf(row.pathIds).pct,
        ticked: tr.classList.contains('full'),
        award: earnedNow().some(a => a.key === 'track:bhasha'),
        /* and not one enrichment card was needed to get there */
        enrichLeft: [...row.ids].filter(k => !SAVED.mastered[k]).length,
        go: document.getElementById('s-go').textContent,
      };
    });
    ok('finishing the units finishes the track',
      done.pct === 100 && done.ticked && done.award && done.enrichLeft > 0,
      done.pct + '% · ticked ' + done.ticked + ' · award ' + done.award
        + ' · ' + done.enrichLeft + ' optional cards untouched');
    ok('and the page then offers the review rather than a list',
      /^Every unit complete/.test(done.go), done.go);
    await p.close();
  }

  // ── the drawer navigates, and starts a round ───────────────────────
  {
    const p = await browser.newPage({ viewport: { width: 360, height: 740 } });
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });

    const shut = await p.evaluate(() => ({
      hidden: document.getElementById('drawer').hidden,
      label: document.getElementById('nav-label').textContent,
      noSelect: !document.querySelector('select'),
    }));
    ok('the deck dropdown is gone', shut.noSelect);
    ok('the drawer starts shut', shut.hidden);
    ok('the handle names the list in play', !!shut.label && shut.label !== 'lists', shut.label);

    // the drawer is chrome, not content: IAST there, Devanagari on the cards
    await p.click('#nav');
    const script = await p.evaluate(() => {
      openTracks.clear(); openLessons.clear(); renderDrawer();
      TRACK_ROWS.forEach(r => openTracks.add(r.track.id));
      LESSONS.forEach(L => openLessons.add(L.lesson));
      renderDrawer();
      const text = document.getElementById('drawer').textContent;
      return {
        devanagari: (text.match(/[ऀ-ॿ]+/g) || []).join(' '),
        // a curriculum stage, not the derivation stages a sandhi deck drills
        stages: (text.match(/\bstages?\b(?:\s+\d[\d–\s-]*)?/gi) || [])
          .filter(m => /\d/.test(m) || /\bthe stages?\b/i.test(m)).join(' | '),
        numbered: [...document.querySelectorAll('.ls-name, .tr-name')]
          .map(e => e.textContent).filter(t => /\d/.test(t)).join(' | '),
        subs: [...document.querySelectorAll('.tr-sub')].map(e => e.textContent),
      };
    });
    ok('no Devanagari in the drawer', !script.devanagari, script.devanagari);
    ok('no stage numbers in the drawer', !script.stages && !script.numbered,
      [script.stages, script.numbered].filter(Boolean).join(' | '));
    /* A track counts whatever it actually holds: lessons, or lists where a
       single lesson has been folded away, or cards where it comes down to one
       list. */
    ok('a track subheading ends in a count of what it holds',
      script.subs.every(t => / · \d+ (lessons?|units?|lists?|cards)$/.test(t)),
      script.subs.find(t => !/ · \d+ (lessons?|units?|lists?|cards)$/.test(t)) || '');
    await p.evaluate(() => closeDrawer());

    await p.click('#nav');
    const opened = await p.evaluate(() => ({
      open: !document.getElementById('drawer').hidden,
      veil: !document.getElementById('dveil').hidden,
      tracks: document.querySelectorAll('.tr-head').length,
      // the track and lesson holding the current list open on the way in
      lessons: document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length,
      /* the lesson holding the current list is marked, so opening the drawer
         mid-round shows where you are */
      /* the group holding the current list — a unit where the track has
         them, a lesson where it does not */
      /* A track holding one lesson folds that level away, so its lists sit
         straight under the track's own name and there is no group row to
         mark — the track head is where you are. */
      here: (() => {
        const want = (GROUP_OF.get(deckName) || {}).label;
        return [...document.querySelectorAll('.tr-body:not([hidden]) .ls-head')]
                 .some(b => b.querySelector('.ls-name').textContent === want)
            || [...document.querySelectorAll('.tr-name')]
                 .some(e => e.textContent === want);
      })(),
      cards: document.getElementById('dp-cards').textContent,
      heads: [...document.querySelectorAll('#dr-prog .dp-h')].map(x => x.textContent).join(' | '),
    }));
    ok('the handle opens the drawer', opened.open && opened.veil);
    ok('every track is a heading', opened.tracks === 8, opened.tracks + ' headings');

    /* A row that expands says so, and says which way it is facing.  Without
       it a track head looked exactly like a row that starts something. */
    const caret = await p.evaluate(() => {
      TRACK_ROWS.forEach(x => openTracks.add(x.track.id));
      renderDrawer();
      const rows = [...document.querySelectorAll('.tr-head, .ls-head')];
      const shown = b => getComputedStyle(b.querySelector('.ex-caret')).display !== 'none';
      const turn = b => getComputedStyle(b.querySelector('.ex-caret')).transform;
      const expandable = rows.filter(b => b.hasAttribute('aria-expanded'));
      const leaves = rows.filter(b => !b.hasAttribute('aria-expanded'));
      const open = expandable.find(b => b.getAttribute('aria-expanded') === 'true');
      /* shut one to compare against, without disturbing what is on screen */
      const shut = (() => {
        const b = expandable.find(x => x.getAttribute('aria-expanded') === 'true');
        if (!b) return null;
        b.setAttribute('aria-expanded', 'false');
        const t = turn(b);
        b.setAttribute('aria-expanded', 'true');
        return t;
      })();
      return { n: expandable.length,
               allShown: expandable.every(shown),
               noneOnLeaves: leaves.every(b => !shown(b)),
               leaves: leaves.length,
               turns: open && shut && turn(open) !== shut };
    });
    ok('every expandable row carries a caret', caret.n > 0 && caret.allShown,
      caret.n + ' expandable rows');
    ok('and a row with nothing to expand carries none',
      caret.noneOnLeaves, caret.leaves + ' leaf rows');
    ok('the caret turns with the row', caret.turns);
    ok('the drawer lands on the group holding the current list',
      opened.lessons > 0 && opened.here, opened.lessons + ' groups showing');
    /* The section's own statistic is lists carried to 100%, not a card count
       already folded into the figure above it. */
    ok('course progress is counted in lists, not cards',
      /^\d+ of \d+$/.test(opened.cards) && /Lists complete/.test(opened.heads),
      opened.heads + ' · ' + opened.cards);

    const reach = await p.evaluate(() => {
      /* The two gates are opened here rather than clicked through — the page
         block above tests them — so that what is left is the walk itself:
         track name -> its page, then the drawer -> lesson -> list. */
      /* The walk to test is track -> lesson -> list, so it is taken on a
         track that actually draws lessons.  A track holding one lesson folds
         that level away by design, and is checked below instead. */
      const walk = TRACK_ROWS.find(x => x.groups.length > 1);
      beginHome(); beginTrack(walk.track.id);
      openTracks.clear(); openLessons.clear(); renderDrawer();
      const before = document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length;
      const head = [...document.querySelectorAll('.tr-head')]
        .find(b => b.querySelector('.tr-name').textContent === walk.track.name);
      head.click();                                 // -> the track page
      const page = !document.getElementById('trackcard').hidden;
      openDrawer();                                 // back to the drawer
      openLessons.clear(); renderDrawer();
      const afterTrack = document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length;
      document.querySelector('.tr-body:not([hidden]) .ls-head').click();
      const afterLesson =
        document.querySelectorAll('.ls-body:not([hidden]) .dk:not(:disabled)').length;
      return { before, page, afterTrack, afterLesson };
    });
    ok('collapsed tracks hide their lessons', reach.before === 0, reach.before + ' showing');
    ok('a track name opens its page', reach.page);
    ok('and the track expands to its lessons', reach.afterTrack > 0,
      reach.afterTrack + ' lessons');
    ok('a lesson expands to its lists', reach.afterLesson > 0, reach.afterLesson + ' lists');

    await p.click('.ls-body:not([hidden]) .dk:not(.on):not(:disabled)');
    const chosen = await p.evaluate(() => ({
      shut: document.getElementById('drawer').hidden,
      deck: deckName, running: !!current,
      label: document.getElementById('nav-label').textContent,
      expected: [LESSON_LABEL[DECK_LESSON[deckName]], DECK_SHORT(deckName)].join(' · '),
      focus: document.activeElement && document.activeElement.id,
    }));
    ok('picking a deck starts its round', chosen.running, chosen.deck);
    ok('focus lands on the card, not the shut drawer',
      chosen.focus === 'card', chosen.focus);
    ok('picking a deck closes the drawer', chosen.shut);
    ok('the handle follows the choice', chosen.label === chosen.expected, chosen.label);

    // every row a finger has to hit
    const touch = await p.evaluate(() => {
      document.getElementById('nav').click();
      document.querySelectorAll('.tr-head').forEach(b => { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
      document.querySelectorAll('.ls-head').forEach(b => { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
      /* scoped to the drawer: nothing outside it is a row to hit */
      const rows = [...document.querySelectorAll('#drawer .tr-head, #drawer .ls-head, '
        + '#drawer .dk, #drawer .dr-mode, #drawer .dr-x')]
        /* a row inside a shut lesson body has no size to measure */
        .filter(b => b.offsetParent !== null);
      const r = document.getElementById('drawer').getBoundingClientRect();
      return {
        minH: Math.min(...rows.map(x => x.getBoundingClientRect().height)),
        rows: rows.length,
        fitsWidth: r.width <= 360,
        noOverflow: document.documentElement.scrollWidth <= 360,
      };
    });
    ok('every drawer row meets the 44px touch target', touch.minH >= 44,
      touch.minH + 'px over ' + touch.rows + ' rows');
    ok('the drawer fits a 360px phone', touch.fitsWidth && touch.noOverflow);
    await p.close();
  }

  // ── existing history seeds the new mastery figure, where it can ────
  {
    const p = await browser.newPage();
    await p.addInitScript(() => {
      try {
        localStorage.setItem('abhyāsaḥ', JSON.stringify({
          v: 2,
          decks: {
            // perfect, and the deck is still that size: every card was cold
            'Puruṣa-lakāra — person, tense and mood · practice': { best: [21, 21], pile: [] },
            // perfect, but set when the deck was larger — cannot be attributed
            'Vibhakti-prayoga — the case a sentence calls for · practice': { best: [9, 9], pile: [] },
            // not perfect: which cards were cold is simply not recorded
            'Saṃyoga — combine the two words · practice': { best: [19, 20], pile: [] },
          },
          trouble: {}, cleared: 0,
        }));
      } catch (e) {}
    });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const of = n => progressOf(new Set(DECKS[n].map(c => c.id)));
      return {
        v: JSON.parse(localStorage.getItem('abhyāsaḥ')).v,
        exact: of('Puruṣa-lakāra — person, tense and mood · practice'),
        resized: of('Vibhakti-prayoga — the case a sentence calls for · practice'),
        partial: of('Saṃyoga — combine the two words · practice'),
      };
    });
    ok('a perfect round on the deck as it stands seeds mastery',
      r.exact.full, r.exact.done + ' of ' + r.exact.total);
    ok('a perfect round on a smaller deck seeds nothing',
      r.resized.done === 0, r.resized.done + ' seeded');
    ok('a partial best score seeds nothing', r.partial.done === 0, r.partial.done + ' seeded');
    ok('the store is stamped v8', r.v === 8, 'v' + r.v);
    await p.close();
  }

  // ── the review and the scoreboard, opened from the drawer ─────────
  {
    const p = await open(browser);
    for (const [btn, panel, name] of [
      ['#dr-board', 'board', 'the scoreboard'],
      ['#dr-prog', 'reviewpanel', 'the abhyāsa draw'],
    ]) {
      await p.click('#nav');
      await p.click(btn);
      const r = await p.evaluate(([sel, id]) => ({
        open: panelOpen === id,
        shown: getComputedStyle(document.getElementById(id)).display !== 'none',
        drawerShut: document.getElementById('drawer').hidden,
        back: !document.getElementById('panel-back').hidden,
        marked: document.querySelector(sel).classList.contains('on'),
        cardHidden: document.getElementById('card').style.display === 'none',
      }), [btn, panel]);
      ok(name + ' opens from the drawer', r.open && r.shown && r.drawerShut, panel);
      ok(name + ' marks its row', r.marked);
      ok(name + ' offers the way back', r.back && r.cardHidden);
      await p.click('#p-back');
      const back = await p.evaluate(() => ({
        closed: panelOpen === null,
        backGone: document.getElementById('panel-back').hidden,
        cardBack: document.getElementById('card').style.display !== 'none',
      }));
      ok(name + ' closes back onto the cards', back.closed && back.backGone && back.cardBack);
    }
    await p.close();
  }

  // ── a round in progress is still guarded ───────────────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(async () => {
      reveal(); knew();                      // something graded to lose
      const was = deckName;
      const other = Object.keys(DECKS).find(n => n !== was);
      chooseDeck(other);                     // deliberately not awaited
      await new Promise(r => setTimeout(r, 0));
      const asked = !document.getElementById('ask').hidden;
      document.getElementById('ask-no').click();
      await new Promise(r => setTimeout(r, 0));
      const stayed = deckName === was;
      chooseDeck(other);
      await new Promise(r => setTimeout(r, 0));
      document.getElementById('ask-yes').click();
      await new Promise(r => setTimeout(r, 0));
      return { asked, stayed, moved: deckName === other };
    });
    ok('changing lists mid-round asks first', r.asked);
    ok('keeping going stays on the list', r.stayed);
    ok('leaving it changes the list', r.moved);
    await p.close();
  }

  // ── finding a list among 176 ───────────────────────────────────────
  // A learner who remembers a name should not have to know which track holds
  // it, and a phone keyboard does not carry ā, ṛ or ṣ.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const find = q => {
        const el = document.getElementById('dr-q');
        el.value = q;
        el.dispatchEvent(new Event('input'));
        return [...document.querySelectorAll('#dr-tracks .dk')].map(b => ({
          name: b.querySelector('.dk-name').textContent,
          sub: b.querySelector('.dk-sub').textContent,
        }));
      };
      SAVED.guided = false;            // the gate is not what is under test
      openDrawer();
      const out = { tree: document.querySelectorAll('#dr-tracks .tr-head').length };
      /* typed without diacritics, matched with them */
      const bare = find('vrtta');
      out.bare = bare.length === 1 && /^Vṛtta/.test(bare[0].name);
      /* every hit says where it lives, since the headings that would have
         said so are what the filter took away */
      out.where = bare.length === 1 && bare[0].sub.startsWith('Kāvya-Racanā');
      /* a track's own name and gloss find its lists */
      out.byTrack = find('ritual').some(x => x.sub.startsWith('Pūjā-Vāk'));
      out.none = find('zzzz').length === 0
              && /No list matches/.test(document.querySelector('.dr-found').textContent);
      out.count = (find('vrtta'), document.querySelector('.dr-found').textContent);
      /* Enter takes the first list found */
      const el = document.getElementById('dr-q');
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      out.opened = deckName;
      /* and the drawer opens on the tracks every time, never on a stale query */
      openDrawer();
      out.reopened = document.getElementById('dr-q').value === ''
                  && document.querySelectorAll('#dr-tracks .tr-head').length === out.tree
                  && !document.querySelector('.dr-found');
      return out;
    });
    ok('a list is found without its diacritics', r.bare);
    ok('and says which track and group holds it', r.where);
    ok('a track name finds the lists under it', r.byTrack);
    ok('a query that matches nothing says so', r.none);
    ok('the results are counted', /^1 list found$/.test(r.count), r.count);
    ok('Enter opens the first list found', /Vṛtta/.test(r.opened), r.opened);
    ok('the drawer opens on the tracks, never on a stale query', r.reopened);
    await p.close();
  }

  // ── the end of a round leads with one thing ────────────────────────
  // Four buttons of equal weight are four decisions, and which one is useful
  // depends on what has just happened.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const state = () => ({
        lead: [...document.querySelectorAll('#after .lead')].map(b => b.id),
        shown: [...document.querySelectorAll('#after button')]
                 .filter(b => !b.hidden).length,
        /* the pile button offers the round this screen is already offering */
        pile: !document.getElementById('pile').hidden,
        /* the toggles change how a card is shown, and none is */
        controls: document.getElementById('controls').hidden,
      });
      SAVED.mastered = {}; SAVED.decks = {};
      beginHome(); beginTrack('bhasha');
      const names = trackDecks(TRACK_ROWS.find(x => x.track.id === 'bhasha'));
      const out = {};
      /* a round with misses leads with clearing them up */
      loadDeck(names[0]);
      while (current) didntKnow();
      out.missed = state();
      /* a clean round has nothing to clear, so the next list leads */
      loadDeck(names[1]);
      while (current) knew();
      out.clean = state();
      /* and the toggles come back with the next round */
      document.getElementById('restart').click();
      out.playing = document.getElementById('controls').hidden;
      return out;
    });
    ok('a round with misses leads with practising them',
      r.missed.lead.length === 1 && r.missed.lead[0] === 'again-missed',
      JSON.stringify(r.missed.lead));
    ok('a clean round leads with the next list',
      r.clean.lead.length === 1 && r.clean.lead[0] === 'next-list',
      JSON.stringify(r.clean.lead));
    ok('exactly one button leads, whatever else is offered',
      r.missed.shown > 1 && r.clean.shown > 1,
      r.missed.shown + ' and ' + r.clean.shown + ' offered');
    ok('the missed pile stands down while the results offer the same round',
      !r.missed.pile);
    ok('the results screen puts the card toggles away',
      r.missed.controls && r.clean.controls);
    ok('and the next round gets them back', !r.playing);
    await p.close();
  }

  // ── the shell holds the screen, and the card holds the shell ──────
  // Installed, this page IS the app: there is no browser chrome around it,
  // so the exercise has to fill the screen without the page scrolling and
  // the two buttons pressed on every card have to land where a thumb is.
  {
    for (const [w, h] of [[360, 640], [390, 844], [430, 932]]) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
      await p.goto(FILE, { waitUntil: 'load' });
      const r = await p.evaluate(() => {
        const box = s => document.querySelector(s).getBoundingClientRect();
        const cardH = () => Math.round(box('.card').height);
        const out = {};
        /* a deck of nothing but reveal cards: the grade row is what appears
           when the answer does, and it is what must not move anything */
        loadDeck(Object.keys(DECKS).find(n =>
          DECKS[n].every(c => (c.type || 'reveal') === 'reveal')));
        out.front = cardH();
        const ctlBefore = Math.round(box('.controls').top);
        reveal();
        out.back = cardH();
        out.ctlMoved = Math.round(box('.controls').top) - ctlBefore;
        const g = box('#miss');
        out.gradeW = Math.round(g.width);
        out.gradeH = Math.round(g.height);
        /* how far down the screen the most-tapped control sits */
        out.gradeAt = g.bottom / innerHeight;
        out.fills = box('.card').height / innerHeight;
        out.scrolls = document.body.scrollHeight > innerHeight + 1;
        out.sideways = document.documentElement.scrollWidth > innerWidth + 1;
        return out;
      });
      const at = ' at ' + w + '×' + h;
      ok('the exercise fills the screen without scrolling it' + at,
        !r.scrolls && !r.sideways && r.fills > 0.4,
        Math.round(r.fills * 100) + '% of the height');
      ok('revealing an answer moves nothing' + at,
        r.front === r.back && r.ctlMoved === 0,
        r.front + 'px vs ' + r.back + 'px, toggles moved ' + r.ctlMoved);
      ok('the grade buttons are a thumb\u2019s reach from the foot' + at,
        r.gradeAt > 0.7 && r.gradeH >= 44 && r.gradeW >= 64,
        Math.round(r.gradeAt * 100) + '% down, ' + r.gradeW + '×' + r.gradeH);
      await p.close();
    }
  }

  // ── it installs, and it opens with no network ─────────────────────
  // The page has always been offline-capable from file://.  What is checked
  // here is the other half of being an app: SERVED, it hands a launcher a
  // manifest it can install, and it opens again with the network gone.
  {
    const http = require('http');
    const fs = require('fs');
    const DIST = path.resolve(__dirname, '..', 'dist');
    const TYPES = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8' };
    const server = http.createServer((req, res) => {
      const f = path.join(DIST, req.url.split('?')[0] === '/' ? 'abhyasah.html' : req.url.split('?')[0]);
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port + '/';

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(base, { waitUntil: 'load' });

    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Page.enable');
    const got = await cdp.send('Page.getAppManifest');
    let man = null;
    try { man = JSON.parse(got.data || 'null'); } catch (e) { /* reported below */ }
    ok('the manifest parses, with nothing wrong in it',
      !!man && !(got.errors || []).length, JSON.stringify(got.errors || []));
    ok('it asks to run as an app, in its own colours',
      man && man.display === 'standalone' && man.theme_color === '#1c1712'
        && man.background_color === '#1c1712',
      man && [man.display, man.theme_color].join(' '));
    /* Chrome refuses to install without a start_url it can resolve, and a
       manifest carried as a data: URI has no address for a relative one to
       resolve against — so the page writes its own in. */
    ok('and names where it starts', man && man.start_url === base,
      man && String(man.start_url));
    ok('the icons travel with it, at the sizes a launcher asks for',
      man && ['192x192', '512x512'].every(sz =>
        man.icons.some(i => i.sizes === sz && /^data:image\/png/.test(i.src)))
        && man.icons.some(i => i.purpose === 'maskable'),
      man && man.icons.map(i => i.sizes + ' ' + (i.purpose || 'any')).join(' · '));
    /* whatever else is wrong, it must not be the page's own doing */
    const why = await cdp.send('Page.getInstallabilityErrors')
      .then(x => x.installabilityErrors.map(e => e.errorId).filter(e => e !== 'in-incognito'))
      .catch(() => []);
    ok('nothing in the page stands in the way of installing it',
      !why.length, why.join(', '));

    const sw = await p.evaluate(() =>
      navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
    ok('the offline shell registers itself', sw);

    /* the round trip that matters: cache filled, network gone, app back */
    await p.reload({ waitUntil: 'load' });
    await ctx.setOffline(true);
    await p.reload({ waitUntil: 'load' });
    const offline = await p.evaluate(() => {
      loadDeck(Object.keys(DECKS)[0]);
      return { decks: Object.keys(DECKS).length,
               theory: Object.keys(THEORY).length,
               card: document.getElementById('dn').textContent };
    });
    ok('and it opens again with no network at all',
      offline.decks === EXPECTED.decks && offline.theory > 0 && !!offline.card,
      offline.decks + ' lists, ' + offline.theory + ' theory');
    await ctx.setOffline(false);
    await ctx.close();
    server.close();
  }

  await browser.close();
  console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(', ')}` : '\nall checks passed');
  process.exit(fail.length ? 1 : 0);
})();
