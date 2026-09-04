/* HUD controller — owns every DOM element outside the canvas and mirrors the
   engine's HUD state onto it. The engine never touches the DOM itself. */

export class Hud {
  /** A stage point where the zoomed canvas actually draws it. */
  static toView(view, p) {
    const k = view && view.k || 1;
    if (k <= 1.0005) return p;
    return { x: view.x + (p.x - view.x) * k, y: view.y + (p.y - view.y) * k };
  }

  constructor(root = document) {
    this.el = {
      /* hint / sound / pause are gone from the markup. The lookups stay because every
         use of them is already guarded — press() ignores a missing button, and the
         label helpers skip a null — so the pause panel's own controls keep working if
         anything ever opens it again. */
      pause: root.getElementById('btn-pause'),
      sound: root.getElementById('btn-sound'),
      sound2: root.getElementById('btn-sound2'),
      hint: root.getElementById('btn-hint'),
      restart: root.getElementById('btn-restart'),
      resume: root.getElementById('btn-resume'),
      paused: root.getElementById('paused'),
      verdict: root.getElementById('verdict'),
      hand: root.getElementById('hand-hint'),
      jump: root.getElementById('btn-jump'),
      instruction: root.getElementById('instruction'),
      pill: root.getElementById('instruction-pill'),
      text: root.getElementById('instruction-text'),
      complete: root.getElementById('complete'),
      replay: root.getElementById('btn-replay'),
      /* oops and retry are gone from the markup: a crash recovers by itself now and
         there is no failure panel. The lookups are not kept "just in case" — every
         use of them went with them, and a lookup with no user is how a dead element
         gets resurrected by the next person reading this file. */
      rotate: root.getElementById('rotate')
    };
    this.paused = false;
    this.lastMessage = null;
    this.lastPulse = false;
    this._onResize = () => this.checkOrientation();
  }

  /* Pick an icon by NAME. The mask URLs live in the stylesheet: a url() inside a
     custom property is resolved against the sheet that consumes it, not the
     document, so setting them inline resolved every glyph to /css/assets/... and
     404'd. A data attribute cannot go wrong that way. */
  setGlyph(btn, name) { if (btn) btn.dataset.icon = name; }

  /** Pause and Resume are one control, so it swaps glyph rather than moving. */
  pauseLabel(isPaused) {
    this.setGlyph(this.el.pause, isPaused ? 'play' : 'pause');
    if (this.el.pause) this.el.pause.setAttribute('aria-label', isPaused ? 'Resume' : 'Pause');
  }

  /** Sound state on both copies of the control, HUD and pause panel. */
  soundLabel(on) {
    for (const b of [this.el.sound, this.el.sound2]) {
      if (!b) continue;
      this.setGlyph(b, on ? 'sound-on' : 'sound-off');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    }
  }

