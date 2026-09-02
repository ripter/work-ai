// Game screen (Prompt 3): renders the full game state and provides the
// intended drag-and-drop dice interaction.
//
// Interaction (human seat 0):
//   reroll : click own dice to mark KEEP (lifted + yellow ring); REROLL
//            rerolls all unkept dice; DONE ROLLING locks without cost
//   claim  : drag dice from the YOUR DICE tray into a slot's dice tray
//            (tentative, one slot at a time); live incomplete/invalid/valid
//            feedback; CLAIM commits (the model re-validates); drag dice
//            back out or press "return" to undo
//   target : click a highlighted tribe panel
//   night  : buy Population (2 Food each, multiple allowed) / Done with Night
//
// Readability:
//   - initial rolls and rerolls tumble dice to the model's results
//     (animation is cosmetic; the model decides all values)
//   - AI turns: short delay, banner, dice-diff animation, slot flash
//   - rewards resolve one at a time (stepRewards mode) with per-claim rows
//   - night: per-tribe feeding summary + growth controls
//
// The Game model (src/game/game.js) is the sole authority on legality;
// this scene renders state, collects player intent, and animates changes.

import { Container, Graphics, Sprite } from "pixi.js";
import { applyAiDecision, aiTargetDecision } from "../game/ai.js";
import { describeSlot, describeReward, ORDER_RULES, validHostileTargets } from "../game/rules.js";
import { AI_TURN_DELAY_MS, GROWTH_FOOD_COST } from "../game/config.js";
import {
  newStaging,
  poolDice,
  canStageInto,
  stagedState,
  stagedDieIds,
  unstage,
  dropDie,
  slotDisplayState,
  isHumanClaimTurn,
} from "./claimStaging.js";
import { makeDie, tumble } from "./dieView.js";
import {
  bannerTexture,
  bannerSize,
  resourceIcon,
  scrimTexture,
  rewardKind,
  ART_BANNER_H,
  artworkDebug,
  tribeBadge,
  backgroundTexture,
  backgroundState,
  onBackgroundReady,
} from "./artwork.js";
import { W, H, C, sleep, txt, place, panel, button, hitRect, destroyAll } from "./uiKit.js";

// ---- layout (1280x800, desktop-first) ----
const CARD_X = 8;
const CARD_Y = 48;
const CARD_W = 470;
const CARD_H = 744;
const SLOT_X = CARD_X + 6;
const SLOT_W = CARD_W - 12;

const RIGHT_X = 486;
const RIGHT_W = 786;
const TRIBE_Y = 48;
const TRIBE_H = 396;
const ROW0_Y = TRIBE_Y + 26;
const ROW_PITCH = 92;

const CTX_Y = 452; // context area A: dice tray / rewards / night rows
const CTX_H = 118;
const ACT_Y = 574; // context area B: action buttons
const ACT_H = 58;
const LOG_Y = 638;
const LOG_H = 154;

const DIE_HUMAN = 30;
const DIE_AI = 24;
const TRAY_X = RIGHT_X + 12;
const TRAY_PITCH = 38;
const TRAY_PER_ROW = 20;
const TRAY_ROW0_Y = CTX_Y + 40;
const TRAY_ROW1_Y = CTX_Y + 76;

const REWARD_STEP_MS = 900;
const BANNER_MS = 1700;
const FLASH_MS = 900;

const ORDINALS = ["1st", "2nd", "3rd", "4th"];
const DIM_GRAY = 0x57506e;

const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const ordinal = (i) => ORDINALS[i] ?? `${i + 1}th`;
const rtxt = (s, size, color, extra = {}) => txt(s, size, color, { anchor: 1, ...extra });

