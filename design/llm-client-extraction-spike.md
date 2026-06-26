# Spike — `@agenttalk/llm-client`: a standalone chat-with-LLM package (API + MCP plug)

**Status:** Phase 1 ✅ committed (`eae6321`, branch `llm-client-extraction-phase1`). Phase 2 core ✅ done
(uncommitted): `McpChatCompleter` + `ExecTransport` plug + tests — the concrete WebSocket/MCP adapter to
agentalk-mcp-client is the remaining owed piece (see §7). Gate at Phase 2: tsc 0, suite 239/239.
Originally scope-decided (Fausto, 2026-06-26). Decisions: **Q1** widen `complete()` with an optional `messages[]` (additive) · **Q2** build
**Phase 1 + 2** (API chat *and* the MCP plug) · **Q3** structured-output (T4 tool schema) **stays in runtime-core**
(llm-client stays consensus-free) · **Q4** name = `@agenttalk/llm-client`.
**Author:** Claude (planner/architect), 2026-06-26.
**Type:** architecture spike (extraction + new transport). Steps ahead of M10-T3 by Fausto's call —
T4 is already merged/pushed; this delivers immediate, tangible value (reusable LLM chat for third-party apps).

---

## 1. Why

Fausto wants AgentTalk to be the **single home for LLM interaction**, so other personal apps can get plain
*chat with an LLM* without importing the whole consensus/orchestration stack. Today the LLM-calling code lives
*inside* `@agenttalk/runtime-core`, entangled (by package, not by logic) with the consensus brain. Extract the
reusable core into a leaf package a third party can import on its own.

## 2. Goal & non-goals

**Goal.** A small package `@agenttalk/llm-client` exposing:
- the `Completer` **plug** (uniform `complete()` interface),
- `ApiCompleter` (direct provider HTTP),
- a thin **multi-turn chat** convenience layer,
- (Phase 2) `McpChatCompleter` — the same plug, backed by an **MCP client** (agentalk-mcp-client style),
  exec-only, **no consensus**.

**Non-goals (this spike).**
- ❌ Tool-calling / structured output (Fausto, caveat #4 — deferred; the `expectsStructured`/`buildProtocolToolSchema`
  branch stays in `runtime-core`).
