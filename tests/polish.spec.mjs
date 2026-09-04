/* THE POLISH PASS, GUARDED.

   One test per defect the QA sweep found, so none of them can come back quietly. What
   they have in common is that each is measured or driven the way a PLAYER would: real
   mouse strokes rather than the _cut hook wherever the gesture is the point, and every
   assertion against a number the game reports about itself rather than against the
   code that produced it.

   They also print what they measured. That is deliberate — the numbers in the report
   these came with (rope spacing, wobble amplitude, verdict box, frame rate) are read
   out of this file's output, so a claim about the interface can always be re-checked
   rather than taken on trust.

   The screenshot tests at the end write to test-results/ and assert nothing. They are
   the frames to look at when something is reported as "looking wrong". */
import { test, expect } from '@playwright/test';
import { boot, waitState } from './helpers.mjs';

const box = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    hidden: el.hidden, x: Math.round(r.x), y: Math.round(r.y),
    w: Math.round(r.width), h: Math.round(r.height),
    position: cs.position, opacity: cs.opacity, visibility: cs.visibility,
    bg: cs.backgroundImage.replace(/^.*\//, '').slice(0, 40)
  };
}, sel);

/* KEEP THE RUN MOVING, in the background.

   The game does NOT reach a crevasse on its own: there is a rock before phase 1 that
   has to be jumped, and walking into it opens the Ouch panel and stops the world. So
   any test that waits for a later state has to be clearing obstacles the whole time —
   the two that were not simply sat in the Ouch panel until they timed out, which
   looked exactly like the game hanging. This installs one page-side loop that jumps
   rocks and dismisses the panel, and touches nothing else. */
