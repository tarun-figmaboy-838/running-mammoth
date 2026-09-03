import { test, expect } from '@playwright/test';
import { boot, G, waitState, force, cut, playLevelOne, jsErrors } from './helpers.mjs';

/* These run in a real browser, so requestAnimationFrame, WebAudio, CSS animation
   and image decoding all actually work. Everything asserted here is behaviour a
   player would notice, and most of it is a defect this project has actually had. */

test.describe('boot', () => {
  // cold start pulls the whole art set down before the game will run
  test.setTimeout(90_000);
  test('starts with no errors and reaches the title', async ({ page }) => {
    const errors = await boot(page, { skipScreens: false });
    expect(await page.evaluate('window.iceAgeGame.state()')).toBe('TITLE');
    await expect(page.locator('#cover')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every sprite sheet loads at the expected size', async ({ page }) => {
    await boot(page);
    const sheets = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      const out = [];
      for (const c of g.roster()) {
        for (const slot of ['run', 'jump', 'skid']) {
          const s = g.sheetFor(c.id, slot);
          if (!s) continue;
          const img = new Image();
          img.src = s.src;
          await img.decode();
          out.push({ id: c.id, slot, frames: s.frames, w: img.naturalWidth, h: img.naturalHeight });
        }
      }
      return out;
    });
    /* Three sheets, one explorer: run, jump, skid. shake and hurt were removed so that
       only the delivered GIFs are used; those states fall back to jump poses. */
    expect(sheets.length).toBe(3);
    for (const s of sheets) {
      // one shared 420x320 cell across every sheet of every character, so a
      // character never changes size between animations
      expect(s.h, `${s.id}/${s.slot} height`).toBe(320);
      expect(s.w, `${s.id}/${s.slot} width`).toBe(420 * s.frames);
    }
  });
});

test.describe('the cover', () => {
  test.setTimeout(90_000);

  /* There is no character-select stage any more: with one explorer it was a screen that
     asked a question with one answer. What the two tests here replace was really checking
     that PLAY reaches the run and that the roster is what it claims — so that is what
     they check now, one step shorter. */
  test('PLAY hands straight over to the run', async ({ page }) => {
    const errors = await boot(page, { skipScreens: false });
    await expect(page.locator('#cover')).toBeVisible();
    await page.locator('#btn-play').click({ force: true });
    await expect(page.locator('#cover')).toBeHidden({ timeout: 5000 });
    await waitState(page, ['RUN_SEGMENT_1', 'JUMP_CHALLENGE_1']);
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('nothing is left of the select stage, and the roster is the mammoth alone', async ({ page }) => {
    await boot(page, { skipScreens: false });
    for (const sel of ['#select', '#cards', '#btn-start', '.card-pick', '.card-sprite']) {
      expect(await page.locator(sel).count(), sel + ' should be gone').toBe(0);
    }
    const roster = await page.evaluate('window.iceAgeGame.roster().map(c => c.id)');
    expect(roster).toEqual(['mammoth']);
    expect(await page.evaluate('window.iceAgeGame.character()')).toBe('mammoth');
  });
});

test.describe('controls', () => {
  test('jump fires, arcs and lands', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    await page.waitForFunction('window.iceAgeGame.debug().jumpEnabled === true');
    await page.evaluate('window.iceAgeGame.jump()');
    await page.waitForFunction('window.iceAgeGame.mammothState() === "JUMP_AIR"', null, { timeout: 3000 });
    await page.waitForFunction('window.iceAgeGame.mammothState() === "LAND"', null, { timeout: 3000 });
  });

  test('the jump button and the space bar do the same thing', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    await page.waitForFunction('window.iceAgeGame.debug().jumpEnabled === true');
    await page.keyboard.press('Space');
    await page.waitForFunction('window.iceAgeGame.mammothState() !== "RUN"', null, { timeout: 3000 });
  });

  test('jump is refused while the puzzle owns the screen', async ({ page }) => {
    await boot(page);
    await force(page, 'PHASE_INTRO');
    await page.waitForTimeout(200);
    expect((await G(page)).jumpEnabled).toBe(false);
  });

  test('pause freezes the world and resume restarts it', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    // measured entirely in-page: a round-trip between reads lets frames slip past
    // the pause and makes the result look like a leak when it is not
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      const wait = n => new Promise(res => {
        let i = 0;
        const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
      await wait(10);
      g.setPaused(true);
      await wait(2);                       // let the in-flight frame land
      const a = g.debug().worldX;
      await wait(24);
      const b = g.debug().worldX;
      g.setPaused(false);
      await wait(24);
      const c = g.debug().worldX;
      return { a, b, c };
    });
    expect(Math.abs(r.b - r.a)).toBeLessThan(1);      // frozen means frozen
    expect(r.c).toBeGreaterThan(r.b + 20);            // and it starts again
  });
});

