/* THE RUNS GET HARDER. One obstacle in the tutorial; then two far apart; three spaced; one and a
   near pair; three consecutive timed jumps; a rock -> log -> bone combination; pairs either side
   of a breath. Held two ways: the table itself (monotone, and every gap clearable), and what the
   spawner actually puts on the ice for a given stretch. */
import { test, expect } from '@playwright/test';
import { boot } from './helpers.mjs';

test.describe('the difficulty curve of the runs', () => {
  test.setTimeout(120_000);

  test('the table tightens and grows, and every gap is clearable', async ({ page }) => {
    await boot(page);
    const t = await page.evaluate(() => {
      const g = window.iceAgeGame; const out = [];
      for (let i = 0; i < 6; i++) { const r = g._runPlan(i); out.push({ i, count: r.plan.room.length + 1, minRoom: Math.min(...r.plan.room), kinds: r.plan.kinds || null, leap: r.leap, speed: r.speed }); }
      return out;
    });
    expect(t.map(x => x.count)).toEqual([2, 3, 3, 3, 3, 4]);
    // the tightest gap of a stretch never loosens as the level goes on
    for (let i = 1; i < t.length; i++) expect(t[i].minRoom, `stretch ${i} vs ${i - 1}`).toBeLessThanOrEqual(t[i - 1].minRoom);
    expect(t[0].minRoom).toBeGreaterThanOrEqual(3);          // generous first
    expect(t[3].minRoom).toBeLessThanOrEqual(0.8);           // consecutive jumps by the fourth
    // a combination is named before the fifth puzzle
    expect(t[4].kinds).toEqual(['rock', 'log', 'bone']);
    // clearable: the leap is always added, and the room is at least half a second of running
    for (const x of t) expect(x.minRoom).toBeGreaterThanOrEqual(0.5);
    expect(t[0].leap).toBeGreaterThan(400);
  });

  test('the spawner lays a stretch out from its plan: spacing and families', async ({ page }) => {
    await boot(page, { fast: 1 });
    // stretch 4 is the combination: phase index 5 in the level (jumpBefore = [2,3,4,5,6,7])
    const laid = await page.evaluate(async () => {
      const g = window.iceAgeGame; const G = g.debug();
      G.phase = 5; G.phaseJumped = false;
      g._force('PHASE_RUN');
      const t0 = Date.now();
      while (Date.now() - t0 < 6000 && g._obstacles().list.length < 3) await new Promise(r => requestAnimationFrame(r));
      const r = g._runPlan(4);
      const L = g._obstacles().list.slice().sort((a, b) => a.x - b.x);
      const fam = k => g.obstacleName(k);
      return { n: L.length, gaps: L.slice(1).map((o, i) => o.x - L[i].x), expect: r.plan.room.map(room => Math.round(r.leap + r.speed * room)), families: L.map(o => fam(o.kind)) };
    });
    expect(laid.n).toBe(3);
    laid.gaps.forEach((gp, i) => expect(Math.abs(gp - laid.expect[i]), `gap ${i}`).toBeLessThanOrEqual(2));
    expect(laid.families).toEqual(['rock', 'log', 'bone']);
  });

  test('a respawn on the densest stretch lands on clear ground, never inside the cluster', async ({ page }) => {
    await boot(page, { fast: 1 });
    const r = await page.evaluate(async () => {
      const g = window.iceAgeGame; const G = g.debug();
      G.phase = 6; G.phaseJumped = false;
      g._force('PHASE_RUN');
      const t0 = Date.now();
      while (Date.now() - t0 < 15000 && g.debug().state !== 'OBSTACLE_HIT') await new Promise(res => requestAnimationFrame(res));   // walk into the first one
      const hit = g.debug().state === 'OBSTACLE_HIT';
      g.retryObstacle();
      await new Promise(res => requestAnimationFrame(res));
      let nearest = Infinity; for (const o of g._obstacles().list) { const sx = o.x - g.debug().worldX; if (!o.passed) nearest = Math.min(nearest, sx); }
      return { hit, nearest, hits: g.debug().hitCount };
    });
    expect(r.hit, 'the walk-in crashed').toBe(true);
    expect(r.nearest, 'the runway after a respawn is clear').toBeGreaterThan(1500);
    expect(r.hits).toBe(1);
  });

  test('the first stretch after the tutorial is two far-apart obstacles', async ({ page }) => {
    await boot(page, { fast: 1 });
    const laid = await page.evaluate(async () => {
      const g = window.iceAgeGame; const G = g.debug();
      G.phase = 1; G.phaseJumped = false;
      g._force('PHASE_RUN');
      const t0 = Date.now();
      while (Date.now() - t0 < 6000 && g._obstacles().list.length < 2) await new Promise(r => requestAnimationFrame(r));
      const L = g._obstacles().list.slice().sort((a, b) => a.x - b.x); const r = g._runPlan(0);
      return { n: L.length, gap: L.length > 1 ? L[1].x - L[0].x : 0, expect: Math.round(r.leap + r.speed * 3.4) };
    });
    expect(laid.n).toBe(2);
    expect(Math.abs(laid.gap - laid.expect)).toBeLessThanOrEqual(2);
  });
});
