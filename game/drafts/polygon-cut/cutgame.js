/* THE GAME.
 *
 *   Game            state, and the only thing that decides a level is finished
 *   LevelRenderer   builds a level's DOM and tears the previous one down
 *   Question        the supplied statement, rendered as supplied
 *   ShapeOptions    the row (or rows) of options, in the supplied order
 *   PolygonOption   one interactive polygon
 *   PolygonRenderer canonical geometry -> SVG
 *   CutInteraction  pointer/touch handling, and the cut itself
 *
 * Everything the learner sees is the question statement and the polygons. There is no
 * score, no progress, no button and no label, because the polygon is meant to be the
 * whole of the reading: if a shape needs a caption to be identified, the shape is wrong.
 *
 * SVG rather than canvas, for four reasons that all matter here: vertices stay exactly
 * where the geometry puts them, hit testing follows the real outline instead of a box,
 * it stays sharp at any stage size, and a cut can be animated as two real halves.
 */
window.PolygonGameFactory = (function () {
  'use strict';
  var levels = window.PolygonLevels.levels;
  var correctOptions = window.PolygonLevels.correctOptions;
  var pointsOf = window.PolygonGeometry.pointsOf;

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (name, attrs) => {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* ---------------- geometry for the cut ---------------- */

/** Split a polygon along the infinite line through a and b, returning the two halves.
    Walks the outline once, emitting the crossing point whenever an edge changes side,
    so both halves are real polygons rather than clipped bitmaps — which is what lets
    them be moved apart afterwards. */
function splitPolygon(pts, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const side = p => (p.x - a.x) * dy - (p.y - a.y) * dx;
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const sp = side(p), sq = side(q);
    (sp >= 0 ? left : right).push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      const c = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      left.push(c); right.push(c);
    }
  }
  return [left, right];
}

const toPath = pts => pts.length < 3 ? '' : 'M' + pts.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('L') + 'Z';

/** Where the infinite line through a and b enters and leaves the polygon, or null if it
    misses. Used to draw the cut as only the part that is actually a cut. */
function lineInside(pts, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const hits = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const ex = q.x - p.x, ey = q.y - p.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;                 // parallel to this side
    const u = ((p.x - a.x) * ey - (p.y - a.y) * ex) / den;   // along a->b
    const v = ((p.x - a.x) * dy - (p.y - a.y) * dx) / den;   // along p->q
    if (v >= 0 && v <= 1) hits.push(u);
  }
  if (hits.length < 2) return null;
  const lo = Math.min(...hits), hi = Math.max(...hits);
  return [
    { x: a.x + dx * lo, y: a.y + dy * lo },
    { x: a.x + dx * hi, y: a.y + dy * hi }
  ];
}

/** Is a point inside the polygon? Ray casting — used so a tap counts only when it lands
    on the shape itself, not merely inside its bounding box. */
function inside(pts, p) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a.y > p.y) !== (b.y > p.y)) &&
        (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) hit = !hit;
  }
  return hit;
}

/* ---------------- PolygonRenderer ---------------- */

/* One SVG per option. The viewBox is the normalised polygon space with a margin, so
   every shape is drawn at the same scale with the same stroke weight however many sides
   it has — the difficulty is meant to come from counting sides, not from one shape being
   drawn bigger than another. */
const VIEW = 2.5;                                   // -1.25 .. 1.25 in polygon units
const R = 1;                                        // the polygon's own radius

class PolygonRenderer {
  constructor(type) {
    this.pts = pointsOf(type).map(p => ({ x: p.x * R, y: p.y * R }));
    const svg = el('svg', {
      viewBox: `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`,
      class: 'poly-svg', focusable: 'false', 'aria-hidden': 'true'
    });
    this.svg = svg;

    // the two halves, present from the start and empty until a cut happens
    this.halfA = el('path', { class: 'poly-half' });
    this.halfB = el('path', { class: 'poly-half' });
    this.body = el('path', { class: 'poly-body', d: toPath(this.pts) });
    /* A hairline along the cut. Drawn under the halves so it is revealed as they part
       rather than sitting on top of an uncut shape. */
    this.cutLine = el('path', { class: 'poly-cut-line' });

    svg.append(this.cutLine, this.body, this.halfA, this.halfB);
  }

