# Frozen Rush

A browser game that teaches polygon recognition by side count. A mammoth is stopped by a
crevasse in the ice; glacier-ice blocks hang on ropes above it; you **swipe across a rope**
to cut one, and the right shape wedges into the hole and mends the path. Seven phases.

No dependencies, no build step to play. **Open `game/index.html`** — it works straight off
the disk as well as over HTTP.

```
node tools/serve.mjs      # then http://127.0.0.1:8123/index.html
npx playwright test       # the full suite, two viewports
```

## Where things are

Two rules explain the whole layout:

**1. `game/` is the website.** Everything in it is fetched by a URL at runtime, and
nothing else is. That is what makes it safe to point a static host straight at it —
Vercel's Root Directory is set to `game` (see [docs/DEPLOY.md](docs/DEPLOY.md)).

**2. Anything a *tool* reads but the *game* never fetches lives in `art-source/`.**
Delivered artwork, un-sliced sprite sheets, GIFs, raw button renders. It stays in the
repo because the builds need it, and it stays out of `game/` so it cannot ship.

```
game/                 THE SITE — only what a URL fetches
  index.html
  css/                style.css (in-play) · screens.css (cover, cards, buttons)
  js/                 engine.js is the whole game; main.js boots it, hud.js owns
                      the DOM outside the canvas, polygons.js + option-shapes.js
                      are the shape data. game.bundle.js is generated — see below.
  assets/             audio · char · env · option-shape · sky · ui  (15MB, all served)

art-source/           BUILD INPUTS — never deployed (78MB)
  option-shape/       the 14 delivered blocks, as PNG  -> game/assets/option-shape/*.webp
  char-sheets/        un-sliced character sheets       -> game/assets/char/mammoth-*.webp
  gif/                the delivered GIFs               -> char-sheets/
  original-upload/    everything as it first arrived
  *-raw.png           button art before tools/make-buttons.mjs

tools/                one-shot generators and the dev server. Every file says at the
                      top what it consumes and what it writes.
tests/                Playwright, run against the real engine through its debug hooks
docs/                 ANIMATION.md · ANIMATION-BRIEF.md · DEPLOY.md · QA-REPORT.md
drafts/               level-2.draft.js — a parked brief, not wired to anything
RUNNER.md             THE CONTRACT. Read this before changing gameplay.
```

Not in git: `node_modules/`, `test-results/`, `playwright-report/`, `qa-report/`, and
`art-source/char-sheets/*-gif.png` (regenerable from the GIFs — the command is in
`.gitignore`).

## The two generated files

Neither is edited by hand, and a test fails if either drifts from its source.

| generated | from | rebuild |
|---|---|---|
| `game/js/game.bundle.js` | the six modules in `game/js/` | `node tools/build-bundle.mjs` |
| `game/js/option-shapes.js` | `art-source/option-shape/*.png` | `node tools/build-option-shapes.mjs` |

The bundle exists for one reason: a browser fetches an ES module with CORS even from a
`file://` page, which `file://` refuses — so opening `index.html` off the disk gave a
blank screen. Over `http://` the modules load as normal and the files in `js/` stay the
source of truth; the bundle is only used for `file://`. `index.html` picks by protocol.

## Before changing gameplay

[RUNNER.md](RUNNER.md) is the written contract — the curriculum, the slot model, the
fixed things a level brief must not fight, and what the tests will hold you to. It is
kept current, and it is the right place to look first.
