// Prototype Event Card deck (Prompt 3: first playtest tuning pass). Data
// only — no behavior.
//
// Card shape:
//   { id, name, orderRule, art?, slots: [ { id, name, diceRequired, requirement, reward } ] }
//
// art: optional id of a generated banner illustration (see src/ui/artwork.js).
//      Presentation only — cards without it keep the plain layout.
//
// diceRequired: EXACT number of dice the player must submit for this slot.
//               Required on every slot — never inferred from the
//               requirement. A slot may intentionally require more dice
//               than a starting tribe has (visible late-game opportunity).
//
// requirement: array of requirement objects (AND), types from rules.js.
//              Evaluated over exactly diceRequired submitted dice.
//
// reward: exactly one of
//   { food: n } | { tools: n } | { population: n } |
//   { transform: { spend: {food?, tools?}, gain: {food?, tools?} } } |
//   { kill: { population: 1 } } | { steal: { tools: 1 } }
//
// Economy (first conservative tuning pass after playtest 1 — NOT final
// balance):
//   Food:    small (1-2 dice) 2-4, mid (3 dice) 5-8, large (4-5 dice) 8-10
//   Tools:   1 on easy slots up to 3 on hard ones; a Tool is also an extra
//            reroll, so they should be worth considering over Food
//   Population: rare, hard dice requirements (4-dice slots)
//   Transforms: easy dice requirements, big economic effect, but the
//            player must hold the input resources at resolution
//   Hostile:  rare, 3+ dice and hard combinations; some are unreachable
//            for starting Pop-3 tribes by design

export const PROTOTYPE_EVENTS = [
  // ---------------- Mammoth Hunt: food-heavy, stockpile opportunity ----------------
  {
    id: "mammoth-hunt",
    name: "Mammoth Hunt",
    orderRule: "highestTotal",
    art: "mammoth-hunt",
    slots: [
      { id: "mh-1", name: "Snaggletooth", diceRequired: 1, requirement: [{ type: "sumAtMost", value: 4 }], reward: { food: 2 } },
      { id: "mh-2", name: "Herd Tail", diceRequired: 2, requirement: [{ type: "allEven" }], reward: { food: 3 } },
      { id: "mh-3", name: "Mammoth Pair", diceRequired: 2, requirement: [{ type: "pair" }], reward: { food: 4 } },
      { id: "mh-4", name: "Big Kill", diceRequired: 3, requirement: [{ type: "sumAtLeast", value: 12 }], reward: { food: 6 } },
      { id: "mh-5", name: "Herd Stampede", diceRequired: 3, requirement: [{ type: "threeKind" }], reward: { food: 8 } },
      { id: "mh-6", name: "Herd Straight", diceRequired: 5, requirement: [{ type: "straight" }], reward: { food: 9 } },
      { id: "mh-7", name: "Mammoth King", diceRequired: 4, requirement: [{ type: "fourKind" }], reward: { food: 10 } },
    ],
  },

  // ---------------- Rock Quarry: tool-heavy, no Food ----------------
  // Tribes that failed to save Food feel this card.
  {
    id: "rock-quarry",
    name: "Rock Quarry",
    orderRule: "tools",
    slots: [
      { id: "rq-1", name: "Flint Nodules", diceRequired: 2, requirement: [{ type: "allOdd" }], reward: { tools: 1 } },
      { id: "rq-2", name: "Chert Pair", diceRequired: 2, requirement: [{ type: "pair" }], reward: { tools: 1 } },
      { id: "rq-3", name: "Obsidian Haul", diceRequired: 3, requirement: [{ type: "sumAtLeast", value: 10 }], reward: { tools: 2 } },
      { id: "rq-4", name: "Quarried Slab", diceRequired: 4, requirement: [{ type: "threeKind" }], reward: { tools: 3 } },
      { id: "rq-5", name: "Perfect Block", diceRequired: 3, requirement: [{ type: "exactSum", value: 15 }], reward: { tools: 3 } },
    ],
  },

  // ---------------- Trading Post: mixed Food / Tools / rare Population ----------------
  {
    id: "trading-post",
    name: "Trading Post",
    orderRule: "population",
    slots: [
      { id: "tp-1", name: "Shell Beads", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 7 }], reward: { food: 3 } },
      { id: "tp-2", name: "Copper Scrap", diceRequired: 1, requirement: [{ type: "mustContain", value: 6, count: 1 }], reward: { tools: 1 } },
      { id: "tp-3", name: "Barter Pair", diceRequired: 2, requirement: [{ type: "pair" }], reward: { food: 4 } },
      { id: "tp-4", name: "Middleman", diceRequired: 3, requirement: [{ type: "middleIs", count: 3, value: 5 }], reward: { tools: 2 } },
      { id: "tp-5", name: "Fancy Goods", diceRequired: 3, requirement: [{ type: "allEven" }, { type: "sumAtLeast", value: 10 }], reward: { food: 3, tools: 1 } },
      { id: "tp-6", name: "Whale Tooth", diceRequired: 4, requirement: [{ type: "fourKind" }], reward: { population: 1 } },
    ],
  },

  // ---------------- Shaman's Rite: rare resource transforms ----------------
  // Transform dice requirements stay easy; the cost is holding the input
  // resources until the reward resolves.
  {
    id: "shaman-rite",
    name: "Shaman's Rite",
    orderRule: "highestDie",
    slots: [
      { id: "sr-1", name: "Smoke Signal", diceRequired: 1, requirement: [{ type: "sumAtMost", value: 5 }], reward: { food: 2 } },
      { id: "sr-2", name: "Bone Carving", diceRequired: 2, requirement: [{ type: "mustContain", value: 1, count: 2 }], reward: { tools: 1 } },
      {
        id: "sr-3",
        name: "Tool to Food Rite",
        diceRequired: 2,
        requirement: [{ type: "pair" }], // easy match, big economic effect
        reward: { transform: { spend: { tools: 2 }, gain: { food: 6 } } },
      },
      {
        id: "sr-4",
        name: "Food to Tool Rite",
        diceRequired: 3,
        requirement: [{ type: "threeKind" }],
        reward: { transform: { spend: { food: 4 }, gain: { tools: 2 } } },
      },
      { id: "sr-5", name: "Ancestor's Favor", diceRequired: 4, requirement: [{ type: "fourKind" }], reward: { population: 1 } },
    ],
  },

  // ---------------- Ambush: difficult hostile opportunities ----------------
  // Bludgeon needs 5 dice: intentionally unclaimable by starting Pop-3
  // tribes — a late-game opportunity visible from the first Event.
  {
    id: "ambush",
    name: "Ambush",
    orderRule: "lowestDie",
    slots: [
      { id: "am-1", name: "Scavenger", diceRequired: 1, requirement: [{ type: "sumAtMost", value: 4 }], reward: { food: 2 } },
      { id: "am-2", name: "Trap Lines", diceRequired: 2, requirement: [{ type: "pair" }], reward: { food: 3 } },
      { id: "am-3", name: "Tribal Feast", diceRequired: 4, requirement: [{ type: "sumAtLeast", value: 16 }], reward: { food: 6 } },
      {
        id: "am-4",
        name: "Sneak Attack",
        diceRequired: 3,
        requirement: [{ type: "threeKind" }],
        reward: { steal: { tools: 1 } },
      },
      {
        id: "am-5",
        name: "Bludgeon",
        diceRequired: 5,
        requirement: [{ type: "fullHouse" }],
        reward: { kill: { population: 1 } },
      },
      { id: "am-6", name: "Blood Moon", diceRequired: 4, requirement: [{ type: "fourKind" }], reward: { food: 7 } },
    ],
  },
];
