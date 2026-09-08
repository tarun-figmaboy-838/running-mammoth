/* THE TEXT FITS, AND NOTHING IS HALF EMPTY. Asked for: the instruction panel and the dialogue
   box must fit their text with no dead space. The sign is nowrap, so the check is that every
   phase sentence sits inside the plank's safe box; the bubble wraps, so the check is that the
   box hugs the widest line it wrapped to and the air above and below the words matches. */
import { test, expect } from '@playwright/test';
import { boot, force, waitState } from './helpers.mjs';

test.describe('the text fits its panel', () => {
  test.setTimeout(120_000);

  test('every instruction sentence sits inside the plank, on one line, centred', async ({ page }) => {
    await boot(page, { fast: 2 });
    const sentences = await page.evaluate(async () => (await import('/js/engine.js')).CFG.levelOne.phases.map(p => p.instruction));
    expect(sentences.length).toBeGreaterThan(0);
    await force(page, 'GLACIER_BREAK_1');
    /* WAIT FOR THE QUESTION, not merely for the intro. The intro now arrives in beats and the
       sign is held back until its own beat (see engine PHASE_INTRO), so measuring during beat 0
       reads an empty panel. PHASE_ACTIVE has the sign up and stays put until the puzzle is
       solved, which is what makes the measuring below deterministic. (Pausing instead was tried
       and is wrong: the HUD is pushed from the game loop, so a paused game never picks up the
       next sentence.) */
    await waitState(page, 'PHASE_ACTIVE', 60_000);
    for (const s of sentences) {
      const m = await page.evaluate(async sen => {
        const G = window.iceAgeGame.debug();
        G.instruction = sen; G.instrHold = 999999;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pill = document.getElementById('instruction-pill'), tx = document.getElementById('instruction-text');
        const pr = pill.getBoundingClientRect(), tr = tx.getBoundingClientRect();
        const cs = getComputedStyle(pill);
        const pad = { l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight), t: parseFloat(cs.paddingTop), b: parseFloat(cs.paddingBottom) };
        const stage = document.getElementById('stage').getBoundingClientRect();
        return {
          shown: tx.textContent, lines: tx.getClientRects().length,
          overflow: tx.scrollWidth - tx.clientWidth,
          spillL: (pr.left + pad.l) - tr.left, spillR: tr.right - (pr.right - pad.r),
          spillT: (pr.top + pad.t) - tr.top, spillB: tr.bottom - (pr.bottom - pad.b),
          offCentre: Math.abs((tr.left + tr.right) / 2 - (pr.left + pr.right) / 2),
          stageFrac: pr.width / stage.width, textW: tr.width
        };
      }, s);
      const noun = /\bthe\s+([a-z]+)/i.exec(s);
      expect(m.shown.toLowerCase(), s).toContain(noun[1].toLowerCase());
      expect(m.lines, `${s}: one line`).toBe(1);
      expect(m.overflow, `${s}: nothing clipped`).toBeLessThanOrEqual(1);
      for (const k of ['spillL', 'spillR', 'spillT', 'spillB']) expect(m[k], `${s}: ${k} inside the wood`).toBeLessThanOrEqual(1);
      expect(m.offCentre, `${s}: centred on the plank`).toBeLessThan(4);
      expect(m.stageFrac, `${s}: the plank stays off the stage edges`).toBeLessThan(0.9);
      expect(m.textW, `${s}: the words are actually laid out`).toBeGreaterThan(40);
    }
  });

  test('the dialogue box hugs its words, with matching air above and below', async ({ page }) => {
    await boot(page, { tutorial: true, skipScreens: true });
    const measure = () => page.evaluate(() => {
      const b = document.getElementById('tut-bubble'), tx = document.getElementById('tut-text');
      const cs = getComputedStyle(b), stt = getComputedStyle(tx);
      const pad = { l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight), t: parseFloat(cs.paddingTop), b: parseFloat(cs.paddingBottom) };
      const sr = document.getElementById('stage').getBoundingClientRect(), br = b.getBoundingClientRect();
      const ws = [...tx.querySelectorAll('.w')].map(w => ({ l: w.offsetLeft, r: w.offsetLeft + w.offsetWidth, t: w.offsetTop }));
      const tops = [...new Set(ws.map(w => w.t))];
      const widest = Math.max(0, ...tops.map(t => { const g = ws.filter(w => w.t === t); return Math.max(...g.map(x => x.r)) - Math.min(...g.map(x => x.l)); }));
      const c = document.createElement('canvas').getContext('2d');
      c.font = stt.fontWeight + ' ' + stt.fontSize + ' ' + stt.fontFamily;
      const m = c.measureText('Hxdp');
      const fs = parseFloat(stt.fontSize), lh = parseFloat(stt.lineHeight);
      const asc = m.fontBoundingBoxAscent || fs * 0.9, desc = m.fontBoundingBoxDescent || fs * 0.3, cap = m.actualBoundingBoxAscent || fs * 0.72;
      const hl = (lh - (asc + desc)) / 2;
      return {
        text: tx.textContent, nLines: tops.length, boxW: b.offsetWidth, widest,
        deadX: b.offsetWidth - pad.l - pad.r - widest,
        airTop: pad.t + hl + (asc - cap), airBottom: pad.b + hl + desc,
        // the width fitBubble GAVE the shape: its rect carries the pop scale and the wobble's rotation
        svgW: parseFloat(document.getElementById('tut-shape').style.width) || 0,
        overflowY: tx.scrollHeight - tx.clientHeight, fontPx: fs,
        outLeft: sr.left - br.left, outRight: br.right - sr.right, stageW: sr.width
      };
    });
    /* SETTLED, NOT MID-POP. The box arrives through a 380ms scale animation and the words rise
       one after another, so a measurement taken on the frame the sentence appears catches the
       shape layer part-way through being fitted. */
    const line = async re => {
      await page.waitForFunction(r => { const l = document.getElementById('tutorial'), tx = document.getElementById('tut-text'); return !!(l && !l.hidden && tx && new RegExp(r).test(tx.textContent)); }, re, { timeout: 40_000 });
      await page.waitForTimeout(700);
    };

    await line('This is Momo');
    const first = await measure();          // the long one: three lines on a desktop stage
    await line('Help Momo cross');
    const second = await measure();

    for (const m of [first, second]) {
      expect(m.widest, `${m.text}: words laid out`).toBeGreaterThan(40);
      // 20 is the top of hugWords' slack ladder: the smallest width that keeps the line count
      expect(m.deadX, `${m.text}: no empty yellow beside the words`).toBeLessThanOrEqual(20);
      expect(m.deadX, `${m.text}: and the box is not narrower than its words`).toBeGreaterThanOrEqual(-2);
      expect(m.outLeft, `${m.text}: no edge off the left of the stage`).toBeLessThanOrEqual(1);
      expect(m.outRight, `${m.text}: no edge off the right of the stage`).toBeLessThanOrEqual(1);
      expect(m.boxW, `${m.text}: and it does not swallow the stage`).toBeLessThanOrEqual(m.stageW * 0.78);
      expect(m.overflowY, `${m.text}: nothing clipped`).toBeLessThanOrEqual(1);
      expect(Math.abs(m.airTop - m.airBottom), `${m.text}: air above vs below`).toBeLessThanOrEqual(Math.max(2, m.fontPx * 0.06));
      expect(Math.abs(m.svgW - m.boxW), `${m.text}: the yellow follows the box`).toBeLessThanOrEqual(2);
    }
  });
});
