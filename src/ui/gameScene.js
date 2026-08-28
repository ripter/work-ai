// Debug game screen (Prompt 3): renders the full game state and routes
// human clicks to the same Game action API the AI uses.
//
// Interaction (human seat 0):
//   reroll : click own dice to select, "Reroll selected" (free rerolls,
//            then Tools) / "Finish rolling"
//   claim  : click own dice to select, click a slot to submit (validated)
//   target : click a highlighted tribe panel
//   growth : "Buy 1 Pop (2 Food)" / "Done with Night"
//
// Slots render in three states during claiming (for the human tribe):
//   impossible : fewer dice left than the slot requires (dimmed, disabled)
//   no-match   : enough dice, but no current combination satisfies it
//   available  : a legal claim exists (clickable on the human's turn)
//
// AI turns run in an async pump with a small delay so the human can follow.

import { Container, Graphics } from "pixi.js";
import { applyAiDecision } from "../game/ai.js";
import {
  describeSlot,
  describeReward,
  ORDER_RULES,
  validHostileTargets,
  hasLegalClaim,
} from "../game/rules.js";
import { AI_TURN_DELAY_MS } from "../game/config.js";
import {
  W,
  H,
  C,
  sleep,
  txt,
  place,
  button,
  dieSquare,
  hitRect,
  destroyAll,
} from "./uiKit.js";

function panelRect(x, y, w, h) {
  return new Graphics().rect(x, y, w, h).fill(C.panel).stroke({ width: 1, color: C.border });
}

// state: "claimed" | "impossible" | "no-match" | "available" | "neutral"
function slotBg(x, y, w, h, state, pickable) {
  const g = new Graphics().rect(x, y, w, h);
  if (state === "claimed") g.fill(0x1c1533);
  else if (state === "impossible") g.fill(0x120e1e);
  else if (pickable) g.fill(0x2e2552).stroke({ width: 1, color: C.dim });
  else g.fill(0x1f1839);
  return g;
}

function tribeBg(x, y, w, h, tribe, isTurn, validTargets) {
  const g = new Graphics().rect(x, y, w, h);
  if (tribe.eliminated) g.fill(0x171126);
  else if (isTurn) g.fill(0x2e2552).stroke({ width: 2, color: C.yellow });
  else if (validTargets.includes(tribe.id)) g.fill(0x3a1f2a).stroke({ width: 2, color: C.red });
  else g.fill(0x1f1839);
  return g;
}