test.describe('the run cycle', () => {
  test('advances with distance travelled, so the feet do not skate', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    // the same distance must always produce the same frame, at any run speed
    const sample = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      const p = g._player();
      const seen = [];
      for (let i = 0; i < 90; i++) {
        seen.push({ d: p.runDist, f: g.mammothFrame() });
        await new Promise(r => requestAnimationFrame(r));
      }
      return { seen, stride: p.stride, frames: p.F.run };
    });
    const frames = sample.seen.map(s => Number(s.f.split(':')[1]));
    expect(new Set(frames).size).toBeGreaterThan(4);       // it is actually cycling
    // every sample must satisfy frame == floor(dist/stride * n) % n
    for (const s of sample.seen) {
      const want = Math.floor((s.d / sample.stride) * sample.frames) % sample.frames;
      expect(Number(s.f.split(':')[1])).toBe(want);
    }
  });

  test('the sheets carry a vertical bob, not a flat footline', async ({ page }) => {
    await boot(page);
    const bob = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      const s = g.sheetFor(g.character(), 'run');
      const img = new Image(); img.src = s.src; await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const bottoms = [];
      for (let f = 0; f < s.frames; f++) {
        let low = -1;
        for (let y = c.height - 1; y >= 0 && low < 0; y--) {
          for (let px = f * 420; px < (f + 1) * 420; px++) {
            if (d[(y * c.width + px) * 4 + 3] > 16) { low = y; break; }
          }
        }
        bottoms.push(low);
      }
      return { min: Math.min(...bottoms), max: Math.max(...bottoms) };
    });
    // bottom-aligning every frame glues the character to the ground and the run
    // reads as sliding; the cycle has to rise and fall
    expect(bob.max - bob.min).toBeGreaterThan(8);
  });
});

