/* THE TEMPORARY "SKIP TO ENDING" REVIEW CONTROL.
 *
 * It exists so the ending can be checked without playing seven phases. This holds what it
 * has to do while it exists: be up during play and gone on the cover and at the end, and
 * drive the REAL ending — the run home, the arrival, the banner with all seven stamps. */
import { test, expect } from '@playwright/test';
import { boot, waitState } from './helpers.mjs';

test.describe('skip to ending (temporary)', () => {
  test.setTimeout(90_000);

  test('hidden on the cover, shown in play, and it plays the whole ending', async ({ page }) => {
    const errors = await boot(page, { skipScreens: false });
    const btn = page.locator('#btn-skip-end');
    await expect(btn).toBeHidden();                 // the cover is not play

    await page.locator('#btn-play').click();        // as a player would: PLAY dismisses the cover
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box.height, 'tap target').toBeGreaterThanOrEqual(24);

    await btn.click();
    // the run home, then the arrival: the friend stands a short way ahead
    expect(await waitState(page, ['FINAL_RUN', 'COMPLETE'], 5_000)).toMatch(/FINAL_RUN|COMPLETE/);
    await waitState(page, 'COMPLETE', 20_000);
    await expect(btn).toBeHidden();                 // gone once the ending is up

    await expect(page.locator('#complete')).toBeVisible();
    // seven crossings counted as mended, so seven stamps
    await expect(page.locator('#win-stamps .win-stamp')).toHaveCount(7, { timeout: 15_000 });
    const g = await page.evaluate(() => ({ complete: window.iceAgeGame.debug().complete, phases: window.iceAgeGame.debug().phasesDone }));
    expect(g.complete).toBe(true);
    expect(g.phases).toBe(7);
    expect(errors).toEqual([]);
  });

  test('does nothing on the cover or once complete', async ({ page }) => {
    await boot(page, { skipScreens: false });
    expect(await page.evaluate(() => window.iceAgeGame.skipToEnd())).toBe(false);
    await page.evaluate(() => window.iceAgeGame.begin());
    expect(await page.evaluate(() => window.iceAgeGame.skipToEnd())).toBe(true);
    await waitState(page, 'COMPLETE', 25_000);
    expect(await page.evaluate(() => window.iceAgeGame.skipToEnd())).toBe(false);
  });
});