  /** A short-lived tick or cross, positioned over the crossing being worked on.

      IT IS NOW ACTUALLY POSITIONED. The comment above claimed it was, and it never
      was: nothing here set left or top, and the stylesheet had no .verdict rule but
      the two background-image lines — so the element was a 0x0 block pinned to the
      top-left of the HUD, and the tick and the cross were invisible for every answer
      the game has ever been given. The engine now publishes `verdictAt` in stage
      coordinates and this converts it to percentages, exactly as the idle hand does,
      so it lands over the crevasse at any viewport size. */
  updateVerdict(h) {
    const el = this.el.verdict;
    if (!el) return;
    if (!h.verdict) {
      /* Both, unconditionally. The reset used to sit inside a check on el.hidden, so
         once anything else had already hidden the element — as the animationend
         handler below now does — _verdictWas was never cleared, and the NEXT verdict
         of the same kind was treated as a repeat and never shown. Two wrong answers
         in a row would have marked only the first. */
      el.hidden = true;
      this._verdictWas = '';
      return;
    }
    if (h.verdictAt) {
      /* Mapped through the view transform, because a phase zooms the canvas about a
         point and this mark is placed in stage coordinates — over the crossing, which
         is exactly the thing the zoom moves furthest. Unmapped it drifted off the
         crevasse by tens of pixels at 1.08 and would have looked like a positioning
         bug in the mark rather than a missing transform. */
      const v = Hud.toView(h.view, h.verdictAt);
      el.style.left = (v.x / 1920 * 100).toFixed(2) + '%';
      el.style.top = (v.y / 1080 * 100).toFixed(2) + '%';
    }
    /* AND RE-SHOW IT IF SOMETHING HID IT. This guard exists so the pop is not
       restarted on every frame of the mark's life, and on its own it was wrong the
       moment the animationend handler started hiding the element: the CSS animation is
       900ms of wall clock while G.verdictT is 0.9s of GAME time, so the element gets
       hidden first and the engine can still be reporting the same verdict afterwards.
       A second identical verdict then matched _verdictWas, returned here, and never
       came back — which is the exact bug the unconditional reset below was added to
       fix, reintroduced one line higher up.

       Checking el.hidden as well means the only thing this skips is a mark that is
       already on screen showing the right glyph. */
    if (h.verdict === this._verdictWas && !el.hidden) return;
    this._verdictWas = h.verdict;
    el.dataset.mark = h.verdict;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  /* The idle hand. Positioned in stage coordinates converted to percentages, so it
     lands on the rope at any viewport size rather than at a fixed pixel offset. */
  updateHand(h) {
    const el = this.el.hand;
    if (!el) return;
    if (!h.handHint) { if (!el.hidden) el.hidden = true; return; }
    // the demonstration hand points at a rope, so it moves with the view as well
    const p = Hud.toView(h.view, h.handHint);
    el.style.left = (p.x / 1920 * 100).toFixed(2) + '%';
    el.style.top = (p.y / 1080 * 100).toFixed(2) + '%';
    if (el.hidden) el.hidden = false;
  }

  /** @param {{onJump:Function,onPause:Function,onReplay:Function}} handlers */
  bind(handlers) {
    this.handlers = handlers;

    // pointerdown (not click) so a tap registers on the same frame it lands.
    // preventDefault also suppresses the browser's own :active state, so the
    // pressed look has to be driven by a class or the button never appears to move.
    this.el.jump.addEventListener('pointerdown', e => {
      e.preventDefault();
      /* Removed and re-added so the tap ring's animation restarts. A class that is
         already present does not re-run its keyframes, so a second tap in quick
         succession would show no ring at all. */
      this.el.jump.classList.remove('pressed');
      void this.el.jump.offsetWidth;
      this.el.jump.classList.add('pressed');
      handlers.onJump();
    });
    const release = () => this.el.jump.classList.remove('pressed');
    this.el.jump.addEventListener('pointerup', release);
    this.el.jump.addEventListener('pointercancel', release);
    this.el.jump.addEventListener('pointerleave', release);
    window.addEventListener('pointerup', release);
    // keyboard jumps should flash the button too, so the control feels connected
    this._flashJump = () => {
      this.el.jump.classList.add('pressed');
      clearTimeout(this._flashT);
      this._flashT = setTimeout(release, 110);
    };
    // keep the button from swallowing focus rings on touch
    this.el.jump.addEventListener('contextmenu', e => e.preventDefault());

    // every icon button gets the same press feedback, so the whole cluster behaves
    // as one family
    const press = (btn, fn) => {
      if (!btn) return;
      btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('pressed'); });
      const off = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      window.addEventListener('pointerup', off);
      btn.addEventListener('click', fn);
    };

    const setPaused = v => {
      this.paused = v;
      this.pauseLabel(v);
      if (this.el.paused) this.el.paused.hidden = !v;
      handlers.onPause(v);
    };
    press(this.el.pause, () => setPaused(!this.paused));
    press(this.el.resume, () => setPaused(false));
    press(this.el.restart, () => { setPaused(false); handlers.onReplay(); });

    const toggleSound = () => {
      const on = handlers.onSound ? handlers.onSound() : true;
      this.soundLabel(on);
    };
    press(this.el.sound, toggleSound);
    press(this.el.sound2, toggleSound);

    // the hint re-states the objective; it never points at the answer
    press(this.el.hint, () => {
      if (handlers.onHint) handlers.onHint();
      if (this.el.hint) this.el.hint.classList.remove('nudge');
    });

    this.el.replay.addEventListener('click', () => {
      this.paused = false;
      this.pauseLabel(false);
      if (this.el.paused) this.el.paused.hidden = true;
      handlers.onReplay();
    });

    // "Try Again" retries the obstacle the mammoth walked into — it never
    // restarts the journey, so no repaired bridge or progress is ever lost.
    if (this.el.retry) {
      this.el.retry.addEventListener('click', () => handlers.onRetry && handlers.onRetry());
    }

    /* WHICH INPUT IS IN USE. Only a keyboard player benefits from the Ouch card
       focusing Try Again on open, and for everyone else that focus is what put a
       visible focus indicator around the button unasked. Two listeners settle it:
       any key press means a keyboard is in play, any pointer press means it is not.
       Capture phase, so the flag is already right by the time anything reads it. */
    this._kbd = false;
    this._onKey = () => { this._kbd = true; };
    this._onPtr = () => { this._kbd = false; };
    window.addEventListener('keydown', this._onKey, true);
    window.addEventListener('pointerdown', this._onPtr, true);