export function buildGameScene(app, ctx, game, onNewGame) {
  const scene = new Container();
  scene.addChild(new Graphics().rect(0, 0, W, H).fill(C.bg));
  // Generated cave-wall backdrop (Prompt 5): cover-fitted over the flat base
  // once it decodes; the flat color shows through until then (and on error).
  const bgSprite = new Sprite();
  scene.addChild(bgSprite);
  const fitBg = () => {
    const t = backgroundTexture();
    const st = backgroundState();
    if (!t || !st.w) return;
    bgSprite.texture = t;
    const s = Math.max(W / st.w, H / st.h);
    bgSprite.scale.set(s);
  };
  onBackgroundReady(fitBg);
  fitBg();
  const dyn = new Container();
  const diceLayer = new Container();
  const fxLayer = new Container();
  scene.addChild(dyn, diceLayer, fxLayer);

  const view = {
    staging: newStaging(),
    keepSel: new Set(),
    growthN: 0,
    err: "",
    busy: false, // input locked while a roll animation plays
    dieViews: new Map(), // die id -> die container
    slotRects: [],
    banner: null, // { text, color, until }
    slotFlash: null, // { slotIndex, color, until }
    lastEvent: 0,
    rewardEvent: null,
    rewardList: null, // per-claim presentation rows
    nightSnap: null, // { food[], pop[], eliminated:Set } before last reward step
    turnKey: null,
  };

  // fx expiry (banner / slot flash) without a full re-render
  app.ticker.add(() => {
    const now = performance.now();
    let changed = false;
    if (view.banner && now > view.banner.until) {
      view.banner = null;
      changed = true;
    }
    if (view.slotFlash && now > view.slotFlash.until) {
      view.slotFlash = null;
      changed = true;
    }
    if (changed) paintFx();
  });

  const humanTurn = (a) =>
    a && a.tribeId === 0 && game.tribes[0].isHuman && !game.tribes[0].eliminated;
  const rerollTurn = () => {
    const a = game.awaiting;
    return a && a.type === "reroll" && humanTurn(a);
  };

  // ---- banner / slot flash (transient fx layer) ----

  function setBanner(text, color) {
    view.banner = text
      ? { text, color: color ?? C.text, until: performance.now() + BANNER_MS }
      : null;
    paintFx();
  }

  function flashSlot(slotIndex, color) {
    view.slotFlash = { slotIndex, color, until: performance.now() + FLASH_MS };
    paintFx();
  }

  function paintFx() {
    destroyAll(fxLayer);
    if (view.slotFlash) {
      const r = view.slotRects[view.slotFlash.slotIndex];
      if (r)
        fxLayer.addChild(
          new Graphics()
            .roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 10)
            .stroke({ width: 3, color: view.slotFlash.color })
        );
    }
    if (view.banner) {
      const t = txt(short(view.banner.text, 80), 17, view.banner.color, { bold: true });
      const w = t.width + 28;
      const h = t.height + 14;
      fxLayer.addChild(
        new Graphics()
          .roundRect(W / 2 - w / 2, 128, w, h, 8)
          .fill({ color: 0x120e1e, alpha: 0.92 })
          .stroke({ width: 1.5, color: view.banner.color })
      );
      t.x = W / 2 - t.width / 2;
      t.y = 128 + (h - t.height) / 2;
      fxLayer.addChild(t);
    }
  }

  // ---- dice views (persistent, keyed by die id) ----

  function dieView(id, size, interactive) {
    let dv = view.dieViews.get(id);
    if (dv && (dv.destroyed || dv.dieSize !== size)) {
      dv.destroy({ children: true });
      view.dieViews.delete(id);
      dv = null;
    }
    if (!dv) {
      dv = makeDie({
        size,
        value: 1,
        interactive,
        canDrag: () =>
          interactive && !view.busy && isHumanClaimTurn(game) && !dv.isDragging(),
        onDrop: (die, g) => onHumanDieDrop(die, g),
        onTap: (die) => onHumanDieTap(die),
        dragTarget: app.stage,
      });
      dv.dieId = id;
      view.dieViews.set(id, dv);
      diceLayer.addChild(dv);
    }
    return dv;
  }

  function trayPos(i) {
    const col = i % TRAY_PER_ROW;
    const row = Math.floor(i / TRAY_PER_ROW);
    return { x: TRAY_X + col * TRAY_PITCH, y: row === 0 ? TRAY_ROW0_Y : TRAY_ROW1_Y };
  }

  function slotCellPos(slotIndex, cellIndex) {
    const r = view.slotRects[slotIndex];
    return { x: SLOT_X + 10 + cellIndex * 36, y: (r ? r.y : 0) + 54 };
  }

  function tribeDicePos(tribeId, i) {
    const ty = ROW0_Y + tribeId * ROW_PITCH;
    return { x: RIGHT_X + 14 + i * 29, y: ty + 50 };
  }

  // Reconcile dice views with the model; called at the end of render().
  // The die currently under the pointer is never repositioned.
  function updateDice() {
    const live = new Set();
    const human = game.tribes[0];
    const st = view.staging;

    // human tray dice (pool = not consumed, not staged). Hidden while the
    // reward/night panels cover the tray area.
    const showHuman = game.phase === "reroll" || game.phase === "claiming";
    poolDice(st, game).forEach((d, i) => {
      live.add(d.id);
      const dv = dieView(d.id, DIE_HUMAN, true);
      dv.visible = showHuman;
      const p = trayPos(i);
      if (!dv.isDragging()) {
        dv.x = p.x;
        dv.baseY = p.y;
      }
      dv.setValue(d.value);
      const s = rerollTurn()
        ? view.keepSel.has(d.id)
          ? "kept"
          : "normal"
        : game.phase === "claiming"
          ? "normal"
          : "dim";
      if (dv.stateName() !== s) dv.state(s);
    });

    // human staged dice -> the active slot's tray
    if (st.slot !== null) {
      const ss = stagedState(st, game, st.slot);
      st.staged.forEach((id, i) => {
        live.add(id);
        const dv = dieView(id, DIE_HUMAN, true);
        dv.visible = showHuman;
        const p = slotCellPos(st.slot, i);
        if (!dv.isDragging()) {
          dv.x = p.x;
          dv.baseY = p.y;
        }
        const d = human.dice.find((x) => x.id === id);
        if (d) dv.setValue(d.value);
        const s = ss === "valid" ? "valid" : ss === "invalid" ? "invalid" : "staged";
        if (dv.stateName() !== s) dv.state(s);
      });
    }

    // AI dice (static display in tribe rows)
    for (const t of game.tribes) {
      if (t.id === 0) continue;
      t.dice.forEach((d, i) => {
        live.add(d.id);
        const dv = dieView(d.id, DIE_AI, false);
        const p = tribeDicePos(t.id, i);
        if (!dv.isDragging()) {
          dv.x = p.x;
          dv.baseY = p.y;
        }
        dv.setValue(d.value);
        const s = t.eliminated ? "dim" : "normal";
        if (dv.stateName() !== s) dv.state(s);
      });
    }

    for (const [id, dv] of [...view.dieViews]) {
      if (!live.has(id)) {
        dv.destroy({ children: true });
        view.dieViews.delete(id);
      }
    }
  }

  // ---- human die interaction ----

  function onHumanDieTap(die) {
    if (!rerollTurn()) return;
    const id = die.dieId;
    if (view.keepSel.has(id)) view.keepSel.delete(id);
    else view.keepSel.add(id);
    view.err = "";
    render();
  }

  function onHumanDieDrop(die, global) {
    if (!isHumanClaimTurn(game)) {
      render();
      return;
    }
    const id = die.dieId;
    let target = null;
    for (let i = 0; i < game.slots.length; i++) {
      const r = view.slotRects[i];
      if (
        r &&
        global.x >= r.x &&
        global.x <= r.x + r.w &&
        global.y >= r.y &&
        global.y <= r.y + r.h &&
        canStageInto(game, view.staging, i)
      ) {
        target = i;
        break;
      }
    }
    if (
      target !== null &&
      view.staging.slot === target &&
      !view.staging.staged.includes(id) &&
      view.staging.staged.length >= game.slots[target].def.diceRequired
    ) {
      // tray full: replace the last staged die (it returns to the pool)
      unstage(view.staging, view.staging.staged[view.staging.staged.length - 1]);
    }
    dropDie(view.staging, game, id, target);
    view.err = "";
    render();
  }

  // ---- human actions (intent -> model) ----

  function doHumanReroll() {
    const t = game.tribes[0];
    const ids = t.dice.filter((d) => !view.keepSel.has(d.id)).map((d) => d.id);
    if (ids.length === 0) return;
    const before = snapshotDice();
    try {
      game.doReroll(0, ids);
      view.err = "";
    } catch (e) {
      view.err = e.message;
      render();
      return;
    }
    render();
    animateChangedDice(before, 0, 450, () => {
      view.busy = false;
      render();
      pump();
    });
  }

  function finishHumanReroll() {
    game.finishReroll(0);
    view.keepSel.clear();
    view.err = "";
    render();
    pump();
  }

  function doClaim(slotIndex) {
    const ids = stagedDieIds(view.staging, slotIndex);
    if (ids.length === 0) {
      view.err = "stage dice into that slot first";
      render();
      return;
    }
    try {
      game.submitClaim(0, slotIndex, ids);
      view.staging = newStaging();
      view.err = "";
    } catch (e) {
      // the model is the authority; keep the staged dice for retry
      view.err = e.message;
      render();
      return;
    }
    render();
    pump();
  }

  function passTurn() {
    game.passClaim(0);
    view.staging = newStaging();
    view.err = "";
    render();
    pump();
  }

  function returnDice() {
    view.staging = newStaging();
    render();
  }

  function resolveHumanTarget(targetId) {
    try {
      game.resolveWithTarget(0, targetId);
      view.err = "";
    } catch (e) {
      view.err = e.message;
    }
    render();
    pump();
  }

  function buyGrowthN() {
    const n = view.growthN;
    if (n <= 0) return;
    try {
      game.buyGrowth(0, n);
      view.err = "";
    } catch (e) {
      view.err = e.message;
    }
    view.growthN = 0;
    render();
    pump();
  }

  function finishHumanGrowth() {
    game.finishGrowth(0);
    view.growthN = 0;
    view.err = "";
    render();
    pump();
  }

  // ---- animations (cosmetic only; the model decides all values) ----

  function snapshotDice() {
    const m = new Map();
    for (const t of game.tribes) for (const d of t.dice) m.set(d.id, d.value);
    return m;
  }

  function tumblePromise(dice, finals, ms) {
    return new Promise((res) => tumble(app, dice, finals, ms, res));
  }

  function animateChangedDice(before, tribeId, ms, onDone) {
    const t = game.tribes[tribeId];
    const changed = t.dice.filter((d) => {
      const bv = before.get(d.id);
      return bv !== undefined && bv !== d.value;
    });
    if (changed.length === 0) {
      onDone();
      return;
    }
    const myGen = ctx.gen;
    view.busy = true;
    const views = changed.map((d) => view.dieViews.get(d.id)).filter(Boolean);
    tumblePromise(views, changed.map((d) => d.value), ms).then(() => {
      if (ctx.gen === myGen) onDone();
    });
  }

  async function animateInitialRoll() {
    const myGen = ctx.gen;
    const views = [];
    const finals = [];
    for (const t of game.tribes)
      for (const d of t.dice) {
        const dv = view.dieViews.get(d.id);
        if (dv) {
          views.push(dv);
          finals.push(d.value);
        }
      }
    view.busy = true;
    setBanner(`Event ${game.eventIndex}: ${game.card.name} — rolling`, C.yellow);
    await tumblePromise(views, finals, 700);
    if (ctx.gen !== myGen) return;
    view.busy = false;
    setBanner(null);
  }

  async function animateAiAction(before) {
    const myGen = ctx.gen;
    const t = game.tribes[before.tribeId];
    const newClaim =
      game.claims.length > before.claimCount ? game.claims[game.claims.length - 1] : null;

    view.busy = true;
    render();
    const changed = t.dice.filter((d) => {
      const bv = before.dice.get(d.id);
      return bv !== undefined && bv !== d.value;
    });
    if (changed.length > 0) {
      const views = changed.map((d) => view.dieViews.get(d.id)).filter(Boolean);
      await tumblePromise(views, changed.map((d) => d.value), 450);
      if (ctx.gen !== myGen) return;
    }
    view.busy = false;
    if (newClaim) flashSlot(newClaim.slotIndex, t.color);
    const line = game.log.slice(before.logLen).find((l) => !l.startsWith("==="));
    if (line) setBanner(line, t.color);
    render();
  }

  // ---- top bar ----

  function renderTop() {
    const a = game.awaiting;
    let action = "-";
    let actionColor = C.faint;
    if (game.phase === "over") {
      action = game.winner ? `WINNER: ${game.winner.name}` : "DRAW — all tribes perished";
      actionColor = game.winner && game.winner.isHuman ? C.green : C.red;
    } else if (a) {
      const t = game.tribes[a.tribeId];
      const you = a.tribeId === 0;
      if (a.type === "reroll")
        action = you
          ? "your turn: click dice to mark KEEP, then REROLL / DONE ROLLING"
          : `${t.name} is rolling`;
      else if (a.type === "claim")
        action = you
          ? "your turn: drag dice into a slot, then CLAIM (or Pass)"
          : `claiming: ${t.name}`;
      else if (a.type === "target")
        action = you ? "pick a target: click a highlighted tribe" : `${t.name} is picking a target`;
      else action = you ? "your turn: buy growth, or finish Night" : `night: ${t.name}`;
    } else {
      action =
        game.phase === "reward"
          ? "resolving rewards in claim order…"
          : game.phase === "night"
            ? "night"
            : "…";
    }
    dyn.addChild(
      place(
        txt(
          `Event ${game.eventIndex}: ${game.card.name}   ·   ${ORDER_RULES[game.card.orderRule].label}   ·   ${game.phase.toUpperCase()}`,
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
        txt(view.err ? `ERROR: ${view.err}` : action, 12, view.err ? C.red : actionColor),
        12,
        27
      )
    );
    button(dyn, W - 150, 8, 140, 28, "Quit to setup", onNewGame);
  }

  // ---- event card / slots ----

  function renderCard() {
    dyn.addChild(panel(CARD_X, CARD_Y, CARD_W, CARD_H));

    // Banner art (data-driven: card def's `art` id -> assets/final). Cards
    // without art keep the plain header layout.
    const artTex = game.card.art ? bannerTexture(game.card.art) : null;
    const artSz = game.card.art ? bannerSize(game.card.art) : null;
    const hasArt = Boolean(artTex && artSz);
    view.lastArtBand = hasArt; // debug/verification: was the art band drawn?
    const topPad = hasArt ? ART_BANNER_H + 8 : 44;

    if (hasArt) {
      const holder = new Container();
      holder.position.set(CARD_X, CARD_Y);
      const spr = new Sprite(artTex);
      // Use the pre-decoded natural size, not artTex.width/height (0 until
      // first GPU upload in Pixi v8).
      const scale = Math.max(CARD_W / artSz.w, ART_BANNER_H / artSz.h);
      spr.scale.set(scale);
      spr.anchor.set(0.5);
      spr.position.set(CARD_W / 2, ART_BANNER_H / 2);
      holder.addChild(spr);
      // The mask Graphics is not in the display list, so its own position/
      // transform is NOT applied — only its local geometry is, in the parent
      // (dyn) space. Offset the rect to the holder's position so the clip
      // region lines up with the banner (a rect at (0,0) cut it in half).
      holder.mask = new Graphics()
        .rect(CARD_X, CARD_Y, CARD_W, ART_BANNER_H)
        .fill(0xffffff);
      dyn.addChild(holder);
      const scrim = new Sprite(scrimTexture());
      scrim.scale.set(CARD_W / 256, ART_BANNER_H / 16);
      scrim.position.set(CARD_X, CARD_Y);
      dyn.addChild(scrim);
      dyn.addChild(
        place(
          txt(`EVENT CARD — ${game.card.name}`, 15, C.text, { display: true }),
          CARD_X + 12,
          CARD_Y + 12
        )
      );
      dyn.addChild(
        place(
          txt(`claim order: ${ORDER_RULES[game.card.orderRule].label}`, 11, C.faint),
          CARD_X + 12,
          CARD_Y + 44
        )
      );
    } else {
      dyn.addChild(
        place(
          txt(`EVENT CARD — ${game.card.name}`, 14, C.text, { bold: true }),
          CARD_X + 10,
          CARD_Y + 8
        )
      );
      dyn.addChild(
        place(
          txt(`claim order rule: ${ORDER_RULES[game.card.orderRule].label}`, 11, C.faint),
          CARD_X + 10,
          CARD_Y + 27
        )
      );
    }

    const n = game.slots.length;
    const slotH = Math.min(98, Math.floor((CARD_H - topPad - 8) / n));
    const st = view.staging;
    const humanClaim = isHumanClaimTurn(game);
    view.slotRects = new Array(n);

    game.slots.forEach((slot, i) => {
      const sy = CARD_Y + topPad + i * (slotH + 1);
      const state = slotDisplayState(game, st, i);
      view.slotRects[i] = { x: SLOT_X, y: sy, w: SLOT_W, h: slotH };
      const ss = state === "staging" ? stagedState(st, game, i) : null;
      const imp = state === "impossible";

      let bg = 0x1f1839;
      let border = C.border;
      let borderW = 1;
      if (state === "claimed") {
        bg = 0x1c1533;
        border = 0x3a3355;
      } else if (imp) {
        bg = 0x120e1e;
        border = 0x2b2444;
      } else if (state === "staging") {
        if (ss === "valid") {
          bg = 0x14301f;
          border = C.green;
          borderW = 2;
        } else if (ss === "invalid") {
          bg = 0x331512;
          border = C.red;
          borderW = 2;
        } else {
          bg = 0x182547;
          border = C.blue;
          borderW = 2;
        }
      }
      dyn.addChild(
        new Graphics()
          .roundRect(SLOT_X, sy, SLOT_W, slotH, 8)
          .fill(bg)
          .stroke({ width: borderW, color: border })
      );

      dyn.addChild(
        place(
          txt(`${i + 1}. ${slot.def.name}`, 12, state === "claimed" ? 0x8a82a8 : imp ? DIM_GRAY : C.text, {
            bold: true,
          }),
          SLOT_X + 10,
          sy + 5
        )
      );
      dyn.addChild(place(txt(describeSlot(slot.def), 11, imp ? DIM_GRAY : C.faint), SLOT_X + 10, sy + 22));
      const rk = rewardKind(slot.def.reward);
      const rewardX = rk ? SLOT_X + 26 : SLOT_X + 10;
      if (rk) {
        const ic = resourceIcon(rk, 12);
        ic.position.set(SLOT_X + 10, sy + 33);
        dyn.addChild(ic);
      }
      dyn.addChild(
        place(
          txt(`Reward: ${describeReward(slot.def.reward)}`, 11, imp ? DIM_GRAY : C.green),
          rewardX,
          sy + 38
        )
      );

      // dice tray cells
      const need = slot.def.diceRequired;
      let cellBg = 0x1a1430;
      let cellBorder = 0x3a3355;
      if (state === "staging") {
        if (ss === "valid") {
          cellBg = 0x14301f;
          cellBorder = C.green;
        } else if (ss === "invalid") {
          cellBg = 0x331512;
          cellBorder = C.red;
        } else {
          cellBg = 0x182547;
          cellBorder = C.blue;
        }
      } else if (state === "claimed") {
        cellBg = 0x171226;
        cellBorder = 0x2b2444;
      } else if (imp) {
        cellBg = 0x100c1b;
        cellBorder = 0x241f36;
      }
      for (let c = 0; c < need; c++) {
        dyn.addChild(
          new Graphics()
            .roundRect(SLOT_X + 10 + c * 36, sy + 54, 30, 30, 5)
            .fill(cellBg)
            .stroke({ width: 1, color: cellBorder })
        );
      }

      // right-side info (and CLAIM / return buttons while staging)
      const rx = SLOT_X + SLOT_W - 10;
      if (state === "claimed") {
        const by = game.tribes[slot.claimedBy];
        dyn.addChild(place(rtxt(`claimed by ${by.name}`, 11, by.color, { bold: true }), rx, sy + 12));
        const pending = game.phase === "claiming" || game.phase === "reward";
        let res = "reward queued";
        if (!pending && view.rewardList) {
          const row = view.rewardList.find((r) => r.slotIndex === i);
          if (row) res = row.result || "resolved";
        }
        dyn.addChild(place(rtxt(short(res, 26), 10, 0x776f95), rx, sy + 28));
      } else if (imp) {
        dyn.addChild(place(rtxt(`needs ${need} dice`, 11, DIM_GRAY), rx, sy + 10));
        dyn.addChild(place(rtxt(`you have ${game.tribes[0].dice.length}`, 10, DIM_GRAY), rx, sy + 26));
      } else if (state === "no-match") {
        dyn.addChild(place(rtxt("no match with your dice", 10, DIM_GRAY), rx, sy + 12));
      } else if (state === "staging" && humanClaim) {
        const yInfo = sy + 38;
        if (ss === "incomplete")
          dyn.addChild(
            place(
              rtxt(
                `need ${need - st.staged.length} more die${need - st.staged.length === 1 ? "" : "s"}`,
                11,
                C.blue,
                { bold: true }
              ),
              rx,
              yInfo
            )
          );
        else if (ss === "invalid")
          dyn.addChild(place(rtxt("not a valid set", 11, C.red, { bold: true }), rx, yInfo));
        else dyn.addChild(place(rtxt("valid — press CLAIM", 11, C.green, { bold: true }), rx, yInfo));
      } else if (state === "available" && humanClaim) {
        dyn.addChild(place(rtxt("open", 10, 0x776f95), rx, sy + 12));
      }

      if (state === "staging" && humanClaim) {
        button(
          dyn,
          SLOT_X + SLOT_W - 102,
          sy + 4,
          92,
          26,
          "CLAIM",
          () => doClaim(i),
          ss === "valid",
          { accent: C.green, bold: true }
        );
        if (st.staged.length > 0)
          button(dyn, SLOT_X + SLOT_W - 102, sy + 56, 92, 24, "return", returnDice, true, {
            font: 11,
          });
      }
    });
  }

  // ---- tribes ----

  function tribeStatus(t) {
    if (t.eliminated) return { text: "ELIMINATED", color: C.red };
    const a = game.awaiting;
    if (game.phase === "claiming" && game.doneTribes.has(t.id))
      return { text: "out of the loop", color: C.dim };
    if (a && a.tribeId === t.id && game.phase !== "over")
      return { text: t.id === 0 ? "YOUR TURN" : "acting", color: C.yellow };
    if (game.phase === "reroll" && game.rerollDone.has(t.id))
      return { text: "locked", color: C.dim };
    return null;
  }

  function renderTribes() {
    dyn.addChild(panel(RIGHT_X, TRIBE_Y, RIGHT_W, TRIBE_H));
    dyn.addChild(place(txt("TRIBES", 13, C.text, { display: true }), RIGHT_X + 10, TRIBE_Y + 8));

    const a = game.awaiting;
    const targeting = a && a.type === "target" && humanTurn(a);
    const validTargets = targeting
      ? validHostileTargets(game.tribes, 0, a.effect).map((t) => t.id)
      : [];

    game.tribes.forEach((t) => {
      const ty = ROW0_Y + t.id * ROW_PITCH;
      const isTurn = a && a.tribeId === t.id && game.phase !== "over";
      const status = tribeStatus(t);
      let bg = 0x1f1839;
      let border = 0x3a3355;
      let borderW = 1;
      if (t.eliminated) bg = 0x171126;
      else if (validTargets.includes(t.id)) {
        bg = 0x3a1f2a;
        border = C.red;
        borderW = 2;
      } else if (isTurn) {
        bg = 0x2e2552;
        border = C.yellow;
        borderW = 2;
      }
      dyn.addChild(
        new Graphics()
          .roundRect(RIGHT_X + 6, ty, RIGHT_W - 12, 88, 8)
          .fill(bg)
          .stroke({ width: borderW, color: border })
      );
      const badge = tribeBadge(t.id, t.eliminated ? 0x4a4460 : t.color, 18);
      badge.position.set(RIGHT_X + 12, ty + 7);
      dyn.addChild(badge);

      const orderPos = game.claimOrder.indexOf(t.id);
      const orderTxt =
        (game.phase === "claiming" || game.phase === "reward") && orderPos >= 0
          ? `  ·  claims ${ordinal(orderPos)}`
          : "";
      dyn.addChild(
        place(
          txt(
            `${t.name}${t.isHuman ? " (you)" : ""}${orderTxt}`,
            13,
            t.eliminated ? C.dim : C.text,
            { bold: true }
          ),
          RIGHT_X + 36,
          ty + 5
        )
      );
      if (status)
        dyn.addChild(
          place(
            rtxt(status.text, 11, status.color, { bold: true }),
            RIGHT_X + RIGHT_W - 12,
            ty + 8
          )
        );

      const rr =
        game.phase === "reroll" && !t.eliminated ? ` · ${t.freeRerolls} free rerolls` : "";
      const rowColor = t.eliminated ? C.dim : C.faint;
      let rx = RIGHT_X + 14;
      const ry = ty + 28;
      for (const [kind, label] of [
        ["population", `Pop ${t.population}`],
        ["food", `Food ${t.food}`],
        ["tools", `Tools ${t.tools}`],
      ]) {
        const ic = resourceIcon(kind, 14);
        ic.position.set(rx, ry - 1);
        dyn.addChild(ic);
        rx += 18;
        const lab = txt(label, 13, rowColor);
        dyn.addChild(place(lab, rx, ry));
        rx += lab.width + 22;
      }
      if (rr) dyn.addChild(place(txt(rr, 13, rowColor), rx - 12, ry)); // 10px after last label
      if (t.id === 0) {
        dyn.addChild(
          place(txt("dice: in YOUR DICE tray below", 11, C.dim), RIGHT_X + 14, ty + 54)
        );
      }

      if (validTargets.includes(t.id))
        hitRect(dyn, RIGHT_X + 6, ty, RIGHT_W - 12, 88, () => resolveHumanTarget(t.id));
    });
  }

  // ---- context area A: dice tray / rewards / night ----

  function renderContextA() {
    if (game.phase === "reward") {
      renderRewards();
      return;
    }
    if (game.phase === "night") {
      renderNight();
      return;
    }
    // reroll / claiming: the human's dice tray (dice live in diceLayer)
    const n = poolDice(view.staging, game).length;
    dyn.addChild(panel(RIGHT_X, CTX_Y, RIGHT_W, CTX_H));
    dyn.addChild(place(txt(`YOUR DICE (${n})`, 12, C.text, { display: true }), TRAY_X, CTX_Y + 6));
    const hint = rerollTurn()
      ? "click a die to mark KEEP — unkept dice are rerolled"
      : isHumanClaimTurn(game)
        ? "drag dice into a slot to stage them (drop outside to return)"
        : "";
    if (hint) dyn.addChild(place(txt(hint, 11, C.faint), TRAY_X, CTX_Y + 24));
  }

  function renderRewards() {
    // rewards occupy both context areas (the dice tray is no longer needed)
    const h = CTX_H + ACT_H + 6;
    dyn.addChild(panel(RIGHT_X, CTX_Y, RIGHT_W, h));
    dyn.addChild(
      place(txt("REWARDS — resolve in claim order", 13, C.text, { display: true }), RIGHT_X + 12, CTX_Y + 8)
    );
    dyn.addChild(
      place(rtxt("claiming is over; rewards were queued and resolve one at a time", 10, C.faint),
        RIGHT_X + RIGHT_W - 12, CTX_Y + 12)
    );
    const rows = view.rewardList || [];
    if (rows.length === 0) {
      dyn.addChild(place(txt("no claims this event", 11, C.faint), RIGHT_X + 12, CTX_Y + 38));
      return;
    }
    const rowH = Math.min(24, Math.floor((h - 52) / rows.length));
    rows.forEach((r, i) => {
      const y = CTX_Y + 34 + i * rowH;
      const t = game.tribes[r.tribeId];
      const slot = game.slots[r.slotIndex];
      dyn.addChild(
        place(txt(`${i + 1}. ${t.name} · ${slot.def.name}`, 11, t.eliminated ? C.dim : t.color, { bold: true }),
          RIGHT_X + 12,
          y
        )
      );
      dyn.addChild(place(txt(short(describeReward(slot.def.reward), 34), 11, C.faint), RIGHT_X + 250, y));
      let stateTxt;
      let stateColor;
      if (r.state === "queued") {
        stateTxt = "queued";
        stateColor = C.dim;
      } else if (r.state === "resolving") {
        stateTxt = "resolving…";
        stateColor = C.yellow;
      } else if (r.state === "target") {
        stateTxt = r.result;
        stateColor = C.yellow;
      } else if (r.state === "voided" || r.state === "fizzled") {
        stateTxt = r.result;
        stateColor = C.red;
      } else {
        stateTxt = r.result;
        stateColor = C.green;
      }
      dyn.addChild(
        place(rtxt(short(stateTxt, 40), 11, stateColor, { bold: r.state === "target" }),
          RIGHT_X + RIGHT_W - 12, y)
      );
    });
  }

  function nightRowText(t, growingId) {
    const snap = view.nightSnap;
    if (!snap) return { text: `${t.name}: …`, waiting: true };
    if (t.eliminated) {
      const fedThisNight = growingId !== null ? t.id < growingId : true;
      if (fedThisNight && !snap.eliminated.has(t.id)) {
        const fb = snap.food[t.id];
        const pb = snap.pop[t.id];
        const fed = Math.min(pb, fb);
        return {
          text: `${t.name}: ${fb} Food · feed ${fed} · starved ${pb - fed} · ELIMINATED (starved)`,
          eliminated: true,
        };
      }
      if (snap.eliminated.has(t.id)) return { text: `${t.name}: ELIMINATED earlier`, eliminated: true };
      return { text: `${t.name}: ELIMINATED during rewards`, eliminated: true };
    }
    const fb = snap.food[t.id];
    const pb = snap.pop[t.id];
    const fed = Math.min(pb, fb);
    const starved = pb - fed;
    const left = fb - fed;
    let s = `${t.name}: ${fb} Food · feed ${fed} · starved ${starved} · ${left} left`;
    const grew = t.population - (pb - starved);
    if (grew > 0) s += ` · +${grew} Pop`;
    if (growingId === t.id) return { text: s + " · growing…", growing: true };
    if (growingId !== null && t.id < growingId) return { text: s + " · done" };
    return { text: s + " · waiting", waiting: true };
  }

  function renderNight() {
    dyn.addChild(panel(RIGHT_X, CTX_Y, RIGHT_W, CTX_H));
    dyn.addChild(
      place(txt("NIGHT — feed in seat order, then grow", 13, C.text, { display: true }), RIGHT_X + 12, CTX_Y + 8)
    );
    const a = game.awaiting;
    const growingId = a && a.type === "growth" ? a.tribeId : null;
    game.tribes.forEach((t) => {
      const y = CTX_Y + 32 + t.id * 21;
      const row = nightRowText(t, growingId);
      const color = row.eliminated ? C.red : row.growing ? C.yellow : row.waiting ? C.dim : C.faint;
      dyn.addChild(place(txt(row.text, 11, color), RIGHT_X + 12, y));
    });
  }

  // ---- context area B: actions ----

  function renderActions() {
    if (game.phase === "reward" || game.phase === "over") return; // covered elsewhere
    dyn.addChild(panel(RIGHT_X, ACT_Y, RIGHT_W, ACT_H));
    const a = game.awaiting;
    const t = game.tribes[0];

    if (a && a.type === "reroll" && humanTurn(a)) {
      const f = t.freeRerolls;
      const m = t.tools;
      const kept = t.dice.filter((d) => view.keepSel.has(d.id)).length;
      const k = t.dice.length - kept;
      const costTxt = f > 0 ? "FREE" : m > 0 ? "costs 1 Tool" : "none left";
      dyn.addChild(
        place(
          txt(
            `Free rerolls: ${f}   ·   Tools: ${m}   ·   next reroll: ${costTxt}   ·   ${kept} kept / ${k} will reroll`,
            12,
            C.faint
          ),
          RIGHT_X + 12,
          ACT_Y + 8
        )
      );
      let label;
      let enabled;
      if (k === 0) {
        label = "All dice kept — press DONE ROLLING";
        enabled = false;
      } else if (f > 0) {
        label = `REROLL ${k} dice — free (${f} left)`;
        enabled = true;
      } else if (m > 0) {
        label = `REROLL ${k} dice — costs 1 Tool`;
        enabled = true;
      } else {
        label = "No rerolls left — press DONE ROLLING";
        enabled = false;
      }
      button(dyn, RIGHT_X + 12, ACT_Y + 30, 380, 24, label, doHumanReroll, enabled, {
        font: 12,
        accent: C.blue,
      });
      button(dyn, RIGHT_X + 404, ACT_Y + 30, 200, 24, "DONE ROLLING", finishHumanReroll, true, {
        font: 12,
        accent: C.green,
        bold: true,
      });
      return;
    }

    if (a && a.type === "claim" && humanTurn(a)) {
      const st = view.staging;
      let info;
      if (st.slot === null) info = "Drag dice into a slot to stage them, then press CLAIM (or Pass).";
      else {
        const slot = game.slots[st.slot];
        const ss = stagedState(st, game, st.slot);
        if (ss === "incomplete")
          info = `Staging ${st.staged.length}/${slot.def.diceRequired} dice for "${slot.def.name}" — need ${slot.def.diceRequired - st.staged.length} more`;
        else if (ss === "invalid")
          info = `Staged ${st.staged.length} dice for "${slot.def.name}" — not a valid set`;
        else info = `Staged ${st.staged.length} dice for "${slot.def.name}" — valid, press CLAIM on the slot`;
      }
      dyn.addChild(place(txt(info, 12, C.faint), RIGHT_X + 12, ACT_Y + 8));
      button(dyn, RIGHT_X + 12, ACT_Y + 30, 240, 24, "Pass (opt out of claiming)", passTurn, true, {
        font: 12,
      });
      button(
        dyn,
        RIGHT_X + 264,
        ACT_Y + 30,
        190,
        24,
        "Return dice to pool",
        returnDice,
        st.slot !== null,
        { font: 12 }
      );
      return;
    }

    if (a && a.type === "growth" && humanTurn(a)) {
      const maxG = Math.floor(t.food / GROWTH_FOOD_COST);
      view.growthN = Math.max(0, Math.min(view.growthN, maxG));
      const n = view.growthN;
      dyn.addChild(
        place(
          txt(
            `Buy Population: ${GROWTH_FOOD_COST} Food -> +1 Pop each   ·   you have ${t.food} Food   ·   max ${maxG}`,
            12,
            C.faint
          ),
          RIGHT_X + 12,
          ACT_Y + 8
        )
      );
      button(
        dyn,
        RIGHT_X + 12,
        ACT_Y + 30,
        34,
        24,
        "-",
        () => {
          view.growthN = Math.max(0, n - 1);
          render();
        },
        n > 0,
        { font: 14, bold: true }
      );
      const cnt = txt(String(n), 14, C.text, { bold: true });
      cnt.anchor.set(0.5);
      dyn.addChild(place(cnt, RIGHT_X + 67, ACT_Y + 42));
      button(
        dyn,
        RIGHT_X + 84,
        ACT_Y + 30,
        34,
        24,
        "+",
        () => {
          view.growthN = Math.min(maxG, n + 1);
          render();
        },
        n < maxG,
        { font: 14, bold: true }
      );
      const cost = n * GROWTH_FOOD_COST;
      button(
        dyn,
        RIGHT_X + 130,
        ACT_Y + 30,
        330,
        24,
        n > 0
          ? `Buy ${n} Population — costs ${cost} Food (${t.food - cost} left)`
          : "Buy Population",
        buyGrowthN,
        n > 0,
        { font: 12, accent: C.green }
      );
      button(
        dyn,
        RIGHT_X + 472,
        ACT_Y + 30,
        180,
        24,
        "Done with Night",
        finishHumanGrowth,
        true,
        { font: 12, accent: C.yellow, bold: true }
      );
      return;
    }

    if (a && a.type === "target" && humanTurn(a)) {
      dyn.addChild(
        place(txt("Pick a target: click a highlighted tribe panel.", 12, C.yellow), RIGHT_X + 12, ACT_Y + 10)
      );
      return;
    }

    // AI thinking / transition
    const name = a ? game.tribes[a.tribeId].name : "…";
    const what =
      a?.type === "reroll" ? "is rolling" : a?.type === "claim" ? "is deciding" : "…";
    dyn.addChild(place(txt(`${name} ${what}…`, 12, C.dim), RIGHT_X + 12, ACT_Y + 10));
  }

  // ---- log / overlay ----

  function renderLog() {
    dyn.addChild(panel(RIGHT_X, LOG_Y, RIGHT_W, LOG_H));
    dyn.addChild(place(txt("LOG (latest last)", 12, C.text, { display: true }), RIGHT_X + 10, LOG_Y + 6));
    const lines = game.log.slice(-8);
    lines.forEach((line, i) => {
      const bad = /ELIMINATED|STARVED|VOIDED|FAILED|fizzles/.test(line);
      const isEvent = line.startsWith("===");
      const color = bad ? C.red : isEvent ? C.yellow : C.faint;
      dyn.addChild(place(txt(short(line, 96), 11, color), RIGHT_X + 10, LOG_Y + 24 + i * 16));
    });
  }

  function renderOverlay() {
    if (game.phase !== "over") return;
    dyn.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.72 }));
    const msg = game.winner ? `WINNER: ${game.winner.name}` : "DRAW — all tribes perished";
    const color = game.winner && game.winner.isHuman ? C.green : game.winner ? C.red : C.yellow;
    const t = txt(msg, 36, color, { bold: true });
    t.anchor.set(0.5);
    dyn.addChild(place(t, W / 2, H / 2 - 40));
    const sub = txt(
      `events played: ${game.eventIndex}   ·   survivors: ${game.aliveTribes().length}`,
      14,
      C.faint
    );
    sub.anchor.set(0.5);
    dyn.addChild(place(sub, W / 2, H / 2 + 10));
    button(dyn, W / 2 - 110, H / 2 + 50, 220, 36, "New Game", onNewGame, true, { bold: true });
  }

  function render() {
    // defensive: the staged slot may have been claimed by an AI in the
    // meantime (staged dice are still in the pool) -> clear the staging
    if (
      view.staging.slot !== null &&
      game.slots[view.staging.slot] &&
      game.slots[view.staging.slot].claimedBy !== null
    )
      view.staging = newStaging();

    // reset per-decision UI state when the decision kind changes
    // (staging intentionally survives AI turns within the same claim phase)
    const a = game.awaiting;
    const key = `${game.eventIndex}:${game.phase}:${a ? a.type : "-"}`;
    if (key !== view.turnKey) {
      view.turnKey = key;
      view.staging = newStaging();
      view.keepSel.clear();
      view.growthN = 0;
    }
    destroyAll(dyn);
    renderTop();
    renderCard();
    renderTribes();
    renderContextA();
    renderActions();
    renderLog();
    renderOverlay();
    updateDice();
  }

  // ---- pump: AI turns, reward stepping, new-event rolls ----

  function takeNightSnapshot() {
    view.nightSnap = {
      food: game.tribes.map((t) => t.food),
      pop: game.tribes.map((t) => t.population),
      eliminated: new Set(game.tribes.filter((t) => t.eliminated).map((t) => t.id)),
    };
  }

  function presentRewardStep(idx, r) {
    const row = view.rewardList && view.rewardList[idx];
    if (!row) return;
    if (r.needsTarget) {
      row.state = "target";
      row.result = "pick a target: click a tribe";
    } else if (r.voided) {
      row.state = "voided";
      row.result = "VOIDED — claimer eliminated";
    } else if (r.fizzled) {
      row.state = "fizzled";
      row.result = "fizzled — no valid target";
    } else if (r.applied) {
      row.state = "done";
      row.result = short(r.applied.lines[0] || "resolved", 40);
    }
  }

  function pump() {
    const myGen = ctx.gen;
    if (ctx.pump === myGen) return;
    ctx.pump = myGen;
    (async () => {
      try {
        for (;;) {
          if (ctx.gen !== myGen) return;

          // new Event: roll animation for all tribes, then hand over
          if (game.phase === "reroll" && game.eventIndex !== view.lastEvent) {
            view.lastEvent = game.eventIndex;
            view.staging = newStaging();
            view.keepSel.clear();
            view.growthN = 0;
            view.err = "";
            view.nightSnap = null;
            view.rewardEvent = null;
            view.rewardList = null;
            render();
            await animateInitialRoll();
            if (ctx.gen !== myGen) return;
            render();
          }

          if (game.phase === "over") {
            render();
            return;
          }

          const a = game.awaiting;

          // reward phase: present queued claims one at a time
          if (game.phase === "reward") {
            if (a && a.type === "target" && humanTurn(a)) {
              render();
              return; // human picks the target by clicking a tribe
            }
            if (view.rewardEvent !== game.eventIndex) {
              view.rewardEvent = game.eventIndex;
              view.rewardList = game.claims.map((c) => ({
                tribeId: c.tribeId,
                slotIndex: c.slotIndex,
                state: "queued",
                result: "",
              }));
            }
            // a hostile target was just picked and the pump resumed: close
            // out the row that was waiting for the target
            const lastLine = [...game.log].reverse().find((l) => !l.startsWith("==="));
            for (let i = 0; i < view.rewardList.length; i++)
              if (view.rewardList[i].state === "target" && i < game.claimResolvePos) {
                view.rewardList[i].state = "done";
                view.rewardList[i].result = short(lastLine || "target applied", 40);
              }
            await sleep(REWARD_STEP_MS);
            if (ctx.gen !== myGen) return;
            const idx = game.claimResolvePos;
            if (idx >= game.claims.length - 1) takeNightSnapshot();
            if (view.rewardList[idx]) view.rewardList[idx].state = "resolving";
            render();
            const r = game.stepReward();
            presentRewardStep(idx, r);
            render();
            if (r.needsTarget) {
              if (game.awaiting && humanTurn(game.awaiting)) {
                render();
                return;
              }
              await sleep(AI_TURN_DELAY_MS);
              if (ctx.gen !== myGen) return;
              const at = game.awaiting;
              if (!at) return;
              try {
                game.resolveWithTarget(at.tribeId, aiTargetDecision(game, at.tribeId, at.effect));
              } catch (e) {
                view.err = e.message;
              }
              render();
            }
            continue;
          }

          if (!a) {
            render();
            return;
          }
          if (game.tribes[a.tribeId].isHuman) {
            render();
            return;
          }

          // AI turn: delay, apply, animate the diff
          await sleep(AI_TURN_DELAY_MS);
          if (ctx.gen !== myGen) return;
          const before = {
            tribeId: a.tribeId,
            dice: snapshotDice(),
            claimCount: game.claims.length,
            logLen: game.log.length,
          };
          try {
            if (!applyAiDecision(game)) {
              render();
              return;
            }
          } catch (e) {
            view.err = e.message;
            render();
            return;
          }
          await animateAiAction(before);
          if (ctx.gen !== myGen) return;
        }
      } finally {
        if (ctx.pump === myGen) ctx.pump = null;
      }
    })();
  }

  scene.render = render;
  scene.pump = pump;
  // debug handles (scripted verification / console poking)
  scene.debug = {
    staging: () => ({ slot: view.staging.slot, staged: [...view.staging.staged] }),
    keep: () => [...view.keepSel],
    growthN: () => view.growthN,
    setGrowthN: (n) => {
      view.growthN = n;
    },
    art: () => ({ card: game.card.art, rendered: view.lastArtBand, ...artworkDebug() }),
  };
  return scene;
}
