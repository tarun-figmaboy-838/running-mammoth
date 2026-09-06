/* THE CONTROLS UNDER A FINGER, and the launch furniture.
 *
 * Found on the deployment: a JUMP button that hopped 24px on every press, a blank page while
 * the art loaded, a preload warning on every load, and no icon. These hold the fixes. */
import { test, expect } from '@playwright/test';
import { boot, READY, force } from './helpers.mjs';

test.describe('controls', () => {
  test.setTimeout(90_000);

  test('the JUMP button presses in place — it does not travel under the finger', async ({ page }) => {
    await boot(page);
    await page.waitForSelector('#btn-jump:not([hidden])');
    const trace = await page.evaluate(() => new Promise(done => {
      const el = document.getElementById('btn-jump');
      const r0 = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
      /* WHAT the press animates is read off the animation itself, not sampled: a 160ms
         squash can finish between two frames of a loaded headless runner. The keyframes
         must scale about the centre and never translate. */
      const anims = el.getAnimations ? el.getAnimations() : [];
      const frames = anims.flatMap(a => a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : []);
      const transforms = frames.map(f => f.transform || '').filter(Boolean);
      let rise = 0, swell = 0;
      const t0 = performance.now();
      const tick = () => {
        const r = el.getBoundingClientRect();
        rise = Math.max(rise, Math.abs(r.top + r.height / 2 - (r0.top + r0.height / 2)));   // the centre must stay put
        swell = Math.max(swell, r.width - r0.width);
        if (performance.now() - t0 < 700) requestAnimationFrame(tick); else done({ rise, swell, animations: anims.length, transforms });
      };
      requestAnimationFrame(tick);
    }));
    // a squash about the centre is fine; travel is not, and growth is not
    expect(trace.rise, 'centre travel px').toBeLessThan(2);
    expect(trace.swell, 'growth px').toBeLessThan(2);
    expect(trace.animations, 'the press is animated').toBeGreaterThan(0);
    expect(trace.transforms.some(t => /scale\(0\.9/.test(t)), 'it squashes').toBe(true);
    expect(trace.transforms.some(t => /translate/.test(t)), 'it never travels').toBe(false);
  });

  test('a tap on a block answers: its halo flashes and the hand shows how', async ({ page }) => {
    await boot(page);
    /* Through the INTRO, not straight to ACTIVE: the intro is what lowers the blocks in
       (dropReady), and a forced PHASE_ACTIVE leaves them held above the screen. */
    await force(page, 'PHASE_INTRO');
    await page.waitForFunction(() => window.iceAgeGame.state() === 'PHASE_ACTIVE', null, { timeout: 20_000 });
    await page.waitForFunction(() => { const L = window.iceAgeGame.debug().l1; return L && L.shapes.some(s => s.state === 'hang' && s.y > 400); }, null, { timeout: 20_000 });
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => {
      const G = window.iceAgeGame.debug(); const r = document.getElementById('stage').getBoundingClientRect();
      const sh = G.l1.shapes.find(s => s.state === 'hang' && G.l1.unfilled.includes(s.kind));
      return { kind: sh.kind, x: r.left + sh.x / 1920 * r.width, y: r.top + sh.y / 1080 * r.height };
    });
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const want = G.l1.shapes.find(s => s.state === 'hang' && G.l1.unfilled.includes(s.kind));
      return { flashed: G.l1.shapes.filter(s => (s.flash || 0) > 0.1).map(s => s.kind), hand: !!G.handHint,
               handOnAnswer: !!G.handHint && Math.abs(G.handHint.x - want.anchorX) < 2, state: G.state, attempts: G.attempts };
    });
    // light, not movement: the options hold still while they are read, so the answer is the halo
    expect(after.flashed, 'the tapped block flashes').toContain(at.kind);
    expect(after.hand, 'the demonstration hand comes forward').toBe(true);
    expect(after.handOnAnswer, 'and it is on the rope of the answer, never a wrong one').toBe(true);
    expect(after.state).toBe('PHASE_ACTIVE');         // a tap is not a cut
    expect(after.attempts).toBe(0);
  });

  test('the page has an icon, and no preload warnings', async ({ page }) => {
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await boot(page, { skipScreens: false });
    for (const u of ['/favicon.png', '/apple-touch-icon.png']) {
      const res = await page.request.get(u);
      expect(res.status(), u).toBe(200);
      expect(res.headers()['content-type'] || '', u).toContain('image/png');
    }
    expect(warnings.filter(w => /preload/i.test(w)), 'preload warnings').toEqual([]);
  });

  test('the cover shows before the art is in, and PLAY is held until READY', async ({ page }) => {
    /* The cover appears as soon as the page runs; while the sheets load its note is up and
       PLAY does nothing. Once READY the note is gone and PLAY starts the run. */
    page.on('pageerror', e => { throw e; });
    await page.goto('/index.html?sound=0&tutorial=0');
    await expect(page.locator('#cover')).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction(READY, null, { timeout: 60_000 });
    await expect(page.locator('#cover-loading')).toBeHidden();
    await expect(page.locator('#cover')).not.toHaveClass(/loading/);
    await page.locator('#btn-play').click();
    await expect(page.locator('#cover')).toBeHidden({ timeout: 5_000 });
  });
});
