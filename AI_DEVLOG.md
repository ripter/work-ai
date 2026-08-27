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
