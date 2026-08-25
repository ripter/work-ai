#!/bin/sh
# build the pico-socket web export (game.html + game.js) from game.p8 + game.lua
# the pico-8 cli does not resolve #include when exporting, so game.lua is
# inlined into a temp cart first. run: web/build.sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
PICO8="/Applications/pico-8/PICO-8.app/Contents/MacOS/pico8"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e '
const fs = require("fs");
const [p8Path, luaPath, out] = process.argv.slice(1);
const p8 = fs.readFileSync(p8Path, "utf8");
const lua = fs.readFileSync(luaPath, "utf8");
if (!p8.includes("#include game.lua")) {
  console.error("game.p8 has no #include game.lua line");
  process.exit(1);
}
fs.writeFileSync(out, p8.replace("#include game.lua", lua.trim()));
' "$ROOT/game.p8" "$ROOT/game.lua" "$TMP/game.p8"

"$PICO8" "$TMP/game.p8" -export "$DIR/game.html" -home "$TMP"
echo "built $DIR/game.html + $DIR/game.js"
