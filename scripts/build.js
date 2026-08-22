#!/usr/bin/env node
/* Build dist/abhyasah.html from app/.
 *
 * The whole point of the distributable is that it is one file with nothing
 * to fetch: it has to open from file:// on a phone with no network.  So the
 * build does exactly one thing — replace app/index.html's <link> and <script
 * src> with the file contents inlined — and then proves the result is still
 * self-contained.
 *
 *   node scripts/build.js [--check]
 *
 * --check builds in memory and fails if the result differs from what is
 * already on disk, without writing.  Use it to prove a source change was
 * purely mechanical.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist', 'abhyasah.html');

const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const LINK = '<link rel="stylesheet" href="styles.css">';
const SCRIPT = '<script src="app.js"></script>';

function build() {
  let html = read('index.html');

  for (const [tag, file, open, close] of [
    [LINK, 'styles.css', '<style>', '</style>'],
    [SCRIPT, 'app.js', '<script>', '</script>'],
  ]) {
    if (!html.includes(tag)) throw new Error(`index.html has no ${tag}`);
    if (html.indexOf(tag) !== html.lastIndexOf(tag)) {
      throw new Error(`index.html repeats ${tag}; the build would inline it twice`);
    }
    // trimEnd + '\n' keeps one newline before the closing tag however the
    // source file happens to end.
    html = html.replace(tag, open + '\n' + read(file).replace(/\s*$/, '') + '\n' + close);
  }
  return html;
}

/* A page that reaches the network is a broken page here, so the build refuses
   to emit one.  Checks the output, not the source, so it also catches anything
   an inlined file smuggles in. */
function assertSelfContained(html) {
  const banned = [
    [/<link\b(?![^>]*rel=["']?icon)/i, 'a <link> to an external stylesheet'],
    [/<script\b[^>]*\bsrc=/i, 'a <script src=...>'],
    [/\bfetch\s*\(/, 'a fetch() call'],
    [/\bXMLHttpRequest\b/, 'an XMLHttpRequest'],
    [/\bnew\s+WebSocket\b/, 'a WebSocket'],
    [/@import\b/, 'a CSS @import'],
    [/url\(\s*["']?(?:https?:)?\/\//i, 'a remote url() asset'],
    [/["'](?:https?:)?\/\/[^"']*\.(?:css|js|woff2?|ttf|png|jpe?g|svg)\b/i, 'a remote asset reference'],
  ];
  for (const [re, what] of banned) {
    const m = html.match(re);
    if (m) throw new Error(`output is not self-contained: found ${what} — ${m[0].slice(0, 60)}`);
  }
}

const html = build();
assertSelfContained(html);

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (current === html) {
    console.log('build --check: dist/abhyasah.html is up to date');
    process.exit(0);
  }
  console.error('build --check: dist/abhyasah.html differs from a fresh build of app/');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`build: dist/abhyasah.html  ${(html.length / 1024).toFixed(0)} KB`);
