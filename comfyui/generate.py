#!/usr/bin/env python3
"""CavePerson ComfyUI generation runner (development-time tool only).

Runs a saved workflow JSON (ComfyUI API prompt format) against the local
ComfyUI instance, downloads the produced images into the project, and writes
a .meta.json sidecar next to each image so any asset can be reproduced
later without rediscovering the process.

Usage:
  python3 comfyui/generate.py <workflow.json> --seed 1234 [--seed 5678 ...]
                              [--host 127.0.0.1:8188]
                              [--outdir assets/generated]
                              [--timeout 900]

The script only sets the seed on KSampler-class nodes; every other parameter
(checkpoint, prompts, sampler, scheduler, steps, cfg, size, post-processing)
comes from the workflow JSON, which is the source of truth and is stored in
comfyui/workflows/.

The production game has NO dependency on ComfyUI or on this script: it only
consumes the finished files in assets/final/.
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def http_json(url, data=None, timeout=30):
    req = urllib.request.Request(url)
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=body, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def http_bytes(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read()


def set_seed(workflow, seed):
    n = 0
    for node in workflow.values():
        if node.get("class_type", "").startswith("KSampler") and "inputs" in node:
            node["inputs"]["seed"] = seed
            n += 1
    if n == 0:
        raise SystemExit("workflow has no KSampler node to seed")
    return n


def describe(workflow):
    """Extract the human-readable generation parameters for the sidecar."""
    info = {"nodes": {}}
    for nid, node in workflow.items():
        ct = node.get("class_type", "")
        ins = node.get("inputs", {})
        if ct.startswith("KSampler"):
            info["nodes"][nid] = {
                "class_type": ct,
                "seed": ins.get("seed"),
                "steps": ins.get("steps"),
                "cfg": ins.get("cfg"),
                "sampler": ins.get("sampler_name"),
                "scheduler": ins.get("scheduler"),
                "denoise": ins.get("denoise"),
            }
        elif ct == "CheckpointLoaderSimple":
            info["nodes"][nid] = {"class_type": ct, "ckpt_name": ins.get("ckpt_name")}
        elif ct == "LoraLoader":
            info["nodes"][nid] = {
                "class_type": ct,
                "lora_name": ins.get("lora_name"),
                "strength_model": ins.get("strength_model"),
                "strength_clip": ins.get("strength_clip"),
            }
        elif ct == "CLIPTextEncode":
            info["nodes"][nid] = {"class_type": ct, "text": ins.get("text")}
        elif ct == "EmptyLatentImage":
            info["nodes"][nid] = {
                "class_type": ct,
                "width": ins.get("width"),
                "height": ins.get("height"),
            }
        elif ct == "SaveImage":
            info["nodes"][nid] = {"class_type": ct, "filename_prefix": ins.get("filename_prefix")}
        elif ct == "Image Remove Background (rembg)":
            info["nodes"][nid] = {"class_type": ct, "model_name": ins.get("model_name")}
        elif ct in ("ImageCrop", "ImageScale", "ImageUpscaleWithModel"):
            info["nodes"][nid] = {"class_type": ct, "inputs": {k: v for k, v in ins.items()}}
    return info


def queue_prompt(base_url, workflow):
    return http_json(f"{base_url}/prompt", {"prompt": workflow}, timeout=60)


def wait_for_history(base_url, prompt_id, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        hist = http_json(f"{base_url}/history/{prompt_id}", timeout=30)
        entry = hist.get(prompt_id)
        if entry and entry.get("status", {}).get("status_str") in ("success", "error"):
            return entry
        time.sleep(2)
    raise SystemExit(f"timed out after {timeout}s waiting for {prompt_id}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("workflow", help="path to workflow JSON (ComfyUI API format)")
    ap.add_argument("--seed", type=int, action="append", required=True,
                    help="seed (repeatable for multiple generations)")
    ap.add_argument("--host", default="127.0.0.1:8188")
    ap.add_argument("--outdir", default=str(REPO_ROOT / "assets" / "generated"))
    ap.add_argument("--timeout", type=int, default=900)
    args = ap.parse_args()

    base_url = f"http://{args.host}"
    wf_path = Path(args.workflow)
    if not wf_path.is_absolute():
        wf_path = REPO_ROOT / wf_path
    outdir = Path(args.outdir)
    if not outdir.is_absolute():
        outdir = REPO_ROOT / outdir
    outdir.mkdir(parents=True, exist_ok=True)

    base_workflow = json.loads(wf_path.read_text())
    meta_base = {
        "workflow_file": str(wf_path.relative_to(REPO_ROOT)),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    for seed in args.seed:
        workflow = json.loads(json.dumps(base_workflow))  # deep copy
        set_seed(workflow, seed)
        params = describe(workflow)
        params.update(meta_base)
        params["seed"] = seed

        print(f"=== seed {seed}: queueing {wf_path.name} ===")
        res = queue_prompt(base_url, workflow)
        if "prompt_id" not in res:
            print(f"ERROR queueing prompt: {json.dumps(res)[:800]}", file=sys.stderr)
            sys.exit(1)
        prompt_id = res["prompt_id"]

        entry = wait_for_history(base_url, prompt_id, args.timeout)
        status = entry.get("status", {}).get("status_str")
        if status != "success":
            print(f"ERROR generation {prompt_id} failed: "
                  f"{json.dumps(entry.get('status'))[:800]}", file=sys.stderr)
            sys.exit(1)

        saved = []
        for node_id, node_out in entry.get("outputs", {}).items():
            for img in node_out.get("images", []):
                url = (f"{base_url}/view?filename={img['filename']}"
                       f"&subfolder={img.get('subfolder', '')}&type={img.get('type', 'output')}")
                dest_dir = outdir / img.get("subfolder", "")
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest = dest_dir / img["filename"]
                dest.write_bytes(http_bytes(url, timeout=120))
                meta = dict(params)
                meta["prompt_id"] = prompt_id
                meta["output_node"] = node_id
                meta["comfyui_filename"] = img["filename"]
                meta_path = dest.with_suffix(dest.suffix + ".meta.json")
                meta_path.write_text(json.dumps(meta, indent=2))
                saved.append(str(dest.relative_to(REPO_ROOT)))
                print(f"  saved {dest.relative_to(REPO_ROOT)} "
                      f"({dest.stat().st_size // 1024} KB)")

        if not saved:
            print(f"ERROR: no images in outputs of {prompt_id}", file=sys.stderr)
            sys.exit(1)
        print(f"=== seed {seed}: done ({len(saved)} image(s)) ===")


if __name__ == "__main__":
    main()
