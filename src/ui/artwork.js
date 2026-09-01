// Artwork registry (Prompt 4 — visual direction).
//
// Event cards reference generated banners by id via their data def's `art`
// field (src/data/events.js). This module maps id -> imported asset. Vite
// processes the imports, so the production build stays a plain static site —
// the game has NO runtime dependency on ComfyUI (development-time pipeline
// lives in comfyui/, finished assets in assets/final/).

import { Container, Graphics, Texture } from "pixi.js";
import mammothHuntBanner from "../../assets/final/mammoth-hunt-banner.png";

// Height of the banner art band at the top of an Event Card.
export const ART_BANNER_H = 96;

// Pixi v8 note: Texture.from(string) does NOT load URLs — it looks up the
// Assets cache by label. So banners are preloaded with plain Image elements
// at module import time; the Texture appears in the map once decoded and
// cards render with the plain header until then.
const bannerTextures = new Map(); // art id -> Texture (ready only)
const bannerDims = new Map(); // art id -> { w, h } natural image pixels
const bannerState = new Map(); // art id -> "loading" | "ready" | "error: ..."
const BANNERS = {
  "mammoth-hunt": mammothHuntBanner,
};

for (const [id, url] of Object.entries(BANNERS)) {
  bannerState.set(id, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    try {
      // Natural dims are captured now: in Pixi v8 a Texture's own width/
      // height stay 0 until first GPU upload, so layout math must not use
      // them on the frame the banner first appears.
      bannerDims.set(id, { w: img.width, h: img.height });
      bannerTextures.set(id, Texture.from(img));
      bannerState.set(id, "ready");
    } catch (e) {
      bannerState.set(id, "error: " + e.message);
    }
  };
  img.onerror = () => bannerState.set(id, "error: image load failed");
  img.src = url;
}

export function bannerTexture(id) {
  return bannerTextures.get(id) ?? null;
}

export function bannerSize(id) {
  return bannerDims.get(id) ?? null;
}

// Resource icons are drawn as vectors (not generated images): at the 12-14px
// sizes they appear at, hand-drawn silhouettes are strictly clearer than
// diffusion output (8 generated attempts were tried and rejected — see
// comfyui/prompts/icons.md).
//
// Design rule for this size: ONE bold solid-color silhouette per icon, no
// thin outlines (they dissolve into mud at 12px), high contrast against the
// dark panels, and the shape fills most of its box. Distinct colors keep the
// three resources readable at a glance.
const ICON_FOOD = 0xe0863f; // warm meat orange
const ICON_TOOLS = 0xb3aa9d; // light stone gray
const ICON_POP = 0xe6d9bd; // bone white

// First resource kind a reward touches (for a small leading icon).
export function rewardKind(reward) {
  if (reward.food) return "food";
  if (reward.tools) return "tools";
  if (reward.population) return "population";
  if (reward.kill) return "population";
  if (reward.steal) return "tools";
  return null;
}

// Draw a resource icon (food / tools / population) at `size` px, origin at
// (0,0). A single bold solid silhouette — legible at 12px.
export function resourceIcon(kind, size) {
  const s = size;
  const g = new Graphics();
  if (kind === "food") {
    // Drumstick: meat ball on top, bone with two knobs below — one solid color.
    const c = ICON_FOOD;
    g.circle(0.5 * s, 0.34 * s, 0.3 * s).fill(c);
    g.roundRect(0.41 * s, 0.5 * s, 0.18 * s, 0.34 * s, 0.09 * s).fill(c);
    g.circle(0.37 * s, 0.86 * s, 0.13 * s).fill(c);
    g.circle(0.63 * s, 0.86 * s, 0.13 * s).fill(c);
  } else if (kind === "tools") {
    // Stone axe: wide blade on top, short handle below — one solid color.
    const c = ICON_TOOLS;
    g.poly([
      [0.18 * s, 0.12 * s],
      [0.82 * s, 0.12 * s],
      [0.62 * s, 0.5 * s],
      [0.38 * s, 0.5 * s],
    ]).fill(c);
    g.roundRect(0.43 * s, 0.46 * s, 0.14 * s, 0.42 * s, 0.06 * s).fill(c);
  } else if (kind === "population") {
    // Person: round head on top, rounded body below — one solid color.
    const c = ICON_POP;
    g.circle(0.5 * s, 0.27 * s, 0.21 * s).fill(c);
    g.roundRect(0.26 * s, 0.52 * s, 0.48 * s, 0.38 * s, 0.24 * s).fill(c);
  }
  return new Container().addChild(g);
}

// Left-dark -> transparent horizontal gradient, for title readability over
// banner art. Built once from a canvas (no generated asset needed).
let scrimTex = null;
export function scrimTexture() {
  if (!scrimTex) {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 16;
    const g = cv.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(12,9,6,0.82)");
    grad.addColorStop(0.55, "rgba(12,9,6,0.38)");
    grad.addColorStop(1, "rgba(12,9,6,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 16);
    scrimTex = Texture.from(cv);
  }
  return scrimTex;
}

// Debug/verification handle: which banners are registered and loaded.
// Note: "loaded" tracks our Image predecode, not Texture.valid — Pixi v8
// has no Texture.valid, and texture width/height only become nonzero after
// first GPU upload.
export function artworkDebug() {
  const out = {};
  for (const [id, url] of Object.entries(BANNERS)) {
    const d = bannerDims.get(id);
    out[id] = {
      url,
      state: bannerState.get(id) ?? "unknown",
      loaded: Boolean(d),
      w: d ? d.w : 0,
      h: d ? d.h : 0,
    };
  }
  return out;
}
