# Background (scene backdrop) — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/background.json` (v2 style block)
- Round 2: `comfyui/workflows/background-v2.json` (v3 style block)
Style blocks: `comfyui/prompts/STYLE.md`.

This is the full-scene cave-wall backdrop (1024x640, not a 2:1 banner). It sits
behind the whole play area in the game scene and the setup screen; the game's
dark panels provide the contrast on top of it.

## SELECTED: seed 2803 (round 2)

- Source: `assets/generated/caveperson/background-v2_00003_.png` (1024x640)
  -> shipped as `assets/final/background.png` (1024x640)
- Full parameters: sidecar `.meta.json` (seed 2803, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/background-v2.json`)
- Chosen by the maintainer: "00003."

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x640 (2:1.25, matches the 1280x800 play area aspect exactly)
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (ships as-is; cover-fitted to 1280x800 in Pixi, scale 1.25)

## Subject lines

- Round 1 (v2): `very dark cave interior environment backdrop, rough layered
  stone wall texture filling the entire frame, faint warm amber glow from the
  lower center, strong dark vignette at the edges, subtle low contrast, empty
  scene, no characters, no people, no animals, no objects`
- Round 2 (v3): `very dark cave wall backdrop, rough layered stone texture with
  visible cracks and strata filling the entire frame, warm amber glow rising
  from the lower center, strong dark vignette at the edges, low contrast empty
  scene, no characters, no people, no animals, no objects, no light sources`

## Iterations

### Round 1 (workflow `background.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1801 | 0.000 / 1.000 / 0.000 / 1.000 / 0.056 / 2.01 / 1.00 | rejected — "all of them suck" (user); near-uniform |
| 1802 | 0.001 / 0.998 / 0.000 / 1.000 / 0.078 / 2.41 / 1.00 | rejected — near-uniform |
| 1803 | 0.000 / 1.000 / 0.000 / 1.000 / 0.068 / 1.94 / 1.00 | rejected — near-uniform |

Round 1 came out as a near-solid dark field (negsp 1.0, low contrast) — the
"very dark" + "low contrast" wording flattened the stone texture.

### Round 2 (workflow `background-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 2801 | 0.098 / 0.638 / 0.001 / 0.512 / 0.153 / 3.06 / 1.00 | rejected — most texture, but not picked |
| 2802 | 0.004 / 0.999 / 0.000 / 1.000 / 0.068 / 1.95 / 1.00 | rejected — flat again |
| **2803** | 0.005 / 0.996 / 0.000 / 0.997 / 0.090 / 2.77 / 1.00 | **SELECTED** |

**Outcome: s2803 ships (round 2).** Two rounds, 6 generations.

## Failure notes (kept, not sanitized)

- A "very dark" backdrop is easy to over-compress into a flat fill. The round-2
  prompt swapped "very dark ... faint glow ... subtle low contrast" for "visible
  cracks and strata ... warm amber glow rising ... strong dark vignette" to keep
  the texture legible while staying dark enough for the panels to sit on top.