async function autoDrive(page) {
  await page.evaluate(() => {
    if (window.__drive) return;
    const g = window.iceAgeGame;
    window.__drive = true;
    const tick = () => {
      if (!window.__drive) return;
      const G = g.debug();
      for (const o of g._obstacles().list) {
        const sx = o.x - G.worldX;
        if (sx > 380 && sx < 700 && !o.passed) g.jump();
      }
      if (G.state === 'OBSTACLE_HIT') g.retryObstacle();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* BACK TO REAL TIME before a gesture is measured.

   ?fast=N steps the simulation N times per rendered frame, which is the only way to
   reach a later phase quickly — but it also means N seconds of game time pass per
   second of wall clock, and a Playwright mouse stroke is a dozen CDP round trips.
   Measured: at fast=4 a swipe cut a rope correctly and the whole PHASE_WRONG beat had
   played out before the assertion ran, and the ropes' jiggle had decayed to zero. Both
   read as the input being ignored, and neither was. So a test about input drives the
   run fast and then puts the clock back. */
const realTime = page => page.evaluate(() => window.iceAgeGame.setOptions({ fast: 1 }));

/* Every rope, and every hanging chunk, as the game has them right now. Printed rather
   than assumed: a swipe test that guesses where a rope is tests nothing. */
const ropes = page => page.evaluate(() => {
  const g = window.iceAgeGame.debug();
  if (!g.l1) return null;
  return g.l1.shapes.filter(s => s.state === 'hang').map(s => ({
    kind: s.kind, anchorX: Math.round(s.anchorX), y: Math.round(s.y),
    w: Math.round(s.w), h: Math.round(s.h),
    pivY: Math.round(s.pivot ? s.pivot.y : 0)
  }));
});

/* Drive to a playable phase. The game will not get there on its own: the first rock
   has to be jumped or hit three times, so a test that only waits sits in the Ouch
   panel until it times out. */
async function toPhase(page, phase = 0, budget = 120000) {
  await page.evaluate(async p => {
    const g = window.iceAgeGame;
    const t0 = Date.now();
    while (Date.now() - t0 < 110000) {
      const G = g.debug();
      if (G.state === 'PHASE_ACTIVE' && G.phase >= p) return;
      for (const o of g._obstacles().list) {
        const sx = o.x - G.worldX;
        if (sx > 380 && sx < 700 && !o.passed) g.jump();
      }
      if (G.state === 'OBSTACLE_HIT') g.retryObstacle();
      if (G.state === 'PHASE_ACTIVE' && G.phase < p && G.l1) g._cut(G.l1.unfilled[0]);
      await new Promise(r => requestAnimationFrame(r));
    }
  }, phase);
  await waitState(page, 'PHASE_ACTIVE', budget);
}

test('the verdict mark renders, and lands over the crevasse', async ({ page }) => {
  await boot(page, { fast: 4 });
  await toPhase(page);
  /* Real time to look at it: the mark is up for 0.9s of GAME time, which at fast=4 is
     225ms of wall clock — the first attempt sampled it mid-pop and read opacity 0. */
  await realTime(page);
  const bad = await page.evaluate(() => {
    const g = window.iceAgeGame.debug();
    const b = g.l1.shapes.find(s => s.state === 'hang' && !g.l1.unfilled.includes(s.kind));
    return b ? b.kind : null;
  });
  await page.evaluate(k => window.iceAgeGame._cut(k), bad);
  await page.waitForTimeout(420);          // past the pop's overshoot, well before it leaves
  const v = await box(page, '#verdict');
  const stage = await box(page, '#stage');
  console.log('VERDICT', JSON.stringify(v), 'STAGE', stage.w + 'x' + stage.h);
  await page.screenshot({ path: 'test-results/qa-verdict.png' });
  expect(v.hidden, 'shown').toBe(false);
  expect(v.w, 'has a width').toBeGreaterThan(24);
  expect(v.h, 'has a height').toBeGreaterThan(24);
  expect(Number(v.opacity), 'and is actually opaque').toBeGreaterThan(0.5);
  // over the crevasse, which sits right of centre
  expect(v.x).toBeGreaterThan(stage.x + stage.w * 0.3);
});

test('the fright actually plays when he sees the ditch', async ({ page }) => {
  await boot(page, { fast: 2 });
  await autoDrive(page);
  await waitState(page, 'GLACIER_BREAK_1', 90000);
  const trail = await page.evaluate(async () => {
    const g = window.iceAgeGame;
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 14000) {
      const p = g._player();
      const [sheet, idx] = g.mammothFrame().split(':');
      seen.push({
        st: g.state(), anim: p.state, t: +p.t.toFixed(3), sheet, idx: +idx,
        scare: +p.scare.toFixed(3), wobX: +p.wobX.toFixed(2),
        lean: +p.lean.toFixed(2), gulp: +p.gulp.toFixed(2)
      });
      if (g.state() === 'PHASE_ACTIVE' && seen.length > 60) break;
      await new Promise(r => requestAnimationFrame(r));
    }
    return seen;
  });
  const shake = trail.filter(s => s.anim === 'SHAKE');
  const shakeFrames = shake.length;
  /* THE DURATION, not the sample count. Sampling once per animation frame counts
     FRAMES, and a headless runner compositing a 1920x1080 canvas manages about half
     of them — so a threshold on the count fails on a slow machine while the fright it
     is measuring is playing perfectly. p.t is the state's own clock. */
  const shakeHeld = shake.length ? Math.max(...shake.map(s => s.t)) : 0;
  const maxWob = Math.max(...trail.map(s => Math.abs(s.wobX)));
  const maxLean = Math.max(...trail.map(s => Math.abs(s.lean)));
  const maxScare = Math.max(...trail.map(s => s.scare));
  const gulps = trail.filter(s => s.gulp > 0.9).length;
  // what the fright is DRAWN from, which is the thing this test is really about
  const sheets = [...new Set(shake.map(s => s.sheet))];
  const distinct = new Set(shake.map(s => s.idx)).size;
  console.log('SHAKE frames =', shakeFrames, '| held for', shakeHeld + 's',
    '| sheet(s)', sheets.join(','), '| distinct art frames', distinct,
    '| max scare =', maxScare, '| max |wobX| =', maxWob,
    '| max |lean| =', maxLean, '| gulps', gulps);

  expect(shakeHeld, 'the fright holds for a real length of time').toBeGreaterThan(0.9);
  expect(shakeFrames, 'and is drawn on many frames').toBeGreaterThan(6);

  /* IT IS THE DELIVERED ANIMATION, and that is a change of substance rather than of
     numbers. This used to assert a procedural wobble and a recoil-then-lean, because
     the fright had no art of its own and was a sine wave applied on top of a held
     frame. There is a 36-frame delivered fright now, so what has to be true is that
     the SHEET plays: same sheet throughout, and many distinct frames of it.

     Twice during this change a missing symbol threw once per frame inside update(),
     which aborted it partway and left the animation stuck on frame 0 — and a frozen
     sheet is indistinguishable from a held pose in a screenshot. Asserting on the
     count of distinct frames is what catches that. */
  expect(sheets, 'the fright is drawn from its own sheet').toEqual(['shake']);
  expect(distinct, 'and the sheet actually advances').toBeGreaterThan(6);

  /* AND THE OLD SHUDDER STAYS GONE. Removed on request: two performances of one beat
     fight rather than add, and a sine wave shoving the sprite sideways over a drawn
     reaction reads as the picture vibrating. This is the guard against it creeping
     back the next time someone wants the fright to feel stronger. */
  expect(maxWob, 'no procedural wobble on top of the art').toBe(0);
  expect(maxLean, 'and no procedural lean either').toBe(0);

  // scare itself still runs: it drives the sweat and the gulp, which are separate cues
  expect(maxScare, 'the fright amplitude still exists for the other cues').toBeGreaterThan(0.2);
});

/* A MISSED SWIPE IS ANSWERED BY SOUND, NOT MOTION.

   This used to assert that the ropes near the stroke jiggled. That feedback has been
   removed: the hanging options now hold perfectly still — no swing, no tilt, no settle
   bounce and no jiggle — because they are the question being asked and a question
   should not move while it is being read. So what a near miss must now do is exactly
   nothing to the options, and the whiff cue carries it.

   The assertion that matters either way is unchanged and is the important one: a stroke
   that crosses no rope must not cut anything. */
test('a swipe that misses every rope cuts nothing, and moves nothing', async ({ page }) => {
  await boot(page, { fast: 4 });
  await toPhase(page);
  await realTime(page);
  const geo = await page.evaluate(() => {
    const g = window.iceAgeGame.debug();
    const r = document.querySelector('#game-canvas').getBoundingClientRect();
    const xs = g.l1.shapes.map(s => s.anchorX).sort((a, b) => a - b);
    const mid = (xs[0] + xs[1]) / 2;      // between two ropes, through neither
    return {
      cx: r.x + mid / 1920 * r.width,
      y0: r.y + 250 / 1080 * r.height,
      y1: r.y + 330 / 1080 * r.height,
      span: (xs[1] - xs[0]) / 1920 * r.width
    };
  });
  const x0 = geo.cx - geo.span * 0.16;
  await page.mouse.move(x0, geo.y0);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x0 + i * geo.span * 0.04, geo.y0 + i * (geo.y1 - geo.y0) / 8);
  }
  await page.mouse.up();
  await page.waitForTimeout(90);
  const after = await page.evaluate(() => {
    const G = window.iceAgeGame.debug();
    return {
      state: G.state,
      jiggle: Math.max(...G.l1.shapes.map(s => s.jiggle || 0)),
      // how many ropes answered: a miss must not single one of them out
      reacted: G.l1.shapes.filter(s => (s.jiggle || 0) > 0.05).length,
      shapes: G.l1.shapes.length
    };
  });
  console.log('ROPES', JSON.stringify(await ropes(page)));
  console.log('MISSED SWIPE ->', JSON.stringify(after), 'geo', JSON.stringify(geo));
  expect(after.state, 'nothing was cut').toBe('PHASE_ACTIVE');
  expect(after.shapes, 'every option is still hanging').toBe(3);
  expect(after.jiggle, 'and not one of them moved').toBe(0);
});

test('a real swipe across a rope cuts it', async ({ page }) => {
  await boot(page, { fast: 4 });
  await toPhase(page);
  await realTime(page);
  const geo = await page.evaluate(() => {
    const g = window.iceAgeGame.debug();
    const r = document.querySelector('#game-canvas').getBoundingClientRect();
    const sh = g.l1.shapes[0];
    return {
      x: r.x + sh.anchorX / 1920 * r.width,
      y: r.y + 300 / 1080 * r.height,
      step: 120 / 1920 * r.width, kind: sh.kind
    };
  });
  await page.mouse.move(geo.x - geo.step, geo.y - 20);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(geo.x - geo.step + i * geo.step / 5, geo.y - 20 + i * 4);
  }
  await page.mouse.up();
  await page.waitForTimeout(140);
  /* Asserted on what the cut LEAVES, not on the state it passes through: PHASE_WRONG
     ends when the chunk has finished falling, so a slow round trip can miss it
     entirely and report an input that worked as an input that did nothing. */
  const st = await page.evaluate(() => {
    const G = window.iceAgeGame.debug();
    return {
      state: G.state, attempts: G.attempts,
      hanging: G.l1 ? G.l1.shapes.filter(s => s.state === 'hang').length : -1,
      cutRopes: G.l1 && G.l1.stubs ? G.l1.stubs.length : 0
    };
  });
  console.log('ROPES', JSON.stringify(await ropes(page)));
  console.log('REAL SWIPE on', geo.kind, 'geo', JSON.stringify(geo), '->', JSON.stringify(st));
  expect(st.attempts, 'the swipe registered as an attempt').toBe(1);
  expect(st.cutRopes, 'a rope was really severed').toBe(1);
  expect(st.hanging, 'one option has left the row').toBe(2);
});

