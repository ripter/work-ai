# PICO-8 vs HTML5 — viability for the CavePerson demo

**Question (step 5):** is it worth keeping PICO-8 for this demo, or switch to an
HTML5 game? PICO-8 adds real engineering constraints; if they don't serve the
demo, HTML5 is less friction.

**Method:** instead of reasoning abstractly, I built a real, *polished*
presentation slice — **Mammoth Hunt** — and measured where PICO-8 helped and
where it hurt. Every claim below is grounded in what I actually built and
verified this session (a headless PICO-8 CLI + Chrome CDP harness that exports
the cart, captures the canvas to an image, and captures the audio to a WAV).

**TL;DR:** PICO-8 is viable for a *polished scene + tight loop*, and its
constraints (128×128, 16 colours, 30fps) are a feature — the art reads as a
cohesive retro piece with almost no effort. It is **not** the right home for the
*full* CavePerson (crafting, decks, AI, menus, real audio). For the demo, keep
PICO-8 for the slice; plan the full game in HTML5.

---

## What was built (the evidence base)

- `game.lua` — Mammoth Hunt: title → hunt → death → loot. You roll 4 dice; three
  local bot camps roll 3 on a timer; the shared mammoth (24 hp) falls into
  bones and drops 3 claimable rewards (meat/tusk/hide) for food/tools.
- `tools/artgen.py` — generates **all** art (sprites, map, sfx) as palette-index
  grids in Python and splices `__gfx__`/`__map__`/`__sfx__` into `game.p8`.
- Verified headlessly: `luajit` parse, the 6s boot test (exit 124), canvas
  screenshots of title/hunt/death, and WAV captures for audio.
- Single-file web build via `make` → `web/game.html` (2.17 MB, opens in a
  browser, no server).

---

## The nine points

1. **Visual fidelity — PICO-8 wins (for this aesthetic).** The 16-colour,
   8×8-tile, 128×128 constraint is a *gift* for a pixel-art demo. The generated
   scene (starfield, hill band, 16×16 mammoth with hp bar, four camps, dice,
   loot) reads clearly and looks intentional. HTML5 can do higher fidelity, but
   you then have to *earn* a cohesive look; PICO-8 hands it to you.

2. **Art pipeline — PICO-8 is scriptable and fast.** I did **not** hand-draw in
   the editor. `artgen.py` authors the sheet/map and splices the hex sections
   idempotently; a change is one `python3` run + a canvas screenshot. This is
   the single biggest lever for a polished slice and it worked well.

3. **Audio — PICO-8 is the weak point.** The `__sfx__` format is a 168-hex-char
   packing that is undocumented for this build. I got real blips to play (a
   reference pattern, verified by WAV capture), but I could not cleanly author
   pitch/volume/effect programmatically, and **rapid `sfx()` calls get dropped**
   (they need spacing). Without the GUI editor in the loop, iterating on sound
   is slow. HTML5 (Web Audio / any sample) wins decisively here.

4. **CPU / performance budget — fine for a scene, tight for a game.** ~8 MHz,
   ~2 cycles/instruction, 30 fps, ~2 VM cycles/op. The hunt scene (a handful of
   `spr`/`rect`/`print` calls) runs comfortably. A full CavePerson — pathing
   AI, deck/crafting UIs, particle effects — would fight the budget. HTML5 has
   orders of magnitude more headroom.

5. **Language / API surface — real friction.** Lua 5.1 subset with **no standard
   library**, and this 0.2.7 build is missing APIs newer versions have (`floor`,
   `fade`, `cam`, `txt_scale`, `memused`, base-conversion, save/slot, …). A +1
   counter overflows in ~18 min (wrap it); `rnd` returns a float; `sin` takes
   0..1. Each of these is a small tax that adds up. HTML5/JS has the full
   runtime.

6. **Numbers / precision — a gotcha.** ~16-bit fixed point (−32768..32767.99999,
   step ~0.00002). Fine for a scene; a full sim with accumulated values will
   need wrapping/scaling discipline. HTML5 floats are free.

7. **Multiplayer — works, but it's DIY.** The step-3 pico-socket build (a
   socket.io relay of GPIO pins) was validated with real browser tabs syncing
   dice. It's clever and works, but it's hand-rolled pin plumbing that must stay
   in sync with the game. HTML5 gets native WebSocket/WebRTC. For this slice I
   dropped online play (rival camps are local bots) — it wasn't the point.

8. **Tooling / iteration / distribution — mixed.** PICO-8.app is a superb
   all-in-one editor and the **single-file HTML export is excellent for sharing**
   (one 2 MB file, no server). But headless automation is hard: the CLI won't
   flatten `#include`, the data formats are quirky, and the web build has a long,
   variable startup that makes precise capture calibration fiddly. HTML5 dev is
   the standard browser workflow (devtools, hot reload, no export step).

9. **Overall fit — depends on scope.** For a *polished presentation slice*
   (exactly what this demo needs to look good), PICO-8 delivers a charming,
   cohesive result with a fast art pipeline and trivial distribution. For the
   *full* CavePerson, the audio friction, CPU ceiling, missing APIs, and DIY
   networking make HTML5 the more sustainable choice.

---

## Recommendation

- **Keep PICO-8 for the demo slice** (Mammoth Hunt). It looks great, is easy to
  share (`make` → one HTML file), and the art pipeline is fast. This is the
  "wow" for a work demo.
- **Prototype the full game in HTML5.** If CavePerson grows past a scene —
  real audio, crafting/deck UIs, pathing AI, more than a couple of screens —
  move there. The dice/roll/reward *logic* in `game.lua` is plain and portable.
- **Either way, keep the two tooling wins** from this session regardless of
  platform: (a) an art generator that splices data programmatically, and (b) a
  headless verify loop (export → capture → assert) so the AI can check its own
  work without a human eyeballing a window.

The honest read: PICO-8's constraints are a feature *up to the size of a scene*,
and a tax beyond it. The slice proves the feature side is real.
