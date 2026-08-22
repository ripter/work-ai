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
