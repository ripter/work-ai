import { Container, Graphics, Text } from "pixi.js";

// placeholder scene: proves the pixi.js + vite stack renders.
// deliberately unpolished — real CavePerson scenes replace this.
export function buildTitleScene(app) {
  const cx = app.screen.width / 2;

  const scene = new Container();

  const panel = new Graphics()
    .roundRect(60, 110, 520, 260, 12)
    .fill({ color: 0x2b1d4e })
    .stroke({ width: 3, color: 0x83769c });
  scene.addChild(panel);

  const title = new Text({
    text: "CavePerson",
    style: {
      fill: 0xfff1e8,
      fontSize: 48,
      fontWeight: "bold",
      fontFamily: "monospace",
    },
  });
  title.anchor.set(0.5);
  title.x = cx;
  title.y = 190;
  scene.addChild(title);

  const status = new Text({
    text: "HTML5 migration successful",
    style: {
      fill: 0x00e436,
      fontSize: 20,
      fontFamily: "monospace",
    },
  });
  status.anchor.set(0.5);
  status.x = cx;
  status.y = 260;
  scene.addChild(status);

  const footer = new Text({
    text: "pixi.js + vite — placeholder scene",
    style: {
      fill: 0xc2c3c7,
      fontSize: 14,
      fontFamily: "monospace",
    },
  });
  footer.anchor.set(0.5);
  footer.x = cx;
  footer.y = 440;
  scene.addChild(footer);

  app.stage.addChild(scene);
  return scene;
}
