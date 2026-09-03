/* The checklist from the brief, as tests.
 *
 * §40 asks for every level's question, option count and answers to be verified; §41 for
 * an explicit vertex count on every shape; and the closing instruction for every option
 * in every level to be exercised INCLUDING every wrong one, with Levels 6 and 7
 * completing only after all three correct polygons are cut. That is 28 options across
 * seven levels, which is why the game exposes cutting an option by id rather than
 * needing 28 synthesised gestures.
 */
import { test, expect } from '@playwright/test';

const READY = 'window.polygonGame && window.polygonGame.debug().level === 1';

async function boot(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(READY, null, { timeout: 20_000 });
  return errors;
}
const state = page => page.evaluate('window.polygonGame.debug()');
const cut = (page, id) => page.evaluate(i => window.polygonGame.cut(i), id);
/** Wait for the game to be showing a given level. */
const atLevel = (page, n) =>
  page.waitForFunction(k => window.polygonGame.debug().level === k, n, { timeout: 8000 });

/* The brief's own tables, transcribed. If the implementation and these disagree, the
   implementation is wrong — this is the contract. */
const SPEC = [
  { id: 1, question: 'Cut the triangle.',        options: 3, mode: 'single',   correct: ['level-1-regular-triangle'] },
  { id: 2, question: 'Cut the quadrilateral.',   options: 3, mode: 'single',   correct: ['level-2-regular-quadrilateral'] },
  { id: 3, question: 'Cut the pentagon.',        options: 3, mode: 'single',   correct: ['level-3-regular-pentagon'] },
  { id: 4, question: 'Cut the hexagon.',         options: 3, mode: 'single',   correct: ['level-4-irregular-convex-hexagon'] },
  { id: 5, question: 'Cut the heptagon.',        options: 3, mode: 'single',   correct: ['level-5-concave-heptagon'] },
  { id: 6, question: 'Cut all the pentagons.',   options: 5, mode: 'multiple', correct: [
      'level-6-regular-convex-pentagon', 'level-6-irregular-convex-pentagon', 'level-6-concave-pentagon'] },
  { id: 7, question: 'Cut all the hexagons.',    options: 6, mode: 'multiple', correct: [
      'level-7-irregular-convex-hexagon', 'level-7-concave-hexagon', 'level-7-regular-hexagon'] }
];

const ORDER = {
  1: ['regularTriangle', 'regularPentagon', 'regularHexagon'],
  2: ['regularTriangle', 'regularQuadrilateral', 'regularPentagon'],
  3: ['regularTriangle', 'regularPentagon', 'regularOctagon'],
  4: ['regularPentagon', 'irregularConvexHexagon', 'regularHeptagon'],
  5: ['irregularConvexHexagon', 'concaveHeptagon', 'irregularConvexOctagon'],
  6: ['regularPentagon', 'irregularHexagon', 'irregularConvexPentagon', 'regularQuadrilateral', 'concavePentagon'],
  7: ['concaveHeptagon', 'irregularConvexHexagon', 'irregularPentagon', 'concaveHexagon', 'regularOctagon', 'regularHexagon']
};

