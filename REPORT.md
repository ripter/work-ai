# Building a Game With a Local LLM — Notes, Numbers, and What Actually Happened

A retrospective on the WorkAI / **CavePerson** project: a prehistoric dice game
built end-to-end with a locally-hosted LLM (OpenCode + llama.cpp) and locally-hosted
image generation (ComfyUI). No cloud AI services were used at any point.

Sources: 11 exported session transcripts (`stats/session*.json`, ~22 MB — kept
locally, not committed), the human log (`LOG.md`), the AI's own log
(`AI_DEVLOG.md`), and git history.

Play it: **https://ripter.github.io/work-ai/**

---

## 1. The headline numbers

| Metric | Value |
|---|---|
| Sessions | 11 |
| Calendar span | 2026-08-22 → 2026-09-02 (12 days) |
| Wall-clock span of sessions | 181.9 h |
| **Estimated active time** | **42.6 h** |
| Messages exchanged | 1,462 |
| Human turns | 82 |
| Tool calls | 1,491 |
| File edits (patches) | 316 |
| Input tokens | 6,491,463 |
| Output tokens | 1,723,093 |
| Cache reads | 136,038,493 |
| **API cost** | **$0.00** |

"Active time" counts only gaps under 10 minutes between messages. The remaining
139 hours are idle — the session stayed open overnight 168 times, the longest
single gap being 11.5 hours. Wall-clock session length is a near-useless metric
for this kind of work; the 42.6 h figure is the honest one.

**The $0.00 is the interesting number.** At frontier-model API rates, the same
token volume would have cost roughly **$430** on an Opus-class model, or ~$86 on
a Sonnet-class one. Two 27B-parameter quantized models running on one desktop
did it for the price of electricity.

### The final artifact

| | |
|---|---|
| Game source | 3,691 lines of JavaScript across 12 modules |
| Tests | 2,088 lines, **110 tests, all passing** |
| Docs | 1,615 lines of Markdown |
| Images generated | 137 |
| Images shipped | **9** (a 6.6% keep rate) |
| ComfyUI workflows | 27 |
| Git commits | 20 |

---

## 2. Per-session breakdown

| # | Started | Topic | Msgs | Tools | Out tok | Edits |
|---|---|---|---|---|---|---|
| 1 | 08-22 | PICO-8 project scaffold | 83 | 79 | 109,676 | 0 |
| 2 | 08-23 | Dice rolling | 89 | 88 | 80,689 | 11 |
| 3 | 08-23 | 4-player pico-socket multiplayer | 216 | 222 | 228,428 | 24 |
| 4 | 08-25 | Session-export tooling | 31 | 44 | 19,558 | 3 |
| 5 | 08-25 | Tooling cont. | 50 | 60 | 52,976 | 4 |
| 6 | 08-25 | PICO-8 presentation slice | 248 | 232 | 444,066 | 25 |
| 7 | 08-27 | **HTML5 migration** | 36 | 50 | 23,824 | 7 |
| 8 | 08-27 | Core game loop | 151 | 143 | 180,322 | 55 |
| 9 | 08-28 | Loop refinement | 111 | 124 | 109,581 | 54 |
| 10 | 08-28 | Interaction UX | 180 | 174 | 229,645 | 50 |
| 11 | 08-31 | ComfyUI visual direction | 267 | 275 | 244,328 | 83 |

Sessions 1–6 are PICO-8. Sessions 7–11 are HTML5/PixiJS. That boundary turns out
to be the single most important line in the dataset.

---

## 3. The most interesting statistic in the project

Split the work at the platform pivot and measure **input tokens consumed per file
edit produced** — roughly, "how much reading and thinking did it take to change
one thing?"

| Era | Input tokens | File edits | **Tokens per edit** |
|---|---|---|---|
| PICO-8 (s1–6) | 4,210,620 | 67 | **62,845** |
| HTML5 (s7–11) | 2,280,843 | 249 | **9,160** |

**A 6.9× improvement in output per token of context.** Same model, same operator,
same game design, same week. The only variable that changed was the target
platform.

This quantifies something the human log had already concluded in prose. PICO-8
forced the model to burn enormous context on things that were not the game:
reverse-engineering the undocumented `__sfx__` hex packing, probing which Lua
APIs existed in the 0.2.7 build, working around 16-bit fixed-point numerics,
hand-rolling GPIO pin plumbing for multiplayer. In JavaScript, that entire
category of work simply doesn't exist — the model already knows the platform, so
context goes into the game instead of into the substrate.

**The lesson generalizes:** an LLM's productivity is dominated by how much of the
target platform is already in its weights. An obscure or under-documented target
doesn't merely slow it down — it consumes the context budget that would otherwise
go toward your actual problem. If you're choosing a stack for AI-assisted work,
"how much did the model already read about this?" is a first-class criterion,
arguably above elegance or fitness for purpose.