export function buildGameScene(ctx, game, onNewGame) {
  const scene = new Container();
  scene.addChild(new Graphics().rect(0, 0, W, H).fill(C.bg));
  const dyn = new Container();
  scene.addChild(dyn);

  const view = { sel: new Set(), err: "" };

  function humanTurn(a) {
    return (
      a &&
      a.tribeId === 0 &&
      game.tribes[0].isHuman &&
      !game.tribes[0].eliminated
    );
  }

  // ---- top bar ----
  function renderTop() {
    const a = game.awaiting;
    let action = "-";
    if (game.phase === "over") {
      action = game.winner
        ? `WINNER: ${game.winner.name}`
        : "DRAW - all tribes perished";
    } else if (a) {
      const t = game.tribes[a.tribeId];
      const verb =
        a.type === "reroll"
          ? "select dice to reroll, or finish"
          : a.type === "claim"
            ? "select dice + click a slot (or Pass)"
            : a.type === "target"
              ? "click a highlighted tribe to target"
              : "buy growth, or finish Night";
      action = `${t.name}: ${verb}`;
    }
    const order = ORDER_RULES[game.card.orderRule].label;
    dyn.addChild(
      place(
        txt(
          `Event ${game.eventIndex}: ${game.card.name}   |   claim order: ${order}   |   phase: ${game.phase.toUpperCase()}`,
          14,
          C.yellow,
          { bold: true }
        ),
        12,
        8
      )
    );
    dyn.addChild(
      place(
        txt(view.err ? `ERROR: ${view.err}` : `action: ${action}`, 13, view.err ? C.red : C.faint),
        12,
        28
      )
    );
    button(dyn, W - 140, 8, 130, 28, "Quit to setup", onNewGame);
  }

  // ---- slots panel ----
  // Slot state from the HUMAN tribe's perspective:
  //   impossible : slot needs more dice than the human has left (dimmed)
  //   no-match   : enough dice, but no current combination satisfies it
  //   available  : a legal claim exists with the current dice
  // (claimed / neutral outside the claiming phase.)
  function slotState(slot) {
    const human = game.tribes[0];
    if (slot.claimedBy !== null) return "claimed";
    if (game.phase !== "claiming" || human.eliminated) return "neutral";
    if (slot.def.diceRequired > human.dice.length) return "impossible";
    if (!hasLegalClaim(human.dice, slot.def)) return "no-match";
    return "available";
  }

  function renderSlots() {
    const x = 8;
    const y = 48;
    const w = 364;
    dyn.addChild(panelRect(x, y, w, 448));
    dyn.addChild(place(txt(`EVENT CARD - ${game.card.name}`, 14, C.text, { bold: true }), x + 10, y + 8));
    dyn.addChild(place(txt(`order: ${ORDER_RULES[game.card.orderRule].label}`, 11, C.faint), x + 10, y + 26));

    const a = game.awaiting;
    const canPick = humanTurn(a) && a.type === "claim";
    const human = game.tribes[0];
    const dimGray = 0x57506e;
    game.slots.forEach((slot, i) => {
      const sy = y + 44 + i * 49;
      const state = slotState(slot);
      const claimed = state === "claimed";
      const pickable = state === "available" && canPick;
      dyn.addChild(slotBg(x + 6, sy, w - 12, 45, state, pickable));

      let nameColor = C.text;
      let descColor = C.faint;
      let rewardColor = C.green;
      let tag = "";
      if (state === "claimed") {
        nameColor = C.faint;
        descColor = 0x776f95;
        rewardColor = 0x776f95;
      } else if (state === "impossible") {
        nameColor = dimGray;
        descColor = dimGray;
        rewardColor = dimGray;
        tag = `  [needs ${slot.def.diceRequired} dice, you have ${human.dice.length}]`;
      } else if (state === "no-match") {
        rewardColor = 0x776f95;
        tag = `  [no match with your dice]`;
      }

      dyn.addChild(place(
        txt(`${i + 1}. ${slot.def.name}`, 12, nameColor, { bold: true }),
        x + 12,
        sy + 3
      ));
      if (claimed) {
        dyn.addChild(place(
          txt(`claimed: ${game.tribes[slot.claimedBy].name}`, 11, game.tribes[slot.claimedBy].color),
          x + 12,
          sy + 19
        ));
      }
      dyn.addChild(place(
        txt(describeSlot(slot.def) + tag, 11, descColor),
        x + 12,
        sy + (claimed ? 33 : 19)
      ));
      dyn.addChild(place(
        txt(describeReward(slot.def.reward), 11, rewardColor),
        x + 12,
        sy + (claimed ? 45 : 33)
      ));
      if (pickable) hitRect(dyn, x + 6, sy, w - 12, 45, () => tryClaim(i));
    });
  }

  function tryClaim(slotIndex) {
    const ids = [...view.sel];
    if (ids.length === 0) {
      view.err = "select at least 1 of your dice first";
      render();
      return;
    }
    try {
      game.submitClaim(0, slotIndex, ids);
      view.sel.clear();
      view.err = "";
    } catch (e) {
      view.err = e.message;
    }
    render();
    pump();
  }

  // ---- tribes panel ----
  function renderTribes() {
    const x = 380;
    const y = 48;
    const w = 572;
    dyn.addChild(panelRect(x, y, w, 448));
    dyn.addChild(place(txt("TRIBES", 14, C.text, { bold: true }), x + 10, y + 8));

    const a = game.awaiting;
    const targeting = humanTurn(a) && a.type === "target";
    const validTargets = targeting
      ? validHostileTargets(game.tribes, 0, a.effect).map((t) => t.id)
      : [];
    const orderPos = (id) => game.claimOrder.indexOf(id);

    game.tribes.forEach((t) => {
      const ty = y + 30 + t.id * 104;
      const isTurn = a && a.tribeId === t.id && game.phase !== "over";
      dyn.addChild(tribeBg(x + 6, ty, w - 12, 98, t, isTurn, validTargets));
      dyn.addChild(new Graphics().rect(x + 14, ty + 8, 12, 12).fill(t.color));

      const orderTxt =
        game.phase === "claiming" && orderPos(t.id) >= 0
          ? `  (claim order: ${orderPos(t.id) + 1})`
          : "";
      dyn.addChild(place(
        txt(`${t.name}${t.isHuman ? " (you)" : ""}${orderTxt}`, 13, t.eliminated ? C.dim : C.text, { bold: true }),
        x + 32,
        ty + 5
      ));
      const status = t.eliminated
        ? "ELIMINATED"
        : game.phase === "claiming" && game.doneTribes.has(t.id)
          ? "out of the loop"
          : isTurn
            ? "<-- your action"
            : "";
      if (status)
        dyn.addChild(place(
          txt(status, 11, t.eliminated ? C.red : C.yellow, { bold: true }),
          x + w - 150,
          ty + 7
        ));

      const rerollTxt =
        game.phase === "reroll" && !t.eliminated
          ? `    ${t.freeRerolls} free reroll${t.freeRerolls === 1 ? "" : "s"} left`
          : "";
      dyn.addChild(place(
        txt(`Pop ${t.population}    Food ${t.food}    Tools ${t.tools}${rerollTxt}`, 13, t.eliminated ? C.dim : C.faint),
        x + 14,
        ty + 26
      ));

      const clickable =
        !t.eliminated &&
        t.id === 0 &&
        humanTurn(a) &&
        (a.type === "claim" || a.type === "reroll");
      if (t.dice.length === 0) {
        dyn.addChild(place(txt(t.eliminated ? "" : "no dice", 11, C.dim), x + 14, ty + 50));
      }
      t.dice.forEach((d, di) => {
        dieSquare(
          dyn,
          x + 14 + di * 38,
          ty + 44,
          d.value,
          clickable ? () => toggleDie(d.id) : null,
          view.sel.has(d.id)
        );
      });

      if (validTargets.includes(t.id)) {
        hitRect(dyn, x + 6, ty, w - 12, 98, () => {
          try {
            game.resolveWithTarget(0, t.id);
            view.err = "";
          } catch (e) {
            view.err = e.message;
          }
          render();
          pump();
        });
      }
    });
  }

  function toggleDie(dieId) {
    if (view.sel.has(dieId)) view.sel.delete(dieId);
    else view.sel.add(dieId);
    view.err = "";
    render();
  }

  // ---- bottom: actions + log ----
  function renderBottom() {
    const x = 8;
    const y = 504;
    const w = 364;
    dyn.addChild(panelRect(x, y, w, 132));
    dyn.addChild(place(txt("ACTIONS", 13, C.text, { bold: true }), x + 10, y + 8));

    const a = game.awaiting;
    const t = game.tribes[0];
    const bx = x + 10;
    const bw = w - 20;
    let by = y + 30;

    if (game.phase === "over") {
      button(dyn, bx, by, bw, 30, "New Game", onNewGame);
    } else if (a && a.tribeId === 0) {
      if (a.type === "reroll") {
        const n = view.sel.size;
        const hasFree = t.freeRerolls > 0;
        const hasTool = t.tools > 0;
        const costTxt = hasFree
          ? `free, ${t.freeRerolls} left`
          : hasTool
            ? "costs 1 Tool"
            : "no rerolls left";
        button(
          dyn, bx, by, bw, 30,
          `Reroll selected (${n} die) — ${costTxt}`,
          () => {
            try {
              game.doReroll(0, [...view.sel]);
              view.err = "";
            } catch (e) {
              view.err = e.message;
            }
            render();
            pump();
          },
          (hasFree || hasTool) && n > 0
        );
        by += 36;
        button(dyn, bx, by, bw, 30, "Finish rolling (lock dice)", () => {
          game.finishReroll(0);
          view.err = "";
          render();
          pump();
        });
        by += 36;
        button(
          dyn, bx, by, bw, 30, "Clear selection",
          () => { view.sel.clear(); render(); },
          n > 0
        );
      } else if (a.type === "claim") {
        button(dyn, bx, by, bw, 30, `Selected: ${view.sel.size} dice -> click a slot`, () => {}, false);
        by += 36;
        button(dyn, bx, by, bw, 30, "Pass (opt out of claiming)", () => {
          game.passClaim(0);
          view.sel.clear();
          view.err = "";
          render();
          pump();
        });
        by += 36;
        button(
          dyn, bx, by, bw, 30, "Clear selection",
          () => { view.sel.clear(); render(); },
          view.sel.size > 0
        );
      } else if (a.type === "growth") {
        button(
          dyn, bx, by, bw, 30, "Buy 1 Population (2 Food)",
          () => {
            try {
              game.buyGrowth(0, 1);
              view.err = "";
            } catch (e) {
              view.err = e.message;
            }
            render();
            pump();
          },
          t.food >= 2
        );
        by += 36;
        button(dyn, bx, by, bw, 30, "Done with Night", () => {
          game.finishGrowth(0);
          view.err = "";
          render();
          pump();
        });
      } else if (a.type === "target") {
        button(dyn, bx, by, bw, 30, "Click a highlighted tribe to target it", () => {}, false);
      }
    }
  }

  function renderLog() {
    const x = 380;
    const y = 504;
    const w = 572;
    dyn.addChild(panelRect(x, y, w, 132));
    dyn.addChild(place(txt("LOG (latest last)", 12, C.text, { bold: true }), x + 10, y + 6));
    const lines = game.log.slice(-6);
    lines.forEach((line, i) => {
      const bad =
        line.includes("ELIMINATED") ||
        line.includes("STARVED") ||
        line.includes("VOIDED") ||
        line.includes("FAILED");
      const isEvent = line.startsWith("===");
      const color = bad ? C.red : isEvent ? C.yellow : C.faint;
      const t = txt(line.length > 88 ? line.slice(0, 87) + "..." : line, 11, color);
      t.x = x + 10;
      t.y = y + 24 + i * 16;
      dyn.addChild(t);
    });
  }

  // ---- victory / draw overlay ----
  function renderOverlay() {
    if (game.phase !== "over") return;
    dyn.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.72 }));
    const msg = game.winner
      ? `WINNER: ${game.winner.name}`
      : "DRAW - all tribes perished";
    const color = game.winner && game.winner.isHuman ? C.green : game.winner ? C.red : C.yellow;
    dyn.addChild(place(txt(msg, 36, color, { bold: true, anchor: true }), W / 2, H / 2 - 40));
    dyn.addChild(place(
      txt(`events played: ${game.eventIndex}   |   survivors: ${game.aliveTribes().length}`, 14, C.faint, { anchor: true }),
      W / 2,
      H / 2 + 10
    ));
    button(dyn, W / 2 - 110, H / 2 + 50, 220, 36, "New Game", onNewGame);
  }

  function render() {
    // Clear any stale dice selection when the acting tribe/decision changes
    // (e.g. reroll phase -> claiming phase).
    const key = `${game.phase}:${game.awaiting ? game.awaiting.type + ":" + game.awaiting.tribeId : "-"}`;
    if (key !== view.turnKey) {
      view.turnKey = key;
      view.sel.clear();
    }
    destroyAll(dyn);
    renderTop();
    renderSlots();
    renderTribes();
    renderBottom();
    renderLog();
    renderOverlay();
  }

  // ---- AI pump: applies AI decisions with a delay until control returns
  // ---- to the human, the game ends, or the scene is replaced.
  function pump() {
    const myGen = ctx.gen;
    if (ctx.pump === myGen) return;
    ctx.pump = myGen;
    (async () => {
      try {
        for (;;) {
          if (ctx.gen !== myGen) return;
          if (game.phase === "over") {
            render();
            return;
          }
          const a = game.awaiting;
          if (!a) {
            render();
            return;
          }
          if (game.tribes[a.tribeId].isHuman) {
            render();
            return;
          }
          await sleep(AI_TURN_DELAY_MS);
          if (ctx.gen !== myGen) return;
          if (!applyAiDecision(game)) {
            render();
            return;
          }
          render();
        }
      } finally {
        if (ctx.pump === myGen) ctx.pump = null;
      }
    })();
  }

  scene.render = render;
  scene.pump = pump;
  scene.debugSelection = () => [...view.sel];
  scene.debugInfo = () => ({ sel: [...view.sel], err: view.err });
  return scene;
}
