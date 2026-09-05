/* The ending: the two of them dance (the supplied GIF as a sheet), big confetti, a message on
   top, Play again at the bottom. */
const fs = require('fs');
let bad = 0;
const nl = f => fs.readFileSync(f, 'utf8').includes('\r\n') ? '\r\n' : '\n';
function edit(file, from, to, label) {
  let s = fs.readFileSync(file, 'utf8');
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error('MISS  ' + label + '  (found ' + n + ')'); bad++; return; }
  fs.writeFileSync(file, s.replace(from, to)); console.log('ok    ' + label);
}
const E = 'game/js/engine.js', N = nl(E), J = a => a.join(N);

/* 1. load the sheet with the other character art */
{
  let s = fs.readFileSync(E, 'utf8');
  const m = s.match(/^.*loadImg\('assets\/char\/bear\.webp'\).*$/m);
  if (!m) { console.error('MISS  bear load line'); bad++; }
  else {
    s = s.replace(m[0], m[0] + N + "    // the two of them dancing: the delivered 36-frame GIF as a 6x6 sheet at native size" + N +
      "    jobs.push(loadImg('assets/char/duo-celebrate.webp').then(i => { images.duo = i; }));");
    fs.writeFileSync(E, s); console.log('ok    load duo sheet');
  }
}

/* 2. draw it at the ending, cross-faded in from the standing pair */
edit(E, J(["    drawBear(ctx);", "    mammoth.draw(ctx, G.t);"]),
  J(["    /* THE ENDING IS A DANCE. Once the journey is complete the standing pair cross-fades",
     "       (300ms) into the delivered two-character celebration sheet — the mammoth bobbing,",
     "       the bear up on his hind legs waving — so the last screen moves, rather than",
     "       holding a pose next to a static friend. The mammoth's x is kept, so nothing",
     "       jumps at the swap. */",
     "    const duo = G.state === 'COMPLETE' && images.duo ? clamp(G.st / 300, 0, 1) : 0;",
     "    if (duo < 1) {",
     "      if (duo > 0) { ctx.save(); ctx.globalAlpha = 1 - duo; }",
     "      drawBear(ctx);",
     "      mammoth.draw(ctx, G.t);",
     "      if (duo > 0) ctx.restore();",
     "    }",
     "    if (duo > 0) drawDuo(ctx, duo);"]), 'render: duo cross-fade');
edit(E, "  function render() {",
  J(["  /* THE CELEBRATION SHEET. 36 frames of 754x434 in a 6x6 grid, authored at 100ms a frame",
     "     (10fps). Measured off the frames: the feet sit on row 374, and the mammoth's centre",
     "     is 184px in from the left; he is drawn 1.3x, which puts him at the size he runs at,",
     "     with his x where he stopped. Frames are indexed off the state clock, so the dance",
     "     runs at its authored rate on any display and never stutters with the frame rate.",
     "     A little poof under whichever of them lands on each beat (frames 0/18 the mammoth,",
     "     9/27 the bear) is the one thing added to the drawn animation. */",
     "  const DUO = { cw: 754, ch: 434, cols: 6, n: 36, fps: 10, feet: 374, mammothCx: 184, bearCx: 610, scale: 1.3 };",
     "  function drawDuo(ctx, a) {",
     "    const img = images.duo;",
     "    if (!img) return;",
     "    const f = Math.floor(G.st / (1000 / DUO.fps)) % DUO.n;",
     "    const sx = (f % DUO.cols) * DUO.cw, sy = Math.floor(f / DUO.cols) * DUO.ch;",
     "    const k = DUO.scale, w = DUO.cw * k, h = DUO.ch * k;",
     "    const x = CFG.mammothX - DUO.mammothCx * k, y = CFG.surfaceY - DUO.feet * k;",
     "    if (f !== G.duoFrame) {",
     "      G.duoFrame = f;",
     "      if (!reduced && f % 9 === 0) {",
     "        const cx = x + (f % 18 === 0 ? DUO.mammothCx : DUO.bearCx) * k;",
     "        particles.poof(cx, CFG.surfaceY, 3, 0.8);",
     "      }",
     "    }",
     "    ctx.save();",
     "    ctx.globalAlpha = a;",
     "    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';",
     "    ctx.drawImage(img, sx, sy, DUO.cw, DUO.ch, Math.round(x), Math.round(y), Math.round(w), Math.round(h));",
     "    ctx.restore();",
     "  }",
     "",
     "  function render() {"]), 'drawDuo');

