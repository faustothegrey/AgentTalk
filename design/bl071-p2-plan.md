# BL-071 P2 — Per-agent host environment (plan)

> **Status:** DRAFT for the plan-review gate. Planner: Claude (resource-fallback). Follows P1 (merged `0e594bc`).
> **Backlog:** BL-071 (P1 done; this is P2). **Cross-repo, contract-coupled — the hard half.**
> **Reuses:** the `HostEnvironment` type + `GET /api/environment` shipped in P1.

## 1. Goal

Each **agent** reports the host **it** runs on (its own self-observed `HostEnvironment`) to the orchestrator
on connect; the orchestrator **stores it on the agent record** and **surfaces it** via `GET /api/agents`.
Per-agent, no co-location assumed (an agent may run on a different host than the orchestrator).

## 2. The crux: a lockstep contract change (both repos ship together)

To be **hash-tracked** (the P1 gate's finding: only `{mcpTools, packetTypes, protocolPrefix}` is hashed, so
piggybacking on an existing message would be *silent wire drift*), the agent→orchestrator env report must be a
**new MCP tool** `report_environment`. Adding it to `mcpTools` bumps the wire contract, and
`verify-contract.js` **enforces both repos carry the identical `data` + `hash`** (it cross-reads the client's
`wire-contract.json`, lines 28/48-57). So **AgentTalk and `agentalk-mcp-client` MUST merge as one lockstep pair.**

**Pre-computed to de-risk (plan-review gate, ran the code):**
- version **7 → 8**
- new `mcpTools` = current 9 **+ `report_environment` appended at the end** (order kept identical to
  `AGENTTALK_MCP_TOOLS`, so both repos + the runtime tool list stay aligned)
- **v8 hash = `8df959312e33fa6bf53cd17c36a59f230882b1de86b138ae20d2dc8f9eee3a1a`**
  (= `sha256(JSON.stringify(data, null, 2))`; there is **no generator script** — it is written by hand into
  both `wire-contract.json` files, then `npm run test -w @agenttalk/contracts` verifies).

**Backward-compat note:** the tool is *additive*. An older client that never calls it simply reports no env —
but because the **hash changes**, an old client's v7 hash would be **rejected at connect** by
`expectedContractHash`. That is the intended lockstep: env-aware orchestrator ⇔ env-aware clients. (If we ever
want env-optional across a hash boundary, that's a bigger protocol-versioning decision — out of scope here.)

## 3. Scope — files I MAY touch

**AgentTalk repo (worktree `att-BL-071-p2`):**
- `packages/contracts/wire-contract.json` — v8, new hash, append tool name.
- `packages/runtime-core/src/registry/mcp-tools.ts` — add the `report_environment` tool definition (inputSchema
  = one object arg `environment: HostEnvironment`).
- `packages/runtime-core/src/registry/registry.ts` — add `case 'report_environment'` to `handleMcpToolCall`
  (model on `submit_usage_stats`, registry.ts:536): store `agent.host = args.environment`, emit an event, return ok.
- `packages/runtime-core/src/agents/agent.ts` — add `host?: HostEnvironment` field to class `Agent`.
- `apps/orchestrator/src/server.ts` — include `host: a.host` in the `GET /api/agents` mapping (read-only surface).
- Tests: registry handler unit (stores on agent) + `GET /api/agents` includes host + contract verify (v8).

**Client repo (`agentalk-mcp-client`, worktree — one symlink per the op-note):**
- `wire-contract.json` — v8, same new hash, same tool list (identical `data` to AgentTalk).
- `lib/environment.mjs` (new) — a small `captureHostEnvironment()` in plain `.mjs` (client can't import the
  runtime-core TS helper; it re-implements the same `os.*`/`process` snapshot → same 8-field shape).
- `llm-agent.mjs` — after the MCP client connects (around :240-250, before/at the `await_turn` loop), call
  `mcpClient.callTool('report_environment', { environment: captureHostEnvironment() })` **once**.
- Tests: `environment.mjs` unit (shape) + an `llm-agent`/exec-rpc-style test asserting the tool is called on connect.

## 4. Files I may NOT touch (guardrails)

- The engine coordination core (`team-coordinator.ts`, consensus, the turn loop) — no behaviour change.
- `await_turn`/`healthcheck`/relay/`submit_*` semantics — untouched; `report_environment` is purely additive.
- BL-072's "am I within AgentTalk" trust concern — **out of scope** (different task/decision).
- The PO's `.plist`, launchd svc.

## 5. Definition of Done (BOTH repos; lockstep)

1. `report_environment` handler stores the reported env on the agent record — registry unit test green.
2. `GET /api/agents` surfaces `host` for an agent that reported — server test green.
3. Client gathers its own env and calls `report_environment` **once on connect** — client test green.
4. **Contract lockstep:** both `wire-contract.json` = v8 + hash `8df9593…`; `verify-contract.js` green in the
   AgentTalk repo **with the client sibling present** (the cross-repo alignment check actually runs, not "skipped").
5. **LIVE cross-repo attach (the load-bearing E2E — see §7 decision):** a real client agent attaches to a real
   orchestrator (both v8), and its **actual host** appears via `GET /api/agents`. This is the P2 analogue of P1's
   live curl — it is what proves the client half, which no deterministic orchestrator-side test can.
6. `tsc -b` clean (AgentTalk); both suites green; no pollution; both worktrees cleaned at close.

## 6. Approach (once approved)

Order to keep each step verifiable:
1. **AgentTalk worktree first, deterministic:** add tool def + handler + `Agent.host` + `/api/agents` surface +
   the v8 contract; registry & server tests; `verify-contract.js` (will "skip sibling" until the client is also v8).
2. **Client worktree:** `environment.mjs` + `callTool` on connect + v8 contract; client tests.
3. **Cross-repo verify:** point AgentTalk's `verify-contract.js` at the v8 client file → the alignment check runs
   green (both hashes match). Then the **live attach** (§7).
4. Stop at **two branches** (`task-BL-071-p2` in each repo). Merge is PO-gated and **must be done as a pair**
   (merge+push both, or neither — a half-merged hash bump breaks every attach).

## 7. Open question for the gate / PO

- **Q1 — Live-verification depth (DoD #5).** The full E2E launches a real client against a real orchestrator.
  **Cheap variant (recommended):** the env report fires **on connect, before any LLM turn**, so I can launch
  `llm-agent.mjs` against a throwaway orchestrator, let it connect + report + block on `await_turn` (no LLM
  generation, no token burn), `curl /api/agents`, confirm the host, kill. This proves the client half without a
  paid model turn. **Confirm this is acceptable** (vs. a heavier full-turn run, vs. deterministic-only).
- **Q2 — Merge coupling.** Confirm you'll merge **both repos together** (the hash bump is only safe as a pair).
  Until both are on v8, no v7↔v8 attach succeeds — that's inherent to a contract bump, not a defect.
- **Q3 — Client env helper duplication.** The client re-implements the 8-field `os.*` snapshot in `.mjs` (no
  shared build). Acceptable (small, stable), or do you want the shape asserted against the contract some other way?

---
*Telemetry block to be filled at closure (per AGENT.md).*
