# Proposal: MCP-Based Agent Orchestration

**Status:** Refined / Decisions Documented (2026-06-18)
**Author:** Fausto (with Claude & Gemini)
**Date:** 2026-06-17 (Updated 2026-06-18)
**Related:** `design/agy-revised-protocol-spec.md`, existing `[AgentTalk]:` stdout protocol

> This proposal has been refined and aligned. Architectural decisions and the initial 
> approach are documented in Section 10.

---

## 1. Problem statement

AgentTalk launches each agent by launching a provider MCP (`claude`, `gemini`, `codex`)
as a child process and driving it over stdin/stdout. The orchestration "language"
between the Node runtime and the agent is a line protocol: the agent prints
`[AgentTalk]:REQ/EVT/RES:{json}` lines on stdout, and the wrapper
(`scripts/llm-agent.mjs`) plus `ProcessOutputParser` parse those lines back into
structured actions (see `Registry.startAgent` → `ProcessOutputParser`,
`packages/runtime-core/src/registry/registry.ts`).

This works, but has structural weaknesses:

1. **Brittle transport.** Agent "actions" are free-text stdout lines interleaved with
   model prose, ANSI noise, and MCP logging. We parse them with prefix matching and
   line splitting. Any deviation (the model forgets the prefix, wraps JSON, streams
   partial lines) is lost or mis-parsed. The structured-response retry loop in
   `llm-agent.mjs` exists largely to compensate for this fragility.

2. **No typed/validated action surface.** There is no schema enforced *at the
   boundary*. The model is asked (via prompt instructions) to emit well-formed
   protocol JSON; correctness is best-effort and validated after the fact.

3. **Two divergent execution paths.** "Persistent" executors and "one-shot" executors
   each re-implement transport and parsing. The Codex persistent path already speaks
   a *different* protocol from the rest — JSON-RPC 2.0 to `codex mcp-server` (see
   §3). The line protocol is not actually universal.

4. **Output scraping for side data.** Quota/usage is read by literally scripting the
   MCP UI (`scrapeClaudeUsageViaSlashCommand` drives `/usage` via `expect`). This is
   the same brittleness class as (1).

**Goal:** replace the stdout line protocol with a structured, typed, transport-robust
channel between the Node orchestrator and each agent — while reusing infrastructure the
MCPs already support.

---

## 2. Key observation: we already do this for Codex

`CodexPersistentExecutor` (`packages/runtime-core/src/agents/executor-runtime.ts:525`)
is, in effect, a hand-written **MCP client**:

- Node launchs `codex mcp-server`.
- Node sends JSON-RPC `initialize`, then `tools/call` with tool name `codex` /
  `codex-reply`.
- Node consumes `codex/event` notifications (streaming deltas, token counts).

So "Node communicates with a provider over MCP" is already a proven, working pattern
in the codebase — just for one provider, in one direction (MCP-as-server,
Node-as-client), bespoke per Codex's schema.

This proposal generalizes that idea and **inverts the common case**: instead of the
MCP being the MCP server, the **Node orchestrator becomes the MCP server** that all
agents connect to.

---

## 3. Background: MCP roles (for shared vocabulary)

- **Host** — the LLM application (the provider MCP). Embeds an MCP **client**.
- **Server** — a process exposing **tools**, **resources**, and **prompts**.
- The **model initiates** tool calls; the **server responds**. Communication is
  request/response, client → server.
- Server → host signalling is limited to: **tool results**, **resource-update
  notifications**, and **sampling** (server asks the host's model to generate).

**Transports:**
- **stdio** — server is a subprocess of whoever launchs it; single client. (This is how
  the Codex path works today; the MCP/Node owns the server as a child.)
- **Streamable HTTP** — server is a standalone endpoint; supports multiple concurrent
  clients and session IDs.

---

## 4. Proposed architecture (Topology A: Node as MCP server)

### Direction of the MCP relationship (the common confusion)

The single most important thing to get right: **AgentTalk is the MCP _server_; the
provider MCPs are MCP _clients_ that connect into it.** This inverts the usual setup —
and the old Codex path, where the MCP was the server and Node the client (see §2).

AgentTalk launchs each MCP and configures it — via a small stdio→WebSocket bridge
(`@fausto/mcp-orchestration`, see §11A) — to dial into AgentTalk's central MCP server.
The model running inside the MCP then **calls AgentTalk's tools** (`send_to_agent`,
`submit_plan`, …) instead of printing `[AgentTalk]:` lines on stdout.

