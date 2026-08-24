#!/usr/bin/env node
/* Rebuild lexicon/dhatupatha.json from the Dhātu-pāṭha SQLite database.
 *
 *   node scripts/dhatupatha.js /path/to/sandic_1.db
 *
 * The database is NOT in this repository — it is a third-party dictionary
 * build, and what belongs here is the extract it produces plus this script,
 * so the extract can be checked and remade rather than taken on trust.
 * Nothing runs it at build time: `lexicon/dhatupatha.json` is checked in and
 * the page has to open from file:// with nothing to fetch.
 *
 * Needs `node:sqlite` (Node 22+) or a `sqlite3` on the path; with neither it
 * says so and stops rather than writing half a file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const V = { 'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ॠ':'ṝ','ऌ':'ḷ',
            'ए':'e','ऐ':'ai','ओ':'o','औ':'au' };
const M = { 'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','ॄ':'ṝ','ॢ':'ḷ',
            'े':'e','ै':'ai','ो':'o','ौ':'au' };
const C = { 'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ','च':'c','छ':'ch','ज':'j','झ':'jh',
            'ञ':'ñ','ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ','त':'t','थ':'th','द':'d',
            'ध':'dh','न':'n','प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r',
            'ल':'l','व':'v','श':'ś','ष':'ṣ','स':'s','ह':'h','ळ':'ḷ' };

/* Devanagari to IAST, for the citation forms the database files roots under */
function iast(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (C[ch]) {
      out += C[ch];
      if (M[s[i + 1]]) { out += M[s[i + 1]]; i += 2; continue; }
      if (s[i + 1] === '्') { i += 2; continue; }
      out += 'a'; i++; continue;
    }
    if (V[ch]) { out += V[ch]; i++; continue; }
    if (ch === 'ं') { out += 'ṃ'; i++; continue; }
    if (ch === 'ः') { out += 'ḥ'; i++; continue; }
    i++;
  }
  return out;
}

function readRows(db) {
  const sql = 'select word, hom, desc from dictEntries order by word, hom';
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(db, { readOnly: true }).prepare(sql).all();
  } catch (e) { /* fall through to the cli */ }
  try {
    const out = execFileSync('sqlite3', ['-json', db, sql], { maxBuffer: 1 << 28 });
    return JSON.parse(out.toString('utf8'));
  } catch (e) {
    console.error('dhatupatha: needs node:sqlite (Node 22+) or sqlite3 on the path');
    process.exit(1);
  }
}

/* One row of the Dhātu-pāṭha: its class line, its English sense, its present.
   A root is entered once per homonym, and `5 cl.` is as valid a class line as
   `1P, aniṭ, sak` — reading only the second is what once made śru look like a
   disagreement with the reference. */
function parse(word, hom, desc) {
  /* `[^\s,]+` rather than `\w+`: JS word characters are ASCII, and the iṭ
     values are seṭ, aniṭ, veṭ — \w+ truncates every one of them to "se". */
  const cls = /^\s*(\d+)\s*(?:([PAU])(?:,\s*([^\s,]+))?(?:,\s*([^\s,]+))?|cl\.)/m.exec(desc);
  let sense = null;
  for (const line of desc.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('N.B.') || t.startsWith('laṭ')) continue;
    if (t.includes('[') || t.includes('।')) continue;
    if (/^\d+\s*(?:[PAU]|cl\.)/.test(t)) continue;
    if (/^to |^one who|^a /.test(t)) { sense = t; break; }
  }
  const pres = /laṭ[^\n]*\n\n1\.1 \[([^\]]+)\]/.exec(desc);
  const r = { id: iast(word), citation: word, hom: Number(hom) };
  if (cls) {
    r.gana = Number(cls[1]);
    if (cls[2]) r.pada = cls[2];
    if (cls[3]) r.it = cls[3];
    if (cls[4]) r.transitivity = cls[4];
  }
  if (sense) r.sense = sense;
  if (pres) r.present = iast(pres[1]);
  return r;
}

const db = process.argv[2];
if (!db) { console.error('usage: node scripts/dhatupatha.js <sandic_1.db>'); process.exit(1); }
const roots = readRows(db).map(r => parse(r.word, r.hom, r.desc));
const out = {
  note: 'The Dhātu-pāṭha entire — every root it lists, not only the ones a '
      + 'lesson names. It is the canonical source here for what a root IS: its '
      + 'gaṇa, pada, iṭ, transitivity, present form and — the reason it earns '
      + 'the place — its sense in English, which nothing else in this '
      + 'repository gives for a root. `citation` is the form it files the root '
      + 'under, often the Pāṇinian one (ṇam for nam, ṣṭhā for sthā), and `hom` '
      + 'says which of its homonymous entries a claim came from, so every claim '
      + 'is traceable to a row. Checked in rather than fetched: the page must '
      + 'open from file:// with nothing to download. Where it and '
      + '09-dhatu/reference.md disagree the LESSON wins and the build says so. '
      + 'Remade by scripts/dhatupatha.js.',
  source: { name: 'Dhātu-pāṭha', author: 'Maṇḍala Pati dāsa',
            desc: 'List of verbal roots with final forms',
            uri: 'http://sourceforge.net/p/dhatu-patha' },
  notAttested: ['vand'],
  roots,
};
const dest = path.resolve(__dirname, '..', 'lexicon', 'dhatupatha.json');
fs.writeFileSync(dest, JSON.stringify(out) + '\n');
console.error(`dhatupatha: ${roots.length} entries · `
  + `${new Set(roots.map(r => r.id)).size} roots · `
  + `${roots.filter(r => r.sense).length} with a sense -> lexicon/dhatupatha.json`);
