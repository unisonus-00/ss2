/* Rebuild a derivative from a root and a suffix, by the grade and join rules
 * the curriculum itself states — Stage 3's guṇa, vṛddhi, ṇatva and the
 * voicing assimilations, Stage 35's kṛt suffixes.
 *
 * Nothing here guesses.  A link is offered only when these rules REBUILD the
 * card's own headword exactly, and the caller then requires the root's sense
 * and the card's gloss to agree before it ships.  Measured against the 89
 * root-and-derivative pairs 09-dhatu/reference.md states itself, the rules
 * rebuild 73 and the whole filter mislabels none of the app's own vocabulary.
 */
'use strict';

const VOW = ['ai', 'au', 'ā', 'ī', 'ū', 'ṝ', 'a', 'i', 'u', 'ṛ', 'ḷ', 'e', 'o'];
const GUNA   = { i:'e', 'ī':'e', u:'o', 'ū':'o', 'ṛ':'ar', 'ṝ':'ar', 'ḷ':'al',
                 a:'a', 'ā':'ā', e:'e', o:'o' };
const VRDDHI = { i:'ai', 'ī':'ai', u:'au', 'ū':'au', 'ṛ':'ār', 'ṝ':'ār', 'ḷ':'āl',
                 a:'ā', 'ā':'ā', e:'ai', o:'au' };
/* before a vowel the guṇa grade itself splits: e → ay, o → av */
const SEMI = { e:'ay', o:'av', ai:'āy', au:'āv' };

/* the last vowel of the root, and what stands either side of it */
function split(r) {
  for (let i = r.length; i > 0; i--) {
    for (const v of VOW) {
      if (r.startsWith(v, i - v.length) && i - v.length >= 0) {
        return [r.slice(0, i - v.length), v, r.slice(i)];
      }
    }
  }
  return null;
}

function grades(root) {
  const s = split(root);
  if (!s) return [root];
  const [head, v, tail] = s;
  const out = new Set([root]);
  [GUNA, VRDDHI].forEach(tbl => {
    const g = tbl[v];
    if (!g) return;
    out.add(head + g + tail);
    if (SEMI[g]) out.add(head + SEMI[g] + tail);
  });
  return [...out];
}

const PAL = { c:'k', j:'k', 'ś':'k', h:'g' };
const ASP = { bh:'bdh', dh:'ddh', gh:'gdh' };
const VOWEL = /^[aāiīuūeo]/;

/* every join of a stem and a suffix the rules allow */
function joins(stem, suf) {
  const out = new Set([stem + suf]);
  if (suf[0] === 't') {
    Object.keys(ASP).forEach(k => {
      if (stem.endsWith(k)) out.add(stem.slice(0, -k.length) + ASP[k] + suf.slice(1));
    });
    const last = stem.slice(-1);
    if (PAL[last]) out.add(stem.slice(0, -1) + PAL[last] + suf);
    if (last === 'ś' || last === 'j') out.add(stem.slice(0, -1) + 'ṣṭ' + suf.slice(1));
    if (last === 'ṣ') out.add(stem + 'ṭ' + suf.slice(1));
    if (last === 'd') out.add(stem.slice(0, -1) + 't' + suf);
  }
  if (VOWEL.test(suf)) {
    const last = stem.slice(-1);
    if (last === 'j') out.add(stem.slice(0, -1) + 'g' + suf);
    if (last === 'c') out.add(stem.slice(0, -1) + 'k' + suf);
  }
  /* ṇatva: an n turns ṇ after ṛ, r or ṣ in the same word */
  [...out].forEach(f => {
    if (/[ṛrṣ].*n/.test(f)) out.add(f.replace(/(?<=[ṛrṣ])([aāiīuūeo]*)n/, '$1ṇ'));
  });
  /* a nasal may drop before a consonant suffix: gam + ti → gati */
  if (/[mn]$/.test(stem) && !VOWEL.test(suf)) out.add(stem.slice(0, -1) + suf);
  return out;
}

/* every form the rules can build for root + suffix */
function build(root, suf) {
  const out = new Set();
  grades(root).forEach(g => {
    joins(g, suf).forEach(f => out.add(f));
    if (VOWEL.test(suf)) {
      /* a long ā swallows a following short a — jñā + ana is jñāna */
      if (/ā$/.test(g) && /^a/.test(suf)) out.add(g + suf.slice(1));
      if (/[aā]$/.test(g)) out.add(g.slice(0, -1) + suf);
      if (/ai$/.test(g))   out.add(g.slice(0, -2) + 'ā' + suf);
    }
  });
  return out;
}

/* The kṛt and taddhita suffixes vocab/16-prefixes-suffixes.md names, plus the
   bare thematic -a every action noun is built with. */
const SUFFIXES = ['ana', 'ti', 'ta', 'tṛ', 'in', 'ya', 'tva', 'tā', 'man', 'as',
                  'na', 'tu', 'ma', 'ka', 'ita', 'vat', 'tyu', 'sa', 'vara',
                  'a', 'u', 'i', 'ā', 'yā', 'aka'];

/* word → the roots the rules can build it from, with the suffix used */
function indexOf(rootIds) {
  const made = new Map();
  rootIds.forEach(r => SUFFIXES.forEach(s => build(r, s).forEach(f => {
    (made.get(f) || made.set(f, []).get(f)).push({ root: r, suffix: s });
  })));
  return made;
}

module.exports = { build, grades, indexOf, SUFFIXES };