```
        AgentTalk (Node)  ── IS the MCP SERVER ──┐
        tools: send_to_agent, submit_plan, ...   │
                  ▲          ▲          ▲         │
                  │  each MCP connects IN as an MCP CLIENT
                  │  (stdio → mcp-bridge → WebSocket)
            ┌─────┴───┐ ┌────┴────┐ ┌───┴─────┐
            │  codex  │ │ claude  │ │ gemini  │   ← MCP clients
            └─────────┘ └─────────┘ └─────────┘
```

So "with MCP support" means the MCPs can act as MCP **clients** (dial an external
server) — *not* that they expose servers we query. The detailed diagram below predates
the stdio-bridge/WebSocket decision; treat §11A as authoritative for transport.

```
                     ┌─────────────────────────────────────────┐
                     │            Node orchestrator             │
                     │                                          │
                     │   ┌───────────────────────────────┐      │
   web UI  ◀────────▶│   │   AgentTalk MCP server (HTTP)  │      │
 (observability)     │   │  tools: send_to_agent,        │      │
                     │   │  submit_plan, agreement_*,    │      │
                     │   │  submit_work_response, ...    │      │
                     │   └───────────────┬───────────────┘      │
                     └───────────────────┼──────────────────────┘
                                         │  Streamable HTTP (per-agent session id)
            ┌────────────────────────────┼────────────────────────────┐
            │                            │                            │
     ┌──────▼──────┐              ┌──────▼──────┐              ┌──────▼──────┐
     │  claude MCP │              │  gemini MCP │              │  codex MCP  │
     │ (MCP client)│              │ (MCP client)│              │ (MCP client)│
     └─────────────┘              └─────────────┘              └─────────────┘
```

