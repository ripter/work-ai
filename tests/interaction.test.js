// Interaction flow tests (Prompt 3): model behavior the drag-and-drop UI
// relies on. Uses the same claimStaging state machine + Game action API the
// scene drives (minus Pixi), plus a replica of the scene's drop handler for
// swap semantics.

import { test } from "node:test";
import assert from "node:assert/strict";

import { scriptedGame } from "./helpers.js";
import {
  newStaging,
  unstage,
  dropDie,
  stagedState,
  stagedDieIds,
  poolDice,
} from "../src/ui/claimStaging.js";

const CARD = (id, orderRule, slots) => ({ id, name: id, orderRule, slots });
const SLOT = (id, diceRequired, requirement, reward) => ({
  id,
  name: id,
  diceRequired,
  requirement,
  reward,
});

// s0: exact pair of 2 dice; s1: any single die <= 4.
const CLAIM_CARD = CARD("c", "highestTotal", [
  SLOT("s0", 2, [{ type: "pair" }], { food: 2 }),
  SLOT("s1", 1, [{ type: "sumAtMost", value: 4 }], { tools: 1 }),
]);

// A game parked on the human's claim turn: human [4,4,3], AI [1,1,2].
function claimGame() {
  const game = scriptedGame({
    aiCount: 1,
    deck: [CLAIM_CARD],
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.phase, "claiming");
  assert.deepEqual(game.awaiting, { type: "claim", tribeId: 0 });
  return game;
}

// Replica of gameScene's onHumanDieDrop: when the target tray is full, the
// last staged die is returned to the pool first, then the drop happens.
function sceneDrop(st, game, dieId, slotIndex) {
  if (
    slotIndex !== null &&
    st.slot === slotIndex &&
    !st.staged.includes(dieId) &&
    st.staged.length >= game.slots[slotIndex].def.diceRequired
  )
    unstage(st, st.staged[st.staged.length - 1]);
  return dropDie(st, game, dieId, slotIndex);
}

test("staging consumes nothing; a claim consumes exactly the submitted dice", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id); // 4, 4, 3

  sceneDrop(st, game, a, 0);
  assert.equal(game.tribes[0].dice.length, 3); // tentative: nothing consumed
  sceneDrop(st, game, b, 0);
  assert.equal(stagedState(st, game, 0), "valid");
  assert.equal(game.tribes[0].dice.length, 3); // still nothing consumed

  game.submitClaim(0, 0, stagedDieIds(st, 0));
  assert.deepEqual(game.tribes[0].dice.map((d) => d.id), [c]); // exactly a,b gone
  assert.equal(game.slots[0].claimedBy, 0);
});

test("invalid claim attempts are rejected by the model; dice stay available", () => {
  const game = claimGame();
  const [a, , c] = game.tribes[0].dice.map((d) => d.id); // 4 and 3

  const st = newStaging();
  sceneDrop(st, game, a, 0);
  sceneDrop(st, game, c, 0);
  assert.equal(stagedState(st, game, 0), "invalid");
  assert.throws(() => game.submitClaim(0, 0, stagedDieIds(st, 0)), /do not satisfy/);
  assert.equal(game.tribes[0].dice.length, 3); // model unchanged
  assert.deepEqual(game.awaiting, { type: "claim", tribeId: 0 }); // still our turn

  // the same dice can still be used for a slot they do satisfy
  const st2 = newStaging();
  sceneDrop(st2, game, c, 1);
  assert.equal(stagedState(st2, game, 1), "valid");
});

test("a claimed slot cannot be claimed again", () => {
  const game = claimGame();
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  game.submitClaim(0, 0, [a, b]);
  assert.equal(game.slots[0].claimedBy, 0);
  const aiDie = game.tribes[1].dice[0];
  assert.throws(() => game.submitClaim(1, 0, [aiDie.id]), /already claimed/);
  assert.equal(game.slots[0].claimedBy, 0); // unchanged
});

