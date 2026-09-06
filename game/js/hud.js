/* HUD controller — owns every DOM element outside the canvas and mirrors the
   engine's HUD state onto it. The engine never touches the DOM itself. */

import { shapeRing } from './option-shapes.js';
import { fitBubble } from './bubble.js';

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
      hand: root.getElementById('hand-hint'),
      jump: root.getElementById('btn-jump'),
      skipEnd: root.getElementById('btn-skip-end'),   // TEMPORARY review control
      instruction: root.getElementById('instruction'),
      pill: root.getElementById('instruction-pill'),
      text: root.getElementById('instruction-text'),
      complete: root.getElementById('complete'),
      stamps: root.getElementById('win-stamps'),
      winBubble: root.getElementById('win-bubble'),
      winShape: root.getElementById('win-shape'),
      winCount: root.getElementById('win-count'),
      winTotal: root.getElementById('win-total'),
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

  /* There is no verdict mark any more. A tick and a cross used to be positioned here,
     over the crossing; a right answer now throws confetti from the engine's own
     particle layer and a wrong one gets no mark at all — see cutShape(). */

  /* The idle hand. Positioned in stage coordinates converted to percentages, so it
     lands on the rope at any viewport size rather than at a fixed pixel offset. */
  updateHand(h) {
    const el = this.el.hand;
    if (!el) return;
    /* ONE HAND, EVER. The tutorial puts its own hand on the rope for the cut step
       and this idle hint fires after 13s of no input — which the tutorial spends
       waiting for exactly that swipe. So both were up together, two hands on two
       different animations demonstrating the same gesture. The tutorial’s is the
       one that stays: it is placed on the rope the step is about, and it is the
       hand the player was already being taught to follow. */
    if (this._tutHand === undefined) {
      const d = el.ownerDocument || document;
      this._tutHand = d.getElementById('tut-hand');
      this._tutLayer = d.getElementById('tutorial');
    }
    const tutoring = this._tutHand && !this._tutHand.hidden &&
                     this._tutLayer && !this._tutLayer.hidden;
    if (!h.handHint || tutoring) { if (!el.hidden) el.hidden = true; return; }
    // the demonstration hand points at a rope, so it moves with the view as well
    const p = Hud.toView(h.view, h.handHint);
    el.style.left = (p.x / 1920 * 100).toFixed(2) + '%';
    el.style.top = (p.y / 1080 * 100).toFixed(2) + '%';
    if (el.hidden) el.hidden = false;
  }

  /* THE ENDING'S STAMPS AND COUNT. One gold coin per crossing, embossed with the shape
     that mended it (the engine publishes the kinds as mendedKinds), landing one after
     another while the count climbs and a coin sounds through the handlers. The polygon is
     the shape's own verified ring (shapeRing), normalised into the coin — so the stamp is
     the geometry the learner actually counted, not a decorative glyph. */
  showWin(h) {
    const row = this.el.stamps, count = this.el.winCount, total = this.el.winTotal;
    if (!row) return;
    const kinds = (h.mendedKinds || '').split(',').filter(Boolean);
    row.innerHTML = '';
    if (total) total.textContent = String(kinds.length || 7);
    if (count) count.textContent = '0';
    kinds.forEach((kind, i) => {
      const el = document.createElement('span');
      el.className = 'win-stamp';
      el.style.setProperty('--i', i);
      const pts = shapeRing(kind);
      if (pts && pts.length) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        const s = 80 / Math.max(x1 - x0, y1 - y0, 1e-6), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const d = pts.map(p => ((p.x - cx) * s + 50).toFixed(1) + ',' + ((p.y - cy) * s + 50).toFixed(1)).join(' ');
        el.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="' + d + '"/></svg>';
      }
      el.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        if (window.Juice) { try { Juice.pop(el, { power: 1.2 }); } catch (e) { /* no juice */ } }
        if (this.handlers && this.handlers.onStamp) this.handlers.onStamp();
      });
      row.appendChild(el);
    });
    clearTimeout(this._winTimer);
    let i = 0;
    const tick = () => {
      i++;
      if (count) count.textContent = String(i);
      const st = row.children[i - 1];
      if (st && window.Juice) { try { Juice.pop(st, { power: 1.1 }); } catch (e) { /* no juice */ } }
      if (this.handlers && this.handlers.onStamp) this.handlers.onStamp();
      if (i < kinds.length) this._winTimer = setTimeout(tick, 170);
    };
    if (kinds.length) this._winTimer = setTimeout(tick, 820);   // as the first stamp lands
    /* The banner's shape is drawn for the box the words need — the same bubble as the
       tutorial's, without a tail (nobody in particular is saying it). Once now, and again
       after the pop-in has settled, because the box measures differently mid-bounce. */
    const fit = () => { if (this.el.winShape && this.el.winBubble) fitBubble(this.el.winShape, this.el.winBubble, null); };
    fit(); setTimeout(fit, 600); this._winFit = fit;
    if (window.Juice) {
      setTimeout(() => { try { Juice.tada(this.el.winBubble); } catch (e) { /* no juice */ } }, 700);
      clearInterval(this._nudge);
      this._nudge = setInterval(() => {
        if (!this.el.complete || this.el.complete.hidden) { clearInterval(this._nudge); return; }
        try { Juice.nudge(this.el.replay); } catch (e) { clearInterval(this._nudge); }
      }, 3800);
    }
  }

  /** @param {{onJump:Function,onPause:Function,onReplay:Function,onStamp?:Function}} handlers */
  bind(handlers) {
    this.handlers = handlers;

    // pointerdown (not click) so a tap registers on the same frame it lands.
    // preventDefault also suppresses the browser's own :active state, so the
    // pressed look has to be driven by a class or the button never appears to move.
    // TEMPORARY review control: jump to the ending. Guarded like every other lookup.
    if (this.el.skipEnd && handlers.onSkipEnd) this.el.skipEnd.addEventListener('click', () => handlers.onSkipEnd());
    this.el.jump.addEventListener('pointerdown', e => {
      e.preventDefault();
      /* Removed and re-added so the tap ring's animation restarts. A class that is
         already present does not re-run its keyframes, so a second tap in quick
         succession would show no ring at all. */
      this.el.jump.classList.remove('pressed');
      void this.el.jump.offsetWidth;
      this.el.jump.classList.add('pressed');
      /* A PRESS, NOT A HOP. The button used to hop with the character (Juice.hop): it rose
         24px and swelled 7px over 620ms, a quarter of its own height on a phone, so the
         control left the finger that was on it and a second tap landed on sky. A pressed
         button compresses where it is: a 160ms squash, no travel. The art swap and the
         tap ring above carry the rest. */
      if (this.el.jump.animate) {
        try {
          this.el.jump.animate([
            { transform: 'scale(1)' }, { transform: 'scale(0.93)', offset: 0.35 }, { transform: 'scale(1)' }
          ], { duration: 160, easing: 'ease-out' });
        } catch (e) { /* no WAAPI */ }
      }
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
      btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('pressed'); if (window.Juice) { try { Juice.pop(btn, { power: 0.6 }); } catch (err) { /* no juice */ } } });
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

    // the banner's drawn shape follows its box when the window changes
    window.addEventListener('resize', () => { if (this._winFit && this.el.complete && !this.el.complete.hidden) this._winFit(); });
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

    this.updateHand(h);
    if (this._soundWas !== h.soundOn) { this._soundWas = h.soundOn; this.soundLabel(h.soundOn); }
    // the hint asks for attention only once the learner has been stuck a while
    if (this.el.hint) this.el.hint.classList.toggle('nudge', !!h.hintNudge);

    const showJump = h.jumpEnabled && !h.complete;
    if (this.el.jump.hidden === showJump) this.el.jump.hidden = !showJump;
    // TEMPORARY review control: up whenever the game is playable and not yet complete
    if (this.el.skipEnd) { const show = !!h.skippable; if (this.el.skipEnd.hidden === show) this.el.skipEnd.hidden = !show; }

    if (h.jumpPulse !== this.lastPulse) {
      this.lastPulse = h.jumpPulse;
      this.el.jump.classList.toggle('pulse', h.jumpPulse);
    }

    if (this.el.complete.hidden === h.complete) {
      this.el.complete.hidden = !h.complete;
      if (h.complete) this.showWin(h);
    }

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

    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    if (this._onPtr) window.removeEventListener('pointerdown', this._onPtr, true);
  }
}
