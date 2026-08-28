// Shared test helpers: deterministic RNG, scripted rolls, AI pump.

import { Game } from "../src/game/game.js";
import { applyAiDecision } from "../src/game/ai.js";

// Small deterministic LCG. Same seed -> same sequence.
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A Game whose initial rolls are taken from a script:
//   rolls: [ [values for first roll call], [next], ... ]
// rollFn is called in seat order for each surviving tribe at each Event,
// so script entries must match that order and each tribe's population.
export function scriptedGame({ aiCount = 1, deck, seed = 1, rolls = [] } = {}) {
  const queue = rolls.map((r) => [...r]);
  const game = new Game({
    aiCount,
    deck,
    rng: makeRng(seed),
    rollFn: (count) => {
      if (queue.length === 0) throw new Error("roll script exhausted");
      const next = queue.shift();
      if (next.length !== count)
        throw new Error(`roll script length ${next.length} != expected ${count}`);
      return next;
    },
  });
  return game;
}

// Applies one AI decision for the tribe currently awaiting action.
// Returns true if a decision was applied.
export function runAiTurn(game) {
  return applyAiDecision(game);
}

// Plays a complete game with AI controllers on every seat.
// Returns the finished game. Throws if the game fails to terminate.
export function runFullAiGame({ aiCount = 1, deck, seed = 1, maxSteps = 20000 } = {}) {
  const game = new Game({ aiCount, deck, rng: makeRng(seed) });
  let steps = 0;
  while (game.phase !== "over") {
    if (!game.awaiting)
      throw new Error(`Game stuck: phase=${game.phase}, awaiting=null`);
    if (!runAiTurn(game))
      throw new Error(`Game stuck: no decision for awaiting ${JSON.stringify(game.awaiting)}`);
    if (++steps > maxSteps) throw new Error("Game did not terminate in time");
  }
  return game;
}

// The human seat (0) acts with a supplied callback; all other seats are AI.
// callback(game) is invoked whenever seat 0 must act; it must call Game
// action methods itself.
export function runHumanDrivenGame(
  { aiCount = 1, deck, seed = 1, maxSteps = 20000 } = {},
  humanAct
) {
  const game = new Game({ aiCount, deck, rng: makeRng(seed) });
  let steps = 0;
  while (game.phase !== "over") {
    const a = game.awaiting;
    if (!a) throw new Error(`Game stuck: phase=${game.phase}, awaiting=null`);
    if (a.tribeId === 0) {
      humanAct(game);
    } else {
      if (!runAiTurn(game)) throw new Error(`AI stuck on ${JSON.stringify(a)}`);
    }
    if (++steps > maxSteps) throw new Error("Game did not terminate in time");
  }
  return game;
}
