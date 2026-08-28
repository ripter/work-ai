// Prototype Event Card deck (Prompt 2). Data only — no behavior.
//
// Card shape:
//   { id, name, orderRule, slots: [ { id, name, requirement: [req, ...], reward } ] }
//
// requirement: array of requirement objects (AND), types from rules.js.
// reward: exactly one of
//   { food: n } | { tools: n } | { population: n } |
//   { transform: { spend: {food?, tools?}, gain: {food?, tools?} } } |
//   { kill: { population: 1 } } | { steal: { tools: 1 } }
//
// Balancing is intentionally rough (playtest-tune later). General shape:
// easier match -> smaller reward; harder match / more dice -> bigger reward.

export const PROTOTYPE_EVENTS = [
  // ---------------- Mammoth Hunt: food-heavy ----------------
  {
    id: "mammoth-hunt",
    name: "Mammoth Hunt",
    orderRule: "highestTotal",
    slots: [
      { id: "mh-1", name: "Snaggletooth", requirement: [{ type: "sumAtMost", value: 7 }], reward: { food: 1 } },
      { id: "mh-2", name: "Herd Tail", requirement: [{ type: "allEven" }], reward: { food: 2 } },
      { id: "mh-3", name: "Mammoth Pair", requirement: [{ type: "pair" }], reward: { food: 2 } },
      { id: "mh-4", name: "Big Kill", requirement: [{ type: "sumAtLeast", value: 12 }], reward: { food: 3 } },
      { id: "mh-5", name: "Herd Stampede", requirement: [{ type: "threeKind" }], reward: { food: 4 } },
      { id: "mh-6", name: "Herd Straight", requirement: [{ type: "straight" }], reward: { food: 5 } },
      { id: "mh-7", name: "Mammoth King", requirement: [{ type: "fourKind" }], reward: { food: 6 } },
    ],
  },

  // ---------------- Rock Quarry: tool-heavy, little/no Food ----------------
  {
    id: "rock-quarry",
    name: "Rock Quarry",
    orderRule: "tools",
    slots: [
      { id: "rq-1", name: "Flint Nodules", requirement: [{ type: "allOdd" }], reward: { tools: 1 } },
      { id: "rq-2", name: "Chert Pair", requirement: [{ type: "pair" }], reward: { tools: 1 } },
      { id: "rq-3", name: "Obsidian Haul", requirement: [{ type: "sumAtLeast", value: 10 }], reward: { tools: 1 } },
      { id: "rq-4", name: "Quarried Slab", requirement: [{ type: "threeKind" }], reward: { tools: 2 } },
      { id: "rq-5", name: "Perfect Block", requirement: [{ type: "exactSum", value: 18 }], reward: { tools: 2 } },
    ],
  },

  // ---------------- Trading Post: mixed Food + Tools ----------------
  {
    id: "trading-post",
    name: "Trading Post",
    orderRule: "population",
    slots: [
      { id: "tp-1", name: "Shell Beads", requirement: [{ type: "sumAtMost", value: 9 }], reward: { food: 2 } },
      { id: "tp-2", name: "Copper Scrap", requirement: [{ type: "mustContain", value: 6, count: 1 }], reward: { tools: 1 } },
      { id: "tp-3", name: "Barter Pair", requirement: [{ type: "pair" }], reward: { food: 3 } },
      { id: "tp-4", name: "Middleman", requirement: [{ type: "middleIs", count: 3, value: 5 }], reward: { tools: 2 } },
      { id: "tp-5", name: "Fancy Goods", requirement: [{ type: "allEven" }, { type: "sumAtLeast", value: 10 }], reward: { food: 3, tools: 1 } },
      { id: "tp-6", name: "Whale Tooth", requirement: [{ type: "exactValues", values: [6, 6] }], reward: { population: 1 } },
    ],
  },

  // ---------------- Shaman's Rite: rare resource transforms ----------------
  {
    id: "shaman-rite",
    name: "Shaman's Rite",
    orderRule: "highestDie",
    slots: [
      { id: "sr-1", name: "Smoke Signal", requirement: [{ type: "sumAtMost", value: 8 }], reward: { food: 2 } },
      { id: "sr-2", name: "Bone Carving", requirement: [{ type: "mustContain", value: 1, count: 2 }], reward: { tools: 1 } },
      {
        id: "sr-3",
        name: "Tool to Food Rite",
        requirement: [{ type: "pair" }], // easy match, big economic effect
        reward: { transform: { spend: { tools: 2 }, gain: { food: 6 } } },
      },
      {
        id: "sr-4",
        name: "Food to Tool Rite",
        requirement: [{ type: "threeKind" }],
        reward: { transform: { spend: { food: 4 }, gain: { tools: 2 } } },
      },
      { id: "sr-5", name: "Ancestor's Favor", requirement: [{ type: "fourKind" }], reward: { population: 1 } },
    ],
  },

  // ---------------- Ambush: difficult hostile slots ----------------
  {
    id: "ambush",
    name: "Ambush",
    orderRule: "lowestDie",
    slots: [
      { id: "am-1", name: "Scavenger", requirement: [{ type: "sumAtMost", value: 7 }], reward: { food: 1 } },
      { id: "am-2", name: "Trap Lines", requirement: [{ type: "pair" }], reward: { food: 3 } },
      { id: "am-3", name: "Tribal Feast", requirement: [{ type: "sumAtLeast", value: 14 }], reward: { food: 4 } },
      {
        id: "am-4",
        name: "Sneak Attack",
        requirement: [{ type: "threeKind" }],
        reward: { steal: { tools: 1 } },
      },
      {
        id: "am-5",
        name: "Bludgeon",
        requirement: [{ type: "fullHouse" }],
        reward: { kill: { population: 1 } },
      },
      { id: "am-6", name: "Blood Moon", requirement: [{ type: "fourKind" }], reward: { food: 5 } },
    ],
  },
];
