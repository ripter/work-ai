# Raiding Party — generation record

Workflows (source of truth for settings):
- Round 1: `comfyui/workflows/raiding-party.json` (v2 style block)
- Round 2: `comfyui/workflows/raiding-party-v2.json` (v3 style block)
- Round 3: `comfyui/workflows/raiding-party-v3.json` (v3 style, new subject)
- Round 4: `comfyui/workflows/raiding-party-v4-2614.json`,
  `...-v4-2615.json`, `...-v4-2616.json` (v3 style, close-up + group subjects)
Style blocks: `comfyui/prompts/STYLE.md`.

## SELECTED: seed 2616 (round 4, "raider group")

- Source: `assets/generated/caveperson/raiding-party-v4-2616_00001_.png` (1024x512)
- Banner: `assets/generated/caveperson/raiding-party-v4-2616-banner_00001_.png`
  -> shipped as `assets/final/raiding-party-banner.png` (1024x208)
- Full parameters: sidecar `.meta.json` (seed 2616, steps 25, cfg 6.0,
  dpmpp_2m/karras, workflow `comfyui/workflows/raiding-party-v4-2616.json`)
- Chosen by the maintainer: "2616 raider group."

## Settings used

- Model: `v1-5-pruned-emaonly-fp16.safetensors` (SD 1.5)
- Size: 1024x512 (2:1), center-cropped in-workflow to 1024x208 banner
- Sampler: dpmpp_2m / karras, steps 25, cfg 6.0
- Post: none (banner ships as-is; displayed at 470x96)

## Subject lines (one per round)

- R1 (v2): `crouched prehistoric warrior with a spear and painted face moving
  low through tall dry grass, dramatic low sun light, tension and stealth, wide
  horizontal banner composition, warrior large in center-right, open quiet sky
  in the top left`
- R2 (v3): `a fierce prehistoric warrior crouching low with a long spear,
  painted face, mid-lunge through tall dry grass, dramatic low side light, wide
  horizontal banner composition, warrior large in the lower center of the frame,
  quiet sky only in the top third`
- R3 (v3): `a prehistoric raider charging forward in a big dynamic leap, spear
  raised high, painted face, kicking up dust behind him, dramatic sunset side
  lighting, wide horizontal banner composition, raider large in the center of
  the frame, full body visible in the middle band of the image`
- R4 (v3, three variants):
  - 2614: `extreme close-up of a fierce prehistoric raider's painted face,
    snarling, war paint streaks, a raised spear tip crossing the frame, strong
    dramatic side lighting, wide horizontal banner composition, face large in
    the center filling the middle band of the image`
  - 2615: `close-up of a prehistoric raider gripping a long spear across his
    chest, painted face, intense stare, dramatic low side light, wide horizontal
    banner composition, figure and spear large in the center filling the middle
    band of the image`
  - 2616: `a band of prehistoric raiders charging, multiple large figures with
    spears raised and painted faces, kicking up dust, strong side lighting, wide
    horizontal banner composition, raiders large in the center filling the
    middle band of the image`

## Iterations

### Round 1 (workflow `raiding-party.json`, v2) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 1601 | 0.000 / 1.000 / 0.000 / 1.000 / 0.029 / 1.38 / 1.00 | rejected — empty crop (entropy 1.38) |
| 1602 | 0.042 / 0.997 / 0.000 / 0.999 / 0.186 / 4.29 / 1.00 | rejected — "all of them suck" (user) |
| 1603 | 0.000 / 0.996 / 0.001 / 0.746 / 0.194 / 3.23 / 0.75 | rejected — "all of them suck" (user) |

### Round 2 (workflow `raiding-party-v2.json`, v3) — 3 generations, 2026-09-02

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 2601 | 0.002 / 0.998 / 0.000 / 0.989 / 0.060 / 2.22 / 1.00 | rejected — flat |
| 2602 | 0.183 / 0.994 / 0.000 / 0.498 / 0.232 / 3.90 / 0.57 | rejected — "mostly solid color" (user) |
| 2603 | 0.000 / 0.999 / 0.000 / 0.999 / 0.018 / 0.96 / 1.00 | rejected — empty (entropy 0.96) |

### Round 3 (workflow `raiding-party-v3.json`, v3, "charging leap") — 3 gens

| seed | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|------------------------------------------------------------|---------|
| 2611 | 0.000 / 0.992 / 0.000 / 0.800 / 0.130 / 3.11 / 0.93 | rejected — "just some land and not much else" (user) |
| 2612 | 0.004 / 0.995 / 0.000 / 0.960 / 0.101 / 3.28 / 1.00 | rejected — same |
| 2613 | 0.002 / 0.991 / 0.001 / 0.993 / 0.067 / 2.73 / 1.00 | rejected — same |

### Round 4 (workflows `raiding-party-v4-*`, v3, close-ups + group) — 3 gens

| seed | variant | metrics (black/earthy/cool/negsp/contrast/entropy/silfill) | verdict |
|------|---------|------------------------------------------------------------|---------|
| 2614 | face close-up | 0.141 / 0.973 / 0.000 / 0.531 / 0.205 / 4.34 / 0.91 | rejected — not picked (strong, but a lone face) |
| 2615 | figure + spear | 0.120 / 0.857 / 0.003 / 0.692 / 0.165 / 3.54 / 0.62 | rejected — not picked |
| **2616** | raider group | 0.217 / 0.710 / 0.100 / 0.341 / 0.285 / 3.04 / 0.53 | **SELECTED** — "2616 raider group" |

**Outcome: s2616 ships (round 4).** Four rounds, 12 generations — the most of
any Prompt 5 card.

## Failure notes / lesson (kept, not sanitized)

- A **lone human figure in a wide 2:1 banner** is the one subject SD 1.5
  reliably fails for this style: rounds 1-3 cropped to flat grass/sky or a tiny
  illegible figure ("just some land"). The cards that resolved in one or two
  rounds all had a **large non-human mass** (herd, river, stone ring, cairn,
  cave wall).
- The fix that worked: make the subject **fill the frame** — a group of large
  figures (2616) or a close-up (2614/2615). The group read as "raiding party"
  and was picked.
- Standing rule for future human-figure banners: use a group or a close-up,
  never a single small figure in a wide landscape.
