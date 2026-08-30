// Game core: state + synchronous state machine + action API.
//
// Design rules:
// - No Pixi, no timers, no I/O. Everything is synchronous and testable in
//   Node. The UI layer drives timing (AI delays) and human input.
// - Human and AI players perform the SAME actions through this API
//   (doReroll / finishReroll / submitClaim / passClaim /
//   resolveWithTarget / buyGrowth / finishGrowth).
// - `this.awaiting` describes whose decision is currently required, so the
//   UI (or a future network layer) knows what to prompt for.
//
// Phase flow per Event:
//   startEvent -> 'reroll' -> 'claiming' -> 'reward' -> 'night'
//   -> (back to startEvent) ... until phase 'over'.
//
// By default the reward phase resolves all queued claims synchronously.
// Pass stepRewards:true to the constructor to instead resolve one queued
// claim per stepReward() call (the UI uses this to present rewards in
// sequence); see stepReward() for the result descriptors.

import { START, TRIBE_META, FREE_REROLLS_PER_EVENT } from "./config.js";
import { PROTOTYPE_EVENTS } from "../data/events.js";
import {
  computeClaimOrder,
  checkSlot,
  legalSubsetsForSlot,
  feedTribe,
  applyGrowth,
  applyReward,
  isHostileReward,
  validHostileTargets,
  ORDER_RULES,
  describeReward,
} from "./rules.js";

let dieSeq = 0;
function makeDie(value) {
  return { id: ++dieSeq, value };
}

export class Game {
  constructor({ aiCount = 1, deck, rng, rollFn, stepRewards = false } = {}) {
    if (aiCount < 1 || aiCount > 3) throw new Error("aiCount must be 1..3");
    this.rng = rng ?? Math.random;
    // stepRewards (UI mode): queued rewards resolve one per stepReward()
    // call instead of all at once, so a UI can present them in sequence.
    // Default false keeps the original synchronous behavior.
    this.stepRewards = stepRewards;
    this.rollFn =
      rollFn ??
      ((count) => Array.from({ length: count }, () => 1 + Math.floor(this.rng() * 6)));

    this.tribes = Array.from({ length: aiCount + 1 }, (_, i) => ({
      id: i,
      name: TRIBE_META[i].name,
      color: TRIBE_META[i].color,
      isHuman: i === 0,
      population: START.population,
      food: START.food,
      tools: START.tools,
      freeRerolls: 0,
      eliminated: false,
      dice: [],
    }));

    this.deck = deck ? [...deck] : [...PROTOTYPE_EVENTS];
    this.shuffleDeck();
    this.deckPos = 0;
    this.eventIndex = 0;
    this.winner = null;
    this.log = [];

    // per-Event state (filled by startEvent)
    this.card = null;
    this.slots = [];
    this.claims = [];
    this.claimOrder = [];
    this.phase = "new";

    this.startEvent();
  }

  // ---------------- logging ----------------

  pushLog(msg) {
    this.log.push(msg);
    return msg;
  }

  logEvent(msg) {
    this.pushLog(`=== ${msg} ===`);
  }

  // ---------------- helpers ----------------

  aliveTribes() {
    return this.tribes.filter((t) => !t.eliminated);
  }

