// Core game model checks (Prompt 2 testing list, items 1-22) plus the
// Prompt 3 revision: explicit diceRequired on every slot and free rerolls.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../src/game/game.js";
import {
  computeClaimOrder,
  feedTribe,
  applyGrowth,
  applyReward,
} from "../src/game/rules.js";
import { FREE_REROLLS_PER_EVENT } from "../src/game/config.js";
import { makeRng, scriptedGame, runAiTurn } from "./helpers.js";

const CARD = (id, orderRule, slots) => ({ id, name: id, orderRule, slots });
const SLOT = (id, diceRequired, requirement, reward) => ({
  id,
  name: id,
  diceRequired,
  requirement,
  reward,
});

// 1. Population determines starting dice count.
test("1: population determines starting dice count", () => {
  const game = new Game({
    aiCount: 1,
    rng: makeRng(1),
    rollFn: (count) => Array(count).fill(3),
  });
  assert.equal(game.tribes[0].dice.length, 3);
  assert.equal(game.tribes[1].dice.length, 3);

  // population changes take effect from the NEXT event
  game.tribes[0].population = 5;
  game.startEvent();
  assert.equal(game.tribes[0].dice.length, 5);
  assert.equal(game.tribes[1].dice.length, 3);
});

// 2. Free rerolls are consumed first; only then does a reroll cost a Tool.
test("2: free rerolls are used before tools, then one tool per reroll", () => {
  const game = scriptedGame({ aiCount: 1, rolls: [[3, 3, 3], [2, 2, 2]] });
  const t = game.tribes[0];
  assert.equal(t.freeRerolls, FREE_REROLLS_PER_EVENT);
  assert.equal(t.tools, 1);
  const [d1, d2] = t.dice.map((d) => d.id);
  game.doReroll(0, [d1]); // free reroll #1
  assert.equal(t.freeRerolls, FREE_REROLLS_PER_EVENT - 1);
  assert.equal(t.tools, 1); // Tool untouched
  game.doReroll(0, [d2]); // free reroll #2
  assert.equal(t.freeRerolls, 0);
  assert.equal(t.tools, 1); // Tool untouched
  game.doReroll(0, [d1]); // free rerolls exhausted -> costs 1 Tool
  assert.equal(t.tools, 0);
  assert.equal(game.awaiting.type, "reroll");
  assert.equal(game.awaiting.tribeId, 0);
  assert.throws(() => game.doReroll(0, [d2])); // no free rerolls or Tools left
  game.finishReroll(0);
});

// 3. A reroll (free or Tool) can reroll any subset of dice.
test("3: reroll can reroll any subset of dice", () => {
  const game = scriptedGame({ aiCount: 1, rolls: [[1, 2, 3], [4, 5, 6]] });
  const t = game.tribes[0];
  t.tools = 3; // test-only: enough budget for all cases
  const [a, b, c] = t.dice.map((d) => d.id);

  assert.throws(() => game.doReroll(0, [])); // must reroll >= 1 die
  assert.throws(() => game.doReroll(0, [99999])); // die not in pool

  game.doReroll(0, [b]); // single die (free)
  assert.equal(t.freeRerolls, FREE_REROLLS_PER_EVENT - 1);
  assert.equal(t.dice[0].value, 1); // untouched dice keep values
  assert.equal(t.dice[2].value, 3);
  game.doReroll(0, [a, c]); // two dice (free)
  assert.equal(t.freeRerolls, 0);
  assert.equal(t.tools, 3); // free rerolls do not consume Tools
  game.doReroll(0, [a, b, c]); // all dice (costs 1 Tool)
  assert.equal(t.tools, 2);
  game.finishReroll(0);
});

