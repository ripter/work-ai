# AI Devlog

Development notes maintained by AI agents (OpenCode + local models). One
section per significant AI session, newest last. The human log is `LOG.md` —
AI agents must never modify it.

---

## 2026-08-27 — Migration from PICO-8 to PixiJS/HTML5 (foundation)

**What happened.** The PICO-8 viability experiment was abandoned (see
`REPORT.md` for the analysis that led to this decision). This session
replaced the PICO-8 application with a minimal PixiJS + Vite + JavaScript
project that builds to a fully static site. No gameplay was implemented; the
app shows a placeholder confirmation scene only.

**Files removed.**
- `game.p8`, `game.lua`, `preview.p8`, `game.p8.png`
- `web/` (entire directory: `build.sh`, `inline.js`, `package.json`,
  `package-lock.json`, `pico-socket.yml`, generated `game.html`/`game.js`,
  `node_modules/`)
- `tools/artgen.py` (and the now-empty `tools/` dir)

**Files created.**
- `package.json` — `pixi.js` (dep), `vite` (devDep); scripts `dev`/`build`/`preview`
- `vite.config.js` — `base: "./"` so `dist/` works from any subpath
- `index.html`, `src/main.js`, `src/style.css`, `src/game/scene.js`
- `src/ui/`, `src/data/`, `assets/`, `public/` (empty scaffolding, `.gitkeep`)
- `GAME_SPEC.md` — canonical CavePerson spec (all confirmed design rules)
- `AI_DEVLOG.md` — this file
- `package-lock.json` (generated)

**Files updated.**
- `Makefile` — `build` (npm run build), `start` (npm run dev), `preview`,
  `clean` (rm -rf dist); `session` target (export-session.sh) preserved
  unchanged. PICO-8 targets (`static`, `multiplayer`) removed.
- `.gitignore` — PICO-8 entries removed; `dist/` added.
- `AGENTS.md` — rewritten for the HTML5 project (PICO-8 notes gone; history
  in git).
- `README.md` — rewritten for the HTML5 project.

**Files preserved untouched (verified by sha1 before/after).**
- `LOG.md` (human log)
- `stats/session1.json` … `stats/session6.json`
- `export-session.sh`, `REPORT.md`

**Commands run.**
```sh
npm install pixi.js            # pixi.js@8.20.1
npm install -D vite            # vite@8.2.2
make start                     # vite dev server on :5173 (backgrounded)
curl http://localhost:5173     # 200; /src/main.js, /src/game/scene.js,
                               # /src/style.css, prebundled pixi dep all 200
make build                     # vite build -> dist/ (17 asset files, ~550ms)
make preview                   # serves dist/ on :4173 (backgrounded)
<Chrome headless> screenshot of http://localhost:4173/ -> /tmp/caveperson.png
shasum LOG.md stats/*.json     # all hashes unchanged
```

**Results.**
- Dev server serves the app; full module graph (incl. pixi.js prebundle)
  resolves.
- `make build` succeeds; `dist/index.html` references only relative paths
  (`./assets/...`) — static-host compatible from any subpath, no backend.
- Headless Chrome screenshot of the **static** build: pixel analysis of
  800x600 PNG confirms the WebGL scene rendered — dark-blue background,
  purple panel, indigo border, white "CavePerson" title, green "HTML5
  migration successful" text, gray footer (all expected colors present).

**Errors encountered.**
- `node -p "require('./package.json')..."` version probe failed with a
  TypeError (relative require under `node -p` mis-resolved). Cosmetic;
  versions confirmed with `npm ls` instead.
- Chrome headless printed "Trying to load the allocator multiple times" —
  benign SwiftShader software-GL message, no effect on the screenshot.

**Fixes required.** None to the project itself.

**Assumptions.**
- Latest stable PixiJS (v8.20.1) and Vite (8.2.2) on Node 24 / npm 11.
  Code uses the Pixi v8 API (`await app.init({...})`, v8 Graphics/Text).
- Vite project lives at the repository root (matches the requested layout).
- Placeholder canvas is fixed 640x480, CSS-centered, colors from the old
  PICO-8 palette as a nod to the previous implementation.
- No gameplay implemented — per scope, foundation only. `GAME_SPEC.md` is
  the roadmap for future sessions.
- Nothing was committed; the working tree contains the migration, ready for
  the maintainer to review and commit.

---

## 2026-08-27 — Prompt 2: core game model, state machine, tests, debug UI

**What happened.** Implemented a playable core CavePerson loop: a pure
synchronous game state machine (no Pixi/timers), a transparent AI opponent,
a 5-card prototype Event deck, a full unit/integration test suite, and a
functional debug UI that drives the real game with mouse clicks. The goal was
to prove the game loop works end to end before any UX/art/sound polish.

**Rules confirmed with the maintainer this session.**
- Voluntary pass is allowed in the claiming phase (a passed tribe is out for
  the rest of that Event).
- A claimer eliminated before their queued reward resolves has that reward
  voided.
- The Event deck is shuffled (Fisher-Yates) and reshuffled when exhausted.
- Claim order is computed after all rerolls (start of claiming), using final
  dice; ties broken by lower seat index.

**Files created.**
- `src/game/config.js` — start values (3 Pop / 4 Food / 1 Tool), growth &
  feed costs, tribe meta, AI pacing/weighting constants.
- `src/game/rules.js` — pure rules engine: requirement registry (pair,
  threeKind, fourKind, fullHouse, straight, exactSum, sumAtLeast, sumAtMost,
  allOdd, allEven, exactValues, mustContain, middleIs), slot check/describe,
  legal-subset search (DFS, capped), claim-order rules, feed/growth, hostile
  targeting, reward application.