  tribe(id) {
    return this.tribes[id];
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  drawCard() {
    if (this.deckPos >= this.deck.length) {
      this.shuffleDeck();
      this.deckPos = 0;
      this.pushLog("Deck reshuffled and redealt");
    }
    const card = this.deck[this.deckPos++];
    return card;
  }

  // ---------------- Event / rolling / reroll ----------------

  startEvent() {
    this.eventIndex++;
    this.card = this.drawCard();
    this.slots = this.card.slots.map((def) => ({ def, claimedBy: null }));
    this.claims = [];
    this.claimResolvePos = 0;
    this.claimOrder = [];
    this.doneTribes = new Set();
    this.rerollDone = new Set();
    this.turnTribe = null;
    this.awaiting = null;

    this.logEvent(
      `Event ${this.eventIndex}: ${this.card.name} ` +
        `(claim order: ${ORDER_RULES[this.card.orderRule].label})`
    );

    // Population determines the dice pool size at Event start.
    // Snapshot: population changes later (rewards, night) do NOT change
    // this Event's dice. Every surviving tribe also gets its free rerolls
    // back (unused free rerolls never carry over between Events).
    for (const t of this.tribes) {
      if (t.eliminated) {
        t.dice = [];
        t.freeRerolls = 0;
        continue;
      }
      t.dice = this.rollFn(t.population).map((v) => makeDie(v));
      t.freeRerolls = FREE_REROLLS_PER_EVENT;
      this.pushLog(
        `${t.name} rolls ${t.dice.length} dice: [${t.dice.map((d) => d.value).join(", ")}] ` +
          `(${FREE_REROLLS_PER_EVENT} free rerolls)`
      );
    }

    this.phase = "reroll";
    this.rerollPos = 0;
    for (const t of this.tribes) if (t.eliminated) this.rerollDone.add(t.id);
    this.advanceReroll();
  }

  advanceReroll() {
    while (this.rerollPos < this.tribes.length) {
      const t = this.tribes[this.rerollPos++];
      if (t.eliminated || this.rerollDone.has(t.id)) continue;
      this.turnTribe = t.id;
      this.awaiting = { type: "reroll", tribeId: t.id };
      return;
    }
    // all tribes locked their dice -> compute claim order, start claiming
    this.phase = "claiming";
    this.claimOrder = computeClaimOrder(this.card, this.tribes);
    this.pushLog(
      "Claim order: " +
        this.claimOrder
          .map((id) => this.tribes[id].name)
          .join(" > ")
    );
    this.turnPos = 0;
    this.advanceTurn();
  }

  // Reroll the given dice (must be a non-empty subset of the tribe's pool).
  // The reroll consumes 1 free reroll if the tribe has any left, otherwise
  // 1 Tool. The cost is the same regardless of how many dice are rerolled.
  // The tribe then decides again (reroll more / finish).
  doReroll(tribeId, dieIds) {
    this.assertRerollTurn(tribeId);
    const t = this.tribes[tribeId];
    if (!Array.isArray(dieIds) || dieIds.length === 0)
      throw new Error("A reroll must reroll at least 1 die");
    const poolIds = new Set(t.dice.map((d) => d.id));
    const unique = [...new Set(dieIds)];
    if (unique.length !== dieIds.length) throw new Error("Duplicate die ids in reroll");
    for (const id of dieIds)
      if (!poolIds.has(id)) throw new Error("Die is not in the tribe's pool");

    let cost;
    if (t.freeRerolls > 0) {
      t.freeRerolls -= 1;
      cost = `uses a free reroll (${t.freeRerolls} left)`;
    } else if (t.tools > 0) {
      t.tools -= 1;
      cost = `spends 1 Tool (${t.tools} left)`;
    } else {
      throw new Error(`${t.name} has no free rerolls or Tools left`);
    }

    const rerolled = t.dice.filter((d) => dieIds.includes(d.id));
    for (const d of rerolled) d.value = 1 + Math.floor(this.rng() * 6);
    this.pushLog(
      `${t.name} ${cost} and rerolls ${rerolled.length} die: ` +
        `[${rerolled.map((d) => d.value).join(", ")}] ` +
        `(dice: [${t.dice.map((d) => d.value).join(", ")}])`
    );
    // still this tribe's turn: it may reroll again or finish
  }

  finishReroll(tribeId) {
    this.assertRerollTurn(tribeId);
    const t = this.tribes[tribeId];
    this.rerollDone.add(tribeId);
    this.pushLog(
      `${t.name} locks its dice [${t.dice.map((d) => d.value).join(", ")}] ` +
        `(${t.tools} Tool${t.tools === 1 ? "" : "s"} kept)`
    );
    this.turnTribe = null;
    this.awaiting = null;
    this.advanceReroll();
  }

  assertRerollTurn(tribeId) {
    if (this.phase !== "reroll") throw new Error(`Not in reroll phase (in ${this.phase})`);
    if (this.turnTribe !== tribeId)
      throw new Error(`Not ${this.tribes[tribeId].name}'s reroll turn`);
  }

  // ---------------- claiming ----------------

  // Can this tribe legally claim ANY unclaimed slot with its remaining dice?
  canClaimAny(tribeId) {
    const t = this.tribes[tribeId];
    if (t.eliminated || t.dice.length === 0) return false;
    return this.slots.some(
      (s) => s.claimedBy === null && legalSubsetsForSlot(t.dice, s.def, { first: true }).length > 0
    );
  }

  advanceTurn() {
    if (this.claimOrder.length === 0) {
      this.beginRewards();
      return;
    }
    for (let step = 0; step < this.claimOrder.length; step++) {
      const idx = (this.turnPos + step) % this.claimOrder.length;
      const id = this.claimOrder[idx];
      const t = this.tribes[id];
      if (t.eliminated || this.doneTribes.has(id)) continue;
      if (!this.canClaimAny(id)) {
        // Legality only shrinks during an Event (dice and slots only
        // decrease), so this tribe can never claim later either.
        this.doneTribes.add(id);
        this.pushLog(`${t.name} cannot make any legal claim — out of the loop`);
        continue;
      }
      this.turnPos = (idx + 1) % this.claimOrder.length;
      this.turnTribe = id;
      this.awaiting = { type: "claim", tribeId: id };
      return;
    }
    // every surviving tribe is done -> claiming phase over
    this.turnTribe = null;
    this.awaiting = null;
    this.beginRewards();
  }

  // Claim slotIndex with exactly the selected dice (die ids).
  submitClaim(tribeId, slotIndex, dieIds) {
    if (this.phase !== "claiming") throw new Error(`Not in claiming phase (in ${this.phase})`);
    if (this.turnTribe !== tribeId)
      throw new Error(`Not ${this.tribes[tribeId].name}'s claim turn`);
    const t = this.tribes[tribeId];
    const slot = this.slots[slotIndex];
    if (!slot) throw new Error(`No such slot ${slotIndex}`);
    if (slot.claimedBy !== null) throw new Error("Slot already claimed");
    if (!Array.isArray(dieIds) || dieIds.length === 0)
      throw new Error("A claim must submit at least 1 die");
    const unique = [...new Set(dieIds)];
    if (unique.length !== dieIds.length) throw new Error("Duplicate die ids in claim");

    const poolIds = new Set(t.dice.map((d) => d.id));
    for (const id of dieIds)
      if (!poolIds.has(id)) throw new Error("Die is not in the tribe's pool");
    const selected = t.dice.filter((d) => dieIds.includes(d.id));
    const need = slot.def.diceRequired;
    if (selected.length !== need)
      throw new Error(
        `"${slot.def.name}" requires exactly ${need} dice (you submitted ${selected.length})`
      );
    if (!checkSlot(selected.map((d) => d.value), slot.def))
      throw new Error(
        `Selected dice [${selected.map((d) => d.value).join(", ")}] do not satisfy "${slot.def.name}"`
      );

    slot.claimedBy = tribeId;
    t.dice = t.dice.filter((d) => !dieIds.includes(d.id));
    this.claims.push({ tribeId, slotIndex, diceIds: [...dieIds].sort((a, b) => a - b) });
    this.pushLog(
      `${t.name} claims "${slot.def.name}" with [${selected.map((d) => d.value).join(", ")}] ` +
        `-> reward queued: ${describeReward(slot.def.reward)}`
    );
    this.turnTribe = null;
    this.awaiting = null;
    this.advanceTurn();
  }

  // Voluntary pass: tribe opts out of claiming for the rest of this Event.
  passClaim(tribeId) {
    if (this.phase !== "claiming") throw new Error(`Not in claiming phase (in ${this.phase})`);
    if (this.turnTribe !== tribeId)
      throw new Error(`Not ${this.tribes[tribeId].name}'s claim turn`);
    this.doneTribes.add(tribeId);
    this.pushLog(`${this.tribes[tribeId].name} passes`);
    this.turnTribe = null;
    this.awaiting = null;
    this.advanceTurn();
  }

  // ---------------- rewards ----------------

  beginRewards() {
    this.phase = "reward";
    this.claimResolvePos = 0;
    this.logEvent(`Rewards (${this.claims.length} queued claim${this.claims.length === 1 ? "" : "s"})`);
    if (this.stepRewards) return; // UI drives stepReward() one claim at a time
    this.advanceReward();
  }

  // Resolves queued claims in the exact order the slots were claimed.
  // Stops and sets awaiting={type:'target'} when a hostile reward needs a
  // target; continues after resolveWithTarget().
  advanceReward() {
    for (;;) {
      const r = this.stepReward();
      if (r.done || r.needsTarget) return;
    }
  }

  // Resolves exactly ONE queued claim (or skips one voided/fizzled claim),
  // in the exact order the slots were claimed. In stepRewards mode a UI
  // calls this repeatedly to present rewards one at a time;
  // advanceReward() is a loop over it for the default synchronous mode.
  //
  // Returns one of:
  //   { done: true }                                queue empty, Night started
  //   { needsTarget: { tribeId, effect } }          hostile reward, awaiting set
  //   { applied:   { tribeId, slotIndex, lines } }  reward applied
  //   { voided:    { tribeId, slotIndex } }         claimer eliminated, skipped
  //   { fizzled:   { tribeId, slotIndex } }         no valid hostile target
  stepReward() {
    if (this.phase !== "reward")
      throw new Error(`Not in reward phase (in ${this.phase})`);
    if (this.awaiting && this.awaiting.type === "target")
      throw new Error("A hostile reward is awaiting target selection");
    const claim = this.claims[this.claimResolvePos];
    if (!claim) {
      this.finishRewards();
      return { done: true };
    }
    const claimer = this.tribes[claim.tribeId];
    const slot = this.slots[claim.slotIndex];
    if (claimer.eliminated) {
      this.pushLog(
        `${claimer.name}'s queued reward for "${slot.def.name}" is VOIDED (tribe eliminated)`
      );
      this.claimResolvePos++;
      return { voided: { tribeId: claim.tribeId, slotIndex: claim.slotIndex } };
    }
    const reward = slot.def.reward;
    if (isHostileReward(reward)) {
      const targets = validHostileTargets(this.tribes, claim.tribeId, reward);
      if (targets.length === 0) {
        // Prototype assumption: a hostile reward with no valid target at
        // resolution time simply fizzles (the claim still stands).
        this.pushLog(
          `${claimer.name}'s ${describeReward(reward)} fizzles (no valid target)`
        );
        this.claimResolvePos++;
        return { fizzled: { tribeId: claim.tribeId, slotIndex: claim.slotIndex } };
      }
      this.awaiting = {
        type: "target",
        tribeId: claim.tribeId,
        effect: reward,
      };
      this.pushLog(
        `${claimer.name} must choose a target for: ${describeReward(reward)}`
      );
      return { needsTarget: { tribeId: claim.tribeId, effect: reward } };
    }
    const lines = [];
    for (const line of applyReward(this.tribes, claim.tribeId, reward, null))
      lines.push(line);
    this.claimResolvePos++;
    return { applied: { tribeId: claim.tribeId, slotIndex: claim.slotIndex, lines } };
  }

  // Targets a hostile reward currently awaiting selection.
  resolveWithTarget(tribeId, targetId) {
    if (this.phase !== "reward") throw new Error(`Not in reward phase (in ${this.phase})`);
    if (!this.awaiting || this.awaiting.type !== "target")
      throw new Error("No target selection pending");
    if (this.awaiting.tribeId !== tribeId)
      throw new Error("Wrong tribe resolving target");
    const claim = this.claims[this.claimResolvePos];
    const valid = validHostileTargets(this.tribes, tribeId, this.awaiting.effect);
    if (!valid.some((t) => t.id === targetId))
      throw new Error(`${this.tribes[targetId]?.name ?? targetId} is not a valid target`);

    for (const line of applyReward(this.tribes, claim.tribeId, this.awaiting.effect, targetId))
      this.pushLog(line);
    this.claimResolvePos++;
    this.awaiting = null;
    if (!this.stepRewards) this.advanceReward();
    // stepRewards mode: the UI pump calls stepReward() for the next claim.
  }

  finishRewards() {
    this.awaiting = null;
    this.turnTribe = null;
    this.phase = "night";
    this.nightPos = 0;
    this.logEvent("Night");
    this.advanceNight();
  }

  // ---------------- night ----------------

  advanceNight() {
    while (this.nightPos < this.tribes.length) {
      const t = this.tribes[this.nightPos++];
      if (t.eliminated) continue;
      const { fed, starved } = feedTribe(t);
      this.pushLog(
        `${t.name}: feeds ${fed} Population, spends Food ` +
          `(${t.food} Food left after feeding)`
      );
      if (starved > 0) this.pushLog(`${t.name}: ${starved} Population STARVED`);
      if (t.population <= 0) {
        t.eliminated = true;
        t.dice = [];
        this.pushLog(`${t.name} is ELIMINATED (starvation)`);
        continue;
      }
      this.turnTribe = t.id;
      this.awaiting = { type: "growth", tribeId: t.id };
      return;
    }
    this.finishNight();
  }

  // Buy n Population (2 Food each). Unlimited per Night.
  buyGrowth(tribeId, n) {
    if (this.phase !== "night") throw new Error(`Not in night phase (in ${this.phase})`);
    if (!this.awaiting || this.awaiting.type !== "growth" || this.awaiting.tribeId !== tribeId)
      throw new Error("Not this tribe's growth decision");
    const t = this.tribes[tribeId];
    applyGrowth(t, n);
    this.pushLog(
      `${t.name} grows by ${n} Population (now ${t.population}, ${t.food} Food left)`
    );
  }

  finishGrowth(tribeId) {
    if (this.phase !== "night") throw new Error(`Not in night phase (in ${this.phase})`);
    if (!this.awaiting || this.awaiting.type !== "growth" || this.awaiting.tribeId !== tribeId)
      throw new Error("Not this tribe's growth decision");
    this.pushLog(`${this.tribes[tribeId].name} finishes Night`);
    this.turnTribe = null;
    this.awaiting = null;
    this.advanceNight();
  }

  finishNight() {
    const alive = this.aliveTribes();
    if (alive.length === 1) {
      this.winner = alive[0];
      this.phase = "over";
      this.logEvent(`WINNER: ${this.winner.name}`);
      return;
    }
    if (alive.length === 0) {
      // Prototype assumption: if a Night eliminates every remaining tribe
      // (e.g. both starve at once), the game ends in a draw.
      this.winner = null;
      this.phase = "over";
      this.logEvent("All tribes perished - no winner (draw)");
      return;
    }
    this.startEvent();
  }
}
