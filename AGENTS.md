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
2. Validate headlessly (see Commands). A successful `-export` proves the
    cartridge is valid, `#include` resolves, and the code compiles.
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

- Text: `print(s, x, y[, color])`, `txt_scale(n)`, `txt_metric(b)`
- Shapes: `rect(x0,y0,x1,y1[,c])`, `line(x0,y0,x1,y1[,c])`,
  `circ(x,y[,c])`, `circfill(x,y,r[,c])`, `ellip`, `ellipfill`, `pset`
- Camera/effects: `cam(x,y)`, `clip(x0,y0,x1,y1)`, `fade(n)`, `cls([c])`
- Data/memory: `peek(a)`, `poke(a,v)`, `load(filename)`, `load_gfx`,
  `load_map`, `load_sfx`, `load_luad`
- Audio: `sfx([n])`, `music([n])`, `cur_sfx()`, `cur_music()`
- Coroutines: `cocreate(f)`, `coresume(c)`, `coreyield()`, `costatus(c)`
- Info: `stat(1)` cpu load, `stat(2)` fps, `time()`
- Flow: `exit()`, `quit()`, `pause()`, `srand(n)`, `rnd([n])`

## Art pipeline (later step)

ComfyUI generates sprite PNGs (8x8 or 16x16 tiles, palette above) → convert
to `__gfx__` hex and paste into `game.p8` (or a small converter script).
Do not hand-edit the hex sections.
