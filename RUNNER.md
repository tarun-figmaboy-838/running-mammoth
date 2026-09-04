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
| `ditches` | how many crevasses open. 1 or 2 — two is the most a 1920 stage can hold (see §6). Two are narrower (`gapWMulti` 415). Clamped to `targets.length` — a crevasse with no slot could never be mended. Phases 6 and 7 use 2, which also **widens the option row** and so makes the shapes bigger: a six-option chunk goes from 127px to 142px, because the row is centred on the crevasse group. |
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

> **Three phases used to break that rule and have been fixed.** Audited and corrected
> 2026-09-04, one distractor swapped per phase, every instruction untouched:
>
> | phase | the shortcut that used to work | the swap that closed it |
> |---|---|---|
> | 4 | the target was the **only irregular shape** in the row — "cut the wonky one" | `regularPentagon` → `irregularPentagon` |
> | 5 | the target was the **only concave shape** in the row — "cut the dented one" | `irregularConvexHexagon` → `concaveHexagon` |
> | 6 | one of the three targets was the only concave shape, giving 1 of 3 away free | `irregularHexagon` → `concaveHexagon` |
>
> Phases 4 and 5 are the two that introduce irregular and concave shapes, so those
> shortcuts were defeating the exact lesson each phase exists to teach.
>
> **All seven phases now verify clean**: for every phase, neither regularity nor
> convexity separates the targets from the distractors, and no target is the only shape
> in its row with a given property. Only the side count decides. If you change a
> distractor, re-check that — it is easy to reintroduce by accident, and nothing in the
> suite catches it.

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

Re-measured off the running game at `clearance` 470. The row is centred on the crevasse
GROUP, so a two-crevasse phase has a wider group, a wider row and therefore bigger
shapes — which is a large part of why phases 6 and 7 open two:

| options | crevasses | row spans | chunk |
|---|---|---|---|
| 3 | 1, centred on 1210 | 780–1640 | 273 × 232–272 |
| 5 | 2, spanning 900–1850 | 890–1860 | 174 |
| 6 | 2, spanning 900–1850 | 890–1860 | 142 |

(Phases 1–5 open one crevasse and all use 3 options. 6 uses 5 options, 7 uses 6.)

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
| Stage | 1920×1080 backbuffer, 16:9, letterboxed. `surfaceY` (the walking line) is **840** — raised from 890 so the crevasse is deep enough to hold a correct shape at the size it was cut. See §10. |
| Below the shelf | open water, from where the path art's painted content ends (y 1033) to the bottom of the stage. Raising the walking line left a 47px band of flat background there; the alternative was scaling the path art 24% larger, which thickens the delivered rock strata. The world is an ice shelf over meltwater — every crevasse has a pool at the bottom — so the sea is what those pools are pools *of*. |
| Above | a fog bank across the top ~195px (`rigY × 1.3`). There is no ice shelf and no icicle fringe any more; the ropes run off the top of the frame and the fog is what they come out of. It takes the sky's own colour, so it can never be a white bank over a violet dusk. |
| Crevasse | 620px wide for one, **415px each for two, 120px** of ice between them. Phases 6 and 7 open two; 1–5 open one. Those numbers are the largest that fit: each crevasse must clear 400px or a jump carries it, the near lip must be 630px past the character, and the far lip must stay on a 1920 stage. **Three do not fit** — even at the minimum, 3 × 405 + 2 × 110 puts the far lip at 2065. |
| Chunks | hang at y 470 from a rig at y 150, in a row centred on the crevasse. No part of one may be left of x 770 (`mammothX + clearOfPlayer`). |
| Crevasse position | `clearance` (**470**) puts the near lip that far past the character, which is also what leaves room for a centred row. It was 340; pushing it right widens the option row on both sides, because the row is symmetric about the crevasse and cannot reach left of x 770. The character's cell is drawn 735px wide (420 × 1.75), so its right edge is near x 795 and the near lip is a clear ~100px beyond it. |
| Cut | a swipe across a **rope**, not across the shape. The rope is really severed and the stub stays cut. |
| Gameplay numbers | speed, gravity, jump and collider are global, not per character, so no explorer is easier to play than another. |
| Assets | WebP. Sprites near-lossless, skies lossy. Sheets are horizontal strips of 420×320 cells. |
| Opening it | `game/index.html` works **either way**: over http:// it loads the ES modules in `game/js`, and opened straight off the disk it loads `game/js/game.bundle.js` instead, because a browser fetches a module with CORS even from a file:// page. The bundle is generated (`node tools/build-bundle.mjs`) and a test fails if it has drifted. file:// runs with no music and the synthesised sound palette; nothing else differs. |

