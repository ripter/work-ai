# River Fishery — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/river-fishery.json` (v2 style block)
- Round 2: `comfyui/workflows/river-fishery-v2.json` (v3 style block)
Style blocks: `comfyui/prompts/STYLE.md`.

## SELECTED: seed 2102 (round 2, "least sucky")

- Source: `assets/generated/caveperson/river-fishery-v2_00002_.png` (1024x512)
- Banner: `assets/generated/caveperson/river-fishery-v2-banner_00002_.png`
  -> shipped as `assets/final/river-fishery-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 2102, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/river-fishery-v2.json`)
- Chosen by the maintainer: "All the fishing ones still suck. 00002 is the
  least sucky one." **Accepted with reservations** — the weakest of the eight
  shipped banners; a future re-roll is justified if the style direction is
  revisited.

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject lines

- Round 1 (v2): `prehistoric hunter wading in a shallow river casting a woven
  rope net, fish leaping out of the water, misty ochre riverbank, wide
  horizontal banner composition, hunter large in center-right, open quiet sky
  in the top left`
- Round 2 (v3): `a prehistoric fisherman standing in a wide shallow river
  holding a big woven net full of fish up high, fish leaping in the splashing
  water, the ochre river water fills the lower half of the image, wide
  horizontal banner composition, fisherman and fish large in the lower center
  of the frame, quiet sky only in the top third`

## Iterations

### Round 1 (workflow `river-fishery.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1101 | 0.000 / 1.000 / 0.000 / 1.000 / 0.032 / 0.90 / 1.00 | rejected — empty crop (entropy 0.90) |
| 1102 | 0.000 / 0.826 / 0.000 / 0.889 / 0.102 / 3.26 / 0.92 | rejected — "none of them look like a river fishery at all" (user) |
| 1103 | 0.000 / 1.000 / 0.000 / 1.000 / 0.044 / 1.72 / 1.00 | rejected — empty crop (negsp 1.0) |

### Round 2 (workflow `river-fishery-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 2101 | 0.002 / 0.609 / 0.385 / 0.842 / 0.147 / 3.71 / 0.58 | rejected — cool drift (cool 0.385, bluish water) |
| **2102** | 0.002 / 0.216 / 0.780 / 0.941 / 0.095 / 2.39 / 0.63 | **SELECTED** — "least sucky" (human pick overrides the cool metric) |
| 2103 | 0.043 / 0.912 / 0.010 / 0.834 / 0.246 / 4.50 / 0.83 | rejected — best metrics, not picked |

**Outcome: s2102 ships (round 2).** Two rounds, 6 generations.

## Failure notes (kept, not sanitized)

- The subject "a fisherman in a river with a net" is hard for SD 1.5 to read
  in a 2:1 banner: round 1 mostly cropped to empty water/sky, and round 2
  drifted cool (bluish water) on 2 of 3 seeds. The maintainer still shipped the
  least-bad one. Metrics flagged 2103 as the best, but the maintainer's eye
  picked 2102 — the metrics are a screening aid, not the oracle.
