# Proposal: Externally-Launched Agents (Attach Model)

**Status:** Draft for review (2026-06-18)
**Author:** Claude (at Fausto's request)
**Related:** `design/mcp-orchestration-proposal.md`, `design/mcp-implementation-plan.md`,
`design/mcp-implementation-caveats.md` (R1/R2 turn-loop), live-test bug #2 (per-turn disconnect→error)

> Sketch for review, not a finished spec. It proposes flipping the operational model so
> AgentTalk **does not spawn** provider CLIs — instead an operator launches an agent
> process (e.g. via a bash script) that **connects in** to AgentTalk and stays connected
> for its lifetime.

---

## 1. Why

Two drivers:

1. **Eliminates live-test bug #2.** Today AgentTalk auto-spawns the CLI, and Codex's MCP
   path runs a fresh `codex exec` **per turn**, so its bridge connects and disconnects
   every turn. The Milestone-03 "MCP disconnect → agent `error`" guard assumes a
   *persistent* connection, so it fires on the normal per-turn disconnect and kills the
   agent. A **long-lived agent holding one persistent connection** is exactly what that
   guard was built for — the spurious error disappears.

2. **Operator-launched, not auto-spawned (operator's rationale).** Agents are started by
   the operator; AgentTalk only *accepts inbound connections*. **Honest caveat:** this is a
   thin operational distinction, not a compliance guarantee. Whether automated/headless use
   is within a provider's terms is governed by **auth tier and usage** (the separately
   parked auth question) — not by who invokes the process. Recorded here as the operator's
   explicitly accepted risk, not as a claim of ToS compliance.

It is **not** a net simplification of the project: it trades a failure-propagation bug for
a turn-delivery design (below). But conceptually it is cleaner and matches the
"agents are clients that dial in" mental model.

---

## 2. Shape

```
  operator ──launches──► agent process (long-lived)
                              │
                              │ connects ONCE, stays connected (agentId), persistent
                              ▼
                        AgentTalk MCP server
                              │  tools: await_turn, send_to_agent, submit_plan, ...
                        Registry / TeamCoordinator
```

Per-turn loop, driven by the agent (MCP is client-initiated — see §4):

```
  agent: connect ─► await_turn(agentId) ──(blocks until work)──► prompt
                         ▲                                          │
                         │                                    run one model turn
                         │                                          │
                    send_to_agent / submit_* (result) ◄────────────┘
                         └─────────────── loop ───────────────────────
```

---

## 3. The key fork: who holds the persistent connection?

**Model A — the provider CLI holds it (true cutover).**
The externally-launched process is the CLI in a *persistent session*; the **model** calls
AgentTalk's MCP tools directly across turns over one connection.
- ✓ Preserves the original goal (typed tool calls *at the model boundary*; no stdout scraping).
- ✗ Needs a persistent MCP-client session per provider. claude/gemini already run
  persistent sessions; **codex's `codex exec` is one-shot per turn** and doesn't fit —
  this is the specific thing that created bug #2. Whether codex can hold a persistent
  inbound MCP-client session is unverified.

**Model B — a thin agent-harness holds it (simplest).**
The launched process is *our* small client (the long-lived connection owner). Each turn it
invokes the CLI as a plain subprocess (`codex exec "…"`, `claude -p "…"`), captures the
text, and calls AgentTalk's tools over the persistent connection.
- ✓ Fixes bug #2 (connection persists across turns).
- ✓ **Provider-agnostic**: the CLIs need *no* MCP support at all — no bridge, no codex
  120s timeout, no Gemini trust flag, no Claude config injection. All that complexity goes away.
- ✗ The model still emits text the harness parses heuristically — so it **does not**
  deliver "typed tool calls at the model boundary"; it just moves today's stdout parsing
  into the harness and changes the harness↔AgentTalk transport to MCP-over-WS.

**Trade-off to decide:** Model A keeps the original value but is hard for codex; Model B is
simple and robust but relocates (rather than removes) the brittle parsing. A hybrid is
possible later (Model B now; opt into model-side tools per provider where it works).

---

## 4. The crux: turn delivery

MCP is **model/client-initiated** — the AgentTalk server cannot *push* a prompt into a
connected agent (this is the §6 limitation of the original proposal, and the deferred
R1/R2 turn-loop question). So the agent must **ask** for work:

- A blocking/long-poll tool **`await_turn(agentId)`** that the agent calls; the server
  holds it until there's a prompt for that agent, then returns it. On timeout it returns
  "no work" and the agent re-calls.
- Timeout budget: in **Model B** the harness is our own client, so we control its tool
  timeout (long blocks fine; the 180s+keep-alive result already proven). In **Model A** the
  provider's tool-call timeout applies (e.g. codex's 120s) → the agent must re-poll within
  that ceiling.
