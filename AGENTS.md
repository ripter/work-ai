# WorkAI — PICO-8 Game Demo

Goal: build a game demo for work using local AI only (OpenCode + ComfyUI with
local models). No cloud APIs.

## Project layout

- `game.p8` — the PICO-8 cartridge container (file format `version 43`,
  matching the installed PICO-8 0.2.7 app). Its `__lua__` section is just a
   `#include game.lua` pointer. Do not add game code here. Sprites/maps/sfx
  live in its `__gfx__` / `__map__` / `__sfx__` sections (hex) — do not
  hand-edit those; change art via the PICO-8 app editor or a generator (see
  Art pipeline). Empty data sections are omitted from the file and the app
  adds them back when content appears — do not restructure the file by hand.
- `game.lua` — the actual game. This is the file to edit.
- `LOG.md` — human-maintained project log. Do not rewrite; append at most.
- `game.p8.png` — generated flattened export (gitignored), also used to
  validate the cart.

## Workflow

1. Edit `game.lua` (and data sections only when adding art/sfx).
2. Validate headlessly (see Commands). The boot test is the real check:
    exit 124 means the cart booted and ran the full 6 seconds; any early
    exit means a syntax or runtime error (read stderr). `-export` only
    proves the cart file parses — it can exit 0 even when the code
    crashes at runtime, and a `.png` target in this build may just be a
    spritesheet dump, not a screen capture.
3. Open `game.p8` in PICO-8.app to playtest (PICO-8 re-includes `game.lua`
   on every run, so external edits are picked up automatically; use CTRL-R
   in the app to re-run after editing).

Note: the headless `-export` does NOT flatten `#include`, so a commandline
`game.p8.png` still points at `game.lua`. For a self-contained shareable
export, use the EXPORT command inside PICO-8.app (it flattens includes);
otherwise ship `game.p8` + `game.lua` together.

## Commands

```sh
# validate + produce flattened game.p8.png (headless; -home isolates config)
TMP=$(mktemp -d)
"/Applications/pico-8/PICO-8.app/Contents/MacOS/pico8" game.p8 -export game.p8.png -home "$TMP"
rm -rf "$TMP"

# syntax-check game.lua without PICO-8 (parse only)
luajit -e "assert(loadfile('game.lua'))"

# headless boot test (timeout kills it; exit 124 = booted and running = ok,
# any early exit = check output for syntax/runtime errors)
TMP=$(mktemp -d)
timeout 6 "/Applications/pico-8/PICO-8.app/Contents/MacOS/pico8" game.p8 -x -home "$TMP"
rm -rf "$TMP"
```

## Multiplayer (pico-socket)

