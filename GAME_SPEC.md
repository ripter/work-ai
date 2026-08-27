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

The claim order is calculated once when the Event begins.

It does not change during that Event, even after dice are spent.

## Dice

Everyone rolls simultaneously.

All players can see all players' dice.

Population determines each tribe's dice-pool size when the Event starts.

Dice are normal six-sided dice.

## Tools and rerolls

Tools are consumable.

Spending 1 Tool allows one Yahtzee-style reroll.

During that reroll:

* the player may keep any number of dice
* the player may reroll any number of the remaining dice
* the entire reroll costs exactly 1 Tool regardless of how many dice are
  rerolled

A player may spend as many Tools as they currently have.

All rolling and Tool use is finished before slot claiming begins.

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

## Slot requirements

Requirements are intentionally flexible.

They may include traditional combinations such as:

* pair
* three of a kind
* four of a kind
* full house
* straight

They may also include requirements such as:

* sum >= N
* sum <= N
* exact sum
* all odd
* all even
* particular die values
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

## Reward timing

Rewards are **not** granted immediately when a slot is claimed.

Claims are queued.

After the Event claiming phase is completely finished, rewards resolve.

Reward resolution order is the exact order in which slots were claimed.

After all rewards resolve, Night begins.

## Night

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