- ❌ Pluggable provider keys — env-keyed is fine for now (Fausto, caveat #3 — personal use).
- ❌ Public npm publish / semver promise — internal monorepo package for now (caveat #2 acknowledged).
- ❌ Any change to the consensus brain (`team-coordinator.ts`), the wire-contract's consensus tools, or
  AgentTalk's existing behaviour. Pure additive extraction + new opt-in transport.

## 3. Current state (grounded 2026-06-26)

- **The plug already exists.** `packages/runtime-core/src/agents/completer.ts`:
  ```ts
  export interface Completer {
    maintainsSession?: boolean;
    complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult>; // -> { text, usage }
  }
  ```
  implemented by `ApiCompleter` (`maintainsSession=false`, calls `callApi`) and `McpCompleter`
  (`maintainsSession=true`, dispatches a turn to an attached MCP agent).
- **`api-client.ts` is zero-dep** — `callApi({provider, model, messages, response_format?, tools?, tool_choice?}, fetchFn?)`
  → `{text, usage}`. Providers google/openrouter/nous, env-keyed. Self-contained; uses global `fetch`.
- **`ApiCompleter`'s only consensus tie** is the `opts.expectsStructured` branch (imports `buildProtocolToolSchema`
  from `response-schema.ts`). Drop/guard that → pure.
- **`McpCompleter` is welded to orchestration:** `constructor(agent: Agent, registry: Registry)`, listens on
  `registry.on('exec_result'|'status')`, calls `agent.queueExecTurn`. It is an *orchestration adapter*, not a
  standalone transport — **cannot lift as-is.**
- **Migration footprint is tiny — only TWO src importers:**
  - `registry.ts:215–220` — picks `new ApiCompleter(...)` vs `new McpCompleter(agent, this)` by provider.
  - `agents/in-process-driver.ts:9,33` — imports `Completer`/`ApiCompleter`/`McpError`, constructs `ApiCompleter`.
- **MCP client (`agentalk-mcp-client`)** = a standalone relay (`llm-agent` bin) that `connect()`s to AgentTalk's
  MCP server, loops `await_turn` → runs the `exec_rpc` prompt through an executor (PTY-wrapped claude/codex/gemini)
  → `submit_exec_result`. The **exec subset** (`await_turn`/`exec_rpc`/`submit_exec_result`) is the chat-relevant
  part; the consensus tools (`submit_plan`, `send_to_agent`, `consensus_respond`) are NOT needed for chat.

## 4. Target architecture

```
@agenttalk/contracts            (zero-dep shared types — unchanged)
        ▲
@agenttalk/llm-client   ← NEW leaf package
   ├─ Completer (interface)      ← THE PLUG: complete(prompt, opts) -> { text, usage }
   ├─ CompleterResult / CompleterOptions
   ├─ api-client.ts  (callApi)   ← lifted verbatim from runtime-core/agents (zero-dep)
   ├─ ApiCompleter               ← lifted; structured-output branch removed (stays in runtime-core)
   ├─ ChatSession                ← NEW thin multi-turn wrapper over any Completer
   └─ McpChatCompleter (Phase 2) ← NEW registry-free exec-only transport (await_turn/exec_rpc/submit_exec_result)
        ▲
@agenttalk/runtime-core
   ├─ depends on llm-client (re-exports Completer/ApiCompleter for its callers)
   ├─ response-schema.ts + the structured-output ApiCompleter wrapper  ← STAYS (consensus-specific)
   └─ McpCompleter (Registry-coupled orchestration adapter)            ← STAYS (different concern)
        ▲
   apps/orchestrator, apps/web   (unchanged)
```

Dependency arrow points the right way already (`runtime-core` → `llm-client`, never the reverse).

## 5. The `Completer` plug + the two backings

`Completer` stays the single interface a caller programs against:
- **`ApiCompleter`** (Phase 1) — direct provider HTTP. Stateless (`maintainsSession=false`).
- **`McpChatCompleter`** (Phase 2) — delegates a turn to an attached MCP client; the external executor keeps its
  own conversation (`maintainsSession=true`). Speaks the **exec subset only**: open an attach endpoint / accept a
  client, push one `exec_rpc`, resolve on its `submit_exec_result`. **No teams, no consensus tools.**

The existing `maintainsSession` flag already encodes the key difference (stateless API replays history; a
session-keeping backend gets only the new turn) — the chat wrapper branches on it.

## 6. Multi-turn chat wrapper (caveat #1)

`callApi` already takes a `messages: [{role, content}]` array, but `Completer.complete(prompt: string)` is
single-shot. A `ChatSession` holds history and adapts per backend:
- stateless (`maintainsSession=false`): accumulate history, send it each turn;
- session-keeping (`maintainsSession=true`): send only the latest user prompt.

**OPEN DECISION (Q1):** does `ChatSession` flatten history into the single `prompt` string, or do we widen the
plug to `complete(messages | prompt, opts)`? Widening is cleaner for role-aware API chat but changes the
interface every caller shares. *Recommend:* add an optional `messages?` path to `CompleterOptions` (additive,
non-breaking) rather than flatten — keeps roles, doesn't break the string signature.

## 7. Phasing

- **Phase 1 (small, ships chat fast):** create `@agenttalk/llm-client`; lift `api-client.ts` + a pure
  `ApiCompleter` + `Completer` types; add `ChatSession`; re-point `runtime-core`'s two importers; runtime-core
  keeps a thin structured-output `ApiCompleter` wrapper (or passes the tool schema in). Gate green, behaviour
  identical. **The MCP plug is *defined* (interface) but not yet *implemented*.**
- **Phase 2 (the MCP plug):** build `McpChatCompleter` against the exec subset of the wire-contract — a
  registry-free turn driver. Reuses `wire-contract.json` (already a shared artifact) minus consensus tools.
  This is the bounded-new-work piece; the existing Registry-coupled `McpCompleter` is untouched.

  **DONE (2026-06-26).** Shipped `McpChatCompleter` (a `Completer`, `maintainsSession=true`) racing
  result/timeout/disconnect against an **injected `ExecTransport`** — the exec-subset contract
  (`dispatch(turn)` / `onResult` / `onDisconnect`), plus a typed `McpExecError`. Registry-free,
  consensus-free, unit-tested with a fake transport (7 tests). Mirrors runtime-core's proven McpCompleter
  race, decoupled from the engine.
  **HONEST SCOPE BOUNDARY (owed):** the **concrete WebSocket/MCP `ExecTransport` adapter** — the piece that
  actually hosts the `await_turn`/`submit_exec_result` attach endpoint an agentalk-mcp-client connects to —
  is **NOT shipped**. That machinery is large and currently spread across runtime-core's `Agent` turn-queue
  (`pendingExecTurns`/`awaitTurn`/`queueExecTurn`) + `mcp-tools.ts` + `apps/orchestrator/src/mcp-server.ts`,
  entangled with the multi-agent Registry. So `McpChatCompleter` is **usable today via any `ExecTransport`**
  (incl. a fake/in-process one), but a real end-to-end "chat through agentalk-mcp-client" needs that adapter
  written next — a separate, larger task. A natural first adapter: wrap an `Agent` + an emitter (it already
  exposes `queueExecTurn` and emits `exec_result`) — ~a handful of lines — which would also let runtime-core's
  `McpCompleter` be re-expressed over `ExecTransport` later (ties to the unify-emission tech-debt note).

## 8. Migration (Phase 1 mechanics)

1. New package `packages/llm-client` (`@agenttalk/llm-client`, tsconfig with no refs — leaf; or ref `contracts`
   only if it shares a type). Add to workspace + project references.
2. Move `api-client.ts` (verbatim) + the `Completer` types + a pure `ApiCompleter` into it.
3. `runtime-core/tsconfig.json` references → add `../llm-client`; `runtime-core` package.json deps → add it.
4. Re-point the 2 importers (`registry.ts`, `in-process-driver.ts`) to `@agenttalk/llm-client`. Keep the
   structured-output path in runtime-core (it imports `buildProtocolToolSchema` locally and either subclasses
   or wraps `ApiCompleter`, or passes `tools`/`tool_choice` through `CompleterOptions`).
5. `response-schema.ts` stays in runtime-core (consensus envelope).
6. Gate: `tsc -b` 0, full suite green (behaviour identical — this is a move, not a rewrite), no pollution.

## 9. Decisions (Fausto, 2026-06-26) — RESOLVED

- **Q1 → widen.** Add an optional `messages?: Array<{role, content}>` path to `CompleterOptions` (additive,
  non-breaking); `complete(prompt)` keeps working. Role-aware chat preferred over flattening.
- **Q2 → Phase 1 + 2.** Build both API chat *and* the registry-free `McpChatCompleter` MCP plug.
- **Q3 → stays in runtime-core.** The T4 tool-schema / structured-output path is NOT moved down; `llm-client`
  stays consensus-free.
- **Q4 → `@agenttalk/llm-client`.**

## 10. Risks & DoD

- **Risk:** Phase 1 is a low-risk *move* (only 2 importers; `ApiCompleter` already Registry-free). Main care:
  keep the structured-output branch working for the consensus path (don't regress T4). Covered by the existing
  suite (it exercises `ApiCompleter` + the T4 tool schema).
- **Risk (Phase 2):** the exec-subset transport must NOT re-import consensus; cross-repo contract drift with
  `agentalk-mcp-client` (mitigated by the shared `wire-contract.json` + the planned cross-repo contract check,
  memory `client-harness-is-ancillary`).
- **DoD (Phase 1):** `@agenttalk/llm-client` builds standalone; a third-party-style consumer can
  `import { ChatSession, ApiCompleter } from '@agenttalk/llm-client'` and chat with **zero** runtime-core /
  Registry / consensus in its dependency tree; AgentTalk's full suite stays green; behaviour identical.

## 11. Effort (rough)

- **Phase 1:** ~half a day — mostly mechanical (move + re-point 2 importers + chat wrapper + tests). Low risk.
- **Phase 2:** ~1–2 days — new registry-free exec transport + tests + a live smoke against agentalk-mcp-client.

## 12. Related

- `design/phase5-client-extraction-proposal.md` (client-harness extraction — adjacent concern).
- memory `client-harness-is-ancillary` (mcp-client is a pure relay; consensus stays in AgentTalk).
- `agentalk-mcp-client/wire-contract.json` (the shared wire shape; exec subset vs consensus tools).
