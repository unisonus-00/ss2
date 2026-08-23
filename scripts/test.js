#!/usr/bin/env node
/* Regression tests for the built distributable.
 *
 * These guard the compatibility list in CLAUDE.md — saved progress, trouble
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
const DECK = 'Person, tense and mood — practice';

/* Expected counts come from the practice files themselves, so adding a
   lesson's practice does not break the suite — what is checked is that the
   build carried across everything the sources declare. */
const EXPECTED = (() => {
  const fs = require('fs');
  const root = path.resolve(__dirname, '..');
  const files = [];
  for (const d of fs.readdirSync(root).sort()) {
    if (/^\d\d-/.test(d) && fs.existsSync(path.join(root, d, 'practice.json')))
      files.push(path.join(root, d, 'practice.json'));
  }
  if (fs.existsSync(path.join(root, 'practice.json'))) files.push(path.join(root, 'practice.json'));
  let decks = 0, cards = 0;
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const d of j.decks) { decks++; cards += d.cards.length; }
  }
  return { lessons: files.length, decks, cards };
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
    ok('groups are curriculum-ordered',
      JSON.stringify(r.groups.slice(0, 4)) ===
      JSON.stringify(['Nāma', 'Varṇa-Vidyā', 'Sandhi', 'Guṇa']),
      r.groups.slice(0, 4).join(' | '));
    ok('cross-cutting practice comes last',
      r.groups[r.groups.length - 1] === 'Vyākaraṇam',
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

  // ── 3. trouble history migrates off the old text key ──────────────
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
        clearedKept: raw.cleared,
      };
    });
    // the chain runs to the end, not just to the step under test
    ok('saved state runs the whole migration chain', r.version === 4, 'v' + r.version);
    ok('old text key removed', r.oldGone);
    ok('record moved onto the stable id', r.newRec && r.newRec.w === 3, JSON.stringify(r.newRec));
    ok('per-deck best score untouched', r.deckBestKept && r.deckBestKept.best === 12, JSON.stringify(r.deckBestKept));
    ok('cleared tally untouched', r.clearedKept === 4);
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

  // ── a wrong tap grades as didntKnow() and feeds trouble ───────────
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
    ok('trouble strike recorded against the card id',
      after.trouble[before.id] && after.trouble[before.id].w === 1,
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
      const mix = [...DECKS['Person, tense and mood — practice'].slice(0, 3),
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

  
  // ── choice cards feed review and the trouble drill ────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      // fail a short round outright
      startRound(DECKS['Person, tense and mood — practice'].slice(0, 3), {});
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
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const card = DECKS['Person, tense and mood — practice'][0];
      SAVED.trouble[card.id] = { w: 3, r: 0, s: '' }; save();
      const onList = troubleCards().some(c => c.id === card.id);
      startTroubleDrill();
      const drill = { started: !!current,
                      isChoice: document.getElementById('card').classList.contains('choice') };
      const k = current.card.id;
      [...document.querySelectorAll('#choices .opt')].find(x => x.textContent === current.card.answer).click();
      document.getElementById('g-next').click();
      return { onList, drill, rec: SAVED.trouble[k] };
    });
    ok('a missed choice card reaches the trouble list', r.onList);
    ok('the trouble drill renders choice cards', r.drill.started && r.drill.isChoice);
    ok('a right answer in the drill counts towards clearing',
      r.rec && r.rec.r === 1, JSON.stringify(r.rec));
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
  const SEQ = 'Derivation — order the stages';
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
    ok('and records a trouble strike', r.trouble && r.trouble.w === 1, JSON.stringify(r.trouble));
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
      const d = DECKS['Roles in a sentence — practice'] || [];
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
        cleared: raw.cleared,
        staleKept: !!raw.trouble[g],
        pile: pileCards().length,
        trouble: troubleCards().length,
      };
    }, GONE);
    ok('a removed card keeps its trouble record', r.staleKept);
    ok('a best score set on the old, larger deck survives',
      r.best && r.best[0] === 55 && r.best[1] === 61, JSON.stringify(r.best));
    ok('the cleared tally survives curation', r.cleared === 7);
    ok('stale pile keys resolve to nothing rather than breaking', r.pile === 0);
    ok('stale trouble keys do not enter the drill', r.trouble === 0);
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
      const table = [];
      Object.keys(DECKS).forEach(n => {
        if (n.startsWith('Table mastery')) table.push(...DECKS[n]);
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

      const conj = [];
      Object.keys(DECKS).forEach(n => {
        if (n.startsWith('Conjugation mastery')) conj.push(...DECKS[n]);
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
               roots: Object.keys(byRoot).length, shortRoots, conj: conj.length, dupes };
    });
    ok('every declension stem covers all 24 cells',
      r.stems === 9 && r.incomplete.length === 0, r.stems + ' stems; short: ' + r.incomplete.join(', '));
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
        moved: raw.decks['Case and form — practice'],
        movedKriya: raw.decks['Person, tense and mood — practice'],
        oldGone: !raw.decks['Rūpa practice — case and form'],
        lastDeckMoved: raw.deck === 'Case and form — practice',
        finished: finishedDecks().length,
      };
    });
    ok('a renamed deck keeps its best score',
      r.moved && r.moved.best[0] === 13 && r.movedKriya && r.movedKriya.best[0] === 18,
      JSON.stringify(r.moved && r.moved.best));
    ok('the old deck name is cleared away', r.oldGone);
    ok('the remembered deck follows the rename', r.lastDeckMoved);
    ok('both renamed decks still count as finished', r.finished === 2, r.finished + ' finished');

    // the draw must spread across lists, not pour out of the biggest one
    const spread = await p.evaluate(() => {
      const counts = [];
      for (let i = 0; i < 25; i++) {
        const drawn = mixCards();
        const fromTable = drawn.filter(c =>
          (DECK_OF.get(c) || '').startsWith('Table mastery')).length;
        counts.push(fromTable / drawn.length);
      }
      return { worst: Math.max(...counts), size: mixCards().length };
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
             wrapper holding a lesson heading */
          kids: body ? [...body.children].map(c =>
            (c.matches('.dk, .ls-head') ? c : c.querySelector('.ls-head'))
              .querySelector('.dk-name, .ls-name').textContent) : [],
        };
      });
      return {
        rows,
        /* the levels are folded from what exists, not from a hardcoded list */
        derived: typeof soleLesson === 'function' && typeof soleDeck === 'function',
        singleLessonTracks: TRACK_ROWS.filter(x => x.lessons.length === 1)
          .map(x => x.track.name),
        singleDeckLessons: LESSONS.filter(L => L.decks.length === 1).map(L => L.label),
      };
    });

    // a track whose one lesson repeats its own name must not show it twice
    const dup = r.rows.filter(x => x.kids.includes(x.name));
    ok('no track repeats its own name one level down', !dup.length,
      dup.map(x => x.name).join(' | '));

    // a track that comes down to a single list is that list
    const leaves = r.rows.filter(x => x.leaf).map(x => x.name);
    ok('a track of one list is the list itself',
      leaves.includes('Svara-Vidyā') && leaves.includes('Avadhāna'), leaves.join(' | '));

    // a track with one lesson shows that lesson's lists directly
    const puja = r.rows.find(x => x.name === 'Pūjā-Vāk');
    ok('a track of one lesson shows its lists directly',
      puja && puja.kids.length === 11 && !puja.kids.includes('Pūjā-Vāk'),
      puja ? puja.kids.length + ' rows' : 'missing');

    // a lesson holding one list is that list, not a heading over it
    const kavya = r.rows.find(x => x.name === 'Kāvya-Racanā');
    ok('a lesson of one list is the list itself',
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
      return { landed: raw.decks['Person, tense and mood — practice'],
               oldGone: !raw.decks['Kriyā practice — person, tense and mood']
                     && !raw.decks['Practice — person, tense and mood'],
               deck: raw.deck };
    });
    ok('a score survives two renames in one chain',
      r.landed && r.landed.best[0] === 17, JSON.stringify(r.landed));
    ok('and leaves no stale key behind', r.oldGone);
    ok('the remembered list follows the whole chain',
      r.deck === 'Person, tense and mood — practice', r.deck);
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
  // and they repainted the palm-leaf card a muddy olive with inverted text.
  // Nothing in the cascade changes when they do it — getComputedStyle still
  // reports the right colour — so this reads the pixel that was painted.
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
    const LEAF = [233, 220, 190];          // --leaf, #e9dcbe

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
      ok('the card is painted --leaf with the browser ' + tag,
        got.every((v, i) => Math.abs(v - LEAF[i]) <= 2), 'rgb(' + got.join(', ') + ')');
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
      (DECKS['Pratyāhāras — practice'] || []).filter(c =>
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
      'Form mastery · Śiva — all 24 cells': mA,
      'Form mastery · Phala — all 24 cells':
        table('Neuter -a (phala, puṣpa, jala)', 'phala', 1, table('Masculine -a (deva, śiva, rāma)', 'phala', 1)),
      'Form mastery · Mālā — all 21 cells': table('Feminine -ā (mālā, gaṅgā, latā)', 'mālā', 1),
      'Form mastery · Devī — all 21 cells': table('Feminine -ī (nadī, devī, lakṣmī)', 'devī', 1),
      'Form mastery · Agni — all 21 cells': table('Masculine -i (agni, muni)', 'agni', 1),
      'Form mastery · Viṣṇu — all 21 cells': table('Masculine -u (viṣṇu, guru)', 'viṣṇu', 1),
      'Form mastery · Pitṛ — all 21 cells': table('Ṛ-stem (mātṛ, pitṛ, kartṛ)', 'pitṛ', 1),
      'Form mastery · Bhagavat — all 21 cells': table('Consonant-stem -at (bhagavat, mahat)', 'bhagavat', 2),
      'Form mastery · Asmad — the first person': pron(REF, 'Pronoun: asmad (1st person)'),
      'Form mastery · Yuṣmad — the second person': pron(REF, 'Pronoun: yuṣmad (2nd person)'),
      'Form mastery · Saḥ — tad, masculine': tadM,
      'Form mastery · Sā — tad, feminine': pron(REF, 'Pronoun: tad (3rd person, feminine)'),
      'Form mastery · Tat — tad, neuter': pron(BRICKS, 'Napuṃsakaliṅga (Neuter)', tadM),
    };

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
      // every cell the source supplies is asked for
      const wanted = [];
      Object.keys(want).forEach(v => want[v].forEach((f, n) => { if (f) wanted.push(v + ':' + n); }));
      const missing = wanted.filter(k => !cells.has(k));
      if (missing.length) bad.push(name + ': never asks ' + missing.join(','));
      covered[name] = cells.size;
    });

    ok('every produced form is the one Stage 5 tables', !bad.length, bad.slice(0, 5).join(' | '));
    ok('every cell the source supplies is asked for',
      Object.values(covered).every(n => n >= 21), JSON.stringify(covered));
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
      const DECK = 'Form mastery · Devī — all 21 cells';
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
      loadDeck('Table mastery · Rāma — a-stem, all 24 cells');
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
        .filter(([, cs]) => cs.length < 4).map(([n, cs]) => n + ':' + cs.length);
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
                  'V09 · Anger and fear — DM · LS': { best: [12, 16], pile: [] } },
         review: { runs: 4, right: 63, seen: 80 }, trouble: {}, cleared: 2, mastered: {} });
    await p.goto(FILE, { waitUntil: 'load' });

    const rows = await p.evaluate(() => [...document.querySelectorAll('.dr-mode')].map(x => ({
      name: x.querySelector('.dm-name').textContent,
      sub: x.querySelector('.dm-sub').textContent,
    })));
    /* Abhyāsa is lifted out of the mode rows into the section the drawer
       opens with; what is left is named in English. */
    ok('the mode rows are named in English',
      JSON.stringify(rows.map(r => r.name)) ===
        JSON.stringify(['Scoreboard', 'Trouble cards']),
      rows.map(r => r.name).join(' | '));
    ok('the scoreboard row counts what it holds',
      /\d+ of \d+ lists completed/.test(rows[0].sub), rows[0].sub);
    ok('the trouble row says what is on the list',
      /cleared/.test(rows[1].sub), rows[1].sub);

    // and every one of them still opens and renders
    for (const [btn, id, want] of [
      ['#dr-board', 'board', /lists completed/],
      ['#dr-prog', 'reviewpanel', /Reviewing \d+ cards from \d+ completed lists?/],
      ['#dr-trouble', 'trouble', /cleared/],
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
  // Study preserves the reference essentially verbatim: it may strip the
  // markup that makes a heading a heading, and nothing else.  Checked line by
  // line against the source rather than by eye, because a renderer that
  // quietly eats a table row would look perfectly fine on screen.
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
      const f = path.join(root, d, 'reference.md');
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
    ok('the Study renderer loses no reference text', !lost.length,
      lost.length ? lost.slice(0, 3).join(' | ')
                  : fragments + ' fragments across ' + files + ' references');
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
      SAVED.decks = {};
      small.forEach(n => {
        SAVED.decks[n] = { best: [DECKS[n].length, DECKS[n].length], pile: [] };
      });
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

  // ── the results say which lists held up ───────────────────────────
  // A review crosses lists, so "which cards went wrong" is the wrong
  // question at the end of one; the learner-facing unit is the list.
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      const small = Object.keys(DECKS).filter(n => DECKS[n].length <= 15).slice(0, 5);
      SAVED.decks = {};
      small.forEach(n => {
        SAVED.decks[n] = { best: [DECKS[n].length, DECKS[n].length], pile: [] };
      });
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
               patra: (() => { const d = document.createElement('div');
                 d.style.color = 'var(--patra)'; document.body.appendChild(d);
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
      r.rows.some(x => x.full && x.verdict === 'strong') && r.strongInk === r.patra,
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
      const acc = (right, seen) => { SAVED.review = { runs: 1, right: right, seen: seen }; };
      /* a list enters review by being completed, which is what records a best */
      const complete = names => {
        SAVED.decks = {};
        names.forEach(n => { SAVED.decks[n] = { best: [DECKS[n].length, DECKS[n].length], pile: [] }; });
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
      /^Complete more lists — \d+ of \d+ cards so far$/.test(r.unranked.card),
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
    ok('and what it is drawing on',
      /^Reviewing \d+ cards from \d+ completed lists?$/.test(r.panelWhat), r.panelWhat);
    ok('the explanation describes the mode, not the arithmetic',
      /^Abhyāsa checks how well your studied material is holding up over time\./
        .test(r.panelNote)
        && /return later/.test(r.panelNote) && /return\s+sooner/.test(r.panelNote)
        && !/[×x] \d/.test(r.panelNote),
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

      openPanel('trouble');
      out.troubleRows = rows();
      closePanel();

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
    ok('so does the trouble drill', leads(r.troubleRows, 't-actions'),
      r.troubleRows.join(' | '));
    ok('unlocked and unused, the card says what it draws on',
      /^Reviewing \d+ cards from \d+ completed lists?$/.test(r.cardBefore),
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

  // ── Study: the lesson's reference, and nothing more ───────────────
  // A reference VIEWER, not a second learning system.  It shows the lesson's
  // own reference.md, rendered at build time and inlined, and it holds no
  // cards, tracks nothing and grades nothing.
  {
    const p = await open(browser, { viewport: { width: 360, height: 740 } });
    const r = await p.evaluate(() => {
      const el = id => document.getElementById(id);
      const out = {};

      /* a lesson that has one: the button is offered and opens its reference */
      loadDeck('S \u00b7 Ac sandhi — vowel joins');
      out.offered = !el('study-btn').hidden;
      el('study-btn').click();
      const body = el('st-body');
      out.opened = el('study').style.display === 'block';
      out.title = el('st-title').textContent;
      out.tables = body.querySelectorAll('table').length;
      out.pre = body.querySelectorAll('pre').length;
      /* the file's own h1 is the panel heading, so it is not repeated below */
      out.h1 = body.querySelectorAll('h1').length;
      /* it reads inside itself rather than pushing the app off the bottom */
      out.scrolls = body.scrollHeight > body.clientHeight + 10;
      out.sideways = document.documentElement.scrollWidth > window.innerWidth;
      out.back = !el('panel-back').hidden;
      /* a long reference gets a contents list, and it addresses real headings */
      out.toc = [...document.querySelectorAll('.st-link')].length;
      out.tocHits = [...document.querySelectorAll('.st-body h2')].length;
      /* Study holds no exercise: no card, no grading, no toggles */
      out.noCard = el('card').style.display === 'none'
                && el('grade').hidden && el('controls').hidden;

      /* and closing it puts the round back exactly as it was */
      const was = el('dn').textContent;
      el('p-back').click();
      out.restored = el('dn').textContent === was && el('card').style.display !== 'none';

      /* a short reference gets no contents list */
      loadDeck(Object.keys(DECKS).find(n => DECK_LESSON[n] === '09-dhatu'));
      el('study-btn').click();
      out.shortToc = el('st-toc').hidden;
      el('p-back').click();

      /* hidden where there is nothing to look up */
      const cross = Object.keys(DECKS).find(n => DECK_LESSON[n] === '00-overview');
      loadDeck(cross);
      out.hiddenNoRef = el('study-btn').hidden;
      startMixedReview();
      out.hiddenMixed = el('study-btn').hidden;

      /* every loaded lesson with a reference offers one, and none is empty */
      const empty = [];
      Object.keys(REFERENCES).forEach(k => {
        if (!REFERENCES[k].html || REFERENCES[k].html.length < 200) empty.push(k);
      });
      out.refs = Object.keys(REFERENCES).length;
      out.empty = empty;
      return out;
    });

    ok('Study is offered for a lesson that has a reference', r.offered);
    ok('and opens that lesson\'s reference', r.opened && r.tables >= 3, r.tables + ' tables');
    ok('titled from the lesson, not the file\'s own heading',
      r.title === 'Sandhi', JSON.stringify(r.title));
    ok('the file heading is not repeated inside it', r.h1 === 0);
    ok('it reads inside itself, not down the page', r.scrolls && !r.sideways);
    ok('a long reference gets a contents list', r.toc >= 5 && r.toc <= r.tocHits,
      r.toc + ' of ' + r.tocHits + ' sections');
    ok('a short one does not', r.shortToc);
    ok('Study holds no exercise', r.noCard);
    ok('and leaves the round untouched', r.restored && r.back);
    ok('hidden where there is nothing to look up',
      r.hiddenNoRef && r.hiddenMixed);
    ok('every carried reference has content', !r.empty.length,
      r.refs + ' references' + (r.empty.length ? ', empty: ' + r.empty.join(', ') : ''));
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
    ok('nothing but stage 0 is cross-cutting',
      r.crossStages.every(n => n === 0), r.crossStages.join(', '));
    await p.close();
  }

  // ── progress is counted from cards, at every level ─────────────────
  {
    const p = await open(browser);
    const r = await p.evaluate(() => {
      // master every card of the smallest lesson, and nothing else
      const small = LESSONS.slice().sort((a, b) => a.ids.size - b.ids.size)[0];
      small.ids.forEach(k => { SAVED.mastered[k] = 1; });
      save();
      const row = TRACK_ROWS.find(x => x.lessons.includes(small));
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
      const deck = DECKS['Person, tense and mood — practice'];
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
      script.subs.every(t => / · \d+ (lessons?|lists?|cards)$/.test(t)),
      script.subs.find(t => !/ · \d+ (lessons?|lists?|cards)$/.test(t)) || '');
    await p.evaluate(() => closeDrawer());

    await p.click('#nav');
    const opened = await p.evaluate(() => ({
      open: !document.getElementById('drawer').hidden,
      veil: !document.getElementById('dveil').hidden,
      tracks: document.querySelectorAll('.tr-head').length,
      // the track and lesson holding the current list open on the way in
      lessons: document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length,
      decks: document.querySelectorAll('.ls-body:not([hidden]) .dk').length,
      cards: document.getElementById('dp-cards').textContent,
      heads: [...document.querySelectorAll('#dr-prog .dp-h')].map(x => x.textContent).join(' | '),
    }));
    ok('the handle opens the drawer', opened.open && opened.veil);
    ok('every track is a heading', opened.tracks === 6, opened.tracks + ' headings');
    ok('the drawer lands on the current lesson', opened.lessons > 0 && opened.decks > 0,
      opened.lessons + ' lessons, ' + opened.decks + ' decks');
    /* The section's own statistic is lists carried to 100%, not a card count
       already folded into the figure above it. */
    ok('course progress is counted in lists, not cards',
      /^\d+ of \d+$/.test(opened.cards) && /Lists complete/.test(opened.heads),
      opened.heads + ' · ' + opened.cards);

    const reach = await p.evaluate(() => {
      // shut everything, then walk down: track -> lesson -> deck
      openTracks.clear(); openLessons.clear(); renderDrawer();
      const before = document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length;
      document.querySelector('.tr-head').click();
      const afterTrack = document.querySelectorAll('.tr-body:not([hidden]) .ls-head').length;
      document.querySelector('.tr-body:not([hidden]) .ls-head').click();
      const afterLesson = document.querySelectorAll('.ls-body:not([hidden]) .dk').length;
      return { before, afterTrack, afterLesson,
               name: document.querySelector('.ls-body:not([hidden]) .dk').title };
    });
    ok('collapsed tracks hide their lessons', reach.before === 0, reach.before + ' showing');
    ok('a track expands to its lessons', reach.afterTrack > 0, reach.afterTrack + ' lessons');
    ok('a lesson expands to its decks', reach.afterLesson > 0, reach.afterLesson + ' decks');

    await p.click('.ls-body:not([hidden]) .dk');
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
      const rows = [...document.querySelectorAll('.tr-head, .ls-head, .dk, .dr-mode, .dr-x')];
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
            'Person, tense and mood — practice': { best: [21, 21], pile: [] },
            // perfect, but set when the deck was smaller — cannot be attributed
            'Case and form — practice': { best: [9, 9], pile: [] },
            // not perfect: which cards were cold is simply not recorded
            'Joins — practice, combine the two words': { best: [19, 20], pile: [] },
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
        exact: of('Person, tense and mood — practice'),
        resized: of('Case and form — practice'),
        partial: of('Joins — practice, combine the two words'),
      };
    });
    ok('a perfect round on the deck as it stands seeds mastery',
      r.exact.full, r.exact.done + ' of ' + r.exact.total);
    ok('a perfect round on a smaller deck seeds nothing',
      r.resized.done === 0, r.resized.done + ' seeded');
    ok('a partial best score seeds nothing', r.partial.done === 0, r.partial.done + ' seeded');
    ok('the store is stamped v4', r.v === 4, 'v' + r.v);
    await p.close();
  }

  // ── review, trouble and the scoreboard, opened from the drawer ─────
  {
    const p = await open(browser);
    for (const [btn, panel, name] of [
      ['#dr-board', 'board', 'the scoreboard'],
      ['#dr-prog', 'reviewpanel', 'the abhyāsa draw'],
      ['#dr-trouble', 'trouble', 'trouble cards'],
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

  await browser.close();
  console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(', ')}` : '\nall checks passed');
  process.exit(fail.length ? 1 : 0);
})();
