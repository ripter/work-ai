import { Application } from "pixi.js";
import "./style.css";
import { startApp } from "./ui/debugUi.js";
import { W, H } from "./ui/uiKit.js";

const app = new Application();

await app.init({
  width: W,
  height: H,
  background: 0x1d2b53,
  antialias: true,
});

document.getElementById("app").appendChild(app.canvas);
startApp(app);
