# Spirit Cave — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/spirit-cave.json` (v2 style block)
- Round 2: `comfyui/workflows/spirit-cave-v2.json` (v3 style block)
Style blocks: `comfyui/prompts/STYLE.md`.

## SELECTED: seed 2401 (round 2, "least sucky")

- Source: `assets/generated/caveperson/spirit-cave-v2_00001_.png` (1024x512)
- Banner: `assets/generated/caveperson/spirit-cave-v2-banner_00001_.png`
  -> shipped as `assets/final/spirit-cave-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 2401, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/spirit-cave-v2.json`)
- Chosen by the maintainer: "I guess 00001 is the least sucky version."
  **Accepted with reservations.**

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject lines

- Round 1 (v2): `stone cave interior with bold painted animal and handprint
  markings in ochre and red on the wall, one prehistoric figure pointing at the
  painted wall, warm dramatic light from the right, wide horizontal banner
  composition, painted wall large in center-right, dark quiet cave space in the
  top left`
- Round 2 (v3): `the mouth of a stone cave with a massive painted bison and
  red handprints on the cave wall, a prehistoric figure pointing at the painted
  wall, strong side light across the painted stone, wide horizontal banner
  composition, painted cave wall large in the lower center of the frame, dark
  quiet space only in the top third`

## Iterations

### Round 1 (workflow `spirit-cave.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1401 | 0.002 / 0.501 / 0.221 / 0.954 / 0.078 / 2.94 / 1.00 | rejected — "all of these suck" (user); cool drift (cool 0.221) |
| 1402 | 0.000 / 0.808 / 0.003 / 0.890 / 0.123 / 3.26 / 0.91 | rejected — "all of these suck" (user) |
| 1403 | 0.002 / 0.823 / 0.115 / 0.818 / 0.142 / 3.61 / 0.76 | rejected — "all of these suck" (user) |

### Round 2 (workflow `spirit-cave-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| **2401** | 0.023 / 0.990 / 0.000 / 0.886 / 0.121 / 3.64 / 0.99 | **SELECTED** — "least sucky" |
| 2402 | 0.005 / 0.998 / 0.000 / 0.999 / 0.050 / 1.66 / 1.00 | rejected — flat (entropy 1.66) |
| 2403 | 0.000 / 1.000 / 0.000 / 0.942 / 0.073 / 2.41 / 0.99 | rejected — flat (entropy 2.41) |

**Outcome: s2401 ships (round 2).** Two rounds, 6 generations.

## Failure notes (kept, not sanitized)

- The cave-interior subject kept coming out as a near-uniform warm wall in the
  crop band (the "painted bison" detail was too small to survive the 1024x208
  crop). The v3 side-lighting helped contrast but the subject still read as a
  plain wall. Shipped as the least-bad option.
