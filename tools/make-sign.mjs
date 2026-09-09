/* THE HANGING SIGN, from the delivered plank.
 *
 *   consumes  art-source/sign-hanging-src.png   (2172x724, the owner's delivery)
 *   writes    game/assets/ui/plank-l.webp
 *             game/assets/ui/plank-m.webp
 *             game/assets/ui/plank-r.webp
 *   prints    the art-pixel geometry the stylesheet is built from
 *
 * WHY THREE SLICES AND NOT ONE PICTURE. The panel grows with its sentence — "Cut the
 * triangle." and "Use the right ice piece to fix the path." are very different widths —
 * and the plank has a rope, a knot and a steel eyelet at each end. Scale the whole
 * picture to fit a sentence and those get squashed: a rope stretched to 1.6x reads as a
 * smear, and the two ends stop matching each other. So the ENDS are pinned at their
 * natural aspect and only a slice of plain wood in the middle is allowed to stretch,
 * where grain runs the way it is being stretched and nobody can tell.
 *
 * WHY THE ROPES ARE IN THE PICTURE AT ALL. The panel is meant to read as a sign hanging
 * from above rather than a card floating in the sky, so the art keeps the full rope and
 * the panel is placed at the top of the stage — the ropes run off the top of the frame,
 * exactly as the ice blocks' ropes do. Everything above the plank is transparent, so it
 * covers nothing.
 *
 * EVERY NUMBER BELOW IS MEASURED, not chosen: the cuts are placed from the alpha and the
 * colour of the delivered file (see the report this prints), so a re-delivery at another
 * size still cuts in the right places.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'art-source/sign-hanging-src.png';
const OUT = 'game/assets/ui/';

const src = sharp(SRC).ensureAlpha();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const A = (x, y) => data[(y * W + x) * C + 3];
const RGB = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };

/* ---- 1. trim to what is actually drawn ---- */
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 8) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const TW = x1 - x0 + 1, TH = y1 - y0 + 1;

/* ---- 2. the plank's own band: the rows where the art is wide ---- */
let plankTop = -1, plankBot = -1;
for (let y = 0; y < H; y++) {
  let n = 0;
  for (let x = 0; x < W; x++) if (A(x, y) > 8) n++;
  if (n > W * 0.5) { if (plankTop < 0) plankTop = y; plankBot = y; }
}

/* ---- 3. the ropes: the only thing drawn well above the plank ---- */
const ropeCols = [];
for (let x = 0; x < W; x++) {
  for (let y = 0; y < plankTop - 150; y++) if (A(x, y) > 8) { ropeCols.push(x); break; }
}
const runs = [];
for (const x of ropeCols) {
  const last = runs[runs.length - 1];
  if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]);
}
if (runs.length !== 2) throw new Error(`expected two ropes, found ${runs.length}: ${JSON.stringify(runs)}`);
const [ropeL, ropeR] = runs;

/* ---- 4. where each cap has to end ----
   Far enough past its rope that the knot, the eyelet, the dark end grain and the snow
   sitting on that end are all inside the cap and none of them is ever stretched. The
   snow is what decides it: it spills further along the plank than the ironmongery does,
   and a stretched snow blob is the one thing that would give the trick away. */
const snowy = x => {
  for (let y = plankTop - 60; y < plankTop + 30; y++) {
    const [r, , b] = RGB(x, y);
    if (A(x, y) > 120 && b > r + 6) return true;                  // pale blue: snow, not wood
  }
  return false;
};
/* Walk out from the rope until the snow has been clear for a whole GAP of columns, and
   stop there. Taking the furthest snowy column instead swallows the blob in the MIDDLE
   of the plank — measured, that put the right cap 939px wide, more than half the art, so
   the two caps no longer matched and there was almost nothing left to stretch. */
const GAP = 60;
const edgeOfEndSnow = (from, dir, limit) => {
  let edge = from, clear = 0;
  for (let x = from; dir > 0 ? x < limit : x > limit; x += dir) {
    if (snowy(x)) { edge = x; clear = 0; } else if (++clear >= GAP) break;
  }
  return edge;
};
const capL = edgeOfEndSnow(ropeL[1], +1, Math.floor(W * 0.45)) + 40;
const capR = edgeOfEndSnow(ropeR[0], -1, Math.ceil(W * 0.55)) - 40;

