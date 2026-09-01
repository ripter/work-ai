# CavePerson — visual direction

The look is a **prehistoric graphic-novel** identity: bold, flat, painterly,
earthy, and a little dangerous. It reads as a competitive prehistoric dice
game — energetic and with personality — not grim survival horror and not
polished 3D fantasy.

This is a *direction*, not a locked style sheet. It's expected to keep
evolving during playtest; the point is that everything (generated art,
Pixi-drawn UI, dice, icons) lives in the same visual family.

## Where the look comes from

- **Generated art** (ComfyUI, local): the Mammoth Hunt banner. Produced from
  the shared style block in `comfyui/prompts/STYLE.md`. This is the proof
  that the direction works in diffusion output.
- **Pixi vectors** (hand-built, no generation): the dice, the Food/Tools/
  Population resource icons, panels, buttons, and all framing. These share
  the art's language — bold silhouettes, flat fills, one heavy outline, bone
  + stone + ochre. Generated icons were tried and rejected (see
  `comfyui/prompts/icons.md`); at 12-14px vectors are strictly clearer.

The split is deliberate: **generate the hero moments, draw the furniture.**
UI furniture at small sizes must be crisp and cheap; hero art is where
diffusion earns its keep.

## Palette

Warm charcoal/hide browns for structure, bone-white for text, ochre for the
accent, moss/blood for feedback. All values in `src/ui/uiKit.js` (`C`).

| role | hex | use |
|------|-----|-----|
| bg | `#171210` | page + scene background (warm near-black) |
| panel | `#251c12` | panel fill (hide brown) |
| panelAlt | `#2e2318` | alternate/row fill |
| border | `#8a7455` | default outlines, dividers |
| dim | `#6e5f49` | disabled, low-emphasis |
| text | `#f2e8d5` | primary text (bone white) |
| faint | `#bfae94` | secondary text |
| green | `#8fc74f` | valid / success / growth (moss) |
| red | `#d94f30` | invalid / danger / elimination (blood) |
| yellow | `#e8a33d` | accent, highlights, "your turn" (ochre) |
| blue | `#7fa8c9` | informational, staging |
| frameDark | `#3d3122` | panel outer edge (stone) |
| frameLight | `#5a4a33` | panel inner worn line |

Framing is "stone/hide": a dark outer edge plus a lighter inner line (see
`panel()` in `uiKit.js`), so panels read as carved objects, not flat boxes.

## Typography

- **Display** (panel titles, "EVENT CARD — …", big labels): bold, slightly
  letter-spaced, `Trebuchet MS`/`Avenir Next` stack. Used via
  `txt(…, { display: true })`.
- **Body** (rules, values, log, most labels): monospace. Kept mono for the
  hand-built, diegetic "carved tablet" feel and for alignment of numbers.

## Shape language

- Bold simplified silhouettes; strong readable shapes over fine detail.
- One heavy outline per object; flat matte fills; no gloss, no 3D bevels.
- Rounded corners (6-8px) on UI, but the *art* keeps hard painterly edges.
- Dice: bone face, stone pips, heavy dark outline, near-square (radius 0.2).
  State colors (valid/invalid/kept/dim) map to the palette above.

## Rules for generated art (do not violate)

Carried over into every prompt (see `comfyui/prompts/STYLE.md`):

- **No generated text** of any kind. Titles, slot names, numbers, dice
  values, and UI labels are always dynamic Pixi elements overlaid on the art.
- **No baked-in UI frames/borders.** Card framing is drawn in Pixi.
- **Leave negative space** where the game overlays dynamic info (the Mammoth
  banner keeps the right side / sky quiet for the title).
- **Tone:** dangerous but energetic. A competition, not a horror.
- Keep the palette earthy (ochre/amber/sienna/bone/moss); avoid cool or
  neon casts.

## What is shipped today

- `assets/final/mammoth-hunt-banner.png` (1024x208) — the Mammoth Hunt
  hero banner, drawn on the Event Card behind a left-to-right scrim so the
  overlaid title stays legible. Source + provenance:
  `assets/generated/caveperson/mammoth-hunt_00004_.png` + sidecar, produced
  by `comfyui/workflows/mammoth-hunt.json` (seed 404).
- Everything else is Pixi-drawn (see `src/ui/artwork.js`, `dieView.js`,
  `uiKit.js`).

## What's deliberately NOT done yet

- No generated art for the other Event Cards (Rock Quarry, Trading Post,
  Shaman Rite, Ambush, …). Mammoth Hunt is the single proof of direction;
  the rest stay on the plain header until the maintainer confirms the look.
- No generated character portraits, no background parallax, no animated
  art. The direction is proven at the banner level first.