**Getting past a beat:** a tap (or Space / ↑ / W) skips the rest of the **collapse** and
the instruction card's **read-hold**. Measured, that takes a puzzle's pre-roll from 5.6s
to 1.3s, and over seven puzzles it is about 30 seconds of a five-minute game. The collapse
still happens — the clock jumps to its final frame, so the crevasses open, the character
lands where the layout expects and the fright still fires; what is skipped is the
watching, not the event. The card does not go away either: it stays up for the whole
playable phase, so a learner who wants to read it still can.

Deliberately **not** skippable: the run segments (they are the journey) and the wrong and
success beats (they are the feedback — a splash cut short teaches nothing).

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

### 9e. The first-play tutorial

Added 2026-09-04. `game/js/tutorial.js`, a DOM layer driven from `main.js` on its own
animation frame — not from `onHud`, which fires from the engine's update, which the
tutorial *pauses*: driving it from there would stop it dead on its first step.

**Two kinds of step, and the difference decides everything else.**

| | describing | asking |
|---|---|---|
| `advance` | a number of seconds | the name of an action |
| the game | frozen | running |
| the blur sheet | on | off |
| the hand | none | on the control, tapping or sweeping |
| the box | stays for the whole step | leaves after 2.4s |
| ends when | it has been read | the player does the thing |

The order is: name the mammoth · name the rock (frozen, so it can be looked at) · name
the JUMP button · **ask for a jump** · name the crevasse · name the blocks · **ask for a
cut**. Naming a thing before asking for it is the whole pattern; the button was once the
one place it was skipped, and the control was never introduced at all.

**Reading time comes from the sentence**, not a constant: `1.5s + 55ms/char`, clamped
2.6–5.2s. **There is no tap-to-advance** — a child taps because a finger is on the screen,
not to dismiss text, so honouring it would skip the instruction they were about to read.
Skip is the deliberate way out and it is a button.

**The highlight is a blur sheet with the focus lifted over it**, never a spotlight. Three
constructions were tried and rejected, and they are recorded because each looks more
reasonable than the one that replaced it:

1. a lit circle with a gold ring — an outline is a hard line drawn ON the artwork
2. a masked hole in the blur — needs the hole kept in step with a moving target, its rim
   inflated to keep the subject out of the blur, and its polarity is inverted from how it
   reads; all of that to arrive back at a lit circle
3. a rounded rectangle with a white hairline — a square stuck on the scene

What ships: a 30% sheet with a light blur over the whole stage, and the focus region
copied off the canvas and drawn on top with a long feather and no outline of any kind. A
DOM target (the JUMP button) is *raised* instead — `.tut-lift` — because copying its
region would lift a snapshot of the empty sky behind it and hide the control.

**The copy is taken once per step**, which is safe rather than lucky: every step that
shows the sheet has frozen the game. Per-frame would mean reading back from the canvas
sixty times a second.

**It runs every time.** A stored "seen" flag was removed: once set, the tutorial was
invisible with no way back to it from inside the game — a returning player, a second
child on the same browser, or anyone reviewing the build got dropped straight into
gameplay, and the feature was untestable by hand. `?tutorial=0` suppresses it, which is
what the suite passes.

**Rules.** It never completes the task, never blocks the input it asks for
(`pointer-events: none` on the layer throughout), and never leaks an answer — the block
step spotlights the whole row and its wording is about ropes and blocks, never about
which shape fits.

---

### 9f. The ending

The last crossing leads into `FINAL_RUN`, which now ends **where the friend stands**
rather than on a progress number, so the journey finishes somewhere instead of at an
arbitrary moment.

- `G.bearAt` is set **once**, in `onEnter`. Assigning it in the update branch is a
  treadmill: the target is recomputed from the current `worldX` every frame, stays a
  fixed distance ahead forever, and the run home never ends.
- The arrival gap is `CFG.mammothX + 265`. At 330 the bear ended up at screen x 327
  against a character standing at 430 — he had run past his own friend.
- `particles.confetti` throws 90 pieces across the whole width from above the frame,
  staggered by `delay` so it falls as a shower rather than one sheet. Each piece tumbles
  by squeezing its width on a cosine, the same trick the reward token used.
