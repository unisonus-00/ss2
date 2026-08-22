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
const DECK = 'Kriyā practice — person, tense and mood';

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
  await p.evaluate(d => {
    const s = document.getElementById('deck');
    s.value = d; s.dispatchEvent(new Event('change'));
  }, DECK);
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
      groups: [...document.querySelectorAll('#deck optgroup')].map(g => g.label),
      options: document.querySelectorAll('#deck option').length,
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
    ok('picker grouped by lesson', r.groups.length === EXPECTED.lessons,
      r.groups.length + ' of ' + EXPECTED.lessons + ' lessons');
    ok('groups are curriculum-ordered',
      JSON.stringify(r.groups.slice(0, 4)) ===
      JSON.stringify(['1 · Nāma', '2 · Varṇa-Vidyā', '3 · Sandhi', '4 · Guṇa']),
      r.groups.slice(0, 4).join(' | '));
    ok('cross-cutting practice comes last',
      r.groups[r.groups.length - 1] === 'Vyākaraṇam · cross-cutting',
      r.groups[r.groups.length - 1]);
    ok('all decks in the picker', r.options === EXPECTED.decks, r.options + ' of ' + EXPECTED.decks);
    console.log('        groups: ' + r.groups.join(' | '));
    await p.close();
  }

  // ── 2. a full round still works ───────────────────────────────────
  {
    const p = await browser.newPage();
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const sel = document.getElementById('deck');
      const first = [...sel.options].find(o => o.value && !o.value.startsWith('¦'));
      sel.value = first.value; sel.dispatchEvent(new Event('change'));
      const started = !!current, q0 = queue.length;
      reveal();
      knew();
      const afterKnew = { learned, q: queue.length };
      didntKnow();
      const afterMiss = { missed: missed.length };
      return { deck: first.value, started, q0, afterKnew, afterMiss };
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
    ok('saved state bumped to v2', r.version === 2, 'v' + r.version);
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
      const sel = document.getElementById('deck');
      const first = [...sel.options].find(o => o.value && !o.value.startsWith('¦'));
      sel.value = first.value; sel.dispatchEvent(new Event('change'));
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
    ok('prompt is the transformation', /→|which analysis/.test(r.prompt), JSON.stringify(r.prompt));
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
      const mix = [...DECKS['Kriyā practice — person, tense and mood'].slice(0, 3),
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
      startRound(DECKS['Kriyā practice — person, tense and mood'].slice(0, 3), {});
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
      const card = DECKS['Kriyā practice — person, tense and mood'][0];
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
      const name = 'Sandhi practice — joins and splits';
      const d = DECKS[name];
      if (!d) return { missing: true };
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
      return { kinds, bad: bad.map(c => c.id), joinPrompt, joinNote, splitPrompt, splitOpts,
               stage: DECK_STAGE[name], lesson: DECK_LESSON[name] };
    });
    ok('the sandhi practice deck is present', !r.missing);
    ok('it sits in lesson 03-sandhi', r.lesson === '03-sandhi' && r.stage === 3,
      r.lesson + ' / stage ' + r.stage);
    ok('every sandhi card is a well-formed choice', r.bad && r.bad.length === 0, (r.bad || []).join(', '));
    ok('it covers joins, splits, naming and category',
      r.kinds && r.kinds.join >= 15 && r.kinds.split >= 5 && r.kinds.name >= 3 && r.kinds.category >= 2,
      JSON.stringify(r.kinds));
    ok('a join card asks for the combination',
      / \+ .*→ \?$/.test(r.joinPrompt), JSON.stringify(r.joinPrompt));
    ok('a join card names its rule on the answer',
      /sandhi|guṇa|vṛddhi|savarṇa|yan|jaśtva|anusvāra|anunāsika|śchutva|ādeśa|lopa/i.test(r.joinNote),
      JSON.stringify(r.joinNote));
    ok('a split card asks where a form came from',
      /came from \?$/.test(r.splitPrompt), JSON.stringify(r.splitPrompt));
    ok('split options are word pairs',
      r.splitOpts && r.splitOpts.every(o => o.includes(' + ')), JSON.stringify(r.splitOpts));
    await p.close();
  }

  // ── sequence: assemble supplied pieces by tapping ─────────────────
  const SEQ = 'Vākya sentences — build in order';
  const openSeq = async (id) => {
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.evaluate(([deck, cid]) => {
      const s = document.getElementById('deck');
      s.value = deck; s.dispatchEvent(new Event('change'));
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
    // wrong order grades as didntKnow() and shows the answer
    const p = await openSeq('12-vakya:sentence:mata-grhe');
    const r = await p.evaluate(() => {
      const c = current.card;
      const reversed = c.answer.slice().reverse();
      reversed.forEach(w =>
        [...document.querySelectorAll('#bank .chip')].find(x => x.textContent === w).click());
      document.getElementById('s-check').click();
      const gloss = document.getElementById('gloss').textContent;
      const wrong = document.querySelectorAll('#built .chip.wrong').length;
      const id = c.id;
      document.getElementById('g-next').click();
      return { gloss, wrong, missed: missed.length, learned,
               trouble: JSON.parse(localStorage.getItem('abhyāsaḥ')).trouble[id] };
    });
    ok('a wrong order is marked wrong', r.wrong > 0, r.wrong + ' pieces');
    ok('a wrong order spells the answer out',
      r.gloss === 'mātā gṛhe bhojanaṃ pacati', JSON.stringify(r.gloss));
    ok('a wrong order joins the missed pile', r.missed === 1 && r.learned === 0);
    ok('a wrong order records a trouble strike',
      r.trouble && r.trouble.w === 1, JSON.stringify(r.trouble));
    await p.close();
  }

  {
    // keyboard, and shuffling
    const p = await openSeq();
    await p.evaluate(() => document.getElementById('card').blur());
    await p.keyboard.press('1');
    await p.keyboard.press('1');
    const placed = await p.evaluate(() => document.querySelectorAll('#built .chip').length);
    ok('number keys place pieces', placed === 2, placed + ' placed');
    await p.keyboard.press('Backspace');
    const afterBs = await p.evaluate(() => document.querySelectorAll('#built .chip').length);
    ok('Backspace takes one back', afterBs === 1);
    const orders = await p.evaluate(() => {
      const seen = new Set();
      for (let i = 0; i < 30; i++) {
        seqOrder = null;
        seqBuilt = [];
        drawSequence(current.card);
        seen.add([...document.querySelectorAll('#bank .chip')].map(c => c.textContent).join('|'));
      }
      return seen.size;
    });
    ok('bank order varies between showings', orders > 1, orders + ' distinct orders');
    await p.close();
  }

  {
    // mobile
    const p = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await p.goto(FILE, { waitUntil: 'load' });
    await p.evaluate(d => {
      const s = document.getElementById('deck');
      s.value = d; s.dispatchEvent(new Event('change'));
      startRound([DECKS[d].find(c => c.parts && c.parts.length === 4)], {});
    }, SEQ);
    const r = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('#bank .chip')];
      return {
        minH: Math.min(...chips.map(c => c.getBoundingClientRect().height)),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        fits: chips.every(c => c.getBoundingClientRect().right <= window.innerWidth),
      };
    });
    ok('chips meet the 44px touch target', r.minH >= 44, r.minH + 'px');
    ok('no horizontal overflow with four chips', !r.overflow && r.fits);
    await p.close();
  }

  // ── Milestone 7 decks: Guṇa, Rūpa, Kāraka ─────────────────────────
  {
    const specs = [
      ['Guṇa practice — agreement', '04-guna', 4, 11],
      ['Rūpa practice — case and form', '05-rupa', 5, 15],
      ['Kāraka practice — roles in a sentence', '07-karaka', 7, 11],
    ];
    const p = await browser.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR ' + e.message); fail.push('pageerror'); });
    await p.goto(FILE, { waitUntil: 'load' });
    const r = await p.evaluate(ss => ss.map(([deck, lesson, stage, n]) => {
      const d = DECKS[deck];
      if (!d) return { deck, missing: true };
      const bad = d.filter(c => c.type !== 'choice' || !c.options.includes(c.answer)
        || new Set(c.options).size !== c.options.length || !c.note || !c.source);
      return { deck, lesson: DECK_LESSON[deck], stage: DECK_STAGE[deck],
               n: d.length, wantLesson: lesson, wantStage: stage, wantN: n,
               bad: bad.map(c => c.id) };
    }), specs);
    r.forEach(x => {
      ok('deck present: ' + x.deck, !x.missing);
      if (x.missing) return;
      ok('  sits in ' + x.wantLesson,
        x.lesson === x.wantLesson && x.stage === x.wantStage, x.lesson + ' / stage ' + x.stage);
      ok('  ' + x.wantN + ' well-formed choice cards',
        x.n === x.wantN && x.bad.length === 0, x.n + ' cards; bad: ' + x.bad.join(', '));
    });

    // the karaka notes must carry BOTH the semantic role and the case
    const roles = await p.evaluate(() => {
      const d = DECKS['Kāraka practice — roles in a sentence'];
      const sentence = d.filter(c => c.id.startsWith('07-karaka:role:'));
      return {
        n: sentence.length,
        bothNamed: sentence.every(c =>
          /kartā|karma|karaṇa|sampradāna|apādāna|adhikaraṇa/.test(c.note) &&
          /prathamā|dvitīyā|tṛtīyā|caturthī|pañcamī|saptamī/.test(c.note)),
        askAboutAWord: sentence.every(c => /what role does “.+” play\?$/.test(c.front)),
      };
    });
    ok('karaka cards ask about a word in a real sentence',
      roles.n >= 5 && roles.askAboutAWord, roles.n + ' role cards');
    ok('karaka notes name both the role and the vibhakti', roles.bothNamed);
    await p.close();
  }

  await browser.close();
  console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(', ')}` : '\nall checks passed');
  process.exit(fail.length ? 1 : 0);
})();
