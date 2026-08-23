#!/usr/bin/env node
/* Repackage dist/abhyasah.html as an Artifact-ready page.
 *
 * The Artifact host supplies its own <!doctype>/<html>/<head>/<body> skeleton
 * and wraps whatever it is given, so a complete document cannot be published
 * as-is.  This lifts the <title>, the <style> blocks and the body content out
 * of the distributable and emits just those, leaving the offline file itself
 * untouched.
 *
 *   node scripts/demo.js [out.html]
 *
 * The result is for review and hands-on testing only.  dist/abhyasah.html
 * stays the real artifact.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'dist', 'abhyasah.html');
/* The demo is published for someone to try, so it carries a version they can
   name in a message: abhyasa-demo-v7, then v8.  `demo-version` is tracked, so
   the number keeps counting across sessions rather than restarting. */
const VFILE = path.join(ROOT, 'demo-version');
const VERSION = (() => {
  const n = (parseInt(fs.existsSync(VFILE) ? fs.readFileSync(VFILE, 'utf8') : '0', 10) || 0) + 1;
  fs.writeFileSync(VFILE, n + '\n');
  return n;
})();
const OUT = path.join(ROOT, 'dist', `abhyasa-demo-v${VERSION}.html`);

const html = fs.readFileSync(SRC, 'utf8');

const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1];
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1];
if (!head || !body) {
  console.error('demo: could not find <head> and <body> in ' + SRC);
  process.exit(1);
}

// Keep the title and every style block; drop <meta>, which the host supplies.
const title = (head.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
const styles = head.match(/<style[\s\S]*?<\/style>/gi) || [];
if (!title) console.error('demo: warning — no <title>, the artifact will be unnamed');

const out = [title, ...styles, body.trim(), ''].filter(Boolean).join('\n');
fs.writeFileSync(OUT, out);

// A stray </body> or <html> left in the output means the regexes mismatched.
const stray = out.match(/<\/?(?:html|body|head)\b[^>]*>/gi);
if (stray) {
  console.error('demo: unexpected document tags survived: ' + stray.join(', '));
  process.exit(1);
}

console.log(
  `demo v${VERSION}: ${path.relative(ROOT, OUT)}  ` +
  `${(out.length / 1024).toFixed(0)} KB, ${styles.length} style block(s)`
);
