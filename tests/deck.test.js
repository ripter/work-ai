// Deck integrity tests (Prompt 5 — expanded Event deck).
//
// Validates that every card in the data-driven deck is internally
// well-formed and that the deck as a whole has the intended shape:
// varied claim-order rules, Food as the common reward, rare
// Population/transforms/hostiles, opportunities for small tribes on
// every card, and high-dice opportunities on most cards.
//
// This is a sanity check, NOT a balance validation.

import { test } from "node:test";
import assert from "node:assert/strict";

import { PROTOTYPE_EVENTS } from "../src/data/events.js";
import { ORDER_RULES, describeSlot } from "../src/game/rules.js";

// A valid reward is EITHER a non-empty subset of simple resource gains
// (food/tools/population) OR exactly one special reward (transform,
// kill, steal). The prototype cards never mix the two (matches
// rules.js applyReward).
function rewardShapeError(reward, slotId) {
  const simple = ["food", "tools", "population"].filter((k) => reward[k] !== undefined);
  const special = ["transform", "kill", "steal"].filter((k) => reward[k] !== undefined);
  if (simple.length + special.length === 0) return `${slotId}: empty reward`;
  if (special.length > 0) {
    if (simple.length > 0 || special.length > 1)
      return `${slotId}: reward mixes simple and special kinds`;
    const k = special[0];
    if (k === "transform") {
      const t = reward.transform;
      if (!t || typeof t !== "object") return `${slotId}: transform missing`;
      const spend = ["food", "tools"].filter((x) => (t.spend?.[x] ?? 0) > 0);
      const gain = ["food", "tools"].filter((x) => (t.gain?.[x] ?? 0) > 0);
      if (spend.length === 0 || gain.length === 0)
        return `${slotId}: transform needs non-empty spend and gain`;
    } else if (k === "kill") {
      if (!Number.isInteger(reward.kill.population) || reward.kill.population < 1)
        return `${slotId}: kill.population must be an integer >= 1`;
    } else if (k === "steal") {
      if (!Number.isInteger(reward.steal.tools) || reward.steal.tools < 1)
        return `${slotId}: steal.tools must be an integer >= 1`;
    }
    return null;
  }
  for (const k of simple)
    if (!Number.isInteger(reward[k]) || reward[k] < 1)
      return `${slotId}: ${k} must be an integer >= 1`;
  return null;
}

function knownRequirementTypes() {
  // Import lazily to avoid a circular reference at module top level.
  return [
    "pair",
    "threeKind",
    "fourKind",
    "fullHouse",
    "straight",
    "exactSum",
    "sumAtLeast",
    "sumAtMost",
    "allOdd",
    "allEven",
    "exactValues",
    "mustContain",
    "middleIs",
    "range",
    "countAbove",
    "countBelow",
    "oddEvenSplit",
    "exactlyKind",
  ];
}

test("deck size: 10-12 Event Cards (target 12)", () => {
  assert.ok(
    PROTOTYPE_EVENTS.length >= 10 && PROTOTYPE_EVENTS.length <= 12,
    `expected 10-12 cards, got ${PROTOTYPE_EVENTS.length}`
  );
});

test("every card has a unique non-empty id, name, and a valid claim-order rule", () => {
  const ids = new Set();
  for (const card of PROTOTYPE_EVENTS) {
    assert.ok(typeof card.id === "string" && card.id.length > 0, `card id: ${card.id}`);
    assert.ok(!ids.has(card.id), `duplicate card id: ${card.id}`);
    ids.add(card.id);
    assert.ok(typeof card.name === "string" && card.name.length > 0, `${card.id}: name`);
    assert.ok(
      Object.hasOwn(ORDER_RULES, card.orderRule),
      `${card.id}: unknown orderRule "${card.orderRule}"`
    );
  }
});

test("every card has 4-8 slots with unique ids (card-wide and deck-wide)", () => {
  const allSlotIds = new Set();
  for (const card of PROTOTYPE_EVENTS) {
    assert.ok(
      Array.isArray(card.slots) && card.slots.length >= 4 && card.slots.length <= 8,
      `${card.id}: expected 4-8 slots, got ${card.slots?.length}`
    );
    const cardIds = new Set();
    for (const slot of card.slots) {
      assert.ok(typeof slot.id === "string" && slot.id.length > 0, `${card.id}: slot id`);
      assert.ok(!cardIds.has(slot.id), `${card.id}: duplicate slot id ${slot.id}`);
      cardIds.add(slot.id);
      assert.ok(!allSlotIds.has(slot.id), `duplicate slot id across deck: ${slot.id}`);
      allSlotIds.add(slot.id);
    }
  }
});