test.describe('geometry', () => {
  test('every polygon has exactly the number of sides its name claims', async ({ page }) => {
    await boot(page);
    const report = await page.evaluate(() => {
      const m = window.PolygonGeometry;
      return {
        problems: m.verify(),
        count: Object.keys(m.polygonDefinitions).length,
        sides: Object.fromEntries(Object.entries(m.polygonMetadata).map(([k, v]) => [k, v.sides])),
        verts: Object.fromEntries(Object.entries(m.polygonDefinitions).map(([k, v]) => [k, v.points.length]))
      };
    });
    expect(report.problems, report.problems.join('\n')).toEqual([]);

    // §41: count them explicitly rather than trusting the metadata
    for (const [name, sides] of Object.entries(report.sides)) {
      expect(report.verts[name], `${name} should have ${sides} vertices`).toBe(sides);
    }
    const bySides = n => Object.entries(report.sides).filter(([, s]) => s === n).map(([k]) => k);
    expect(bySides(3)).toEqual(['regularTriangle']);
    expect(bySides(4)).toEqual(['regularQuadrilateral']);
    expect(bySides(5).sort()).toEqual(['concavePentagon', 'irregularConvexPentagon', 'irregularPentagon', 'regularPentagon']);
    expect(bySides(6).sort()).toEqual(['concaveHexagon', 'irregularConvexHexagon', 'irregularHexagon', 'regularHexagon']);
    expect(bySides(7).sort()).toEqual(['concaveHeptagon', 'regularHeptagon']);
    expect(bySides(8).sort()).toEqual(['irregularConvexOctagon', 'regularOctagon']);
  });

  test('one geometry, one definition', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      const m = window.PolygonGeometry;
      return {
        count: Object.keys(m.polygonDefinitions).length,
        names: Object.keys(m.polygonDefinitions),
        normalised: {
          regularConvexPentagon: m.canonical('regularConvexPentagon'),
          quadrilateral: m.canonical('quadrilateral'),
          octagon: m.canonical('octagon')
        }
      };
    });
    // §12: exactly fourteen, and not one of the three descriptive names among them
    expect(r.count).toBe(14);
    expect(r.names).not.toContain('regularConvexPentagon');
    expect(r.names).not.toContain('quadrilateral');
    expect(r.names).not.toContain('octagon');
    // §8: they resolve onto existing geometry instead
    expect(r.normalised).toEqual({
      regularConvexPentagon: 'regularPentagon',
      quadrilateral: 'regularQuadrilateral',
      octagon: 'regularOctagon'
    });
  });
});