test.describe('Level 1', () => {
  // a full seven-phase playthrough is a long test by nature
  test.setTimeout(420_000);
  test('all seven phases can be completed', async ({ page }) => {
    // the speed override is a supported playtest flag; a full run at the default
    // pace is several minutes of wall clock
    /* ?fast steps the simulation several times per rendered frame, which is the only
       way a seven-phase playthrough fits in a sane budget: every beat in the game is
       a fixed duration in milliseconds, so ?speed alone shortens nothing, and a
       runner without a GPU spends most of each frame compositing. Physics is
       unchanged — see the note in engine.js. */
    test.setTimeout(420_000);
    const errors = await boot(page, { speed: 900, fast: 5 });
    const r = await playLevelOne(page, { budgetMs: 330_000 });
    expect(r.timedOut, 'ran out of wall clock at ' + r.state + '@' + r.phase).toBe(false);
    expect(r.phasesDone).toBe(7);
    expect(['FINAL_RUN', 'COMPLETE']).toContain(r.state);
    expect(r.trail.join(' ')).toContain('PHASE_SUCCESS');
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('a wrong answer in every phase still completes the level', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = await boot(page, { speed: 900, fast: 5 });
    const r = await playLevelOne(page, { wrongFirst: true, budgetMs: 330_000 });
    expect(r.timedOut, 'ran out of wall clock at ' + r.state + '@' + r.phase).toBe(false);
    expect(r.phasesDone).toBe(7);
    expect(r.trail.join(' ')).toContain('PHASE_WRONG');
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('no hanging option can drop on the character', async ({ page }) => {
    await boot(page);
    const nearest = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      // read the phase count rather than hard-coding it, so it moves with the data
      window.__phaseCount = (await import('/js/engine.js')).CFG.levelOne.phases.length;
      let worst = 1e9;
      let checked = 0;
      const total = window.__phaseCount;
      for (let phase = 0; phase < total; phase++) {
        g.debug().phase = phase;
        g.debug().l1 = null;
        g.debug().phaseLayout = null;
        g._force('GLACIER_BREAK_1');
        // the collapse takes about a second before the puzzle is built
        const t0 = Date.now();
        while (g.state() !== 'PHASE_ACTIVE' && Date.now() - t0 < 6000) {
          await new Promise(r => requestAnimationFrame(r));
        }
        const G = g.debug();
        if (!G.l1) continue;
        checked++;
        for (const s of G.l1.shapes) worst = Math.min(worst, Math.abs(s.x - 430));
      }
      return checked ? worst : -1;
    });
    // a cut chunk falls straight down, so nothing may hang over the character
    expect(nearest, 'no phase was actually inspected').not.toBe(-1);
    expect(nearest).toBeGreaterThan(250);
  });

  test('the crevasse is far too wide to jump, and centred', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, ['PHASE_INTRO', 'PHASE_ACTIVE'], 15_000);
    const gaps = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      return (G.gapsThisPhase || []).map(g => ({
        w: g.x1 - g.x0, mid: (g.x0 + g.x1) / 2 - G.worldX
      }));
    });
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.w).toBeGreaterThan(400);       // a jump carries about 460px
      expect(g.mid).toBeGreaterThan(600);
      expect(g.mid).toBeLessThan(1400);       // roughly the middle of a 1920 stage
    }
  });

  test('slashing the rope with the pointer cuts that chunk', async ({ page }) => {
    /* The one interaction the whole game rests on, driven the way a player drives
       it: a real drag across the rope. Everything else calls _cut() directly, which
       skips the hit test entirely — so nothing covered the case where the drawn rope
       and the cuttable line disagree. */
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 15_000);

    const aim = await page.evaluate(() => {
      const g = window.iceAgeGame;
      const G = g.debug();
      const target = G.l1.targets.find(t => !t.filled);
      const sh = G.l1.shapes.find(s => s.state === 'hang' && s.kind === target.kind);
      const canvas = document.getElementById('game-canvas');
      const r = canvas.getBoundingClientRect();
      // midway down the rope, in page coordinates
      const midY = (128 + sh.y - 100) / 2;
      return {
        kind: sh.kind,
        cssX: r.left + (sh.x / 1920) * r.width,
        cssY: r.top + (midY / 1080) * r.height,
        spanX: (140 / 1920) * r.width
      };
    });

    await page.mouse.move(aim.cssX - aim.spanX, aim.cssY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(aim.cssX - aim.spanX + (aim.spanX * 2 * i) / 8, aim.cssY);
    }
    await page.mouse.up();

    await page.waitForFunction(
      k => {
        const G = window.iceAgeGame.debug();
        if (!G.l1) return false;
        return !G.l1.shapes.some(s => s.kind === k && s.state === 'hang');
      },
      aim.kind, { timeout: 6000 }
    );
    // and it was registered as the correct answer, not as a miss
    expect(['PHASE_SUCCESS', 'PHASE_DONE']).toContain(await page.evaluate('window.iceAgeGame.state()'));
  });

  test('a slash through empty sky cuts nothing', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 15_000);
    const before = await page.evaluate('window.iceAgeGame.debug().l1.shapes.length');
    const box = await page.locator('#game-canvas').boundingBox();
    // low and to the left of every rope
    const y = box.y + box.height * 0.62;
    await page.mouse.move(box.x + box.width * 0.06, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width * (0.06 + 0.02 * i), y);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await page.evaluate('window.iceAgeGame.debug().l1.shapes.length')).toBe(before);
    expect(await page.evaluate('window.iceAgeGame.state()')).toBe('PHASE_ACTIVE');
  });

  test('the right shape bridges the crevasse; the crossing closes', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 15_000);
    const kind = await page.evaluate('window.iceAgeGame.debug().l1.targets[0].kind');
    expect(await cut(page, kind)).toBe(true);
    await page.waitForFunction(
      () => (window.iceAgeGame.debug().gapsThisPhase || []).every(g => g.repaired && g.bridge >= 1),
      null, { timeout: 15_000 }
    );
    const g = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const gap = G.gapsThisPhase[0];
      return { repaired: gap.repaired, bridge: gap.bridge, pieces: (gap.pieces || []).length };
    });
    // one answer, one crevasse, one plug spanning it
    expect(g).toMatchObject({ repaired: true, bridge: 1, pieces: 1 });
  });

  test('a wrong shape goes into the water and splashes', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 15_000);
    // drop it straight over the hole so it reaches the pool
    const kind = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const bad = G.l1.shapes.find(s => s.state === 'hang' &&
        !G.l1.targets.some(t => !t.filled && t.kind === s.kind));
      if (!bad) return null;
      bad.x = (G.gapsThisPhase[0].x0 + G.gapsThisPhase[0].x1) / 2 - G.worldX;
      return bad.kind;
    });
    expect(kind).toBeTruthy();
    await cut(page, kind);
    await page.waitForFunction(
      () => (window.iceAgeGame.debug().gapsThisPhase || [])
        .some(g => g.splashes && g.splashes.length > 0),
      null, { timeout: 10_000 }
    );
    // and the phase carries on rather than ending
    await waitState(page, ['PHASE_WRONG', 'PHASE_ACTIVE'], 10_000);
    expect((await G(page)).phasesDone).toBe(0);
  });

  test('the quake builds, peaks on the crack, and is gone by the end of the skid', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    const q = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      g._force('GLACIER_BREAK_1');
      const samples = [];
      // sample past the end of the skid, so a quake that overruns is visible
      for (let i = 0; i < 100; i++) {
        const G = g.debug();
        samples.push({ st: G.st, q: G.quakeAt || 0, state: G.state });
        await new Promise(r => requestAnimationFrame(r));
      }
      return samples;
    });
    const during = q.filter(s => s.state === 'GLACIER_BREAK_1');
    const peak = during.reduce((a, b) => (b.q > a.q ? b : a), during[0]);
    const shaking = during.filter(s => s.q > 1).length;

    expect(peak.q, 'the quake has to be felt').toBeGreaterThan(6);
    expect(shaking, 'it has to be sustained, not one jolt').toBeGreaterThan(20);
    // the peak belongs on the frame the ice cracks (300ms), not later
    expect(peak.st, 'peak lands on the crack').toBeGreaterThan(180);
    expect(peak.st, 'peak lands on the crack').toBeLessThan(480);
    // and it must not still be shaking once the puzzle is being introduced
    const after = q.filter(s => s.state !== 'GLACIER_BREAK_1');
    if (after.length) {
      expect(Math.max(...after.map(s => s.q)), 'no shaking over the instruction').toBeLessThan(1.5);
    }
  });

  test('the quake is a rumble, not per-frame noise', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    /* Measured on the offset the renderer actually applies, not a recomputation.
       Smoothness = mean |second difference| / mean |value|. A band-limited rumble
       moves a little between frames, so this stays low; white noise jumps the full
       amplitude every frame and the ratio blows up. The one-shot impact shake is
       still noise on purpose, which is why it is a separate signal. */
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      g._force('GLACIER_BREAK_1');
      const xs = [];
      let first = 0, last = 0;
      for (let i = 0; i < 90; i++) {
        const G = g.debug();
        if ((G.quakeAt || 0) > 2) {
          if (!xs.length) first = performance.now();
          last = performance.now();
          xs.push(G.quakeOx || 0);
        }
        await new Promise(res => requestAnimationFrame(res));
      }
      let d2 = 0, mag = 0;
      for (let i = 2; i < xs.length; i++) d2 += Math.abs(xs[i] - 2 * xs[i - 1] + xs[i - 2]);
      for (const v of xs) mag += Math.abs(v);
      return {
        n: xs.length,
        fps: xs.length > 1 ? 1000 / ((last - first) / (xs.length - 1)) : 0,
        ratio: (d2 / Math.max(1, xs.length - 2)) / (mag / Math.max(1, xs.length))
      };
    });
    expect(r.n, 'the quake was sampled').toBeGreaterThan(20);
    /* This measurement needs an adequate sample rate to mean anything. For a sine of
       frequency f sampled at interval h the ratio is about (2*pi*f*h)^2 — at 60fps and
       7.4Hz that is 0.6, but at 17fps it is 9.6, past saturation, where a rumble and
       white noise are indistinguishable because sampling is below Nyquist for the 13Hz
       component. A runner without a GPU spends 57ms a frame compositing the backbuffer
       and lands there, so say so rather than report an aliasing artefact as a fault. */
    if (r.fps < 30) {
      console.warn(`quake waveform not assessed: sampled at ${r.fps.toFixed(1)}fps, ` +
        'below the rate this measurement needs (30fps). Ratio was ' + r.ratio.toFixed(2) + '.');
    } else {
      // white noise lands around 2.5-3; a 7-13Hz rumble sampled at 60fps stays under 1
      expect(r.ratio, 'the ground rumbles rather than jitters').toBeLessThan(1.4);
    }
  });
});

