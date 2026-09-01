# WorkAI — CavePerson (HTML5/PixiJS)

Goal: build the CavePerson game demo for work using local AI only (OpenCode +
local models). No cloud APIs.

The PICO-8 implementation was abandoned in 2026-08; the project was migrated
to PixiJS/Vite/HTML5. PICO-8 history lives in git and in `REPORT.md`
(the PICO-8 vs HTML5 viability report that motivated the migration).

## Hard rules

- **DO NOT modify `LOG.md`.** It is the human maintainer's personal
  development log. Do not append to it, rewrite it, summarize anything in it,
  or "helpfully" update it. AI development notes go in `AI_DEVLOG.md` instead.
- **DO NOT modify existing `stats/session*.json` files.** They are immutable
  session telemetry. New sessions are added by `export-session.sh`
  (`make session`) as the next `stats/sessionN.json` — never rewrite or
  reorder old ones.
- The production build must stay **static-host compatible**: no backend, no
  server-side code, no assumption of root `/` hosting (see `base: "./"` in
  `vite.config.js` — do not remove it).

## Technology

- PixiJS (v8 API: `await app.init({...})`, `app.canvas`, v8 `Graphics`/
  `Text` constructors)
- Vite
- JavaScript ES modules — **not** TypeScript (owner preference)
- No React/Vue/Svelte/Phaser or other framework or game engine

## Project layout

- `index.html` — Vite entry page; mounts `#app`, loads `src/main.js`.
- `vite.config.js` — `base: "./"` (subpath-safe asset paths), output `dist/`.
- `package.json` — scripts: `dev`, `build`, `preview`.
- `src/main.js` — creates the Pixi Application, builds the current scene.
- `src/style.css` — page layout around the canvas.
- `src/game/` — game model, state machine, rules (e.g. `game.js`, `rules.js`).
- `src/ui/` — Pixi scenes and widgets (gameScene, dieView, uiKit, artwork…).
- `src/data/` — static game data (event cards, tribes, etc.).
- `assets/generated/` — raw ComfyUI outputs + `.meta.json` provenance
  sidecars. Development-time; kept for reproducibility, NOT imported by the
  game.
- `assets/final/` — finished art that the game actually imports (referenced
  from JS, processed by Vite). Only assets in here ship.
- `comfyui/` — local art pipeline (development-time only): `generate.py`
  (workflow JSON -> `assets/generated`), `analyze.py` (candidate metrics),
  `workflows/` (ComfyUI API-format workflows), `prompts/` (shared style
  blocks + per-asset generation records). See `comfyui/README.md`. The game
  build has no runtime dependency on ComfyUI.
- `public/` — static files copied verbatim into `dist/`.
- `VISUAL_DIRECTION.md` — the visual identity (palette, type, shape
  language, generated-art ground rules). Follow it for new art/UI.
- `GAME_SPEC.md` — canonical game spec. Follow it; when code and spec
  disagree, fix the code.
- `AI_DEVLOG.md` — AI-maintained dev log. Append a concise entry per
  significant AI session (what changed, commands run, results, assumptions).
- `LOG.md` — human log. **Hands off.**
- `REPORT.md` — historical: PICO-8 vs HTML5 viability analysis.
- `stats/` — exported opencode session logs (`session1.json`, ...).
- `export-session.sh` — exports the current session log to
  `stats/sessionN.json` (see Commands).
- `Makefile` — build targets: `make build` / `make start` / `make preview` /
  `make session` / `make clean`.

## Workflow

1. Edit `src/` (and `GAME_SPEC.md` only when a rule is being changed on
   purpose).
2. Validate (see Commands): `make start` for the dev server, `make build`
   for the production bundle.
3. Append a concise entry to `AI_DEVLOG.md` for anything significant.

Do not build a generalized game framework or over-structure the code. Game
rules will evolve rapidly during playtesting — keep modules small and plain.

## Commands

```sh
npm install        # first time only

make start         # vite dev server (http://localhost:5173), live reload
make build         # production static site -> dist/
make preview       # serve dist/ locally to sanity-check the static build
make session       # export the current opencode session to stats/sessionN.json
make clean         # remove dist/
```

Note: port 5000 is held by macOS AirPlay/ControlCenter on the maintainer's
machine — avoid it for any local servers (Vite uses 5173 by default).

## Static hosting

`make build` output in `dist/` must be deployable as plain static files
(e.g. GitHub Pages, any subpath). Verify after changes that built asset
references are relative (`./assets/...`), not absolute.
