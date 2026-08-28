// Minimal PixiJS UI kit for the debug screens (Prompt 2).
// Deliberately small: text, buttons, dice squares, destroy helper.

import { Container, Graphics, Text } from "pixi.js";

export const W = 960;
export const H = 640;

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

export function button(parent, x, y, w, h, label, onTap, enabled = true) {
  const g = new Container();
  g.addChild(
    new Graphics()
      .rect(0, 0, w, h)
      .fill(enabled ? 0x3a2d6b : 0x2b2444)
      .stroke({ width: 1, color: enabled ? C.border : C.dim })
  );
  const t = txt(label, 13, enabled ? C.text : 0x776f95);
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

export function dieSquare(parent, x, y, value, onTap, selected) {
  const s = new Container();
  s.addChild(
    new Graphics()
      .rect(0, 0, 34, 34)
      .fill(selected ? 0x4a5a23 : 0x241b3f)
      .stroke({ width: selected ? 2 : 1, color: selected ? C.yellow : C.dim })
  );
  const t = txt(value, 18, C.text);
  t.anchor.set(0.5);
  t.x = 17;
  t.y = 17;
  s.addChild(t);
  s.x = x;
  s.y = y;
  if (onTap) {
    s.eventMode = "static";
    s.cursor = "pointer";
    s.on("pointertap", onTap);
  }
  parent.addChild(s);
  return s;
}

// Transparent hit area over a rect (for slots / tribe panels).
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