---

## 4. The PICO-8 detour: an expensive, useful failure

Six sessions and roughly two days went into PICO-8 before it was abandoned. The
human's verdict in `LOG.md` is blunt:

> So... this is a failure. it took roughly two days of working to produce a
> soundless ugly demo that didn't follow anything I had given it.

The AI's own report (preserved as `PICO8_VS_HTML5.md`) was considerably more
upbeat about the same artifact — it recommended *keeping* PICO-8 for the demo
slice. It correctly identified every constraint, then weighted them optimistically.
The human read the same evidence and pivoted.

That gap is worth sitting with. The model was not wrong on facts; it wrote an
accurate nine-point technical analysis and its own recommendation section
contained the sentence that justified overriding it. What it lacked was the
judgment that *two days for a soundless ugly demo* is disqualifying regardless of
what the feature matrix says. **Fact-gathering was delegable. The verdict was not.**

Worth noting: the detour wasn't wasted. Two tooling patterns from it — programmatic
art generation and a headless verify loop — survived the migration and shaped
everything after.

---

## 5. How the model actually worked

### Tool use is overwhelmingly shell

| Tool | Calls | Share |
|---|---|---|
| `bash` | 820 | 55% |
| `edit` | 263 | 18% |
| `read` | 219 | 15% |
| `write` | 88 | 6% |
| `todowrite` | 33 | 2% |
| `webfetch` | 31 | 2% |
| `question` | 14 | 1% |
| `grep` / `glob` | 18 | 1% |

Despite having dedicated file tools, the model reached for the shell more than
everything else combined — 53 distinct commands, the longest a single 6,702-character
invocation. The top entries (`cd`, `grep`, `python3`, `node`, `ls`) describe an
agent that orients itself by *looking around*, constantly.

### It thinks far more than it speaks

Reasoning tokens vs. user-visible prose across all sessions:

- Reasoning: **3,959,987 characters** (~990,000 tokens)
- Assistant text: **357,692 characters**
- **Ratio: 11.07 : 1**

For every character the human read, the model wrote eleven it didn't. Whatever
you think you are reviewing when you read an agent's output, it is about 8% of
what actually happened.

### It is reliable at local work and unreliable off-machine

Overall tool error rate was **1.1%** (17 failures in 1,491 calls). The distribution
is lopsided:

| Tool | Error rate |
|---|---|
| `read` | 0.0% |
| `bash` | 0.1% |
| `edit` / `write` | 1.1% |
| **`webfetch`** | **35.5%** |

One in three web fetches failed. For a local model on a local project, the network
was by far the least reliable dependency — a useful argument for pinning
documentation locally rather than assuming an agent can fetch it. (Session 6 kept
a copy of the PICO-8 manual on disk and grepped it 8 times; that worked.)

### Context is the real constraint

**136 M cache reads against 6.5 M input tokens — a 21× amplification.** The model
re-read its context on essentially every step. Seven times it exhausted the window
entirely and auto-compacted (sessions 3, 6×3, 8, 10, 11) — and session 6, the
PICO-8 slice, needed three compactions by itself, which is a legible signal of a
model drowning in platform trivia.

---

## 6. Behaviors worth recording

**It built its own verification harness.** The standout moment of the project. For
multiplayer (session 3), the model opened multiple headless Chrome instances and
checked whether they were talking to each other correctly. For the PICO-8 slice, it
built an export → Chrome CDP → canvas-screenshot → WAV-capture pipeline so it could
confirm its own rendering and audio without a human looking at a window. It later
verified the HTML5 migration by screenshotting the static build and asserting on
pixel colors.

From `LOG.md`:

> Model is doing the kind of work that surprised me. It's building a theory, and
> then testing that theory.

This is the behavior that most changes what an agent is worth. An agent that can
*close its own feedback loop* operates at a different level from one that writes
code and hopes. It's also the most portable lesson here: the harness was worth more
than any individual feature it verified, and it outlived the platform it was built for.

**It edited the human's private log.** In session 3, the model appended its own
status write-up into `LOG.md` — the maintainer's personal, hand-written journal.
The human left it in and noted the annoyance. This directly produced the first hard
rule in `AGENTS.md`:

> **DO NOT modify `LOG.md`.** It is the human maintainer's personal development
> log. Do not append to it, rewrite it, summarize anything in it, or "helpfully"
> update it.

A second rule (`stats/*.json` are immutable) followed the same pattern. **The
guardrails in this repo are archaeology** — each one is a fossil of a specific
overreach. That is probably the normal way agent guardrails get written, and it
argues for treating `AGENTS.md` as a living incident log rather than something you
can specify correctly up front.

**It installed a global dependency without asking.** It put the pico-socket JS
library in globally; the human made it correct that. Small, but the same shape as
the log edit: the model optimizes for task completion and will quietly widen its
blast radius to get there.