// 4. Claim order is calculated once and does not change during the Event.
test("4: claim order is fixed for the whole event", () => {
  const card = CARD(
    "t4",
    "highestTotal",
    [
      SLOT("s1", 2, [{ type: "pair" }], { food: 1 }),
      SLOT("s2", 1, [{ type: "sumAtMost", value: 9 }], { food: 1 }),
    ]
  );
  const game = scriptedGame({
    aiCount: 1,
    deck: [card],
    rolls: [[6, 6, 1], [2, 3, 4]],
  });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.deepEqual(game.claimOrder, [0, 1]); // 13 > 9

  // H spends its big dice on a claim; its total is now 1 (< AI's 9)
  const sixes = game.tribes[0].dice.filter((d) => d.value === 6).map((d) => d.id);
  game.submitClaim(0, 0, sixes);

  assert.deepEqual(game.claimOrder, [0, 1]); // unchanged
  assert.equal(game.awaiting.tribeId, 1); // fixed order still applies
  // recomputing the rule now would give a different result — proving the
  // stored order is what drives turns, not a live recalculation
  assert.deepEqual(computeClaimOrder(card, game.tribes), [1, 0]);
});

// 5. Selected dice are correctly validated against requirements.
test("5: selected dice are validated against the slot requirement", () => {
  const card = CARD("t5", "highestDie", [SLOT("s1", 2, [{ type: "pair" }], { food: 1 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.awaiting.tribeId, 0);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  const one = game.tribes[0].dice.find((d) => d.value === 1).id;

  assert.throws(() => game.submitClaim(0, 0, [fives[0], one])); // [5,1] is not a pair
  game.submitClaim(0, 0, fives); // [5,5] is
  assert.equal(game.slots[0].claimedBy, 0);
});

// 6. Claimed dice are removed from the pool.
test("6: claimed dice are removed from the tribe's pool", () => {
  const card = CARD("t6", "highestDie", [SLOT("s1", 2, [{ type: "pair" }], { food: 1 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 0, fives);
  assert.equal(game.tribes[0].dice.length, 1);
  assert.ok(!game.tribes[0].dice.some((d) => fives.includes(d.id)));
  assert.equal(game.tribes[0].dice[0].value, 1);
});

// 7. Claimed slots cannot be claimed twice.
test("7: a claimed slot cannot be claimed again", () => {
  const card = CARD(
    "t7",
    "highestDie",
    [
      SLOT("s1", 1, [{ type: "sumAtMost", value: 9 }], { food: 1 }),
      SLOT("s2", 2, [{ type: "pair" }], { food: 1 }),
    ]
  );
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[6, 1, 1], [5, 2, 2]] });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.awaiting.tribeId, 0);
  const one = game.tribes[0].dice.find((d) => d.value === 1).id;
  game.submitClaim(0, 0, [one]);
  assert.equal(game.awaiting.tribeId, 1);

  const aiDie = game.tribes[1].dice[0].id;
  assert.throws(() => game.submitClaim(1, 0, [aiDie])); // slot 0 already claimed
  const twos = game.tribes[1].dice.filter((d) => d.value === 2).map((d) => d.id);
  game.submitClaim(1, 1, twos);
  assert.equal(game.slots[1].claimedBy, 1);
});

// 8. Multiple claims by the same tribe are possible if enough dice remain.
test("8: one tribe can claim multiple slots in an event", () => {
  const card = CARD(
    "t8",
    "highestDie",
    [
      SLOT("s1", 1, [{ type: "sumAtMost", value: 7 }], { food: 1 }),
      SLOT("s2", 2, [{ type: "pair" }], { food: 2 }),
    ]
  );
  const game = scriptedGame({
    aiCount: 1,
    deck: [card],
    rolls: [
      [1, 2, 3], [1, 2, 3], // event 1 (discarded)
      [5, 5, 1, 2], [2, 3, 4], // event 2: H has population 4
    ],
  });
  game.tribes[0].population = 4; // test-only, before the second event
  game.startEvent();
  assert.equal(game.tribes[0].dice.length, 4);
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.awaiting.tribeId, 0);

  const one = game.tribes[0].dice.find((d) => d.value === 1).id;
  game.submitClaim(0, 0, [one]); // H claims slot 1 with one die
  // AI [2,3,4] has no pair and slot 1 is taken -> auto out of the loop
  assert.equal(game.awaiting.tribeId, 0); // back to H
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 1, fives); // H claims slot 2 with its remaining dice

  assert.equal(game.slots[0].claimedBy, 0);
  assert.equal(game.slots[1].claimedBy, 0);
  assert.deepEqual(game.claims.map((c) => c.tribeId), [0, 0]);
});

