#!/usr/bin/env node
/* The app's icons, drawn from the artwork the app already ships.
 *
 * A PWA has to hand the launcher a square icon at several sizes, and the
 * project has exactly one piece of artwork: app/logo.png, the lockup with the
 * Devanagari wordmark beside the ring mark.  A wordmark does not survive
 * being squeezed into a 48px tile, so the icons are the RING MARK ALONE,
 * cropped out of that same file and set on the app's own ground — the mark
 * is the part of the lockup that reads at icon size, and cropping it keeps
 * the icon and the page showing one drawing rather than two.
 *
 * Nothing is fetched and nothing is added to the dependency list: the PNG is
 * decoded, scaled and re-encoded here with zlib alone, which node already
 * carries.  Rerun automatically by scripts/build.js, so redrawing
 * app/logo.png redraws the icons.
 */

const fs = require('fs');
const zlib = require('zlib');

/* ── PNG in ────────────────────────────────────────────────────────────
   app/logo.png is 8-bit RGBA, non-interlaced, which is all this needs to
   read.  Anything else is refused rather than guessed at: a silently
   mis-decoded icon would ship looking like nothing at all. */
function decode(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(file + ': not a PNG');

  let off = 8, ihdr = null;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.slice(off + 4, off + 8).toString('latin1');
    if (type === 'IHDR') {
      ihdr = { w: b.readUInt32BE(off + 8), h: b.readUInt32BE(off + 12),
               depth: b[off + 16], colour: b[off + 17], interlace: b[off + 20] };
    } else if (type === 'IDAT') {
      idat.push(b.slice(off + 8, off + 8 + len));
    }
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error(file + ': no IHDR');
  if (ihdr.depth !== 8 || ihdr.colour !== 6 || ihdr.interlace !== 0) {
    throw new Error(file + ': expected 8-bit RGBA, non-interlaced — '
      + `got depth ${ihdr.depth}, colour type ${ihdr.colour}, `
      + `interlace ${ihdr.interlace}`);
  }

  const { w, h } = ihdr, bpp = 4, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * bpp);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[row + i - bpp] : 0;       // left
      const bb = y > 0 ? px[row - stride + i] : 0;      // up
      const c = (i >= bpp && y > 0) ? px[row - stride + i - bpp] : 0;  // up-left
      let v = raw[p + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += bb;
      else if (filter === 3) v += (a + bb) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      px[row + i] = v & 255;
    }
    p += stride;
  }
  return { w, h, px };
}

/* ── PNG out ───────────────────────────────────────────────────────────
   Indexed, 8-bit, with a 256-step palette running from the app's ground to
   its leaf.  The artwork is one cream ink keyed onto transparency, so every
   pixel of a composited icon lies on exactly that ramp: an index per pixel
   is lossless here and a third of the bytes of truecolour, which matters
   because these icons are inlined into the page as data: URIs. */
function encode(w, h, index, palette) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeInt32BE(crc(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 3;                 // 8-bit, indexed
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;                   // filter: none
    index.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* the ramp itself: 256 steps from the ground to the ink */
function ramp(bg, ink) {
  const p = Buffer.alloc(256 * 3);
  for (let i = 0; i < 256; i++) {
    for (let c = 0; c < 3; c++) p[i * 3 + c] = Math.round(bg[c] + (ink[c] - bg[c]) * i / 255);
  }
  return p;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return c ^ -1;
}

/* ── the mark, cropped ─────────────────────────────────────────────────
   Found rather than hard-coded: the ring sits to the right of the wordmark
   with a clear column of nothing between them, so the crop is the last run
   of inked columns.  Redraw the lockup and the crop follows it. */
function markOf(img) {
  const { w, h, px } = img;
  const inked = x => {
    for (let y = 0; y < h; y++) if (px[(y * w + x) * 4 + 3] > 24) return true;
    return false;
  };
  let x1 = w - 1;
  while (x1 >= 0 && !inked(x1)) x1--;
  let x0 = x1;
  while (x0 > 0 && inked(x0 - 1)) x0--;
  if (x1 < 0 || x1 - x0 < 16) throw new Error('logo.png: found no mark to crop');

  let y0 = 0, y1 = h - 1;
  const inkedRow = y => {
    for (let x = x0; x <= x1; x++) if (px[(y * w + x) * 4 + 3] > 24) return true;
    return false;
  };
  while (y0 < h && !inkedRow(y0)) y0++;
  while (y1 > y0 && !inkedRow(y1)) y1--;
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ── one icon ──────────────────────────────────────────────────────────
   The mark, box-filtered down to `span` pixels and centred on the ground.
   What is measured per pixel is COVERAGE — how much of it the ink covers —
   which is alpha-weighted, so the cream does not pick up a dark fringe from
   the transparent pixels around it, and which is exactly the palette index. */
function draw(img, box, size, span) {
  const index = Buffer.alloc(size * size);   // 0 = bare ground
  /* the mark is very nearly square; keep its aspect rather than stretching */
  const scale = span / Math.max(box.w, box.h);
  const dw = Math.max(1, Math.round(box.w * scale)), dh = Math.max(1, Math.round(box.h * scale));
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);

  for (let y = 0; y < dh; y++) {
    const sy0 = box.y0 + Math.floor(y * box.h / dh);
    const sy1 = Math.max(sy0 + 1, box.y0 + Math.floor((y + 1) * box.h / dh));
    for (let x = 0; x < dw; x++) {
      const sx0 = box.x0 + Math.floor(x * box.w / dw);
      const sx1 = Math.max(sx0 + 1, box.x0 + Math.floor((x + 1) * box.w / dw));
      let a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) { a += img.px[(sy * img.w + sx) * 4 + 3]; n++; }
      }
      if (!n) continue;
      const px = (oy + y) * size + (ox + x);
      if (px >= 0 && px < index.length) index[px] = Math.round(a / n) & 255;
    }
  }
  return index;
}

/* The ground the page paints, so the icon and the app it opens are the same
   colour — --ground in app/styles.css. */
const GROUND = [0x24, 0x1f, 0x19];
/* and the ink the artwork is already drawn in — --leaf */
const LEAF = [0xe9, 0xdc, 0xbe];

/* `any` fills its tile; `maskable` keeps well inside the circle a launcher
   may crop it to, which is why its mark is the smaller of the two. */
const PLAN = [
  { name: 'icon-192.png',      size: 192, span: 0.72, purpose: 'any' },
  { name: 'icon-512.png',      size: 512, span: 0.72, purpose: 'any' },
  { name: 'icon-maskable.png', size: 512, span: 0.56, purpose: 'maskable' },
  { name: 'apple-touch-icon.png', size: 180, span: 0.68, purpose: 'apple' },
  { name: 'favicon.png',       size: 64,  span: 0.86, purpose: 'favicon' },
];

function icons(logo) {
  const img = decode(logo);
  const box = markOf(img);
  const palette = ramp(GROUND, LEAF);
  return PLAN.map(p => ({
    ...p,
    png: encode(p.size, p.size, draw(img, box, p.size, Math.round(p.size * p.span)), palette),
  }));
}

const dataUri = png => 'data:image/png;base64,' + png.toString('base64');

module.exports = { icons, dataUri, GROUND, decode, encode };

if (require.main === module) {
  const path = require('path');
  const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'icons');
  fs.mkdirSync(out, { recursive: true });
  for (const i of icons(path.join(__dirname, '..', 'app', 'logo.png'))) {
    fs.writeFileSync(path.join(out, i.name), i.png);
    console.log(`${i.name}  ${i.size}×${i.size}  ${(i.png.length / 1024).toFixed(1)} KB`);
  }
}
