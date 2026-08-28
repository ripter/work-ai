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
  const slot = { requirement: [R.even(), R.atLeast(10)] };
  assert.equal(checkSlot([4, 6], slot), true);
  assert.equal(checkSlot([4, 5], slot), false); // 5 is odd
  assert.equal(checkSlot([2, 4], slot), false); // sum 6 < 10
  assert.equal(describeSlot(slot).includes("AND"), true);
});

test("unknown requirement type throws", () => {
  assert.throws(() => checkRequirement([1], { type: "bogus" }));
});

test("findLegalSubsets finds all satisfying subsets", () => {
  const values = [5, 5, 1];
  const subsets = findLegalSubsets(values, (v) => checkRequirement(v, R.pair()));
  assert.equal(subsets.length, 1);
  assert.deepEqual(subsets[0].map((i) => values[i]), [5, 5]);
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
  const subsets = legalSubsetsForSlot(pool, { requirement: [R.pair()] });
  assert.equal(subsets.length, 1);
  assert.deepEqual(subsets[0].map((d) => d.id), [1, 2]);
});

test("hasLegalClaim", () => {
  const slot = { requirement: [R.four()] };
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