`game.lua` supports up to 4 online players via
[pico-socket](https://github.com/JRJurman/pico-socket): a socket.io relay of
GPIO pins. Solo play in PICO-8.app is unchanged (GPIO is local memory there).

- `web/pico-socket.yml` — pin map: room id at gpio 0, player id at gpio 1,
  players 1-4 own 13 pins each (joined, status, count, total, dice 1-9).
  Must stay in sync with the `ppin()` layout in `game.lua` (player blocks
  start at gpio offset 2 because pins 0/1 are room/player id).
- `web/build.sh` — flattens `game.lua` into a temp cart and runs the PICO-8
  CLI `-export` → `web/game.html` + `web/game.js` (both gitignored,
  regenerable). The CLI does NOT resolve `#include`, so flattening is
  required; re-run after editing `game.lua`.
- `Makefile` — build targets: `make` / `make static` (a single self-contained
  `web/game.html` you open in a browser, via `web/inline.js`), `make
  multiplayer` (the `game.html`+`game.js` export for pico-socket), `make clean`.

Build and serve (port 5000 is held by macOS AirPlay/ControlCenter on this
machine — use 5177):

```sh
make multiplayer
cd web
npm install        # first time only (pico-socket -> web/node_modules)
PORT=5177 npm start
# open http://localhost:5177 in up to 4 browser tabs/windows
```

Per player: A start, left/right to pick own dice count (3-9), A to join the
room (first free slot), A to (re)roll, B to leave. The winner highlights once
every joined player has rolled. The 5th+ tab spectates.

## PICO-8 constraints

- Screen 128x128 px, 16 colors. 30 fps: `_update` then `_draw` each frame
  (`_update60` for 60 Hz updates).
- Entry points: `_init()`, `_update()`, `_draw()` — lowercase, in `game.lua`.
- Input: `btn(n)` held, `btnp(n)` pressed this frame.
  0=left 1=right 2=up 3=down 4=A 5=B 6=C 7=menu.
- Map: 20x18 tiles visible, 8x8 px tiles, tile indices 0-255, drawn with
  `map(sx, sy, x, y, w, h)`.
- Sprites: 128x128 sheet, `spr(n, x, y[, sx, sy, flipx])`, n = 0-255 (8x8).
- 32 SFX slots (`sfx(n)`), 32 music patterns (`music(n)`).
- Lua 5.1 subset, NO standard library — only the PICO-8 API.
- Numbers: 16-bit-ish fixed point, range -32768..32767.99999, step ~0.00002.
  A +1-per-frame counter overflows after ~18 min; wrap it.
- Arrays are 1-based. `foreach` starts at `t[1]`.
- `sin()`/`cos()` take 0..1 (not 0..2PI); `sin()` is inverted.
- `sgn(0)` returns 1.
- `rnd(n)` returns a FLOAT in [0, n), not an integer. For a whole-number
  roll use `ceil(rnd(n))` (gives 1..n). Comparing a raw `rnd(n)` result
  against integers (`v == 1`) is always false.
- CPU ~8 MHz; ~2 cycles per VM instruction. Keep `_draw` cheap; watch
  `stat(1)` for CPU load.
- Bottom half of the sprite sheet and bottom half of the map share memory —
  use one or the other if unsure.

## PICO-8 character set (important)

- PICO-8 has NO standard uppercase. The editor and keyboard input produce
  lowercase letters (code points 97-122) only.
- ASCII `A`-`Z` (65-90) in `.p8`/`.lua` files are PICO-8's special "puny"
  glyphs, not normal uppercase — they render as stylized/special characters.
- The preprocessor matches lowercase `#include` exactly. Uppercase `#INCLUDE`
  (as in the manual's examples) is silently left in the code and fails with:
  `syntax error line N. unexpected symbol near '#'`.
- Rule: when editing `game.p8` / `game.lua`, write everything in lowercase —
  code, comments, and on-screen `print()` strings.

## Default 16-color palette

| #  | hex     | name        | #  | hex     | name     |
|----|---------|-------------|----|---------|----------|
| 0  | 000000  | black       | 8  | FF004D  | red      |
| 1  | 1D2B53  | dark blue   | 9  | FFA300  | orange   |
| 2  | 7E2553  | dark purple | 10 | FFEC27  | yellow   |
| 3  | 008751  | dark green  | 11 | 00E436  | green    |
| 4  | AB5236  | brown       | 12 | 29ADFF  | blue     |
| 5  | 5F574F  | dark gray   | 13 | 83769C  | indigo   |
| 6  | C2C3C7  | light gray  | 14 | FF77A8  | pink     |
| 7  | FFF1E8  | white       | 15 | FFCCAA  | peach    |

When generating art with ComfyUI, prompt for exactly these colors so
sprites match the palette.

## Useful API

WARNING: this installed build is MISSING many APIs that newer PICO-8
versions have. A missing global is nil and only fails at runtime, so
verify before using. Probed headlessly against the installed app on
2026-08-23 (cart version 43):

NOT in this build (do not use): `floor`, `exp`, `log`, `cam`, `fade`,
`txt_scale`, `txt_metric`, `fnt`, `ellip`, `ellipfill`, `cur_sfx`,
`cur_music`, `load_gfx`, `load_map`, `load_sfx`, `load_luad`,
`coreyield`, `quit`, `pause`, `at`, `ovn`, `ofc`, `plt`, `crt`,
`memsize`, `memused`, `tobin`, `frombin`, `tobase`, `frombase`, `tohex`,
`fromhex`, `toascii`, `fromascii`, `saveslot`, `loadslot`, `savenow`,
`loadnow`, `gmode`, `vib*`, `rdelta`, `tobinary`, `frombinary`,
`hex2bin`, `bin2hex`, `music_frame`, `sfx_frame`, `print_r`, `_print`.

Available (probed):
- Text: `print(s, x, y[, color])` (font is 3px per char; no txt_scale /
  txt_metric — center with `64 - (#s * 3 - #s % 2) / 2`)
- Shapes: `rect(x0,y0,x1,y1[,c])`, `line(x0,y0,x1,y1[,c])`,
  `circ(x,y[,c])`, `circfill(x,y,r[,c])`, `pset`
- Display: `cls([c])`, `clip(x0,y0,x1,y1)`, `map(...)`, `spr(...)`,
  `pal(...)`, `fget`, `fset`, `sset`, `mget`, `mset`
- Data/memory: `peek(a)`, `poke(a,v)`, `load(filename)`
- Audio: `sfx([n])`, `music([n])`
- Coroutines: `cocreate(f)`, `coresume(c)`, `costatus(c)`
- Info: `stat(1)` cpu load, `stat(2)` fps, `time()`
- Flow: `exit()`, `srand(n)`, `rnd([n])`, `btn(n)`, `btnp(n)`
- Math: `abs`, `sqrt`, `ceil`, `sin`, `cos`, `sgn` (NO `floor` — use
  `(n - n % 2) / 2` style integer tricks for whole numbers)
- Convert: `tostr`, `tonum` (old names; no tobase/frombase family)
- Save: `save`, `load`

To re-probe: a cart that builds a bit string with
`r = r .. (somefunc and "1" or "0")` for each candidate and ends in
`assert(false, "APIPROBE:" .. r)` prints the result on the boot-test
stderr. Note: this restricted lua has NO `_G` and NO `getfenv`.

## Art pipeline (later step)

ComfyUI generates sprite PNGs (8x8 or 16x16 tiles, palette above) → convert
to `__gfx__` hex and paste into `game.p8` (or a small converter script).
Do not hand-edit the hex sections.
