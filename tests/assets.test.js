// Asset/config loading tests (Prompt 4 — visual direction).
// Verifies the data-driven Event Card `art` field resolves to real
// game-ready files. No pixel assertions, no Pixi (node --test only).
//
// Convention (keep in sync with the BANNERS map in src/ui/artwork.js):
//   card def { art: "foo" }  ->  assets/final/foo-banner.png

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROTOTYPE_EVENTS } from "../src/data/events.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function pngInfo(path) {
  const buf = readFileSync(path);
  if (buf.length < 24) throw new Error("too small to be a PNG");
  const sig = buf.subarray(0, 8);
  const ok =
    sig[0] === 0x89 &&
    sig[1] === 0x50 &&
    sig[2] === 0x4e &&
    sig[3] === 0x47 &&
    sig[4] === 0x0d &&
    sig[5] === 0x0a &&
    sig[6] === 0x1a &&
    sig[7] === 0x0a;
  if (!ok) throw new Error("not a PNG signature");
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h, bytes: buf.length };
}

test("Mammoth Hunt card def carries an art id", () => {
  const card = PROTOTYPE_EVENTS.find((c) => c.id === "mammoth-hunt");
  assert.ok(card, "mammoth-hunt card must exist");
  assert.equal(typeof card.art, "string");
  assert.ok(card.art.length > 0, "art id must be non-empty");
});

test("every card with an art field resolves to a real file in assets/final/", () => {
  const arts = PROTOTYPE_EVENTS.filter((c) => c.art);
  assert.ok(arts.length >= 1, "expected at least one card with art");
  for (const c of arts) {
    const p = join(ROOT, "assets", "final", `${c.art}-banner.png`);
    assert.ok(existsSync(p), `missing asset for card ${c.id}: ${p}`);
    const info = pngInfo(p);
    assert.ok(info.w >= 500 && info.h >= 100, `asset too small: ${info.w}x${info.h}`);
  }
});

test("the bannered cards carry an art id matching their card id", () => {
  assert.equal(PROTOTYPE_EVENTS.length, 12, "deck must have 12 cards");
  // Mammoth Hunt (Prompt 4) + the seven Prompt 5 cards ship generated banners.
  const BANNERED = [
    "mammoth-hunt",
    "river-fishery",
    "drought",
    "great-migration",
    "spirit-cave",
    "flint-road",
    "raiding-party",
    "standing-stones",
  ];
  for (const c of PROTOTYPE_EVENTS) {
    if (BANNERED.includes(c.id)) {
      assert.equal(c.art, c.id, `${c.id} art id should match its card id`);
    } else {
      assert.equal(c.art, undefined, `${c.id} should not have an art field yet`);
    }
  }
});

test("artwork.js banner registry convention matches the file layout", () => {
  // Guard against drift between artwork.js BANNERS keys and events.js art ids.
  const src = readFileSync(join(ROOT, "src", "ui", "artwork.js"), "utf8");
  for (const c of PROTOTYPE_EVENTS.filter((x) => x.art)) {
    assert.ok(
      src.includes(`"${c.art}":`),
      `artwork.js BANNERS has no entry for art id "${c.art}"`
    );
  }
});
