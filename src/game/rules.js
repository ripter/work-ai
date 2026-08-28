// Pure game rules: dice helpers, slot requirement registry, legal-claim
// search, claim-order calculation, Night math, reward application.
//
// No Pixi, no timers, no module state. Everything operates on plain
// objects passed in, so this module is directly testable in Node.

import { GROWTH_FOOD_COST, FEED_COST_PER_POP } from "./config.js";

// ---------------- dice helpers ----------------

export function sum(values) {
  return values.reduce((a, v) => a + v, 0);
}

export function sortedAsc(values) {
  return [...values].sort((a, b) => a - b);
}

export function countByValue(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

export function maxCount(values) {
  let best = 0;
  for (const c of countByValue(values).values()) best = Math.max(best, c);
  return best;
}

// ---------------- requirement registry ----------------
//
// A slot requirement is an ARRAY of requirement objects that must ALL
// pass (AND). Each requirement object is { type, ...params } and is
// evaluated against the SELECTED dice subset only (never the whole pool).
//
// To add a new requirement type: add one entry to REQUIREMENTS with
// check(values, req) and describe(req). No other code changes needed.

const REQUIREMENTS = {
  pair: {
    check: (v) => maxCount(v) >= 2,
    describe: () => "Pair (2 matching dice)",
  },
  threeKind: {
    check: (v) => maxCount(v) >= 3,
    describe: () => "Three of a kind",
  },
  fourKind: {
    check: (v) => maxCount(v) >= 4,
    describe: () => "Four of a kind",
  },
  fullHouse: {
    check: (v) => {
      const entries = [...countByValue(v).entries()]; // [value, count]
      return entries.some(
        ([a, ca]) =>
          ca >= 3 && entries.some(([b, cb]) => b !== a && cb >= 2)
      );
    },
    describe: () => "Full house (3+2)",
  },
  // Prototype definition: exactly 5 dice, all distinct, consecutive
  // (1-2-3-4-5 or 2-3-4-5-6).
  straight: {
    check: (v) =>
      v.length === 5 &&
      new Set(v).size === 5 &&
      Math.max(...v) - Math.min(...v) === 4,
    describe: () => "Straight (5 in a row)",
  },
  exactSum: {
    check: (v, r) => sum(v) === r.value,
    describe: (r) => `Exact sum ${r.value}`,
  },
  sumAtLeast: {
    check: (v, r) => sum(v) >= r.value,
    describe: (r) => `Sum >= ${r.value}`,
  },
  sumAtMost: {
    check: (v, r) => sum(v) <= r.value,
    describe: (r) => `Sum <= ${r.value}`,
  },
  allOdd: {
    check: (v) => v.every((x) => x % 2 === 1),
    describe: () => "All odd dice",
  },
  allEven: {
    check: (v) => v.every((x) => x % 2 === 0),
    describe: () => "All even dice",
  },
  // Multiset equality: selected dice must be exactly these values.
  exactValues: {
    check: (v, r) => {
      if (v.length !== r.values.length) return false;
      const a = sortedAsc(v);
      const b = sortedAsc(r.values);
      return a.every((x, i) => x === b[i]);
    },
    describe: (r) => `Exactly [${r.values.join(", ")}]`,
  },
  // At least `count` dice equal to `value` (default 1).
  mustContain: {
    check: (v, r) => (countByValue(v).get(r.value) ?? 0) >= (r.count ?? 1),
    describe: (r) =>
      `Include ${r.count ?? 1} x ${r.value}`,
  },
  // Unusual pattern: exactly `count` dice submitted; after sorting, the
  // middle die (index count/2) must equal `value`; others may be anything.
  // (count should match the slot's diceRequired.)
  middleIs: {
    check: (v, r) =>
      v.length === r.count && sortedAsc(v)[Math.floor(r.count / 2)] === r.value,
    describe: (r) => `Middle die must be ${r.value}`,
  },
};

export function checkRequirement(values, req) {
  const entry = REQUIREMENTS[req.type];
  if (!entry) throw new Error(`Unknown requirement type: ${req.type}`);
  return entry.check(values, req);
}

// Every slot explicitly declares `diceRequired`: the EXACT number of dice
// that must be submitted. Both checks must pass:
//   1. values.length === slotDef.diceRequired
//   2. all requirements hold over exactly those dice
// A requirement can therefore never be satisfied with fewer (or more) dice
// than the slot specifies — e.g. a single odd die cannot claim a 3-die
// all-odd slot.
export function slotDiceRequired(slotDef) {
  const n = slotDef.diceRequired;
  if (!Number.isInteger(n) || n < 1)
    throw new Error(
      `Slot "${slotDef.id ?? "?"}" must declare an integer diceRequired >= 1 (got ${n})`
    );
  return n;
}

export function checkSlot(values, slotDef) {
  if (values.length !== slotDiceRequired(slotDef)) return false;
  return slotDef.requirement.every((r) => checkRequirement(values, r));
}

export function describeSlot(slotDef) {
  return (
    `[${slotDiceRequired(slotDef)} dice] ` +
    slotDef.requirement.map((r) => REQUIREMENTS[r.type].describe(r)).join(" AND ")
  );
}

export function describeReward(reward) {
  const parts = [];
  if (reward.food) parts.push(`+${reward.food} Food`);
  if (reward.tools) parts.push(`+${reward.tools} Tool${reward.tools > 1 ? "s" : ""}`);
  if (reward.population) parts.push(`+${reward.population} Population`);
  if (reward.transform) {
    const t = reward.transform;
    const spend = [
      t.spend.food ? `${t.spend.food} Food` : null,
      t.spend.tools ? `${t.spend.tools} Tool${t.spend.tools > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" + ");
    const gain = [
      t.gain.food ? `${t.gain.food} Food` : null,
      t.gain.tools ? `${t.gain.tools} Tool${t.gain.tools > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" + ");
    parts.push(`Transform: spend ${spend} -> gain ${gain}`);
  }
  if (reward.kill) parts.push(`Kill ${reward.kill.population} Population from another tribe`);
  if (reward.steal) parts.push(`Steal ${reward.steal.tools} Tool from another tribe`);
  return parts.join(" / ");
}

// ---------------- legal-claim subset search ----------------
//
// DFS over non-empty subsets of a pool. `cap` bounds subset size.
// Prototype assumption: when a pool has more than 16 dice, subsets are
// capped at 6 dice (no prototype requirement needs more than 5, and sum
// requirements are satisfiable with <= 6).
export const LARGE_POOL_THRESHOLD = 16;
export const LARGE_POOL_SUBSET_CAP = 6;

// values: number[]; check: (values) => bool. Returns arrays of indices.
// `cap` bounds subset size. `exactSize`, when set, restricts the search to
// subsets of EXACTLY that size and prunes the search at that depth (used to
// enforce a slot's diceRequired). `first=true` short-circuits after the
// first match; `first=false` collects every match.
export function findLegalSubsets(
  values,
  check,
  cap = Infinity,
  first = false,
  exactSize = null
) {
  const n = values.length;
  const found = [];
  const idx = [];
  const vals = [];
  const dfs = (i) => {
    if (i >= n || (first && found.length > 0)) return;
    // branch 1: include i
    idx.push(i);
    vals.push(values[i]);
    if (exactSize === null) {
      if (check(vals)) found.push(idx.slice());
      if (idx.length < cap) dfs(i + 1);
    } else {
      if (vals.length === exactSize && check(vals)) found.push(idx.slice());
      if (idx.length < exactSize) dfs(i + 1);
    }
    idx.pop();
    vals.pop();
    // branch 2: exclude i
    dfs(i + 1);
  };
  dfs(0);
  return first ? found.slice(0, 1) : found;
}

export function subsetCapForPool(poolSize) {
  return poolSize > LARGE_POOL_THRESHOLD ? LARGE_POOL_SUBSET_CAP : poolSize;
}

// pool: [{id, value}], slotDef: {diceRequired, requirement: [...]}.
// Returns arrays of die objects (from the pool) that satisfy the slot —
// i.e. exactly slotDef.diceRequired dice meeting the requirement. A slot
// requiring more dice than the pool holds has no legal subset (it is
// currently impossible for this tribe).
export function legalSubsetsForSlot(pool, slotDef, { first = false } = {}) {
  const need = slotDiceRequired(slotDef);
  if (need > pool.length) return [];
  const check = (vals) => checkSlot(vals, slotDef);
  const subsets = findLegalSubsets(
    pool.map((d) => d.value),
    check,
    subsetCapForPool(pool.length),
    first,
    need
  );
  return subsets.map((ixs) => ixs.map((i) => pool[i]));
}

export function hasLegalClaim(pool, slotDef) {
  return legalSubsetsForSlot(pool, slotDef, { first: true }).length > 0;
}

// ---------------- claim order ----------------
//
// The order rule is applied to the tribe's FINAL dice (after all rerolls)
// and remaining Tools (after reroll spending), when the claiming phase
// begins. The result is fixed for the whole Event.
//
// Tie-breaker (centralized here): lower seat index goes first.
// Deterministic, documented in GAME_SPEC.md.

export const ORDER_RULES = {
  population: {
    label: "largest Population",
    key: (t) => t.population,
    dir: -1,
  },
  tools: {
    label: "most Tools",
    key: (t) => t.tools,
    dir: -1,
  },
  highestDie: {
    label: "highest individual die",
    key: (t) => Math.max(...t.dice.map((d) => d.value)),
    dir: -1,
  },
  lowestDie: {
    label: "lowest individual die",
    key: (t) => Math.min(...t.dice.map((d) => d.value)),
    dir: 1,
  },
  highestTotal: {
    label: "highest total roll",
    key: (t) => t.dice.reduce((a, d) => a + d.value, 0),
    dir: -1,
  },
};

export function computeClaimOrder(card, tribes) {
  const rule = ORDER_RULES[card.orderRule];
  if (!rule) throw new Error(`Unknown claim order rule: ${card.orderRule}`);
  const alive = tribes.filter((t) => !t.eliminated);
  const list = alive.map((t) => ({ id: t.id, k: rule.key(t) }));
  const cmp = rule.dir === 1 ? (a, b) => a.k - b.k : (a, b) => b.k - a.k;
  list.sort((a, b) => cmp(a, b) || a.id - b.id);
  return list.map((x) => x.id);
}

// ---------------- Night math ----------------

// Feeds a tribe in place. Returns { fed, starved }.
// Pop 5, Food 3 -> fed 3, starved 2, tribe ends Pop 3 / Food 0.
export function feedTribe(tribe) {
  const need = tribe.population * FEED_COST_PER_POP;
  if (tribe.food >= need) {
    tribe.food -= need;
    return { fed: tribe.population, starved: 0 };
  }
  const survivors = Math.floor(tribe.food / FEED_COST_PER_POP);
  const starved = tribe.population - survivors;
  tribe.population = survivors;
  tribe.food = 0;
  return { fed: survivors, starved };
}

// Buys growth in place. Validates: integer n >= 0 and affordable.
export function applyGrowth(tribe, n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid growth amount: ${n}`);
  const cost = n * GROWTH_FOOD_COST;
  if (cost > tribe.food) throw new Error(`Cannot afford growth: needs ${cost} Food, has ${tribe.food}`);
  tribe.food -= cost;
  tribe.population += n;
}

export function maxAffordableGrowth(tribe) {
  return Math.floor(tribe.food / GROWTH_FOOD_COST);
}

// ---------------- reward application ----------------
//
// A reward object has exactly one of these shapes (prototype cards never
// mix kinds on one slot):
//   { food, tools, population }   simple resource gains (any subset)
//   { transform: { spend: {food?, tools?}, gain: {food?, tools?} } }
//   { kill: { population: 1 } }   hostile, needs targetId
//   { steal: { tools: 1 } }       hostile, needs targetId

export function isHostileReward(reward) {
  return Boolean(reward.kill || reward.steal);
}

export function validHostileTargets(tribes, claimerId, reward) {
  return tribes.filter((t) => {
    if (t.id === claimerId || t.eliminated) return false;
    if (reward.steal && t.tools < reward.steal.tools) return false;
    if (reward.kill && t.population < reward.kill.population) return false;
    return true;
  });
}

// Applies a claim's reward to the game. `targetId` required for hostile
// rewards. Mutates tribes; returns an array of log strings.
export function applyReward(tribes, claimerId, reward, targetId = null) {
  const t = tribes[claimerId];
  const out = [];
  const gained = [];
  if (reward.food) { t.food += reward.food; gained.push(`+${reward.food} Food`); }
  if (reward.tools) { t.tools += reward.tools; gained.push(`+${reward.tools} Tool${reward.tools > 1 ? "s" : ""}`); }
  if (reward.population) {
    t.population += reward.population;
    gained.push(`+${reward.population} Population`);
  }
  if (reward.transform) {
    const { spend, gain } = reward.transform;
    const canPay =
      (spend.food ?? 0) <= t.food && (spend.tools ?? 0) <= t.tools;
    if (canPay) {
      t.food -= spend.food ?? 0;
      t.tools -= spend.tools ?? 0;
      t.food += gain.food ?? 0;
      t.tools += gain.tools ?? 0;
      out.push(`${t.name}: transform succeeded (${describeReward(reward)})`);
    } else {
      out.push(
        `${t.name}: transform FAILED (needs ${describeReward(reward)}), spent dice are lost`
      );
    }
    return out; // transform is the whole reward
  }
  if (reward.kill) {
    const target = tribes[targetId];
    if (!target) throw new Error("kill reward missing targetId");
    target.population -= reward.kill.population;
    if (target.population <= 0) {
      target.population = 0;
      target.eliminated = true;
      out.push(`${t.name} kills ${target.name} -> ELIMINATED`);
    } else {
      out.push(`${t.name} kills ${reward.kill.population} Population from ${target.name} (now ${target.population})`);
    }
    return out;
  }
  if (reward.steal) {
    const target = tribes[targetId];
    if (!target) throw new Error("steal reward missing targetId");
    target.tools -= reward.steal.tools;
    t.tools += reward.steal.tools;
    out.push(`${t.name} steals ${reward.steal.tools} Tool from ${target.name} (${target.tools} left)`);
    return out;
  }
  if (gained.length) out.push(`${t.name} gains ${gained.join(", ")}`);
  return out;
}
