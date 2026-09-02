# Flint Road — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/flint-road.json` (v2 style block)
- Round 2: `comfyui/workflows/flint-road-v2.json` (v3 style block)
Style blocks: `comfyui/prompts/STYLE.md`.

## SELECTED: seed 2501 (round 2)

- Source: `assets/generated/caveperson/flint-road-v2_00001_.png` (1024x512)
- Banner: `assets/generated/caveperson/flint-road-v2-banner_00001_.png`
  -> shipped as `assets/final/flint-road-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 2501, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/flint-road-v2.json`)
- Chosen by the maintainer: "00001 is the best that matches the current art
  style." (The maintainer also noted s2503 "has a nice art style" but it "doesn't
  really match the art style used in other places" — consistency won.)

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject lines

- Round 1 (v2): `prehistoric trader walking a rocky mountain path carrying a
  heavy pack of stone tools and hide bundles, small cairns of polished stones
  along the trail, wide horizontal banner composition, trader large in
  center-right, open quiet sky in the top left`
- Round 2 (v3): `a prehistoric trader carrying a huge pack of flint axes and
  arrowheads on his back across a rocky path, a large cairn of polished stones
  in the foreground, wide horizontal banner composition, trader and stone cairn
  large in the lower center of the frame, quiet sky only in the top third`

## Iterations

### Round 1 (workflow `flint-road.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1501 | 0.057 / 0.777 / 0.004 / 0.712 / 0.192 / 4.42 / 0.90 | rejected — "too realistic, lost all the art quality" (user) |
| 1502 | 0.010 / 0.967 / 0.013 / 0.721 / 0.156 / 4.23 / 0.92 | rejected — same realism complaint |
| 1503 | 0.054 / 0.950 / 0.001 / 0.684 / 0.172 / 4.39 / 0.88 | rejected — same realism complaint |

Round 1 looked fine to the metrics (earthy ~0.95, contrast ~0.17, entropy
~4.3) but the maintainer read it as photorealistic — the v2 block's "bright
directional sunlight" + "strong perspective" pushed SD 1.5 toward semi-realism.
This is the card that triggered the v2 -> v3 style revision.

### Round 2 (workflow `flint-road-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| **2501** | 0.008 / 0.991 / 0.000 / 0.828 / 0.180 / 3.81 / 0.84 | **SELECTED** — best match to current art style |
| 2502 | 0.077 / 0.985 / 0.000 / 0.235 / 0.255 / 4.58 / 0.55 | rejected — busiest/darkest, not picked |
| 2503 | 0.025 / 0.998 / 0.000 / 0.710 / 0.162 / 3.79 / 0.95 | rejected — liked for style, didn't match the set |

**Outcome: s2501 ships (round 2).** Two rounds, 6 generations.

## Failure notes (kept, not sanitized)

- The metrics could not see the realism problem in round 1 (all three seeds
  scored "good" on earthy/contrast/entropy). Style coherence is a judgment the
  metrics don't capture — the maintainer's eye caught it. v3's revert to v1's
  side-lighting wording fixed the realism drift for this card.
