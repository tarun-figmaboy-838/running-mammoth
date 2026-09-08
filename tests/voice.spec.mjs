/* THE VOICE, AND THE ORDER OF THE CROSSING. The owner recorded all sixteen lines as one take;
   the game cuts it into windows and speaks each at its moment, with the words revealing in step.
   And the crossing's order: the hole, then "Oh no!", then the teaching line ON THE PLANK while
   the pieces come down, then the question, then the hand. */
import { test, expect } from '@playwright/test';
import { boot, force, waitState } from './helpers.mjs';
import { readFileSync } from 'node:fs';

test.describe('the voice and the crossing order', () => {
  test.setTimeout(300_000);

  test('sixteen windows, inside the take, none overlapping, one per scripted line', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
      const m = await import('/js/engine.js');
      const V = m.CFG.vo;
      const ac = new AudioContext();
      const buf = await ac.decodeAudioData(await (await fetch('/' + V.src)).arrayBuffer());
      return { src: V.src, dur: +buf.duration.toFixed(2), lines: Object.entries(V.lines) };
    });
    expect(r.src).toBe('assets/audio/vo-lines.mp3');
    expect(r.lines.length, 'sixteen lines').toBe(16);
    const ordered = r.lines.slice().sort((a, b) => a[1][0] - b[1][0]);
    let prevEnd = 0;
    for (const [id, [at, dur]] of ordered) {
      expect(at, `${id} starts inside the take`).toBeGreaterThanOrEqual(0);
      expect(at + dur, `${id} ends inside the take`).toBeLessThanOrEqual(r.dur + 0.01);
      expect(dur, `${id} is a real line`).toBeGreaterThan(0.4);
      expect(at, `${id} overlaps the line before it`).toBeGreaterThanOrEqual(prevEnd - 0.001);
      prevEnd = at + dur;
    }
    // every id in the table is a line in the script, and every scripted line has a window
    const doc = readFileSync('docs/VO-SCRIPT.md', 'utf8');
    for (const [id] of r.lines) expect(doc, `${id} is not in the script`).toContain(id.replace(/^sign-/, 'sign-').replace(/^tut-/, 'tut-'));
  });

  test('the take loads and a line plays, and the words reveal across it', async ({ page }) => {
    await boot(page, { sound: true, tutorial: true, skipScreens: true });
    await page.evaluate(() => window.iceAgeGame.sfx('ui'));         // unlocks the context
    await page.waitForFunction(() => window.iceAgeGame._voice().ready, null, { timeout: 60_000 });
    expect((await page.evaluate(() => window.iceAgeGame._voice())).lines).toBe(16);
    const r = await page.evaluate(async () => {
      const m = await import('/js/engine.js');
      const want = 'This is Momo. He needs to find his friend.';
      const t0 = Date.now();
      while (Date.now() - t0 < 120000 && document.getElementById('tut-text').textContent.trim() !== want) await new Promise(res => setTimeout(res, 80));
      await new Promise(res => setTimeout(res, 200));
      const ws = [...document.querySelectorAll('#tut-text .w')];
      const last = ws.length ? parseFloat(getComputedStyle(ws[ws.length - 1]).animationDelay) : -1;
      return { words: ws.length, last, clip: m.CFG.vo.lines['tut-1-meet'][1] };
    });
    expect(r.words, 'the line is set word by word').toBeGreaterThan(5);
    // the last word arrives in the second half of the clip and not after it
    expect(r.last).toBeGreaterThan(r.clip * 0.45);
    expect(r.last).toBeLessThan(r.clip + 0.4);
  });

  test('a phase question is spoken once, and its id comes from its own sentence', async ({ page }) => {
    await boot(page, { sound: true, fast: 1 });
    const ids = await page.evaluate(async () => {
      const m = await import('/js/engine.js'), g = window.iceAgeGame;
      return m.CFG.levelOne.phases.map(p => ({ text: p.instruction, id: g.signVoId(p.instruction), known: !!m.CFG.vo.lines[g.signVoId(p.instruction)] }));
    });
    expect(ids.length).toBe(7);
    for (const p of ids) expect(p.known, `${p.text} -> ${p.id} has no recorded line`).toBe(true);
    // and it is not spoken twice for the same phase
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 120_000);
    const said = await page.evaluate(() => window.iceAgeGame.debug().saidQuestion);
    expect(said).toBe('sign-triangle');
  });

  test('every question is actually spoken, first and last included', async ({ page }) => {
    /* THE FIRST ONE WAS NOT. The only call was on entering PHASE_ACTIVE, and in the tutorial the
       teaching line still had the plank at that moment, so "Cut the TRIANGLE." — the first
       question in the game — was never said. Measured over a playthrough: fifteen of sixteen. */
    await boot(page, { sound: true, fast: 2 });
    await page.evaluate(() => window.iceAgeGame.sfx('ui'));
    await page.waitForFunction(() => window.iceAgeGame._voice().ready, null, { timeout: 60_000 });
    const seen = [];
    for (const phase of [0, 3, 6]) {
      await page.evaluate(p => { const g = window.iceAgeGame, G = g.debug(); G.phase = p; G.saidQuestion = ''; g._force('GLACIER_BREAK_1'); }, phase);
      await waitState(page, 'PHASE_ACTIVE', 120_000);
      await page.waitForFunction(() => !!window.iceAgeGame.debug().saidQuestion, null, { timeout: 30_000 });
      seen.push(await page.evaluate(() => ({ id: window.iceAgeGame.debug().saidQuestion,
                                             heard: window.iceAgeGame._voice().said.slice(-1)[0] })));
    }
    expect(seen.map(s => s.id)).toEqual(['sign-triangle', 'sign-hexagon', 'sign-hexagons']);
    // and nothing was skipped for want of a window, a mute or an unloaded take
    for (const s of seen) expect(s.heard, `${s.id} was not heard: ${s.heard}`).toBe(s.id);
  });

  test('the crossing runs in order: the hole, the line on the plank, then the question, then the hand', async ({ page }) => {
    await boot(page, { tutorial: true, skipScreens: true, fast: 1 });
    const plank = () => page.evaluate(() => {
      const el = document.getElementById('instruction'), t = document.getElementById('instruction-text');
      return (el && !el.hidden && !el.classList.contains('leaving')) ? { text: t.textContent.trim(), banner: el.classList.contains('banner') } : { text: '', banner: false };
    });
    // through the jump
    await page.waitForFunction(() => /Tap to jump/.test(document.getElementById('tut-text').textContent), null, { timeout: 200_000 });
    await page.evaluate(async () => {
      const g = window.iceAgeGame; const t0 = Date.now();
      while (Date.now() - t0 < 200000 && !/GLACIER_BREAK_1|PHASE_/.test(g.debug().state)) {
        const G = g.debug(); const L = g._obstacles().list.filter(o => !o.passed);
        if (L.length && L[0].x - G.worldX < 640 && L[0].x - G.worldX > 380 && g.mammothState() === 'RUN') g.jump();
        await new Promise(r => setTimeout(r, 40));
      }
    });
    // "Oh no!" comes with nothing on the plank
    await page.waitForFunction(() => /path is broken/.test(document.getElementById('tut-text').textContent), null, { timeout: 200_000 });
    expect((await plank()).text, 'the plank is empty while the hole is described').toBe('');
    // then the teaching line, as a banner, with its own words (no key-word capitals)
    await page.waitForFunction(() => { const t = document.getElementById('instruction-text'); const el = document.getElementById('instruction'); return el && !el.hidden && /Use the right ice piece/.test(t.textContent); }, null, { timeout: 200_000 });
    const banner = await plank();
    expect(banner.banner, 'it is the banner state').toBe(true);
    expect(banner.text).toBe('Use the right ice piece to fix the path.');
    // then the plank hands back to the question, and only then does the hand sweep
    await page.waitForFunction(() => /Cut the/.test(document.getElementById('instruction-text').textContent), null, { timeout: 200_000 });
    const q = await plank();
    expect(q.text).toBe('Cut the TRIANGLE.');
    expect(q.banner, 'the question is not a banner').toBe(false);
    await page.waitForFunction(() => { const h = document.getElementById('tut-hand'), l = document.getElementById('tutorial'); return h && !h.hidden && l && !l.hidden; }, null, { timeout: 60_000 });
    // and the plank is empty again once the crossing is mended
    await page.evaluate(() => { const g = window.iceAgeGame; g._cut(g.debug().l1.unfilled[0]); });
    await waitState(page, ['PHASE_DONE', 'PHASE_RUN'], 60_000);
    await page.waitForFunction(() => !window.iceAgeGame.debug().signSay, null, { timeout: 20_000 });
    expect((await page.evaluate(() => window.iceAgeGame.debug().signSay))).toBe('');
  });
});
