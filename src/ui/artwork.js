// Artwork registry (Prompt 4 — visual direction).
//
// Event cards reference generated banners by id via their data def's `art`
// field (src/data/events.js). This module maps id -> imported asset. Vite
// processes the imports, so the production build stays a plain static site —
// the game has NO runtime dependency on ComfyUI (development-time pipeline
// lives in comfyui/, finished assets in assets/final/).

import { Container, Graphics, Texture } from "pixi.js";
import mammothHuntBanner from "../../assets/final/mammoth-hunt-banner.png";
import riverFisheryBanner from "../../assets/final/river-fishery-banner.png";
import droughtBanner from "../../assets/final/drought-banner.png";
import greatMigrationBanner from "../../assets/final/great-migration-banner.png";
import spiritCaveBanner from "../../assets/final/spirit-cave-banner.png";
import flintRoadBanner from "../../assets/final/flint-road-banner.png";
import raidingPartyBanner from "../../assets/final/raiding-party-banner.png";
import standingStonesBanner from "../../assets/final/standing-stones-banner.png";
import sceneBackground from "../../assets/final/background.png";

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
  "river-fishery": riverFisheryBanner,
  "drought": droughtBanner,
  "great-migration": greatMigrationBanner,
  "spirit-cave": spiritCaveBanner,
  "flint-road": flintRoadBanner,
  "raiding-party": raidingPartyBanner,
  "standing-stones": standingStonesBanner,
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

// Scene background (Prompt 5): a single generated cave-wall backdrop that sits
// behind the whole play area. Loaded like the banners (plain Image predecode)
// and exposed as a ready-only texture; the scene falls back to its flat color
// until it decodes.
const bgState = { state: "loading", tex: null, w: 0, h: 0 };
const bgReadyCbs = [];
{
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    try {
      bgState.w = img.width;
      bgState.h = img.height;
      bgState.tex = Texture.from(img);
      bgState.state = "ready";
      for (const cb of bgReadyCbs.splice(0)) cb(bgState.tex);
    } catch (e) {
      bgState.state = "error: " + e.message;
    }
  };
  img.onerror = () => {
    bgState.state = "error: image load failed";
  };
  img.src = sceneBackground;
}

export function backgroundTexture() {
  return bgState.tex;
}

export function backgroundState() {
  return bgState;
}

// Register a one-shot callback for when the background texture decodes. If it
// is already ready the callback fires immediately with the texture.
export function onBackgroundReady(cb) {
  if (bgState.tex) {
    cb(bgState.tex);
    return;
  }
  if (bgState.state.startsWith("error")) return;
  bgReadyCbs.push(cb);
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
// dark panels, and the shape fills most of its box. Distinct colors and
// distinct orientations keep the three resources readable at a glance.
const ICON_FOOD = 0xe0863f; // warm orange (fish)
const ICON_TOOLS = 0xd0c7b5; // light stone (axe)
const ICON_POP = 0xe6d9bd; // bone white (person)

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
  // NOTE: in this Pixi v8 build, g.poly([[x,y],...]) (nested arrays) renders
  // NOTHING. Polygons must be PointData objects {x,y} (or moveTo/lineTo).
  const P = (x, y) => ({ x, y });
  if (kind === "food") {
    // Fish: horizontal body + triangular tail + a small dark eye. Reads as
    // "food" at 12px and is unmistakably different from the person icon.
    const c = ICON_FOOD;
    g.ellipse(0.42 * s, 0.5 * s, 0.34 * s, 0.25 * s).fill(c);
    g.poly([P(0.66 * s, 0.5 * s), P(0.95 * s, 0.27 * s), P(0.95 * s, 0.73 * s)]).fill(c);
    g.circle(0.26 * s, 0.44 * s, 0.055 * s).fill(0x2a1c10);
  } else if (kind === "tools") {
    // Stone axe: a wide, chunky blade on top + a thick handle below.
    const c = ICON_TOOLS;
    g.poly([
      P(0.08 * s, 0.1 * s),
      P(0.92 * s, 0.1 * s),
      P(0.68 * s, 0.52 * s),
      P(0.32 * s, 0.52 * s),
    ]).fill(c);
    g.roundRect(0.42 * s, 0.48 * s, 0.16 * s, 0.46 * s, 0.06 * s).fill(c);
  } else if (kind === "population") {
    // Person: round head on top, rounded body below — one solid color.
    const c = ICON_POP;
    g.circle(0.5 * s, 0.27 * s, 0.21 * s).fill(c);
    g.roundRect(0.26 * s, 0.52 * s, 0.48 * s, 0.38 * s, 0.24 * s).fill(c);
  }
  return new Container().addChild(g);
}

// Tribe badge (Prompt 5): one bold solid silhouette per seat, filled with the
// tribe's color. Replaces the plain color swatch in the tribe rows. Same
// small-size rules as resourceIcon: chunky shape, no thin outlines, distinct
// outline per seat so tribes read at a glance.
export function tribeBadge(seat, color, size) {
  const s = size;
  const g = new Graphics();
  const P = (x, y) => ({ x, y });
  const c = color;
  if (seat === 0) {
    // Spear: a tall vertical diamond.
    g.poly([P(0.5 * s, 0), P(0.8 * s, 0.5 * s), P(0.5 * s, s), P(0.2 * s, 0.5 * s)]).fill(c);
  } else if (seat === 1) {
    // Mountain: two peaks.
    g.poly([
      P(0, s),
      P(0.26 * s, 0.24 * s),
      P(0.5 * s, 0.6 * s),
      P(0.74 * s, 0.14 * s),
      P(s, s),
    ]).fill(c);
  } else if (seat === 2) {
    // Water: a teardrop (pointed top, round belly).
    g.poly([P(0.5 * s, 0), P(0.8 * s, 0.55 * s), P(0.2 * s, 0.55 * s)]).fill(c);
    g.circle(0.5 * s, 0.6 * s, 0.3 * s).fill(c);
  } else {
    // Sun: a disc with four chunky rays.
    g.circle(0.5 * s, 0.5 * s, 0.28 * s).fill(c);
    g.poly([P(0.5 * s, 0), P(0.64 * s, 0.24 * s), P(0.36 * s, 0.24 * s)]).fill(c);
    g.poly([P(0.5 * s, s), P(0.64 * s, 0.76 * s), P(0.36 * s, 0.76 * s)]).fill(c);
    g.poly([P(0, 0.5 * s), P(0.24 * s, 0.36 * s), P(0.24 * s, 0.64 * s)]).fill(c);
    g.poly([P(s, 0.5 * s), P(0.76 * s, 0.36 * s), P(0.76 * s, 0.64 * s)]).fill(c);
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
  out["background"] = {
    url: sceneBackground,
    state: bgState.state,
    loaded: Boolean(bgState.tex),
    w: bgState.w,
    h: bgState.h,
  };
  return out;
}
