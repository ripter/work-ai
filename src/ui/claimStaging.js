// Pure tentative-claim staging state machine (Prompt 3). No Pixi, no
// timers: plain state + functions on a Game, so it is unit-testable in
// Node and the drag/drop layer stays a thin view over it.
//
// Design:
// - Staging NEVER touches the game model: the tribe's dice pool is only
//   mutated by game.submitClaim(). "Staged" dice still live in
//   game.tribes[0].dice; staging just records which ones the player is
//   tentatively offering to one slot.
// - One tentative slot at a time: staging into a different slot returns
//   the previously staged dice to the pool automatically.
// - The Game model remains the sole authority on claim legality; this
//   module only mirrors its rules (diceRequired + checkSlot) for live
//   feedback and basic UI-side guards.

import { checkSlot, hasLegalClaim } from "../game/rules.js";

// Staging state, owned by the UI (e.g. the game scene):
//   { slot: null | slotIndex, staged: [dieId, ...] }
// `slot` is the single slot the staged dice are offered to (null when
// nothing is staged). `staged` is an ordered list of die ids.
export function newStaging() {
  return { slot: null, staged: [] };
}

export function isHumanClaimTurn(game) {
  const a = game.awaiting;
  return (
    a &&
    a.type === "claim" &&
    a.tribeId === 0 &&
    game.tribes[0].isHuman &&
    !game.tribes[0].eliminated
  );
}

// The human's dice not currently staged (staged dice are still in the
// model pool; this is the set that would be "in the tray" visually).
export function poolDice(st, game) {
  const human = game.tribes[0];
  const staged = new Set(st.staged);
  return human.dice.filter((d) => !staged.has(d.id));
}

// A slot can be attempted at all only if the human holds at least
// diceRequired dice in total (staged or not) for this Event. Staging
// never removes dice from the model pool, so this is the stable
// "your tribe isn't large enough / you don't have enough dice remaining"
// state.
export function slotAttemptable(game, slotIndex) {
  const slot = game.slots[slotIndex];
  if (!slot) return false;
  return game.tribes[0].dice.length >= slot.def.diceRequired;
}

// May the human stage dice into this slot right now?
export function canStageInto(game, st, slotIndex) {
  if (!isHumanClaimTurn(game)) return false;
  const slot = game.slots[slotIndex];
  if (!slot || slot.claimedBy !== null) return false;
  return slotAttemptable(game, slotIndex);
}

// Stage a die into a slot. Mutates st. Returns true on success.
// Fails (state unchanged) when:
//   - not the human's claim turn / slot claimed / not attemptable
//   - the die is not in the human's pool (already staged or consumed)
//   - the slot's tray is already full (swap = unstage first, then stage)
// Switching to a different slot returns the previous slot's dice to the
// pool (one tentative slot at a time).
export function stage(st, game, dieId, slotIndex) {
  if (!canStageInto(game, st, slotIndex)) return false;
  const human = game.tribes[0];
  if (!human.dice.some((d) => d.id === dieId)) return false;
  if (st.staged.includes(dieId) && st.slot === slotIndex) return true; // no-op
  if (st.slot === slotIndex) {
    if (st.staged.length >= game.slots[slotIndex].def.diceRequired)
      return false; // tray full
  } else if (st.slot !== null) {
    st.staged = []; // return the other slot's tentative dice to the pool
  }
  st.staged.push(dieId);
  st.slot = slotIndex;
  return true;
}

// Return one staged die to the pool. Returns false if it wasn't staged.
export function unstage(st, dieId) {
  const i = st.staged.indexOf(dieId);
  if (i === -1) return false;
  st.staged.splice(i, 1);
  if (st.staged.length === 0) st.slot = null;
  return true;
}

// Return every staged die to the pool (Clear / Return Dice).
export function clearStaging(st) {
  st.staged = [];
  st.slot = null;
}

// Drop a die: stage into slotIndex, or (when slotIndex is null / the drop
// is rejected) return the die to the pool. Returns "staged" | "returned"
// | "rejected".
export function dropDie(st, game, dieId, slotIndex) {
  if (st.staged.includes(dieId)) {
    if (slotIndex === null) return unstage(st, dieId) ? "returned" : "rejected";
    if (slotIndex === st.slot) return "staged"; // already here: no-op
    // moving a staged die to another slot: it re-enters via stage(),
    // which clears the old slot's tray first
  }
  if (slotIndex !== null && stage(st, game, dieId, slotIndex)) return "staged";
  if (unstage(st, dieId)) return "returned";
  return "rejected";
}

// "incomplete" | "invalid" | "valid" — or null when this slot has no
// staged dice. Uses the same checks the model applies on submit:
// exact count (diceRequired) then the requirement (checkSlot).
export function stagedState(st, game, slotIndex) {
  if (st.slot !== slotIndex || st.staged.length === 0) return null;
  const slot = game.slots[slotIndex];
  const values = st.staged
    .map((id) => game.tribes[0].dice.find((d) => d.id === id))
    .map((d) => d.value);
  if (st.staged.length < slot.def.diceRequired) return "incomplete";
  return checkSlot(values, slot.def) ? "valid" : "invalid";
}

// The exact die ids that would be submitted for this slot (empty when
// nothing is staged there). Pass to game.submitClaim on Claim.
export function stagedDieIds(st, slotIndex) {
  return st.slot === slotIndex ? [...st.staged] : [];
}

// Slot display state from the human's perspective (for the card panel):
//   "claimed"    claimed by someone
//   "neutral"    not in the claiming phase (or human eliminated)
//   "impossible" the human holds fewer dice than diceRequired
//   "no-match"   enough dice, but no current combination satisfies it
//   "available"  a legal claim exists with the current dice
export function slotDisplayState(game, st, slotIndex) {
  const slot = game.slots[slotIndex];
  if (slot.claimedBy !== null) return "claimed";
  const human = game.tribes[0];
  if (game.phase !== "claiming" || human.eliminated) return "neutral";
  if (!slotAttemptable(game, slotIndex)) return "impossible";
  if (stagedState(st, game, slotIndex)) {
    // actively staging this slot: judge the staged set itself
    return "staging";
  }
  if (!hasLegalClaim(human.dice, slot.def)) return "no-match";
  return "available";
}