- The panel is **not a modal**: `.overlay-ending` clears the 42% navy wash and the 3px
  backdrop blur that `.overlay` gives every other panel. The ending exists to show the
  two of them together — dimming and blurring that is hiding the reward in order to
  announce it. Words at the top, `Play again` pinned to the bottom, middle band clear.

---

### 9g. Difficulty

**The jump.** The old window was about 0.2s: the apex was 295px and the bar 45% of a
140px rock, so the character was clear for 0.79s of a 0.887s flight — but the rock
crosses the danger zone in ~0.58s, and the difference is all the margin there was. Four
terms were loosened rather than one of them a lot:

| | was | now |
|---|---|---|
| `jumpVel` | −1330 (apex 295, air 0.887s) | −1470 (apex 360, air 0.98s) |
| clearance bar | 45% of rock height | 28% |
| body half-width | 68 | 52 |
| `bufferMs` / `coyoteMs` | 110 / 90 | 190 / 150 |

Measured after: **0.35s** of press window, from 330px out to 150px out.

**The rocks.** `jumpBefore` names six phases, and the count runs 2, 3, 4 then holds at
`maxRocks`. It is derived from `jumpBefore.indexOf(p.id)`, **not** counted up as
stretches happen: a counter inflates on a retry, because `retryObstacle()` returns to
`PHASE_RUN` and re-entering clears `phaseJumped` so the stretch spawns again — measured
going 1, 2, 3, 4 inside a single phase, which made failing a jump harder than the attempt
that had just beaten you.

---

### 9h. The phase zoom

`CFG.levelOne.zoomK` is 1.08, eased in on `PHASE_INTRO` and out when running resumes.

**The scale is the largest that keeps the puzzle on the stage, and the focus point is
solved rather than chosen.** Scaling by k about f maps p to `f + (p − f)k`, so everything
further from f than the frame edge moves out of frame. Rearranging that for the rightmost
block, the character and the water gives a permitted range for f, and the crossing centre
is clamped into it — see `viewFocus()`. Picking a nice-looking focus and scale instead is
what silently clips the sixth option in a six-option phase.

**Every DOM overlay must map through the published transform.** `view: {k, x, y}` goes out
on the HUD state, and `Hud.toView` and `Tutorial.toView` apply it. The verdict mark and
the hand hint are placed in stage coordinates over the crossing — the thing the zoom moves
furthest — and unmapped they drift off it. The tutorial maps only its **canvas-space**
targets: the JUMP button's box comes from a real DOM rect and is already in screen space,
so mapping it would move the one target that was right.

---

### 9d. The delivered character sheets

Reworked 2026-09-04. Four animations were delivered as 36-frame GIFs and the character
is now drawn from art in every state that matters, rather than from poses borrowed out
of the jump sheet.

| slot | what it is | where it plays |
|---|---|---|
| `run` | 36-frame cycle | distance-driven, `stride` sets the cadence |
| `jump` | 10 poses picked off the measured arc | `jumpMap` addresses them by name |
| `skid` | **new** | `SKID_STOP`, mapped across `breakSkid` (2300ms = its own 36 x 60ms) |
| `shake` | **new** | `SHAKE` at `tremorFps`, then `LOOK_DOWN` holds the final frame |
| `hurt` | **new** | `KNOCKOUT` and `HURT` |
| `idle` | **built, deliberately not loaded** | see below |

**One size, one foot line.** Every extent is measured across all sheets to pick ONE
scale, so the character cannot change size between animations, and every frame stands on
the same line — `slice-char.mjs` prints both and the `baseGap` it needs (27).

**No procedural shudder any more.** There used to be a sideways knock, a nervous roll
and a jelly squash applied on top of whatever frame was showing, plus a recoil-then-lean
double take. Its own comment said why it existed: *"because the fright has no art of its
own."* It has art now, and two performances of one beat fight rather than add — a sine
wave shoving the sprite sideways over a drawn reaction reads as the picture vibrating.
Removed. `scare` still decays and still drives the sweat beads and the gulp, which are
separate cues. The screen shake and the earthquake are camera moves, not character
animation, and are untouched.

**The idle sheet is held back on purpose.** `LOOK_DOWN` holds the last frame of the
delivered fright — the pose the character has just arrived at — and swapping that for a
neutral breathing loop discards the reaction the learner watched. It is also not listed
in `sheets`, because a listed sheet is fetched: 1.5MB on every load for something
nothing draws. To turn it on: add the line back, add `idle: 36` to `frames`, and
uncomment the branch in `LOOK_DOWN`.

