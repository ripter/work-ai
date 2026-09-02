// Event Card deck (Prompt 3: first playtest tuning pass; Prompt 5:
// expanded from 5 to 12 cards). Data only — no behavior.
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

  // ---------------- River Fishery (Prompt 5): accessible small Food ----------------
  // Identity: "we can finally get Food." Low-total challenges; the lowestDie
  // order rule means a tribe that rolled LOW has the edge on this card.
  // Rewards stay small — this is the safe stockpile card, not the big hunt.
  {
    id: "river-fishery",
    name: "River Fishery",
    orderRule: "lowestDie",
    art: "river-fishery",
    slots: [
      { id: "rf-1", name: "Shallow Splash", diceRequired: 1, requirement: [{ type: "sumAtMost", value: 3 }], reward: { food: 2 } },
      { id: "rf-2", name: "Casting Nets", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 6 }], reward: { food: 3 } },
      { id: "rf-3", name: "Fish Pair", diceRequired: 2, requirement: [{ type: "pair" }], reward: { food: 3 } },
      { id: "rf-4", name: "School of Fish", diceRequired: 3, requirement: [{ type: "allEven" }], reward: { food: 4 } },
      { id: "rf-5", name: "Silent Run", diceRequired: 3, requirement: [{ type: "allOdd" }, { type: "sumAtMost", value: 10 }], reward: { food: 5 } },
      { id: "rf-6", name: "River Serpent", diceRequired: 4, requirement: [{ type: "threeKind" }], reward: { food: 6 } },
    ],
  },

  // ---------------- Drought (Prompt 5): scarcity ----------------
  // Identity: "there's almost no Food here." The smallest rewards in the
  // deck; preparation and saved resources matter. Still has real decisions
  // (which scarce slot to fight over; Tools pay future rerolls).
  // population order: the biggest tribe needs (and claims) food first.
  {
    id: "drought",
    name: "Drought",
    orderRule: "population",
    art: "drought",
    slots: [
      { id: "dr-1", name: "Dry Riverbed", diceRequired: 1, requirement: [{ type: "sumAtMost", value: 4 }], reward: { food: 1 } },
      { id: "dr-2", name: "Scorched Roots", diceRequired: 2, requirement: [{ type: "allOdd" }], reward: { food: 2 } },
      { id: "dr-3", name: "Last Water Hole", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 7 }], reward: { food: 2 } },
      { id: "dr-4", name: "Hard Knocks", diceRequired: 2, requirement: [{ type: "pair" }], reward: { tools: 1 } },
      { id: "dr-5", name: "Bone to Pick", diceRequired: 3, requirement: [{ type: "exactSum", value: 9 }], reward: { food: 1, tools: 1 } },
    ],
  },

  // ---------------- Great Migration (Prompt 5): growth opportunities ----------------
  // Identity: rare direct Population rewards. population order: the biggest
  // tribe claims first — grown tribes get first crack at the growth slots.
  // Both Pop slots are hard (4-die three-kind / 5-die straight).
  {
    id: "great-migration",
    name: "Great Migration",
    orderRule: "population",
    art: "great-migration",
    slots: [
      { id: "gm-1", name: "Following the Herd", diceRequired: 2, requirement: [{ type: "sumAtLeast", value: 7 }], reward: { food: 3 } },
      { id: "gm-2", name: "New Land", diceRequired: 2, requirement: [{ type: "pair" }], reward: { tools: 1 } },
      { id: "gm-3", name: "Caravan Goods", diceRequired: 3, requirement: [{ type: "allEven" }], reward: { food: 3, tools: 1 } },
      { id: "gm-4", name: "Strong Backs", diceRequired: 3, requirement: [{ type: "threeKind" }], reward: { food: 5 } },
      { id: "gm-5", name: "New Camp", diceRequired: 4, requirement: [{ type: "threeKind" }], reward: { population: 1 } },
      { id: "gm-6", name: "Ancient Path", diceRequired: 5, requirement: [{ type: "straight" }], reward: { population: 1 } },
    ],
  },

  // ---------------- Spirit Cave (Prompt 5): unusual requirements ----------------
  // Identity: "my dice are perfect for this weird requirement." Debut card
  // for the Prompt 5 requirement types (exactlyKind, countBelow,
  // oddEvenSplit, range). Mixed mid-tier Food/Tools, no Pop, no hostile.
  {
    id: "spirit-cave",
    name: "Spirit Cave",
    orderRule: "highestDie",
    art: "spirit-cave",
    slots: [
      { id: "sc-1", name: "Whispering Stone", diceRequired: 1, requirement: [{ type: "mustContain", value: 1, count: 1 }], reward: { food: 2 } },
      { id: "sc-2", name: "Twin Omens", diceRequired: 3, requirement: [{ type: "exactlyKind", count: 2 }], reward: { food: 4 } },
      { id: "sc-3", name: "Deep Cave", diceRequired: 3, requirement: [{ type: "countBelow", value: 3, count: 2 }], reward: { tools: 1 } },
      { id: "sc-4", name: "Echo Pattern", diceRequired: 4, requirement: [{ type: "oddEvenSplit", odd: 2, even: 2 }], reward: { food: 4 } },
      { id: "sc-5", name: "Ritual Circle", diceRequired: 4, requirement: [{ type: "range", min: 3, max: 5 }], reward: { tools: 2 } },
      { id: "sc-6", name: "Cave Heart", diceRequired: 4, requirement: [{ type: "middleIs", count: 4, value: 4 }], reward: { tools: 2 } },
    ],
  },

  // ---------------- Flint Road (Prompt 5): Tools + Food->Tools transform ----------------
  // Identity: strong Tool opportunities plus one easy-dice transform that
  // turns a saved Food stockpile into Tools (the transform can still fail
  // at resolution if the Food is gone). tools order: Tool-rich tribes
  // claim first.
  {
    id: "flint-road",
    name: "Flint Road",
    orderRule: "tools",
    art: "flint-road",
    slots: [
      { id: "fr-1", name: "Polished Points", diceRequired: 2, requirement: [{ type: "allEven" }], reward: { tools: 1 } },
      { id: "fr-2", name: "Caravan Tribute", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 8 }], reward: { food: 2 } },
      { id: "fr-3", name: "Obsidian Trade", diceRequired: 3, requirement: [{ type: "pair" }], reward: { tools: 2 } },
      {
        id: "fr-4",
        name: "Work the Bone",
        diceRequired: 3,
        requirement: [{ type: "allEven" }], // easy match; the cost is holding 3 Food
        reward: { transform: { spend: { food: 3 }, gain: { tools: 2 } } },
      },
      { id: "fr-5", name: "Master Smith", diceRequired: 4, requirement: [{ type: "fourKind" }], reward: { tools: 3 } },
    ],
  },

  // ---------------- Raiding Party (Prompt 5): competitive, one hard steal ----------------
  // Identity: "someone could actually hit that attack slot." No kill (that
  // stays unique to Ambush); the steal is a 4-die four-kind — unreachable
  // for starting Pop-3 tribes and hard to roll even when grown.
  // highestTotal order: the loudest roll claims first.
  {
    id: "raiding-party",
    name: "Raiding Party",
    orderRule: "highestTotal",
    art: "raiding-party",
    slots: [
      { id: "rp-1", name: "Scouting Party", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 7 }], reward: { food: 3 } },
      { id: "rp-2", name: "War Paint", diceRequired: 3, requirement: [{ type: "countAbove", value: 3, count: 2 }], reward: { tools: 1 } },
      { id: "rp-3", name: "Ambush Line", diceRequired: 3, requirement: [{ type: "threeKind" }], reward: { food: 5 } },
      { id: "rp-4", name: "Spoils", diceRequired: 4, requirement: [{ type: "sumAtLeast", value: 16 }], reward: { food: 6 } },
      {
        id: "rp-5",
        name: "Take the Axe",
        diceRequired: 4,
        requirement: [{ type: "fourKind" }],
        reward: { steal: { tools: 1 } },
      },
    ],
  },

  // ---------------- Standing Stones (Prompt 5): the big-tribe card ----------------
  // Identity: 4 of 6 slots need 4-5 dice — visible late-game opportunities
  // that starting Pop-3 tribes can see but cannot claim. The two small
  // slots keep it relevant early. Top-tier rewards in the deck (Food 8-9,
  // Pop 1 on a 5-die four-kind — the hardest Pop slot).
  {
    id: "standing-stones",
    name: "Standing Stones",
    orderRule: "highestDie",
    art: "standing-stones",
    slots: [
      { id: "ss-1", name: "Old Markings", diceRequired: 1, requirement: [{ type: "mustContain", value: 6, count: 1 }], reward: { food: 2 } },
      { id: "ss-2", name: "Small Tribute", diceRequired: 2, requirement: [{ type: "sumAtMost", value: 8 }], reward: { tools: 1 } },
      { id: "ss-3", name: "Aligned Stones", diceRequired: 4, requirement: [{ type: "range", min: 2, max: 5 }], reward: { food: 6 } },
      { id: "ss-4", name: "Thunder Call", diceRequired: 4, requirement: [{ type: "sumAtLeast", value: 18 }], reward: { food: 8 } },
      { id: "ss-5", name: "Moon Straight", diceRequired: 5, requirement: [{ type: "straight" }], reward: { food: 9 } },
      { id: "ss-6", name: "Ancestral Gift", diceRequired: 5, requirement: [{ type: "fourKind" }], reward: { population: 1 } },
    ],
  },
];
