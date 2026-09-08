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
    // the run home is six seconds of game time, and a loaded runner plays it at a third of that
    await waitState(page, 'COMPLETE', 60_000);
    await expect(btn).toBeHidden();                 // gone once the ending is up

    await expect(page.locator('#complete')).toBeVisible();
    /* THE WORDS ARE THE REWARD. The row of seven polygon coins was removed on request — a
       scoreboard of shapes at the story's payoff — so what has to be there is the title and the
       line saying what happened, in the game's own white-and-icy-blue speech. */
    await expect(page.locator('#win-stamps')).toHaveCount(0);
    await expect(page.locator('#win-sub')).toBeVisible();
    await expect(page.locator('#win-sub')).toContainText('Frozen Pass');
    await expect(page.locator('.win-title')).toBeVisible();
    const face = await page.evaluate(() => { const p = document.querySelector('.win-face'); const cs = getComputedStyle(p); return { fill: cs.fill, stroke: cs.stroke, d: (p.getAttribute('d') || '').length }; });
    expect(face.fill, 'white inside').toBe('rgb(255, 255, 255)');
    expect(face.stroke, 'a bright icy-blue keyline').toBe('rgb(63, 179, 232)');
    expect(face.d, 'the speech shape was drawn for the words').toBeGreaterThan(40);
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