// 9. Event ends when nobody has a legal claim.
test("9: event ends when nobody can claim", () => {
  const card = CARD("t9", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [4, 5, 6]] });
  game.finishReroll(0);
  game.finishReroll(1);
  // 3 dice each -> four of a kind impossible for both
  assert.equal(game.claims.length, 0);
  assert.equal(game.phase, "night"); // rewards (0 claims) -> night
});

// 10. Rewards do not apply immediately.
test("10: queued rewards are not applied until the claiming phase ends", () => {
  const card = CARD(
    "t10",
    "highestDie",
    [
      SLOT("s1", 2, [{ type: "pair" }], { food: 3 }),
      SLOT("s2", 1, [{ type: "sumAtMost", value: 7 }], { food: 1 }),
    ]
  );
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  const foodBefore = game.tribes[0].food;
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);

  game.submitClaim(0, 0, fives);
  assert.equal(game.phase, "claiming"); // AI still has a turn
  assert.equal(game.tribes[0].food, foodBefore); // reward NOT applied yet

  const two = game.tribes[1].dice.find((d) => d.value === 2).id;
  game.submitClaim(1, 1, [two]);
  // both tribes out of the loop -> rewards resolve -> night
  assert.equal(game.phase, "night");
  // Night resolves tribe by tribe: H is fed first, then its growth decision
  assert.equal(game.tribes[0].food, foodBefore + 3 - 3); // +3 reward, -3 feeding
  game.finishGrowth(0);
  assert.equal(game.tribes[1].food, 4 + 1 - 3); // AI: +1 reward, -3 feeding
  assert.equal(game.awaiting.type, "growth"); // test stops mid-night on purpose
});

// 11. Rewards resolve in slot claim order.
test("11: rewards resolve in the exact order slots were claimed", () => {
  // H claims a transform first; AI claims a tool-steal second.
  // Correct order: H converts (Tools 1 -> 0), then AI's steal has no valid
  // target and fizzles. Wrong order: steal first (H Tools -> 0), then H's
  // transform fails. Final states differ.
  const card = CARD(
    "t11",
    "highestDie",
    [
      SLOT("s1", 2, [{ type: "pair" }], { transform: { spend: { tools: 1 }, gain: { food: 4 } } }),
      SLOT("s2", 1, [{ type: "sumAtMost", value: 7 }], { steal: { tools: 1 } }),
    ]
  );
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 0, fives);
  const two = game.tribes[1].dice.find((d) => d.value === 2).id;
  game.submitClaim(1, 1, [two]);

  assert.equal(game.phase, "night");
  assert.equal(game.tribes[0].tools, 0); // transform consumed the tool
  assert.equal(game.tribes[0].food, 4 + 4 - 3); // +4 gain, -3 feeding
  assert.equal(game.tribes[1].tools, 1); // steal fizzled (no valid target)
  assert.match(game.log.join("\n"), /fizzles \(no valid target\)/);
});

// 12. Population reward does not add dice during the current Event.
test("12: population rewards do not change the current event's dice", () => {
  const card = CARD("t12", "highestDie", [SLOT("s1", 2, [{ type: "pair" }], { population: 1 })]);
  const game = scriptedGame({
    aiCount: 1,
    deck: [card],
    rolls: [
      [5, 5, 1], [2, 3, 4], // event 1
      [3, 3, 3, 3], [4, 4, 4], // event 2: H now has population 4
    ],
  });
  game.finishReroll(0);
  game.finishReroll(1);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 0, fives);

  assert.equal(game.tribes[0].population, 4); // reward applied
  assert.equal(game.tribes[0].dice.length, 1); // current event pool unchanged
  assert.equal(game.phase, "night");

  game.finishGrowth(0);
  game.finishGrowth(1);
  // next event uses the updated population
  assert.equal(game.eventIndex, 2);
  assert.equal(game.phase, "reroll");
  assert.equal(game.tribes[0].dice.length, 4);
  assert.equal(game.tribes[1].dice.length, 3);
});

