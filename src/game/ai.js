// AI opponents: transparent, deliberately simple heuristics (Prompt 2).
// No search, no ML. The same decision interface the human UI uses —
// each function inspects the Game state and returns a plain decision
// object; the caller applies it via the Game action API.
//
// Decisions:
//   aiRerollDecision(game, tribe) -> {action:'reroll', diceIds} | {action:'finish'}
//   aiClaimDecision(game, tribe)  -> {action:'claim', slotIndex, diceIds} | {action:'pass'}
//   aiTargetDecision(game, claimerId, effect) -> targetId
//   aiGrowthDecision(game, tribe) -> n (Population to buy this Night)

import { AI_REWARD_WEIGHT } from "./config.js";
import {
  countByValue,
  legalSubsetsForSlot,
  validHostileTargets,
  maxAffordableGrowth,
} from "./rules.js";

function rollValue(values) {
  // crude "pattern strength": highest multiplicity, then straight/full house
  const counts = [...countByValue(values).values()].sort((a, b) => b - a);
  if (counts[0] >= 4) return 4;
  if (counts[0] >= 3 && counts[1] >= 2) return 3.5; // full house
  if (counts[0] >= 3) return 3;
  if (values.length === 5 && new Set(values).size === 5 && Math.max(...values) - Math.min(...values) === 4) return 3.5;
  if (counts[0] >= 2) return 2;
  return 1;
}

// Reroll heuristic:
// - strong roll (4-kind, full house, straight): finish, keep resources.
// - otherwise, while a reroll is affordable (free reroll first, then
//   Tools) and the roll is not strong: keep the best anchor (the most
//   common value, if at least a pair) plus any duplicate of the
//   second-most common value, reroll everything else.
// - the loop naturally stops when the roll is strong, no dice are worth
//   rerolling, or no rerolls (free or paid) remain.
export function aiRerollDecision(game, tribe) {
  const values = tribe.dice.map((d) => d.value);
  if (tribe.freeRerolls < 1 && tribe.tools < 1) return { action: "finish" };
  if (rollValue(values) >= 3) return { action: "finish" };

  const counts = countByValue(values);
  let anchor = null;
  let anchorCount = 1;
  for (const [v, c] of counts.entries()) {
    if (c > anchorCount) {
      anchor = v;
      anchorCount = c;
    }
  }
  const keep = new Set();
  if (anchor !== null) {
    for (const d of tribe.dice) if (d.value === anchor) keep.add(d.id);
    // keep one extra of any other duplicated value (cheap pair building)
    for (const [v, c] of counts.entries()) {
      if (v !== anchor && c >= 2) {
        let seen = 0;
        for (const d of tribe.dice) {
          if (d.value === v && seen < 2) {
            keep.add(d.id);
            seen++;
          }
        }
      }
    }
  }
  const reroll = tribe.dice.filter((d) => !keep.has(d.id)).map((d) => d.id);
  if (reroll.length === 0) return { action: "finish" };
  // if everything is already kept (all dice are the anchor), finishing is fine
  return { action: "reroll", diceIds: reroll };
}

function rewardScore(reward, tribe, game) {
  const w = AI_REWARD_WEIGHT;
  let score = 0;
  if (reward.food) score += reward.food * w.food;
  if (reward.tools) score += reward.tools * w.tool;
  if (reward.population) score += reward.population * w.population;
  if (reward.transform) {
    const t = reward.transform;
    const canPay = (t.spend.food ?? 0) <= tribe.food && (t.spend.tools ?? 0) <= tribe.tools;
    if (canPay) {
      score += (t.gain.food ?? 0) * w.food + (t.gain.tools ?? 0) * w.tool;
      score -= (t.spend.food ?? 0) * w.food + (t.spend.tools ?? 0) * w.tool;
    } else {
      score = -5; // claiming an unaffordable transform only wastes dice
    }
  }
  if (reward.kill || reward.steal) score += w.hostile;
  return score;
}