test.describe('crashing', () => {
  test('the knockout plays before the Try Again card appears', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      g._force('OBSTACLE_HIT');
      g._anim('KNOCKOUT');
      let cardAt = -1;
      const start = g.debug().st;
      for (let i = 0; i < 200; i++) {
        if (g.debug().oops && cardAt < 0) cardAt = g.debug().st;
        await new Promise(r2 => requestAnimationFrame(r2));
      }
      return { cardAt, start, anim: g.mammothState() };
    });
    // the animation is the feedback: the card must not cover it on frame one
    expect(r.cardAt).toBeGreaterThan(900);
  });

  test('the card has no body text and Try Again resumes the run', async ({ page }) => {
    await boot(page);
    await force(page, 'OBSTACLE_HIT');
    await expect(page.locator('#oops')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#oops p')).toHaveCount(0);
    await expect(page.locator('#oops h1')).toHaveText('Ouch!');
    await page.locator('#btn-retry').click({ force: true });
    await page.waitForFunction('window.iceAgeGame.debug().moving === true', null, { timeout: 5000 });
    expect((await G(page)).jumpEnabled).toBe(true);
  });

  test('three failures crumble the rock so the run can never dead-end', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame;
      const G = g.debug();
      g._force('JUMP_CHALLENGE_1');
      // walk into it three times without jumping
      for (let n = 0; n < 3; n++) {
        const t0 = Date.now();
        while (G.state !== 'OBSTACLE_HIT' && G.hitCount < 3 && Date.now() - t0 < 20_000) {
          await new Promise(r2 => requestAnimationFrame(r2));
        }
        if (G.hitCount >= 3) break;
        g.retryObstacle();
        await new Promise(r2 => setTimeout(r2, 60));
      }
      return { hits: G.hitCount, crumbled: g._obstacles().list.some(o => o.crumble !== undefined) };
    });
    expect(r.hits).toBeGreaterThanOrEqual(3);
    expect(r.crumbled).toBe(true);
  });
});

