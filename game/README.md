# Ice Age Mammoth Runner

A 2D side-scrolling educational runner. The mammoth runs through a frozen
world, jumps ice crystals, and cannot continue when a glacier breaks the path
— the learner repairs it with geometry.

```
RUN → JUMP → GLACIER BREAK → GEOMETRY PUZZLE → REPAIR → RUN → …
```

**Level 1** — seven crossings of polygon recognition, from "Cut the triangle." to
"Cut all the hexagons."  Ice chunks hang on frozen ropes; swipe across a rope to
drop that chunk. The right polygon wedges into the crevasse and the ice grows out
to meet it; a wrong one falls into the meltwater and splashes, and the crossing
stays open so you try again. Nothing is lost and nothing is scored.

The rule being taught is the number of sides — so a hexagon still counts when it is
irregular, and a heptagon still counts when it is concave. The full curriculum, and
what a brief may and may not ask of it, is in [RUNNER.md](../RUNNER.md).

**Level 2** — "Cut the shape along its diagonal."  Drafted and parked in
`drafts/level-2.draft.js`; not in the game.

## Run it

Serve the folder over HTTP (the code uses ES modules, which browsers block on
`file://`):

```bash
cd game
python3 -m http.server 8080
# then open http://localhost:8080
```

## Structure

```
game/
├── index.html          markup: canvas + HUD
├── css/
│   └── style.css       shell, HUD, overlays, keyframes
├── js/
│   ├── main.js         entry point — boots the engine, wires the HUD
│   ├── hud.js          all DOM outside the canvas
│   └── engine.js       the game itself (canvas, no dependencies)
└── assets/
    ├── bg-dawn.png … bg-night.png    8 backgrounds, dawn → night
    ├── ice-path.png                  tiling foreground path
    ├── ice-crystal.png               jumpable obstacle
    ├── mammoth-run.png               12-frame run cycle (380×320 cells)
    └── mammoth-jump.png              10-frame jump arc (380×320 cells)
```

`engine.js` holds the modules described below and exports two things:
`CFG` (all tuning values) and `createGame(canvas, hooks)`.

| Module | Responsibility |
| --- | --- |
| `GameFlowController` | the state machine (`RUN_SEGMENT_1` … `COMPLETE`) |
| `MammothController` | sprite state → frame selection, jump physics, coyote time |
| `WorldScroller` / `GroundManager` | path tiling, gaps, broken edges, repaired pieces |
| `BackgroundTimeManager` | 8-phase day cycle with 1.5s crossfades |
| `Atmosphere` | clouds, snowfall, interactive aurora |
| `ObstacleController` | crystal spawn, telegraph, forgiving collisions |
| `LevelOnePuzzle` | hanging shapes, rope cutting, fit / reject |
| `LevelTwoCutPuzzle` + `PolygonCutManager` | vertex snapping, diagonal validation, real polygon split |
| `FeedbackFX` / `ParticleManager` | snow puffs, ice chips, frost, camera shake |
| `AudioManager` | procedural WebAudio (swap in real files here) |
| `HintManager` | progressive hints, escalating only on wrong attempts |

## Controls

| Input | Action |
| --- | --- |
| `Space` / `↑` / `W` | jump |
| Jump button (bottom-right) | jump |
| Click-drag / swipe | cut a rope |
| Pause button (top-right) | pause / resume |

Jumping allows ~90ms of coyote time and a ~110ms input buffer, and the
collision box is the mammoth's footprint rather than its full sprite, so the
timing window has about 0.26s of slack.

## Design rules baked in

- **No fail state.** Hitting a crystal is a stumble, a bonk and a short freeze;
  the crystal is pushed ahead and you carry on. Three bumps and it crumbles so
  progress can never deadlock.
- **Time follows milestones, not the clock.** Each flow state owns a slice of
  the day; the puzzle states hold the sky still, so a learner can think for ten
  minutes without skipping to night.
- **Colour never gives the answer.** Every option shares one ice material, so
  recognition comes from counting sides — and only from that. A hexagon counts
  whether it is regular, irregular or concave.
- **Hints escalate only on wrong attempts** (or genuine inactivity), and always
  time out.

## Tuning

Everything lives in `CFG` at the top of `js/engine.js`: run speed, gravity and
jump velocity, sprite cell size and fps, the phase → background mapping and its
progress thresholds, hint delays, vertex snap tolerance and the palette.

The curriculum is `CFG.levelOne.phases` — one entry per crossing, carrying its
instruction, its target and distractor geometries, how many crevasses open and how
many chunks hang. Adding or reordering a crossing is a data change; `runMs` moves
with it. Geometry itself is never defined there: a phase names a shape from
`js/polygons.js`, which is the single authority for all fourteen of them.

URL overrides for playtesting: `?speed=300–900`, `?sound=0`, `?reduced=1`,
`?skip=1`, `?fast=1–8`.

## Audio

All sound is synthesised in the browser behind `AudioManager` (wind ambience,
snow steps, whoosh, thud, ice chime, bonk, rumble, slice, clunk, frost sweep,
success accent). Browsers require a gesture before audio starts, so the first
tap or key press turns it on. To use real recordings, replace the method bodies
in `AudioManager` — no gameplay code refers to sound directly.

## Accessibility

- Honours `prefers-reduced-motion`: less shake, fewer particles, calmer sky.
- Wrong answers read through motion and form, not colour alone; correct answers
  read through fit, frost and sound.
- No flashing or strobing effects.
- Portrait phones get a "rotate your device" prompt instead of a squashed 16:9
  stage.
