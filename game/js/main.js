/* Entry point.
   Boots the canvas engine, the DOM HUD and the cover/character-select front end,
   and exposes a few optional URL overrides for playtesting:

     index.html?speed=380      run speed in px/s (300–900)
     index.html?sound=0        start muted
     index.html?reduced=1      reduced-motion mode (less shake, fewer particles)
     index.html?skip=1         skip the cover/select screens and run immediately
     index.html?tutorial=0     never show the first-play tutorial
     index.html?tutorial=1     always show it, however many times it has been seen
     index.html?fast=4         fast-forward: simulation steps per rendered frame (1–8).
                               Steps the simulation rather than scaling dt, so physics
                               is identical to normal play — it just spends less wall
                               clock. Every pause in the game is a fixed duration in
                               milliseconds, so ?speed cannot shorten a playthrough.
*/

import { createGame } from './engine.js';
import { Hud } from './hud.js';
import { Frontend } from './frontend.js';
import { Tutorial } from './tutorial.js';

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

let tut = null;
let lastComplete = false;

/* THE TUTORIAL RUNS EVERY TIME, and the remembering is gone on purpose.
 *
 * It was suppressed after the first play, held in localStorage. That is the
 * conventional choice and it was the wrong one here, for a reason that showed up the
 * moment anyone tried to look at it: once the flag is set the tutorial is invisible
 * and there is no way back to it from inside the game — so a returning player, a
 * second child on the same browser, a classroom machine, or anyone reviewing the
 * build gets dropped straight into gameplay with no explanation and no clue that a
 * tutorial exists at all. A stored flag also makes the feature untestable by hand:
 * it works once and then appears broken forever.
 *
 * It is six short steps with a Skip in the corner, so the cost of showing it again is
 * one tap; the cost of hiding it is a player who never learns the cut. ?tutorial=0
 * suppresses it, which is what the test suite passes.
 */
const tutFlag = params.get('tutorial');
const wantTutorial = tutFlag !== '0' && tutFlag !== 'false';

const game = createGame(canvas, {
  onReady: () => {
    /* Straight to the cover. There is no loading curtain: onReady only fires once
       the whole art set has preloaded, so the first thing drawn is already the
       finished cover — a spinner in front of it was covering nothing. */
    if (flag('skip', false)) { game.begin(); startTutorial(); return; }
    front = new Frontend(document, game);
    front.init({ onStart: () => { game.begin(); startTutorial(); } });
  },
  onHud: state => {
    hud.update(state);
    /* The Ouch panel used to be fed the explorer's own hurt frames from here. Both
       the panel and the frame pump are gone: the crash animation plays on the CANVAS
       now, from the delivered knockout sheet, which is where it always belonged.

       The WIN panel does still want a picture of the character, and it is filled once
       on the transition rather than every HUD tick — onHud fires on every state change
       and re-setting the same background image on each of them is work for nothing. */
    if (front && !!state.complete !== lastComplete) {
      lastComplete = !!state.complete;
      /* Nothing to fill: the win panel has no hero picture any more. The character on
         the CANVAS behind it is celebrating next to the friend who was waiting, which
         is the picture that matters, and a still copy of him on the panel competed
         with it — as well as covering the pair of them. */
    }
  }
});

/* THE TUTORIAL'S OWN TICK, on its own animation frame rather than inside onHud.

   Two reasons, and both are the kind that only show up once it is wired the other
   way. onHud fires from the engine update, which the tutorial PAUSES — so driving it
   from there would stop it dead on its first explaining step, with nothing left
   running to resume it. And onHud only fires when its state object CHANGES, so it is
   not a per-frame signal at all.

   This loop keeps running while the simulation is frozen, which is exactly the
   point, and the tutorial reads what it needs from debug() itself. */
function startTutorial() {
  if (!wantTutorial || tut) return;
  tut = new Tutorial(document, game);
  tut.begin();
  let last = performance.now();
  const tick = now => {
    if (!tut || tut.done) { tut = null; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tut.update(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

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

/* Auto-pause when the tab loses focus so the character is never mid-jump on return.

   AND SILENCE IT. Pausing only stopped the simulation: the AudioContext kept running
   and the music element kept playing, so a backgrounded tab went on making noise from
   a game that was frozen — which on a phone means the music plays over whatever the
   child switched to, and the tab keeps a decoder alive for no reason. Both are
   suspended here and resumed together with the simulation. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !hud.paused) { game.setPaused(true); game.suspendAudio(); }
  else if (!document.hidden && !hud.paused) { game.setPaused(false); game.resumeAudio(); }
});

window.addEventListener('beforeunload', () => {
  game.destroy();
  hud.destroy();
  if (tut) tut.destroy();
  if (front) front.destroy();
});

// Handy for debugging from the console; harmless in production.
window.iceAgeGame = game;
