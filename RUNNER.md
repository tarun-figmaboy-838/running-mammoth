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
{ id: 6, ditches: 1, options: 5,
  targets: ['regularPentagon', 'irregularConvexPentagon', 'concavePentagon'],
  distractors: ['irregularHexagon', 'regularQuadrilateral'],
  rotate: 8, swing: 0.04,
  instruction: 'Cut all the pentagons.' }
```

| field | meaning |
|---|---|
| `id` | 1-based. Also what `jumpBefore` refers to. |
| `ditches` | how many crevasses open. 1 or 2. Two are narrower (`gapWMulti`). Clamped to `targets.length` — a crevasse with no slot could never be mended. |
| `options` | how many chunks hang. 3, 5 and 6 are all in use. Must equal `targets.length + distractors.length` to use them all. |
| `targets` | every shape the phase wants, as an internal geometry id. **One entry per answer**, not one per ditch. |
| `distractors` | the wrong shapes hanging alongside. |
| `rotate` | degrees of tilt on the hanging chunks. **0 in every phase now** — the options were required to hang perfectly square and still (2026-09-04). The field and the renderer support it, so a brief can set it again, but be aware it is currently switched off everywhere on purpose. |
| `irregular` | 0–0.16 radial jitter. Legacy, for the basic shapes only: it is **ignored** for a verified geometry, because jitter on a shape built to be concave or specifically irregular would break the property it exists to show. |
| `tutorial` | shows the swipe-to-cut demonstration between two ropes. Phase 1 only. |
| `swing` | how much the chunks sway on their ropes. **0 in every phase, and `rigSwing()` returns 0 regardless** — the sway, the arrival bounce and the missed-swipe jiggle were all removed together (2026-09-04): the options are the question being asked and a question should hold still while it is read. Setting this in a brief will not reintroduce motion without also changing `rigSwing()`. |
| `instruction` | the sentence. **The only learner-facing text in a phase.** |

Two lists must stay the same length as `phases`:

```js
jumpBefore: [2, 5],                                             // phase ids that get a rock to clear
runMs: [7500, 8500, 8000, 9000, 8000, 9000, 8500]               // ms of running before each phase
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

> **Three phases currently break that rule**, and it is worth knowing before writing a
> brief against this section. Audited 2026-09-04:
>
> | phase | the shortcut that always works |
> |---|---|
> | 4 | the target is the **only irregular shape** in the row — "cut the wonky one" |
> | 5 | the target is the **only concave shape** in the row — "cut the dented one" |
> | 6 | one of the three targets is the only concave shape, giving 1 of 3 away free |
>
> Phases 4 and 5 are exactly the two that introduce irregular and concave shapes, so
> the lesson "an irregular hexagon is still a hexagon" is taught by a puzzle that can be
> passed by spotting the irregular one. Phase 7 is built correctly — concave appears on
> both sides — which is the pattern the others should follow.
>
> One distractor swap per phase closes all three, using only the existing registry and
> leaving every instruction untouched: P4 `regularPentagon`→`irregularPentagon`,
> P5 `irregularConvexHexagon`→`concaveHexagon`, P6 `irregularHexagon`→`concaveHexagon`.
> Verified clean, and the four already-clean phases stay clean.
>
> **Not applied** — the curriculum is the author's, and this changes what a level
> teaches.

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
alone for 2s before any chunk descends, and then STAYS UP for the whole playable phase —
it used to slide away, which meant the one thing naming the shape was gone by the time
the learner was looking. There is no hint button any more, so nothing else can summon
it; it does not need to, because it never leaves.

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

Re-measured off the running game at `clearance` 470, with every phase opening ONE
crevasse (phase 6 used to open two). The crevasse is centred on x 1210 in all seven, so
the row is the same 780–1640 every time and only the chunk size changes:

| options | crevasses | row spans | chunk |
|---|---|---|---|
| 3 | 1, centred on 1210 | 780–1640 | 273 × 232–272 |
| 5 | 1, centred on 1210 | 780–1640 | 156 × 133–154 |
| 6 | 1, centred on 1210 | 780–1640 | 127 × 108–126 |

The height range is the spread across the shapes in that phase: a chunk is fitted
UNIFORMLY, so width binds and the height follows each shape's own proportions.

Six is the practical limit at this stage width if the sides are to stay countable, and at
a phone-landscape size a six-option row is genuinely small: the stage is 693px wide there,
so a 138px chunk lands at about 50px on screen, and telling six sides from seven at that
size is hard. Three- and five-option phases are comfortable.