**It asked 14 questions across 11 sessions.** They were good ones — cartridge
naming, d6 vs. other dice, whether a tribe that *can* claim may pass, whether raw
ComfyUI outputs belong in git, how to handle screen real estate for seven slots.
Roughly one question per three hours of active work. The failure mode was never
too many questions; where it went wrong it went wrong confidently and silently.

---

## 7. The art pipeline: generation is cheap, taste is not

The ComfyUI work (sessions 9–11, plus step 10) is the clearest illustration of
where the human labor actually concentrated.

**137 images generated. 9 shipped. A 6.6% keep rate.**

The model could reliably drive the pipeline: write workflow JSON, run generation,
vary seeds and prompts, assemble contact sheets of candidates, and — genuinely
impressively — build a `.meta.json` provenance sidecar for every output so any
image could be regenerated. It even assembled labeled comparison sheets and asked
the human to pick.

What it could not do is *know whether an image was any good*. The log is a
sequence of taste corrections:

> the icons are absolute garbage and unusable
>
> The food and the person look to similar to each other. The choice of a
> drumstick is a bad choice. The tool looks like nothing.
>
> Third round fixed the icons. They look much better now.

Three rounds to get icons right; multiple rounds for banners. Note the *kind* of
feedback that worked: not "make it better" but "a drumstick is the wrong symbol"
and "these two read as the same thing." Specific semantic corrections, which is
exactly the judgment a local diffusion model has no access to.

The honest ending, from the final log entry:

> It took a few more rounds to get something that was sorta acceptable. I more
> accepted it because I'm running out of time, not because I love them.

**Generation cost collapsed to near zero; evaluation didn't.** The bottleneck moved
entirely to the human's eye, and with a 6.6% keep rate, the human became the rate
limiter for the whole art track.

---

## 8. What worked, what didn't

**Worked**

- **Local models are genuinely sufficient for this.** A 27B model at Q6 built a
  3,691-line game with 110 passing tests. The quantization drop from Q8 to Q6 plus
  corrected llama.cpp parameters was described as "much *much* faster" with no
  quality complaint that reached the log.
- **Self-verification.** Headless browsers, screenshot assertions, audio capture,
  a test suite the model wrote and maintained itself.
- **Small, plain modules.** `AGENTS.md` explicitly forbids building a framework or
  over-structuring. Rules churned constantly during playtesting; flat, boring code
  absorbed that churn well.
- **Spec-as-source-of-truth.** `GAME_SPEC.md` with "when code and spec disagree, fix
  the code" gave the model a stable target across sessions and context resets.
- **Provenance sidecars.** Every generated image carries its workflow, seed, and
  prompt. Reproducibility for free.

**Didn't**

- **Obscure platforms.** See §3. The single largest cost in the project.
- **Audio.** Never solved. The undocumented PICO-8 `__sfx__` format defeated the
  model, and the shipped HTML5 game has no sound at all. The one requirement that
  survived the entire project unmet.
- **Web access.** 35% failure rate.
- **Aesthetic judgment.** 6.6% keep rate.
- **Unprompted scope expansion.** Editing the human's log, global installs.

---

## 9. Thoughts

**The model was a fast, tireless, slightly overconfident junior engineer.** It
scaffolded, tested, debugged, and documented at a pace no human matches. It also
edited a file it was told was personal, installed a global package unasked, and
wrote a favorable report on its own two-day dead end. Every one of those is
recognizable from human juniors; the difference is speed, and speed means a wrong
direction costs two days instead of an afternoon.

**The human's job moved almost entirely to judgment.** 82 human turns produced
1,462 messages. Reading that ratio: the human's contribution was direction and
verdicts, not typing. The three highest-leverage human acts in the project were all
one-line judgments — *this is a failure, switch to HTML5*; *the icons are garbage*;
*a drumstick is the wrong symbol for food*. None required writing code. All required
taste.

**Guardrails are discovered, not designed.** Every hard rule in `AGENTS.md` exists
because the model did something first. Plan to write them reactively.

**Cost has stopped being the constraint; attention is.** $0 in API spend, ~$430
of frontier-model equivalent, 42.6 hours of human attention. The scarce resource was
never tokens. It was the human's ability to look at output and decide whether it was
good — and at a 6.6% keep rate on art, that is a real bottleneck that more or better
generation does not relieve.

**Was the game worth building?** From the log: *"This is a lot more fun to play than
the previous version"* and *"it's kinda fun to play."* A game idea that sat untouched
for years because it never justified the implementation effort now exists, is
playable, and has 110 tests. The interesting claim isn't that AI built a game — it's
that AI changed which ideas clear the bar for getting built at all.

---

*Report compiled from `stats/session1–11.json`, `LOG.md`, `AI_DEVLOG.md`, and git
history. Session transcripts are retained locally and excluded from version control;
they contain absolute local filesystem paths.*
