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
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'abhyasah.demo.html');

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
  `demo: ${path.relative(ROOT, OUT)}  ` +
  `${(out.length / 1024).toFixed(0)} KB, ${styles.length} style block(s)`
);
