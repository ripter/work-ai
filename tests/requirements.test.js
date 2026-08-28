// Unit tests for the slot requirement engine and subset search.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkRequirement,
  checkSlot,
  describeSlot,
  findLegalSubsets,
  legalSubsetsForSlot,
  hasLegalClaim,
  subsetCapForPool,
} from "../src/game/rules.js";
import { PROTOTYPE_EVENTS } from "../src/data/events.js";

const R = {
  pair: () => ({ type: "pair" }),
  three: () => ({ type: "threeKind" }),
  four: () => ({ type: "fourKind" }),
  full: () => ({ type: "fullHouse" }),
  straight: () => ({ type: "straight" }),
  exactSum: (v) => ({ type: "exactSum", value: v }),
  atLeast: (v) => ({ type: "sumAtLeast", value: v }),
  atMost: (v) => ({ type: "sumAtMost", value: v }),
  odd: () => ({ type: "allOdd" }),
  even: () => ({ type: "allEven" }),
  exact: (values) => ({ type: "exactValues", values }),
  contains: (value, count) => ({ type: "mustContain", value, count: count ?? 1 }),
  middle: (count, value) => ({ type: "middleIs", count, value }),
};

test("pair", () => {
  assert.equal(checkRequirement([2, 2], R.pair()), true);
  assert.equal(checkRequirement([2, 2, 2], R.pair()), true);
  assert.equal(checkRequirement([2, 5], R.pair()), false);
  assert.equal(checkRequirement([1, 2, 3], R.pair()), false);
  assert.equal(checkRequirement([7], R.pair()), false); // single die is not a pair
});

test("three of a kind", () => {
  assert.equal(checkRequirement([4, 4, 4], R.three()), true);
  assert.equal(checkRequirement([4, 4, 4, 4], R.three()), true);
  assert.equal(checkRequirement([4, 4, 1], R.three()), false);
});

test("four of a kind", () => {
  assert.equal(checkRequirement([6, 6, 6, 6], R.four()), true);
  assert.equal(checkRequirement([6, 6, 6, 6, 6], R.four()), true);
  assert.equal(checkRequirement([6, 6, 6, 1], R.four()), false);
});

test("full house", () => {
  assert.equal(checkRequirement([3, 3, 3, 2, 2], R.full()), true);
  assert.equal(checkRequirement([2, 2, 3, 3, 3], R.full()), true);
  assert.equal(checkRequirement([3, 3, 3, 3, 2], R.full()), false); // 4+1
  assert.equal(checkRequirement([3, 3, 2, 2, 1], R.full()), false); // 2+2+1
  assert.equal(checkRequirement([2, 2, 2, 3, 3, 3], R.full()), true); // 3+3 (6 dice)
});

test("straight: exactly 5 distinct consecutive dice", () => {
  assert.equal(checkRequirement([1, 2, 3, 4, 5], R.straight()), true);
  assert.equal(checkRequirement([2, 3, 4, 5, 6], R.straight()), true);
  assert.equal(checkRequirement([1, 2, 3, 4, 6], R.straight()), false);
  assert.equal(checkRequirement([1, 2, 3, 4], R.straight()), false); // too few
  assert.equal(checkRequirement([1, 2, 3, 4, 5, 6], R.straight()), false); // too many
  assert.equal(checkRequirement([2, 2, 3, 4, 5], R.straight()), false); // duplicate
});

test("sum requirements", () => {
  assert.equal(checkRequirement([5, 4], R.exactSum(9)), true);
  assert.equal(checkRequirement([5, 5], R.exactSum(9)), false);
  assert.equal(checkRequirement([6, 6, 1], R.atLeast(12)), true);
  assert.equal(checkRequirement([6, 5], R.atLeast(12)), false);
  assert.equal(checkRequirement([2, 1], R.atMost(3)), true);
  assert.equal(checkRequirement([2, 2], R.atMost(3)), false);
});

test("all odd / all even", () => {
  assert.equal(checkRequirement([1, 3, 5], R.odd()), true);
  assert.equal(checkRequirement([1, 3, 4], R.odd()), false);
  assert.equal(checkRequirement([2, 4, 6], R.even()), true);
  assert.equal(checkRequirement([2, 4, 5], R.even()), false);
});

test("exactValues is multiset equality", () => {
  assert.equal(checkRequirement([6, 6], R.exact([6, 6])), true);
  assert.equal(checkRequirement([6, 6, 6], R.exact([6, 6])), false);
  assert.equal(checkRequirement([6, 1], R.exact([6, 6])), false);
  assert.equal(checkRequirement([2, 5, 5], R.exact([5, 5, 2])), true); // order-independent
});

