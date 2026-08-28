// Centralized tunable values. Rebalance here, not in game code.

// Starting tribe values (Prompt 2 prototype values).
export const START = Object.freeze({
  population: 3,
  food: 4,
  tools: 1,
});

// Free rerolls every tribe receives at the start of each Event.
// Prototype balance value (Prompt 3, first playtest) — may change after
// further playtesting. Once these are exhausted, each reroll costs 1 Tool.
export const FREE_REROLLS_PER_EVENT = 2;

// Night growth: 2 Food -> +1 Population. No per-Night limit.
export const GROWTH_FOOD_COST = 2;

// Feeding: 1 Food per Population.
export const FEED_COST_PER_POP = 1;

// Tribe display metadata, by seat index. Seat 0 is always the human.
export const TRIBE_META = [
  { name: "You", color: 0x00e436 },
  { name: "AI 1", color: 0xe6553c },
  { name: "AI 2", color: 0x4d9de0 },
  { name: "AI 3", color: 0xf5d547 },
];

// AI turn delay (ms) so the human can follow visible AI actions.
export const AI_TURN_DELAY_MS = 600;

// Prototype assumption: AI reward scoring weights (common unit for comparing
// Food / Tools / Population / hostile effects). Not a balance rule.
export const AI_REWARD_WEIGHT = Object.freeze({
  food: 1,
  tool: 2,
  population: 1.5,
  hostile: 2,
});
