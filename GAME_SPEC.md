# CavePerson — Game Specification

Canonical specification for CavePerson. This document is the source of truth
for design rules; gameplay code must follow it. When a rule here conflicts
with code or an older note, this document wins and the code should be fixed.

## Core concept

CavePerson is a competitive prehistoric dice game inspired by Yahtzee-style
dice-placement games.

Each player controls a tribe.

Population determines how many dice the tribe receives at the start of an
Event Card.

Example:

* Population 3 = 3 dice
* Population 6 = 6 dice

## Players

The eventual game supports multiple tribes.

For the initial HTML5 implementation we will use:

* 1 human player
* 1–3 AI opponents selected at game start

Online multiplayer may be added later but is explicitly out of scope for now.

## Event Cards

Each round uses one Event Card.

An Event Card contains approximately 4–8 claimable slots.

Each card defines:

* slot requirements
* slot rewards
* the rule used to determine player claim order

Possible claim-order rules include things such as:

* largest Population
* most Tools
* highest die
* lowest die
* highest roll total

The claim order is calculated once, after all tribes have locked their dice
(i.e. at the start of the claiming phase, using the final post-reroll dice).

It does not change during that Event, even after dice are spent.

Ties in the ordering value are broken by seat number: the lower seat index
claims first.

## Event deck

Event Cards are drawn from a deck, one per Event.

The deck is shuffled (Fisher-Yates) before the first draw, and reshuffled and
re-dealt whenever it is exhausted, so a game can run for many Events.

The current prototype deck contains **12 cards** (see `src/data/events.js`):
Mammoth Hunt, Rock Quarry, Trading Post, Shaman's Rite, Ambush, River Fishery,
Drought, Great Migration, Spirit Cave, Flint Road, Raiding Party, and Standing
Stones. The deck composition is data, not a core rule — cards can be added,
removed, or re-tuned during playtesting.

## Dice

Everyone rolls simultaneously.

All players can see all players' dice.

Population determines each tribe's dice-pool size when the Event starts.

Dice are normal six-sided dice.

## Rerolls and Tools

The initial roll does not consume a reroll.

Every tribe starts each Event with a configurable number of **free rerolls**.
The current prototype value is **2 free rerolls per tribe per Event** — a
prototype balance value that may change after playtesting.

A reroll is Yahtzee-style:

* the player may keep any number of dice
* the player must reroll at least 1 of the remaining dice (a reroll of zero
  dice is not allowed)
* the cost of the whole reroll does not depend on how many dice are rerolled

Cost: a reroll consumes 1 free reroll while the tribe has any left; once the
free rerolls are exhausted, each further reroll costs exactly 1 Tool.

Free rerolls reset at the start of every Event. Unused free rerolls never
carry over into the next Event.

A player does not have to use all of their free rerolls, and does not have to
spend any Tools. Once a tribe chooses to finish rolling, its dice are locked
for the claiming phase.

All rolling and rerolling (free or Tool-paid) is finished before slot
claiming begins.

## Claiming slots

Players take turns according to the Event Card's fixed claim order.

Claiming uses dice from the player's current dice pool.

The player chooses exactly which dice they want to submit.

The selected dice must satisfy the slot's requirement.

Once the slot is successfully claimed:

* those selected dice are consumed for the rest of the Event
* the slot is locked and unavailable to everyone else

Players continue cycling through claim order as long as they can still claim
available slots.

A player may voluntarily pass on their turn. A passed tribe is out of the
claiming loop for the rest of that Event.

A tribe whose turn arrives with no legal claim available (no unclaimed slot it
can satisfy with its remaining dice) is automatically out of the loop for the
rest of that Event. Because dice and open slots only decrease during an Event,
legality can only shrink, so a tribe that is out stays out.

The claiming phase ends when every surviving tribe is out of the loop (passed,
auto-out, or no dice left).

## Slot requirements

Requirements are intentionally flexible.

### Required dice count

Every slot explicitly specifies the **exact number of dice required to claim
it** (`diceRequired`). It is never inferred from the requirement type.

Slot validation always performs both checks:

1. selected dice count === the slot's `diceRequired`
2. the selected dice satisfy the slot's requirement

Submitting fewer (or more) dice fails even when the submitted dice would
otherwise satisfy the condition. Example: a 3-die all-odd slot cannot be
claimed with a single odd die.

Cards may deliberately contain slots that require more dice than a tribe
currently has (e.g. a 5-dice slot while tribes start at Population 3). Those
slots are not removed or hidden: they stay visible (name, requirement,
reward, and required dice count) but are currently **unavailable** to that
tribe, and become claimable as tribes grow. This is a distinct state from
having enough dice but no current combination that matches.

### Requirement types

They may include traditional combinations such as:

* pair
* three of a kind
* four of a kind
* full house
* straight (exactly 5 dice of 5 consecutive distinct values, e.g. 1-2-3-4-5 or
  2-3-4-5-6)

They may also include requirements such as:

* sum >= N
* sum <= N
* exact sum
* all odd
* all even
* particular die values
* a value range (every die within `min..max`)
* at least N dice strictly above a value
* at least N dice strictly below a value
* exactly N of a kind (exactly, not "N or more")
* a split of odd vs even dice (e.g. exactly 2 odd and 2 even)
* unusual patterns

