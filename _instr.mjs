import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const srv = spawn('node', ['tools/serve.mjs', '8379'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:8379/index.html?skip=1&sound=0&tutorial=0');
await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 60000 });

// record every HUD payload the engine publishes
await page.evaluate(() => {
  window.__pushes = [];
  const g = window.iceAgeGame;
  const orig = g.setOptions;
  // there is no hook, so watch the DOM instead
  const el = document.getElementById('instruction');
  window.__obs = [];
  new MutationObserver(muts => {
    for (const m of muts) window.__obs.push({ attr: m.attributeName, now: el.hidden, cls: el.className });
  }).observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] });
});

await page.evaluate(() => window.iceAgeGame._force('GLACIER_BREAK_1'));
await page.waitForFunction('window.iceAgeGame.state() === "PHASE_ACTIVE"', null, { timeout: 40000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const G = window.iceAgeGame.debug();
  const el = document.getElementById('instruction');
  const txt = document.getElementById('instruction-text');
  return {
    state: G.state,
    engineText: G.instruction,
    exists: !!el,
    hidden: el ? el.hidden : null,
    cls: el ? el.className : null,
    display: el ? getComputedStyle(el).display : null,
    domText: txt ? txt.textContent : null,
    obs: (window.__obs || []).slice(-8)
  };
});
console.log('state          ' + r.state);
console.log('engine text    "' + r.engineText + '"');
console.log('element exists ' + r.exists + '   hidden=' + r.hidden + '   display=' + r.display);
console.log('element class  "' + r.cls + '"');
console.log('dom text       "' + r.domText + '"');
console.log('attribute changes seen on #instruction:');
if (!r.obs.length) console.log('   NONE — the HUD never touched it');
else r.obs.forEach(o => console.log('   ' + o.attr + ' -> hidden=' + o.now + ' class="' + o.cls + '"'));
console.log('errors: ' + (errs.length ? [...new Set(errs)].join(' | ') : 'none'));
await b.close();
srv.kill();
