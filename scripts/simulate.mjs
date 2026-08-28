// Scripted full-game simulation (validation aid, not part of the build).
//
// Plays a complete game with AI on every seat, prints the full event/night
// trace, and verifies: multiple Event/Night cycles, at least one
// elimination, and a victory.
//
//   node scripts/simulate.mjs [aiCount] [seed]
//
// Without a seed, it searches seeds 1..100 for a game that has a winner,
// an elimination, and >= 3 events, and prints that one.

import { Game } from "../src/game/game.js";
import { makeRng, runFullAiGame, runAiTurn } from "../tests/helpers.js";

const aiCount = Math.min(3, Math.max(1, Number(process.argv[2] ?? 2) || 2));
const forcedSeed = process.argv[3] ? Number(process.argv[3]) : null;

function play(seed) {
  const game = new Game({ aiCount, rng: makeRng(seed) });
  let steps = 0;
  while (game.phase !== "over") {
    if (!game.awaiting) throw new Error("game stuck");
    if (!runAiTurn(game)) throw new Error("no decision available");
    if (++steps > 50000) throw new Error("game did not terminate");
  }
  return game;
}

function qualifies(g) {
  return (
    g.phase === "over" &&
    g.winner !== null &&
    g.eventIndex >= 3 &&
    g.tribes.some((t) => t.eliminated)
  );
}

let game = null;
let chosenSeed = forcedSeed;
if (forcedSeed !== null) {
  game = play(forcedSeed);
} else {
  for (let seed = 1; seed <= 100 && !game; seed++) {
    const g = play(seed);
    if (qualifies(g)) {
      game = g;
      chosenSeed = seed;
    }
  }
  if (!game) {
    console.error("no qualifying game found in seeds 1..100");
    process.exit(1);
  }
}
console.log(`seed=${chosenSeed} aiCount=${aiCount}`);

console.log("");
console.log(game.log.join("\n"));
console.log("");

// verification summary
const events = game.eventIndex;
const eliminations = game.tribes.filter((t) => t.eliminated).length;
const cycles = events; // each event ends with a night
const ok =
  game.phase === "over" &&
  game.winner !== null &&
  game.aliveTribes().length === 1 &&
  events >= 3 &&
  eliminations >= 1;

console.log("---- verification ----");
console.log(`events/night cycles : ${cycles} (>= 3: ${events >= 3})`);
console.log(`eliminations        : ${eliminations} (>= 1: ${eliminations >= 1})`);
console.log(`winner              : ${game.winner ? game.winner.name : "none"} (exactly one survivor: ${game.aliveTribes().length === 1})`);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
