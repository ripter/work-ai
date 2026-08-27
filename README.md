# CavePerson

A competitive prehistoric dice game (Yahtzee-style dice placement) built with
[PixiJS](https://pixijs.com/) + [Vite](https://vite.dev/) as a static HTML5
site.

Built as a work demo of local-AI-assisted development (OpenCode + local
models, no cloud APIs). The earlier PICO-8 prototype was abandoned; see
`REPORT.md` for the viability analysis and git history for the old code.

## Requirements

- Node.js + npm
- A modern web browser

## Build and run

```sh
npm install        # first time only

make start         # dev server with live reload (http://localhost:5173)
make build         # production static site -> dist/
make preview       # serve dist/ locally
```

`dist/` is fully static — host it anywhere (GitHub Pages, any subpath); no
backend or server-side tooling needed after the build.

## Documentation

- `GAME_SPEC.md` — canonical game specification (the source of truth)
- `AI_DEVLOG.md` — AI-maintained development log
- `LOG.md` — human project log (do not modify)
- `AGENTS.md` — notes for AI agents working on this repo

## Project layout

```
Makefile           build targets: make build / start / preview / session / clean
export-session.sh  export the current opencode session to stats/sessionN.json
stats/             exported session logs (session1.json, ...)
GAME_SPEC.md       canonical game spec
AGENTS.md          AI agent notes
index.html         Vite entry page
vite.config.js     vite config (relative base for subpath hosting)
src/main.js        entry point: creates the Pixi application
src/style.css      page layout
src/game/          game scenes and logic
src/ui/            UI widgets (future)
src/data/          static game data (future)
assets/            imported art assets
public/            static files copied verbatim into dist/
```