Example:

A slot may require exactly 3 dice where, after sorting the selected dice, the
middle die must equal 5 while the other two may be any values.

The design should support experimentation with unusual dice-placement
requirements.

## Slot interaction

The intended human interaction is drag-and-drop.

Players will eventually drag dice into a dice area attached to a slot.

Before submission:

* valid selected dice should be clearly shown as valid
* invalid selected dice should be shown in red or otherwise clearly invalid
* invalid selections cannot be submitted

Dice are not consumed until the player explicitly submits/locks the slot.

## Rewards

Slot rewards may include:

* Food
* Tools
* Population

Food should generally be the most common.

Population rewards should be comparatively rare.

Very rare slots may provide resource transformation rewards, such as:

* spend N Tools to receive X Food
* spend N Food to receive X Tools

Transformation slots should generally be relatively easy to match compared
with their economic effect.

A player can claim a transformation slot by satisfying its dice requirement
even if they later discover they cannot afford the resource cost.

In that case the transformation can fail and their spent dice are still lost.

Rare difficult slots may also have hostile effects such as:

* kill 1 Population from another tribe
* steal a Tool from another tribe

These should be difficult enough that they are unlikely to occur early in the
game and become more achievable as tribes grow.

A hostile effect always targets another tribe — the claimer can never target
themself. A kill may not reduce a target below 0 Population, and a steal may
not take a Tool a tribe does not have; targets that cannot legally receive the
effect are not valid targets.

If a hostile reward resolves with no valid target left, it fizzles: the claim
still stands and the dice are still spent, but the effect does nothing.

## Reward timing

Rewards are **not** granted immediately when a slot is claimed.

Claims are queued.

After the Event claiming phase is completely finished, rewards resolve.

Reward resolution order is the exact order in which slots were claimed.

If a claimer has been eliminated by the time their queued reward resolves
(e.g. an earlier hostile kill in the same reward phase), that reward is
voided and has no effect.

After all rewards resolve, Night begins.

## Night

Night resolves one tribe at a time, in seat order (lowest seat first).

Each Population requires 1 Food.

Resolve Night by feeding the tribe.

If a tribe cannot feed everyone, Population is lost until the remaining
Population can be fed.

If Population reaches 0 after feeding/starvation resolution, that tribe is
eliminated.

After feeding, surviving tribes may grow.

Spend:

**2 Food -> +1 Population**

There is no per-Night growth limit.

A tribe may buy as much Population as it can afford.

## Victory

The last tribe with Population remaining wins.

Victory is checked at the end of each Night (after all surviving tribes have
finished feeding and growing):

* exactly one tribe left -> that tribe wins, the game ends
* no tribes left (e.g. the final tribes all starve on the same Night) -> the
  game ends in a draw, with no winner
* two or more tribes left -> the next Event begins

## Starting values

Every tribe starts the game with:

* 3 Population
* 4 Food
* 1 Tool

## Prototype assumptions (Prompts 2–3)

The following are implementation details of the current prototype, not core
design rules. They exist to keep the prototype simple and testable and may
change as the game is playtested:

* **Free rerolls.** The current prototype gives every tribe **2 free rerolls
  per Event** (centralized as `FREE_REROLLS_PER_EVENT` in
  `src/game/config.js`). This is a prototype balance value that may change
  after playtesting.
* **Dice-subset search cap.** When a tribe's dice pool is large (more than 16
  dice), the legal-subset search is capped so it cannot enumerate every
  combination. This keeps claiming responsive; it only matters at very high
  Population.
* **AI behavior.** AI opponents use simple transparent heuristics (spend free
  rerolls before Tools, keeping a strong anchor pattern when rerolling; pick
  the highest-scoring legal claim, weighted toward Food when starving; treat
  slots that require more dice than they hold as impossible; target the
  strongest tribe with hostile effects; grow while it can afford it). They
  are intentionally weak and readable, not optimal.
* **AI pacing.** AI decisions are delayed ~600 ms in the UI so a human can
  follow the game. The game core itself has no timing.
* **UI.** The prototype UI implements the intended drag-and-drop interaction
  from "Slot interaction": dice are dragged from the player's tray into a
  slot's dice tray (tentative — nothing is submitted until the player presses
  CLAIM, and dice are not consumed until then), with live valid/invalid
   feedback on the staged set. Rerolls use click-to-KEEP marking; hostile
   targets are picked by clicking a highlighted tribe; Night shows a per-tribe
   feeding summary. Dice are placeholder pip graphics. The layout is a
   functional 1280x800 desktop build: Event Card banners are generated
   illustrations (see `VISUAL_DIRECTION.md` and `comfyui/`), a generated
   cave-wall backdrop fills the play area, tribes are marked with small vector
   badge emblems, and resource icons are drawn vectors.
* **Debug hooks.** The page exposes `window.__cp = { game, scene }` for
  inspection/testing, and `?autoplay=N` (N = 1..3) auto-starts a game with N
  AI opponents. Both are development aids and may be removed later.
* **Canvas.** The game renders to a fixed 1280x800 canvas, centered and
  scaled to fit the window.
