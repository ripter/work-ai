# comfyui/ — local art pipeline (development-time only)

Turns ComfyUI API workflow JSON into generated PNGs with full provenance.
The game build has **no runtime dependency on ComfyUI** — this directory is
for producing and re-producing assets. Finished art is committed to
`assets/final/`; every generation's source image + parameters stay in
`assets/generated/` so any shipped asset can be traced back to its workflow,
seed, and settings.

## Requirements

- A running local ComfyUI server (default `127.0.0.1:8188`). On this machine:
  `$HOME/dev/ComfyUI`, started as usual. Outputs land in
  ComfyUI's own `output/` dir; this pipeline downloads them from the API.
- Python 3 (stdlib only) for `generate.py` and `analyze.py`.
  For `analyze.py`, use the ComfyUI venv (has PIL/numpy):
  `$HOME/dev/ComfyUI/.venv/bin/python`.

## Generate

```sh
python3 comfyui/generate.py comfyui/workflows/<workflow>.json --seed 404
# multiple seeds in one run:
python3 comfyui/generate.py comfyui/workflows/<workflow>.json --seed 404 --seed 405
```

- `workflow` — ComfyUI **API-format** workflow JSON (node graph, not the UI
  export). The checked-in workflows in `comfyui/workflows/` are all
  API-format.
- `--seed` — seed for one output; repeatable. The seed is patched into the
  workflow's KSampler node(s) before submission.
- `--host` — ComfyUI host:port (default `127.0.0.1:8188`).
- `--outdir` — where sources are written (default `assets/generated`).
- `--timeout` — per-job timeout seconds (default 900).

For each seed the script:
1. POSTs the workflow to `/prompt`.
2. Polls `/history/<id>` until complete (or timeout).
3. Downloads each output image via `/view` into
   `assets/generated/<workflow-stem>_<seed:05d>.png`.
4. Writes a sibling `.meta.json` sidecar: source workflow path, seed,
   ComfyUI execution report (model, sampler, steps, cfg, sizes), timestamp,
   and the raw output filename.

The `.meta.json` sidecar is the provenance record — never hand-edit a
`assets/generated/*` PNG without keeping its sidecar in sync.

## Analyze / contact sheets

```sh
$HOME/dev/ComfyUI/.venv/bin/python comfyui/analyze.py <img1> <img2> ...
$HOME/dev/ComfyUI/.venv/bin/python comfyui/analyze.py <imgs...> --sheet /tmp/sheet.png
```

Prints per-image metrics used to compare candidates (dark-ink ratio,
earthy-palette ratio, negative-space, subject fill, banner-crop entropy) and
optionally writes a labeled contact sheet for the maintainer to eyeball.
These are heuristics for shortlisting — final selection is always a human
judgment on the sheet.

## Directory layout

```
comfyui/
  generate.py          # workflow JSON -> assets/generated (stdlib only)
  analyze.py           # candidate metrics + contact sheets (PIL/numpy)
  workflows/           # ComfyUI API-format workflows (one per asset family)
    mammoth-hunt.json  # workflow of record for the shipped mammoth banner
    mammoth-hunt-v2.json
    icon-*.json        # (rejected) generated-icon attempts, kept for the record
    eval-*.json        # checkpoint-evaluation workflows (seed 424242)
  prompts/
    STYLE.md           # shared positive/negative style blocks (the direction)
    mammoth-hunt.md    # full generation record: evals, iterations, selection
    icons.md           # icon attempts, rejections, vector-icon decision
```

## Conventions

- **Style blocks live in `prompts/STYLE.md`** and are the single source of
  the look. Every new asset's prompt starts from the current block verbatim
  (see the v1 -> v2 revision notes there for why wording changes matter).
- **One workflow file per asset family**, named after the asset
  (`mammoth-hunt.json`). Keep the exact workflow that produced a shipped
  asset — do not "clean up" a workflow after its asset is chosen.
- **Record everything** in the asset's prompt record: settings, every
  generation's seed + verdict (including rejections and *why*), and the
  selection. This is what makes the pipeline reproducible.
- **Provenance chain:** `assets/final/<name>` (shipped) <-
  `assets/generated/<stem>_<seed>.png` (source) <- its `.meta.json` <-
  `comfyui/workflows/<wf>.json` <- `comfyui/prompts/STYLE.md`.
- Do not download new models or custom nodes as part of a task without
  asking — the pipeline must keep working against the models already on disk.