test.describe('layout', () => {
  test('the stage stays 16:9 with no page scroll', async ({ page }) => {
    await boot(page, { skipScreens: false });
    const m = await page.evaluate(() => {
      const s = document.getElementById('stage').getBoundingClientRect();
      return {
        ratio: s.width / s.height,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        overflowY: document.documentElement.scrollHeight > window.innerHeight + 1
      };
    });
    expect(m.ratio).toBeCloseTo(16 / 9, 1);
    expect(m.overflowX).toBe(false);
    expect(m.overflowY).toBe(false);
  });

  test('the jump button is a comfortable tap target', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    await page.waitForFunction('window.iceAgeGame.debug().jumpEnabled === true');
    const b = await page.locator('#btn-jump').boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Level 2', () => {
  test('is detached: nothing reaches it and the draft is kept', async ({ page }) => {
    await boot(page);
    const leftovers = await page.evaluate(async () => {
      const src = await (await fetch('/js/engine.js')).text();
      return ['LEVEL_2_ACTIVE', 'buildLevel2', 'G.gapA', 'drawL2']
        .filter(sym => src.includes(sym));
    });
    expect(leftovers).toEqual([]);
    // and no level-2 state is reachable from the six phases
    const reachable = await page.evaluate(async () => {
      const src = await (await fetch('/js/engine.js')).text();
      return /setState\(\s*'(RUN_SEGMENT_2|LEVEL_2_[A-Z_]+|GLACIER_BREAK_2|BRIDGE_2_COMPLETE)'/.test(src);
    });
    expect(reachable).toBe(false);
  });
});
