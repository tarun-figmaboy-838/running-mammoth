# Parked: the standalone polygon-cutting game

Seven levels of polygon recognition on a bare screen — a question statement and the
polygon options, nothing else. Built to a brief that ruled out characters, backgrounds
with objects, and every HUD control, which is why it could not share a screen with the
runner.

It is parked because the decision was to improve the RUNNER's levels instead of shipping
a second game. Nothing here is broken: 42 tests passed across two viewports, including
real pointer gestures and loading from `file://`.

## What it needs to run again

Copy `index.html` to `game/index.html`, `cutgame.js` / `cutmain.js` / `levels.js` to
`game/js/`, `cutgame.css` to `game/css/`, and `cutgame.spec.mjs` to `tests/`. It also
needs `game/js/polygons.js`, which stayed in place — see below.

These are CLASSIC scripts, not modules, so the page opens by double-clicking the HTML
file. A browser refuses ES module imports over `file://`.

## What was kept, and why

`game/js/polygons.js` is still in `game/js/`. It holds fourteen verified polygon
geometries — regular, irregular-convex and concave shapes from triangle to octagon — with
a `verify()` that checks vertex counts, convexity against the metadata, self-intersection,
near-collinear corners and whether "regular" shapes really do have equal sides.

The runner's own `PolygonFactory` can only build regular-ish shapes with optional jitter.
It cannot make a concave heptagon that reliably reads as seven-sided. If the runner's
levels are to ask about irregular or concave polygons, that geometry is where they should
come from.