// Claim heuristic:
// - enumerate every legal (slot, dice subset) for the tribe;
// - score = reward value, with a big Food bonus when the tribe cannot
//   feed itself this Night (avoid starving for a shiny slot);
// - prefer fewer dice consumed on ties;
// - pass when even the best claim is not worth its dice (score <= 0).
export function aiClaimDecision(game, tribe) {
  const options = [];
  for (let slotIndex = 0; slotIndex < game.slots.length; slotIndex++) {
    const slot = game.slots[slotIndex];
    if (slot.claimedBy !== null) continue;
    const subsets = legalSubsetsForSlot(tribe.dice, slot.def);
    for (const subset of subsets) {
      const score =
        rewardScore(slot.def.reward, tribe, game) -
        subset.length * 0.15; // small cost per die spent
      options.push({ slotIndex, diceIds: subset.map((d) => d.id), score, dice: subset.length });
    }
  }
  if (options.length === 0) return { action: "pass" };

  // Food urgency: if Food < Population the tribe will starve tonight;
  // weight Food-heavy claims much higher.
  const starving = tribe.food < tribe.population;
  options.forEach((o) => {
    const r = game.slots[o.slotIndex].def.reward;
    if (starving && r.food) o.score += r.food * 3;
    if (starving && (r.kill || r.steal)) o.score -= 2; // don't risk dice on hostile when desperate
  });

  options.sort((a, b) => b.score - a.score || a.dice - b.dice);
  const best = options[0];
  if (best.score <= 0) return { action: "pass" };
  return { action: "claim", slotIndex: best.slotIndex, diceIds: best.diceIds };
}

// Target heuristics: kill the biggest tribe, steal from the richest in Tools.
export function aiTargetDecision(game, claimerId, effect) {
  const targets = validHostileTargets(game.tribes, claimerId, effect);
  if (targets.length === 0) throw new Error("No valid target for hostile reward");
  if (effect.kill) {
    return targets.sort((a, b) => b.population - a.population || a.id - b.id)[0].id;
  }
  if (effect.steal) {
    return targets.sort((a, b) => b.tools - a.tools || a.id - b.id)[0].id;
  }
  throw new Error("Unknown hostile effect");
}

// Growth heuristic: buy Population while the tribe can still feed
// everyone after the purchase: n <= floor((food - population) / 3).
export function aiGrowthDecision(game, tribe) {
  const max = maxAffordableGrowth(tribe);
  const safe = Math.floor((tribe.food - tribe.population) / 3);
  return Math.max(0, Math.min(max, safe));
}

// Applies one AI decision for the tribe currently awaiting action, through
// the same Game action API the human UI uses. Shared by the browser UI
// (turn pump) and the Node test harness.
export function applyAiDecision(game) {
  const a = game.awaiting;
  if (!a) return false;
  const tribe = game.tribes[a.tribeId];
  switch (a.type) {
    case "reroll": {
      const d = aiRerollDecision(game, tribe);
      if (d.action === "reroll") game.doReroll(tribe.id, d.diceIds);
      else game.finishReroll(tribe.id);
      return true;
    }
    case "claim": {
      const d = aiClaimDecision(game, tribe);
      if (d.action === "claim") game.submitClaim(tribe.id, d.slotIndex, d.diceIds);
      else game.passClaim(tribe.id);
      return true;
    }
    case "target": {
      const targets = validHostileTargets(game.tribes, a.tribeId, a.effect);
      if (targets.length === 0) return false;
      game.resolveWithTarget(a.tribeId, aiTargetDecision(game, a.tribeId, a.effect));
      return true;
    }
    case "growth": {
      const n = aiGrowthDecision(game, tribe);
      if (n > 0) game.buyGrowth(tribe.id, n);
      else game.finishGrowth(tribe.id);
      return true;
    }
    default:
      throw new Error(`Unknown awaiting type: ${a.type}`);
  }
}
