# Mammoth Hunt — generation record

Primary visual proof for the CavePerson direction.
Workflow (source of truth for settings): `comfyui/workflows/mammoth-hunt.json`
Style blocks: `comfyui/prompts/STYLE.md`

## SELECTED: seed 404 (variant A, v1 prompt)

- Source: `assets/generated/caveperson/mammoth-hunt_00004_.png` (1024x512, 844 KB)
- Banner: `assets/generated/caveperson/mammoth-hunt-banner_00004_.png`
  -> shipped as `assets/final/mammoth-hunt-banner.png` (1024x208, 347 KB)
- Full parameters: sidecar `.meta.json` (seed 404, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/mammoth-hunt.json`)
- Chosen by the maintainer after reviewing the full candidate sheet
  (see iteration log below).

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner PNG ships as-is; displayed at 470x96)

## Checkpoint evaluation (seed 424242, shared style+subject prompt)

| # | checkpoint | result |
|---|-----------|--------|
| eval_00001 | v1-5-pruned-emaonly-fp16 (SD 1.5) | **SELECTED BASE** — black 0.107, earthy 0.873, cool 0.0, silhouette fill 0.864, banner entropy 3.86 |
| eval_00002 | pixelArtDiffusionXL_spriteShaper (SDXL) | rejected base — pixel-art identity, earthy only 0.521, cool 0.225, busy (entropy 4.60). Documented as alternative identity, not the direction |
| eval_00003 | ponyDiffusionV6XL (SDXL) | rejected base — no ink outlines (black 0.0), flat contrast 0.135, weak subject (fill 0.435) |
| eval-hunyuan | hunyuan_dit_1.2 | NOT USABLE — weights are diffusers-format (`model.blocks.*`), not loadable by this ComfyUI (0.34.0) setup: CheckpointLoaderSimple yields model=None; also needed `models_t5_umt5-xxl-enc-bf16.pth` (32k T5) + separate `hunyuan_video_vae_bf16` VAE. Would need a weight-conversion step; skipped per no-new-dependencies rule |

Metrics from `comfyui/analyze.py` (dev tool; run with the ComfyUI venv python).

## Subject prompt variants

- **A** (base): `woolly mammoth with huge curved tusks charging across a dry savanna, two tiny prehistoric hunters with spears and clubs running after it for scale, kicked-up dust, dynamic motion, wide horizontal banner composition, mammoth large in center-left, open negative space in the sky on the right`
- **B** (cliff): `woolly mammoth with huge curved tusks running along a rocky cliff edge, small prehistoric hunters with spears in pursuit, dust and loose rocks, dramatic low sun light, wide horizontal banner composition, open sky negative space top right`
- **C** (river): `woolly mammoth with huge curved tusks charging through a shallow river, splashing water, two small prehistoric hunters with spears leaping after it, wide horizontal banner composition, open negative space top left`

## Iterations

### v1 prompt (workflow `mammoth-hunt.json`) — 8 generations, 2026-08-31

| seed | variant | metrics (black/earthy/negsp/silfill/entropy) | verdict |
|------|---------|----------------------------------------------|---------|
| 101 | A | 0.177 / 0.992 / 0.508 / 0.98 / 3.10 | rejected — "too much shadow" (user); heaviest ink of the set |
| 202 | A | 0.239 / 0.846 / 0.471 / 0.78 / 3.75 | rejected — "too messed up, looks like early image gen where everything is wrong" (user) |
| 303 | A | 0.060 / 0.987 / 0.499 / 0.63 / 4.32 | rejected — "nice perspective but looks a bit like slop" (user); busiest of the set |
| **404** | A | 0.057 / 0.995 / 0.667 / 0.86 / 4.06 | **SELECTED** — user's favorite: airy, painterly, strong composition, clean |
| 505 | B | 0.043 / 0.977 / 0.778 / 0.79 / 3.40 | rejected — not picked |
| 606 | B | 0.011 / 0.996 / 0.888 / 1.00 / 2.93 | rejected — "nice perspective but a bit like slop" (user); flattest contrast |
| 707 | C | 0.121 / 0.978 / 0.613 / 0.65 / 4.36 | rejected — not picked (busiest river) |
| 808 | C | 0.001 / 1.000 / 0.598 / 0.72 / 2.89 | runner-up — user also liked it (river), s404 preferred |

### v2 prompt (workflow `mammoth-hunt-v2.json`) — 6 generations, 2026-08-31

Tuned from user feedback: "clean confident outlines" (not heavy ink), bright
directional sunlight (not side shadow), explicit "strong perspective",
anti-slop negatives ("generic fantasy art, video game splash art, anachronistic,
modern objects, heavy dark shadows, gloomy, muddy colors").

| seed | variant | metrics (black/earthy/cool/negsp/entropy) | verdict |
|------|---------|-------------------------------------------|---------|
| 411 | A | 0.017 / 0.979 / 0.001 / 0.775 / 3.84 | rejected — very busy (edge density 23.0) |
| 422 | A | 0.020 / 0.880 / 0.093 / 0.972 / 2.52 | rejected — too sparse/flat (contrast 0.087) |
| 433 | A | 0.370 / 0.690 / 0.003 / 0.528 / 3.16 | rejected — heavy ink returned (0.37 black) |
| 444 | A | 0.000 / 0.320 / 0.677 / 0.807 / 2.47 | rejected — palette drift (68% cool hues) |
| 818 | C | 0.010 / 1.000 / 0.000 / 0.852 / 1.97 | rejected — too sparse/flat (entropy 1.97) |
| 828 | C | 0.001 / 0.441 / 0.556 / 0.942 / 2.86 | rejected — palette drift (56% cool hues) |

**Outcome: no v2 candidate beat s404; s404 ships.** Total meaningful
generations for this card: 14 (8 v1 + 6 v2) + 3 checkpoint evals.
Lesson for future cards: the v1 style block with "strong dramatic side
lighting" produced the drama/contrast the maintainer liked; v2's "bright
directional sunlight" washed out the value structure and let the palette
drift cool. Prefer v1-style lighting, vary seeds, and keep "strong
perspective" in the subject line.

## Failure notes (kept, not sanitized)

- My first metric pass over-weighted `black_ratio` (heavy ink) and shortlisted
  s101, which the maintainer rejected as too shadowy. The metrics are a
  screening aid, not an oracle; the maintainer's visual pick wins.
- v2's anti-slop negatives did not stop palette drift on 2 of 6 seeds.
