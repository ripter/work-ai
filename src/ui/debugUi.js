// Debug UI entry point (Prompt 2): scene management + setup screen.
//
// startApp(app) mounts the setup scene; starting a game swaps to the game
// scene. A generation counter cancels stale AI pumps when the scene
// changes.

import { Container, Graphics } from "pixi.js";
import { Game } from "../game/game.js";
import { W, H, C, txt, place, button, destroyAll } from "./uiKit.js";
import { buildGameScene } from "./gameScene.js";

export function startApp(app) {
  const ctx = { gen: 0, pump: null };
  // Debug aid: "?autoplay=N" (N = 1..3) starts a game immediately.
  // Useful for screenshots and watching an AI-vs-AI game.
  const auto = Number(new URLSearchParams(window.location.search).get("autoplay"));
  if (auto >= 1 && auto <= 3) startGame(auto);
  else showSetup();

  function showSetup() {
    ctx.gen++;
    ctx.pump = null;
    destroyAll(app.stage);
    window.__cp = null; // debug handle cleared
    app.stage.addChild(buildSetupScene((aiCount) => startGame(aiCount)));
  }

  function startGame(aiCount) {
    ctx.gen++;
    ctx.pump = null;
    // stepRewards: the scene presents reward steps one at a time instead
    // of the model resolving the whole queue synchronously.
    const game = new Game({ aiCount, stepRewards: true });
    destroyAll(app.stage);
    const scene = buildGameScene(app, ctx, game, showSetup);
    app.stage.addChild(scene);
    scene.render();
    scene.pump();
    // Debug handle for scripted verification (headless tests, console poking).
    window.__cp = { game, scene };
  }
}

function buildSetupScene(onStart) {
  const scene = new Container();
  scene.addChild(new Graphics().rect(0, 0, W, H).fill(C.bg));

  scene.addChild(place(txt("CavePerson", 44, C.text, { bold: true, anchor: 0.5 }), W / 2, 90));
  scene.addChild(place(txt("core game loop - debug build", 16, C.faint, { anchor: 0.5 }), W / 2, 132));
  scene.addChild(place(txt("Start a game with:", 16, C.faint, { anchor: 0.5 }), W / 2, 200));

  const opts = [
    { n: 1, label: "1 AI opponent" },
    { n: 2, label: "2 AI opponents" },
    { n: 3, label: "3 AI opponents" },
  ];
  opts.forEach((o, i) => {
    button(scene, W / 2 - 150, 230 + i * 52, 300, 40, o.label, () => onStart(o.n));
  });

  const help = [
    "How to play:",
    "  REROLL  - click your dice to mark KEEP (they lift up).",
    "            REROLL rerolls everything not kept: 2 free per Event,",
    "            then 1 Tool each. DONE ROLLING costs nothing.",
    "  CLAIM   - drag dice from YOUR DICE into a slot's dice tray.",
    "            Staging is tentative: drop outside or press 'return'",
    "            to take them back. Green = valid, then press CLAIM.",
    "  TARGET  - click a highlighted tribe panel",
    "  NIGHT   - buy Population (2 Food each, any amount) or press",
    "            'Done with Night'",
    "",
    "Rewards resolve one at a time in claim order after claiming",
    "ends. Night: feed in seat order (1 Food per Pop), then grow.",
    "Last surviving tribe wins.",
  ];
  scene.addChild(place(txt(help.join("\n"), 12, C.faint), W / 2 - 280, 400));

  return scene;
}