test('tapping the mammoth reacts, and changes nothing', async ({ page }) => {
  await boot(page, { fast: 4 });
  await toPhase(page);
  const before = await page.evaluate(() => {
    const G = window.iceAgeGame.debug();
    return { state: G.state, phase: G.phase, unfilled: G.l1.unfilled.length };
  });
  const pt = await page.evaluate(() => {
    const r = document.querySelector('#game-canvas').getBoundingClientRect();
    return { x: r.x + 430 / 1920 * r.width, y: r.y + 700 / 1080 * r.height };
  });
  /* THE PEAK, NOT A SNAPSHOT — and stop fast-forwarding first.
   *
   * hop and scare are both DECAYING values, so what is being asserted is that they
   * were raised at all. Reading them once after a fixed 60ms wall-clock wait measured
   * something else entirely: with ?fast=4 each rendered frame advances four capped dt
   * steps, so on a slow renderer a single frame burns ~130ms of GAME time and the whole
   * reaction can be over before the read. It passed for months and then failed under
   * parallel load, reporting that the character had not reacted when it plainly had.
   *
   * So: back to real time for the poke, because the decay is the thing being watched
   * and fast-forwarding it is actively wrong here; and take the maximum over a few
   * frames rather than one sample, which is what "he reacted" actually means. */
  await page.evaluate(() => window.iceAgeGame.setOptions({ fast: 1 }));
  await page.mouse.click(pt.x, pt.y);
  const after = await page.evaluate(async () => {
    const g = window.iceAgeGame;
    let hop = 0, scare = 0;
    for (let i = 0; i < 8; i++) {
      const p = g._player();
      hop = Math.max(hop, p.hop);
      scare = Math.max(scare, p.scare);
      await new Promise(r => requestAnimationFrame(r));
    }
    const G = g.debug();
    return {
      state: G.state, phase: G.phase, unfilled: G.l1.unfilled.length,
      hop: +hop.toFixed(2), scare: +scare.toFixed(3)
    };
  });
  console.log('POKE', JSON.stringify(before), '->', JSON.stringify(after));
  expect(after.hop + after.scare, 'he reacted').toBeGreaterThan(0.1);
  expect(after.state, 'the puzzle is untouched').toBe(before.state);
  expect(after.unfilled).toBe(before.unfilled);
});

