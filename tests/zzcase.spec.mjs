import { test, expect } from '@playwright/test';

/* Runs the real game against a STRICTLY case-sensitive server (every path segment
   verified with readdirSync), which is what Vercel/Linux does. Catches dynamically
   built asset paths that a static grep cannot see. */
test('no 404s on a case-sensitive host', async ({ page }) => {
  test.setTimeout(180_000);
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => bad.push('FAILED ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:8321/', { waitUntil: 'load' });
  await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 60_000 });
  console.log('LANDED: ' + page.url() + '  state=' + await page.evaluate('window.iceAgeGame.state()'));

  await page.locator('#btn-play').click({ force: true });
  await page.waitForFunction(() => window.iceAgeGame.state() !== 'COVER', null, { timeout: 20_000 });

  // let it run long enough to pull sky phases, sprites, audio and shape art
  await page.waitForTimeout(8000);

  // force through several phases so every option-shape image gets requested
  for (let ph = 0; ph < 7; ph++) {
    try {
      await page.evaluate(p => {
        const g = window.iceAgeGame, G = g.debug();
        G.phase = p; G.l1 = null; G.phaseLayout = null; G.gapsThisPhase = null;
        g._force('GLACIER_BREAK_1');
      }, ph);
      await page.waitForFunction(() => window.iceAgeGame.state() === 'PHASE_ACTIVE', null, { timeout: 20_000 });
      const want = await page.evaluate(() => window.iceAgeGame.debug().l1.wanted[0]);
      await page.evaluate(k => window.iceAgeGame._cut(k), want);
      await page.waitForTimeout(1200);
    } catch (e) { console.log('  phase ' + ph + ': ' + e.message.split('\n')[0]); }
  }
  await page.waitForTimeout(2000);

  console.log('\n=== BROKEN REQUESTS ===\n' + ([...new Set(bad)].join('\n') || 'none'));
  console.log('\n=== ERRORS ===\n' + ([...new Set(errs)].join('\n') || 'none'));
  expect([...new Set(bad)]).toEqual([]);
});
