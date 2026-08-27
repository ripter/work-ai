import { Application } from "pixi.js";
import "./style.css";
import { buildTitleScene } from "./game/scene.js";

const app = new Application();

await app.init({
  width: 640,
  height: 480,
  background: 0x1d2b53,
  antialias: true,
});

document.getElementById("app").appendChild(app.canvas);
buildTitleScene(app);
