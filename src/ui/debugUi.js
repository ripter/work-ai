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
    const game = new Game({ aiCount });
    destroyAll(app.stage);
    const scene = buildGameScene(ctx, game, showSetup);
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

  scene.addChild(place(txt("CavePerson", 44, C.text, { bold: true, anchor: true }), W / 2, 90));
  scene.addChild(place(txt("core game loop - debug build", 16, C.faint, { anchor: true }), W / 2, 132));
  scene.addChild(place(txt("Start a game with:", 16, C.faint, { anchor: true }), W / 2, 200));

  const opts = [
    { n: 1, label: "1 AI opponent" },
    { n: 2, label: "2 AI opponents" },
    { n: 3, label: "3 AI opponents" },
  ];
  opts.forEach((o, i) => {
    button(scene, W / 2 - 150, 230 + i * 52, 300, 40, o.label, () => onStart(o.n));
  });

  const help = [
    "How to play (debug):",
    "  REROLL  - click your dice to select them, then use",
    "            'Reroll selected (1 Tool)' or 'Finish rolling'",
    "  CLAIM   - click your dice to select them, then click a",
    "            slot to submit that exact selection",
    "  TARGET  - click a highlighted tribe panel",
    "  NIGHT   - 'Buy 1 Population (2 Food)' / 'Done with Night'",
    "",
    "Rewards are queued and resolve in claim order after the",
    "claiming phase ends. Last surviving tribe wins.",
  ];
  scene.addChild(place(txt(help.join("\n"), 12, C.faint), W / 2 - 270, 410));

  return scene;
}
