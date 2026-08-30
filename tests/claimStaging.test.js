// claimStaging (Prompt 3) unit tests: tentative claim staging is pure UI
// state. It must never consume dice or mutate the model, it must mirror
// the model's legality rules for live feedback, and it must keep exactly
// one tentative slot active.

import { test } from "node:test";
import assert from "node:assert/strict";

import { scriptedGame } from "./helpers.js";
import {
  newStaging,
  isHumanClaimTurn,
  poolDice,
  slotAttemptable,
  canStageInto,
  stage,
  unstage,
  clearStaging,
  dropDie,
  stagedState,
  stagedDieIds,
  slotDisplayState,
} from "../src/ui/claimStaging.js";

const CARD = (id, orderRule, slots) => ({ id, name: id, orderRule, slots });
const SLOT = (id, diceRequired, requirement, reward) => ({
  id,
  name: id,
  diceRequired,
  requirement,
  reward,
});

// s0 needs an exact pair of 2 dice; s1 needs any single die <= 4; s2 needs
// 4 dice (human only holds 3 -> impossible); s3 needs a 3-dice straight
// (human's [4,4,3] can't make one -> no-match).
const CLAIM_CARD = CARD("c", "highestTotal", [
  SLOT("s0", 2, [{ type: "pair" }], { food: 2 }),
  SLOT("s1", 1, [{ type: "sumAtMost", value: 4 }], { tools: 1 }),
  SLOT("s2", 4, [{ type: "fourKind" }], { food: 9 }),
  SLOT("s3", 3, [{ type: "straight" }], { food: 5 }),
]);

// A game parked on the human's claim turn. Human [4,4,3] (total 11) beats
// AI [1,1,2] (total 4) under highestTotal, so the human claims first.
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

test("staging starts empty", () => {
  const st = newStaging();
  assert.equal(st.slot, null);
  assert.deepEqual(st.staged, []);
});

test("isHumanClaimTurn gates on phase, seat and human flag", () => {
  const game = claimGame();
  assert.equal(isHumanClaimTurn(game), true);

  const fresh = scriptedGame({
    aiCount: 1,
    deck: [CLAIM_CARD],
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  assert.equal(fresh.phase, "reroll");
  assert.equal(isHumanClaimTurn(fresh), false);

  game.passClaim(0);
  assert.equal(game.awaiting.tribeId, 1);
  assert.equal(isHumanClaimTurn(game), false);
});

test("staging never touches the model pool", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  const before = game.tribes[0].dice.map((d) => [d.id, d.value]);

  assert.equal(stage(st, game, a, 0), true);
  assert.equal(stage(st, game, b, 0), true);
  assert.equal(game.tribes[0].dice.length, 3);
  assert.deepEqual(game.tribes[0].dice.map((d) => [d.id, d.value]), before);
  assert.equal(game.claims.length, 0);
});

test("poolDice excludes staged dice", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id);
  assert.equal(poolDice(st, game).length, 3);
  stage(st, game, a, 0);
  stage(st, game, b, 0);
  assert.deepEqual(poolDice(st, game).map((d) => d.id), [c]);
});

test("stagedState tracks incomplete -> valid for the exact pair", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  stage(st, game, a, 0);
  assert.equal(stagedState(st, game, 0), "incomplete");
  assert.equal(stagedState(st, game, 1), null);
  stage(st, game, b, 0);
  assert.equal(stagedState(st, game, 0), "valid");
  assert.deepEqual(stagedDieIds(st, 0), [a, b]);
  assert.deepEqual(stagedDieIds(st, 1), []);
});

test("stagedState is invalid when the staged set fails the requirement", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, , c] = game.tribes[0].dice.map((d) => d.id); // 4 and 3
  stage(st, game, a, 0);
  stage(st, game, c, 0);
  assert.equal(stagedState(st, game, 0), "invalid");
});

test("staging a full tray is rejected", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id);
  stage(st, game, a, 0);
  stage(st, game, b, 0);
  assert.equal(stage(st, game, c, 0), false);
  assert.deepEqual(st.staged, [a, b]);
});

test("staging into a different slot returns the previous slot's dice", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id);
  stage(st, game, a, 0);
  assert.equal(stage(st, game, b, 1), true);
  assert.equal(st.slot, 1);
  assert.deepEqual(st.staged, [b]);
  const pool = poolDice(st, game).map((d) => d.id).sort((x, y) => x - y);
  assert.deepEqual(pool, [a, c].sort((x, y) => x - y));
});

