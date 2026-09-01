#!/usr/bin/env python3
"""CavePerson image analysis (development-time only, needs PIL+numpy).

Computes objective metrics that map to the CavePerson visual direction
(see comfyui/prompts/STYLE.md) so candidates can be compared without
relying on eyeballing alone:

  black_ratio       fraction of near-black pixels (heavy ink outlines)
  edge_density      mean gradient magnitude (detail level)
  earthy_ratio      fraction of pixels in the earthy prehistoric palette
  cool_ratio        fraction of pixels in non-earthy cool hues (penalty)
  negative_space    fraction of low-activity (quiet) image area
  value_contrast    luminance std (dramatic lighting = high)
  silhouette_fill   largest dark/foreground blob vs its bounding box
  banner_entropy    grayscale entropy at final banner size (readability)

Usage:
  ComfyUI-venv-python comfyui/analyze.py img1.png img2.png ... [--sheet out.png]

On this machine: $HOME/dev/ComfyUI/.venv/bin/python
"""

import argparse
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = None  # not needed; paths come from args


def to_arrays(path):
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im, dtype=np.float32) / 255.0
    return im, arr


def hsv(arr):
    import colorsys
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    mask = mx == r
    h[mask] = ((g[mask] - b[mask]) / d[mask]) % 6
    mask = (mx == g) & ~mask
    h[mask] = (b[mask] - r[mask]) / d[mask] + 2
    mask = (mx == b) & ~(mask | (mx == r))
    h[mask] = (r[mask] - g[mask]) / d[mask] + 4
    h = (h / 6.0) % 1.0
    return h * 360.0, s, v


def analyze(path):
    im, arr = to_arrays(path)
    h, s, v = hsv(arr)
    lum = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]

    gray = np.asarray(im.convert("L"), dtype=np.float32) / 255.0
    gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edge_density = float((gx + gy).mean() * 255)

    # earthy: ochre/amber/brown (hue 15-55, any sat), bone/tan (low sat, mid-hi
    # value), moss/olive green (hue 55-150, sat < 0.75, value < 0.85)
    earthy = (
        ((h >= 15) & (h <= 55))
        | ((s < 0.22) & (v > 0.35))
        | ((h > 55) & (h <= 150) & (s < 0.75) & (v < 0.85))
    )
    # cool (penalty): blue/cyan/purple/magenta
    cool = ((h > 160) & (h < 340)) & (s > 0.2)

    # local activity (negative space): blur luminance, measure residual
    small = np.asarray(
        im.convert("L").resize((128, 128)).filter(ImageFilter.GaussianBlur(2)),
        dtype=np.float32,
    ) / 255.0
    base = small.filter(ImageFilter.GaussianBlur(6)) if False else None
    from PIL import ImageOps

    b_im = Image.fromarray((small * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))
    base = np.asarray(b_im, dtype=np.float32) / 255.0
    quiet = float((np.abs(small - base) < 0.06).mean())

    # silhouette: threshold foreground = notably darker or more saturated than
    # the median background; largest blob fill ratio
    fg = (lum < 0.55) | (s > 0.5)
    fg = fg.astype(np.uint8)
    f_im = Image.fromarray(fg * 255)
    f_im = f_im.filter(ImageFilter.MedianFilter(5))
    f_im = f_im.filter(ImageFilter.MaxFilter(5))
    f_arr = np.asarray(f_im) > 127
    # crude connected components via scipy if available, else bbox fill
    try:
        from scipy import ndimage

        lab, n = ndimage.label(f_arr)
        if n:
            sizes = ndimage.sum(f_arr, lab, range(1, n + 1))
            big = (lab == (int(np.argmax(sizes)) + 1))
            ys, xs = np.where(big)
            fill = float(big.sum() / ((ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)))
            frac = float(big.mean())
        else:
            fill, frac = 0.0, 0.0
    except ImportError:
        ys, xs = np.where(f_arr)
        if len(ys):
            fill = float(f_arr.sum() / ((ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)))
            frac = float(f_arr.mean())
        else:
            fill, frac = 0.0, 0.0

    # banner readability: downscale to actual display size, grayscale entropy
    bw, bh = 470, 96
    ban = np.asarray(im.convert("L").resize((bw, bh)), dtype=np.float32) / 255.0
    hist, _ = np.histogram(ban, bins=32, range=(0, 1))
    p = hist / hist.sum()
    p = p[p > 0]
    entropy = float(-(p * np.log2(p)).sum())

    return {
        "file": path,
        "size": [im.width, im.height],
        "black_ratio": round(float((v < 0.16).mean()), 3),
        "edge_density": round(edge_density, 1),
        "earthy_ratio": round(float(earthy.mean()), 3),
        "cool_ratio": round(float(cool.mean()), 3),
        "negative_space": round(quiet, 3),
        "value_contrast": round(float(lum.std()), 3),
        "silhouette_fill": round(fill, 3),
        "foreground_frac": round(frac, 3),
        "banner_entropy": round(entropy, 3),
    }


def sheet(paths, out, cols=2, cell_w=640):
    ims = []
    for p in paths:
        im, _ = to_arrays(p)
        scale = cell_w / im.width
        ims.append((im.resize((cell_w, int(im.height * scale))), p.split("/")[-1]))
    rows = math.ceil(len(ims) / cols)
    cell_h = max(i.height for i, _ in ims)
    label_h = 24
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h)), (20, 18, 16))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 16)
    except Exception:
        font = ImageFont.load_default()
    for idx, (im, name) in enumerate(ims):
        r, c = divmod(idx, cols)
        y = r * (cell_h + label_h)
        x = c * cell_w
        d.text((x + 6, y + 4), name, fill=(255, 220, 160), font=font)
        sheet.paste(im, (x, y + label_h))
    sheet.save(out)
    print(f"sheet saved: {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--sheet", default=None)
    args = ap.parse_args()
    results = [analyze(p) for p in args.images]
    print(json.dumps(results, indent=1))
    if args.sheet:
        sheet(args.images, args.sheet)


if __name__ == "__main__":
    main()