test("mustContain", () => {
  assert.equal(checkRequirement([6, 1, 2], R.contains(6)), true);
  assert.equal(checkRequirement([1, 2], R.contains(6)), false);
  assert.equal(checkRequirement([6, 6, 1], R.contains(6, 2)), true);
  assert.equal(checkRequirement([6, 1, 1], R.contains(6, 2)), false);
});

test("middleIs: unusual pattern (3 dice, middle must be 5)", () => {
  assert.equal(checkRequirement([1, 5, 6], R.middle(3, 5)), true);
  assert.equal(checkRequirement([5, 5, 5], R.middle(3, 5)), true);
  assert.equal(checkRequirement([5, 6, 6], R.middle(3, 5)), false); // sorted [5,6,6], middle 6
  assert.equal(checkRequirement([1, 5], R.middle(3, 5)), false); // wrong count
  assert.equal(checkRequirement([1, 5, 6, 2], R.middle(3, 5)), false); // wrong count
});

test("checkSlot: requirement arrays combine with AND", () => {
  const slot = { id: "and", diceRequired: 2, requirement: [R.even(), R.atLeast(10)] };
  assert.equal(checkSlot([4, 6], slot), true);
  assert.equal(checkSlot([4, 5], slot), false); // 5 is odd
  assert.equal(checkSlot([2, 4], slot), false); // sum 6 < 10
  assert.equal(describeSlot(slot).includes("AND"), true);
  assert.equal(describeSlot(slot).startsWith("[2 dice]"), true);
});

test("unknown requirement type throws", () => {
  assert.throws(() => checkRequirement([1], { type: "bogus" }));
});

test("findLegalSubsets finds all satisfying subsets", () => {
  const values = [5, 5, 1];
  const subsets = findLegalSubsets(values, (v) => checkRequirement(v, R.pair()));
  // Both [5,5] and [5,5,1] contain a pair (with first=false every match
  // is collected, not just the first).
  assert.equal(subsets.length, 2);
  assert.deepEqual(subsets[0].map((i) => values[i]), [5, 5]);
  assert.deepEqual(subsets[1].map((i) => values[i]), [5, 5, 1]);
});

test("findLegalSubsets first=true short-circuits", () => {
  const values = [5, 5, 5, 5];
  const subsets = findLegalSubsets(values, (v) => v.length === 2, 4, true);
  assert.equal(subsets.length, 1);
});

test("subset cap for large pools (documented prototype assumption)", () => {
  assert.equal(subsetCapForPool(10), 10);
  assert.equal(subsetCapForPool(16), 16);
  assert.equal(subsetCapForPool(17), 6);
});

test("legalSubsetsForSlot returns die objects from the pool", () => {
  const pool = [
    { id: 1, value: 5 },
    { id: 2, value: 5 },
    { id: 3, value: 1 },
  ];
  const subsets = legalSubsetsForSlot(pool, { id: "p", diceRequired: 2, requirement: [R.pair()] });
  assert.equal(subsets.length, 1);
  assert.deepEqual(subsets[0].map((d) => d.id), [1, 2]);
});

test("hasLegalClaim", () => {
  const slot = { id: "f4", diceRequired: 4, requirement: [R.four()] };
  assert.equal(hasLegalClaim([{ id: 1, value: 2 }], slot), false);
  assert.equal(
    hasLegalClaim(
      [
        { id: 1, value: 2 },
        { id: 2, value: 2 },
        { id: 3, value: 2 },
        { id: 4, value: 2 },
      ],
      slot
    ),
    true
  );
});

// ---------------- diceRequired (Prompt 3) ----------------

test("every prototype slot explicitly declares diceRequired", () => {
  let count = 0;
  for (const card of PROTOTYPE_EVENTS) {
    assert.ok(Array.isArray(card.slots) && card.slots.length > 0, `${card.id} has slots`);
    for (const slot of card.slots) {
      assert.ok(
        Object.hasOwn(slot, "diceRequired"),
        `slot ${slot.id} is missing an explicit diceRequired`
      );
      assert.ok(
        Number.isInteger(slot.diceRequired) && slot.diceRequired >= 1,
        `slot ${slot.id} diceRequired must be an integer >= 1 (got ${slot.diceRequired})`
      );
      count++;
    }
  }
  assert.ok(count >= 25, `expected a full prototype deck, saw ${count} slots`);
});

test("selecting fewer dice than diceRequired fails", () => {
  const slot = { id: "few", diceRequired: 3, requirement: [R.odd()] };
  assert.equal(checkSlot([3], slot), false); // 1 odd die is NOT enough
  assert.equal(checkSlot([3, 5], slot), false); // 2 odd dice are NOT enough
});

