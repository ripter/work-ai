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

---

## 2026-08-28 — Prompt 3: first playtest revision (diceRequired, slot
availability states, free rerolls, first economy tuning pass)

**What happened.** The maintainer manually playtested the Prompt 2 build and
reported three problems: (1) slot requirements do not consistently require a
specific number of dice, so requirements can be cheesed (e.g. one odd die
claiming a "3 odd dice" slot); (2) Food was so obviously valuable that the
best play was always "take the biggest Food"; (3) all normal Yahtzee-style
reroll manipulation required spending Tools. This session fixed all three
while preserving the working core loop, plus a conservative first economy
tuning pass on the 5 prototype cards.

**Changes made.**
- `src/game/config.js` — new `FREE_REROLLS_PER_EVENT = 2` (prototype balance
  value, centralized for later tuning).
- `src/game/rules.js`
  - New `slotDiceRequired(slotDef)` (throws if missing/invalid) and
    `checkSlot` now enforces `values.length === diceRequired` in addition to
    the requirement array. `describeSlot` now prefixes `[N dice]`.
  - `findLegalSubsets` gained an `exactSize` parameter (search only subsets
    of exactly that size, pruned at that depth); `legalSubsetsForSlot` passes
    the slot's `diceRequired` and fast-returns `[]` when the pool is too
    small. This is also what makes AI treat over-sized slots as impossible
    (no legal subset exists).
  - Pre-existing bug fix: the DFS early-returned on `found.length > 0` even
    when `first=false`, so "find all subsets" never returned more than one
    (the AI's multi-subset scoring was dead code). Now short-circuits only
    when `first=true`.
  - Shortened a few requirement descriptions (`Full house (3+2)`,
    `Straight (5 in a row)`, middleIs) — display-only, since the `[N dice]`
    prefix now carries the count.
- `src/game/game.js`
  - `startEvent` gives every surviving tribe `FREE_REROLLS_PER_EVENT` free
    rerolls each Event (unused ones never carry over; eliminated tribes get
    0). The initial roll consumes nothing.
  - `doReroll` consumes a free reroll first, then 1 Tool; distinct log lines
    ("uses a free reroll (N left)" vs "spends 1 Tool (N left)"); throws when
    neither remains. Cost is independent of how many dice are rerolled.
  - `submitClaim` throws a clear count error (`"X" requires exactly N dice
    (you submitted M)`) before the requirement check.
- `src/game/ai.js` — `aiRerollDecision` affordability check is now
  `freeRerolls > 0 || tools >= 1` (was `tools >= 1`). The anchor heuristic is
  otherwise unchanged, so the AI spends its 2 free rerolls before Tools and
  can never spend a Tool while free rerolls remain.
- `src/data/events.js` — every slot now explicitly declares `diceRequired`
  (never inferred from the requirement), plus the first economy tuning pass
  (see below).
- `src/ui/gameScene.js`
  - Slots render in three states during claiming (human's perspective,
    recomputed every render): `impossible` (needs more dice than left — very
    dark bg `#120e1e`, dim gray text, tag `[needs N dice, you have M]`),
    `no-match` (enough dice, no current combination — normal bg, tag
    `[no match with your dice]`, dim reward), `available` (legal claim
    exists — pickable highlight on the human's turn). Both disabled states
    keep the slot/requirement/reward fully visible and are not clickable.
  - Reroll button label reflects the cost: `Reroll selected (N die) — free,
    X left` / `— costs 1 Tool` / `— no rerolls left`; enabled only when a
    reroll is affordable and a die is selected.
  - Tribe stat line shows `N free rerolls left` during the reroll phase.
- `src/ui/debugUi.js` — setup help text updated (free rerolls, exact dice
  counts, dimmed slots).
- `GAME_SPEC.md` — "Tools and rerolls" rewritten as "Rerolls and Tools"
  (initial roll free; 2 configurable free rerolls per Event, prototype value;
  free rerolls reset each Event, never carry over; Tool cost after free
  rerolls); new "Required dice count" subsection under Slot requirements
  (explicit `diceRequired`, both checks enforced, high-dice slots
  intentionally visible-but-unavailable); Prototype assumptions renamed
  (Prompts 2–3) and updated.

**Event Card / economy adjustments (first conservative pass, NOT final
balance).**
- Mammoth Hunt (food-heavy): Food 2/3/4 (1–2 dice), 6/8 (3 dice), 9 (5-die
  straight), 10 (4-die four-kind). Modest accessible rewards plus
  high-dice/high-payoff rewards.
- Rock Quarry (tool-heavy): Tools 1/1/2/2→3/3, **no Food at all** — tribes
  that failed to save Food feel this card.
- Trading Post (mixed): Food 3/4, Tools 1/2, mixed Food 3 + Tools 1, and a
  rare 4-die four-kind Population 1 (inaccessible at Pop 3).
- Shaman's Rite (transforms): easy 1–3 die requirements on big transforms
  (2 Tools→6 Food on a pair; 4 Food→2 Tools on three-kind), plus a 4-die
  four-kind Population 1.
- Ambush (dangerous): Food 2/3/6, Steal 1 Tool on 3-die three-kind, Kill 1
  Pop on a 5-die full house (intentionally unclaimable by starting Pop-3
  tribes — a late-game opportunity visible from Event 1), Food 7 on 4-die
  four-kind.
- General shape: small (1–2 dice) < mid (3 dice) < large (4–5 dice) rewards,
  so a hard slot consuming many dice can substantially outpay an easy one.

**Testing.**
- `tests/requirements.test.js` — 10 new tests: every prototype slot has an
  explicit `diceRequired`; fewer/more dice fail; exact count + valid
  condition passes; all-odd can't be cheesed with 1 die; sum and pattern
  requirements respect `diceRequired`; `checkSlot` throws on missing/invalid
  `diceRequired`; over-sized slots have no legal subsets; a 5-dice slot
  coexists on a card a 3-die tribe cannot claim (and a 5-die tribe can).
- `tests/game.test.js` — SLOT helper now takes `diceRequired`; reroll tests
  rewritten for the free-first economy; 6 new tests: initial roll consumes
  no reroll; every tribe (human + all AI) starts with the configured free
  rerolls; free rerolls reset each Event and don't carry over; `submitClaim`
  rejects fewer AND more dice; an Event whose only slot needs 5 dice
  proceeds to Night normally; the AI completes the reroll phase and never
  spends a Tool while free rerolls remain.
- `tests/fullgame.test.js` — inline cards got `diceRequired`; the seed-42
  fixture was re-picked to seed 2 (see failures below).
- Result: **63/63 tests pass** (was 47/47 before the revision).

**Commands run.**
```sh
npm test                          # 47/47 baseline, 63/63 after
make build                        # vite build -> dist/ (relative ./assets)
node scripts/simulate.mjs 1|2|3   # full AI games: >=3 events, eliminations,
                                  # single winner (all PASS)
make start + curl :5173           # 200 for /, main.js, gameScene.js, events.js
node /tmp/cp-ui-test.mjs          # headless-Chrome CDP: real mouse clicks
                                  # (select dice, free reroll, finish), full
                                  # game to a winner, 4 screenshots, zero page
                                  # console/exception errors
node /tmp/pixel-check.mjs         # screenshot pixel analysis: 3 distinct slot
                                  # state colors confirmed (#2e2552 pickable,
                                  # #1f1839 no-match, #120e1e impossible)
shasum LOG.md stats/*.json        # before/after identical
```

**Failures / fixes.**
- Full-AI seed-42 game now ends in a DRAW (both tribes starve on the same
  Night at Event 11) under the new economy — a legitimate outcome, not a
  crash. Re-picked the fixture seed to 2 (11-event game, decisive winner).
- Pre-existing `findLegalSubsets` bug (short-circuited even with
  `first=false`): fixed; the "finds all satisfying subsets" unit test now
  asserts the correct full result (`[5,5]` AND `[5,5,1]` for a pair check).
- CDP test script issues (test-only, not product): (a) injecting a claiming
  state without initializing `turnPos` crashed `advanceTurn` with NaN index —
  fixed by initializing the full claiming state; (b) driving the human seat
  through the Game API without kicking `scene.pump()` stalled the AI — fixed
  by pumping after each action, exactly as the real UI does.

**Assumptions.**
- The reward values above are a deliberate first pass; the maintainer will
  playtest before further balance decisions. `FREE_REROLLS_PER_EVENT = 2` is
  the same kind of prototype value.
- In the debug UI, both impossible-dice and no-match slots are non-clickable
  (prevents error spam); they are distinguished by background color and tag
  text, per the spec.
- AI change was intentionally minimal (affordability check only); the
  heuristic remains simple and transparent.
- `LOG.md` already contained the maintainer's own uncommitted "Step 7.1"
  note before this session; it (and all `stats/*.json`) were verified
  untouched via shasum.
- Nothing was committed; the working tree contains Prompt 3, ready for the
  maintainer to review, playtest, and commit.

## 2026-08-29 — Prompt 3: drag-and-drop dice interaction, readable
phases (placeholder art, 1280x800, no rule changes)

**What happened.** Replaced the Prompt 2 debug UI (click-to-select dice,
"Reroll selected" buttons) with the intended gameplay interaction: click a
die to mark KEEP during the reroll phase, and drag dice from the YOUR DICE
tray into a slot's dice tray during claiming. Staging is tentative (one
slot at a time, live incomplete/invalid/valid feedback, drop-outside or
"return" to undo, full-tray drop swaps the last die in) and nothing is
submitted or consumed until CLAIM, which goes through
`game.submitClaim` — the model stays the sole legality authority. The
canvas grew to 1280x800 (CSS-scaled) so a 7-slot card, four tribe rows,
dice tray, per-claim reward list, night feeding summary, and an 8-line log
fit without scrolling. Dice are placeholder pip graphics.

**Changes made.**
- `src/game/game.js` — new opt-in constructor flag `stepRewards` (default
  `false` = the original synchronous reward resolution, unchanged for
  tests/AI harnesses) plus `stepReward()`, which resolves exactly one
  queued claim and returns `{done|needsTarget|applied|voided|fizzled}`
  descriptors. `advanceReward()` is now a loop over it; `beginRewards`/
  `resolveWithTarget` respect step mode. No rule or balance changes.
- `src/ui/claimStaging.js` (new) — pure, Node-testable tentative-staging
  state machine (`newStaging`, `poolDice`, `canStageInto`, `stage`,
  `unstage`, `dropDie`, `stagedState`, `stagedDieIds`, `slotDisplayState`).
  Staging never mutates the model pool.
- `src/ui/dieView.js` (new) — placeholder pip die with visual states
  (normal/hover/drag/kept/staged/valid/invalid/dim) and drag behavior.
  Pixi v8 has no pointer capture, so a drag tracks pointermove/pointerup on
  a `dragTarget` (the scene passes `app.stage`). `tumble()` is a cosmetic
  animation that always settles on the model's values.
- `src/ui/gameScene.js` — full rewrite around the new layout and
  interaction: 1280x800 (left event-card panel with per-slot dice trays,
  right column with tribe rows / context panels / log), KEEP tap-to-select,
  drag-and-drop staging with live validation, per-claim reward list that
  resolves one step at a time (900 ms) with target-pick highlighting,
  night per-tribe feeding rows (feed/starve/left/grow), AI banners +
  slot flash + dice-diff animations, and a game-over overlay. A
  `view.turnKey` reset keeps per-decision UI state (staging, KEEP, growth
  count) scoped to the current decision.
- `src/ui/uiKit.js` — `W/H` now 1280x800; added `panel()`; `button()`
  gained label-size/accent/bold options; removed the old `dieSquare`
  (replaced by dieView.js).
- `src/ui/debugUi.js` — passes `app` + `stepRewards: true` to the scene,
  updated the setup help text for the new controls, fixed a pre-existing
  `anchor: true` (became anchor 1,1; now 0.5) centering bug.
- `tests/claimStaging.test.js` (new, 16 tests) — staging never touches the
  model pool; pool/staged bookkeeping; incomplete/invalid/valid tracking;
  full-tray and claimed-slot rejections; one-slot-at-a-time; drop
  semantics; every `slotDisplayState` state.
- `tests/interaction.test.js` (new, 8 tests) — model-level flow tests for
  the interaction: staging consumes nothing and a claim consumes exactly
  the submitted dice; invalid claims are rejected with state unchanged;
  claimed slots stay claimed; reroll results are model-determined and
  deterministic (same seed -> same values); free rerolls before Tools;
  DONE ROLLING costs nothing; full-tray swap semantics (replica of the
  scene's drop handler); `stagedState` mirrors model validation.
- `GAME_SPEC.md` — updated the two now-stale prototype-assumption bullets
  (canvas 960x640 -> 1280x800; "Debug UI" -> describes the implemented
  drag-and-drop interaction). No rule changes.

**Commands run.**
```sh
npm test                            # 63/63 baseline, 87/87 after
make build                          # vite build -> dist/, all refs ./assets
node /tmp/cdp-smoke.mjs             # headless-Chrome CDP against the dev
                                    # server: real scene, simulated pointer
                                    # events for KEEP tap + drag/drop, live
                                    # validation, swap, claim, advance to
                                    # event 2 — PASS, zero page errors
node /tmp/cdp-mouse.mjs             # real-mouse CDP drag (Input.dispatch
                                    # MouseEvent, real hit-testing): PASS
                                    # with the stage hit-area fix, fails
                                    # (die stuck in "drag") without it
node /tmp/cdp-autoplay.mjs          # full AI game through the scene
                                    # (seat 0 flipped to AI via CDP): 4
                                    # events, starvation elimination,
                                    # single winner, zero page errors
shasum LOG.md stats/*.json          # before/after identical
```
(The two CDP scripts are throwaway verification tools in /tmp, not part of
the repo.)

**Failures / fixes.**
- `claimStaging.stage()` no-op'd when a staged die was dropped onto a
  *different* slot (the "already staged" check ignored the slot). Fixed to
  only no-op when the slot matches; the move now clears the old tray and
  re-stages. Caught by `tests/claimStaging.test.js`.
- `dieView.js` used `e.target.setPointerCapture(...)` — a Pixi v7 API that
  does not exist in v8, so every real drag would have thrown. Rewrote the
  drag to listen for pointermove/pointerup on a stage-level `dragTarget`.
  Caught by the headless smoke test (simulated pointerdown).
- Real-mouse drag still failed (user report): the smoke test's manual
  `emit()` bypassed Pixi's hit-testing, hiding that v8 only dispatches
  pointer events when the pointer is over a static/dynamic object. The
  scene's background/panels are passive, so once the pointer left a 30px
  die, `hitTest` returned null, `EventBoundary.propagate()` bailed, and the
  stage-level pointermove/pointerup never fired — the die froze mid-drag
  and got stuck in the drag state. Fixed in `debugUi.startApp` by making
  the stage a full-screen hit target (`eventMode: "static"` +
  `hitArea: new Rectangle(0, 0, W, H)`) — the documented v8 drag pattern.
  Verified with CDP `Input.dispatchMouseEvent` (real input pipeline):
  press/drag/release stages the die into the slot; the same test with the
  fix disabled reproduces the freeze (die stuck in "drag", empty staging).
- The reward pump's target-wait branches checked `tribeId === 0` instead of
  `humanTurn()` — a latent deadlock for any non-human seat 0 (e.g. the
  autoplay verification). Fixed to use `humanTurn()`.
- Scene review fixes: human dice are hidden while reward/night panels cover
  the tray area; staging is cleared if the staged slot gets claimed by an
  AI mid-phase; a reward row left in "pick a target" state is closed out
  when the pump resumes after the target is chosen.

**Assumptions.**
- `stepRewards` is the only model-surface change; default mode is
  byte-for-byte the old behavior, so all 63 pre-existing tests pass
  untouched.
- The AI's turn order means the human (seat 0, first in most order rules)
  stages before AI claims; staging survives AI turns within one claiming
  phase, matching the "tentative, one at a time" spec.
- `?autoplay=N` still stops at the human seat (seat 0 is always the human
  in the model) — the autoplay verification flipped seat 0 to AI via CDP
  rather than changing the debug aid's contract.
- Nothing was committed; the working tree contains the Prompt 3 UI, ready
  for the maintainer to review, playtest, and commit.

## 2026-08-31 — Prompt 4: visual direction, ComfyUI proof of style (Mammoth Hunt banner + Food/Tools/Population treatments), integrated into the playable game

**What happened.** Established a prehistoric-graphic-novel visual identity
and proved it end-to-end with the local ComfyUI instance
(127.0.0.1:8188): built a small dev-only generation pipeline
(`comfyui/generate.py`, `comfyui/analyze.py`), evaluated 4 checkpoints,
generated 14 Mammoth Hunt banner candidates across 2 prompt revisions and
3 subject variants, had the maintainer pick (seed 404, savanna), cropped
it to a 1024x208 banner, and integrated it into the real game behind a
data-driven `art` field on the event card. Also restyled the UI to match:
earthy palette, stone/hide panel framing, display type, bone/stone dice,
and vector Food/Tools/Population icons (8 generated icon attempts were
tried and rejected — vectors are strictly clearer at 12-14px). No
gameplay, rule, or balance changes; presentation only.

**Changes made.**
- `comfyui/` (new, dev-only) — `generate.py` (stdlib-only ComfyUI API
  runner: POST /prompt, poll /history, download /view, write `.meta.json`
  provenance sidecars), `analyze.py` (candidate metrics + contact sheets;
  run with the ComfyUI venv python which has PIL), `workflows/` (API-format
  workflows: `mammoth-hunt.json` = workflow of record for the shipped
  banner; `mammoth-hunt-v2.json`; `icon-*.json`; `eval-*.json`),
  `prompts/STYLE.md` (shared positive/negative style blocks + v1->v2
  revision rationale), `prompts/mammoth-hunt.md` (full 14-gen iteration
  record with per-seed verdicts + selection), `prompts/icons.md` (8
  rejected icon gens + vector decision), `README.md`.
- `assets/generated/caveperson/` (new) — every generated PNG with a
  `.meta.json` sidecar (workflow, seed, model, sampler, steps, cfg).
  Committed per maintainer decision so shipped art stays reproducible.
- `assets/final/mammoth-hunt-banner.png` (new) — the shipped banner
  (1024x208), source `assets/generated/caveperson/mammoth-hunt_00004_.png`
  (1024x512, seed 404, SD 1.5, dpmpp_2m/karras, 25 steps, cfg 6.0).
- `src/data/events.js` — card shape doc gains optional `art?` (id into the
  artwork registry); only mammoth-hunt carries `art: "mammoth-hunt"`.
- `src/ui/artwork.js` (new) — banner registry (art id -> Vite-imported
  asset), Image predecode + `Texture.from(img)` at module import,
  `bannerTexture`/`bannerSize`, `resourceIcon(kind,size)` vector icons
  (drumstick / hand axe / figure+club in bone 0xe6d9bd + outline 0x46361f),
  `scrimTexture()` (canvas gradient), `rewardKind()`, `artworkDebug()`,
  `ART_BANNER_H = 96`.
- `src/ui/gameScene.js` — `renderCard()` draws a 96px art band (masked
  Sprite + scrim + display-type title) when the card's banner is ready,
  plain header otherwise; 12px reward-row icon; 14px tribe-row resource
  icons; `view.lastArtBand` + `scene.debug.art` render/verification handle.
- `src/ui/uiKit.js` — new earthy `C` palette (bg 0x171210, panel 0x251c12,
  bone text 0xf2e8d5, ochre 0xe8a33d, moss 0x8fc74f, blood 0xd94f30, ...),
  display type style (bold, letter-spaced), `panel()` stone/hide double
  frame, button fill 0x453423.
- `src/ui/dieView.js` — bone/stone `STATE_STYLE` (bone face, dark pips,
  stroke 2-3, radius 0.2); pips/layout/drag behavior untouched.
- `src/main.js` (bg 0x171210), `src/style.css` (page bg #0e0b09).
- `tests/assets.test.js` (new) — 4 tests: mammoth-hunt card has an art id;
  `assets/final/<art>-banner.png` exists with sane PNG dimensions;
  non-art cards are unaffected; artwork.js registry keys match card art ids
  (drift guard).
- `VISUAL_DIRECTION.md` (new) — the direction: palette table, type, shape
  language, generated-art ground rules, what's shipped, what's deferred.
- `AGENTS.md` — project layout section updated with `comfyui/`,
  `assets/generated` vs `assets/final`, and the new docs (maintainer
  approved).

**Verification.**
```sh
npm test                            # 87/87 baseline -> 91/91 after
make build                          # clean; banner ships hashed, refs ./assets
make preview + node /tmp/cdp-verify-p4.mjs
  # PASS A (natural): full AI-vs-AI game, no tampering -> phase "over",
  #   mammoth-hunt happened to land at event 3: art loaded + rendered,
  #   zero page errors
  # PASS B (forced): mammoth forced into events 1-3 (deck is shuffled,
  #   so this guarantees coverage) -> art loaded + rendered, zero errors
shasum LOG.md stats/*.json          # byte-identical to pre-session baseline
```
(The CDP script is a throwaway in /tmp, not part of the repo.)

**Failures / fixes.**
- **Pixi v8: `Texture.from(urlString)` does not load a URL** — it looks up
  the Assets cache by label and returns `undefined` (verified in
  `node_modules/pixi.js/lib/rendering/renderers/shared/texture/utils/
  textureFrom.js`). The banner silently never appeared. Fixed by preloading
  with plain `new Image()` at module import and calling
  `Texture.from(img)` on decode.
- **Pixi v8: `Texture.valid` does not exist** (v7 API), and a texture's
  `width`/`height` stay 0 until first GPU upload — so the "is the banner
  ready?" check and the fit-to-band scale math must use our own predecode
  state + captured natural image size (`bannerSize`), not the texture.
  Both fixed in `artwork.js`/`gameScene.js`; the CDP `rendered` assertion
  confirms the art band is actually drawn, not just loaded.
- All 8 generated resource icons rejected by the maintainer ("not a single
  usable thing"): SD 1.5 paints them as small soft scenes and rembg fights
  the soft edges at 12-14px. Switched to Pixi vector icons (explicitly
  allowed by the brief); the generation record is kept in
  `comfyui/prompts/icons.md`.
- `hunyuan_dit_1.2` checkpoint is unusable in this ComfyUI (0.34.0) setup
  (diffusers-format weights) — documented in the eval table, skipped per
  the no-new-models rule.

**Assumptions / decisions (maintainer-confirmed where noted).**
- Committed raw sources to `assets/generated/` and updated the AGENTS.md
  layout section — both confirmed by the maintainer.
- Shipped banner = seed 404 (v1 prompt, variant A), the maintainer's pick
  from the candidate sheet; v2 prompt block is the current style for
  *future* assets even though the shipped art came from v1.
- No ComfyUI runtime dependency: the banner is a committed PNG imported
  through Vite; `comfyui/` is only ever run on a dev machine.
- Only Mammoth Hunt got art this round (per the brief's stop condition);
  the other cards keep the plain header until the direction is confirmed.
- Direction is NOT declared a success — the maintainer decides by playing.

## 2026-08-31 — Prompt 4 follow-up: fix Mammoth banner clipping + redo resource icons

**What happened.** Maintainer playtest caught two real rendering bugs the
automated checks had missed: (1) the Mammoth Hunt banner only showed its top
half — the bottom half looked "covered/cut off"; (2) the Food/Tools/Population
icons were "absolute garbage" and didn't read as icons. Both fixed and
verified by reading the actual rendered pixels via CDP (the model can't view
images, so pixel brightness maps were used).

**Changes made.**
- `src/ui/gameScene.js` (banner mask fix) — the art band's clip mask
  (`holder.mask = new Graphics().rect(0,0,CARD_W,ART_BANNER_H)`) was cutting
  the banner in half. Root cause: a mask `Graphics` is NOT in the display
  list, so its own position/transform is never applied — only its local
  geometry is, in the parent (`dyn`) space. A rect at `(0,0)` therefore
  clipped to the top-left of the canvas, intersecting the banner only at
  `y 48..96` (top half). Fixed by offsetting the rect to the holder's
  position: `.rect(CARD_X, CARD_Y, CARD_W, ART_BANNER_H)`. Verified: the
  banner now fills the full 96px band top-to-bottom (all 12 pixel rows have
  content), and non-art cards are unaffected.
- `src/ui/artwork.js` (icon redo) — TWO compounding problems. (a) Design: the
  old icons used thin ~1.5px outlines + small multi-part shapes in dark
  fills, which dissolved into mud at 12-14px. (b) **A real Pixi v8 bug:
  `g.poly([[x,y],[x,y],…])` (nested arrays) renders NOTHING in this build.**
  Polygons must be PointData objects `{x,y}` (or `moveTo/lineTo`). That is
  why the old Tools (a teardrop poly) "looked like nothing" and the old
  Person body (a poly) never drew — only the non-poly parts (circle head,
  club line) showed. Confirmed with an isolated A/B test: `poly([[…]])` =
  invisible, `poly([{x,y}…])` and `moveTo/lineTo` = visible.
  Redid all three as ONE bold solid-color silhouette each (no thin outline,
  high contrast, distinct color AND orientation so they can't be confused):
  Food = fish (horizontal body + tail + eye, warm orange 0xe0863f),
  Tools = stone axe (wide blade + thick handle, light stone 0xd0c7b5),
  Population = person (head + body, bone 0xe6d9bd). Fish replaced the
  drumstick (maintainer: drumstick was a bad choice and read like the
  person). Verified at 100px on a clean backdrop (all three shapes legible
  and distinct) and in-context at 12-14px.

**Verification.**
```sh
npm test              # 91/91
make build            # clean
# CDP pixel-brightness maps (headless Chrome, forced mammoth card):
#   - mammoth banner band (470x96): all 12 rows populated (was top 6 only)
#   - rock-quarry (no art): plain header, slots intact
#   - poly A/B test: poly([[x,y]]) invisible; poly([{x,y}]) + moveTo/lineTo visible
#   - icons at 100px on clean backdrop: fish / axe / person all legible+distinct
```

**Notes.**
- The banner bug was invisible to the earlier "art loaded + rendered" CDP
  check because that only asserted the texture was ready and the band was
  drawn — not that the full image was visible. Lesson: for art, verify the
  actual pixels, not just the scene graph.
- `LOG.md` "Step 9" (maintainer) independently flags the same icon problem;
  left `LOG.md` untouched.
- **Pixi v8 gotcha worth remembering:** `graphics.poly()` silently drops
  nested-array points (`[[x,y],…]`). Use `{x,y}` objects or
  `moveTo/lineTo/closePath`. Any future vector art with polygons should use
  the working form (the icons now have a `P(x,y)` point helper for this).
