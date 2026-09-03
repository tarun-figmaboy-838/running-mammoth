import sharp from 'sharp';
const CELL = 420;
async function contentWidth(path, frames) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  let widest = 0, sum = 0, n = 0;
  for (let f = 0; f < frames; f++) {
    let x0 = CELL, x1 = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < CELL; x++)
        if (data[(y * W + (f * CELL + x)) * ch + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (x1 < 0) continue;
    const w = x1 - x0 + 1;
    widest = Math.max(widest, w); sum += w; n++;
  }
  return { widest, mean: Math.round(sum / n) };
}
for (const [name, path, frames, scale] of [
  ['mammoth', 'game/assets/char/mammoth-run.webp', 12, 1.28],
  ['bear',    'game/assets/char/bear-run.webp',    16, 1.00]
]) {
  const m = await contentWidth(path, frames);
  const onScreen = Math.round(m.mean * scale);
  console.log(name.padEnd(9) +
    'cell mean=' + String(m.mean).padEnd(5) + 'widest=' + String(m.widest).padEnd(5) +
    'on-screen body=' + String(onScreen).padEnd(5) +
    'stride x1.35 = ' + Math.round(onScreen * 1.35) +
    '   x1.5 = ' + Math.round(onScreen * 1.5));
}