- **Node hosts a single MCP server** over **Streamable HTTP** (a long-lived endpoint
  owned by the orchestrator process, independent of any one MCP's lifecycle).
- **Each launched MCP is configured to connect to it** via the provider's own MCP
  config (no patching of the MCP — just config + launch):
  - Claude Code: `.mcp.json` / `claude mcp add`
  - Gemini MCP: `settings.json` → `mcpServers`
  - Codex: `config.toml` → `[mcp_servers]`
- **Agent protocol actions become MCP tools.** The model no longer prints
  `[AgentTalk]:REQ:{call:"send_to_agent",...}`; it **calls a typed tool**
  `send_to_agent(to, payload, ...)` whose handler runs inside Node. Same for
  `submit_plan`, `agreement_proposal`, `agreement_acceptance`, `submit_work_response`,
  etc. (full list to be derived from current `dispatchStructuredResponse` in
  `scripts/llm-agent.mjs`).
- **Multi-agent routing**: disambiguate which agent is calling via the MCP **session
  id** of the HTTP connection (or, if simpler, run one server instance/port per agent).

### Communication directions
- **Agent → Node:** native tool calls (typed, validated by the tool's input schema).
  This is the structured replacement for stdout scraping.
- **Node → Agent:** the tool *result* returned to the model (carries the next
  instruction / peer message / rejection reason), plus optional resource-update
  notifications. We do **not** get arbitrary mid-turn interruption — see §5.

---

## 5. Known limitations / non-goals

- **Model-initiated only.** Node responds to tool calls; it cannot freely "push" a new
  message into the middle of a model turn. Server→model influence is via tool results,
  resource notifications, and sampling. The existing per-turn loop
  (prompt in → reply out, with replayed history) largely stays; MCP upgrades the
  **action/tool channel**, not the turn mechanics.
- **Per-provider MCP support varies.** All three support custom MCP servers, but
  capabilities (sampling, resource subscriptions, HTTP vs stdio) differ
  and must be verified per MCP version.
- **Not a pub/sub bus.** (Rejected Topology B: a standalone MCP server with both the
  MCP and Node as clients. MCP is request/response client→server, not a message bus
  between two clients; coordinating model + Node through it is awkward and only worth
  it for genuinely third-party tools.)

---

## 6. Migration considerations

- **Incremental path.** Keep the `[AgentTalk]:` stdout protocol working; introduce the
  MCP server behind a flag/execution-mode and migrate provider-by-provider (Codex is a
  natural first target since it already speaks JSON-RPC). Preserve existing behavior by
  default per project milestone rules.
- **Tool schema = single source of truth.** Define the agent action tools once (likely
  in `@agenttalk/contracts`) and reuse the schemas for both validation and the MCP
  tool definitions, replacing prompt-embedded `STRUCTURED_RESPONSE_INSTRUCTIONS`.
- **Observability.** Tool calls are natural, structured telemetry events — likely
  cleaner than parsing transcripts. Consider how this maps onto current recordings.

---

## 7. Open questions (to resolve on refinement)

1. **Server granularity:** one shared HTTP MCP server with per-agent sessions, vs. one
   server instance per agent. Trade-offs: routing simplicity vs. process/port count.
2. **Action surface:** exact tool set + input schemas, derived from today's
   `dispatchStructuredResponse` / protocol calls. Which control calls
   (`agreement_proposal`, `ack_planning_protocol`, …) become tools vs. stay as events?
3. **Turn loop:** does a tool result fully replace the "message_received → reply"
   event flow, or do both coexist during migration?
4. **Provider capability matrix:** confirm per-MCP support for Streamable HTTP,
   sampling, and resource subscriptions.
5. **Failure semantics:** how a timed-out or failed tool call maps onto the existing
   agent `error` state and the Milestone-03 failure-propagation behavior.

---

## 8. Summary

Generalize the existing Codex-over-MCP pattern into a first-class architecture where
the **Node orchestrator is the MCP server** and agents connect to it over Streamable
HTTP. Agent actions become **typed MCP tool calls**, replacing brittle stdout
line-scraping. This is an orchestration/robustness improvement.

---

## 9. Packaging & distribution (decision + TODO)

**Decision:** the MCP orchestration layer ships as a **standalone repository**, not as
an in-repo workspace package. AgentTalk consumes it as a **Git dependency** (no npm
registry, no Verdaccio, no `npm link` in the committed setup).

**Rationale:**
- Keeps the orchestration layer reusable beyond AgentTalk.
- Forces a clean, one-way dependency boundary (AgentTalk → mcp lib).
- Avoids coupling an external package to the unpublished in-repo
  `@agenttalk/contracts`.

**Design constraint (important):** the external package must be **provider/protocol
agnostic** — a generic "Node-as-MCP-server orchestration" library that knows nothing
about AgentTalk's protocol. AgentTalk **injects its tool schemas / handlers at
runtime**. This is what keeps the dependency one-way; otherwise we'd also have to
externalize or publish `@agenttalk/contracts`.

### TODO

- [ ] **Create the standalone repo** (e.g. `@fausto/mcp-orchestration`).
- [ ] **Make it installable from Git** — `package.json` with `type: module`,
      `exports` → `./dist/*.js`, `types`, `files: ["dist"]`, and a **`prepare`**
      script that runs `tsc -b` on install (git installs clone *source*, not `dist`,
      so without `prepare` or a committed `dist` the consumer gets no build). This is
      the #1 pitfall to verify.
- [ ] **Design the generic injection API** so AgentTalk passes in its tool
      definitions/handlers; the lib stays AgentTalk-agnostic.
- [ ] **Consume it from AgentTalk** via a **pinned** Git ref (tag or commit SHA, never
      a bare branch) in AgentTalk's `package.json` dependencies. Decide public vs
      private repo (private ⇒ SSH deploy key / PAT for CI).
- [ ] **Document the local dev loop** across the two repos (`npm link` or a temporary
      `file:` / npm `overrides`), with a note to revert to the pinned Git ref before
      committing.
- [ ] **Detach from this monorepo** — once external, remove any placeholder from root
      `package.json` `"workspaces"` and from root `tsconfig.json` `references`. It is
      then consumed as a built `node_modules` dependency (no cross-boundary
      `tsc -b` incremental builds — expected).
- [ ] **Resolve shared types** — confirm the lib needs *no* `@agenttalk/contracts`
      import; if it turns out it does, decide whether to externalize/publish contracts
      too (separate workstream).

> Note: a scaffold of the standalone repo (package.json with `prepare`, tsconfig,
> `src/` stub, README) was discussed but **not yet created** — it's the first
> actionable item when this work resumes.

---

## 10. Decisions & Refined Technical Approach (2026-06-18)

Following alignment on the pre-implementation caveats, the following concrete architectural decisions, mitigations, and execution approaches have been adopted:

### A. Transport Topology: Stdio-Bridge-for-All (Unified Server)
- **Decision:** **Stdio-Bridge-for-All**. Node will host a single, multi-tenant **WebSocket (WS)** server. Every launched MCP is configured to communicate exclusively via its native, verified **stdio** channel.
- **Bridge Relay:**
  - The orchestrator configures each launched MCP to run a lightweight `mcp-bridge.js` wrapper as its subprocess.
  - The bridge translates the MCP's stdio JSON-RPC stream directly over a local WebSocket connection back to the central server:
    `"command": "node", "args": ["path/to/mcp-bridge.js", "ws://localhost:<port>/?agentId=<agent_uuid>"]`
  - This eliminates direct MCP HTTP/WS client configuration issues (such as Codex's broken HTTP client initialization or Claude's HTTP-timeout regressions) from our critical path.
  - The server reads the `agentId` query parameter during the WS handshake to isolate the session context.

### B. Migration Strategy: Flagged Incremental Cutover
- **Decision:** **Flag-Gated Incremental Rollout** (supersedes the "Hard Switch" proposal). To preserve existing behavior by default per project milestone rules, the MCP transport will be rolled out provider-by-provider.
- **Rollout Mechanism:**
  - Gated behind a flag (e.g. `persistent_mcp` execution mode).
  - Codex will be the first cutover target due to its existing JSON-RPC structure.
  - The legacy stdout line protocol (`[AgentTalk]:`) remains active for un-migrated providers.

### C. Operational Mitigations
1. **Gemini Workspace Trust:** The launch environment configuration for Gemini **must** include `GEMINI_CLI_TRUST_WORKSPACE=true` or pass the `--skip-trust` MCP flag. Otherwise, Gemini silently overrides YOLO mode and disables MCP servers in untrusted directories.
2. **Non-Racy Configuration Cleanup:** Write temporary configurations to unique paths (e.g., `.mcp.<agentId>.json`) and clean them up on process **exit** hooks rather than immediately after launch, preventing races if a MCP lazy-loads tools.
3. **Bridge Failure Propagation:** The lifecycle of `mcp-bridge.js` is tied to the executor. If the bridge process exits or crashes, the executor immediately transitions the agent state to `error`, triggering the Milestone-03 failure-propagation protocol to prevent team deadlocks.

### D. Turn-Loop & Concurrency Semantics
1. **Turn-Loop Semantics:**
   - **Query Tools:** Standard resource/workspace queries execute via standard MCP tool call-and-response loops. The model continues generation.
   - **Orchestration Tools (`send_to_agent`, `submit_plan`):** These act as the terminal action of an agent's turn. The server tool handler immediately returns a success response: `{ content: [{ type: "text", text: "Action sent successfully" }] }`. The orchestrator completes the active agent turn execution and advances to the next step/agent in the consensus workflow.
2. **Multi-Agent Concurrency:** All tool handlers execute asynchronously using Node `Promise` microtasks. Because the scope is simplified to exclude human-in-the-loop blocking, tool calls will resolve quickly, natively multiplexed by Node's event loop without blocking concurrent sessions.

### E. Session Isolation & Test-Contract Plan
1. **Session Isolation Contract:**
   - Active WebSocket connections are mapped in-memory by `agentId` (UUID).
   - In-flight JSON-RPC requests are scoped directly to the client's WebSocket connection, preventing request/response ID collision across concurrent agents.
2. **Test-Contract Plan:**
   - Domain logic and consensus state-machine tests will be refactored to mock the `Executor` interface, making them transport-agnostic.
   - Integration tests asserting the stdout protocol will coexist in the codebase and only be retired when the legacy transport is deprecated.

### F. Verification Plan: Gating Routing Spike
Prior to committing to package extraction, we will execute a targeted spike to verify the bridge and session routing mechanism:
- Build a mock WebSocket orchestrator server.
- Write a basic `mcp-bridge.js` mapping stdin/stdout to the WebSocket connection.
- Launch Codex/Claude pointing to the bridge and verify that:
  1. The JSON-RPC handshake completes and tools are discovered.
  2. A 180s blocking tool call resolves correctly over the bridge.
  3. Two concurrent sessions connect and run overlapping calls without cross-talk or collision.


