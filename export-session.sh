#!/bin/sh
# export the current opencode session (most recently updated session in this
# project) to stats/sessionN.json. run: sh export-session.sh [sessionID]
# note: opencode export drops chunks when piped, so always redirect to a file
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -n "$1" ]; then
  ID="$1"
else
  ID="$(opencode session list --format json --max-count 1 | python3 -c 'import json, sys; print(json.load(sys.stdin)[0]["id"])')"
fi

N="$(ls stats/session*.json 2>/dev/null | sed 's|.*session||; s|\.json$||' | sort -n | tail -1)"
N=$(( ${N:-0} + 1 ))

OUT="stats/session$N.json"
opencode export "$ID" > "$OUT"
python3 -m json.tool "$OUT" > /dev/null
echo "wrote $OUT ($ID)"