**One grid per slot.** The superseded `skid-gif.png` was deleted rather than kept as a
previous take: two grids for one slot differing only by a suffix is how frames from two
deliveries end up merged into one sheet.

**Known trade: the knockout's outer star ring is clipped.** Keeping it needs a padded
frame box, and a padded box immediately becomes the largest frame in the set, so the one
shared scale collapses and the character comes out smaller in every other sheet too
(measured: body 74..303px became 107..250, `baseGap` 25 became 76). The dazed sit, the
spiral eyes and the inner stars survive, and `near: 200` on that sheet is what keeps
them. Fixing it properly means a larger cell for every sheet.

---

### 9b. The cartoon sound layer

Added 2026-09-04. Two new synth voices, and seven cues built on them. All synthesised —
nothing new to download, and the file:// build keeps every one of them.

| voice | what it does |
|---|---|
| `_warble(freq, dur, gain, type, slide, depth, rate)` | a second oscillator drives the first one's FREQUENCY, so the pitch itself shakes. This is what a boing is. |
| `_slide(from, to, dur, gain)` | a tone gliding between two pitches with a breath of noise tracking it — the noise is most of why it reads as a whistle rather than a synth sweep. |

| cue | where |
|---|---|
| `boing` / `boingDown` | under the delivered whoosh on take-off, under the delivered impact on landing |
| `sproing` | after `bonk` — it bounces off the rock |
| `skid` | the frame the feet start losing the fight at the edge |
| `slideDown` | a WRONG chunk beginning its fall |
| `bloop` | a chunk arriving on its rope (`pop` is now this) |
| `wobble` | folded into `gasp` — the knees going when the ground fails |

**The rule that decides where a comedy cue may fire.** It lands on the WORLD and on the
CHARACTER — jumps, bumps, wobbles, things falling in water — and **never on the learner
being wrong**. A sad trombone on a wrong answer is the obvious cartoon joke and it is the
one cue this game must not have: the child is the one who was wrong, and a laugh at that
moment is a laugh at them. `reject()` stays the soft two-note nudge it has always been,
and `slideDown` is a joke about a lump of ice belly-flopping, not about the answer.

**Layered, never substituted.** Every delivered recording still plays. `jump()` fires the
boing and then the whoosh, so the jump sounds like a heavy animal leaving the ground AND
like a cartoon. The one replacement is `pop` → `bloop`, both synthesised.

Measured live with the audio graph tapped: 28 cues, none silent, no errors; the music bed
running and looping.

---

### 9c. Sound off the disk

The game is meant to run by opening `index.html`, and until now that build had **no music
and none of the six delivered recordings** — silently, with nothing logged to say why.

Both came from the same assumption. `ctx.createMediaElementSource()` and
`fetch` + `decodeAudioData` genuinely do not work on a `file://` page, so both were
skipped there. But neither is required to play a sound: an `<audio>` element loading a
file next to the page plays perfectly well. The AudioContext was only ever there to give
the bed its own fader and to let a cue be sliced sample-accurately.

| | over `http://` | off the disk |
|---|---|---|
| music | routed through a gain node on the master bus | the element plays directly; `_musicTo()` steps `el.volume` instead |
| recordings | decoded once, sliced with `start(t, at, dur)` | one `<audio>` per cue, seeking to a baked hit, stopped on a timer |
| onsets | found at load from the waveform's energy | read from `SFX_HITS`, baked by `tools/bake-onsets.mjs` |

`SFX_HITS` sits between `/* BAKED-ONSETS-START */` and `/* BAKED-ONSETS-END */`.
Regenerate it whenever an audio file changes:

    node tools/bake-onsets.mjs && node tools/build-bundle.mjs

**One element per cue, not a pool.** Three elements pointed at one `src` start three
concurrent loads of the same file, and the browser resolves that by ABORTING the
redundant ones — a real failed request each time, which the disk-build test rightly
refuses to pass with. Overlap is worth little here: the cue that repeats quickly is
footsteps, which are sequential anyway.

**What the disk build gives up:** per-play pitch jitter (an element's `playbackRate`
shifts pitch, which is a different effect), sample-accurate scheduling, and overlapping
repeats. What it gains is the delivered sound instead of none.