  /** Show the shape as two halves either side of the line a-b, and move them apart. */
  cut(a, b) {
    const [A, B] = splitPolygon(this.pts, a, b);
    if (A.length < 3 || B.length < 3) return false;
    this.halfA.setAttribute('d', toPath(A));
    this.halfB.setAttribute('d', toPath(B));
    /* The visible cut is only the part of the line INSIDE the shape. a and b are pushed
       well outside it so the split is guaranteed to cross, and drawing between them put
       a line right across the screen. */
    const seg = lineInside(this.pts, a, b);
    if (seg) this.cutLine.setAttribute('d', `M${seg[0].x.toFixed(3)},${seg[0].y.toFixed(3)}L${seg[1].x.toFixed(3)},${seg[1].y.toFixed(3)}`);

    // each half slides along the cut's normal, so they come apart across the cut
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const d = 0.14;
    this.halfA.style.setProperty('--slide', `translate(${(nx * d).toFixed(3)}px, ${(ny * d).toFixed(3)}px)`);
    this.halfB.style.setProperty('--slide', `translate(${(-nx * d).toFixed(3)}px, ${(-ny * d).toFixed(3)}px)`);
    this.svg.classList.add('is-cut');
    return true;
  }

  /** Where a page point lands in polygon space. */
  toLocal(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: ((clientX - r.left) / r.width - 0.5) * VIEW,
      y: ((clientY - r.top) / r.height - 0.5) * VIEW
    };
  }

  contains(local) { return local ? inside(this.pts, local) : false; }
}

/* ---------------- PolygonOption ---------------- */

/* One polygon the learner can cut. Its hit area is a little larger than the outline —
   §30: a near miss on a vertex should still register — but nothing about that is drawn,
   so no bounding box ever appears. */
class PolygonOption {
  constructor(option, onCut) {
    this.option = option;
    this.onCut = onCut;
    this.done = false;

    this.renderer = new PolygonRenderer(option.type);
    this.node = document.createElement('div');
    this.node.className = 'poly';
    this.node.dataset.optionId = option.id;
    this.node.append(this.renderer.svg);

    // no listener of its own: the row owns the gesture, so a stroke may start off-shape
  }

  /** Does a stroke between two PAGE points pass through this polygon? */
  hitBy(from, to, isTap) {
    if (this.done) return false;
    const a = this.renderer.toLocal(from.x, from.y);
    const b = this.renderer.toLocal(to.x, to.y);
    if (!a || !b) return false;
    return isTap ? this.renderer.contains(a) : crossesShape(this.renderer, a, b);
  }

  /** How far a page point sits from this shape's centre, in shape widths. */
  distance(pt) {
    const r = this.renderer.svg.getBoundingClientRect();
    if (!r.width) return Infinity;
    const dx = pt.x - (r.left + r.width / 2), dy = pt.y - (r.top + r.height / 2);
    return Math.hypot(dx, dy) / r.width;
  }

  /** Cut along a stroke given in PAGE coordinates. */
  cutAlong(from, to, isTap) {
    const R2 = this.renderer;
    const a = R2.toLocal(from.x, from.y);
    const b = R2.toLocal(to.x, to.y);
    if (!a) return;
    if (isTap) {
      /* Straight across the shape, at the height that was tapped — but clamped into the
         shape's own span. Unclamped, a tap just outside the outline (below a triangle's
         base, which is most of a triangle's cell) gave a line that missed the body, and
         the gesture was thrown away after the hit area had correctly found the shape. */
      let lo = Infinity, hi = -Infinity;
      for (const q of R2.pts) { if (q.y < lo) lo = q.y; if (q.y > hi) hi = q.y; }
      const inset = (hi - lo) * 0.18;
      const y = Math.min(Math.max(a.y, lo + inset), hi - inset);
      this.take({ x: -VIEW, y }, { x: VIEW, y });
      return;
    }
    // extend the stroke well past the shape so the split line always crosses it
    const dx = b.x - a.x, dy = b.y - a.y;
    const k = VIEW * 2 / (Math.hypot(dx, dy) || 1);
    this.take({ x: a.x - dx * k, y: a.y - dy * k }, { x: b.x + dx * k, y: b.y + dy * k });
  }

