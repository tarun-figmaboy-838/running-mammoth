/* Shared helpers.

   The game runs its own requestAnimationFrame loop, so these tests can simply wait —
   no clock shim is needed. What they do need is a deterministic way to put the game
   at a given moment, which the engine's underscore-prefixed debug hooks provide. */

export const READY = 'window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"';

/** Load the game and wait until the world exists and the loader is gone. */
export async function boot(page, { skipScreens = true, sound = false, speed = 0, fast = 0 } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const q = [];
  if (skipScreens) q.push('skip=1');
  if (!sound) q.push('sound=0');
  if (speed) q.push('speed=' + speed);
  if (fast) q.push('fast=' + fast);
  await page.goto('/index.html' + (q.length ? '?' + q.join('&') : ''));
  /* The game preloads its whole art set before it will start, which is a real
     cold-start cost — give it room rather than hiding it behind a short timeout.
     READY going true IS the end of loading; there is no loading curtain to wait on. */
  await page.waitForFunction(READY, null, { timeout: 60_000 });
  return errors;
}

/* Real JavaScript faults only, with resource-load noise dropped.

   The character's five sprite sheets are currently missing from game/assets/char —
   CFG.characters points at mammoth-*.webp and the folder holds un-sliced raw art —
   so every page logs five console 404s. That is an ART problem, and the tests that
   exist to guard the art (assets.spec, and the sheet and no-404 checks in game.spec
   and ui.spec) are the ones that should fail while it lasts. A test about gameplay
   asserting on the same noise says nothing about gameplay, so it filters to
   pageerror — an exception thrown by the game itself, which nothing should ever
   produce. Delete this once the sheets are back and use the raw list again. */
export const jsErrors = errors => errors.filter(e => e.startsWith('pageerror'));

/** The engine's live state object. */
export const G = page => page.evaluate('window.iceAgeGame.debug()');

/** Wait until the game reaches one of these states. */
export async function waitState(page, states, timeout = 30_000) {
  const list = Array.isArray(states) ? states : [states];
  await page.waitForFunction(
    ss => ss.includes(window.iceAgeGame.state()),
    list, { timeout, polling: 50 }
  );
  return page.evaluate('window.iceAgeGame.state()');
}

/** Force a state, the way the in-repo QA harnesses do. */
export const force = (page, s) => page.evaluate(st => window.iceAgeGame._force(st), s);

/** Slice a hanging option by shape name. */
export const cut = (page, kind) => page.evaluate(k => window.iceAgeGame._cut(k), kind);

/** Play the whole of Level 1, answering correctly, and return the state trail. */
export async function playLevelOne(page, { wrongFirst = false, budgetMs = 300_000 } = {}) {
  return page.evaluate(async opts => {
    const g = window.iceAgeGame;
    const trail = [];
    let last = '';
    const t0 = Date.now();
    const triedBad = new Set();

    /* Generous, and the CALLER's budget rather than a constant. A runner without a
       GPU spends most of a frame compositing the backbuffer, and because the game's
       clock is driven by animation frames it then runs in slow motion — so six phases
       take far longer in wall clock than in game time. This loop used to run for 240s
       inside a 120s test, which meant a slow machine timed out mid-loop and the
       assertion afterwards reported a progression bug that was not happening. */
    while (Date.now() - t0 < opts.budgetMs) {
      const G = g.debug();
      const s = G.state;
      if (s !== last) { trail.push(s + '@' + G.phase); last = s; }

      // clear anything in the way
      for (const o of g._obstacles().list) {
        const sx = o.x - G.worldX;
        if (sx > 380 && sx < 700 && !o.passed) g.jump();
      }
      if (s === 'OBSTACLE_HIT') g.retryObstacle();

      if (s === 'PHASE_ACTIVE' && G.l1) {
        // what the phase still WANTS; any open crevasse will take it
        const target = G.l1.unfilled[0];
        if (opts.wrongFirst && !triedBad.has(G.phase)) {
          const bad = G.l1.shapes.find(x => x.state === 'hang' &&
            !G.l1.unfilled.includes(x.kind));
          if (bad) { triedBad.add(G.phase); g._cut(bad.kind); }
        } else if (target) {
          g._cut(target);
        }
      }

      if (s === 'FINAL_RUN' || s === 'COMPLETE') break;
      await new Promise(r => requestAnimationFrame(r));
    }
    const G = g.debug();
    return {
      trail, state: G.state, phase: G.phase, phasesDone: G.phasesDone,
      // so a caller can tell "the level stalled" from "we ran out of wall clock"
      timedOut: Date.now() - t0 >= opts.budgetMs
    };
  }, { wrongFirst, budgetMs });
}