test("staging a die that is not in the pool is rejected", () => {
  const game = claimGame();
  const st = newStaging();
  assert.equal(stage(st, game, 999999, 1), false);
  assert.deepEqual(st.staged, []);
});

test("claimed slots cannot be staged into", () => {
  // lowestDie: AI's min die (1) is below the human's (3), so the AI claims
  // first, then it is the human's turn with slot 0 already claimed.
  const deck = [
    CARD("c2", "lowestDie", [
      SLOT("s0", 1, [{ type: "sumAtMost", value: 4 }], { tools: 1 }),
      SLOT("s1", 2, [{ type: "pair" }], { food: 2 }),
    ]),
  ];
  const game = scriptedGame({
    aiCount: 1,
    deck,
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  game.finishReroll(0);
  game.finishReroll(1);
  assert.equal(game.awaiting.tribeId, 1);
  const aiDie = game.tribes[1].dice[0]; // value 1
  game.submitClaim(1, 0, [aiDie.id]);
  assert.deepEqual(game.awaiting, { type: "claim", tribeId: 0 });

  const st = newStaging();
  assert.equal(slotAttemptable(game, 0), true);
  assert.equal(canStageInto(game, st, 0), false); // claimed
  assert.equal(stage(st, game, game.tribes[0].dice[0].id, 0), false);
  assert.equal(slotDisplayState(game, st, 0), "claimed");
  assert.equal(canStageInto(game, st, 1), true); // still open
});

test("unstage and clearStaging return dice to the pool", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  stage(st, game, a, 0);
  stage(st, game, b, 0);
  assert.equal(unstage(st, a), true);
  assert.deepEqual(st.staged, [b]);
  assert.equal(st.slot, 0);
  assert.equal(unstage(st, a), false);
  clearStaging(st);
  assert.equal(st.slot, null);
  assert.deepEqual(st.staged, []);
});

test("dropDie stages, no-ops, and returns to the pool", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, c] = game.tribes[0].dice.map((d) => d.id);

  assert.equal(dropDie(st, game, a, 1), "staged");
  assert.equal(dropDie(st, game, a, 1), "staged"); // already here: no-op
  assert.equal(st.slot, 1);
  assert.equal(dropDie(st, game, a, null), "returned"); // drop outside
  assert.equal(st.slot, null);
  assert.equal(dropDie(st, game, c, 0), "staged"); // 1 of 2: incomplete
  assert.equal(stagedState(st, game, 0), "incomplete");
});

test("dropDie moves a staged die to another slot", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  dropDie(st, game, a, 0);
  assert.equal(dropDie(st, game, a, 1), "staged");
  assert.equal(st.slot, 1);
  assert.deepEqual(st.staged, [a]);
  const pool = poolDice(st, game).map((d) => d.id).sort((x, y) => x - y);
  assert.deepEqual(pool, [b, game.tribes[0].dice[2].id].sort((x, y) => x - y));
});

test("dropDie into a full tray is rejected (scene handles the swap)", () => {
  const game = claimGame();
  const st = newStaging();
  const [a, b, c] = game.tribes[0].dice.map((d) => d.id);
  dropDie(st, game, a, 0);
  dropDie(st, game, b, 0);
  assert.equal(dropDie(st, game, c, 0), "rejected");
  assert.deepEqual(st.staged, [a, b]);
});

test("slotDisplayState covers every slot state", () => {
  const game = claimGame();
  const st = newStaging();

  assert.equal(slotDisplayState(game, st, 0), "available"); // pair [4,4]
  assert.equal(slotDisplayState(game, st, 1), "available"); // any die <= 4
  assert.equal(slotDisplayState(game, st, 2), "impossible"); // needs 4 dice
  assert.equal(slotDisplayState(game, st, 3), "no-match"); // no straight

  // actively staging
  stage(st, game, game.tribes[0].dice[0].id, 0);
  assert.equal(slotDisplayState(game, st, 0), "staging");

  // claimed
  const [a, b] = game.tribes[0].dice.map((d) => d.id);
  stage(st, game, b, 0);
  game.submitClaim(0, 0, stagedDieIds(st, 0));
  assert.equal(slotDisplayState(game, st, 0), "claimed");
});

test("slotDisplayState is neutral outside the claiming phase", () => {
  const game = scriptedGame({
    aiCount: 1,
    deck: [CLAIM_CARD],
    rolls: [
      [4, 4, 3],
      [1, 1, 2],
    ],
  });
  assert.equal(game.phase, "reroll");
  const st = newStaging();
  assert.equal(slotDisplayState(game, st, 0), "neutral");
});

