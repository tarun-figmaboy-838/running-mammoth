import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [tag, vp, dpr] of [['desk', { width: 1920, height: 1080 }, 1], ['phone', { width: 844, height: 390 }, 2]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr }); const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:8181/index.html?skip=1&sound=0&tutorial=1');
  await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 60000 });
  await page.waitForFunction(() => /Tap to jump/.test(document.getElementById('tut-text').textContent), null, { timeout: 200000 });
  await page.evaluate(async () => { const g = window.iceAgeGame; const t0 = Date.now(); while (Date.now() - t0 < 200000 && !/GLACIER_BREAK_1|PHASE_/.test(g.debug().state)) { const G = g.debug(); const L = g._obstacles().list.filter(o => !o.passed); if (L.length && L[0].x - G.worldX < 640 && L[0].x - G.worldX > 380 && g.mammothState() === 'RUN') g.jump(); await new Promise(r => setTimeout(r, 40)); } });
  await page.waitForFunction(() => /right ice piece/.test(document.getElementById('tut-text').textContent), null, { timeout: 200000 });
  await new Promise(r => setTimeout(r, 1700));
  const g = await page.evaluate(() => {
    const G = window.iceAgeGame.debug(); const st = document.getElementById('stage').getBoundingClientRect(), k = 1920 / st.width;
    const bb = document.getElementById('tut-bubble').getBoundingClientRect();
    const L = G.l1, s = L.shapes.find(q => q.kind === L.unfilled[0] && q.state === 'hang');
    const z = G.zoom, fy = G.zoomVY;
    const top = Math.round(fy + ((s.y - s.h / 2) - fy) * z), bot = Math.round(fy + ((s.y + s.h / 2) - fy) * z);
    const box = [Math.round((bb.left - st.left) * k), Math.round((bb.top - st.top) * k), Math.round((bb.right - st.left) * k), Math.round((bb.bottom - st.top) * k)];
    const overlaps = box[3] > top + 8 && box[1] < bot - 8;
    return { side: document.getElementById('tut-bubble').dataset.side, box, piece: [top, bot], overlaps, powColor: getComputedStyle(document.querySelector('#tut-text .pow')).color, powBg: getComputedStyle(document.querySelector('#tut-text .pow')).backgroundImage };
  });
  console.log(tag, JSON.stringify(g), g.overlaps ? 'OVERLAPS the answer' : 'answer visible');
  await page.screenshot({ path: `qa-report/ask-final-${tag}.png` });
  await ctx.close();
}
await b.close();