test("reroll results are model-determined and deterministic (no UI involved)", () => {
  const mk = () =>
    scriptedGame({
      aiCount: 1,
      deck: [CLAIM_CARD],
      rolls: [
        [4, 4, 3],
        [1, 1, 2],
      ],
    });
  const g1 = mk();
  const g2 = mk();
  g1.doReroll(0, g1.tribes[0].dice.slice(1).map((d) => d.id)); // reroll dice 2,3
  g2.doReroll(0, g2.tribes[0].dice.slice(1).map((d) => d.id));
  assert.deepEqual(
    g1.tribes[0].dice.map((d) => d.value),
    g2.tribes[0].dice.map((d) => d.value),
    "same seed -> same reroll values"
  );
  assert.equal(g1.tribes[0].dice[0].value, 4); // kept die untouched
  assert.deepEqual(g1.awaiting, { type: "reroll", tribeId: 0 }); // still our turn
  assert.equal(g1.tribes[0].freeRerolls, 1);
  for (const v of g1.tribes[0].dice.slice(1).map((d) => d.value))
    assert.ok(v >= 1 && v <= 6);
});

test("free rerolls are consumed before Tools", () => {
  const game = scriptedGame({
    aiCount: 1,
    deck: [CLAIM_CARD],
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  const t = game.tribes[0];
  const id = t.dice[0].id;
  assert.equal(t.freeRerolls, 2);
  assert.equal(t.tools, 1);
  game.doReroll(0, [id]);
  assert.equal(t.freeRerolls, 1);
  assert.equal(t.tools, 1);
  game.doReroll(0, [id]);
  assert.equal(t.freeRerolls, 0);
  assert.equal(t.tools, 1);
  game.doReroll(0, [id]);
  assert.equal(t.freeRerolls, 0);
  assert.equal(t.tools, 0);
  assert.throws(() => game.doReroll(0, [id]), /no free rerolls or Tools/);
});

test("DONE ROLLING (finishReroll) consumes no rerolls and no Tools", () => {
  const game = scriptedGame({
    aiCount: 1,
    deck: [CLAIM_CARD],
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  const t = game.tribes[0];
  game.doReroll(0, [t.dice[0].id]); // spend 1 free reroll
  assert.equal(t.freeRerolls, 1);
  game.finishReroll(0);
  assert.equal(t.freeRerolls, 1); // untouched
  assert.equal(t.tools, 1); // untouched
});

test("dropping a new die into a full tray swaps out the last staged die", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id); // 4, 4, 3

  sceneDrop(st, game, a, 0);
  sceneDrop(st, game, b, 0);
  assert.deepEqual(st.staged, [a, b]);
  assert.equal(sceneDrop(st, game, c, 0), "staged");
  assert.deepEqual(st.staged, [a, c]); // b was returned to the pool
  assert.equal(stagedState(st, game, 0), "invalid"); // 4,3 is not a pair
  assert.deepEqual(poolDice(st, game).map((d) => d.id), [b]);
});

test("stagedState mirrors the model's claim validation", () => {
  const game = claimGame();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id); // 4, 4, 3

  const st = newStaging();
  sceneDrop(st, game, a, 0);
  sceneDrop(st, game, b, 0);
  assert.equal(stagedState(st, game, 0), "valid");

  const st2 = newStaging();
  sceneDrop(st2, game, a, 0);
  sceneDrop(st2, game, c, 0);
  assert.equal(stagedState(st2, game, 0), "invalid");
  assert.throws(() => game.submitClaim(0, 0, stagedDieIds(st2, 0)));

  // the valid staged set is accepted by the model
  game.submitClaim(0, 0, stagedDieIds(st, 0));
  assert.equal(game.slots[0].claimedBy, 0);
  assert.deepEqual(game.tribes[0].dice.map((d) => d.id), [c]);
});