/* 3. big confetti at the ending */
edit(E, "  confetti(stageW, n = 80) {", "  confetti(stageW, n = 80, big = false) {", 'confetti big param');
edit(E, "      r: rand(7, 15),", "      r: big ? rand(14, 28) : rand(7, 15),      // big: the ending's pieces have to read from the sofa", 'confetti big size');
edit(E, "      dur: rand(2.4, 4.2),", "      dur: big ? rand(3.2, 5.2) : rand(2.4, 4.2),", 'confetti big dur');
edit(E, "        if (!reduced) particles.confetti(CFG.W, 90);", "        if (!reduced) particles.confetti(CFG.W, 130, true);", 'COMPLETE shower big');
edit(E, "        if (!reduced && G.st - (G.drizzleAt || 0) > 2600) { G.drizzleAt = G.st; particles.confetti(CFG.W, 22); }",
  "        if (!reduced && G.st - (G.drizzleAt || 0) > 2200) { G.drizzleAt = G.st; particles.confetti(CFG.W, 34, true); }", 'drizzle big');
edit(E, "        G.moving = false; G.complete = true; G.jumpEnabled = false; G.instruction = ''; G.drizzleAt = 0;",
  "        G.moving = false; G.complete = true; G.jumpEnabled = false; G.instruction = ''; G.drizzleAt = 0; G.duoFrame = -1;", 'duoFrame reset');

/* 4. the message on top, the button at the bottom */
const H = 'game/index.html', NH = nl(H);
edit(H, '              <p class="win-sub"><b id="win-count">0</b> / <span id="win-total">7</span> crossings mended</p>',
  ['              <p class="win-sub">Momo found his friend — home at last!</p>',
   '              <p class="win-count"><b id="win-count">0</b> / <span id="win-total">7</span> crossings mended</p>'].join(NH), 'html: situational message + count');
const S = 'game/css/screens.css', NS = nl(S);
edit(S, ['  left: 55%;', '  top: 2%;', '  width: min(50vw, 920px);'].join(NS),
  ['  /* A BANNER ACROSS THE TOP now, not a speech bubble off the bear: the two of them are',
   '     dancing in the middle of the stage and the words are the narrator\'s, so they sit',
   '     above the scene, centred, with no tail. */',
   '  left: 50%;', '  top: 2.5%;', '  width: min(58vw, 1000px);'].join(NS), 'css: banner');
edit(S, ['  left: 15%;', '  top: 100%;'].join(NS), ['  display: none;                          /* the banner speaks for the scene; no tail */', '  left: 15%;', '  top: 100%;'].join(NS), 'css: no tail');
edit(S, ['  left: 68%;', '  bottom: 26%;'].join(NS),
  ['  /* BOTTOM CENTRE, the one thing to do, where a thumb already rests — clear of the',
   '     dance in the middle and the banner on top. */',
   '  left: 50%;', '  bottom: 3.5%;'].join(NS), 'css: replay bottom centre');
edit(S, ['.win-sub b {'].join(NS),
  ['.win-count {',
   '  margin: 0 0 clamp(10px, 1.1vw, 20px);',
   '  font: 800 clamp(17px, 1.7vw, 32px)/1.2 "Baloo 2", system-ui, sans-serif;',
   '  color: #1C5A85;',
   '}',
   '.win-count b {'].join(NS), 'css: count line');

/* 5. the doc */
fs.appendFileSync('RUNNER.md', ['', '### The ending dances', '',
  'At COMPLETE the standing pair cross-fades (300 ms) into the delivered two-character',
  'celebration GIF, sliced to `assets/char/duo-celebrate.webp` (6×6 of 754×434, native size,',
  '10 fps off the state clock, feet on row 374, drawn 1.3× with the mammoth\'s x kept — see',
  '`DUO`/`drawDuo`). A poof lands under whichever of them comes down on each beat. Confetti at',
  'the ending is the big kind (14–28 px) — shower of 130, then 34 every 2.2 s. The words are a',
  'banner across the top ("Momo found his friend — home at last!" over the climbing count and',
  'the seven stamps), and Play again is bottom-centre. Source GIF: `art-source/gif/celebrate-duo.gif`.',
  ''].join('\n'));
console.log('ok    RUNNER');
process.exit(bad ? 1 : 0);