  /** A cut has landed on this shape, along the given line in polygon space. */
  take(a, b) {
    if (this.done) return;
    if (!this.option.correct) {
      /* WRONG: a short response on this shape and nothing else. No text, no reveal, and
         crucially no state change — the shape stays exactly as cuttable as it was, and
         the correct answer is never removed by a wrong attempt. */
      this.node.classList.remove('is-wrong');
      void this.node.offsetWidth;                   // restart the animation
      this.node.classList.add('is-wrong');
      this.onCut(this.option, false);
      return;
    }
    if (!this.renderer.cut(a, b)) return;           // the line missed the body
    this.done = true;
    this.node.classList.add('is-done');
    this.onCut(this.option, true);
  }

  destroy() { /* nothing of its own to unbind: the row owns the gesture */ }
}

/* ---------------- CutInteraction ---------------- */

/* A cut is a stroke, and it may start anywhere.
 *
 * The listener sits on the ROW, not on each shape. When it sat on each shape a stroke had
 * to begin on the polygon to be noticed at all — so a swipe that started in the space
 * beside a shape and swept through it, which is what cutting actually looks like, did
 * nothing whatsoever.
 *
 * ONE stroke cuts ONE shape: the first, in option order, that it crosses. Cutting
 * everything a long sweep touches would let a player finish "cut all the pentagons" by
 * dragging across the whole row, and aim would stop mattering.
 *
 * A stationary tap cuts too, straight across the shape under it. On a tablet a young
 * player taps first and asks questions later, and a tap that visibly does nothing reads
 * as a broken game rather than as an invitation to swipe. Pointer events cover mouse, pen
 * and touch from one code path.
 */
const TAP_SLOP = 10;              // px of movement below which a gesture is a tap
const TAP_REACH = 0.62;           // how far off a shape a tap may land, in shape widths

class CutInteraction {
  constructor(options) {
    this.options = options;
    this.start = null;
    this.onDown = this.onDown.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    /* The WINDOW. Listening on any narrower element means a stroke that begins outside
       that element is discarded, and there is always an outside: off the shape, off the
       row, off the letterboxed stage. Nothing else on the page is interactive, so there
       is nothing to compete with. */
    window.addEventListener('pointerdown', this.onDown);
  }

  onDown(e) {
    this.start = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    e.preventDefault();
  }

  onUp(e) {
    const from = this.start;
    this.onCancel();
    if (!from) return;
    const to = { x: e.clientX, y: e.clientY };
    const isTap = Math.hypot(to.x - from.x, to.y - from.y) < TAP_SLOP;

    // the first shape the stroke crosses, in the order they are shown
    let target = this.options.find(o => o.hitBy(from, to, isTap));

    /* A tap that misses the outline still counts if it landed close by. §30 asks for an
       interaction area a little larger than the polygon, and a near miss on a vertex is
       exactly the miss a young player makes. A SWIPE gets no such help: it either crossed
       the shape or it did not. */
    if (!target && isTap) {
      const near = this.options
        .filter(o => !o.done && o.distance(from) < TAP_REACH)
        .sort((a, b) => a.distance(from) - b.distance(from));
      target = near[0];
    }
    if (target) target.cutAlong(from, to, isTap);
  }

  onCancel() {
    this.start = null;
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
  }

  destroy() {
    this.onCancel();
    window.removeEventListener('pointerdown', this.onDown);
  }
}

/** Does the stroke from-to pass through the polygon? Either end inside counts, and so
    does a line that enters one side and leaves another. */
