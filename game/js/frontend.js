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
      oopsHero: root.getElementById('oops-hero')
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

  showHurt() {
    if (!this.el.oopsHero) return;
    const id = this.game.character();
    /* The hurt and shake sheets have been removed, so this falls through to the jump
       sheet. Its last frames are the grounded recovery poses, which is the closest
       thing available to "sat down after a bump". */
    const sheet = this.game.sheetFor(id, 'hurt') ||
                  this.game.sheetFor(id, 'shake') ||
                  this.game.sheetFor(id, 'jump');
    if (!sheet) return;
    const last = sheet.frames - 1;
    const a = Math.max(0, last - 3), b = last;
    let f = a;
    this.hideHurt();
    this.frameAt(this.el.oopsHero, sheet, f);
    this._hurt = setInterval(() => {
      f = f >= b ? a : f + 1;
      this.frameAt(this.el.oopsHero, sheet, f);
    }, 140);
    this._timers.push(this._hurt);
  }
  hideHurt() { if (this._hurt) { clearInterval(this._hurt); this._hurt = null; } }

  wait(ms, fn) { const t = setTimeout(fn, ms); this._timers.push(t); return t; }

  destroy() {
    this._timers.forEach(clearTimeout);
    this._timers.forEach(clearInterval);
    this.hideHurt();
    window.removeEventListener('keydown', this._onKey);
  }
}