test.describe('levels', () => {
  test('question, option count, order and mode match the brief', async ({ page }) => {
    await boot(page);
    const data = await page.evaluate(() => {
      const m = window.PolygonLevels;
      return m.levels.map(l => ({
        id: l.id, question: l.question, mode: l.selectionMode,
        ids: l.options.map(o => o.id),
        types: l.options.map(o => o.type),
        correct: l.options.filter(o => o.correct).map(o => o.id)
      }));
    });
    expect(data.map(d => d.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);   // §25: no reordering
    for (const spec of SPEC) {
      const got = data.find(d => d.id === spec.id);
      expect(got.question).toBe(spec.question);                   // §29: exact text
      expect(got.ids.length, `level ${spec.id} option count`).toBe(spec.options);
      expect(got.mode).toBe(spec.mode);
      expect(got.correct.sort()).toEqual(spec.correct.slice().sort());
      expect(got.types, `level ${spec.id} option order`).toEqual(ORDER[spec.id]);
    }
  });

  test('the screen shows the question and the polygons, and nothing else', async ({ page }) => {
    const errors = await boot(page);
    await expect(page.locator('#question')).toHaveText('Cut the triangle.');
    await expect(page.locator('#shapes .poly')).toHaveCount(3);

    // §28/§29: no other learner-facing text anywhere on the screen
    const text = (await page.locator('#game').innerText()).trim();
    expect(text).toBe('Cut the triangle.');
    // and none of the banned controls exist
    for (const sel of ['button', 'input', 'nav', 'header', 'footer', 'progress', 'meter']) {
      expect(await page.locator(sel).count(), `${sel} should not exist`).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test('no polygon is clipped, overlapping or touching an edge', async ({ page }) => {
    await boot(page);
    for (const n of [1, 6, 7]) {
      await page.evaluate(k => window.polygonGame.show(k - 1), n);
      await atLevel(page, n);
      const r = await page.evaluate(() => {
        const stage = document.getElementById('stage').getBoundingClientRect();
        const q = document.getElementById('question').getBoundingClientRect();
        const boxes = [...document.querySelectorAll('#shapes .poly')].map(e => e.getBoundingClientRect());
        let overlap = 0, outside = 0, tooSmall = 0, overQuestion = 0;
        for (let i = 0; i < boxes.length; i++) {
          const a = boxes[i];
          if (a.left < stage.left || a.right > stage.right || a.top < stage.top || a.bottom > stage.bottom) outside++;
          if (a.width < 76) tooSmall++;
          if (a.top < q.bottom - 1) overQuestion++;
          for (let j = i + 1; j < boxes.length; j++) {
            const b = boxes[j];
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap++;
          }
        }
        return { overlap, outside, tooSmall, overQuestion, count: boxes.length };
      });
      expect(r.overlap, `level ${n}: polygons overlap`).toBe(0);
      expect(r.outside, `level ${n}: a polygon leaves the stage`).toBe(0);
      expect(r.tooSmall, `level ${n}: a polygon is too small to count sides on`).toBe(0);
      expect(r.overQuestion, `level ${n}: a polygon reaches the question`).toBe(0);
    }
  });
});

test.describe('single-answer levels', () => {
  /* Every wrong option in levels 1 to 5, one at a time: none may advance the level, and
     none may take the correct answer with it. */
  for (const spec of SPEC.filter(s => s.mode === 'single')) {
    test(`level ${spec.id}: every wrong option is refused and the right one advances`, async ({ page }) => {
      await boot(page);
      await page.evaluate(k => window.polygonGame.show(k - 1), spec.id);
      await atLevel(page, spec.id);

      const ids = (await state(page)).options;
      const wrong = ids.filter(i => !spec.correct.includes(i));
      expect(wrong.length).toBe(spec.options - 1);

      for (const id of wrong) {
        expect(await cut(page, id), `${id} should be cuttable`).toBe(true);
        await page.waitForTimeout(120);
        const s = await state(page);
        expect(s.level, `${id} must not advance the level`).toBe(spec.id);
        expect(s.completed, `${id} must not count as progress`).toEqual([]);
        // the correct answer is still there and still uncut
        const stillThere = await page.locator(`[data-option-id="${spec.correct[0]}"]:not(.is-done)`).count();
        expect(stillThere, 'a wrong cut removed the correct answer').toBe(1);
      }

      // and the right one finishes it
      expect(await cut(page, spec.correct[0])).toBe(true);
      if (spec.id < 7) await atLevel(page, spec.id + 1);
    });
  }
});

test.describe('multiple-answer levels', () => {
  for (const spec of SPEC.filter(s => s.mode === 'multiple')) {
    test(`level ${spec.id}: completes only after all three correct polygons are cut`, async ({ page }) => {
      await boot(page);
      await page.evaluate(k => window.polygonGame.show(k - 1), spec.id);
      await atLevel(page, spec.id);

      const ids = (await state(page)).options;
      const wrong = ids.filter(i => !spec.correct.includes(i));
      expect(spec.correct.length, 'three correct answers').toBe(3);

      // every wrong option, and none of them counts
      for (const id of wrong) {
        expect(await cut(page, id)).toBe(true);
        await page.waitForTimeout(90);
        const s = await state(page);
        expect(s.level).toBe(spec.id);
        expect(s.completed).toEqual([]);
      }

      // the correct ones, one at a time: the level must stay put until the last
      for (let i = 0; i < spec.correct.length; i++) {
        expect(await cut(page, spec.correct[i])).toBe(true);
        await page.waitForTimeout(120);
        const s = await state(page);
        expect(s.completed.length, 'each correct cut counts once').toBe(i + 1);
        if (i < spec.correct.length - 1) {
          expect(s.level, `level ${spec.id} finished after only ${i + 1} of 3`).toBe(spec.id);
        }
        // a completed shape keeps its cut state, so the player can see what they found
        await expect(page.locator(`[data-option-id="${spec.correct[i]}"].is-done`)).toHaveCount(1);
      }

      // re-cutting a finished shape must not count twice
      const before = (await state(page)).completed.length;
      await cut(page, spec.correct[0]);
      expect((await state(page)).completed.length).toBe(before);

      if (spec.id === 6) await atLevel(page, 7);
    });
  }

  test('a wrong option stays wrong however many correct ones are already cut', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.polygonGame.show(5));      // level 6
    await atLevel(page, 6);
    await cut(page, 'level-6-regular-convex-pentagon');
    await cut(page, 'level-6-irregular-convex-pentagon');
    await page.waitForTimeout(120);
    expect((await state(page)).completed.length).toBe(2);
    // two of three found; the hexagon and the quadrilateral are still not pentagons
    for (const id of ['level-6-irregular-hexagon', 'level-6-quadrilateral']) {
      await cut(page, id);
      await page.waitForTimeout(90);
      const s = await state(page);
      expect(s.completed.length, `${id} counted as a pentagon`).toBe(2);
      expect(s.level).toBe(6);
    }
  });
});

test.describe('flow', () => {
  test('the seven levels run in order, start to finish', async ({ page }) => {
    const errors = await boot(page);
    const seen = [];
    for (let n = 1; n <= 7; n++) {
      await atLevel(page, n);
      const s = await state(page);
      seen.push(s.level);
      const spec = SPEC.find(x => x.id === n);
      await expect(page.locator('#question')).toHaveText(spec.question);
      await expect(page.locator('#shapes .poly')).toHaveCount(spec.options);
      for (const id of spec.correct) await cut(page, id);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // the supplied sequence ends at seven, and no end screen is allowed: it holds
    await page.waitForTimeout(900);
    expect((await state(page)).level).toBe(7);
    expect(errors).toEqual([]);
  });

  test('a cut splits the polygon into two halves that are actually drawn', async ({ page }) => {
    await boot(page);
    const before = await page.locator('#shapes .poly:first-child .poly-half[d]').count();
    expect(before, 'an uncut shape has no halves').toBe(0);

    // the whole shape, measured before the cut, to compare against
    const whole = await page.evaluate(() =>
      document.querySelector('[data-option-id="level-1-regular-triangle"] .poly-body')
        .getBoundingClientRect().height);

    await cut(page, 'level-1-regular-triangle');
    await page.waitForTimeout(420);                 // let the halves finish parting

    /* Measured as RENDERED, not as written. An earlier version of this test read back the
       d attribute it had just caused to be set, and passed while the screen showed
       nothing at all: a CSS property of the same name was overriding the attribute, so
       both halves stayed empty paths. Anything asserting on an attribute that a CSS
       property can shadow is testing the wrong layer. */
    const r = await page.evaluate(() => {
      const svg = document.querySelector('[data-option-id="level-1-regular-triangle"] .poly-svg');
      const halves = [...svg.querySelectorAll('.poly-half')].map(h => {
        const box = h.getBoundingClientRect();
        return {
          d: h.getAttribute('d') || '',
          w: box.width, h: box.height,
          shown: getComputedStyle(h).opacity !== '0'
        };
      });
      const body = svg.querySelector('.poly-body');
      return {
        cut: svg.classList.contains('is-cut'),
        halves,
        bodyHidden: getComputedStyle(body).opacity === '0'
      };
    });

    expect(r.cut).toBe(true);
    expect(r.bodyHidden, 'the uncut body gives way to the halves').toBe(true);
    expect(r.halves.length).toBe(2);
    for (const h of r.halves) {
      expect(h.d.startsWith('M') && h.d.endsWith('Z'), 'a half should be a closed path').toBe(true);
      expect(h.d.split('L').length, 'a half needs three or more points').toBeGreaterThanOrEqual(3);
      expect(h.shown, 'a half should be visible').toBe(true);
      expect(h.w, 'a half should occupy real space on screen').toBeGreaterThan(8);
      expect(h.h, 'a half should occupy real space on screen').toBeGreaterThan(4);
    }
    // neither half is the whole shape: it really was divided
    expect(Math.min(...r.halves.map(h => h.h))).toBeLessThan(whole);
  });
});

/* REAL GESTURES.
 *
 * Everything above drives the game through its debug hook, which is the only practical
 * way to exercise 28 options across seven levels — but it says nothing about whether a
 * player can cut anything at all. It did not: for a while the listener sat on each shape,
 * so a stroke had to BEGIN on the polygon, and a swipe that started beside a shape and
 * swept through it — which is what cutting looks like — was never seen. Fifteen tests
 * passed while the game was unplayable. These use the pointer.
 */
test.describe('the cut gesture', () => {
  const boxOf = (page, id) => page.locator(`[data-option-id="${id}"]`).boundingBox();

  /** A stroke from one page point to another, as a real pointer would make it. */
  async function swipe(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(260);
  }

  test('a swipe that STARTS BESIDE a shape and sweeps through it cuts it', async ({ page }) => {
    await boot(page);
    const b = await boxOf(page, 'level-1-regular-triangle');
    // deliberately beginning outside the shape's own box, as a cutting motion does
    await swipe(page,
      { x: b.x - 40, y: b.y + b.height * 0.66 },
      { x: b.x + b.width + 40, y: b.y + b.height * 0.66 });
    expect((await state(page)).completed, 'the swipe did not register').toEqual(['level-1-regular-triangle']);
    await atLevel(page, 2);
  });

  test('a tap on a shape cuts it', async ({ page }) => {
    await boot(page);
    const b = await boxOf(page, 'level-1-regular-triangle');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6);
    await page.waitForTimeout(260);
    expect((await state(page)).completed).toEqual(['level-1-regular-triangle']);
  });

  test('a swipe through empty space cuts nothing', async ({ page }) => {
    await boot(page);
    const stage = await page.locator('#stage').boundingBox();
    // well below the row of shapes
    await swipe(page,
      { x: stage.x + stage.width * 0.2, y: stage.y + stage.height * 0.92 },
      { x: stage.x + stage.width * 0.8, y: stage.y + stage.height * 0.92 });
    const s = await state(page);
    expect(s.completed).toEqual([]);
    expect(s.level).toBe(1);
  });

  test('a swipe across a wrong shape does not advance the level', async ({ page }) => {
    await boot(page);
    const b = await boxOf(page, 'level-1-regular-hexagon');
    await swipe(page,
      { x: b.x - 30, y: b.y + b.height / 2 },
      { x: b.x + b.width + 30, y: b.y + b.height / 2 });
    const s = await state(page);
    expect(s.completed).toEqual([]);
    expect(s.level).toBe(1);
    // and the correct answer is untouched
    await expect(page.locator('[data-option-id="level-1-regular-triangle"].is-done')).toHaveCount(0);
  });

  test('one stroke cuts one shape, however many it crosses', async ({ page }) => {
    /* Otherwise "cut all the pentagons" would be finished by dragging across the whole
       row, and aiming would stop mattering. */
    await boot(page);
    await page.evaluate(() => window.polygonGame.show(5));      // level 6
    await atLevel(page, 6);
    const first = await boxOf(page, 'level-6-regular-convex-pentagon');
    const last = await boxOf(page, 'level-6-irregular-convex-pentagon');
    await swipe(page,
      { x: first.x - 40, y: first.y + first.height / 2 },
      { x: last.x + last.width + 40, y: last.y + last.height / 2 });
    const s = await state(page);
    expect(s.completed.length, 'a single sweep cut more than one shape').toBe(1);
    expect(s.level).toBe(6);
  });
});

test.describe('opening the file directly', () => {
  test('the game runs from file://, with no module loading', async ({ page }) => {
    /* Browsers refuse ES modules over file://: the origin is opaque, so every import is a
       cross-origin request that can never be allowed. A module build shows a blank page
       when the HTML file is opened by double-clicking it, with no visible error — which
       is exactly what happened. The scripts are classic for that reason, and this is the
       test that keeps them that way. */
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    const { pathToFileURL } = await import('node:url');
    const { resolve } = await import('node:path');
    await page.goto(pathToFileURL(resolve('game/index.html')).href);

    await page.waitForFunction('window.polygonGame', null, { timeout: 15_000 });
    await expect(page.locator('#question')).toHaveText('Cut the triangle.');
    await expect(page.locator('#shapes .poly')).toHaveCount(3);
    expect(errors).toEqual([]);

    // and it is playable there, not merely visible
    const b = await page.locator('[data-option-id="level-1-regular-triangle"]').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6);
    await page.waitForTimeout(260);
    expect((await page.evaluate('window.polygonGame.debug()')).completed)
      .toEqual(['level-1-regular-triangle']);
  });
});
