/* EVERY SHAPE A PLAYER MIGHT HOLD. The suite's two projects are 1920x1080 and 844x390 at DPR 1;
   these are the shapes that broke things in the past or could: a 4K screen at DPR 2, a tall phone
   at DPR 3, a tiny landscape phone, a folded phone, an ultrawide monitor, portrait, and a 4:3
   tablet. Each is checked for the four things that are size-dependent and can silently break:

     THE STAGE is 16:9 and letterboxed, and the page never scrolls.
     THE BACKBUFFER stays inside what a mobile GPU will allocate (16.7 Mpx, 4096 a side).
     NOTHING IS DRAWN OUTSIDE IT — no control, no card, no coach mark.
     THE CONTROLS stay big enough for a thumb, and the rotate prompt is right for the shape.

   tools/_matrix.mjs is the fuller version of this (it also plays, times frames and reads the
   heap) and is meant to be run by hand; this is the part worth having in the gate. */
import { test, expect } from '@playwright/test';
import { boot } from './helpers.mjs';

const SHAPES = [
  { name: 'a 4K screen at DPR 2',        viewport: { width: 3840, height: 2160 }, dpr: 2 },
  { name: 'a tall phone at DPR 3',       viewport: { width: 932, height: 430 }, dpr: 3, touch: true },
  { name: 'a small phone',               viewport: { width: 667, height: 375 }, dpr: 2, touch: true },
  { name: 'a tiny phone',                viewport: { width: 568, height: 320 }, dpr: 2, touch: true },
  { name: 'a folded phone',              viewport: { width: 653, height: 280 }, dpr: 3, touch: true },
  { name: 'an ultrawide monitor',        viewport: { width: 3440, height: 1440 }, dpr: 1 },
  { name: 'a 4:3 tablet',                viewport: { width: 1024, height: 768 }, dpr: 2, touch: true },
  { name: 'a phone in portrait',         viewport: { width: 390, height: 844 }, dpr: 3, touch: true, portrait: true },
  { name: 'a tablet in portrait',        viewport: { width: 768, height: 1024 }, dpr: 2, touch: true, portrait: true }
];

for (const shape of SHAPES) {
  test.describe(shape.name, () => {
    test.use({ viewport: shape.viewport, deviceScaleFactor: shape.dpr, hasTouch: !!shape.touch, isMobile: !!shape.touch });

    test('fits, allocates a sane backbuffer, and keeps its interface on the stage', async ({ page }) => {
      test.setTimeout(120_000);
      const errors = await boot(page, { tutorial: false });
      const m = await page.evaluate(() => {
        const c = document.getElementById('game-canvas');
        const st = document.getElementById('stage').getBoundingClientRect();
        const doc = document.documentElement;
        const rot = document.getElementById('rotate');
        const bad = [];
        let jump = null;
        for (const el of document.querySelectorAll('#hud *, .overlay:not([hidden]) *')) {
          if (el.hidden || !el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          if (r.left < st.left - 2 || r.right > st.right + 2 || r.top < st.top - 2 || r.bottom > st.bottom + 2) {
            bad.push((el.id || el.className || el.tagName).toString().slice(0, 30));
          }
          if (el.id === 'btn-jump') jump = Math.min(r.width, r.height);
        }
        return {
          ar: st.width / st.height,
          canvasW: c.width, canvasH: c.height,
          scrollX: doc.scrollWidth - doc.clientWidth, scrollY: doc.scrollHeight - doc.clientHeight,
          offStage: [...new Set(bad)], jump, rotate: !!(rot && !rot.hidden)
        };
      });
      expect(m.ar, 'the stage is 16:9').toBeCloseTo(16 / 9, 2);
      expect(m.scrollX, 'the page does not scroll sideways').toBeLessThanOrEqual(1);
      expect(m.scrollY, 'the page does not scroll down').toBeLessThanOrEqual(1);
      // what a weak mobile GPU will allocate: 16.7 Mpx, and 4096 on a side
      expect(m.canvasW * m.canvasH / 1e6, `backbuffer ${m.canvasW}x${m.canvasH}`).toBeLessThanOrEqual(16.7);
      expect(Math.max(m.canvasW, m.canvasH), 'backbuffer side').toBeLessThanOrEqual(4096);
      expect(m.offStage, 'nothing is drawn outside the stage').toEqual([]);
      if (m.jump !== null) expect(m.jump, 'the JUMP button is a thumb-sized target').toBeGreaterThanOrEqual(44);
      expect(m.rotate, shape.portrait ? 'portrait asks for a turn' : 'landscape does not').toBe(!!shape.portrait);
      expect(errors.filter(e => e.startsWith('pageerror')), 'no faults').toEqual([]);
    });
  });
}