test("selecting more dice than diceRequired fails", () => {
  const slot = { id: "many", diceRequired: 2, requirement: [R.even()] };
  assert.equal(checkSlot([2, 4, 6], slot), false); // 3 even dice are too many
});

test("exact count + valid condition succeeds", () => {
  const slot = { id: "ok", diceRequired: 3, requirement: [R.odd()] };
  assert.equal(checkSlot([1, 3, 5], slot), true);
  const sumSlot = { id: "ok2", diceRequired: 3, requirement: [R.atLeast(10)] };
  assert.equal(checkSlot([6, 4, 1], sumSlot), true);
});

test("all-odd cannot be cheesed with one die when the slot requires more", () => {
  const slot = { id: "odd3", diceRequired: 3, requirement: [R.odd()] };
  assert.equal(checkSlot([1], slot), false);
  assert.equal(checkSlot([5, 5], slot), false);
  assert.equal(checkSlot([5, 5, 1], slot), true); // exactly 3, all odd
});

test("sum requirements respect diceRequired", () => {
  const slot = { id: "sum3", diceRequired: 3, requirement: [R.atLeast(10)] };
  assert.equal(checkSlot([6, 4], slot), false); // sum 10 but only 2 dice
  assert.equal(checkSlot([6, 4, 1], slot), true); // sum 11, 3 dice
  const exact = { id: "ex3", diceRequired: 3, requirement: [R.exactSum(9)] };
  assert.equal(checkSlot([5, 4], exact), false); // sum 9, wrong count
  assert.equal(checkSlot([5, 4, 2], exact), false); // 3 dice but sum 11
  assert.equal(checkSlot([3, 3, 3], exact), true);
});

test("pattern requirements respect diceRequired", () => {
  const pair3 = { id: "p3", diceRequired: 3, requirement: [R.pair()] };
  assert.equal(checkSlot([5, 5], pair3), false); // pair but wrong count
  assert.equal(checkSlot([5, 5, 1], pair3), true); // 3 dice containing a pair
  const straightSlot = { id: "st", diceRequired: 5, requirement: [R.straight()] };
  assert.equal(checkSlot([1, 2, 3, 4, 5], straightSlot), true);
  assert.equal(checkSlot([1, 2, 3, 4], straightSlot), false);
  const middleSlot = { id: "mid", diceRequired: 3, requirement: [R.middle(3, 5)] };
  assert.equal(checkSlot([5, 5], middleSlot), false); // wrong count
  assert.equal(checkSlot([1, 5, 6], middleSlot), true);
  const houseSlot = { id: "fh", diceRequired: 5, requirement: [R.full()] };
  assert.equal(checkSlot([3, 3, 3, 2, 2], houseSlot), true);
  assert.equal(checkSlot([3, 3, 3, 2], houseSlot), false); // wrong count
});

test("checkSlot throws when diceRequired is missing or invalid", () => {
  assert.throws(() => checkSlot([1], { id: "x", requirement: [R.odd()] }));
  assert.throws(() => checkSlot([1], { id: "y", diceRequired: 0, requirement: [R.odd()] }));
  assert.throws(() => checkSlot([1], { id: "z", diceRequired: 1.5, requirement: [R.odd()] }));
});

test("slots requiring more dice than remain are impossible", () => {
  const slot = { id: "big", diceRequired: 5, requirement: [R.atLeast(20)] };
  const pool3 = [
    { id: 1, value: 6 },
    { id: 2, value: 6 },
    { id: 3, value: 6 },
  ];
  assert.equal(legalSubsetsForSlot(pool3, slot).length, 0);
  assert.equal(hasLegalClaim(pool3, slot), false);
  // exact-size search also finds nothing
  assert.equal(findLegalSubsets([6, 6, 6], (v) => checkSlot(v, slot), 6, false, 5).length, 0);
});

test("high-dice slots can exist on a card a small tribe cannot claim", () => {
  const card = PROTOTYPE_EVENTS.find((c) => c.id === "ambush");
  const bludgeon = card.slots.find((s) => s.id === "am-5");
  assert.equal(bludgeon.diceRequired, 5); // visible late-game opportunity
  // a starting Pop-3 tribe (3 dice) can never claim it, even with all 6s
  const pool3 = [
    { id: 1, value: 6 },
    { id: 2, value: 6 },
    { id: 3, value: 6 },
  ];
  assert.equal(hasLegalClaim(pool3, bludgeon), false);
  // ...but a Pop-5 tribe with the right shape can
  const pool5 = [
    { id: 1, value: 3 },
    { id: 2, value: 3 },
    { id: 3, value: 3 },
    { id: 4, value: 2 },
    { id: 5, value: 2 },
  ];
  assert.equal(hasLegalClaim(pool5, bludgeon), true);
});
