# Drought — generation record

Workflow (source of truth for settings): `comfyui/workflows/drought.json`
Style blocks: `comfyui/prompts/STYLE.md` (round 1 used the v2 block).

## SELECTED: seed 1203 (round 1)

- Source: `assets/generated/caveperson/drought_00003_.png` (1024x512)
- Banner: `assets/generated/caveperson/drought-banner_00003_.png`
  -> shipped as `assets/final/drought-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 1203, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/drought.json`)
- Chosen by the maintainer: "drought-banner_00003_.png looks decent."

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject line (v2 block, verbatim from the workflow)

`vast plain of cracked dry earth under a harsh pale sun, one withered dead
tree, two tiny prehistoric figures carrying empty water skins walking across
the cracked ground, wide horizontal banner composition, withered tree large in
center-right, pale open quiet sky in the top left`

## Iterations

### Round 1 (workflow `drought.json`) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1201 | 0.132 / 0.672 / 0.056 / 0.496 / 0.288 / 4.28 / 0.69 | rejected — not picked (heaviest ink, busiest) |
| 1202 | 0.000 / 0.962 / 0.000 / 0.995 / 0.073 / 2.98 / 1.00 | rejected — flat (empty-sky crop, negsp 0.995) |
| **1203** | 0.023 / 0.985 / 0.006 / 0.869 / 0.109 / 3.65 / 0.98 | **SELECTED** — "looks decent" |

**Outcome: s1203 ships.** One round was enough — no second round needed.
