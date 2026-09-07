/* THE FIRST-PLAY TUTORIAL.
 *
 * Teaches the two mechanics the game is made of — jump the rock, cut a rope to mend
 * the path — by spotlighting one thing at a time and then making the player do it.
 *
 * WHY IT IS A DOM LAYER AND NOT DRAWN ON THE CANVAS. The engine never touches the DOM
 * and the HUD never touches the canvas; that separation is what keeps the renderer
 * testable. The tutorial has to point at BOTH kinds of thing — the mammoth and the
 * crevasse are canvas pixels, the JUMP button is an element — so it lives on the DOM
 * side and addresses canvas targets in stage coordinates, converted to percentages of
 * the stage exactly as the verdict mark and the hand hint already do.
 *
 * THE RULES IT FOLLOWS, all of which are load-bearing:
 *
 *   ONE THING AT A TIME, WITH THE STAGE TO ITSELF. An instruction that appears while
 *   the objects it describes are still moving loses: the player watches the movement.
 *   So an explaining step PAUSES the game, holds the stage alone, and only releases it
 *   when the player taps.
 *
 *   IT TEACHES BY DOING. The two steps that matter — the jump and the cut — do not
 *   advance on a tap. They unpause and wait for the player to actually perform the
 *   action, then confirm it. A tutorial that advances on taps has taught nothing.
 *
 *   IT NEVER COMPLETES THE TASK. Nothing here jumps, cuts, or moves the game on by
 *   itself.
 *
 *   IT NEVER LEAKS AN ANSWER. The block step spotlights the WHOLE row, never one
 *   option, and its wording is about ropes and blocks, never about which shape fits.
 *   The curriculum is the game's whole purpose and a tutorial that hands over the
 *   first answer costs the first phase its teaching.
 *
 *   NOTHING IS PARKED AT OPACITY 0. Every element rests visible and animates from
 *   there, so a dropped keyframe or a reduced-motion setting cannot leave the layer
 *   permanently invisible while every attribute still reads as intended.
 *
 * Shown on every run. `?tutorial=0` suppresses it, which is what the test suite
 * passes, since almost none of those tests expects a coach mark over the stage.
 */

/* NO STORED "SEEN" FLAG. There was one, and it made the tutorial invisible after a
   single play with no way to bring it back — see the note in main.js. Nothing writes
   it now, and nothing reads it: a key left behind, still being written but no longer
   consulted, is exactly the sort of thing that gets wired back up by accident. */

/* Stage coordinates, because that is the space the engine thinks in: a 1920x1080
   backbuffer letterboxed into whatever the viewport is. Converted to percentages of
   the stage element on the way out, so one set of numbers is correct at every size. */
const W = 1920, H = 1080;
const clampN = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;


import { fitBubble } from './bubble.js';

