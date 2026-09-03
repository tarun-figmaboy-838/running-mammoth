/* THE LEVELS — the single source of truth for questions, options, order, geometry and
   answers.
 *
 * Option ids are scoped to their level because the same polygon appears in several of
 * them: a regular triangle is the answer in Level 1 and a wrong answer in Levels 2 and
 * 3. Distinct ids, one shared geometry.
 *
 * `type` is a canonical geometry name from polygons.js, never a description. Level 6's
 * "Regular convex pentagon" is regularPentagon — a regular pentagon is convex — and its
 * "Quadrilateral" and Level 7's "Octagon" are the regular ones, since no irregular
 * variant of either was specified.
 *
 * Option order is exactly as supplied and must not be sorted or shuffled. Nothing here
 * is derived at runtime: the questions are the only learner-facing text in the game, so
 * they are stored as written and rendered as written.
 *
 * A classic script, like the rest: see the note in polygons.js.
 */
window.PolygonLevels = (function () {
  'use strict';
const levels = [
  {
    id: 1,
    question: 'Cut the triangle.',
    selectionMode: 'single',
    options: [
      { id: 'level-1-regular-triangle', type: 'regularTriangle', correct: true },
      { id: 'level-1-regular-pentagon', type: 'regularPentagon', correct: false },
      { id: 'level-1-regular-hexagon',  type: 'regularHexagon',  correct: false }
    ]
  },
  {
    id: 2,
    question: 'Cut the quadrilateral.',
    selectionMode: 'single',
    options: [
      { id: 'level-2-regular-triangle',      type: 'regularTriangle',      correct: false },
      { id: 'level-2-regular-quadrilateral', type: 'regularQuadrilateral', correct: true },
      { id: 'level-2-regular-pentagon',      type: 'regularPentagon',      correct: false }
    ]
  },
  {
    id: 3,
    question: 'Cut the pentagon.',
    selectionMode: 'single',
    options: [
      { id: 'level-3-regular-triangle', type: 'regularTriangle', correct: false },
      { id: 'level-3-regular-pentagon', type: 'regularPentagon', correct: true },
      { id: 'level-3-regular-octagon',  type: 'regularOctagon',  correct: false }
    ]
  },
  {
    /* The first level whose answer is not regular. Validation is on side count alone,
       which is exactly what this level is here to teach. */
    id: 4,
    question: 'Cut the hexagon.',
    selectionMode: 'single',
    options: [
      { id: 'level-4-regular-pentagon',          type: 'regularPentagon',        correct: false },
      { id: 'level-4-irregular-convex-hexagon',  type: 'irregularConvexHexagon', correct: true },
      { id: 'level-4-regular-heptagon',          type: 'regularHeptagon',        correct: false }
    ]
  },
  {
    /* And the first whose answer is not convex. A heptagon with a dent in it is still a
       heptagon. */
    id: 5,
    question: 'Cut the heptagon.',
    selectionMode: 'single',
    options: [
      { id: 'level-5-irregular-convex-hexagon', type: 'irregularConvexHexagon', correct: false },
      { id: 'level-5-concave-heptagon',         type: 'concaveHeptagon',        correct: true },
      { id: 'level-5-irregular-convex-octagon', type: 'irregularConvexOctagon', correct: false }
    ]
  },
  {
    /* Three pentagons in three different guises — regular, irregular, concave — so the
       learner discovers by playing that all three belong to the same family. */
    id: 6,
    question: 'Cut all the pentagons.',
    selectionMode: 'multiple',
    options: [
      { id: 'level-6-regular-convex-pentagon',   type: 'regularPentagon',         correct: true },
      { id: 'level-6-irregular-hexagon',         type: 'irregularHexagon',        correct: false },
      { id: 'level-6-irregular-convex-pentagon', type: 'irregularConvexPentagon', correct: true },
      { id: 'level-6-quadrilateral',             type: 'regularQuadrilateral',    correct: false },
      { id: 'level-6-concave-pentagon',          type: 'concavePentagon',         correct: true }
    ]
  },
  {
    id: 7,
    question: 'Cut all the hexagons.',
    selectionMode: 'multiple',
    options: [
      { id: 'level-7-concave-heptagon',          type: 'concaveHeptagon',        correct: false },
      { id: 'level-7-irregular-convex-hexagon',  type: 'irregularConvexHexagon', correct: true },
      { id: 'level-7-irregular-pentagon',        type: 'irregularPentagon',      correct: false },
      { id: 'level-7-concave-hexagon',           type: 'concaveHexagon',         correct: true },
      { id: 'level-7-octagon',                   type: 'regularOctagon',         correct: false },
      { id: 'level-7-regular-hexagon',           type: 'regularHexagon',         correct: true }
    ]
  }
];

/** The options a level cannot be finished without. */
function correctOptions(level) {
  return level.options.filter(o => o.correct);
}

  return { levels, correctOptions };
})();
