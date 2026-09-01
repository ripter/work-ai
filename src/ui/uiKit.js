// Minimal PixiJS UI kit. Deliberately small: text, buttons, panels,
// destroy helper. Dice rendering/drag lives in dieView.js (Prompt 3).

import { Container, Graphics, Text } from "pixi.js";

// Logical canvas size (desktop-first). The canvas is CSS-scaled to fit
// the window; pointer coordinates are handled by Pixi under the scaling.
export const W = 1280;
export const H = 800;

// CavePerson palette (Prompt 4 visual direction): warm charcoal/hide browns,
// bone-white text, ochre accent, moss/blood feedback colors.
export const C = {
  bg: 0x171210,
  panel: 0x251c12,
  panelAlt: 0x2e2318,
  border: 0x8a7455,
  dim: 0x6e5f49,
  text: 0xf2e8d5,
  faint: 0xbfae94,
  green: 0x8fc74f,
  red: 0xd94f30,
  yellow: 0xe8a33d,
  blue: 0x7fa8c9,
  // stone/hide frame edges for panels
  frameDark: 0x3d3122,
  frameLight: 0x5a4a33,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function txt(str, size = 13, color = C.text, opts = {}) {
  const t = new Text({
    text: String(str),
    style: {
      fill: color,
      fontSize: size,
      fontFamily: opts.display ? "'Trebuchet MS', 'Avenir Next', sans-serif" : "monospace",
      fontWeight: opts.bold || opts.display ? "bold" : "normal",
      letterSpacing: opts.display ? Math.max(1, Math.round(size * 0.08)) : 0,
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

// Stone/hide framing: dark outer edge + lighter worn inner line.
export function panel(x, y, w, h, fill = C.panel) {
  return new Graphics()
    .roundRect(x, y, w, h, 8)
    .fill(fill)
    .roundRect(x, y, w, h, 8)
    .stroke({ width: 2, color: C.frameDark })
    .roundRect(x + 2.5, y + 2.5, w - 5, h - 5, 6)
    .stroke({ width: 1, color: C.frameLight });
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
      .fill(enabled ? 0x453423 : C.panelAlt)
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