function crossesShape(renderer, from, to) {
  if (renderer.contains(from) || renderer.contains(to)) return true;
  const pts = renderer.pts;
  for (let i = 0; i < pts.length; i++) {
    if (segHit(from, to, pts[i], pts[(i + 1) % pts.length])) return true;
  }
  return false;
}
function segHit(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/* ---------------- Question ---------------- */

/* The supplied statement, rendered exactly as supplied. It is the only learner-facing
   text in the game, so it is never rewritten, shortened or explained. */
function Question(text) {
  const h = document.createElement('p');
  h.className = 'question';
  h.id = 'question';
  h.setAttribute('aria-live', 'polite');
  h.textContent = text;
  return h;
}

/* ---------------- ShapeOptions ---------------- */

/* The options, in the order supplied. Three fit one row; five and six wrap, and the
   wrapping is by option count rather than by measurement so a shape is never shrunk to
   the point where its sides stop being countable. */
function ShapeOptions(options, onCut) {
  const row = document.createElement('div');
  row.className = 'shapes';
  row.id = 'shapes';
  row.dataset.count = String(options.length);
  const built = options.map(o => {
    const po = new PolygonOption(o, onCut);
    row.append(po.node);
    return po;
  });
  return { node: row, options: built };
}

/* ---------------- LevelRenderer ---------------- */

class LevelRenderer {
  constructor(root) { this.root = root; this.current = null; }

  render(level, onCut) {
    this.clear();
    const stage = document.createElement('div');
    stage.className = 'level';
    stage.dataset.levelId = String(level.id);
    stage.append(Question(level.question));
    const shapes = ShapeOptions(level.options, onCut);
    stage.append(shapes.node);
    this.root.append(stage);
    /* The gesture is listened for on the WINDOW: see the note on CutInteraction. Any
       narrower element has an outside, and a stroke that starts outside it is lost. */
    const interaction = new CutInteraction(shapes.options);
    this.current = { stage, shapes, interaction };
    // one frame later, so the entrance transition has a start state to move from
    requestAnimationFrame(() => stage.classList.add('is-in'));
    return shapes.options;
  }

  leave(done) {
    if (!this.current) { done(); return; }
    this.current.stage.classList.add('is-out');
    setTimeout(done, 260);
  }

  clear() {
    if (!this.current) return;
    this.current.interaction.destroy();
    for (const o of this.current.shapes.options) o.destroy();
    this.current.stage.remove();
    this.current = null;
  }
}

/* ---------------- Game ---------------- */

const CORRECT_HOLD = 620;                           // let the cut finish before moving on

class Game {
  constructor(root) {
    this.renderer = new LevelRenderer(root);
    this.state = { currentLevel: 0, completedCorrectOptions: new Set(), isTransitioning: false };
    this.onCut = this.handleCut.bind(this);
  }

  get level() { return levels[this.state.currentLevel]; }

  start() { this.show(0); }

  show(index) {
    // a fresh level starts with nothing completed: the set is per level, not per game
    this.state.currentLevel = index;
    this.state.completedCorrectOptions = new Set();
    this.state.isTransitioning = false;
    this.renderer.render(this.level, this.onCut);
  }

  handleCut(option, wasCorrect) {
    if (this.state.isTransitioning) return;
    if (!wasCorrect) return;                        // a wrong cut advances nothing

    /* Counted once. Re-cutting a shape that is already done must not move the level on,
       which is why completion is measured against the SET of correct options rather
       than by counting cuts. */
    this.state.completedCorrectOptions.add(option.id);

    const needed = correctOptions(this.level);
    const finished = needed.every(o => this.state.completedCorrectOptions.has(o.id));
    if (!finished) return;                          // "cut all the ..." is not done yet

    this.state.isTransitioning = true;
    setTimeout(() => this.advance(), CORRECT_HOLD);
  }

  advance() {
    const next = this.state.currentLevel + 1;
    if (next >= levels.length) {
      /* The last level. The supplied sequence ends here and no end screen is permitted,
         so the finished board simply stays as the player left it. */
      this.state.isTransitioning = false;
      return;
    }
    this.renderer.leave(() => this.show(next));
  }

  /* ---- for tests: drive the game without synthesising gestures ---- */
  debug() {
    return {
      level: this.level.id,
      mode: this.level.selectionMode,
      options: this.level.options.map(o => o.id),
      completed: [...this.state.completedCorrectOptions],
      transitioning: this.state.isTransitioning
    };
  }
  /** Cut one option by id, as a stroke straight across it. */
  cut(id) {
    const found = (this.renderer.current?.shapes.options || []).find(o => o.option.id === id);
    if (!found) return false;
    found.take({ x: -VIEW, y: 0.03 }, { x: VIEW, y: -0.03 });
    return true;
  }
}

function createCutGame(root) {
  const g = new Game(root);
  g.start();
  return g;
}

  return { Game: Game, createCutGame: createCutGame };
})();