---

## 5. What is on screen, and what is not

**Present:** the character, the ice path, the crevasse and its meltwater, the ropes coming
out of the fog, the hanging chunks, the instruction card, a tick or cross over the
crossing for a second after an answer, and a JUMP button bottom-right during running
segments. That is the whole interface.

**Removed deliberately — do not ask for these back without saying so:**
- the character-select screen (one explorer now: the mammoth)
- the phase-progress diamonds
- any second instruction line during a phase
- **the three round icon buttons top-right (hint / sound / pause).** Gone from the
  markup. So there is no in-game mute, no pause, and no way to bring the instruction
  card back: sound and motion can only be set from the URL (`?sound=0`, `?reduced=1`).
  The pause panel is still in `index.html` and still wired, but nothing opens it.

**No score, no lives, no stars, no timer, no level number.**

---

## 6. Fixed things a brief should not fight

| | |
|---|---|
| Stage | 1920×1080 backbuffer, 16:9, letterboxed. `surfaceY` (the walking line) is **890**. |
| Above | a fog bank across the top ~195px (`rigY × 1.3`). There is no ice shelf and no icicle fringe any more; the ropes run off the top of the frame and the fog is what they come out of. It takes the sky's own colour, so it can never be a white bank over a violet dusk. |
| Crevasse | 620px wide for one, 430px each for two, 150px of ice between them. Centred. |
| Chunks | hang at y 470 from a rig at y 150, in a row centred on the crevasse. No part of one may be left of x 770 (`mammothX + clearOfPlayer`). |
| Crevasse position | `clearance` (**470**) puts the near lip that far past the character, which is also what leaves room for a centred row. It was 340; pushing it right widens the option row on both sides, because the row is symmetric about the crevasse and cannot reach left of x 770. The character's cell is drawn 735px wide (420 × 1.75), so its right edge is near x 795 and the near lip is a clear ~100px beyond it. |
| Cut | a swipe across a **rope**, not across the shape. The rope is really severed and the stub stays cut. |
| Gameplay numbers | speed, gravity, jump and collider are global, not per character, so no explorer is easier to play than another. |
| Assets | WebP. Sprites near-lossless, skies lossy. Sheets are horizontal strips of 420×320 cells. |
| Opening it | `game/index.html` works **either way**: over http:// it loads the ES modules in `game/js`, and opened straight off the disk it loads `game/js/game.bundle.js` instead, because a browser fetches a module with CORS even from a file:// page. The bundle is generated (`node tools/build-bundle.mjs`) and a test fails if it has drifted. file:// runs with no music and the synthesised sound palette; nothing else differs. |

**Playtest flags:** `?skip=1` straight into the run, `?sound=0`, `?reduced=1`,
`?speed=300–900`, `?fast=1–8` (steps the simulation N times per rendered frame — same
physics, less wall clock; the only way to reach phase 6 quickly).

---

## 7. What the tests will hold you to

`npx playwright test` — the suite runs every spec at two sizes, desktop 1920×1080 and
phone-landscape 844×390. A level brief has to survive these:

- all seven phases complete, and complete again with a wrong answer in every phase
- a multi-answer phase stays open until every one of its shapes has been cut, in any
  order, and one answer can never be counted twice
- every verified geometry has the side count, convexity and regularity it claims, and
  fitting, seating and rotating a chunk never changes any of them
- no hanging option can drop on the character
- the crevasse is far too wide to jump, and centred
- the instruction NAMES the class and never the answer: a test rejects the words
  "regular", "irregular", "convex", "concave" and "sides" in the sentence, and another
  requires it to be more than 3% of the stage height, because the words now carry the
  whole instruction
- the card owns the stage alone during PHASE_INTRO and then stays up for the whole
  playable phase, and never swallows a cut
- a correct answer pops a tick and a wrong one pops a cross, over the crossing
- the interface stays under 12% of the screen
- every sprite sheet is 420×320 per cell, no frame clipped, no stray fragment, one size
  across every animation
- the whole art set stays under 12MB
- the quake is a rumble, not per-frame noise — measured on the offset the renderer
  applies, normalised to 60fps so it tests the waveform and not the host's frame rate
- `game/index.html` loads and plays when opened straight off the disk, with no console
  errors, and `game/js/game.bundle.js` still matches the modules it was built from

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

---

## 9. The comedy layer

