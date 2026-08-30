// Placeholder die rendering + drag behavior (Prompt 3).
// No final artwork: rounded square + standard pip layout.
//
// A die is a Container the scene positions. The scene owns placement and
// state decisions; this module only draws the die, tracks visual state,
// and (optionally) handles pointer drag. Pixi v8 has no pointer capture,
// so while dragging the die listens on `dragTarget` (usually app.stage,
// which receives all bubbled pointer events):
//   pointerdown (canDrag()) -> drag starts, die follows the pointer
//   pointerup               -> onDrop(die, globalPoint, cancelled)
// The scene then repositions the die (tray cell / pool) and repaints.

import { Container, Graphics } from "pixi.js";
import { C } from "./uiKit.js";

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

// Bone-white face with dark pips reads as "physical die" on the dark theme.
const STATE_STYLE = {
  normal:  { fill: 0xf2ead8, border: 0x9a8f78, pip: 0x2b2b33 },
  hover:   { fill: 0xffffff, border: 0xd8d0bd, pip: 0x2b2b33 },
  drag:    { fill: 0xffffff, border: C.yellow, pip: 0x2b2b33 },
  kept:    { fill: 0xfff3c4, border: C.yellow, pip: 0x6b5900 },
  staged:  { fill: 0xdcebff, border: C.blue,   pip: 0x1e3a5f },
  valid:   { fill: 0xd9ffd9, border: C.green,  pip: 0x14521f },
  invalid: { fill: 0xffd9cf, border: C.red,    pip: 0x5f1a12 },
  dim:     { fill: 0x3a3350, border: 0x2b2444, pip: 0x6a5f8a },
};

export function makeDie({
  size,
  value = 1,
  interactive = true,
  canDrag = () => false,
  onDrop = null,
  onTap = null,
  dragTarget = null, // e.g. app.stage — receives all bubbled pointer events
} = {}) {
  const d = new Container();
  d.dieSize = size;
  d.baseY = 0; // resting y (scene sets); lifts/animation are relative to it
  let state = "normal";
  let val = value;
  let dragging = false;
  let grabDX = 0;
  let grabDY = 0;

  const bg = new Graphics();
  d.addChild(bg);

  function paint() {
    const s = STATE_STYLE[state] ?? STATE_STYLE.normal;
    const r = Math.max(4, size * 0.18);
    bg.clear();
    bg.roundRect(0, 0, size, size, r).fill(s.fill);
    bg.roundRect(0, 0, size, size, r).stroke({
      width: state === "normal" ? 1.5 : 2.5,
      color: s.border,
    });
    const pr = size * (val >= 4 ? 0.075 : 0.09);
    for (const [fx, fy] of PIPS[val] ?? PIPS[1])
      bg.circle(fx * size, fy * size, pr).fill(s.pip);
    if (!dragging) d.y = d.baseY + (state === "kept" ? -9 : state === "hover" ? -3 : 0);
  }

  d.setValue = (v) => {
    val = Math.max(1, Math.min(6, Math.round(v)));
    paint();
  };
  d.getValue = () => val;
  d.state = (s) => {
    state = s;
    paint();
  };
  d.stateName = () => state;
  d.isDragging = () => dragging;

  if (interactive) {
    d.eventMode = "static";
    d.on("pointerdown", (e) => {
      if (dragging || !canDrag()) return;
      dragging = true;
      d.cursor = "grabbing";
      grabDX = e.global.x - d.x;
      grabDY = e.global.y - d.y;
      d.zIndex = 100;
      d.state("drag");
      // v8 has no pointer capture: track the drag on the (stage-level)
      // drag target, which receives all bubbled pointer events.
      const target = dragTarget ?? d;
      const move = (ev) => {
        if (!dragging) return;
        d.x = ev.global.x - grabDX;
        d.y = ev.global.y - grabDY;
      };
      const end = (ev, cancelled) => {
        if (!dragging) return;
        dragging = false;
        d.zIndex = 0;
        d.cursor = "pointer";
        target.off("pointermove", move);
        target.off("pointerup", end);
        target.off("pointercancel", end);
        if (onDrop) onDrop(d, ev.global, cancelled);
      };
      target.on("pointermove", move);
      target.on("pointerup", end);
      target.on("pointercancel", end);
    });
    d.on("pointerover", () => {
      if (!dragging && (canDrag() || onTap)) d.state("hover");
    });
    d.on("pointerout", () => {
      if (!dragging && state === "hover") d.state("normal");
    });
    d.on("pointertap", (e) => {
      if (!canDrag() && onTap) onTap(d, e);
    });
  }

  d.setValue(value);
  return d;
}

// Cosmetic tumble: dice flash random values with a little bounce, then
// settle on the FINAL values supplied by the caller (which must be the
// game model's results). Pure presentation — never determines outcomes.
export function tumble(app, dice, finalValues, ms = 600, onDone) {
  if (dice.length === 0) {
    if (onDone) onDone();
    return;
  }
  const start = performance.now();
  const fn = () => {
    const el = performance.now() - start;
    const p = ms <= 0 ? 1 : Math.min(1, el / ms);
    for (let i = 0; i < dice.length; i++) {
      const d = dice[i];
      if (p >= 1) {
        d.setValue(finalValues[i]);
        d.scale.set(1);
        d.rotation = 0;
        d.y = d.baseY;
      } else {
        d.setValue(1 + Math.floor(Math.random() * 6));
        const t = p * Math.PI * (2 + (i % 3)) + i;
        d.scale.set(1 + 0.1 * (1 - p) * (0.5 + 0.5 * Math.sin(t * 2)));
        d.rotation = 0.3 * (1 - p) * Math.sin(t);
        d.y = d.baseY - (1 - p) * 8 * Math.abs(Math.sin(t));
      }
    }
    if (p >= 1) {
      app.ticker.remove(fn);
      if (onDone) onDone();
    }
  };
  app.ticker.add(fn);
}
