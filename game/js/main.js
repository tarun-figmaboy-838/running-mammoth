/* Entry point.
   Boots the canvas engine, the DOM HUD and the cover/character-select front end,
   and exposes a few optional URL overrides for playtesting:

     index.html?speed=380      run speed in px/s (300–900)
     index.html?sound=0        start muted
     index.html?reduced=1      reduced-motion mode (less shake, fewer particles)
     index.html?skip=1         skip the cover/select screens and run immediately
     index.html?fast=4         fast-forward: simulation steps per rendered frame (1–8).
                               Steps the simulation rather than scaling dt, so physics
                               is identical to normal play — it just spends less wall
                               clock. Every pause in the game is a fixed duration in
                               milliseconds, so ?speed cannot shorten a playthrough.
*/

import { createGame } from './engine.js';
import { Hud } from './hud.js';
import { Frontend } from './frontend.js';

const canvas = document.getElementById('game-canvas');
const hud = new Hud(document);

const params = new URLSearchParams(location.search);
const num = (key, min, max, fallback) => {
  const v = Number(params.get(key));
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
};
const flag = (key, fallback) => {
  const v = params.get(key);
  if (v === null) return fallback;
  return v !== '0' && v !== 'false';
};

const options = {
  speed: num('speed', 300, 900, 520),
  fast: num('fast', 1, 8, 1),
  sound: flag('sound', true),
  reduced: flag('reduced', false)
};

let front = null;
let lastOops = false;

const game = createGame(canvas, {
  onReady: () => {
    /* Straight to the cover. There is no loading curtain: onReady only fires once
       the whole art set has preloaded, so the first thing drawn is already the
       finished cover — a spinner in front of it was covering nothing. */
    if (flag('skip', false)) { game.begin(); return; }
    front = new Frontend(document, game);
    front.init({ onStart: () => game.begin() });
  },
  onHud: state => {
    hud.update(state);
    // the Ouch panel shows the chosen explorer's own hurt frames
    if (front && !!state.oops !== lastOops) {
      lastOops = !!state.oops;
      if (state.oops) front.showHurt(); else front.hideHurt();
    }
  }
});

game.setOptions(options);

hud.bind({
  onJump: () => game.jump(),
  onPause: paused => game.setPaused(paused),
  onReplay: () => game.restart(),
  onRetry: () => game.retryObstacle(),
  // returns the new state so the HUD can swap the glyph without asking again
  onSound: () => game.toggleSound(),
  // re-states the objective; it never reveals which chunk is the answer
  onHint: () => game.replayInstruction()
});

// A keyboard jump should depress the on-screen button too, so the control reads as
// the same thing whether it is tapped or keyed.
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') hud.flashJump();
});

// Auto-pause when the tab loses focus so the character is never mid-jump on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !hud.paused) game.setPaused(true);
  else if (!document.hidden && !hud.paused) game.setPaused(false);
});

window.addEventListener('beforeunload', () => {
  game.destroy();
  hud.destroy();
  if (front) front.destroy();
});

// Handy for debugging from the console; harmless in production.
window.iceAgeGame = game;
