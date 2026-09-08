/* Which recorded lines actually fire, over a whole playthrough, with a real gesture first. */
import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8181/index.html?tutorial=1&fast=3');
await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 90000 });
await page.locator('#btn-play').click({ force: true });            // a real gesture, like a player
await page.waitForFunction(() => window.iceAgeGame._voice().ready, null, { timeout: 60000 });
console.log('after the gesture:', JSON.stringify(await page.evaluate(() => { const v = window.iceAgeGame._voice(); return { ready: v.ready, ctx: v.ctx, lines: v.lines }; })));
// play it through: jump when a rock is close, cut the wanted pieces when a puzzle is up
await page.evaluate(async () => {
  const g = window.iceAgeGame; const t0 = Date.now();
  while (Date.now() - t0 < 170000) {
    const G = g.debug();
    if (G.complete || G.state === 'COMPLETE') break;
    const L = g._obstacles().list.filter(o => !o.passed);
    if (L.length && L[0].x - G.worldX < 640 && L[0].x - G.worldX > 360 && g.mammothState() === 'RUN') g.jump();
    if (G.state === 'PHASE_ACTIVE' && G.l1 && G.l1.unfilled.length && G.l1.shapes.some(s => s.state === 'hang' && s.y > 400)) {
      // wait for any tutorial line on the plank to finish before answering
      if (!G.signSay) g._cut(G.l1.unfilled[0]);
    }
    await new Promise(r => setTimeout(r, 60));
  }
  g.skipToEnd && g.skipToEnd();
});
await page.waitForFunction(() => window.iceAgeGame.debug().state === 'COMPLETE', null, { timeout: 90000 }).catch(() => {});
await new Promise(r => setTimeout(r, 4000));
const v = await page.evaluate(() => window.iceAgeGame._voice());
const table = await page.evaluate(async () => Object.keys((await import('/js/engine.js')).CFG.vo.lines));
const said = v.said.map(s => s.split(':')[0]);
console.log('ctx:', v.ctx, ' lines said:', said.length);
console.log('log:', v.said.join('  '));
const missing = table.filter(k => !said.includes(k));
console.log(missing.length ? 'NEVER SPOKEN: ' + missing.join(', ') : 'every one of the sixteen lines was spoken');
await b.close();
