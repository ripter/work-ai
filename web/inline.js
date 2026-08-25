#!/usr/bin/env node
// Inline game.js into game.html as a data: URI, producing a single
// self-contained HTML file that opens directly in a browser (no server,
// no sibling game.js needed).
//
// usage: node inline.js <game.html> <game.js> <out.html>
// (out.html may be the same path as game.html to inline in place)
const fs = require("fs");

const [htmlPath, jsPath, outPath] = process.argv.slice(2);
if (!htmlPath || !jsPath || !outPath) {
  console.error("usage: node inline.js <game.html> <game.js> <out.html>");
  process.exit(1);
}

const b64 = fs.readFileSync(jsPath).toString("base64");
let html = fs.readFileSync(htmlPath, "utf8");

// the PICO-8 export loads game.js via a dynamically created <script>
const anchor = 'e.src = "game.js";';
if (!html.includes(anchor)) {
  console.error("anchor not found in " + htmlPath + ": " + anchor);
  process.exit(1);
}

html = html.replace(anchor, 'e.src = "data:text/javascript;base64,' + b64 + '";');
fs.writeFileSync(outPath, html);
console.log("wrote " + outPath + " (" + (html.length / 1048576).toFixed(2) + " MB, self-contained)");
