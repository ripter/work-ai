# Resource icons (Food / Tools / Population) — generation record

Workflows: `comfyui/workflows/icon-food.json`, `icon-tools.json`,
`icon-population.json` (SD 1.5, 512x512, rembg cutout, lanczos 128px).

## Attempts (all REJECTED)

| asset | seed | rembg | outcome |
|-------|------|-------|---------|
| food | 901 (icon-food_00001) | u2net | clean cutout (alpha cov 0.40) — rejected: painterly, not icon-like at 14px |
| food | 902 (icon-food_00002) | u2net | cutout failed — object lost (alpha cov 0.02) |
| tools | 911 (icon-tools_00001) | u2net | okay cutout — rejected: same painterly problem |
| tools | 912 (icon-tools_00002) | u2net | okay cutout — rejected: same |
| population | 921 (icon-population_00001) | u2net | cutout failed (alpha cov 0.06) |
| population | 922 (icon-population_00002) | u2net | cutout failed — empty (alpha cov 0.00) |
| population | 931 (icon-population_00003) | isnet-general-use, "chunky/solid fill" prompt | best attempt (alpha cov 0.26) — still rejected |
| population | 932 (icon-population_00004) | isnet-general-use | weak (alpha cov 0.08) |

**User verdict (2026-08-31): "all the icons look like shit. there isn't a
single usable thing there."**

Failure analysis: SD 1.5 renders the icons as small *painted scenes* (soft
edges, background bleed, inconsistent framing), and rembg then fights the
soft edges. At the 12-14px display size none of them read as a clean symbol.

## Decision: Pixi vector icons

The task brief explicitly allows this: "If simple Pixi/vector-like icons are
substantially clearer than generated icons, use judgment. The objective is a
coherent game, not maximizing the percentage of assets produced by diffusion."

Implemented in `src/ui/artwork.js:resourceIcon(kind, size)`:
- Food: drumstick (bone capsule + meat blob)
- Tools: stone hand axe (leaf/teardrop, pointed cutting edge)
- Population: human figure + club
- Shared language with the dice: bone fill 0xe6d9bd, heavy dark outline
  0x46361f, flat fills, single silhouette.

Vector icons are crisp at any size, cost ~0 KB, and stay in the same visual
family as the (Pixi-drawn) dice.
