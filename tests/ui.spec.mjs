import { test, expect } from '@playwright/test';
import { boot, G, waitState, force } from './helpers.mjs';

/* The interface: controls, feedback, progress and tutorial guidance.
   Every assertion here is something a player would notice if it broke. */

test.describe('ui', () => {
  test.setTimeout(120_000);

  test('no request 404s, and every SVG the interface uses is real vector', async ({ page }) => {
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const errors = await boot(page, { skipScreens: false });
    await expect(page.locator('#cover')).toBeVisible();
    await page.locator('#btn-play').click({ force: true });
    await expect(page.locator('#cover')).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(600);
    expect([...new Set(bad)], 'broken requests').toEqual([]);
    expect(errors).toEqual([]);

    // and the vector files are geometry, not a raster in a wrapper
    const svgs = await page.evaluate(async () => {
      const names = [
        'icons/sound-on', 'icons/sound-off', 'icons/pause', 'icons/play', 'icons/restart',
        'icons/hint', 'icons/check', 'icons/wrong', 'tutorial/hand-slash',
        /* The shape glyphs are no longer drawn on the instruction card — it is one
           line of text now — but the files are still here and still have to be real
           vector if anything ever puts them back. */
        'shapes/triangle', 'shapes/square', 'shapes/quadrilateral',
        'shapes/trapezoid', 'shapes/pentagon', 'shapes/hexagon'
      ];
      const out = [];
      for (const n of names) {
        const r = await fetch('/assets/ui/' + n + '.svg');
        out.push({ n, ok: r.ok, body: r.ok ? await r.text() : '' });
      }
      return out;
    });
    for (const s of svgs) {
      expect(s.ok, s.n + ' missing').toBe(true);
      expect(s.body, s.n + ' must be an svg').toMatch(/^<svg /);
      // no embedded raster, no base64, no text baked into a control
      expect(s.body, s.n + ' embeds a raster').not.toMatch(/<image|base64|xlink:href="data:/);
      expect(s.body.length, s.n + ' is too heavy for game UI').toBeLessThan(6000);
      // real geometry, not a single blob
      expect(s.body, s.n + ' has no geometry').toMatch(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/);
    }
  });

  /* The hint / sound / pause cluster was removed on request. What is checked now is
     that it is really gone and that nothing was left behind half-wired — the pause
     panel's own buttons are still in the markup, so a stray rule or a stale listener
     would be easy to miss. */
  test('the top-right control cluster is gone', async ({ page }) => {
    await boot(page);
    expect(await page.locator('.hud-controls').count(), 'the cluster').toBe(0);
    for (const id of ['#btn-hint', '#btn-sound', '#btn-pause']) {
      expect(await page.locator(id).count(), id).toBe(0);
    }
    // and the game still runs, muted and paused only through the URL and the API
    expect(await page.evaluate('window.iceAgeGame.state()')).not.toBe('BOOT');
    expect(await page.evaluate('typeof window.iceAgeGame.toggleSound')).toBe('function');
    expect(await page.evaluate('typeof window.iceAgeGame.setPaused')).toBe('function');
  });

  test.skip('the controls are icon buttons and they respond', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');

    // three controls, none of them a word
    const btns = page.locator('.hud-controls .icon-btn');
    await expect(btns).toHaveCount(3);
    for (const id of ['#btn-hint', '#btn-sound', '#btn-pause']) {
      const b = page.locator(id);
      await expect(b).toBeVisible();
      await expect(b).toHaveAttribute('aria-label', /.+/);
      const box = await b.boundingBox();
      expect(box.width, id + ' tap target').toBeGreaterThanOrEqual(36);
      // the glyph is a real mask, not empty
      const mask = await b.locator('.icon-btn-glyph').evaluate(
        el => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
      expect(mask, id + ' glyph').toContain('.svg');
    }
  });

  test.skip('sound toggles, and the glyph follows the state', async ({ page }) => {
    await boot(page, { sound: true });
    await waitState(page, 'RUN_SEGMENT_1');
    const b = page.locator('#btn-sound');
    const before = await page.evaluate('window.iceAgeGame.soundOn()');
    await b.click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate('window.iceAgeGame.soundOn()')).toBe(!before);
    await expect(b).toHaveAttribute('data-icon', before ? 'sound-off' : 'sound-on');
    await b.click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate('window.iceAgeGame.soundOn()')).toBe(before);
  });

  test.skip('pause opens a panel with resume, restart and sound', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    await page.waitForTimeout(200);
    await page.locator('#btn-pause').click({ force: true });
    await expect(page.locator('#paused')).toBeVisible();
    await expect(page.locator('#btn-pause')).toHaveAttribute('data-icon', 'play');
    expect(await page.evaluate('window.iceAgeGame.paused')).toBe(true);
    // the panel offers a way on, a way back and the sound control
    await expect(page.locator('#btn-resume')).toBeVisible();
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-sound2')).toBeVisible();
    await page.locator('#btn-resume').click({ force: true });
    await expect(page.locator('#paused')).toBeHidden();
    expect(await page.evaluate('window.iceAgeGame.paused')).toBe(false);
    await expect(page.locator('#btn-pause')).toHaveAttribute('data-icon', 'pause');
  });

  test('the instruction is one readable sentence, and nothing else', async ({ page }) => {
    /* The card used to pair the words with a drawn polygon. The glyph was removed on
       request, so the sentence carries the whole instruction — which makes how big it
       is set a functional requirement rather than a matter of taste. */
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, ['PHASE_INTRO', 'PHASE_ACTIVE'], 30_000);
    await expect(page.locator('#instruction')).toBeVisible();

    // the sentence is the phase's own, in full
    const want = await page.evaluate(async () => {
      const m = await import('/js/engine.js');
      return m.CFG.levelOne.phases[window.iceAgeGame.debug().phase].instruction;
    });
    await expect(page.locator('#instruction-text')).toHaveText(want);

    // nothing else is on the card
    expect(await page.locator('#instruction-shapes').count(), 'the shape chip is gone').toBe(0);
    expect(await page.locator('#instruction-lead').count(), 'the split lead is gone').toBe(0);

    /* Big enough to be the thing you look at. Measured against the STAGE height, not
       in absolute pixels, because the stage is letterboxed and scales. */
    const size = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.getElementById('instruction-text')).fontSize));
    const stage = await page.locator('#stage').boundingBox();
    expect(size / stage.height, 'the sentence must be large enough to read').toBeGreaterThan(0.03);
    // ...and the panel still does not span the stage
    const pill = await page.locator('#instruction-pill').boundingBox();
    expect(pill.width / stage.width, 'the panel should not span the stage').toBeLessThan(0.62);
  });

  test('the instruction stays up through the phase, and never blocks a cut', async ({ page }) => {
    /* It used to slide away a few seconds after arriving, so the one thing telling the
       learner what to look for was gone by the time they were looking. It now stays for
       the whole playable phase — which is only safe because it is small, parked at the
       top, and takes no pointer events. It still owns the stage ALONE during
       PHASE_INTRO: the chunks are held above the screen until that beat ends. */
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    await expect(page.locator('#instruction')).toBeVisible();

    // and it is nowhere near the chunks it must not cover
    const card = await page.locator('#instruction-pill').boundingBox();
    const top = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const r = document.getElementById('game-canvas').getBoundingClientRect();
      let y = 1e9;
      for (const s of G.l1.shapes) {
        for (const p of s.pts) y = Math.min(y, s.y + p.y);
      }
      return r.top + (y / 1080) * r.height;
    });
    expect(card.y + card.height, 'the card overlaps the hanging options')
      .toBeLessThan(top);
    /* And whenever it IS up — the reminder after a wrong answer — it must take no
       pointer events, so a cut aimed at a rope behind it still lands. */
    const pe = await page.evaluate(() =>
      getComputedStyle(document.getElementById('instruction')).pointerEvents);
    expect(pe, 'the instruction must never swallow a cut').toBe('none');
  });

  test('a correct answer pops a tick, a wrong one pops a cross', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);

    const bad = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const s = G.l1.shapes.find(x => x.state === 'hang' &&
        !G.l1.unfilled.includes(x.kind));
      return s ? s.kind : null;
    });
    expect(bad).toBeTruthy();
    await page.evaluate(k => window.iceAgeGame._cut(k), bad);
    await expect(page.locator('#verdict')).toHaveAttribute('data-mark', 'no', { timeout: 3000 });

    await waitState(page, 'PHASE_ACTIVE', 25_000);
    const good = await page.evaluate('window.iceAgeGame.debug().l1.unfilled[0]');
    await page.evaluate(k => window.iceAgeGame._cut(k), good);
    await expect(page.locator('#verdict')).toHaveAttribute('data-mark', 'ok', { timeout: 3000 });
    // and it gets out of the way rather than blocking play
    await expect(page.locator('#verdict')).toBeHidden({ timeout: 4000 });
  });

  test('the idle hand appears only after a long wait, and leaves on contact', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    await expect(page.locator('#hand-hint')).toBeHidden();

    await page.evaluate('window.iceAgeGame.debug().idleHand = 99');
    await expect(page.locator('#hand-hint')).toBeVisible({ timeout: 4000 });
    // it must be small and it must not sit over the character
    const hand = await page.locator('#hand-hint').boundingBox();
    const stage = await page.locator('#stage').boundingBox();
    expect(hand.width / stage.width, 'the hint should be small').toBeLessThan(0.09);

    // any contact dismisses it
    const canvas = await page.locator('#game-canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.7);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('#hand-hint')).toBeHidden({ timeout: 4000 });
  });

  test.skip('the hint re-states the objective without revealing the answer', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    // let the banner time out the way it does in play
    await page.waitForFunction('window.iceAgeGame.debug().instrHold <= 0', null, { timeout: 25_000 });
    await page.locator('#btn-hint').click({ force: true });
    await page.waitForFunction('window.iceAgeGame.debug().instrHold > 0', null, { timeout: 3000 });
    await expect(page.locator('#instruction')).toBeVisible();
    // nothing about the hint marks which chunk is correct
    const marked = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      return G.l1.shapes.filter(s => s.highlight || s.hinted).length;
    });
    expect(marked, 'the hint must not point at an answer').toBe(0);
  });

  test('gameplay stays the dominant thing on screen', async ({ page }) => {
    /* Every panel and control together must stay a small fraction of the stage, or
       the interface has started to overpower the game it is supporting. */
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    const share = await page.evaluate(() => {
      const stage = document.getElementById('stage').getBoundingClientRect();
      const area = stage.width * stage.height;
      let used = 0;
      for (const sel of ['#instruction-pill', '.hud-controls', '#btn-jump']) {
        const el = document.querySelector(sel);
        if (!el || el.hidden || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        used += r.width * r.height;
      }
      return used / area;
    });
    expect(share, 'the interface is taking too much of the screen').toBeLessThan(0.12);
  });
});
