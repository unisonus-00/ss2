/* The Study renderer: reference.md -> HTML, at build time.
 *
 * Deliberately narrow.  It handles exactly the Markdown the reference files
 * actually use -- headings, paragraphs, pipe tables, bullet and numbered
 * lists, blockquotes, fenced blocks, rules, and emphasis -- and nothing else.
 * A reference is a lookup surface, so the job is to show what is written, not
 * to interpret it: anything unrecognised falls through as paragraph text
 * rather than being guessed at.
 *
 * Where the files are inconsistent, that is a content bug to fix in the
 * lesson.  This file must not grow a special case to paper over one.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s).replace(/[&<>"]/g, c => ESC[c]);

/* A backslash-star is the only escape the files use, and it appears inside
   emphasis, where a bare star would close the run early.  Park it before the
   emphasis pass and put it back after.  U+E000 is private-use, so it cannot
   collide with anything a lesson actually writes. */
const STAR = '';

function inline(s) {
  return esc(s.replace(/\\\*/g, STAR))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .split(STAR).join('*');
}

/* A heading's anchor, for the contents list.  Carries its position so two
   headings with the same words still address separately. */
function slug(text, n) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'h-' + n + (s ? '-' + s : '');
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+\.\s+(.*)$/;
const QUOTE = /^\s*>\s?/;

const isRow = l => /^\s*\|/.test(l);
const isDivider = l => /^\s*\|[\s|:-]*\|?\s*$/.test(l) && l.includes('-');
const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

/* A line that starts something other than a paragraph.  Used to know where a
   paragraph ends, so the two definitions cannot drift apart. */
const isBlock = l => HEADING.test(l) || FENCE.test(l) || RULE.test(l)
                  || BULLET.test(l) || NUMBER.test(l) || QUOTE.test(l) || isRow(l);

function render(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let i = 0, n = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    /* a fenced block is verbatim, its own blank lines included */
    if (FENCE.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++;                                          // the closing fence
      out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length, text = h[2].trim(), id = slug(text, ++n);
      out.push('<h' + level + ' id="' + id + '">' + inline(text) + '</h' + level + '>');
      toc.push({ id: id, level: level, text: text });
      i++;
      continue;
    }

    if (RULE.test(line)) { out.push('<hr>'); i++; continue; }

    /* a pipe table: a header row, its divider, then body rows */
    if (isRow(line) && isDivider(lines[i + 1] || '')) {
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && isRow(lines[i]) && !isDivider(lines[i])) {
        body.push(cells(lines[i++]));
      }
      out.push('<div class="tw"><table><thead><tr>'
        + head.map(c => '<th>' + inline(c) + '</th>').join('')
        + '</tr></thead><tbody>'
        + body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table></div>');
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i++].replace(QUOTE, ''));
      }
      out.push('<blockquote>' + body.map(inline).join('<br>') + '</blockquote>');
      continue;
    }

    const list = BULLET.test(line) ? [BULLET, 'ul']
               : NUMBER.test(line) ? [NUMBER, 'ol'] : null;
    if (list) {
      const items = [];
      while (i < lines.length && list[0].test(lines[i])) {
        items.push(lines[i++].match(list[0])[1]);
      }
      out.push('<' + list[1] + '>'
        + items.map(x => '<li>' + inline(x) + '</li>').join('')
        + '</' + list[1] + '>');
      continue;
    }

    /* Line breaks inside a paragraph are kept.  Every multi-line paragraph in
       these files is line-significant -- verse padas, parallel epithet lists
       -- so reflowing them the way Markdown normally would is not verbatim. */
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) para.push(lines[i++]);
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
  }

  return { html: out.join('\n'), toc: toc };
}

module.exports = { render: render };