Verified off the disk: music playing at 0.17, all six recordings seeking to their baked
hits, no page or console errors. Verified over http: all six still decoded and played
through the graph, unchanged.

---

### 9a. The impact layer — hit-stop, punch, tokens

Added 2026-09-04. The comedy layer above is about the CHARACTER; this is about what
happens to the frame in the ~150ms around an impact, which is where a platformer's
feel actually lives. Three primitives, all in `CFG.juice`:

| primitive | what it does | fires on |
|---|---|---|
| `hitStop(ms)` | stops the simulation dead, rendering continues | wedge 62ms · splash 44ms · rock 96ms · ice breaking 110ms |
| `punch(amp, ms, x, y)` | scale pulse about the impact point, snaps to full then eases out | wedge 1.8% · rock 2.6% · break 3.0% · crossing sealed 2.2% |
| `particles.ring` | one expanding hoop on the impact frame | every correct answer |

One new sound goes with them: `prize()`, a rising phrase ending held, when a whole
crossing closes. It is the only place it plays.

**No pickup tokens.** A spinning gold coin leaping out of each correct answer, with a
two-note pickup ding, was built and then removed on request. Recorded here so it is not
re-proposed: a collectable implies a score, a score implies a counter, and §5 says this
game has no HUD to put one in — and it placed the only warm-yellow object in the world
on top of the learner's answer at the moment the answer is the thing to look at. The
reward beat is the glints, the frost, the thud and the sound, all of which already
belong to the ice.

**Rules for this layer.**

- **`CFG.juice.stopMax` is a hard ceiling (130ms).** `hitStop` takes the max of the
  current hold and the new one and clamps — so no caller, and no two events landing on
  the same frame, can stall the game. A hold consumes real `dt`, so it always ends.
- **Hit-stop is not pause.** Pause halts rendering as well and is a player control;
  this halts only time. The gate is the first thing in `update()`.
- **Nothing here is allowed past 3%.** Beyond that the punch pulls the world in from
  the letterboxed frame edge and the border shows.
- **All of it is off under `?reduced=1`.** `hitStop` and `punch` return immediately;
  the rings are not spawned.
- **It never decides anything.** No hold, punch or ring is conditional on which shape
  was cut beyond right/wrong, and none of them is drawn on a hanging option.

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

## 11. The feedback round — what changed and why (September 2026)

Ten client items, worked in this order. Each is a rule now, not a preference.

### The pointer, and where to cut

- **The canvas shows an arrow, and the browser's own hand only over a rope that can be
  cut** (`main.js`, `.stage.on-rope`). A hand shown everywhere says nothing; the
  scissors cursor that preceded it was a DOM follower on its own rAF loop that touch
  players never saw. `cursor: pointer` is what every player already knows means "this
  does something".
- **The cut guide is thin gold dashes with a soft glow, 60 px above each block**
  (`drawCutGuide`). Same height as the tutorial hand (`Tutorial.ropeBox`), so hand and
  guide agree. Dashes with butt caps — round caps turned 17 px dashes into 28 px
  capsules. Gold because white was measured invisible against the sky. Every rope gets
  one, so the marks can never hint at the answer.

### The tutorial highlight

- **The subject glows along its own outline** — nothing behind it comes with it.
  `game.renderFocus(canvas, kind)` re-draws one subject alone (character, rock, gap or
  block row) onto `#tut-focus`, and the stylesheet glows that canvas by its alpha. Contact
  shadows, fog, halos and vapour are switched off for the focus render (`bare`/`only`
  flags) because each is a soft alpha shape that would glow as a shape. The JUMP button,
  a DOM element, is lifted (`.tut-lift`) and given the same glow. A copied rectangle of
  the game canvas was the previous construction and it brought the sky with it.
- **One hand on screen, ever.** `Hud.updateHand` yields to the tutorial hand whenever the
  tutorial layer has one up.
- **The dialogue box is a cartoon panel:** navy keyline, amber inner rim, a snow cap made
  of repeating radial gradients, a gloss highlight, and a tail outlined in the same navy
  (`paint-order: stroke fill`).

### Confetti, not marks

A right answer showers confetti across the stage (`particles.confetti(CFG.W, 64)`); the
whole-phase mend showers more; the crossing sealing adds a little. **There is no tick
and no cross** any more — `#verdict`, `.verdict`, `check.svg` and `wrong.svg` are gone.
A wrong answer keeps only the world's response (the whistle, the splash, the character).
No star glints in a celebration either: confetti was the ask.

