/* HUD controller — owns every DOM element outside the canvas and mirrors the
   engine's HUD state onto it. The engine never touches the DOM itself. */

export class Hud {
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
      oops: root.getElementById('oops'),
      retry: root.getElementById('btn-retry'),
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
      el.style.left = (h.verdictAt.x / 1920 * 100).toFixed(2) + '%';
      el.style.top = (h.verdictAt.y / 1080 * 100).toFixed(2) + '%';
    }
    if (h.verdict === this._verdictWas) return;
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
    el.style.left = (h.handHint.x / 1920 * 100).toFixed(2) + '%';
    el.style.top = (h.handHint.y / 1080 * 100).toFixed(2) + '%';
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
    if (message !== this.lastMessage) {
      this.lastMessage = message;
      if (message) {
        clearTimeout(this._leaveT);
        this.el.text.textContent = message;
        this.el.instruction.hidden = false;
        this.el.instruction.classList.remove('leaving');
        // restart the entrance animation on every new line
        this.el.pill.style.animation = 'none';
        void this.el.pill.offsetWidth;
        this.el.pill.style.animation = '';
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

    if (this.el.oops && this.el.oops.hidden === !!h.oops) {
      this.el.oops.hidden = !h.oops;
      // restart the icon's pop each time the panel appears
      if (h.oops) {
        const ic = this.el.oops.querySelector('.card-icon');
        if (ic) { ic.style.animation = 'none'; void ic.offsetWidth; ic.style.animation = ''; }
        /* ONLY FOR A KEYBOARD PLAYER. Focusing this button so Space retries straight
           away is right for someone on a keyboard and wrong for everyone else: the
           browser treats a programmatic focus as focus-visible, so a mouse or touch
           player got a focus indicator drawn around TRY AGAIN without ever having
           asked for one. Tracked by modality, the affordance goes to the players who
           can use it and is invisible to the rest. */
        if (this.el.retry && this._kbd) this.el.retry.focus({ preventScroll: true });
      }
    }
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
