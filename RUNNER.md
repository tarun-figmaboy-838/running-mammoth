# The Ice Age runner — context for writing a level brief

Everything you need to know to specify new levels for this game, and the things a brief
cannot ask for without changing the game itself. Written so a level spec can be checked
against it before any code is touched.

Open `game/index.html` through a server (`node tools/serve.mjs 8181` →
<http://127.0.0.1:8181/index.html>). It uses ES modules, so opening the file directly
shows a blank page — browsers refuse module imports over `file://`.

---

## 1. What the game is

A mammoth runs left-to-right across an ice shelf. The ice gives way, opening a crevasse
too wide to jump. Shapes made of glacier ice hang on ropes that come down out of a fog
bank, in a row centred over the hole. The learner **cuts a rope** — a swipe across it —
and the chunk falls. The right shape wedges into the crevasse and the ice grows out to
meet it, mending the path. The wrong shape falls past the lip into the meltwater and
splashes.

The learning is polygon recognition, and it is the mechanic: nothing is repaired unless
the right polygon is identified.

**Level 1 is seven of these crossings in a row** — the curriculum in §3. Level 2 was
drafted and parked (`game/drafts/level-2.draft.js`).

---

## 2. The run of play

```
RUN_SEGMENT_1 → JUMP_CHALLENGE_1 → POST_JUMP_RUN_1 → GLACIER_BREAK_1
   → PHASE_INTRO → PHASE_ACTIVE → PHASE_SUCCESS → PHASE_DONE
   → PHASE_RUN → GLACIER_BREAK_1 → … (seven times) → FINAL_RUN → COMPLETE
```

- **GLACIER_BREAK_1** — the ground cracks, the character skids to a halt, the screen
  shakes on a band-limited rumble, and the crevasses open.
- **PHASE_INTRO** — the instruction card holds the stage **alone** for 2s. The chunks are
  held above the screen until it leaves. Then the ropes lower them in.
- **PHASE_ACTIVE** — playable. Cutting is the only input.
- **PHASE_WRONG** — a wrong cut. The chunk is thrown toward the water and splashes, the
  character reacts, a cross pops briefly over the crossing, and the phase stays open.
- **PHASE_SUCCESS** — a correct cut. The chunk wedges into a repair slot. If the phase
  still wants more shapes it goes straight back to PHASE_ACTIVE; the plug stays in,
  visibly accepted, and the snow that seals the crossing waits.
- **PHASE_DONE** — the last shape the phase wanted is in. The crossings bridge, snow
  settles over the joins, the character celebrates, and the run resumes.

A wrong answer never removes the correct chunk and never ends the phase. Three failed
jump attempts crumble the rock so the run can never dead-end.

---

## 3. The level data — where a brief lands

All of it is in `CFG.levelOne` in [game/js/engine.js](game/js/engine.js). One phase per
crossing:

```js
{ id: 6, ditches: 2, options: 5,
  targets: ['regularPentagon', 'irregularConvexPentagon', 'concavePentagon'],
  distractors: ['irregularHexagon', 'regularQuadrilateral'],
  rotate: 8, swing: 0.04,
  concept: { glyph: 'pentagon', name: 'pentagons', all: true },
  instruction: 'Cut all the pentagons.' }
```

| field | meaning |
|---|---|
| `id` | 1-based. Also what `jumpBefore` refers to. |
| `ditches` | how many crevasses open. 1 or 2. Two are narrower (`gapWMulti`). Clamped to `targets.length` — a crevasse with no slot could never be mended. |
| `options` | how many chunks hang. 3, 5 and 6 are all in use. Must equal `targets.length + distractors.length` to use them all. |
| `targets` | every shape the phase wants, as an internal geometry id. **One entry per answer**, not one per ditch. |
| `distractors` | the wrong shapes hanging alongside. |
| `rotate` | degrees of tilt on the hanging chunks — recognition despite orientation. Never changes what a shape is. |
| `irregular` | 0–0.16 radial jitter. Legacy, for the basic shapes only: it is **ignored** for a verified geometry, because jitter on a shape built to be concave or specifically irregular would break the property it exists to show. |
| `tutorial` | shows the swipe-to-cut demonstration between two ropes. Phase 1 only. |
| `swing` | how much the chunks sway on their ropes. |
| `instruction` | the sentence. **The only learner-facing text in a phase.** |

Two lists must stay the same length as `phases`:

```js
jumpBefore: [2, 5],                                    // phase ids that get a rock to clear
runMs: [2600, 3200, 2800, 3400, 3000, 3200, 3000]      // ms of running before each phase
```

### The curriculum as it stands

| # | instruction | answers | distractors |
|---|---|---|---|
| 1 | Cut the triangle. | regularTriangle | regularPentagon, regularHexagon |
| 2 | Cut the quadrilateral. | regularQuadrilateral | regularTriangle, regularPentagon |
| 3 | Cut the pentagon. | regularPentagon | regularTriangle, regularOctagon |
| 4 | Cut the hexagon. | irregularConvexHexagon | regularPentagon, regularHeptagon |
| 5 | Cut the heptagon. | concaveHeptagon | irregularConvexHexagon, irregularConvexOctagon |
| 6 | Cut all the pentagons. | regularPentagon, irregularConvexPentagon, concavePentagon | irregularHexagon, regularQuadrilateral |
| 7 | Cut all the hexagons. | irregularConvexHexagon, concaveHexagon, regularHexagon | concaveHeptagon, irregularPentagon, regularOctagon |

The rule being taught is **the number of sides**, and nothing else. 4 asks for a hexagon
that is irregular, 5 for a heptagon that is concave, and 6 and 7 ask for every pentagon
and every hexagon across regular, irregular-convex and concave examples. A brief must not
make regularity or convexity the property that decides.

### How many answers is not how many holes
A phase wants `targets.length` shapes and opens `ditches` crevasses, and the two are
independent. Each crevasse is divided into as many equal **repair slots** as its share of
the answers — three answers across two crevasses gives slot counts of 2 and 1 — and a
crevasse is only mended once every slot in it is plugged. A brief asking for three answers
therefore does **not** get three crevasses.

### Any slot takes any wanted shape
The phase wants a **set** of shapes, not an assignment: a correct cut takes whichever free
slot is nearest it. Do not write a brief that says "the pentagon goes in the left gap" —
that was removed deliberately, because it made the learner guess an allocation nobody had
told them, on top of the recognition being taught.

A correct cut can never be scored twice, a wrong cut removes nothing but itself, and while
any answer remains at least one slot is still open water — so a wrong chunk always has
somewhere to splash and can never land on the crossing.

### The instruction card
One sentence, big and centred, popping in. Nothing else is on it: there is no drawn
polygon beside the words any more (it was removed on request), no "to fill the shape", no
"One more gap!", no count of what is left, and no second line. The card holds the stage
alone for 2s before any chunk descends, and the hint button brings it back at any time.

Because the words now carry the whole instruction, how big they are is a functional
requirement, and a test guards it: the sentence must be more than 3% of the stage height.

The sentence names the **class**, never the answer, and a test enforces that too — it may
not contain "regular", "irregular", "convex", "concave" or "sides". Phase 4 says "hexagon"
while the answer is an irregular one; phase 5 says "heptagon" while the answer is concave.
Saying so would remove the thing the learner is meant to work out.

---

## 4. What shapes are available

### The verified registry — where a brief should get its shapes
[game/js/polygons.js](game/js/polygons.js) holds **fourteen verified geometries**, and it
is the authority. `PolygonFactory` in `engine.js` asks it for vertices by name, so there
is exactly one definition of each and the runner holds no copy:

```
regularTriangle 3 · regularQuadrilateral 4 · regularPentagon 5 · regularHexagon 6
regularHeptagon 7 · regularOctagon 8
irregularPentagon 5 · irregularConvexPentagon 5 · irregularHexagon 6
irregularConvexHexagon 6 · irregularConvexOctagon 8
concavePentagon 5 · concaveHexagon 6 · concaveHeptagon 7
```

Heptagons, octagons, irregular-convex and concave shapes all work. Name one of these in a
brief and it needs no engine work.

`verify()` checks every one: vertex count against its metadata, that a convex shape's
corners all turn the same way and a concave one's do not, no self-crossing sides, no
near-collinear corner (which would make two sides read as one), no side under 16% of the
longest, and that "regular" shapes really do have equal sides while "irregular" ones
really do not. It reports zero problems, and a test runs it.

Chunks are fitted into the option row **uniformly**, so a regular polygon keeps equal
sides and nothing is ever stretched to fill a box.

### Also still there: the basic factory
`PolygonFactory`'s own switch still builds these by name, for visual variation rather
than for the curriculum:

```
triangle 3 · square 4 · rectangle 4 · quadrilateral 4 · trapezoid 4 · pentagon 5 · hexagon 6
```

All convex, all stretched to their box, and `irregular` jitters them. Prefer the verified
names in a brief: these are the demo shapes, and `triangle` and `regularTriangle` are not
the same geometry.

### Names are labels; ids are geometry
A brief may say "regular convex pentagon" — that is a regular pentagon, which is convex by
definition, and it maps onto `regularPentagon`. "Octagon" and "Quadrilateral" with no
qualifier map onto `regularOctagon` and `regularQuadrilateral`. `CANONICAL` in
`polygons.js` holds those aliases. Do not create a second geometry because the wording
differs.

### One constraint on shape choice
A wedged chunk grows until its longest edge spans its slot, then is clipped to it. A shape
whose longest edge is short relative to its width (a regular hexagon, say) has to grow a
long way to seal the gap. It still works, but a brief that mixes very different aspect
ratios in one phase will produce plugs of visibly different depths.

### Where the options hang, and how big they end up
The row is **centred on the crevasse group** — the options hang over the hole they are
going into — and it is symmetric, so it is only as wide as the narrower of its two sides
allows. The left side always binds: no part of a chunk may be left of x 770
(`mammothX + clearOfPlayer`), because a cut chunk travels toward the crevasse and one
that hung over the character dropped ice on its head.

So more options makes the shapes smaller, never the margin thinner. Measured, at the sizes
the game actually draws:

| options | crevasses | row spans | chunk |
|---|---|---|---|
| 3 | 1, centred on 1080 | 770–1390 | about 177 × 150–170 |
| 5 | 2, centred on 1275 | 770–1780 | about 172 × 150–172 |
| 6 | 2, centred on 1275 | 770–1780 | about 138 × 118–138 |

Six is the practical limit at this stage width if the sides are to stay countable, and at
a phone-landscape size a six-option row is genuinely small: the stage is 693px wide there,
so a 138px chunk lands at about 50px on screen, and telling six sides from seven at that
size is hard. Three- and five-option phases are comfortable.

---

## 5. What is on screen, and what is not

**Present:** the character, the ice path, the crevasse and its meltwater, the overhang and
ropes, the hanging chunks, the instruction card, three round icon buttons top-right
(hint / sound / pause), and a JUMP button bottom-right during running segments.

**Removed deliberately — do not ask for these back without saying so:**
- the character-select screen (one explorer now: the mammoth)
- the phase-progress diamonds
- any second instruction line during a phase

**No score, no lives, no stars, no timer, no level number.**

---

## 6. Fixed things a brief should not fight

| | |
|---|---|
| Stage | 1920×1080 backbuffer, 16:9, letterboxed. `surfaceY` (the walking line) is **890**. |
| Above | a fog bank across the top ~150px. There is no ice shelf and no icicle fringe any more; the ropes run off the top of the frame and the fog is what they come out of. It takes the sky's own colour, so it can never be a white bank over a violet dusk. |
| Crevasse | 620px wide for one, 430px each for two, 150px of ice between them. Centred. |
| Chunks | hang at y 470 from a rig at y 150, in a row centred on the crevasse. No part of one may be left of x 770 (`mammothX + clearOfPlayer`). |
| Crevasse position | `clearance` (340) puts the near lip that far past the character, which is also what leaves room for a centred row. The character is ~538px wide, so the lip is only about 70px beyond its nose. |
| Cut | a swipe across a **rope**, not across the shape. The rope is really severed and the stub stays cut. |
| Gameplay numbers | speed, gravity, jump and collider are global, not per character, so no explorer is easier to play than another. |
| Assets | WebP. Sprites near-lossless, skies lossy. Sheets are horizontal strips of 420×320 cells. |

**Playtest flags:** `?skip=1` straight into the run, `?sound=0`, `?reduced=1`,
`?speed=300–900`, `?fast=1–8` (steps the simulation N times per rendered frame — same
physics, less wall clock; the only way to reach phase 6 quickly).

---

## 7. What the tests will hold you to

`npx playwright test` — 130 tests across desktop and phone-landscape. A level brief has to
survive these:

- all seven phases complete, and complete again with a wrong answer in every phase
- a multi-answer phase stays open until every one of its shapes has been cut, in any
  order, and one answer can never be counted twice
- every verified geometry has the side count, convexity and regularity it claims, and
  fitting, seating and rotating a chunk never changes any of them
- no hanging option can drop on the character
- the crevasse is far too wide to jump, and centred
- the instruction shows the shape as well as naming it, and is gone before the phase is
  playable
- the interface stays under 12% of the screen
- every sprite sheet is 420×320 per cell, no frame clipped, no stray fragment, one size
  across every animation
- the whole art set stays under 12MB
- the quake is a rumble, not per-frame noise

If a new level count is not 7, `runMs` needs updating with it and `jumpBefore` needs
checking against the surviving phase ids. The tests read the phase count from the module
rather than hard-coding it, but the two "all seven phases" assertions name the number.

---

## 8. Writing the brief

Most useful to state, per level:

1. the instruction sentence, exactly as it should read
2. the target shape(s) — and whether they are regular, irregular or concave
3. the distractor shapes
4. how many crevasses
5. whether the chunks are tilted (`rotate`) or irregular (`irregular`)

Worth deciding up front:

- **Heptagons, octagons, irregular-convex or concave shapes?** All available — name them
  from the verified registry in §4. No engine work needed.
- **Does the instruction wording change?** It currently reads "Cut the pentagon." and
  "Cut all the pentagons." — words only, no glyph. Keep it to naming the class.
- **Several answers in one phase?** Supported: put them all in `targets`, keep `ditches`
  at 1 or 2, and the repair slots are shared out. Say how many options should hang.
- **How many levels?** Seven today. A different number is fine; `runMs` moves with it.
