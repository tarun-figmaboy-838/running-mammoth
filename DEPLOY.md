# Deploying to Vercel

The game is static: HTML, CSS, ES modules and assets, no build step and no server. So
the only thing a deploy has to get right is **which folder is the site root**, because
the game lives in `game/` and everything else in the repo is tooling.

## The setting that matters

In the Vercel project, set:

| | |
|---|---|
| **Root Directory** | `game` |
| Framework Preset | Other |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |
| Install Command | *(leave empty)* |

That serves `game/index.html` at `/`, the modules at `/js/…` and the art at
`/assets/…`, and `game/vercel.json` supplies the headers. Nothing outside `game/` is
uploaded, so `tools/`, `tests/`, `art-source/` and `node_modules/` are excluded by the
root directory alone.

There is no build step to configure. Do not set one — an empty build command is
correct for a static folder, and adding `npm install` would only pull in Playwright and
sharp, which are development tools.

## If Root Directory is left as the repo root

It still works. The root `vercel.json` rewrites `/` to `/game/index.html`, and
`.vercelignore` keeps the tooling out of the upload. The URLs are uglier
(`/game/assets/…`) and the two config files have to stay in step, which is why `game`
is the recommended setting.

**Both files are kept on purpose.** Vercel reads `vercel.json` from whichever folder is
the root directory, so exactly one of them is ever in effect — and neither setting can
produce a broken deploy.

## Why the headers are split

- **`/assets/*` is immutable for a year.** The art never changes under a fixed name; a
  new sheet is a new deploy. This is the whole cache win, and it is most of the bytes.
- **`/js/*` and `*.html` must revalidate.** They are small, and a stale `engine.js`
  against fresh `option-shapes.js` is exactly the kind of mismatch that shows up as
  shapes rendering with the wrong material. During development this bit repeatedly:
  a long-lived browser tab kept serving an old `engine.js` and the options looked
  half-broken when the files on disk were fine.
- The explicit `Content-Type` on `/js/*` is not decoration. Browsers refuse an ES
  module served as anything but a JavaScript type, and the failure mode is a silent
  blank page.

## First deploy

```bash
git init
git add -A
git commit -m "Ice Age polygon runner"
# then either
vercel --cwd game
# or push to GitHub and import the repo, setting Root Directory to `game`
```

## Checking a deploy

The game needs a server, so `file://` cannot be used to test it — modules are blocked
and the page stays blank. Against a deployed URL, the things worth confirming are the
ones that only break in production:

1. `/` loads the cover, and PLAY starts a run.
2. The network panel shows no 404s, and `/js/engine.js` arrives as
   `text/javascript`.
3. The character animates — a missing sprite sheet is a silent 404 that leaves only a
   shadow on the snow.
4. A phase completes: the instruction sign, the hanging ice blocks, one cut, and the
   crossing sealing.

`npx playwright test` covers all of that locally against `tools/serve.mjs`; it is the
same code path a deploy serves.