export class Tutorial {
  /**
   * @param {Document} root
   * @param {object} game  the engine handle from createGame()
   */
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.el = {
      layer: root.getElementById('tutorial'),
      veil: root.getElementById('tut-veil'),
      focus: root.getElementById('tut-focus'),
      canvas: root.getElementById('game-canvas'),
      bubble: root.getElementById('tut-bubble'),
      shape: root.getElementById('tut-shape'),
      text: root.getElementById('tut-text'),
      hand: root.getElementById('tut-hand'),
      skip: root.getElementById('tut-skip')
    };
    this.step = -1;
    this.done = false;
    this.t = 0;                    // seconds the current step has been on screen
    this.hold = 0;                 // a follow-up line's remaining time
    this.follow = null;
    this._built = false;
    this._wasPaused = false;
  }

  /* ---- the script ----

     TWO KINDS OF STEP, and the difference decides everything else about them.

     A DESCRIBING step states what something is. It freezes the game, blurs everything
     except the thing it is talking about, holds long enough to be read, and then moves
     on BY ITSELF. There is no hand and nothing to tap: asking a child to confirm they
     have read a sentence is asking the wrong question, and a hand on a step with no
     action to perform teaches that the hand means nothing.

     An ASKING step wants a finger. It lets the game run, shows the hand on the control
     to use, and waits for the player to actually do it — a jump, or a cut. The veil is
     off for these, because the player has to see the scene they are acting in.

     `advance` says which kind it is: a NUMBER of seconds means describing and
     self-advancing; a string names the action to wait for. */
  get steps() {
    /* SEVEN LINES, SHORT AND ACTION-ORIENTED (the owner's script, September 2026). The
       earlier lines explained what the learner could already see ("He runs all by
       himself!", "Blocks of ice are hanging on ropes up here."). These establish Momo, his
       goal and the two controls, and get out of the way:

         1 This is Momo. He needs to find his friend.       describing, frozen, Momo lit
         2 Help Momo cross the Frozen Pass!                 describing, frozen, Momo lit
         3 Watch out!                                       describing, frozen, obstacle lit
         4 Tap to jump over obstacles.                      ASKING: frozen 1.2s to read (a tap then is armed), tap hand on JUMP, waits for the jump
         5 Oh no! The path is broken.                       describing, frozen, gap lit
         6 Use the right ice piece to fix the path.         ASKING: sweep hand on the right rope, waits for the cut
         7 Perfect fit! Keep going!                         describing, game running, self-advances

       The pauses are what keep it fair: the obstacle is frozen on screen while 3 is read
       and is jumpable the moment 4 starts; the gap and the blocks are frozen while 5 is
       read. Line 4 folds the old "this is the button" and "tap it now" into one ask, so the
       time from resume to the obstacle is exactly what it was. Line 6 is the ask itself:
       the sweep hand on the rope of the answer says WHICH and HOW, the sentence says WHY. */
    const momo = () => {
      let feet = 840;
      try {
        const p = this.game._player && this.game._player();
        if (p && typeof p.feetY === 'number') feet = p.feetY;
      } catch (e) { /* fall back to the path line */ }
      return { x: 430, y: feet - 200, rx: 165, ry: 205, world: true };
    };
    return [
      {
        id: 'meet',
        at: g => ['RUN_SEGMENT_1', 'JUMP_CHALLENGE_1'].includes(g.state),
        spot: momo,
        text: 'This is Momo. He needs to find his friend.',
        focus: 'mammoth',
        advance: 0, pause: true
      },
      {
        id: 'goal',
        at: g => ['RUN_SEGMENT_1', 'JUMP_CHALLENGE_1'].includes(g.state),
        spot: momo,
        text: 'Help Momo cross the Frozen Pass!',
        focus: 'mammoth',
        advance: 0, pause: true
      },
      {
        /* The obstacle is described with the game stopped, so it can be looked at before
           anything is expected — and it is still there, frozen, when the ask begins. */
        id: 'rock',
        at: g => this.rockAhead(g) !== null,
        spot: g => {
          const sx = this.rockAhead(g);
          return sx === null ? null : { x: sx, y: 780, rx: 150, ry: 140, world: true };
        },
        text: 'Watch out!',
        focus: 'rock',
        advance: 0, pause: true
      },
      {
        /* One ask instead of a description and an ask: the hand on the button says WHERE,
           the sentence says WHAT and WHEN. A tap anywhere jumps too, and counts. */
        id: 'jump',
        at: () => this.domSpot('#btn-jump', 40) !== null,
        spot: () => this.domSpot('#btn-jump', 40, 'bottom'),
        text: 'Tap to jump over obstacles.',
        advance: 'jumped', pause: 1.2, hand: 'tap'
      },
      {
        id: 'gap',
        /* The ice has to have actually broken: g.open runs 0 -> 1 as the ground gives way. */
        /* AND HE HAS STOPPED AND TREMBLED. The owner's sequence: he arrives at the lip, the
           whole tremble plays (notice, look down, tremble, look to the player, settle), and
           THEN the line comes with the gap lit — the reaction first, the words about it
           after. GLACIER_BREAK_1 is the skid, and firing there froze him mid-slide; SHAKE is
           the tremble, and firing during it froze the performance. So: stopped, and no
           longer trembling. */
        at: g => (g.gapsThisPhase || []).some(gp => gp && (gp.open || 0) > 0.75) &&
                 ['PHASE_INTRO', 'PHASE_ACTIVE'].includes(g.state) &&
                 (() => { const p = this.game._player && this.game._player(); return !p || p.state !== 'SHAKE'; })(),
        spot: g => {
          const gp = (g.gapsThisPhase || [])[0];
          if (!gp) return null;
          const cx = (gp.x0 + gp.x1) / 2 - g.worldX;
          return { x: cx, y: 900, r: Math.max(185, (gp.x1 - gp.x0) * 0.62), world: true };
        },
        text: 'Oh no! The path is broken.',
        focus: 'gap',
        advance: 0, pause: true
      },
      {
        /* THE ASK. The sweep hand is on the rope of the answer (ropeBox), the engine's demo
           stroke crosses the same rope, and the bubble sits beneath the blocks so it never
           hides the piece it means. */
        id: 'cut',
        at: g => !!g.l1 && g.state === 'PHASE_ACTIVE' && this.ropeBox(g) !== null,
        spot: g => this.ropeBox(g),
        text: 'Use the right ice piece to fix the path.',
        advance: 'cut', pause: false, hand: 'sweep'
      },
      {
        /* The reward line runs over the celebration and lets go by itself; the game is
           not stopped for it. Only after a RIGHT cut — a wrong one gets the game's own
           answer (the splash, the instruction back), not this. */
        id: 'fit',
        at: g => ['PHASE_SUCCESS', 'PHASE_DONE', 'PHASE_RUN'].includes(g.state),
        spot: momo,
        text: 'Perfect fit! Keep going!',
        advance: 0, pause: false
      }
    ];
  }

  /* ---- where things are ---- */

  /** The nearest rock still ahead of the character, in stage x, or null. */
  /* WITHIN 1050px (was 1500, then 1200): described from a thousand pixels away the obstacle
     looked like nothing to worry about, and it still read as far at 1200. At 1050 it is right in
     his path while 'Watch out!' is read. The jump ask then freezes 1.2s for reading, and a tap
     DURING that freeze is not thrown away: the engine arms it and jumps when the obstacle is in
     range (api.jump / onDown while paused), so a child who taps at once still clears it. A tap
     after the resume has about 0.8s. The engine's rockAhead mirrors this number. */
  rockAhead(g) {
    const list = this.game._obstacles ? this.game._obstacles().list : [];
    let best = null;
    for (const o of list) {
      if (o.passed || o.hits >= 3) continue;
      const sx = o.x - g.worldX;
      if (sx > 620 && sx < 1050 && (best === null || sx < best)) best = sx;
    }
    return best;
  }

  /** The nearest obstacle ahead, as words: { noun: 'rock'|'log'|'fossil', cap: 'A rock'|... }. */
  ropeBox(g) {
    const hang = ((g.l1 && g.l1.shapes) || []).filter(s => s.state === 'hang');
    if (!hang.length) return null;
    /* THE ROPE OF THE ANSWER, not the middle one. A student copies the hand; on the middle
       rope that copy cut the wrong block two times in three (student playtest). The engine's
       demo stroke (drawCutDemo) aims the same way in this phase, so the two agree. The
       middle rope is only the fallback when nothing is wanted. */
    const want = g.l1.unfilled && g.l1.unfilled[0];
    const sorted = hang.slice().sort((a, b) => a.x - b.x);
    const mid = hang.find(s => s.kind === want) || sorted[Math.floor(sorted.length / 2)];
    const topOfBlock = mid.y - (mid.h || 200) / 2;
    if (topOfBlock < 60) return null;                 // rope still off the top
    const ropeY = Math.max(70, topOfBlock - 60);
    /* THE ZONE TO KEEP CLEAR IS THE ROPES AND THE BLOCKS, not the rope alone. With a
       90px box around the rope, a phone's taller bubble could not fit above it and was
       placed "below" — squarely over the blocks, hiding the very block the sentence
       named (student playtest). The zone now runs from the top of the stage to under the
       blocks, so the bubble lands beneath them, over open ice; the hand still aims at the
       rope itself (handY), which is where the swipe has to happen. */
    const bottom = mid.y + (mid.h || 200) / 2 + 12;
    return { x: mid.anchorX !== undefined ? mid.anchorX : mid.x, y: (60 + bottom) / 2, rx: 150, ry: (bottom - 60) / 2,
             handY: ropeY, world: true };
  }

  /** A box around every hanging block, in stage coordinates. */
  rowBox(g) {
    const hang = ((g.l1 && g.l1.shapes) || []).filter(s => s.state === 'hang');
    if (!hang.length) return null;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const s of hang) {
      x0 = Math.min(x0, s.x - s.w / 2); x1 = Math.max(x1, s.x + s.w / 2);
      y0 = Math.min(y0, s.y - s.h / 2); y1 = Math.max(y1, s.y + s.h / 2);
    }
    if (y1 < 40) return null;                       // still off the top of the screen
    /* AN OVAL AROUND THE ROW, not a circle enclosing it. The row is much wider than it
       is tall, so one radius big enough to cover its width is enormous vertically —
       1228px across for a 970px row, which is most of the screen. Separate axes hug it. */
    return {
      x: (x0 + x1) / 2, y: (y0 + y1) / 2,
      rx: (x1 - x0) / 2 + 60,
      ry: (y1 - y0) / 2 + 50,
      world: true
    };
  }

  /** A DOM element's box, in stage coordinates, so one code path places every spot. */
  domSpot(sel, pad = 40, handAt) {
    const stage = this.root.getElementById('stage');
    const el = this.root.querySelector(sel);
    if (!stage || !el) return null;
    const s = stage.getBoundingClientRect(), b = el.getBoundingClientRect();
    if (!b.width || !b.height) return null;         // hidden: nothing to point at
    const x = (b.x + b.width / 2 - s.x) / s.width * W, y = (b.y + b.height / 2 - s.y) / s.height * H;
    const hh = b.height / s.height * H / 2;
    return {
      x, y,
      /* THE HAND TOUCHES THE BUTTON FROM BELOW. Centred on the button it was the size of
         the button and hid it; asked for: small, upright, fingertip a little inside the
         lower edge. The hand's centre goes just under the edge, so its fingertip (the top
         of the icon) reaches ~25 stage px into the button and the rest hangs clear. */
      handX: handAt === 'bottom' ? x + 12 : undefined,
      handY: handAt === 'bottom' ? y + hh + 24 : undefined,
      r: Math.max(b.width / s.width * W, b.height / s.height * H) / 2 + pad,
      /* A DOM TARGET IS RAISED ABOVE THE SHEET. Canvas subjects are re-drawn by the
         engine onto the focus canvas; the JUMP button is not on the canvas, it is an
         element, so it names its selector and is lifted in the stacking order instead —
         where the stylesheet gives it the same gold outline glow (.tut-lift). */
      dom: sel
    };
  }

  /* ---- lifecycle ---- */

  begin() {
    if (this._built) return;
    this._built = true;
    if (this.el.skip) this.el.skip.addEventListener('click', () => this.finish());
    /* THE WHOLE STAGE IS THE BUTTON. There is no "Got it" any more: the hand taps on
       the thing being explained, and a tap anywhere acknowledges it. That is both
       simpler and more honest about what the hand is asking for — a child who cannot
       read the sentence yet can still see a finger tapping and copy it, whereas a
       button labelled "Got it" is a claim about reading.

       Pointer events on the layer are switched off for action steps, so a real swipe
       still reaches the canvas. */
    if (this.el.layer) this.el.layer.addEventListener('click', e => {
      if (e.target === this.el.skip) return;
      this.tap();
    });
    this.step = 0;
    this.t = 0;
  }

  /* HOW LONG A SENTENCE STAYS UP, from the sentence rather than a constant.

     A fixed hold is either too short for the longest line or too slow for the shortest
     one. 1.5s of looking-at-it plus ~55ms a character puts "This is your mammoth. He
     runs all by himself!" at about 3.9s and the shortest line at the 2.6s floor, which
     is a comfortable read for a child rather than a glance for an adult. Clamped at
     both ends so no line can rush past or outstay its welcome. */
  readTime(text) {
    return clampN(1.5 + (text || '').length * 0.055, 2.6, 5.2);
  }

  /* NO TAP-TO-ADVANCE. A describing step moves on by itself and a tap does nothing.
     Tapping past a sentence is not something a child does deliberately — they tap
     because a finger is on the screen — so honouring it would skip the instruction
     they were about to read. Skip is the deliberate way out, and it is a button. */
  tap() { /* intentionally nothing: see above */ }

  /** The player did the thing an action step was waiting for. */
  didAction(name) {
    if (this.done) return;
    const s = this.steps[this.step];
    if (s && s.advance === name) {
      if (s.follow) { this.follow = s.follow; this.hold = 1.4; }
      this.next();
    }
  }

  next() {
    this.step++;
    this.t = 0;
    if (this.step >= this.steps.length) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.resume();
    if (this._lifted) {
      const el = this.root.querySelector(this._lifted);
      if (el) el.classList.remove('tut-lift');
      this._lifted = null;
    }
    this.hideFocus();
    if (this.el.layer) this.el.layer.hidden = true;
    this._bubbleKey = null;
  }

  pause(asking) {
    // an ask's freeze may arm a jump for later; a line being read never may (see api.setPaused)
    if (this._wasPaused && this._askingPause === !!asking) return;
    this._wasPaused = true; this._askingPause = !!asking;
    this.game.setPaused(true, { asking: !!asking });
  }
  resume() {
    if (!this._wasPaused) return;
    this._wasPaused = false;
    this.game.setPaused(false);
  }

  /* ---- one tick, called from the host's animation frame ---- */
  /* THE WORLD HAS TO BE ON SCREEN BEFORE ANYTHING IS SAID ABOUT IT.
   *
   * setPaused stops the render as well as the simulation — deliberately, so a paused
   * game holds its last frame — and the tutorial starts on the same tick the run
   * begins. So the very first step froze the game BEFORE a single frame had been
   * drawn, and the spotlight lit a blank canvas: a dark stage with a speech bubble on
   * it, pointing at nothing. Measured as a uniformly dark screenshot, which is the
   * only way this shows up — every element was present, sized and correct.
   *
   * It is also the better teaching order. "He runs all by himself" is a claim about
   * something the player should have watched happen, so waiting a beat for him to
   * actually run is not a workaround for the freeze; it is the instruction landing
   * after its demonstration rather than before it. */
  static WARMUP = 1.1;              // seconds of game time before the first step

  update(dt) {
    if (this.done || this.step < 0) return;
    const g = this.game.debug();

    /* THE TUTORIAL ENDS WHEN THE GAME DOES. Nothing here can teach anything once the
       journey is over, and outliving it made a visible mess: a player who got ahead of
       the script — or past a step whose target never appeared — reached the ending with
       the tutorial still holding a describing step. On screen that was the whole game
       blurred behind the sheet, the ending card and the Play again button over the top
       of it, and the dialogue box parked at the left edge pointing at something that no
       longer existed.

       Checked before any step runs, so no step can execute in a state it was never
       written for. */
    if (g.complete || g.state === 'COMPLETE' || g.state === 'FINAL_RUN') {
      this.finish();
      return;
    }
    if (this.step === 0 && (g.t || 0) < Tutorial.WARMUP) {
      this.resume();
      this.show(null);
      return;
    }

    /* WHAT THE PLAYER ACTUALLY DID, read straight off the game each tick.
     *
     * This was first wired through onHud and that cannot work: onHud fires from the
     * engine update, which an explaining step has PAUSED, and it only fires when its
     * state object changes — so it is neither running nor per-frame at the moments
     * this needs. Reading here means the jump step is satisfied by the character
     * genuinely leaving the ground and the cut step by an attempt being recorded, and
     * neither can be satisfied by tapping past it. */
    const anim = this.game.mammothState && this.game.mammothState();
    if (anim === 'JUMP_AIR' || anim === 'LAND') this.didAction('jumped');
    if ((g.attempts || 0) > 0) this.didAction('cut');

    // the follow-up line ("Nice hop!") runs on its own clock over the next step
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.follow = null;
    }

    const s = this.steps[this.step];
    if (!s) { this.finish(); return; }

    /* NOT READY YET is a normal state, not an error. A step waits for its own moment —
       a rock coming into range, the blocks arriving — and while it waits the game runs
       and the layer shows nothing. */
    if (!s.at(g)) { this.resume(); this.show(null); return; }
    const box = s.spot(g);
    if (!box) { this.resume(); this.show(null); return; }

    this.t += dt;
    /* A NUMBER freezes the game for that many seconds of the step, then lets it run: an ask
       that has to be READ before it can be acted on ("Tap to jump over obstacles.") holds
       the obstacle still for the reading, exactly as the old describing step did, and then
       the run resumes with the hand still asking. `true` freezes for the whole step. */
    const frozen = s.pause === true || (typeof s.pause === 'number' && this.t < s.pause);
    if (frozen) this.pause(typeof s.pause === 'number'); else this.resume();

    /* DESCRIBING or ASKING — a number of seconds means the former. The veil and the
       frozen copy belong to describing steps; the hand belongs to asking ones. */
    const describing = typeof s.advance === 'number';
    const text = this.follow || (typeof s.text === 'function' ? s.text(g) : s.text);

    /* ON AN ASKING STEP THE WORDS LEAVE AND THE HAND STAYS.

       An asking step waits for the player, which can be a while — and the box was
       sitting over the blocks for all of it, covering the very things being pointed
       at. So the sentence is shown long enough to be read and then goes, leaving the
       hand demonstrating on a clear screen. The step itself carries on waiting.

       A describing step keeps its box for its whole life, because the box IS the step. */
    /* AN ASKING STEP'S WORDS LEAVE PROMPTLY. A describing step keeps its box for its
       whole life, because the box IS the step. An asking step waits for the player,
       which can be as long as they like — so the sentence gets a short read and then
       goes, leaving the hand demonstrating on a clear screen.

       It was readTime + 0.6, which for the longest line was 5.2s. That is far too long
       to sit over the blocks being pointed at, and it never showed up in testing
       because the harness performed the action within a second every time — so the
       box was measured as present and never seen to leave. Short lines on asking steps
       and a 2.4s cap: long enough to read four words, short enough to get out of the
       way before anyone is ready to act. */
    const keepBox = describing || this.t < Math.min(2.4, this.readTime(text));
    this.show(this.toView(box, g), text, describing, s.hand || null, keepBox, s.focus || null, s.pause === false);

    // and a describing step moves on once it has been up long enough to read
    if (describing && this.t >= this.readTime(text)) this.next();
  }

  /* THE VIEW TRANSFORM, applied to canvas-space targets only.
   *
   * A phase zooms the canvas by k about a stage point, so a spotlight positioned at a
   * raw stage coordinate no longer sits on the thing it is pointing at — the mammoth,
   * the ditch and the block row all move outward from the focus, by more the further
   * out they are. The radius scales too, or the light stops matching the object.
   *
   * The JUMP button target is measured from a real DOM rect and is already in screen
   * space, so it must NOT be mapped: doing that would move the one target that was
   * correct. That is what `world` marks. */
  toView(box, g) {
    const k = g.zoom || 1;
    if (!box.world || k <= 1.0005) return box;
    const fx = g.zoomVX, fy = g.zoomVY;
    const out = {
      x: fx + (box.x - fx) * k,
      y: fy + (box.y - fy) * k,
      world: box.world
    };
    // both axes scale, or an oval stops matching the row it hugs
    if (box.r !== undefined) out.r = box.r * k;
    if (box.rx !== undefined) out.rx = box.rx * k;
    if (box.ry !== undefined) out.ry = box.ry * k;
    return out;
  }

  /* THE WORDS, ONE AT A TIME, WITH ONE OF THEM LOUD.
     Each word is its own span so it can rise into place a beat after the one before —
     the sentence arrives the way a voice says it, not as a block. The KEY word of the
     sentence (anything the writer put in capitals, or one of the game's own nouns and
     verbs) is marked .pow: heavier, deep blue, tilted a few degrees. One accent per
     sentence at most; the rest stays black on yellow, which is what a new reader needs.
     textContent of the result equals the plain text, so the change detection above
     still works. */
  setWords(text) {
    const el = this.el.text;
    if (!el) return;
    const KEY = /^(friend|cross|watch|tap|jump|broken|right|fix|perfect|ice|rope|cut|swipe)[!.,?]*$/i;
    const parts = (text || '').split(/(\s+)/);
    let i = 0, powed = false;
    el.textContent = '';
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); continue; }
      const w = document.createElement('span');
      const loud = !powed && ((p.length > 2 && p === p.toUpperCase() && /[A-Z]/.test(p)) || KEY.test(p));
      w.className = loud ? 'w pow' : 'w';
      if (loud) powed = true;
      w.style.setProperty('--i', i++);
      w.textContent = p;
      el.appendChild(w);
    }
  }

  /** THE BOX HUGS THE WORDS.
   *
   * `width: max-content` capped by `max-width` hands the box the WHOLE cap as soon as the
   * sentence is longer than it, and `text-wrap: balance` then breaks that sentence into lines
   * far shorter than the cap. Measured on "This is Momo. He needs to find his friend.": a 500px
   * box with a 336px widest line — 82px of empty yellow, which is why the bubble read as
   * half-empty with the words pushed to one side.
   *
   * So the lines are measured and the box is set to the widest of them. Every word is its own
   * inline-block (setWords), so `offsetTop` groups them into lines and offsetLeft/offsetWidth
   * bound each one — LAYOUT geometry, so the pop animation's transforms cannot corrupt it. A
   * narrower box can never pull a word up onto the line above, so the wrap survives the change;
   * `balance` is given one chance to re-break it and the wider result wins.
   *
   * The vertical air is balanced the same way. A line box reserves the font's descent plus
   * half-leading under the baseline and only (ascent - cap height) plus half-leading over a
   * capital, so equal padding leaves MORE space under the last line: measured 47px against
   * 42px. The bottom padding is trimmed by the difference. */
  hugWords(b) {
    const tx = this.el.text;
    if (!b || !tx) return;
    b.style.width = ''; b.style.paddingBottom = '';      // measure the natural wrap, not the last hug
    const cs = getComputedStyle(b);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0, padT = parseFloat(cs.paddingTop) || 0;
    const lines = () => {
      const ws = [];
      for (const w of tx.querySelectorAll('.w')) ws.push({ l: w.offsetLeft, r: w.offsetLeft + w.offsetWidth, t: w.offsetTop });
      const tops = [];
      for (const w of ws) if (!tops.includes(w.t)) tops.push(w.t);
      let widest = 0;
      for (const t of tops) {
        let a = Infinity, z = -Infinity;
        for (const w of ws) if (w.t === t) { if (w.l < a) a = w.l; if (w.r > z) z = w.r; }
        if (z - a > widest) widest = z - a;
      }
      return { widest, n: tops.length };
    };
    /* SLACK, AND THE LINE COUNT IS THE VERDICT. offsetLeft/offsetWidth are integers, so a line
       measured at 226 can really need 226.4 — hugged to exactly 226 the last word wrapped and
       "Watch out!" came out on two lines in a box twice as wide as it needed. So a few pixels
       of slack are tried in turn and the first width that keeps the sentence on no more lines
       than it already has wins; if none does, the inline width is dropped and the CSS cap
       decides, as it did before.

       AND IT REPEATS UNTIL IT SETTLES, because narrowing the box lets `balance` re-break the
       same number of lines more evenly, which makes the widest line narrower again: measured
       "Tap to jump over obstacles." hugging to 429 and then only using 308 of it. Three passes
       is far more than the two any of these sentences take. */
    let cur = lines();
    for (let pass = 0; pass < 3 && cur.widest > 0; pass++) {
      const settled = b.style.width && Math.abs(parseFloat(b.style.width) - (cur.widest + 2 + padL + padR)) < 4;
      if (settled) break;
      const wasWidth = b.style.width;
      let ok = false;
      for (const slack of [2, 5, 10, 18]) {
        b.style.width = Math.ceil(cur.widest + slack + padL + padR) + 'px';
        const after = lines();
        if (after.n <= cur.n) { ok = true; cur = after; break; }
      }
      if (!ok) { b.style.width = wasWidth; break; }
    }
    const trim = this.inkTrim(tx);
    if (trim > 0.5) b.style.paddingBottom = Math.max(0, padT - trim) + 'px';
  }

  /** descent - (ascent - cap height) for the words' own font, in px: how much more air a line
      box leaves under a baseline than over a capital. Cached per font size; 0 if the metrics
      are not available, which simply leaves the padding even. */
  inkTrim(tx) {
    const st = getComputedStyle(tx);
    const font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
    if (this._trimFont === font) return this._trim;
    let trim = 0;
    try {
      this._probe = this._probe || document.createElement('canvas');
      const c = this._probe.getContext('2d');
      c.font = font;
      const m = c.measureText('Hxdp');
      const fsz = parseFloat(st.fontSize) || 20;
      const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent, cap = m.actualBoundingBoxAscent;
      trim = (asc && desc && cap) ? desc - (asc - cap) : 0;
      trim = Math.max(0, Math.min(trim, fsz * 0.3));
    } catch (e) { trim = 0; }
    this._trimFont = font; this._trim = trim;
    return trim;
  }

  /* ---- the focus canvas ---- */
  showFocus(kind) {
    const f = this.el.focus;
    if (!f) return;
    const key = kind + ':' + this.step;
    if (this._focusKey !== key) {
      this._focusKey = key;
      try { this.game.renderFocus(f, kind); }
      catch (e) { /* nothing to lift: the sheet and the words still read */ }
    }
    if (f.hidden) f.hidden = false;
  }
  hideFocus() {
    const f = this.el.focus;
    if (f && !f.hidden) f.hidden = true;
    this._focusKey = null;
  }

  /* ---- the layer ---- */
  /** `running`: the step speaks over a game that has NOT been stopped (pause: false) — no veil. */
  show(box, text, describing, gesture, keepBox, focus, running) {
    const L = this.el.layer;
    if (!L) return;
    if (!box) {
      if (!L.hidden) L.hidden = true;
      this.hideFocus();
      return;
    }
    if (L.hidden) L.hidden = false;
    /* THE BLUR IS ONLY FOR STEPS THAT EXPLAIN. An action step needs the player to see
       the whole scene and swipe across a rope in it, so blurring it would fight the
       very thing being asked for — and the cut-out would be a frozen copy over a
       moving game. On those steps the veil and the copy are both off and only the
       words and the hand remain. */
    /* AND NOT FOR A LINE SPOKEN OVER A RUNNING GAME. "Perfect fit! Keep going!" is a
       describing step with pause:false — the run resumes under it — and it was blurring
       the whole moving scene (asked: "why does this stage look blurred?"). A veil belongs
       only to a step that has stopped the game to explain something. */
    if (this.el.veil) this.el.veil.hidden = !describing || !!running;
    if (!describing || box.dom) this.hideFocus();

    const pc = (v, of) => (v / of * 100).toFixed(2) + '%';
    /* Each axis as a percentage of ITS OWN axis, which is the only way a percentage
       size lands where it was meant to: width against 1920, height against 1080. A box
       that gives rx and ry gets an oval hugging it; one that gives a single r gets a
       circle, because rx and ry come out equal. */
    const rx = box.rx !== undefined ? box.rx : box.r;
    const ry = box.ry !== undefined ? box.ry : box.r;

    /* THE FOCUS: THE SUBJECT, DRAWN ALONE, GLOWING ALONG ITS OWN OUTLINE.
     *
     * A rectangle of the game canvas used to be copied here and lifted over the blur.
     * It brought the sky and ice behind the subject with it, so what sat over the
     * sheet was a patch of picture with a shape of its own — an oval, then a rounded
     * square — and every version read as a spotlight or a panel stuck on the scene.
     *
     * Now the engine re-draws the subject by itself onto the focus canvas
     * (game.renderFocus) and the stylesheet glows that canvas by its alpha. The alpha
     * IS the subject's silhouette, so the glow follows the character's outline, the
     * rock's, the row's — and no background comes with it, because none was drawn.
     *
     * Once per step, not per frame: every step that shows this has frozen the game. */
    /* Lift a DOM target above the sheet for as long as it is the focus, and put it back
       afterwards. Tracked so exactly one element is ever lifted. */
    const wantLift = describing && box.dom ? box.dom : null;
    if (this._lifted !== wantLift) {
      if (this._lifted) {
        const prev = this.root.querySelector(this._lifted);
        if (prev) prev.classList.remove('tut-lift');
      }
      if (wantLift) {
        const el = this.root.querySelector(wantLift);
        if (el) el.classList.add('tut-lift');
      }
      this._lifted = wantLift;
    }
    if (describing && focus && !box.dom) this.showFocus(focus);
    const b = this.el.bubble;
    /* THE WORDS GO IN FIRST, because the box cannot be placed until its height is
       known and its height depends on how many lines the sentence wraps to. It used to
       be written afterwards, so the placement worked off a guessed 130px half-height
       while the real box measured anywhere from 147 to 213. */
    const fresh = !!(this.el.text && this.el.text.textContent !== text);
    if (b && fresh) {
      this.setWords(text);
      this._boxH = 0;                 // force a re-measure on the new wrap
    }
    if (b) {
      /* IT MUST FIT ON THE STAGE, whichever side it goes.
       *
       * The rule used to be "above if there is room above, otherwise below" and that
       * is only half a rule: a big spotlight has no room above AND no room below, so
       * the fallback pushed the box off the bottom edge and the sentence was cut in
       * half. Measured on the block row: a 1228px light put the box at y 1109 on a
       * 1080 stage.
       *
       * So both sides are computed, each is checked against the stage, and the side
       * with room wins; if neither has room the box is clamped inside and kept on the
       * side with more of it. HALF is the box's own half-height — it is centred on the
       * y it is given, so that much has to be inside the edge at either end. */
      /* MEASURED, AND THE CENTRE IS OFFSET BY IT — which is the fix for the panel
       * sitting on top of the character.
       *
       * The box is positioned by its CENTRE (translate: -50% -50%), and the old code
       * put that centre at `subjectTop - GAP`. That is where its bottom EDGE belongs,
       * so the box hung half its own height down into the subject: for the mammoth,
       * 213px of box centred at y 435 covered everything from 328 to 541 while the
       * character starts around 470. Seventy pixels of panel across his back and head,
       * every time.
       *
       * The height is now read off the laid-out element rather than assumed. 130 was a
       * guess and the real box is 147-213 depending on how the sentence wraps, so even
       * the sign of the error changed with the text. */
      const st = this.root.getElementById('stage');
      /* MEASURED VISIBLE, AND MEASURED PER SENTENCE. The previous asking step hides the box
         once its words have been read (the hand carries on alone), so the next describing
         step used to measure and fit a HIDDEN box: zero wide, and fitBubble drew a 40x30
         sliver with a tail off to one side while the words floated over the blur (seen on
         "Oh no! The path is broken."). Unhide before measuring. And re-measure whenever the
         sentence changes: the first sentence's height was cached for all of them, which
         placed a three-line box as if it were two. */
      if (b && keepBox && b.hidden) b.hidden = false;
      const sizeKey = st ? st.clientWidth + 'x' + st.clientHeight : '';
      if (st && b && !b.hidden && (fresh || !this._boxH || this._sizeKey !== sizeKey)) {
        this._sizeKey = sizeKey;
        this.hugWords(b);
        const r = b.getBoundingClientRect();
        // back into stage units, so one number works at every viewport size
        if (r.height && st.clientHeight) this._boxH = r.height / st.clientHeight * H;
        if (r.width && st.clientWidth) this._boxW = r.width / st.clientWidth * W;
      }
      const HALF = (this._boxH || 200) / 2;
      /* Room for the tail plus clear air. The tail is ~30 stage px, and a panel that
         merely touches the subject still reads as resting on it. */
      const GAP = 54;
      const upY = box.y - ry - GAP - HALF;      // bottom edge clears the subject top
      const dnY = box.y + ry + GAP + HALF;      // top edge clears the subject bottom
      const upFits = upY - HALF > 0;
      const dnFits = dnY + HALF < H;
      let above, y;
      if (upFits) { above = true; y = upY; }
      else if (dnFits) { above = false; y = dnY; }
      else {
        // neither side fits: take the roomier one and clamp the box onto the stage
        above = (box.y - ry) > (H - (box.y + ry));
        y = clampN(above ? upY : dnY, HALF + 8, H - HALF - 8);
      }
      /* THE BOX IS CLAMPED TO THE STAGE; THE TAIL IS NOT.
       *
       * The box has to stay on screen, so its centre is clamped away from the edges.
       * The tail was pinned to the middle of the box, which means that every time the
       * clamp moved the box the tail stopped pointing at the thing being described —
       * and the further the target was towards an edge, the further out the tail
       * pointed. On the JUMP button, which sits in the bottom-right corner, it was off
       * by hundreds of pixels: an arrow confidently indicating empty ice.
       *
       * So the box is placed under the clamp as before, and then the tail is offset
       * INSIDE it by however much the clamp moved it — which lands the tail on the
       * target whatever the box had to do. Kept clear of the rounded corners, because a
       * tail growing out of a curve looks detached however well it is aimed. */
      /* CLAMPED BY THE BOX'S OWN WIDTH. The margin used to be a flat 320 stage units, which is
         half of a 640-wide box — anything wider hung over the edge, and on a phone the widest
         sentence measured 1286 stage units and lost its first two words off the left of the
         screen. The tail is offset back onto the subject below, so a clamp costs nothing. */
      const halfW = Math.min((this._boxW || 420) / 2 + 12, W / 2);
      const bx = clampN(box.x, halfW, W - halfW);
      b.style.left = pc(bx, W);
      b.style.top = pc(y, H);
      b.dataset.side = above ? 'above' : 'below';
      /* THE TAIL POINTS AT THE SUBJECT. The box is clamped onto the stage; the tail is
         not — it leaves the edge facing the subject at whatever point along that edge is
         nearest to it, and leans toward it, so it lands on the target however far the
         clamp moved the box. Rebuilt only when the box or the aim changes: fitBubble
         reads the box's layout, which is not something to do sixty times a second. */
      const boxW = this._boxW || 420;
      const at = clampN(0.5 + (box.x - bx) / boxW, 0.14, 0.86);
      const lean = box.x < bx ? -1 : 1;
      const key = [above ? 'a' : 'b', at.toFixed(2), lean, text, b.offsetWidth, b.offsetHeight].join('|');
      if (this._bubbleKey !== key && this.el.shape) {
        this._bubbleKey = key;
        // the box ABOVE the subject hangs its tail BELOW, toward the subject, and vice versa
        fitBubble(this.el.shape, b, { side: above ? 'below' : 'above', at, lean });
      }
    }
    /* RESTART THE POP WHEN THE WORDS CHANGE — the text itself is written further up,
       before the placement, because the placement needs its height. A CSS animation
       appears and never again, so without this only the FIRST step of six would arrive
       with any motion and the rest would silently swap their text — a player would not
       notice the box had said something new. */
    /* `fresh` was read BEFORE the words were written above. Comparing again here always
       found them equal, so the pop restarted on the first step only and every later
       sentence swapped in silently — the very fault this block exists to prevent. */
    if (fresh) {
      if (b) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
      // a bubble arriving pops: the kit's pop, or the local bloop
      if (keepBox && this.game.sfx) { try { this.game.sfx('popIn'); } catch (e) { /* silent is fine */ } }
    }
    /* THE HAND ONLY WHERE A FINGER IS WANTED, and dead centre on the control.

       It used to appear on every step and sit at the lower edge of the focus. Both were
       wrong. A hand on a step with nothing to press teaches that the hand means
       nothing, so it now shows only where the step declares one — the JUMP button and
       the ropes. And it belongs ON the control rather than beside it: offsetting it was
       to stop it covering the mammoth, which is a problem that only existed because it
       was being shown on steps that were describing the mammoth. */
    const hd = this.el.hand;
    if (hd) {
      if (gesture) {
        hd.hidden = false;
        hd.dataset.gesture = gesture;      // CSS picks tap or sweep off this
        hd.style.left = pc(box.handX !== undefined ? box.handX : box.x, W);
        // a spot may keep a taller zone clear than where the hand belongs (see ropeBox, domSpot)
        hd.style.top = pc(box.handY !== undefined ? box.handY : box.y, H);
      } else if (!hd.hidden) hd.hidden = true;
    }
    // the box goes when it has been read; the hand carries on
    if (b) b.hidden = !keepBox;
    /* THE LAYER NEVER SWALLOWS POINTER EVENTS. Nothing on it needs a tap any more:
       describing steps advance themselves and asking steps want the tap to reach the
       game. Skip has pointer-events of its own, so it still works. Blocking events here
       is what makes a tutorial unfinishable — it would eat the very swipe it asks for. */
    L.style.pointerEvents = 'none';
  }

  destroy() { this.resume(); }
}