// 13. Transform succeeds when resources are available.
test("13: transform succeeds when the tribe can pay", () => {
  const tribes = [
    { name: "A", food: 5, tools: 3, population: 3, eliminated: false, dice: [] },
    { name: "B", food: 0, tools: 0, population: 3, eliminated: false, dice: [] },
  ];
  const lines = applyReward(
    tribes,
    0,
    { transform: { spend: { tools: 2 }, gain: { food: 6 } } },
    null
  );
  assert.equal(tribes[0].tools, 1);
  assert.equal(tribes[0].food, 11);
  assert.match(lines[0], /succeeded/);
});

// 14. Transform fails when unavailable, without refunding dice.
test("14: transform failure keeps the spent dice and the claimed slot", () => {
  // direct rule check
  const tribes = [
    { name: "A", food: 0, tools: 1, population: 3, eliminated: false, dice: [] },
  ];
  const lines = applyReward(
    tribes,
    0,
    { transform: { spend: { tools: 2 }, gain: { food: 6 } } },
    null
  );
  assert.equal(tribes[0].tools, 1); // unchanged
  assert.equal(tribes[0].food, 0);
  assert.match(lines[0], /FAILED/);

  // integration: tribe claims a 2-Tool transform with only 1 Tool
  const card = CARD(
    "t14",
    "highestDie",
    [SLOT("s1", 2, [{ type: "pair" }], { transform: { spend: { tools: 2 }, gain: { food: 6 } } })]
  );
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 0, fives);
  assert.equal(game.phase, "night");
  assert.equal(game.tribes[0].tools, 1); // no conversion happened
  assert.equal(game.tribes[0].food, 4 - 3); // only feeding
  assert.equal(game.slots[0].claimedBy, 0); // slot stays claimed
  assert.equal(game.tribes[0].dice.length, 1); // dice NOT refunded
});

// 15. Tool stealing works.
test("15: tool stealing works and validates targets", () => {
  const card = CARD(
    "t15",
    "highestDie",
    [
      SLOT("s1", 2, [{ type: "pair" }], { food: 2 }),
      SLOT("s2", 1, [{ type: "sumAtMost", value: 7 }], { steal: { tools: 1 } }),
    ]
  );

  // two-tribe game: only one valid target
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 1], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  const fives = game.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game.submitClaim(0, 0, fives);
  const two = game.tribes[1].dice.find((d) => d.value === 2).id;
  game.submitClaim(1, 1, [two]);
  assert.equal(game.awaiting.type, "target");
  assert.equal(game.awaiting.tribeId, 1);
  assert.throws(() => game.resolveWithTarget(1, 1)); // cannot target self
  game.resolveWithTarget(1, 0);
  assert.equal(game.tribes[1].tools, 2);
  assert.equal(game.tribes[0].tools, 0);

  // three-tribe game: invalid (0-tool) target rejected, valid one accepted
  const game2 = scriptedGame({
    aiCount: 2,
    deck: [card],
    rolls: [[5, 5, 6], [2, 3, 4], [1, 1, 3]],
  });
  game2.finishReroll(0);
  game2.finishReroll(1);
  game2.finishReroll(2);
  const fives2 = game2.tribes[0].dice.filter((d) => d.value === 5).map((d) => d.id);
  game2.submitClaim(0, 0, fives2); // H first (highest die 6)
  const two2 = game2.tribes[1].dice.find((d) => d.value === 2).id;
  game2.submitClaim(1, 1, [two2]); // AI1's steal
  assert.equal(game2.awaiting.type, "target");
  game2.tribes[2].tools = 0; // AI2 has no tools to steal
  assert.throws(() => game2.resolveWithTarget(1, 2)); // invalid target
  game2.resolveWithTarget(1, 0); // steal from H
  assert.equal(game2.tribes[0].tools, 0);
  assert.equal(game2.tribes[1].tools, 2);
});