test('shots of every beat', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one set of frames is enough');
  await boot(page, { fast: 3 });
  await autoDrive(page);
  const shot = n => page.screenshot({ path: `test-results/qa-${n}.png` });
  await page.waitForTimeout(500); await shot('01-run');
  await waitState(page, 'GLACIER_BREAK_1', 90000);
  await page.waitForTimeout(900); await shot('02-break');
  await waitState(page, 'PHASE_INTRO', 30000);
  await page.waitForTimeout(220); await shot('03-fright');
  await page.waitForTimeout(800); await shot('04-peer');
  await waitState(page, 'PHASE_ACTIVE', 30000);
  await page.waitForTimeout(250); await shot('05-active');
  const bad = await page.evaluate(() => {
    const g = window.iceAgeGame.debug();
    const b = g.l1.shapes.find(s => s.state === 'hang' && !g.l1.unfilled.includes(s.kind));
    return b ? b.kind : null;
  });
  await page.evaluate(k => window.iceAgeGame._cut(k), bad);
  await page.waitForTimeout(320); await shot('06-wrong');
  await waitState(page, 'PHASE_ACTIVE', 30000);
  const good = await page.evaluate(() => window.iceAgeGame.debug().l1.unfilled[0]);
  await page.evaluate(k => window.iceAgeGame._cut(k), good);
  await page.waitForTimeout(430); await shot('07-wedge');
  await page.waitForTimeout(800); await shot('08-mended');
});

/* EVERY SHAPE, WITH ITS RING, at the size the game draws it.

   The ring traced off the artwork is what the game reasons about and what it clips
   the picture to, so if the two are misregistered the learner is counting the corners
   of one polygon while the outline draws another. That is exactly what was happening:
   seat() rotates a ring and then re-centres it on its new bounding box, and the
   artwork transform was given the rotation and the scale but not the re-centring.

   This walks all seven phases and crops the option row out of each, so all fourteen
   shapes can be checked at once against the outline they are supposed to fill. */
