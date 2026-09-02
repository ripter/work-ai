# Great Migration — generation record

Workflow (source of truth for settings): `comfyui/workflows/great-migration.json`
Style blocks: `comfyui/prompts/STYLE.md` (round 1 used the v2 block).

## SELECTED: seed 1301 (round 1)

- Source: `assets/generated/caveperson/great-migration_00001_.png` (1024x512)
- Banner: `assets/generated/caveperson/great-migration-banner_00001_.png`
  -> shipped as `assets/final/great-migration-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 1301, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/great-migration.json`)
- Chosen by the maintainer (round-1 pick: "great-migration-banner_00001_").

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject line (v2 block, verbatim from the workflow)

`long herd of bison and antelope moving across a grassy plain at dawn, a small
tribe of prehistoric people with a child on their back walking alongside the
herd, wide horizontal banner composition, herd large in center-right, open dawn
sky in the top left`

## Iterations

### Round 1 (workflow `great-migration.json`) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| **1301** | 0.138 / 0.875 / 0.037 / 0.632 / 0.208 / 4.28 / 0.97 | **SELECTED** |
| 1302 | 0.005 / 0.997 / 0.000 / 0.835 / 0.102 / 3.63 / 0.94 | rejected — not picked |
| 1303 | 0.111 / 0.902 / 0.051 / 0.703 / 0.143 / 3.90 / 1.00 | rejected — not picked |

**Outcome: s1301 ships.** One round was enough. The herd subject (a big
non-human mass) cropped well — consistent with the lesson that large subjects
read better in the banner band than lone human figures.