    /* THE MARK IS HIDDEN WHEN ITS ANIMATION ENDS, not when the engine's timer expires.
       The two disagree, and on a slow machine they disagree by seconds: verdictPop runs
       for 900ms of WALL clock and finishes at opacity 0 (fill mode "both"), while
       G.verdictT counts down 0.9s of GAME time — and game time runs slower than wall
       clock whenever the renderer cannot hold 30fps. On a soft renderer at ~9fps that
       is nearly three seconds, so for two of them the element sat there present, sized
       and completely invisible.

       Nothing was visibly wrong, but "shown" and "visible" describing different things
       is the kind of state that makes an interface impossible to reason about — and it
       is what made tests/polish.spec.mjs fail intermittently under load, which is the
       symptom that found it. */
    if (this.el.verdict) {
      this._onVerdictEnd = () => { if (this.el.verdict) this.el.verdict.hidden = true; };
      this.el.verdict.addEventListener('animationend', this._onVerdictEnd);
    }

    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this.checkOrientation();
  }

  /** Portrait phones get a rotate prompt rather than a squashed 16:9 stage. */
  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900;
    this.el.rotate.hidden = !portrait;
  }

  /** Called by the engine only when its HUD state actually changes. */
  update(h) {
    /* `h.helper` is gone from the payload. It was a second instruction line, removed
       on request, and G.helper had been pinned to the empty string ever since — so
       `h.helper || h.instruction` was provably just h.instruction. */
    const message = h.instruction || '';

    /* SHOWN WHENEVER THERE IS SOMETHING TO SAY, not only when the line CHANGES.
     *
     * This was a diff-driven state machine: it acted only when `message` differed from
     * the last one it had seen. That leaves the element stuck if anything hides it by
     * any other route, because the message has not changed so nothing puts it back.
     * Observed exactly that — engine state PHASE_ACTIVE with "Cut the triangle." in
     * G.instruction, and the element sitting at `class="instruction leaving"`,
     * `hidden=true`, with the right text inside it. The one thing telling the learner
     * what to look for was invisible for the whole phase.
     *
     * The re-assert costs a couple of property reads per HUD push and cannot get
     * stuck: if there is a message and the element is not showing it, it shows it.
     * The entrance animation is still only restarted for a genuinely NEW line, so a
     * re-assert does not make the pill flash. */
    const el = this.el.instruction;
    const outOfSync = message && (el.hidden || el.classList.contains('leaving'));
    if (message !== this.lastMessage || outOfSync) {
      const isNewLine = message !== this.lastMessage;
      this.lastMessage = message;
      if (message) {
        clearTimeout(this._leaveT);
        this.el.text.textContent = message;
        el.hidden = false;
        el.classList.remove('leaving');
        // restart the entrance animation only for a new line, never for a re-assert
        if (isNewLine) {
          this.el.pill.style.animation = 'none';
          void this.el.pill.offsetWidth;
          this.el.pill.style.animation = '';
        }
      } else {
        // slide away instead of vanishing on a display:none flip
        this.el.instruction.classList.add('leaving');
        clearTimeout(this._leaveT);
        this._leaveT = setTimeout(() => {
          if (this.el.instruction.classList.contains('leaving')) this.el.instruction.hidden = true;
        }, 300);
      }
    }

    this.updateVerdict(h);
    this.updateHand(h);
    if (this._soundWas !== h.soundOn) { this._soundWas = h.soundOn; this.soundLabel(h.soundOn); }
    // the hint asks for attention only once the learner has been stuck a while
    if (this.el.hint) this.el.hint.classList.toggle('nudge', !!h.hintNudge);

    const showJump = h.jumpEnabled && !h.complete;
    if (this.el.jump.hidden === showJump) this.el.jump.hidden = !showJump;

    if (h.jumpPulse !== this.lastPulse) {
      this.lastPulse = h.jumpPulse;
      this.el.jump.classList.toggle('pulse', h.jumpPulse);
    }

    if (this.el.complete.hidden === h.complete) this.el.complete.hidden = !h.complete;

    /* NO FAILURE PANEL TO SYNC. This block showed the Ouch card and, when it opened,
       focused TRY AGAIN so a keyboard player could press Space straight away. Both are
       gone with the card: a crash plays out and the run resumes at the nearest
       checkpoint by itself, so there is nothing to open and nothing to focus. */
  }

  /** Flash the pressed look, for jumps that came from the keyboard. */
  flashJump() { if (this._flashJump) this._flashJump(); }

  destroy() {
    clearTimeout(this._leaveT);
    clearTimeout(this._flashT);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (this.el.verdict && this._onVerdictEnd) {
      this.el.verdict.removeEventListener('animationend', this._onVerdictEnd);
    }
    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    if (this._onPtr) window.removeEventListener('pointerdown', this._onPtr, true);
  }
}