// 16. Population-kill reward works.
test("16: kill reward removes population and can eliminate", () => {
  const card = CARD("t16", "highestDie", [SLOT("s1", 3, [{ type: "threeKind" }], { kill: { population: 1 } })]);

  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 5], [2, 3, 4]] });
  game.finishReroll(0);
  game.finishReroll(1);
  game.submitClaim(0, 0, game.tribes[0].dice.map((d) => d.id));
  assert.equal(game.awaiting.type, "target");
  game.resolveWithTarget(0, 1);
  assert.equal(game.tribes[1].population, 2);
  assert.equal(game.tribes[1].eliminated, false);

  // kill to zero eliminates the target
  const game2 = scriptedGame({ aiCount: 1, deck: [card], rolls: [[5, 5, 5], [2, 3, 4]] });
  game2.finishReroll(0);
  game2.finishReroll(1);
  game2.tribes[1].population = 1; // test-only: target has 1 Population
  game2.submitClaim(0, 0, game2.tribes[0].dice.map((d) => d.id));
  game2.resolveWithTarget(0, 1);
  assert.equal(game2.tribes[1].population, 0);
  assert.equal(game2.tribes[1].eliminated, true);
  game2.finishGrowth(0);
  assert.equal(game2.phase, "over"); // only one tribe left after Night
  assert.equal(game2.winner.id, 0);
});

// 17. Feeding consumes 1 Food per Population.
test("17: feeding consumes 1 food per population", () => {
  const t = { name: "T", population: 3, food: 4 };
  const r = feedTribe(t);
  assert.equal(t.food, 1);
  assert.equal(t.population, 3);
  assert.deepEqual(r, { fed: 3, starved: 0 });

  const t2 = { name: "T", population: 3, food: 3 };
  feedTribe(t2);
  assert.equal(t2.food, 0);
  assert.equal(t2.population, 3);
});

// 18. Starvation reduces Population correctly.
test("18: starvation reduces population (pop 5, food 3 example)", () => {
  const t = { name: "T", population: 5, food: 3 };
  const r = feedTribe(t);
  assert.equal(t.population, 3);
  assert.equal(t.food, 0);
  assert.equal(r.starved, 2);
});

// 19. Population 0 eliminates a tribe.
test("19: population 0 eliminates the tribe", () => {
  const t = { name: "T", population: 2, food: 0 };
  feedTribe(t);
  assert.equal(t.population, 0);

  // integration: tribe starves to 0 during Night -> eliminated -> victory
  const card = CARD("t19", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [4, 5, 6]] });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.phase, "night"); // nobody can claim
  game.tribes[1].food = 0; // test-only: AI has no food for Night
  game.finishGrowth(0);
  assert.equal(game.tribes[1].population, 0);
  assert.equal(game.tribes[1].eliminated, true);
  assert.equal(game.phase, "over");
  assert.equal(game.winner.id, 0);
});

// 20. Multiple Population can be purchased during one Night.
test("20: multiple population purchases in one night", () => {
  const t = { name: "T", food: 8, population: 3 };
  applyGrowth(t, 3);
  assert.equal(t.population, 6);
  assert.equal(t.food, 2);
  assert.throws(() => applyGrowth(t, 2)); // can only afford 1 more
  applyGrowth(t, 1);
  assert.equal(t.food, 0);

  // integration: two separate buy calls in the same Night
  const card = CARD("t20", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [4, 5, 6]] });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.awaiting.type, "growth");
  game.tribes[0].food = 8; // test-only: enough Food after feeding
  game.buyGrowth(0, 1);
  assert.equal(game.awaiting.type, "growth"); // may buy more
  game.buyGrowth(0, 2);
  assert.equal(game.tribes[0].population, 3 + 3);
  assert.equal(game.tribes[0].food, 8 - 6);
  game.finishGrowth(0);
});

// 21. Last surviving tribe wins.
test("21: the last surviving tribe wins", () => {
  const game = runEliminationToVictory();
  assert.equal(game.phase, "over");
  assert.ok(game.winner);
  assert.equal(game.aliveTribes().length, 1);
  assert.equal(game.winner.id, game.aliveTribes()[0].id);
});

function runEliminationToVictory() {
  const card = CARD("t21", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [4, 5, 6]] });
  game.finishReroll(0);
  game.finishReroll(1);
  game.tribes[1].food = 0; // AI starves at Night
  game.finishGrowth(0);
  assert.equal(game.phase, "over");
  return game;
}