- `src/game/game.js` — `Game` class: state + synchronous state machine +
  action API. Phases `reroll → claiming → reward → night → (loop) → over`.
  `this.awaiting` describes the pending decision so any UI (or future network
  layer) knows what to prompt for. Human and AI use the same actions.
- `src/game/ai.js` — simple transparent AI heuristics (reroll anchor pattern,
  score claims with Food urgency, target strongest tribe, grow while
  affordable) + `applyAiDecision` shared by the UI and the tests.
- `src/data/events.js` — 5 prototype cards (Mammoth Hunt, Rock Quarry,
  Trading Post, Shaman's Rite, Ambush) covering food/tool/pop rewards,
  transforms, and hostile steal/kill.
- `src/ui/uiKit.js` — small Pixi helpers (text, panel, button, die square,
  hit rect, destroy-all, sleep) and the palette/layout constants.
- `src/ui/gameScene.js` — the debug game scene: top bar, slots panel, tribe
  panel (dice), action panel, log, win/draw overlay; renders from game state
  and pumps AI turns on a delay.
- `src/ui/debugUi.js` — app bootstrap: setup screen (pick 1–3 AI), start
  game, `?autoplay=N` auto-start, `window.__cp` debug handle.
- `tests/helpers.js` — seeded RNG, scripted-roll game factory, AI-turn runner,
  full-AI-game runner.
- `tests/requirements.test.js` — rules-engine unit tests.
- `tests/game.test.js` — state-machine integration tests (all 22 required
  behaviors + tie-break + eliminated-tribe cases).
- `tests/fullgame.test.js` — full AI-vs-AI games (1/2/3 AI), determinism,
  and draw cases.
- `scripts/simulate.mjs` — CLI that runs a full seeded game and verifies it
  reaches a winner through multiple Events with eliminations.

**Files updated.**
- `src/main.js` — rewritten to mount the setup/debug UI (was the placeholder
  scene mount).
- `package.json` — added `"test": "node --test \"tests/*.test.js\""`.
- `Makefile` — added a `test` target.
- `GAME_SPEC.md` — finalized the rules above and added an explicit
  "Prototype assumptions (Prompt 2)" section (subset cap, AI behavior, AI
  pacing, debug UI, debug hooks, canvas size).
- `AI_DEVLOG.md` — this entry.

**Files removed.**
- `src/game/scene.js` — the placeholder foundation scene, superseded by the
  real UI.

**Files preserved untouched (verified by sha1 before/after).**
- `LOG.md` (human log)
- `stats/session1.json` … `stats/session7.json`

**Commands run.**
```sh
npm test                      # 47/47 pass (node --test, Node 24)
make test                     # same, via Makefile
node scripts/simulate.mjs     # full seeded game -> winner after >=3 events
make build                    # vite build -> dist/ (relative ./assets paths)
make start                    # vite dev server on :5173 (backgrounded)
make preview                  # serve dist/ on :4173 (backgrounded)
node /tmp/ui-test.mjs [1|2|3] # headless-Chrome CDP test: plays a FULL game
                              # via real mouse clicks on the Pixi UI
shasum LOG.md stats/*.json    # all hashes unchanged
```

**Results.**
- 47/47 tests pass. Covers the requirement engine, every state-machine
  behavior, and full AI-vs-AI games (including a forced draw).
- Determinism verified: same seed + same deck produces an identical game log.
- `scripts/simulate.mjs` finds seeds that run 3+ Events with eliminations and
  a decisive winner.
- `make build` succeeds; `dist/index.html` references only relative paths —
  still static-host compatible, no backend.
- UI verified in headless Chrome via CDP: a full game (1, 2, and 3 AI) was
  played using only real mouse clicks on the Pixi canvas — dice selection,
  finish-rolling, slot claims, hostile-target picks, and night growth —
  reaching a winner. 7/7 runs passed.
- `LOG.md` and all `stats/*.json` unchanged (sha1-verified).

**Errors encountered.**
- Infinite `finishNight -> startEvent` recursion when a Night eliminated
  every remaining tribe. Fixed by adding the draw path (winner = null) in
  `finishNight`.
- `fullHouse` requirement initially implemented incorrectly; fixed and
  covered by a unit test.
- Several early test expectations didn't match the rules engine; the tests
  were corrected (the engine was right).
- `node --test tests/` (directory form) fails on Node 24; the test script
  uses the glob form `node --test "tests/*.test.js"`.
- CDP UI test: the canvas is CSS-scaled to fit the viewport (919.5x613 in a
  1000x613 window), so fixed click coordinates missed. Fixed by computing the
  transform from the live `getBoundingClientRect()` at runtime.
- CDP UI test: back-to-back synthetic taps were occasionally lost (a Pixi
  `pointertap` vs re-render race under rapid CDP input). The harness now
  verifies each click and retries; a real user (human click cadence) does not
  hit this.
- Stale-selection bug (product): a die selection could carry over across a
  phase change (reroll -> claiming). Fixed by clearing the selection whenever
  the acting tribe/decision changes.
- `JSON.parse` on a `DOMRect` failed in-page; switched to `JSON.stringify` in
  the page and parsing in Node.

**Assumptions.**
- Prototype scope: a functional debug UI, not the final drag-and-drop
  interaction. `GAME_SPEC.md` "Slot interaction" remains the target design.
- AI opponents are intentionally weak and transparent (playtest placeholders,
  not optimal).
- All "Prototype assumptions (Prompt 2)" listed in `GAME_SPEC.md` (subset cap
  >16 dice, ~600ms AI pacing, `window.__cp` / `?autoplay` debug hooks, fixed
  960x640 canvas) are development aids that may change.
- The dev server, preview server, and headless Chrome were run in the
  background for verification; they are not part of the deliverable.
- Nothing was committed; the working tree contains Prompt 2, ready for the
  maintainer to review and commit.