### The gap

- **The hole has a mouth and a throat.** The plug is capped by the cavity (a piece lands
  at the size it was cut, see §10, and the cavity is 234 px), so a straight-walled hole
  could never be wider than ~243. The walls now step in: the MOUTH — the visible cut in
  the platform — is `L1.mouth` (1.6) times the plug width, and `L1.throatDepth` (36 px)
  below the walking line the walls reach the THROAT, plug width minus `bearing` (0.03),
  where the answer wedges — its top FLUSH with the platforms. The shoulders between mouth
  and throat are closed by an ice collar drawn behind the plug (`drawCrossingCollar`);
  there is no deck and no snow band over the answer any more. Phase 1: throat 229, mouth
  ~298. The curriculum test asserts the piece spans its share of the throat and the mouth
  is wider than it. Phase 1 now: throat 229, mouth ~366.
- **Two polygons in one ditch.** Phases 6 and 7 have three answers and two ditches: the
  extra answer goes to the last ditch, which is twice as wide at the throat and bridged
  by two pieces side by side (`share` in `layoutPhase`).
- **The walls are the platform's own stone.** `rock-band.webp` (the sheet's stone base)
  is tiled down each side inside the hole with a jagged inner edge and darkens with
  depth (`GroundManager._wallArt`); the carved caps sit at the lips above it.
- **Rocks are 80% of the delivered size** (`CFG.obstacle` 112/184) — a shorter hop.
- **Shapes hang higher** (`optionY` 470): long ropes over the crossing, as in the reference.
  `ditchGap` 120 → 150 makes a three-hole stretch read longer.
- **The lips are carved ice from the supplied platform art** (`GroundManager.drawCap`,
  `cap-l.webp`/`cap-r.webp` cut from `art-source/sheets/pathui.png`): snow top on the walking line, ice
  band and rock base scaled to the path's own face height, inner edge faded into the
  tile, face reaching 8 px into the hole. `brokenEdge` remains only as the fallback
  before the art loads. **Collision is unchanged**: the hole is still `_ditchPath`; only
  the picture of its edge changed.

### Obstacle spacing

`CFG.obstacle.runRoomS` 1.2 → 3.4 s: about 2280 px between rocks instead of 1134. Each
rock is its own event with a run between; `PHASE_RUN` waits for the last rock, so no
stretch is cut short.

### Not done, and why

- **"Tribbling" (item 4)** — `tribble.png` in Downloads is a bear-cub sheet (run, skid,
  look down, tremble). It is a second character, not an effect. Slotting it in is a
  character-roster task (`CFG.characters`, `tools/slice-char.mjs`) and needs the brief to
  say whether the bear is playable or the friend at the end.
- **A cartoon post-process (item 3)** — not applied; the comedy layer is `CFG.juice`.
  A whole-frame stylisation is the one thing most likely to eat the readability of the
  hanging shapes, which is the game.

### The sound kit (item 5)

The supplied kit lives in `tools/sound-kit/` (API.md, calibration, fetch/measure/verify
tools, soundboard) and ships as `game/js/sfx.js`, a classic script loaded on both
schemes before the game. `AudioManager.kit(name, opts)` plays a kit cue and returns false
when the kit is absent, so every call site falls through to the local palette:

| game event | plays |
| --- | --- |
| walked into a rock | `bonk` |
| rope cut | `slice` |
| wrong chunk hits the water | `splat`; the fall is `fallingWhistle` |
| wrong answer | `wrong` — never `sadTrombone` (this game does not laugh at the learner) |
| right answer | `correct`, pitch rising with the streak; phase done → `levelUp` |
| chunk arrives on its rope | `bubble` |
| boings, missed-jump whiff, glints, prize, rock tick | `boing`, `swoosh`, `sparkle`, `gem`, `tick` |
| landing / UI tap when the recordings are unavailable | `land`, `click` |

The six delivered recordings stay primary and are never layered with a kit cue. Voice
cap 3, pitch jitter on every shot, key `C pentatonic`, kit master 0.5 to match the
game's bus; the sound toggle mutes both contexts. Music ducking stays in the engine.

### The ending (item 10 polish) and the comic voice

