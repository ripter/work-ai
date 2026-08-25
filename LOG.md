# Log of WorkAI Project
Goal of this project is to make a game demo for work using AI.

The game idea I have is one I came up with long before AI existed and never got past the "think about this idea for a while" stage. So let's see if AI can make it a reality. And if it's fun once it really exists. I'll only use local AI models for this task. I'll be using OpenCode and ComfyUI with my local models as the tooling. This document was writen by human hands using NVim.

## Step 1 - Setup
Get the AI to setup a Pico8 Project.

Local LLM:

```
Starting llama.cpp with: Qwen3.8-27B-UD-Q8_K_XL
Command: '$HOME/dev/llama.cpp/build/bin/llama-server' '-m' '$HOME/dev/localGGUF/Qwen3.8-27B-UD-Q8_K_XL.gguf' '-ngl' '999' '-t' '16' '-tb' '16' '-c' '131072' '--flash-attn' 'on' '--cache-type-k' 'q8_0' '--cache-type-v' 'q8_0' '--embeddings' '--ctx-size' '200000' '--port' '8080.0'
```

It's figuring out the .p8 format, which isn't what I expected. I was just thinking it would write .lua files that I could then import into my pico8 and let the tooling do it's thing. I'm going to keep letting it try this approach.:wq
After thinking for a while and asking some questions. It's going to write the code in a .lua file and include it into the p8 cart, exactly what I thought it should do.

It tried to #include the game.lua file but somehow did it wrong. retyping myself and it worked fine.

## Step 2 - Roll Dice
Get the AI to setup a basic dice rolling setup.

Local LLM:

```
Starting llama.cpp with: Qwen3.8-27B-UD-Q6_K_XL
Command: '$HOME/dev/llama.cpp/build/bin/llama-server' '-m' '$HOME/dev/localGGUF/Qwen3.8-27B-UD-Q6_K_XL.gguf' '-ngl' '999' '-t' '12' '-tb' '12' '--flash-attn' 'on' '--cache-type-k' 'q8_0' '--cache-type-v' 'q8_0' '--port' '8080.0'
```

This is much *much* faster than the old model and config. I dropped from Q8 to Q6 and fixed some params that where harming me.
First round, it claims to roll the dice, it made the menu. But it doesn't visually show the dice rolling and the resulting dice value is not something you would be able to get with the dice it rolled. So lots of issues so far.
It said the issue was that the rnd function returns floats and so fixing that would fix the other issues.
It rolls and gives the total, everything I asked for.

## Step 3 - Multiplayer
Get the AI to setup multiplayer in the exported. Each player rolls dice, we can see all the rolls.

Local LLM:
```
Starting llama.cpp with: Qwen3.8-27B-UD-Q6_K_XL
Command: '$HOME/dev/llama.cpp/build/bin/llama-server' '-m' '$HOME/dev/localGGUF/Qwen3.8-27B-UD-Q6_K_XL.gguf' '-ngl' '999' '-t' '12' '-tb' '12' '--flash-attn' 'on' '--cache-type-k' 'q8_0' '--cache-type-v' 'q8_0' '--port' '8080.0'
```

Done (AI). Multiplayer is in via pico-socket: game.lua now has a 4-player
state machine (title -> setup -> board) with a per-player dice count (3-9),
and each player's join/roll/dice are relayed over GPIO pins. Added
web/pico-socket.yml (the pin map) and web/build.sh (flattens game.lua and
exports the web cart). Found and fixed a pin-offset bug (player blocks start
at gpio+2, because pins 0/1 are room id and player id). Verified headlessly
with two real browser tabs: both players join, roll with different dice
counts, and each tab sees the other's exact dice/total — 22/22 checks pass.
To play: `sh web/build.sh` then `cd web && PORT=5177 npx -y pico-socket`, and
open http://localhost:5177 in up to 4 tabs (A start, left/right pick dice,
A join, A roll, B leave).

It edited this file to add that block above. Not what I wanted but I'm leaving it in.
Model is doing the kind of work that surprised me with Fable. It's building a theory, and then testing that theory. Because we are doing multiplayer it loaded the game in different headless chromes and then comapred if they are talking to each other like we would expect.
Trying it, it does work.
It installed the js library I need for pico8 networking globaly, I had it correct that.