- Results flow back as normal tool calls (`send_to_agent`, `submit_plan`, …) → existing
  `registry.handleMcpToolCall`.

This is effectively a new **execution mode** ("attach" / "external"), and it *re-opens the
deferred turn-loop decision* — worth settling here.

---

## 5. What changes in the code

- **Registry stops spawning** for attach-mode agents. Instead it registers an *expected*
  agent and waits for an inbound connection that claims that `agentId`.
- **Connection ⇄ agent identity**: handshake on connect (the `agentId` query param already
  exists; add validation that it matches a registered, not-yet-connected agent; keep the
  R3 hijack/duplicate rule).
- **Disconnect guard becomes correct**: with a persistent connection, a drop genuinely
  means the agent died → `error` is right. No per-turn false positives.
- **New `await_turn` tool** + a server-side per-agent prompt queue.
- **Model A**: persistent-session executors per provider. **Model B**: a new
  `agent-harness` client (launched by the operator's script) + plain one-shot CLI calls.
- **Coexistence**: ship as a new execution mode behind a flag; auto-spawn (legacy + current
  `persistent_mcp`) stays default. Operator opts an agent into attach mode.

---

## 6. Lifecycle & edge cases to design

- Agent connects **before** AgentTalk knows about it (or never) → registration/timeout.
- Reconnect after a transient drop vs genuine death (debounce before erroring).
- Multiple agents from one script; agentId assignment (who generates it — AgentTalk hands
  the operator an id/URL to launch with, or the script picks and registers).
- Auth/trust on localhost (the inbound socket is unauthenticated today — fine for local,
  flag for anything networked).
- Shutdown: operator kills the agent → clean disconnect → mark stopped, not `error`.

---

## 7. Effect on the known bugs

- **Bug #1 (WS collision):** unaffected — already fixed (dedicated MCP port); external
  agents hit the same endpoint.
- **Bug #2 (per-turn disconnect→error):** **eliminated** under a persistent connection
  (both models), because the connection no longer drops per turn.

---

## 8. Open questions

1. **Model A vs B** (§3) — the central decision. Recommendation: prototype **Model B**
   first (fastest to a hands-on, provider-agnostic test rig; sidesteps all per-CLI MCP
   quirks), keep Model A as the path to true model-side typed tools.
2. **`await_turn` semantics** — long-block vs short long-poll; per-provider timeout budget.
3. **Identity handshake** — does AgentTalk mint the agentId/URL the operator launches with,
   or does the agent self-register?
4. **Does this replace `persistent_mcp` or coexist?** Recommend coexist behind a new
   "attach" execution mode; don't rip out the current path until attach is proven.
5. **Turn-loop unification** — this is the R1/R2 decision in a new guise; settle it here so
   both transports agree.

---

## 9. Recommendation

Pursue this as **a new "attach" execution mode**, prototyped via **Model B** (harness owns
the persistent connection; CLIs invoked as plain subprocesses). It unblocks hands-on
testing, removes per-provider MCP fragility, and makes the Milestone-03 disconnect guard
correct by construction. Treat Model A (model-side typed tools) as a later enhancement, and
record the operator-launch ToS framing as accepted risk — not compliance.

---

## 10. Gemini/Antigravity Alignment (2026-06-18)

**Decision**: The previous "lightweight alternative" (which suggested handling Bug #2 by ignoring one-shot disconnects) is strictly rejected.
The architecture will transition strictly to **Externally-Launched Agents (Attach Mode)**.
- **Target State (External Processes)**: CLI connections will be established by external processes that connect to the orchestrator's MCP server.
- **Persistent Connections**: All connections will be persistent. One-shot connection handling will not be brought back.
- **Coexist Behind a Flag**: To preserve existing behavior (Milestone 03 rule), attach mode will be built as a new execution mode behind a flag. Executors will keep their existing spawn paths when the flag is off. Spawning will be removed only in a later step, after attach passes E2E.

## 11. Implementation Plan: The "Attach" Turn Loop

Under Attach Mode, because the orchestrator does not spawn the CLIs, it cannot push prompts into their `stdin`. The external process must request work.

### 11.1 The Orchestrator (Server-Side)
- **Attach Mode Bypass**: Behind the attach execution flag, executors bypass their `spawn()` logic, register an expected `agentId`, and wait for an external inbound connection.
- **Prompt Queue**: When the orchestrator routes a turn to an agent in attach mode, it enqueues the prompt internally.
- **The `await_turn` Tool**: Expose a blocking MCP tool `await_turn(agentId)` that holds the connection open until a prompt is available in the queue, then returns it.

### 11.2 The External Client (Skill-Driven Polling vs. Harness)
How does the external process know to call `await_turn`?

**Approach 1: Skill-Driven Polling (Native LLM Loop)**
*Proposed by Fausto.* Instead of writing a wrapper script, we leverage the LLM's own autonomous loop. We launch the CLI (`claude` or `gemini`) with a specific **"Attach Skill"** (a system prompt). 
- The skill instructs the agent: *"You are an attached worker. Call the `await_turn` tool in a loop. When you receive a prompt, execute it, then submit the result using `submit_plan` or `send_to_agent`, and immediately call `await_turn` again."*
- **Pros**: Zero wrapper code. True "typed tools at the model boundary" (Model A). The LLM natively holds the persistent connection and drives its own execution loop.
- **Cons**: Requires the CLI to support an autonomous loop that doesn't exit when idle. May not work for Codex (which is a one-shot execution tool rather than a conversational loop).

**Approach 2: The Agent Harness (Fallback)**
For any CLI that cannot autonomously drive a polling loop (like Codex), we provide a lightweight Node.js script (`attach-harness.mjs`).
- The operator runs `node attach-harness.mjs --provider codex --agentId 123`.
- The harness maintains the persistent WS connection, calls `await_turn`, and when a prompt arrives, it spawns `codex exec "..."` as a standard subprocess, capturing its output and returning it to the orchestrator.

### 11.3 Conclusion
We will aim for the **Skill-Driven Polling** approach for advanced agents (Claude, Gemini) to keep the architecture pure and eliminate brittle parsing. We will use the **Agent Harness** as the standard wrapper for execution-only models like Codex.

---

## 12. Claude review of the attach-mode alignment (2026-06-18)

The architectural commitment is right — attach mode + persistent connections + `await_turn`
is sound, and dropping the scoped-guard band-aid for the real model is correct. Three
pushbacks on execution specifics, and one reframe of the skill idea.

### A. Don't make the native LLM loop ("Skill-Driven Polling") the *primary* path without a feasibility spike
§11.3 commits to skill-driven for Claude/Gemini; the listed cons understate the risk (only
Codex is flagged). Real concerns:
- **Print-mode CLIs aren't daemons.** `claude -p` / `gemini -p` run a *bounded* agentic turn
  and exit when the model stops calling tools — not designed to loop on `await_turn` forever.
  Expect `--max-turns` caps or the model just ending the loop.
- **Context accumulation.** One never-ending session piles every turn's prompt+result into a
  single context window → it fills and degrades over time. Today's design replays *bounded*
  history per turn; an infinite native loop loses that bound.
- **Idle `await_turn` vs tool timeout.** With no work, `await_turn` blocks; the provider's
  tool-call timeout (codex 120s; others vary) can fire → forces short long-polls → more
  round-trips.
- **Token cost.** Model-driven polling burns tokens every cycle just to ask "any work?"; a
  harness polls for free.
Not fatal — but this is the *risky* option, not the safe default. Verify before adopting.

**Spike outcome (2026-06-18) — largely REFUTED for Claude.** Ran a stdio MCP server with
`await_turn`/`submit_result` and instructed `claude -p` (skill-style prompt) to loop:
- **Sustained the loop** — one `claude -p` invocation did 5 cycles
  (`await_turn → submit_result` ×5 → `await_turn` got DONE → "FINISHED count=5"), 43s. It did
  **not** exit after the first turn.
- **Tolerated 90s blocking `await_turn`** inside the loop — waited the full 90s each cycle,
  continued, stopped on DONE (288s, 2 cycles). So the idle long-poll pattern works on Claude;
  no tool-timeout, no early exit.

So the "print-mode isn't a daemon" and "idle await times out" concerns are **not borne out
for Claude** at this scale. What the spike did **not** cover, and remain the real residual
risks: **(1) duration/scale** — only 5 + 2 cycles; a long-lived session accumulates context
every cycle and will eventually fill the window; **(2) `--max-turns`** — needs to be very
high/unbounded for a long run and is consumed continuously; **(3) Gemini** untested; Codex
confirmed one-shot (harness required). Next spike = a **soak test** (dozens of cycles) to see
where context/turn limits force periodic session recycling.

### B. "Strip spawn() from all executors / non-negotiable" is a regression risk — coexist, don't rip out
Removing spawning from all executors as step 1 deletes the only working paths (legacy +
`persistent_mcp`) before attach is proven E2E — conflicting with the milestone
"preserve existing behavior" rule and this doc's own open-Q4. Ship attach as a **new
execution mode behind a flag**; remove spawning only once attach passes E2E.

### C. Reframe: "skill" and "who drives the loop" are *independent* axes (they were conflated)
```
  AXIS 1 — behavior: how the model uses AgentTalk's tools
     → an "Attach Skill" / system prompt        → needed EITHER way

  AXIS 2 — lifecycle: who holds the persistent connection & drives the await_turn loop
     (a) NATIVE  — the model loops    : "pure", zero wrapper, but daemon/context/timeout/cost risk
     (b) HARNESS — our node script     : robust, provider-agnostic, bounded; invokes CLI per turn
```
Fausto's **skill idea is valuable regardless of Axis 2** — even a harness invokes the CLI
per turn *with* a skill telling the model which AgentTalk tools to call. So adopt the skill;
decide native-vs-harness on feasibility, not by tying "use a skill" to "native loop."

### Recommendation (updated after the spike)
The spike **validated native-loop for Claude** (sustained loop + 90s long-poll tolerance),
so Gemini's §11.3 instinct holds better than my initial caution. Revised stance:
- **Native loop (Skill-Driven) is a viable primary for Claude** (and likely Gemini —
  *verify with the same spike*), paired with the **Attach Skill**.
- **Harness (Model B) for Codex** (one-shot) and as the universal fallback.
- **Before relying on native-loop in production, run a soak test** (dozens of cycles) for the
  two residual unknowns — **context accumulation** and **`--max-turns`** over a long-lived
  session — and design **session recycling** if/when the context window is the limit.
This is essentially Gemini's §11.3 split, now backed by evidence — with the soak test and
recycling as the explicit gate, and coexist-behind-a-flag (pushback B) still standing.

---

## 13. Attach Skill — scope: behavior in the skill, protocol in code (agreed 2026-06-18)

**Rule of thumb:** anything the system must *rely on* is deterministic → it lives in
code / transport / the MCP handshake. The **skill carries only behavior** (what the model
genuinely needs told). **Never let a protocol guarantee depend on the LLM remembering to do
it** — the model can forget, misreport, or burn tokens on it.

```
  TRANSPORT          (code)             → WS connect, keepalive ping/pong, reconnect
  PROTOCOL handshake (MCP `initialize`) → clientInfo: name/version/capabilities (client→server),
                                          tools/list (server→client) — deterministic
  CAPABILITY descriptor (data/config)   → per-provider verified facts:
                                          codex = persistent-only, idle ≤120s, no native loop;
                                          claude = native-loop ok, idle ≥90s verified; gemini = trust flag…
  BEHAVIOR           (the Attach Skill)  → loop: await_turn → do task → submit → repeat;
                                          how to interpret a task; "persistent → keep looping"
                                          vs "one-shot → single turn"
```

- **Keepalive** → transport layer (we already have server-side ping/pong); **not** the skill.
- **Capability *announcement*** ("I'm codex 0.133, persistent-only, idle X") → the **MCP
  `initialize`/clientInfo** set by the launcher/harness, **not** model-announced prose.
- **Capability *descriptor*** → it's the matrix in `mcp-cli-capability-assessment.md`
  (verified facts); encode it as **data/config** the orchestrator+launcher read to choose
  native-loop vs harness, idle budget, and session-recycle interval.
- **Behavior** → the only thing in the skill: the poll/execute/submit loop and how to act
  given the agent's mode. (The native-loop spike was effectively a prototype of this skill.)

MCP already provides `initialize`/`clientInfo`/`capabilities` (client→server) and
`tools/list` (server→client) — reuse them rather than reinvent a handshake in prose.

### Still unresolved (not addressed in §11)
- **Identity/registration handshake**: who mints `agentId`, how an inbound connection is
  bound to a UI-created agent.
- **State-machine remap**: ready/busy under a *pull* model (agent calls `await_turn`) vs
  today's push model.
- **Codex token accounting** (Phase-3 carry-forward) — still `tokens: 0` in MCP mode.
