# Standing Stones — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/standing-stones.json` (v2 style block)
- Round 2: `comfyui/workflows/standing-stones-v2.json` (v3 style block)
Style blocks: `comfyui/prompts/STYLE.md`.

## SELECTED: seed 2701 (round 2)

- Source: `assets/generated/caveperson/standing-stones-v2_00001_.png` (1024x512)
- Banner: `assets/generated/caveperson/standing-stones-v2-banner_00001_.png`
  -> shipped as `assets/final/standing-stones-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 2701, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/standing-stones-v2.json`)
- Chosen by the maintainer: "00001 is closest to the style of the other
  images." (The maintainer separately said s2703 "has a great art style to it
  that I really like" — but picked s2701 for set consistency.)

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject lines

- Round 1 (v2): `ring of ancient standing stones under a dramatic ochre sky, a
  low bright full moon high in the center-right sky, one tiny prehistoric figure
  standing at the center for scale, long dramatic shadows, wide horizontal
  banner composition, stones large in center-right, quiet open sky in the top
  left`
- Round 2 (v3): `a ring of massive standing stones with one huge fallen stone,
  a tiny prehistoric figure at the center for scale, long dramatic shadows, wide
  horizontal banner composition, standing stones large in the lower center of
  the frame, quiet dark sky only in the top third`

## Iterations

### Round 1 (workflow `standing-stones.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1701 | 0.089 / 0.986 / 0.001 / 0.531 / 0.166 / 4.11 / 1.00 | rejected — "all of them suck" (user) |
| 1702 | 0.000 / 1.000 / 0.000 / 1.000 / 0.054 / 2.11 / 1.00 | rejected — flat (empty-sky crop, negsp 1.0) |
| 1703 | 0.000 / 1.000 / 0.000 / 1.000 / 0.046 / 2.21 / 1.00 | rejected — flat (empty-sky crop, negsp 1.0) |

The round-1 subject put a "low bright full moon high in the sky" — but the
banner crop takes the lower-center band (y 152..360 of 512), so the stones
landed below the crop and the band captured mostly empty sky. Round 2 dropped
the moon and anchored the stones to "the lower center of the frame."

### Round 2 (workflow `standing-stones-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| **2701** | 0.013 / 0.953 / 0.001 / 0.708 / 0.196 / 4.29 / 0.66 | **SELECTED** — closest to the set's style |
| 2702 | 0.084 / 0.697 / 0.133 / 0.848 / 0.168 / 3.72 / 0.98 | rejected — some cool cast (cool 0.133) |
| 2703 | 0.333 / 0.659 / 0.175 / 0.407 / 0.283 / 4.21 / 0.69 | rejected — gloomiest (black 0.33); maintainer liked its style |

**Outcome: s2701 ships (round 2).** Two rounds, 6 generations.

## Failure notes (kept, not sanitized)

- Round 1's empty-sky crops were a composition failure (subject placed above
  the crop band), not a style failure. The v3 round-2 prompt explicitly anchors
  the subject to "the lower center of the frame," which is now the standard
  composition line for banner crops.
