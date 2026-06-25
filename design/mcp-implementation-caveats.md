# MCP Orchestration — Caveats & Open Issues to Resolve Before Implementing

**Status:** Discussion agenda — updated after the §10 revision (2026-06-18)
**Author:** Claude (at Fausto's request)
**Date:** 2026-06-18
**Related:** `design/mcp-orchestration-proposal.md`, `design/mcp-capability-assessment.md`

> **Readiness verdict is in the next section.** The numbered caveats (§1–§8) are the
> original record; each now carries a **RESOLVED / OPEN** tag reflecting the §10 revision.

> Purpose: collect **every** caveat raised while reviewing the proposal, the capability
> spike, and the other agent's §10 revision — so they can be discussed and settled
> *before* any code is written. Each item is tagged:
> **[BLOCK]** must be decided before implementation · **[RESOLVE]** decide early, not a
> hard gate · **[NOTE]** awareness / hygiene.
>
> Auth-tier (subscription vs API) is intentionally **out of scope** — parked
> by the user for later. It is listed under §6 only so the parking is explicit.

---

## What we have actually established (grounding)

So the discussion starts from facts, not assumptions:

- **stdio MCP works on all three MCPs** (Claude 2.1.181, Codex 0.133.0, Gemini 0.41.2).
  Verified twice (other agent's spike + my independent reproduction): each connected to
  a custom stdio MCP server and completed a **70s** blocking tool call, returning the
  result verbatim — **at default timeout config** (no `tool_timeout_sec` /
  `MCP_TOOL_TIMEOUT` / `timeout` set).
- **Codex already speaks MCP JSON-RPC over stdio today** (`CodexPersistentExecutor`),
  with Node as the client.
- **Gemini needs workspace trust** (`GEMINI_CLI_TRUST_WORKSPACE=true` / `--skip-trust`)
  or it silently disables YOLO + MCP servers in untrusted dirs.

What we have **not** established: anything over HTTP/SSE/WS, the central server, the
bridge, session routing/isolation, multi-agent concurrency, or multi-minute blocks.

---

## Readiness verdict (2026-06-18)

**Yes — we are ready to *plan* implementation, and ready to *start coding the gating
spike now.*** Every [BLOCK] caveat has a coherent design answer in the §10 revision, and
the chosen shape (stdio-bridge-for-all + flag-gated incremental rollout + a gating spike
that tests the two things we never verified) is sound and matches a step-by-step,
smoke-tested rollout.

Two qualifications:

- **The gating spike (§10F) is self-contained and carries no production risk** — a mock
  WS server, a basic `mcp-bridge.js`, and launching Codex/Claude against it. Nothing in
  the real executor path changes. This is the correct first step and can begin immediately.
- **One decision gates the step *after* the spike** (wiring MCP into the real executor):
  the **turn-lifecycle + feedback-path** question (Residuals R1/R2 below). It does not
  block the spike — in fact the spike will inform it — but it must be settled before MCP
  touches the consensus loop. Everything else is defense-in-depth or cleanup.

So: **plan it, start with Phase 0 (the spike), and treat the turn-lifecycle decision as
the gate between the spike and real integration.** Suggested phasing:

| Phase | Work | Smoke checkpoint |
|---|---|---|
| **0** | §10F gating spike: mock WS server + `mcp-bridge.js`, Codex+Claude | handshake/discovery; 70s+ block over WS; 2 sessions, no cross-talk |
| **1** | Decide R1/R2 (turn end + feedback path); update §4 to match §10D.1 | design sign-off (no code) |
| **2** | Real central WS MCP server in-repo behind `persistent_mcp` flag; tool schemas in `@agenttalk/contracts` | `scripts/smoke-llm-agent.mjs` turn completes for one provider |
| **3** | Codex cutover behind flag (legacy stays default) | per-provider smoke; legacy path unchanged |
| **4** | Gemini (with trust env) + Claude cutover | per-provider smoke each |
| **5** | Pin per-provider timeouts; telemetry mapping; refactor tests to mock `Executor` | full suite green; contract tests intact |
| **6** | Package extraction (only after all green) | consumer build via `prepare` verified |

---

## Resolution status after the §10 revision

| Caveat | Status | Where / note |
|---|---|---|
| 1.1 / 1.2 WS ambiguity, direct-client support | ✅ RESOLVED | §10A — stdio-bridge-for-all |
| 1.3 long block through bridge | ✅ RESOLVED (as spike check) | §10F.2 |
| 1.4 full-duplex rationale | ✅ MOOT | justification dropped |
| 2.1 hard switch vs milestone rule | ✅ RESOLVED | §10B — flagged incremental |
| 2.2 turn-loop semantics | 🟡 PARTIAL | §10D.1 answers the concept; mechanics open → **R1** |
| 3.1 session isolation | 🟡 PARTIAL | §10E.1; reconnection/rebind open → **R3** |
| 3.2 multi-agent concurrency | ✅ RESOLVED | §10D.2 + §10F.3 (reasoning nit → **R4**) |
| 3.3 bridge failure modes | ✅ RESOLVED | §10C.3 (crash→error); framing/backpressure are impl detail |
| 4.1 Codex keep vs invert | ✅ RESOLVED | §10B — Codex is first cutover; legacy is the path it replaces |
| 4.2 per-provider timeouts | 🟡 OPEN (raised priority) | Phase-1 spike found Codex hard-caps tool calls at **120 s**; `tool_timeout_sec` must be raised for >120 s blocks → **R5 is now required for Codex**, pinned in Phase 3 |
| 4.3 Gemini trust side effects | ✅ RESOLVED | §10C.1 |
| 5.1 test-contract meaning | ✅ RESOLVED | §10E.2 — mock `Executor`, keep stdout tests until retire |
| 5.2 telemetry mapping | 🟡 OPEN | deferred to Phase 5 |
| 7.1 packaging premature | ✅ RESOLVED | §10F precedes extraction |

---

## Residual open items (turn lifecycle — settle before Phase 2)

**R1 [BLOCK-before-integration] Turn-termination mechanics.** §10D.1 says an orchestration
tool is the "terminal action" and the orchestrator "advances" — but the model doesn't stop
generating just because a tool returned success. Define: does the **first** orchestration
call end the turn? What happens to further model output / tool calls after it (dropped?
error?)? Is the MCP process killed or left idle until the next prompt?

**R2 [BLOCK-before-integration] §4 contradicts §10D.1 — and the plan-rejection path.** §4
says the tool result carries "the next instruction / peer message / **rejection reason**";
§10D.1 returns only `"Action sent successfully"` (fire-and-forget), so feedback must arrive
as the *next prompt*. Today `llm-agent.mjs` rejects a non-concrete `submit_plan` and the
model revises **off the tool result, in the same loop**. Under fire-and-forget that tight
retry loop is lost unless rejection is re-injected as a new turn. Pick one model, fix §4,
and define how plan-rejection feedback returns to the model.

**R3 [RESOLVE] Reconnection / rebind.** A dropped bridge reconnecting just re-sends its
`agentId` in the WS URL. State the rule: reject a second live connection for the same
`agentId` (no hijack), and define reconnect semantics.

**R4 [NOTE] Concurrency reasoning (cosmetic).** Safety comes from handlers not blocking the
event loop, not "calls resolve quickly because no HITL." Conclusion is right; don't lean on
"quick."

**R5 [NOTE] Pin per-provider tool timeouts** as defense-in-depth even with fast handlers
(Codex `tool_timeout_sec`, Gemini per-server `timeout`, Claude `MCP_TOOL_TIMEOUT`).

---

## 1. Transport & topology

### 1.1 [BLOCK] Resolve the WebSockets ambiguity → commit to "stdio-bridge-for-all"
§10A is internally inconsistent. It says both "WebSockets preferred over HTTP/SSE …
falling back to HTTP/SSE" (implying **MCPs connect directly** over WS) *and*
"Stdio-Everywhere Adapter Bridge" (implying **MCPs speak stdio** to a local bridge that
speaks WS to the server). These are different architectures; only the second is sound.

- **Decision needed:** do MCPs connect to the central server directly (over WS/HTTP), or
  does every MCP speak stdio to a local `mcp-bridge.js` that relays to the central
  server?
- **Recommendation:** stdio→bridge→(WS/HTTP) for **all** providers, not just Codex. Then
  no MCP's network-MCP-client support is ever on the critical path, and the bridge↔server
  hop is the orchestrator's own provider-agnostic code (transport is then a free choice).

### 1.2 [BLOCK] Direct network MCP-client support is shaky across all three
This is *why* 1.1 should land on the bridge. Evidence:
- **Codex:** HTTP `url` exists but initialization is **broken in practice**
  (openai/codex #11284); no WS. Works great over **stdio**.
- **Gemini:** supports `httpUrl` (HTTP) / `url` (SSE) / `command` (stdio); **no WS**;
  open HTTP-connect bug (#5268).
- **Claude Code:** supports `http`/`sse`/`ws`, but `ws` is **config-file only** (not via
  `claude mcp add --transport`); also an HTTP timeout-config regression (#20335/#3033).

So "WS preferred, direct" fails for Gemini and Codex outright. The bridge makes all of
this irrelevant because each MCP only ever needs **stdio**, which is verified working.

### 1.3 [RESOLVE] Long-block survival *through the bridge* (WS idle timeouts)
Our 70s blocks were over **raw stdio**. A WS hop adds idle ping/pong timeouts that plain
stdio doesn't have. A handler that blocks while Node does real work (peer turn, slow I/O)
could be killed at the WS layer even though raw stdio tolerated it.
- **Action:** add a 70s+ (ideally multi-minute) block *routed through the bridge over WS*
  to the gating spike (§10D), with keep-alive ping/pong configured.

### 1.4 [NOTE] The "full-duplex" rationale for WS is off
MCP is request/response (client→server); the server cannot push arbitrary messages
mid-turn (the §5 limitation). So "full-duplex simplicity" isn't the real benefit. WS is
fine for the bridge hop, but the stated justification doesn't hold up. Not load-bearing.

---

## 2. Migration strategy

### 2.1 [BLOCK] "Hard switch" vs the milestone rule and the incremental path
`CLAUDE.md` requires preserving existing behavior by default; §6 ("Migration") describes
a flagged, provider-by-provider incremental path; §10B mandates a **hard switch**. These
conflict.
- **Risk:** "behavior contract tests stay green" doesn't protect us if those tests assert
  the *stdout protocol itself* — a transport swap may invalidate the contract, not just
  pass it (see 5.1).
- **Decision needed:** hard switch, or flag-gated incremental cutover (Codex first)? My
  recommendation remains the flagged path — it's the one compatible with the milestone
  rules and lets us roll back per provider.

### 2.2 [BLOCK] Turn-loop semantics — the biggest unresolved design question (open #3)
Today the model's **reply is the action** (one structured action per turn). MCP tools are
called *mid-turn*, possibly several times. So: is `submit_plan` / `send_to_agent` a **tool
the model calls**, or the **conclusion of a turn**?
- `run_*`-style tools fit MCP naturally; `submit_plan` / `send_to_agent` are turn
  *outputs* and fit awkwardly.
- **Decision needed:** does a tool result fully replace the `message_received → reply`
  event flow, or do both coexist during migration? This shapes the entire handler design
  and must be settled before coding.

---

## 3. Central server, routing & concurrency

### 3.1 [BLOCK] Session isolation is unverified — enumerate what it must guarantee
§10A maps sessions via an `agentId` query param on the WS handshake. The gating spike
(§10D) covers this — good — but "isolation" needs an explicit contract:
- An agent's tool calls/results never leak to another agent's session.
- Tool definitions can be scoped per agent if needed.
- Concurrent sessions don't interleave request/response IDs.
- A dropped/reconnected bridge re-binds to the correct `agentId` (and can't hijack
  another).

### 3.2 [BLOCK] Multi-agent concurrency on a single Node server
Node is single-threaded. With one central server and N agents, a tool handler that
**blocks** (awaits peer turn, I/O) must not stall other agents' handlers.
- **Action:** confirm all handlers are fully async/non-blocking of the event loop; define
  what happens when many agents have in-flight long calls simultaneously. Add a
  concurrency case to the gating spike (≥2 agents, overlapping in-flight calls).

### 3.3 [RESOLVE] Bridge is a new component with its own failure modes
`mcp-bridge.js` is a process per agent. Define: crash/exit propagation (bridge dies →
agent should enter `error`, per Milestone-03 failure propagation), backpressure, partial
JSON-RPC framing across the stdio↔WS boundary, and startup ordering (server up before
bridge connects).

---

## 4. Provider-specific

### 4.1 [RESOLVE] Codex: keep existing stdio JSON-RPC path, or invert to client-via-bridge?
Today Codex **is** the MCP server and Node is the client. The proposal inverts this
(Node = server, Codex = client via bridge). Both can't be live at once for Codex.
- **Decision needed:** does Codex move to the bridge like everyone else, or keep its
  current working path during migration? (Affects whether "Codex first" is actually the
  easiest target.)

### 4.2 [RESOLVE] Per-provider tool timeouts must be set explicitly
Defaults differ by an order of magnitude (Claude ~28h, Gemini 10min, Codex docs say 60s
though 70s passed). Pin them deliberately: raise Codex `tool_timeout_sec`, set Gemini
per-server `timeout`, pin Claude `MCP_TOOL_TIMEOUT`. **Multi-minute blocks remain
unproven** (we only tested 70s).

### 4.3 [NOTE] Gemini workspace trust captured — verify no side effects
§10C correctly requires `GEMINI_CLI_TRUST_WORKSPACE=true`/`--skip-trust`. Confirm enabling
trust doesn't also enable behaviors we don't want in launched agents.

---

## 5. Tests & observability

### 5.1 [BLOCK] What does "contract tests stay green" mean under a transport swap?
The existing tests encode the `[AgentTalk]:` stdout protocol as the behavior contract. If
we hard-switch transport, some of those contracts may no longer describe reality.
- **Decision needed:** which tests are transport-agnostic behavior contracts (keep), and
  which assert the stdout protocol specifically (must be rewritten as MCP contracts, with
  explicit user sign-off per the milestone rule about treating tests as contracts)?

### 5.2 [RESOLVE] Tool calls as telemetry — map onto current recordings
Tool calls are cleaner structured events than parsed transcripts, but the proposal doesn't
say how they map onto existing observability/recordings. Define before cutover so we don't
lose current telemetry.

---

## 6. Explicitly parked (out of scope, by user decision)

- **Auth tier (subscription vs API) & usage scraping.** Removed from the docs at user
  request; not part of this effort.

---

## 7. Packaging (do last, not first)

### 7.1 [RESOLVE] Standalone-repo extraction is premature before the spike
§9 commits to extracting a provider-agnostic `@fausto/mcp-orchestration` git dependency.
Designing the generic injection API before the bridge/routing spike means speculating
about a seam we haven't validated.
- **Recommendation:** prove it in-repo behind the spike first; extract once the seam is
  empirically known. The gating action in §10D already implies this ordering — make it
  explicit that packaging follows the spike.

### 7.2 [NOTE] The git-dependency `prepare` pitfall
If/when extracted: git installs clone *source*, not `dist`, so a `prepare` script (or a
committed `dist`) is mandatory or consumers get no build. Pin by tag/SHA, never a bare
branch.

---

## 8. Doc consistency follow-up

### 8.1 [NOTE] Capability assessment's sub-requirement (a) becomes moot under bridge-for-all
`mcp-capability-assessment.md` still frames "can each MCP be an HTTP/SSE client?" as a
core requirement. If 1.1 lands on stdio-bridge-for-all, that question no longer gates
anything (only stdio matters). Add a follow-up note there once 1.1 is decided.

---

## Suggested decision order

1. **1.1 / 1.2** — transport: bridge-for-all? (unblocks most else)
2. **2.2** — turn-loop semantics (shapes handler design)
3. **2.1** — hard switch vs flagged incremental
4. **3.1 / 3.2** — isolation contract + concurrency model
5. Run the **§10D gating spike** with 1.3 (long block over WS) and 3.2 (concurrency) added
6. **5.1** — test-contract plan
7. Packaging (7.1) only after the spike passes