/* ---- 5. the slice that stretches: EVERYTHING BETWEEN THE CAPS ----
   Not a narrow sample from the middle, and this is the whole difference between a board
   and three pieces of one. The plank is hand-drawn: its top edge, the pale inner panel and
   its bottom edge all wander by a few pixels along its length. Take the stretching slice
   from somewhere else on the board and the column that meets the cap is a column that was
   never next to it — measured on the first cut, the pale panel started 6px higher and
   ended 8px lower than in the cap it butted against, which at the size the sign is drawn
   is a two-pixel step in the board's own edge at each join. That is exactly what reads as
   "the crop is visible".
   Cutting the middle out of the span BETWEEN the caps makes both seams continuous by
   construction: the middle's first column is the cap's next column, and the same at the
   other end. Whatever the wood does along its length, it lines up. It also keeps the snow
   that sits in the middle of the delivered board, which a narrow clean sample threw away. */
const M0 = capL, M1 = capR;

/* ---- 6. cut ---- */
await mkdir(OUT, { recursive: true });
const cut = async (name, left, width) => {
  await sharp(SRC).ensureAlpha()
    .extract({ left, top: y0, width, height: TH })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(OUT + name);
  return { name, left, width };
};
const L = await cut('plank-l.webp', x0, capL - x0);
const M = await cut('plank-m.webp', M0, M1 - M0);
const R = await cut('plank-r.webp', capR, x1 - capR + 1);

/* ---- 6b. prove the joins line up, rather than assuming they do ---- */
const profile = async (file, col) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const x = col < 0 ? width + col : col;
  let top = null, bot = null, paleTop = null, paleBot = null;
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * channels;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a > 40) { if (top === null) top = y; bot = y; }
    if (a > 200 && r > 200 && g > 170 && b > 120) { if (paleTop === null) paleTop = y; paleBot = y; }
  }
  return { top, paleTop, paleBot, bot };
};
const seam = async (a, ac, b, bc, name) => {
  const p = await profile(OUT + a, ac), q = await profile(OUT + b, bc);
  const off = ['top', 'paleTop', 'paleBot', 'bot'].map(kk => Math.abs(q[kk] - p[kk]));
  const worst = Math.max(...off);
  console.log(`  ${name} seam: top/paleTop/paleBot/bot out by ${off.join('/')} art px`);
  if (worst > 1) throw new Error(`the ${name} seam is ${worst}px out — the slices would not read as one board`);
};
console.log('');
await seam('plank-l.webp', -2, 'plank-m.webp', 1, 'left');
await seam('plank-m.webp', -2, 'plank-r.webp', 1, 'right');

/* ---- 7. the numbers the stylesheet needs, in TRIMMED art pixels ---- */
const t = v => v - x0;
console.log(`
source            ${SRC}  ${W}x${H}
trimmed art       ${TW} x ${TH}   (opaque x ${x0}..${x1}, y ${y0}..${y1})
the plank's wood  y ${plankTop - y0}..${plankBot - y0}   (${plankBot - plankTop + 1} rows of ${TH})
the ropes         x ${t(ropeL[0])}..${t(ropeL[1])} and ${t(ropeR[0])}..${t(ropeR[1])}

  slice        art x            width
  plank-l      0..${t(capL)}${' '.repeat(Math.max(1, 12 - String(t(capL)).length))}${L.width}
  plank-m      ${t(M0)}..${t(M1)}${' '.repeat(Math.max(1, 10 - String(t(M1)).length))}${M.width}
  plank-r      ${t(capR)}..${TW}${' '.repeat(Math.max(1, 8 - String(TW).length))}${R.width}

FOR css/style.css (.instruction-pill):
  --k            = --sign-h / ${TH}
  caps           left ${t(capL)}, right ${TW - t(capR)}  (art px, never stretched)
  middle width   calc(100% - ${t(capL) + (TW - t(capR))} * var(--k) + 24px)
  wood centre    art y ${Math.round((plankTop + plankBot) / 2 - y0)}
  text box       y ${plankTop - y0 + 26}..${plankBot - y0 - 14}
`);