// 22. A new Event begins correctly after Night.
test("22: a new event starts correctly after night", () => {
  const cardA = CARD("t22a", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const cardB = CARD("t22b", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({
    aiCount: 1,
    deck: [cardA, cardB],
    rolls: [
      [1, 2, 3], [4, 5, 6], // event 1
      [2, 2, 2], [6, 6, 6], // event 2
    ],
  });
  const firstCard = game.card.id; // deck is shuffled; either card may come first
  game.finishReroll(0);
  game.finishReroll(1);
  game.finishGrowth(0); // H
  game.finishGrowth(1); // AI
  assert.equal(game.eventIndex, 2);
  assert.equal(game.phase, "reroll");
  assert.notEqual(game.card.id, firstCard); // a different card was drawn
  assert.deepEqual(game.tribes[0].dice.map((d) => d.value), [2, 2, 2]);
  assert.deepEqual(game.tribes[1].dice.map((d) => d.value), [6, 6, 6]);
  assert.equal(game.awaiting.type, "reroll");
});

// Extra: claim-order tie-break is deterministic (lower seat first).
test("tie-break: equal order keys -> lower seat index first", () => {
  const card = CARD("tb", "highestTotal", [SLOT("s1", 2, [{ type: "pair" }], { food: 1 })]);
  const game = scriptedGame({
    aiCount: 2,
    deck: [card],
    rolls: [[1, 2, 3], [1, 2, 3], [1, 2, 3]], // all totals 6
  });
  game.finishReroll(0);
  game.finishReroll(1);
  game.finishReroll(2);
  assert.deepEqual(game.claimOrder, [0, 1, 2]);
});

// Extra: eliminated tribes are skipped in future events.
test("eliminated tribes take no part in future events", () => {
  const cardA = CARD("el-a", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const cardB = CARD("el-b", "population", [SLOT("s1", 2, [{ type: "pair" }], { food: 1 })]);
  const game = scriptedGame({
    aiCount: 1,
    deck: [cardA, cardB],
    rolls: [
      [1, 2, 3], [4, 5, 6], // event 1
      [1, 1, 1],            // event 2: only H rolls (AI eliminated)
    ],
  });
  game.finishReroll(0);
  game.finishReroll(1);
  game.tribes[1].food = 0; // AI starves
  game.finishGrowth(0);
  assert.equal(game.tribes[1].eliminated, true);
  // game continues? no - with one survivor the game is over.
  assert.equal(game.phase, "over");

  // with 3 tribes, a middle elimination keeps the game going
  const game2 = scriptedGame({
    aiCount: 2,
    deck: [cardA, cardB],
    rolls: [
      [1, 2, 3], [4, 5, 6], [1, 2, 3], // event 1
      [1, 1, 1], [2, 2, 2],            // event 2: AI2 eliminated
    ],
  });
  game2.finishReroll(0);
  game2.finishReroll(1);
  game2.finishReroll(2);
  game2.tribes[2].food = 0; // AI2 starves
  game2.finishGrowth(0);
  game2.finishGrowth(1);
  assert.equal(game2.eventIndex, 2);
  assert.equal(game2.phase, "reroll");
  assert.equal(game2.tribes[2].eliminated, true);
  assert.equal(game2.tribes[2].dice.length, 0); // no dice for eliminated tribe
  assert.deepEqual(game2.tribes[0].dice.map((d) => d.value), [1, 1, 1]);
  assert.deepEqual(game2.tribes[1].dice.map((d) => d.value), [2, 2, 2]);
  // claim order is computed after rerolls: only the two surviving tribes,
  // equal population -> seat-order tie-break
  game2.finishReroll(0);
  game2.finishReroll(1);
  assert.deepEqual(game2.claimOrder, [0, 1]);
});

// ---------------- Prompt 3: diceRequired + free rerolls ----------------

// The initial roll does not consume a reroll.
test("initial roll consumes no reroll", () => {
  const game = scriptedGame({ aiCount: 1, rolls: [[1, 2, 3], [4, 5, 6]] });
  for (const t of game.tribes) {
    assert.ok(t.dice.length > 0, `${t.name} rolled dice`);
    assert.equal(t.freeRerolls, FREE_REROLLS_PER_EVENT);
  }
});

// Every tribe (human and AI) starts an Event with the configured free rerolls.
test("every tribe starts an event with the configured free rerolls", () => {
  const game = new Game({ aiCount: 3, rng: makeRng(2) });
  for (const t of game.tribes) {
    assert.equal(t.freeRerolls, FREE_REROLLS_PER_EVENT, `${t.name} free rerolls`);
  }
});

// Unused free rerolls do not carry into the next Event; the next Event
// restores the configured number.
test("free rerolls reset each event and do not carry over", () => {
  const cardA = CARD("rr-a", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const cardB = CARD("rr-b", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({
    aiCount: 1,
    deck: [cardA, cardB],
    rolls: [
      [1, 2, 3], [4, 5, 6], // event 1
      [2, 2, 2], [6, 6, 6], // event 2
    ],
  });
  // Event 1: use exactly one free reroll, then lock.
  const d = game.tribes[0].dice[0].id;
  game.doReroll(0, [d]);
  assert.equal(game.tribes[0].freeRerolls, FREE_REROLLS_PER_EVENT - 1);
  game.finishReroll(0);
  game.finishReroll(1);
  game.finishGrowth(0);
  game.finishGrowth(1);
  // Event 2: restored to the configured count (not 1 carried + 2 new).
  assert.equal(game.eventIndex, 2);
  assert.equal(game.tribes[0].freeRerolls, FREE_REROLLS_PER_EVENT);
  assert.equal(game.tribes[1].freeRerolls, FREE_REROLLS_PER_EVENT);
});

// submitClaim enforces the exact dice count (fewer AND more are rejected).
test("submitClaim rejects fewer and more dice than diceRequired", () => {
  const card = CARD(
    "cnt",
    "highestDie",
    [SLOT("s1", 3, [{ type: "sumAtLeast", value: 10 }], { food: 1 })]
  );
  const game = scriptedGame({
    aiCount: 1,
    deck: [card],
    rolls: [
      [1, 2, 3], [4, 5, 6], // event 1 (discarded)
      [6, 6, 6, 1], [2, 3, 4], // event 2: H has population 4
    ],
  });
  game.tribes[0].population = 4; // test-only, before the (re)start
  game.startEvent();
  game.finishReroll(0);
  game.finishReroll(1);
  const ids = game.tribes[0].dice.map((d) => d.id);
  assert.throws(() => game.submitClaim(0, 0, [ids[0]]), /requires exactly 3 dice/);
  assert.throws(() => game.submitClaim(0, 0, ids.slice(0, 2)), /requires exactly 3 dice/);
  assert.throws(() => game.submitClaim(0, 0, ids), /requires exactly 3 dice/); // 4 > 3
  game.submitClaim(0, 0, ids.slice(0, 3)); // exactly 3 dice, sum 18
  assert.equal(game.slots[0].claimedBy, 0);
});

// A card full of high-dice slots stays on the board; undersized tribes
// simply cannot claim (the Event proceeds normally).
test("over-sized slots are impossible but the event still proceeds", () => {
  const card = CARD(
    "big5",
    "population",
    [SLOT("s1", 5, [{ type: "sumAtLeast", value: 20 }], { food: 5 })]
  );
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [4, 5, 6]] });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.claims.length, 0);
  assert.equal(game.phase, "night");
  // slot still present on the card, still unclaimed
  assert.equal(game.slots[0].def.diceRequired, 5);
  assert.equal(game.slots[0].claimedBy, null);
});

// The AI completes the reroll phase under the new rules and never spends a
// Tool while free rerolls remain.
test("ai completes the reroll phase using free rerolls before tools", () => {
  const card = CARD("ai-rr", "population", [SLOT("s1", 4, [{ type: "fourKind" }], { food: 5 })]);
  const game = scriptedGame({ aiCount: 1, deck: [card], rolls: [[1, 2, 3], [1, 3, 5]] });
  game.finishReroll(0);
  const ai = game.tribes[1];
  let decisions = 0;
  while (game.awaiting && game.awaiting.type === "reroll" && game.awaiting.tribeId === 1) {
    assert.ok(runAiTurn(game), "AI made a decision");
    if (ai.freeRerolls > 0)
      assert.equal(ai.tools, 1, "AI spent a Tool while free rerolls remained");
    if (++decisions > 10) throw new Error("AI reroll loop did not terminate");
  }
  assert.ok(game.rerollDone.has(1), "AI locked its dice");
  // 3-dice tribes cannot claim a 4-dice slot -> claiming was skipped
  assert.equal(game.phase, "night");
});
