# CavePerson — shared ComfyUI style blocks

These blocks are the core of the visual direction (see `VISUAL_DIRECTION.md`).
Every CavePerson generation MUST use this style block so assets stay coherent.
Copy the positive block verbatim, then append the per-asset subject/composition
line. Adjust wording only if a specific asset needs it, and note the change in
the asset's prompt record.

## Positive style block — v3 (current, verbatim)

```
bold graphic illustration, prehistoric graphic novel style, heavy confident black ink outlines, flat matte painted colors, simplified bold shapes, strong silhouettes, dramatic dynamic composition, earthy prehistoric color palette of ochre amber burnt sienna bone white and moss green, strong dramatic side lighting, raw energetic feel, textured natural environment, minimal clutter
```

## Negative block — v3 (current, verbatim)

```
photorealistic, photograph, 3d render, cgi, glossy, shiny, anime, manga, cartoon, cute, chibi, clip art, sticker, text, words, letters, numbers, typography, watermark, signature, logo, user interface, ui, buttons, menu, frame, border, multiple frames, busy, cluttered, excessive detail, noise, grainy, blurry, low quality, deformed, malformed, extra limbs, extra arms, extra legs, extra fingers, bad anatomy, heavy dark shadows, gloomy, muddy colors, generic fantasy art, video game splash art, anachronistic, modern objects, realistic, cinematic
```

v3 is v1's positive wording (heavy ink + strong side lighting) plus v2's
anti-slop negatives, with `realistic, cinematic` appended. It is compatible
with the shipped Mammoth Hunt banner (v1) — the same positive phrasing.

## v2 -> v3 revision (why)

Round 1 of the Prompt 5 expansion (7 new banners + background) used the v2
block. The maintainer rejected most of it: the v2 positive ("bright dramatic
directional sunlight" + "strong perspective") pushed SD 1.5 toward
semi-realism — "too realistic, lost all the art quality" (Flint Road), and
several cards read as flat/empty. This matches the Mammoth lesson (the v1
"strong dramatic side lighting" block produced the drama/contrast that won
the s404 selection; v2 washed it out). v3 therefore reverts the positive to
the v1 wording, keeps v2's anti-slop negatives (which did their job), and
adds `realistic, cinematic` to push back on the realism drift.

## v1 -> v2 revision (why)

v1 used "heavy confident black ink outlines" + "strong dramatic side
lighting". Playtest of 8 candidates: the user preferred the lighter,
painterly results (savanna s404, river s808) and rejected the heaviest-inked
one as "too much shadow", plus two "slop" looks. v2 therefore: ink -> "clean
confident outlines", side light -> "bright dramatic directional sunlight",
adds "painterly texture" + "strong perspective", and negatives gain
"heavy dark shadows, gloomy, muddy colors, generic fantasy art, video game
splash art, anachronistic, modern objects". (Superseded by v3 — see above.)

## Ground rules (do not violate)

- No generated text of any kind in the image (titles, slot names, numbers,
  dice values, UI labels all stay dynamic Pixi elements).
- No UI frames/borders baked into the artwork — card framing is drawn in Pixi.
- Leave usable negative space where the game will overlay dynamic info
  (the Mammoth Hunt banner keeps the right side / sky quiet for the title).
- Tone: dangerous but with energy and personality — a competitive prehistoric
  dice game, not grim survival horror.
- Silhouette test: the main subject must be readable as a pure silhouette.

## Model/sampler defaults (update when the selected model changes)

See the per-asset prompt records and the workflow JSONs — the workflow files
are the source of truth for exact settings.
