// Full-game integration tests: AI-only games must terminate with a single
// winner, with valid invariants throughout. These double as the scripted
// "AI can complete a game" validation.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Game } from "../src/game/game.js";
import { makeRng, runFullAiGame } from "./helpers.js";

function assertInvariants(game) {
  assert.ok(game.phase, "phase set");
  for (const t of game.tribes) {
    assert.ok(t.food >= 0, `${t.name} food negative`);
    assert.ok(t.tools >= 0, `${t.name} tools negative`);
    assert.ok(t.population >= 0, `${t.name} population negative`);
    for (const d of t.dice) {
      assert.ok(d.value >= 1 && d.value <= 6, `die out of range: ${d.value}`);
    }
    if (t.eliminated) {
      assert.equal(t.population, 0, `eliminated ${t.name} still has population`);
      assert.equal(t.dice.length, 0, `eliminated ${t.name} still has dice`);
    }
  }
  for (const claim of game.claims) {
    assert.ok(claim.tribeId >= 0 && claim.tribeId < game.tribes.length);
    assert.ok(claim.slotIndex >= 0 && claim.slotIndex < game.slots.length);
    assert.equal(game.slots[claim.slotIndex].claimedBy, claim.tribeId);
  }
}

test("full AI game (1 AI) terminates with a winner", () => {
  const game = runFullAiGame({ aiCount: 1, seed: 42 });
  assertInvariants(game);
  assert.equal(game.phase, "over");
  assert.ok(game.winner);
  assert.equal(game.aliveTribes().length, 1);
  assert.equal(game.winner.id, game.aliveTribes()[0].id);
});

test("full AI game (2 AI) terminates with a winner", () => {
  const game = runFullAiGame({ aiCount: 2, seed: 7 });
  assertInvariants(game);
  assert.equal(game.phase, "over");
  assert.ok(game.winner);
  assert.equal(game.aliveTribes().length, 1);
});

test("full AI game (3 AI) terminates with a winner", () => {
  const game = runFullAiGame({ aiCount: 3, seed: 99 });
  assertInvariants(game);
  assert.equal(game.phase, "over");
  assert.ok(game.winner);
  assert.equal(game.aliveTribes().length, 1);
});

test("multiple full AI games: several event/night cycles, at least one elimination", () => {
  let eliminationsSeen = 0;
  for (const aiCount of [1, 2, 3]) {
    for (const seed of [1, 2, 3, 10, 20]) {
      const game = runFullAiGame({ aiCount, seed });
      assertInvariants(game);
      assert.equal(game.phase, "over");
      // nobody can starve in Night 1 (starting Food 4 >= starting Pop 3),
      // so every game must contain at least 2 events
      assert.ok(game.eventIndex >= 2, `game ended after ${game.eventIndex} event(s)`);
      if (game.tribes.some((t) => t.eliminated)) eliminationsSeen++;
      // ends with exactly one survivor (winner) or zero (draw)
      assert.ok(game.aliveTribes().length <= 1);
      if (game.winner) assert.equal(game.aliveTribes().length, 1);
    }
  }
  assert.ok(
    eliminationsSeen > 0,
    "expected at least one elimination across 15 full games"
  );
});

test("a night that eliminates every tribe ends the game in a draw", () => {
  const card = {
    id: "draw",
    name: "Draw",
    orderRule: "population",
    slots: [{ id: "ds", name: "s", requirement: [{ type: "fourKind" }], reward: { food: 1 } }],
  };
  const game = new Game({ aiCount: 1, deck: [card], rng: makeRng(3) });
  game.finishReroll(0);
  game.tribes[0].food = 0; // both tribes will starve at Night
  game.tribes[1].food = 0;
  game.finishReroll(1);
  // nobody can claim four of a kind with 3 dice -> straight to Night,
  // where both tribes starve to 0
  assert.equal(game.phase, "over");
  assert.equal(game.winner, null);
  assert.ok(game.tribes.every((t) => t.eliminated));
});

test("same seed + same deck -> identical game (deterministic)", () => {
  const deck = [
    {
      id: "d1",
      name: "D1",
      orderRule: "population",
      slots: [{ id: "d1s1", name: "s", requirement: [{ type: "pair" }], reward: { food: 2 } }],
    },
  ];
  const a = runFullAiGame({ aiCount: 1, deck, seed: 5 });
  const b = runFullAiGame({ aiCount: 1, deck, seed: 5 });
  assert.deepEqual(a.log, b.log);
});
