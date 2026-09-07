/* THE TREMBLE AT THE EDGE, THE STOP, THE COMEDY CRASH, THE TIED ROPE — the owner's brief:
   the 12-frame tremble replaces the trample and is played by a timing plan; once he has
   stopped the feet stop (the wait is the idle loop); a crash throws stars at the impact with
   its own sound; the rope carries a knot at the block. */
import { test, expect } from '@playwright/test';
import { boot, force, waitState } from './helpers.mjs';

test.describe('the tremble, the stop and the crash', () => {
  test.setTimeout(120_000);

  test('the tremble sheet is listed, 12 frames, and the plan is the acted sequence', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
      const m = await import('/js/engine.js');
      const c = m.CFG.characters[0], TP = m.CFG.sprite.tremble;
      const total = TP.plan.reduce((a, s) => a + s[1], 0);
      const strong = TP.plan.slice(TP.strong[0], TP.strong[1] + 1).map(s => s[0]);
      return { sheet: c.sheets.tremble, hd: c.hd.tremble, frames: c.frames.tremble, trample: c.sheets.trample || null,
               steps: TP.plan.length, total, strong, maxFrame: Math.max(...TP.plan.map(s => s[0])), first: TP.plan[0][0], last: TP.plan[TP.plan.length - 1][0] };
    });
    expect(r.sheet).toBe('assets/char/mammoth-tremble.webp');
    expect(r.hd).toBe('assets/char/hd/mammoth-tremble.webp');
    expect(r.frames).toBe(12);
    expect(r.trample, 'the trample is shelved, not fetched').toBeNull();
    // 1.6-2.2 s in all, frames 0..11, starting on the notice and ending on the settle
    expect(r.total).toBeGreaterThanOrEqual(1600); expect(r.total).toBeLessThanOrEqual(2200);
    expect(r.maxFrame).toBe(11); expect(r.first).toBe(0); expect(r.last).toBe(11);
    // the strong tremble is the 4-5-6-5 oscillation, twice
    expect(r.strong).toEqual([4, 5, 6, 5, 4, 5, 6, 5]);
  });

  test('at the edge he trembles once, by the plan, then waits on the idle with his feet still', async ({ page }) => {
    await boot(page, { fast: 1 });
    await force(page, 'GLACIER_BREAK_1');
    await page.waitForFunction(() => window.iceAgeGame.mammothState() === 'SHAKE', null, { timeout: 20_000 });
    const r = await page.evaluate(async () => {
      const p = window.iceAgeGame._player(); const seen = new Set(); let shook = false, fired = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 15000 && p.state === 'SHAKE') {      // a loaded runner plays game time at a third of wall time
        seen.add(p.lastSheet + ':' + p.lastFrame);
        if (Math.abs(p.wobX) > 0.5) shook = true;
        if (p.trembleFired) fired = true;
        await new Promise(res => requestAnimationFrame(res));
      }
      const after = p.state, sheet0 = p.lastSheet;
      await new Promise(res => setTimeout(res, 700));
      return { frames: [...seen].filter(k => k.startsWith('tremble')).length, shook, fired, after, sheet0, sheet1: p.lastSheet, wobAfter: Math.abs(p.wobX) };
    });
    // sampled once per animation frame under a loaded runner, so 62 ms steps are missed: many, not all
    expect(r.frames, 'the tremble sheet is what plays').toBeGreaterThanOrEqual(6);
    expect(r.shook, 'the secondary shake ran during the strong tremble').toBe(true);
    expect(r.fired, 'the sound fired').toBe(true);
    expect(r.after).toBe('LOOK_DOWN');
    expect(r.sheet0, 'the wait is the idle loop, not a stamp').toBe('idle');
    expect(r.sheet1).toBe('idle');
    expect(r.wobAfter, 'and nothing shakes him while he waits').toBeLessThan(0.01);
  });

  test('the crash throws stars at the impact and has its own sound', async ({ page }) => {
    await boot(page, { fast: 1 });
    await force(page, 'JUMP_CHALLENGE_1');
    await page.waitForFunction(() => window.iceAgeGame.debug().state === 'OBSTACLE_HIT', null, { timeout: 15_000 });
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame; const m = await import('/js/engine.js');
      const stars = g._particles().list.filter(p => p.kind === 'star' && !p.dead);
      const p = g._player();
      return { stars: stars.length, state: p.state, koCue: m.CFG.sfx.knockout && m.CFG.sfx.knockout.src, trembleCue: m.CFG.sfx.tremble && m.CFG.sfx.tremble.src,
               hits: m.SFX_HITS.knockout, minY: Math.min(...stars.map(s => s.y)), maxY: Math.max(...stars.map(s => s.y)) };
    });
    expect(r.state).toBe('KNOCKOUT');
    expect(r.stars, 'stars at the point of impact').toBeGreaterThanOrEqual(5);
    expect(r.maxY, 'around his head, not on the ground').toBeLessThan(900);
    expect(r.koCue).toContain('sad-trumpet');
    expect(r.trembleCue).toContain('cartoon-blinking');
    expect(r.hits, 'the cue is baked for the file:// build').toEqual([0.12]);
  });

  test('the rope art is one strip with a cord, a knot and a fray inside its bounds', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
      const m = await import('/js/engine.js'); const R = m.CFG.rope;
      const img = new Image(); img.src = '/' + R.src; await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight, R };
    });
    expect(r.w).toBe(r.R.artW);
    expect(r.R.cord[1]).toBeLessThanOrEqual(r.R.knot[0]);
    expect(r.R.knot[1]).toBeLessThanOrEqual(r.h);
    expect(r.R.fray[0]).toBeGreaterThan(r.R.knot[0]);
    expect((r.R.cord[1] - r.R.cord[0]) % r.R.seg, 'the slices tile the twist exactly').toBe(0);
  });

  test('the last tutorial line speaks over the running game without the veil; the frozen lines keep it', async ({ page }) => {
    test.setTimeout(300_000);     // the whole tutorial in real time, on a runner that may be at a third of speed
    await boot(page, { tutorial: true, skipScreens: true });
    const veilOn = () => page.evaluate(() => { const v = document.getElementById('tut-veil'); return v ? !v.hidden : null; });
    await page.waitForFunction(() => /This is Momo/.test(document.getElementById('tut-text').textContent), null, { timeout: 40_000 });
    expect(await veilOn(), 'a frozen describing line is veiled').toBe(true);
    await page.waitForFunction(() => /Tap to jump/.test(document.getElementById('tut-text').textContent), null, { timeout: 90_000 });
    /* Jump whenever a rock is in range until the ice breaks — a missed jump under a loaded
       test runner crashes, retries and comes round again, so one shot is not enough. */
    await page.evaluate(async () => {
      const g = window.iceAgeGame; const t0 = Date.now();
      while (Date.now() - t0 < 60000 && !/GLACIER_BREAK_1|PHASE_/.test(g.debug().state)) {
        const G = g.debug(); const L = g._obstacles().list.filter(o => !o.passed);
        if (L.length && L[0].x - G.worldX < 640 && L[0].x - G.worldX > 380 && g.mammothState() === 'RUN') g.jump();
        await new Promise(res => setTimeout(res, 40));
      }
    });
    // the owner's sequence: the whole tremble plays first, THEN the "Oh no" line comes
    await page.waitForFunction(() => /path is broken/.test(document.getElementById('tut-text').textContent), null, { timeout: 150_000 });
    const atOhNo = await page.evaluate(async () => {
      const m = await import('/js/engine.js'); const p = window.iceAgeGame._player();
      return { state: window.iceAgeGame.debug().state, anim: p.state, step: p.trembleStep, plan: m.CFG.sprite.tremble.plan.length, veil: !document.getElementById('tut-veil').hidden };
    });
    expect(atOhNo.state, 'he has stopped when the line comes').not.toBe('GLACIER_BREAK_1');
    expect(atOhNo.anim, 'the tremble has finished: he is on the idle wait').toBe('LOOK_DOWN');
    expect(atOhNo.step, 'every step of the plan was spent before the line').toBe(atOhNo.plan);
    expect(atOhNo.veil).toBe(true);
    /* THE TAIL POINTS AT THE DITCH (asked for): the shape's tip lands within a hand's width above
       the ice surface, horizontally inside the gap — not beside it, not floating over it.
       Measured once the pop-in (380 ms) and the first re-measure have settled. */
    await page.waitForTimeout(800);
    const aim = await page.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect(), k = 1920 / st.width;
      const sh = document.getElementById('tut-shape').getBoundingClientRect(), bb = document.getElementById('tut-bubble').getBoundingClientRect();
      const G = window.iceAgeGame.debug(), gp = G.gapsThisPhase[0], z = G.zoom || 1, fx = G.zoomVX, fy = G.zoomVY;
      const zx = x => fx + (x - fx) * z, zy = y => fy + (y - fy) * z;
      return { tipY: (sh.bottom - st.top) * k, surfaceY: zy(850), cx: ((bb.left + bb.right) / 2 - st.left) * k, gx0: zx(gp.x0 - G.worldX), gx1: zx(gp.x1 - G.worldX) };
    });
    expect(aim.tipY, 'the tip reaches the ice edge').toBeGreaterThan(aim.surfaceY - 40);
    expect(aim.tipY).toBeLessThan(aim.surfaceY + 40);
    expect(aim.cx, 'over the hole').toBeGreaterThan(aim.gx0); expect(aim.cx).toBeLessThan(aim.gx1);
    await page.waitForFunction(() => /right ice piece/.test(document.getElementById('tut-text').textContent), null, { timeout: 150_000 });
    await page.waitForTimeout(900);
    const box = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(), k = 1920 / st.width; const bb = document.getElementById('tut-bubble').getBoundingClientRect(); return { x0: (bb.left - st.left) * k, x1: (bb.right - st.left) * k }; });
    expect(box.x0, 'the option line stays on the stage').toBeGreaterThanOrEqual(0);
    expect(box.x1).toBeLessThanOrEqual(1920);
    await page.waitForFunction(() => { const L = window.iceAgeGame.debug().l1; return L && L.shapes.some(s => s.state === 'hang' && s.y > 400); }, null, { timeout: 20_000 });
    await page.evaluate(() => { const g = window.iceAgeGame; g._cut(g.debug().l1.unfilled[0]); });
    await page.waitForFunction(() => /Perfect fit/.test(document.getElementById('tut-text').textContent), null, { timeout: 30_000 });
    expect(await veilOn(), 'the reward line runs over a clear, moving scene').toBe(false);
  });

  test('a cut still parts the rope it crosses and leaves a stub (the bend never moves the hit line)', async ({ page }) => {
    await boot(page, { fast: 2 });
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 40_000);
    await page.waitForFunction(() => { const L = window.iceAgeGame.debug().l1; return L && L.shapes.some(s => s.state === 'hang' && s.y > 400); }, null, { timeout: 20_000 });
    const r = await page.evaluate(() => {
      const g = window.iceAgeGame, L = g.debug().l1; const s = L.shapes.find(q => q.state === 'hang' && q.kind !== L.unfilled[0]);
      const span = g._ropeSpan ? g._ropeSpan(s) : null;
      const x = s.anchorX, y = (s.y + s.pivot.y - 120) / 2 + 60;
      const c = document.getElementById('game-canvas'); const st = document.getElementById('stage').getBoundingClientRect();
      const toCss = (sx, sy) => ({ x: st.left + sx / 1920 * st.width, y: st.top + sy / 1080 * st.height });
      const a = toCss(x - 90, y), b = toCss(x + 90, y);
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: a.x, clientY: a.y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
      for (let i = 1; i <= 6; i++) c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: a.x + (b.x - a.x) * i / 6, clientY: a.y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: b.x, clientY: b.y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
      return { cut: s.cut, stubs: L.stubs.length, span: !!span };
    });
    expect(r.cut).toBe(true);
    expect(r.stubs).toBe(1);
  });
});