The card in the sky is gone. The friend SPEAKS the ending: a `.win-bubble` in the same
cartoon construction as the tutorial box, tail on the bear, holding a title that bounces
letter by letter, a count that climbs as seven gold coins land — each embossed with the
verified ring of the shape that mended that crossing (`Hud.showWin`, from the engine's
`mendedKinds`) with a coin sound per stamp — and three sparks. Confetti drizzles for as
long as the screen is up (`COMPLETE` in `update`). Play again stands on the ice to the
right of the two friends and glows without moving (a filter animation, so it is still a
stable target).

The kit's master is 0.85 so the comedy leads the mix. The character's gags run on the
kit's comedy voices — squeak (gasp), honk (trunk toot), cuckoo (double-take), ratchet
(knocking knees) — and a rock coming into range plays `anticipate`. Each tutorial bubble
pops (`popIn`) as its words change; the pop animation now actually restarts on every
sentence (it compared the text after writing it, so it only ever fired once).

### A performance rule learned the hard way

`.tut-focus` is a full-stage canvas with a drop-shadow glow. Animating that filter meant
re-blurring 1920×1080 of alpha every frame; on a software renderer the whole game ran at
1.7 fps while a tutorial step was up (found by the file:// test, which drives the game
with the tutorial on). The glow is static now — 29.9 fps on the same renderer. Rule: never
animate a filter on a stage-sized element; animate filters only on small ones.

### Impacts, stars, rubble, a constant thud

- **Poofs.** Every impact throws a cartoon cloud (`particles.poof`): four overlapping white
  discs with a soft blue rim, swelling as they thin, drifting up. Take-off, landing, skid
  stop, the plug arriving, the crash (big), each footfall (tiny). `snowPuff` remains for
  actual snow.
- **Dizzy stars** circle the head in the knockout (`koStars: true`, `drawDazeStars`) — the
  drawing was there; the character config had it off.
- **The fit sound is the same every time.** `wedge()` leads with the kit's synthesised thud
  and layers the recording under it when decoded; before, a half-loaded recording fell
  back to a different synth sound. `game.warmAudio()` starts decoding at boot.
- **Rubble** from the sheet sits on each shoulder of an open crevasse (`rubble-1/2.webp`).

### The SFX audit (asked for twice)

Every cue was traced from its trigger to the speaker. Two faults, both fixed:

1. **The fit sound swapped voices.** `wedge()` played the recorded thud once decoded and a
   synth stand-in before that, so the first right answer of a session sounded different
   from the rest. It now leads with the kit's synthesised thud every time and layers the
   recording under it when ready; `game.warmAudio()` starts decoding at boot.
2. **`setDuck` ducked the effects, not just the bed.** It scaled the master to 80% for the
   whole of a puzzle while the kit stayed at 100%, so the same cue sat at two levels in
   two states. The master is fixed at 0.7 now (up from 0.5, so the recordings sit under
   the kit's 0.85 rather than vanishing) and only the music ducks; disk-build cue elements
   no longer multiply by the duck either.

Checked and sound: `bonk()` has two call sites but they are mutually exclusive (the
three-strike branch returns); jump/land/step/skid/slice/reject/splash/success each fire
once from one place; kit cues fall back to the local palette only when the kit is absent.

### The undercut, the far wall, the swirl, the sky

- **The crevasse is undercut.** The opening at the surface — the neck — is exactly the plug's
  width (`g.throat`); from `throatDepth` the walls curl out to the void, 1.6× wider. So the
  gap reads big (a wide dark chasm under overhanging lips) and the answer's flat edge spans
  the opening exactly, resting on the lips, seated 9 px proud (`PLUG_SINK = -9`) so its edge
  covers the neck's shallow chew (`-9..-2`). Nothing is drawn over or around it: the deck,
  the snow band, the ice collar and the shoulder rubble are all gone. The caps stand at the
  neck lips.
- **The interior has a far wall.** The rock band is tiled across the whole hole
  (`_backArt`), pulled back into the blue and darkening with depth, under the snow
  overhang's shadow, with mist off the water; the side walls sit in front, brighter. A flat
  gradient between the walls was the "cut-out" look.
- **The dizzy swirl** is a running dashed loop over the crown with four fat keylined gold
  stars, riding it bigger in front and smaller behind, popping in once he is sitting.
- **Day to night.** `light()` lit the scene from the *destination* sky on the first frame of
  a crossfade (it read `index`, which moves at fade start) — a visible pop at dusk→night.
  It now lights from the outgoing sky and crosses with the picture; the fade is 4.2 s.
