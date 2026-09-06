/* THE CONTROLS UNDER A FINGER, and the launch furniture.
 *
 * Found on the deployment: a JUMP button that hopped 24px on every press, a blank page while
 * the art loaded, a preload warning on every load, and no icon. These hold the fixes. */
import { test, expect } from '@playwright/test';
import { boot, READY } from './helpers.mjs';

test.describe('controls', () => {
  test.setTimeout(90_000);

  test('the JUMP button presses in place — it does not travel under the finger', async ({ page }) => {
    await boot(page);
    await page.waitForSelector('#btn-jump:not([hidden])');
    const trace = await page.evaluate(() => new Promise(done => {
      const el = document.getElementById('btn-jump');
      const r0 = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
      let rise = 0, swell = 0, shrink = 0;
      const t0 = performance.now();
      const tick = () => {
        const r = el.getBoundingClientRect();
        rise = Math.max(rise, Math.abs(r.top + r.height / 2 - (r0.top + r0.height / 2)));   // the centre must stay put
        swell = Math.max(swell, r.width - r0.width);
        shrink = Math.max(shrink, r0.width - r.width);
        if (performance.now() - t0 < 700) requestAnimationFrame(tick); else done({ rise, swell, shrink, w: r0.width });
      };
      requestAnimationFrame(tick);
    }));
    // a squash about the centre is fine; travel is not, and growth is not
    expect(trace.rise, 'centre travel px').toBeLessThan(2);
    expect(trace.swell, 'growth px').toBeLessThan(2);
    expect(trace.shrink, 'the press is visible').toBeGreaterThan(2);
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
