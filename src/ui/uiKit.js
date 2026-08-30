// Minimal PixiJS UI kit. Deliberately small: text, buttons, panels,
// destroy helper. Dice rendering/drag lives in dieView.js (Prompt 3).

import { Container, Graphics, Text } from "pixi.js";

// Logical canvas size (desktop-first). The canvas is CSS-scaled to fit
// the window; pointer coordinates are handled by Pixi under the scaling.
export const W = 1280;
export const H = 800;

export const C = {
  bg: 0x1d2b53,
  panel: 0x241b3f,
  panelAlt: 0x2b2444,
  border: 0x83769c,
  dim: 0x6a5f8a,
  text: 0xfff1e8,
  faint: 0xc2c3c7,
  green: 0x00e436,
  red: 0xe6553c,
  yellow: 0xf5d547,
  blue: 0x4d9de0,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function txt(str, size = 13, color = C.text, opts = {}) {
  const t = new Text({
    text: String(str),
    style: {
      fill: color,
      fontSize: size,
      fontFamily: "monospace",
      fontWeight: opts.bold ? "bold" : "normal",
      wordWrap: Boolean(opts.wrap),
      wordWrapWidth: opts.wrap ? opts.wrap : 0,
      lineHeight: Math.round(size * 1.3),
    },
  });
  if (opts.anchor) t.anchor.set(opts.anchor);
  return t;
}

export function place(t, x, y) {
  t.x = x;
  t.y = y;
  return t;
}

export function panel(x, y, w, h, fill = C.panel) {
  return new Graphics()
    .roundRect(x, y, w, h, 8)
    .fill(fill)
    .stroke({ width: 1, color: C.border });
}

export function button(
  parent,
  x,
  y,
  w,
  h,
  label,
  onTap,
  enabled = true,
  opts = {}
) {
  const g = new Container();
  const accent = opts.accent;
  g.addChild(
    new Graphics()
      .roundRect(0, 0, w, h, 6)
      .fill(enabled ? 0x3a2d6b : 0x2b2444)
      .stroke({
        width: enabled ? 1 : 1,
        color: enabled ? (accent ?? C.border) : C.dim,
      })
  );
  const t = txt(label, opts.font ?? 13, enabled ? (opts.labelColor ?? C.text) : 0x776f95, {
    bold: opts.bold,
  });
  t.anchor.set(0.5);
  t.x = w / 2;
  t.y = h / 2;
  g.addChild(t);
  g.x = x;
  g.y = y;
  if (enabled) {
    g.eventMode = "static";
    g.cursor = "pointer";
    g.on("pointertap", onTap);
  }
  parent.addChild(g);
  return g;
}

// Transparent hit area over a rect (for slot / tribe panels).
export function hitRect(parent, x, y, w, h, onTap) {
  const hit = new Graphics().rect(x, y, w, h).fill({ color: 0x000000, alpha: 0 });
  hit.eventMode = "static";
  hit.cursor = "pointer";
  hit.on("pointertap", onTap);
  parent.addChild(hit);
  return hit;
}

export function destroyAll(container) {
  for (const child of container.removeChildren()) child.destroy({ children: true });
}
