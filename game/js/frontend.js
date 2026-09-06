/* Cover -> gameplay.
 *
 * There used to be a character-select stage between the two, for choosing between the
 * mammoth and a polar bear cub. With one explorer it became a screen that asks a
 * question with one answer — a tap the player has to make before the game will start,
 * teaching nothing and delaying everything — so PLAY now hands straight over to the run.
 *
 * What is left is the cover, and the hero image in the Ouch panel. Both animate the
 * character from its real run sheet rather than from a separate portrait: a sprite sheet
 * is a horizontal strip of N cells, so sizing the background to N x 100% and stepping
 * background-position-x plays it in the DOM. That keeps the screens using the exact same
 * artwork as the game, with nothing to keep in sync.
 */
export class Frontend {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    this.el = {
      cover: root.getElementById('cover'),
      play: root.getElementById('btn-play'),
      loadingNote: root.getElementById('cover-loading'),
      /* oopsHero is gone with the Ouch card — see index.html. The win panel has a hero
         of its own, filled by showWin() below from the character's own sheet. */
      winHero: root.getElementById('win-hero')
    };
    this.state = 'ENTERING';
    this._timers = [];
    this._hurt = null;
  }

  /** @param {{onStart:Function}} handlers */
  init(handlers) {
    this.handlers = handlers;
    this.bind();
    this.el.cover.hidden = false;
    this.state = 'IDLE';
  }

  /** While the art is still loading: PLAY is shown but held, with a small note under it. */
  setLoading(v) {
    this.loading = !!v;
    this.el.cover.classList.toggle('loading', this.loading);
    if (this.el.play) this.el.play.setAttribute('aria-disabled', this.loading ? 'true' : 'false');
    if (this.el.loadingNote) this.el.loadingNote.hidden = !this.loading;
  }

  bind() {
    const press = (btn, fn) => {
      if (!btn) return;
      // pointerdown + preventDefault kills :active, so drive the pressed look here
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.classList.add('pressed');
      });
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
      window.addEventListener('pointerup', up);
      btn.addEventListener('click', fn);
    };

    press(this.el.play, () => this.start());

    this._onKey = e => {
      if (this.el.cover.hidden) return;
      if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); this.start(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  /** Use the game's own sound palette, so the screens and the game agree. */
  sfx(name) { if (this.game.sfx) this.game.sfx(name); }

  /** The cover slides away and the run begins. */
  start() {
    if (this.loading) return;                 // the art is not in yet; the note says so
    if (this.state === 'READY') return;
    this.state = 'READY';
    this.sfx('ui');

    this.el.cover.classList.add('leaving');
    this.wait(400, () => {
      this.el.cover.hidden = true;
      this.el.cover.classList.remove('leaving');
      this.state = 'EXITING';
      if (this.handlers && this.handlers.onStart) this.handlers.onStart();
    });
  }

  /* ---- the Ouch panel's hero ---- */

  /** One cell of a sprite strip, as a DOM background. */
  frameAt(elem, sheet, f) {
    if (!sheet) return;
    elem.style.backgroundImage = 'url("' + sheet.src + '")';
    elem.style.backgroundSize = (sheet.frames * 100) + '% 100%';
    const pct = sheet.frames > 1 ? (f / (sheet.frames - 1)) * 100 : 0;
    elem.style.backgroundPositionX = pct + '%';
  }

  /* THE WIN PANEL'S CHARACTER, on ONE frame rather than a loop.

     The Ouch card used to run a setInterval stepping frames onto its hero at 140ms —
     a second animation, outside the renderer, of a beat the canvas was already
     animating. This does not repeat that: the character on the CANVAS behind the
     panel is already celebrating, so a second animated copy of him on the panel would
     be two performances of one moment. One still, held, is enough to say who did it.

     It reads the idle sheet, which is the one delivered sheet with a settled standing
     pose and is otherwise unused (see CFG.characters.sheets) — so the art is already
     built and this costs nothing new. Falls through to run, then jump, so a missing
     sheet leaves the panel without a picture rather than without a panel. */
  showWin() {
    if (!this.el.winHero) return;
    const id = this.game.character();
    const sheet = this.game.sheetFor(id, 'idle') ||
                  this.game.sheetFor(id, 'run') ||
                  this.game.sheetFor(id, 'jump');
    if (!sheet) return;
    this.frameAt(this.el.winHero, sheet, 0);
  }

  /* showHurt/hideHurt are gone. They ran a setInterval that stepped the last few
     frames of a sheet onto the Ouch card's hero element at 140ms — a second, DOM-side
     animation of a beat the canvas is already animating. The card went (a crash
     recovers by itself now) and with it the reason for a frame pump outside the
     renderer: the delivered 36-frame knockout plays on the canvas, where the rest of
     the character animation lives. */

  wait(ms, fn) { const t = setTimeout(fn, ms); this._timers.push(t); return t; }

  destroy() {
    this._timers.forEach(clearTimeout);
    this._timers.forEach(clearInterval);
    window.removeEventListener('keydown', this._onKey);
  }
}