A brief does not have to ask for any of this and cannot break it, but it is worth
knowing it is there — it is what makes the game feel alive between the polygons, and it
is all **procedural**, so it costs no art and moves with whatever sheets exist.

Everything is tuned from one block, `CFG.comedy` in
[game/js/engine.js](game/js/engine.js).

**The fright at the crevasse.** The headline beat. The mammoth skids to a halt, and
then:

1. a **shudder** — a knock-kneed sideways tremble at 9.5Hz with a nervous roll and a
   jelly squash, all off one amplitude that decays over 1.35s;
2. a **double take** — he recoils 26px off the lip, then leans 15px in to peer down;
3. a **gulp** every 2.3s for as long as he is over the hole, so a long think never
   reads as a hung game;
4. **sweat beads** flicked off his head while he is genuinely rattled.

It is animated on top of whatever frame is showing, because the shake sheet was removed
and `SHAKE` had no art of its own — and, before this, no duration either: it exited on
its first frame, so there was no reaction to the hole at all.

**Every touch is answered.** A ring expands from wherever the player put their finger,
in every state. A swipe that crosses no rope gets a puff of air — before, a missed swipe
was completely silent, which is indistinguishable from a broken game.

The options themselves do **not** move for it. A jiggle on the nearby ropes was tried
and removed along with the sway and the arrival bounce: the hanging blocks hold
perfectly still, because they are the question and a question should not move while it
is being read. What says "these are interactive" is the warm halo and the sheen sweeping
across the ice — light rather than movement, so it never disturbs the silhouette.

**He is touchable.** Tap the mammoth and he toots, bounces and kicks up snow. It changes
no state, no progress and no answer, and it is refused while he is mid-air or knocked
out.

**The reward.** A correct chunk seating throws a ring of glints and a chime on top of
the thud, so "that was right" and "something heavy landed" are different messages. A
mended crossing throws a bigger burst over his head; so does the end of the journey.

**Weight.** The jump stretches and the landing squashes, with the horizontal scale taken
as the inverse square root so volume is preserved — the same numbers now read as impact
rather than as the sprite being resized.

Two rules this layer holds to, and a brief can rely on:

- **It never touches gameplay.** All of it is in the draw transform and the particle
  layer. The collider is a fixed box around `mammothX`, the jump physics are global, and
  the cut hit test is against the rope — a wobble cannot make a learner miss.
- **It never leaks an answer.** Anything that reacts to the pointer reacts uniformly
  across every option, wanted or not.

`?reduced=1` (and the OS reduced-motion setting) scales all of it down.

---

## 10. How a mended crossing is built

Reworked 2026-09-04, because the previous construction destroyed the thing it was meant
to celebrate. Worth understanding before touching any of it: the crossing is the
learner's confirmation of what they cut, so if the shape is not recognisable in it the
puzzle has no payoff.

Top to bottom, per crevasse:

| layer | what it does |
|---|---|
| `drawCrossingSnow` | one unbroken white band over every join |
| `drawCrossingDeck` | lip to lip — the ice that actually spans the gap, scalloped underneath so it visibly rests on each keystone |
| `drawCrossingFill` | ice closing in from both lips, with each plug's outline **punched out of it**, inflated a few per cent |
| `drawKeystone` | the answers themselves — whole, unclipped, countable |

### The trap, so nobody walks back into it

The plug used to be scaled so its **bounding width filled its slot**, and then clipped to
the cavity. The cavity is only `waterDepth` (152px) deep, so a shape grown to a 620px slot
comes out about 500px tall — four fifths of it below the water line, and clipped away.
Measured on the shipped build: **phase 1's answer is a triangle and the finished crossing
showed a trapezoid.** Phase 6's three pentagons showed as three vertical slabs.

Sizing the plug to fit the cavity whole fixes that and introduces the opposite fault: a
small block dangling in a big dark hole with obvious dead space either side, which does
not read as *fitted*.

Neither the shape nor the hole can give — a uniform scale cannot fill a 620 × 152 slot
with a roughly square polygon. **So the ice does the filling.** That is what
`drawCrossingFill` is: it closes the cavity right up to the answer's edge and traces its
outline, which is also exactly the fiction the game already tells — *the right shape
wedges in and the ice grows out to meet it*.

### Rules for changing it

- Size the plug from the **cavity depth**, never from the slot width.
- Do not clip the plug's silhouette. Anything that crops it changes which shape the
  learner is shown.
- If a plug ever needs to be bigger, deepen `waterDepth` — do not grow past it.