test('every option shape sits on its own outline', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one set of frames is enough');
  test.setTimeout(300000);
  await boot(page, { fast: 8 });
  await autoDrive(page);
  for (let ph = 0; ph < 7; ph++) {
    await waitState(page, 'PHASE_ACTIVE', 120000);
    await page.waitForTimeout(120);
    const info2 = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      return {
        phase: G.phase,
        kinds: G.l1.shapes.map(s => s.kind),
        instruction: G.instruction
      };
    });
    // the option row: y 300..660 of the 1080 stage, right of the character
    await page.screenshot({
      path: `test-results/qa-shapes-p${info2.phase + 1}.png`,
      clip: { x: 740, y: 300, width: 1160, height: 380 }
    });
    console.log('phase', info2.phase + 1, JSON.stringify(info2.instruction), info2.kinds.join(' '));
    // answer it and move on
    await page.evaluate(async () => {
      const g = window.iceAgeGame;
      for (let i = 0; i < 4000; i++) {
        const G = g.debug();
        if (!G.l1) break;
        if (G.state === 'PHASE_ACTIVE' && G.l1.unfilled.length) g._cut(G.l1.unfilled[0]);
        if (G.state === 'PHASE_DONE' || !G.l1) break;
        await new Promise(r => requestAnimationFrame(r));
      }
    });
  }
});

test('the cover and its PLAY button', async ({ page }, info) => {
  await page.goto('/index.html?sound=0');
  await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 90000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/qa-cover-${info.project.name}.png` });
  const b = await box(page, '#btn-play');
  const stage = await box(page, '#stage');
  console.log(info.project.name, 'PLAY', JSON.stringify(b), 'stage', stage.w + 'x' + stage.h);
  expect(b.bg, 'the supplied art').toContain('btn-play');
  expect(b.w).toBeGreaterThan(120);
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.screenshot({ path: `test-results/qa-play-pressed-${info.project.name}.png` });
  const pressed = await box(page, '#btn-play');
  console.log(info.project.name, 'PRESSED bg =', pressed.bg);
  expect(pressed.bg, 'the press is the other picture').toContain('btn-play-pressed');
  await page.mouse.up();
});

/* THE PATH JOINS.

   The path art is a finished segment, not a seamless tile, so butting copies of it
   left a hard vertical seam down through the snow, the ice and the rock — visible
   once every ~1900px, which is every 3.7s of running. Alternate tiles are now
   mirrored so every join meets its own reflection. This walks the world past several
   joins and captures the ground strip each time, so the fix can be looked at rather
   than argued about. */
test('the path tiles without a seam', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one set of frames is enough');
  await boot(page, { fast: 1 });
  const tw = await page.evaluate(() => window.iceAgeGame._ground().tw);
  console.log('tile width =', tw);
  for (let i = 0; i < 4; i++) {
    // park the world so a join sits near the middle of the screen
    await page.evaluate(w => { window.iceAgeGame.debug().worldX = w; }, tw * (i + 1) - 960);
    await page.waitForTimeout(120);
    await page.screenshot({
      path: `test-results/qa-seam-${i}.png`,
      clip: { x: 700, y: 850, width: 520, height: 230 }
    });
  }
});

/* ONE COLLISION SHOULD COST ONE STRIKE.

   The three-strike valve exists so a learner who cannot time the jump is never stuck:
   on the third failure the rock crumbles and the run continues. But the collision test
   ran while the world was STOPPED behind the Ouch panel — the rock stays exactly where
   it is, the 1.1s grace expires, and it hits again, and again. So one bump burned all
   three strikes in 2.2 seconds and the player never got a second real attempt. */
test('walking into a rock costs one strike, not three', async ({ page }) => {
  await boot(page, { fast: 1 });
  const r = await page.evaluate(async () => {
    const g = window.iceAgeGame;
    g._force('JUMP_CHALLENGE_1');
    const t0 = Date.now();
    // never jump: walk straight into it and wait out three grace periods
    while (Date.now() - t0 < 9000) {
      if (g.debug().state === 'OBSTACLE_HIT' && Date.now() - t0 > 5000) break;
      await new Promise(res => requestAnimationFrame(res));
    }
    const G = g.debug();
    return { state: G.state, hitCount: G.hitCount, oops: G.oops };
  });
  console.log('AFTER ONE BUMP ->', JSON.stringify(r));
  expect(r.hitCount, 'one collision, one strike').toBe(1);
  expect(r.state, 'the panel is up and waiting').toBe('OBSTACLE_HIT');
});