test("every slot has an explicit integer diceRequired >= 1 and known requirement types", () => {
  const known = new Set(knownRequirementTypes());
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      assert.ok(
        Object.hasOwn(slot, "diceRequired"),
        `${slot.id}: missing explicit diceRequired`
      );
      assert.ok(
        Number.isInteger(slot.diceRequired) && slot.diceRequired >= 1,
        `${slot.id}: diceRequired must be integer >= 1 (got ${slot.diceRequired})`
      );
      assert.ok(
        Array.isArray(slot.requirement) && slot.requirement.length > 0,
        `${slot.id}: requirement must be a non-empty array`
      );
      for (const req of slot.requirement)
        assert.ok(known.has(req.type), `${slot.id}: unknown requirement type "${req.type}"`);
    }
  }
});

test("new requirement parameters are sane (ranges in 1..6, split sums to diceRequired)", () => {
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      for (const req of slot.requirement) {
        if (req.type === "range") {
          assert.ok(
            Number.isInteger(req.min) && Number.isInteger(req.max) && req.min >= 1 && req.max <= 6 && req.min <= req.max,
            `${slot.id}: bad range ${JSON.stringify(req)}`
          );
        }
        if (req.type === "oddEvenSplit") {
          assert.ok(
            req.odd + req.even === slot.diceRequired,
            `${slot.id}: oddEvenSplit ${req.odd}+${req.even} != diceRequired ${slot.diceRequired}`
          );
        }
        if (req.type === "countAbove" || req.type === "countBelow") {
          assert.ok(
            Number.isInteger(req.value) && req.value >= 1 && req.value <= 6 &&
              Number.isInteger(req.count) && req.count >= 1 && req.count <= slot.diceRequired,
            `${slot.id}: bad threshold requirement ${JSON.stringify(req)}`
          );
        }
        if (req.type === "exactlyKind") {
          assert.ok(
            Number.isInteger(req.count) && req.count >= 2 && req.count <= slot.diceRequired,
            `${slot.id}: bad exactlyKind ${JSON.stringify(req)}`
          );
        }
        if (req.type === "middleIs") {
          assert.equal(req.count, slot.diceRequired, `${slot.id}: middleIs count must match diceRequired`);
        }
      }
    }
  }
});

test("every reward has a valid shape", () => {
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      const err = rewardShapeError(slot.reward, slot.id);
      assert.equal(err, null, `invalid reward: ${err}`);
    }
  }
});

test("every card has at least one opportunity for a small (Pop-3) tribe (<= 3 dice)", () => {
  for (const card of PROTOTYPE_EVENTS) {
    assert.ok(
      card.slots.some((s) => s.diceRequired <= 3),
      `${card.id}: no slot reachable with 3 dice`
    );
  }
});

test("claim-order rules vary across the deck (all five used, none overused)", () => {
  const counts = {};
  for (const card of PROTOTYPE_EVENTS) counts[card.orderRule] = (counts[card.orderRule] ?? 0) + 1;
  assert.equal(Object.keys(counts).length, 5, `expected all 5 order rules, got ${JSON.stringify(counts)}`);
  for (const [rule, n] of Object.entries(counts))
    assert.ok(n <= 3, `order rule "${rule}" used ${n} times (max 3)`);
});

test("economy: Food most common, Tools less, Population rare", () => {
  let food = 0,
    tools = 0,
    pop = 0,
    transforms = 0,
    hostile = 0;
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      const r = slot.reward;
      if (r.food) food++;
      if (r.tools) tools++;
      if (r.population) pop++;
      if (r.transform) transforms++;
      if (r.kill || r.steal) hostile++;
    }
  }
  assert.ok(food > tools, `Food slots (${food}) should outnumber Tools slots (${tools})`);
  assert.ok(pop <= 5, `Population slots (${pop}) should be rare (<= 5)`);
  assert.ok(transforms <= 3, `Transform slots (${transforms}) should be very rare (<= 3)`);
  assert.ok(hostile <= 3, `Hostile slots (${hostile}) should be very rare (<= 3)`);
});

test("hostile slots are hard (3+ dice)", () => {
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      if (slot.reward.kill || slot.reward.steal)
        assert.ok(
          slot.diceRequired >= 3,
          `${slot.id}: hostile slot should need >= 3 dice`
        );
    }
  }
});

test("most cards have high-dice (4-5) slots that reward growth", () => {
  const withHighDice = PROTOTYPE_EVENTS.filter((c) =>
    c.slots.some((s) => s.diceRequired >= 4)
  );
  assert.ok(
    withHighDice.length >= 8,
    `expected >= 8 cards with 4-5 die slots, got ${withHighDice.length}`
  );
});

test("every slot description renders without throwing", () => {
  for (const card of PROTOTYPE_EVENTS) {
    for (const slot of card.slots) {
      const d = describeSlot(slot);
      assert.ok(d.startsWith(`[${slot.diceRequired} dice]`), `${slot.id}: ${d}`);
    }
  }
});
