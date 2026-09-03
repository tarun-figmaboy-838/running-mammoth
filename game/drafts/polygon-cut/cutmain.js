/* Entry point.
 *
 * There is nothing to configure: no sound to mute, no motion setting to pass through, no
 * level to skip to. The whole game is a question and some polygons, so this is one call.
 *
 * A classic script rather than a module, because a module cannot be loaded over file://
 * and the game has to open by double-clicking its HTML file.
 */
(function () {
  'use strict';
  var root = document.getElementById('game');
  var game = window.PolygonGameFactory.createCutGame(root);

  /* The handle the tests drive. Every option in every level has to be exercised,
     including the wrong ones, which is impractical through synthesised gestures at seven
     levels — so the game exposes cutting one option by id and reading its state back. */
  window.polygonGame = game;
})();
