---
audience: claude
key: 20260626-1456-abb85a40
written: 2026-06-26 by Claude (llm-client extraction Phase 1+2 + mcp-exec-server DONE; merging to master)
---

This is your session primer.

**0. Key-gated cold-start contract.** Valid **only if its `key` (above) matches the `active` key in your private
key store** (`session-primer-key.json` beside your `memory/`). Match → **gather context only**: read the artifacts
below, verify these claims against ground truth (git, the ledgers), report your understanding, make **no changes**
until Fausto says go. The one write you may make now is **consuming the key** (`active`→`consumed`). **Also at turn 1:**
poll runway with `node scripts/usage.mjs` (best-effort, never blocking — the `claude` block often returns `ok:false`).
Don't trust this primer blindly — verify; surface anything off.

**1. What it is.** AgentTalk = an orchestrator coordinating multiple AI agents (in-process **API**-path providers +
externally-launched **MCP**-attached agents) collaborating over MCP through a multi-agent **consensus protocol**
(planners debate → submit a plan → a worker executes). Monorepo: `packages/*` + `apps/{orchestrator,web}`. Semantic
logic is server-side in the "brain" (`packages/runtime-core/src/registry/team-coordinator.ts`).

**2. Roles.** You are **Claude = planner / reviewer / architect — and currently also implementer** (Gemini, the normal
implementer, is **out of weekly budget**). Per **LB-14**: you implement, run `tsc -b` + full suite, self-review the
diff, report actual output — but **merge/closure is HUMAN-GATED** (Fausto). **Re-read AGENT.md → Implementer Rules of
Engagement before any code.** Fausto = human (scope, decisions, relay).

**3. Workflow / source of truth.** `design/collaboration-workflow.md`. Artifacts: `*-plan.md` (spec+DoD),
`*-implementation.md` (the **ledger**), `design/backlog.md`, `design/logbook.md` (LB-N), `design/implementer-pitfalls.md`
(IP-N). `AGENT.md` is canonical (`CLAUDE.md`/`AGENTS.md` are symlinks).

**4. EXACTLY where we are.** Two threads are live; **most recent work = a NEW initiative, the `llm-client` extraction**
(NOT an M10 task — Fausto's call to step ahead of M10-T3 for immediate value).
- **THIS SESSION (2026-06-26) — `@agenttalk/llm-client` + `@agenttalk/mcp-transport` + `@agenttalk/mcp-exec-server` —
  ✅ DONE, being merged to `master` + pushed.** Goal: let third-party apps **chat with an LLM** without importing the
  consensus stack. Delivered:
  - **Phase 1** (committed `eae6321`): extracted the LLM core into zero-dep **`@agenttalk/llm-client`** —
    `Completer` plug + `ApiCompleter` (structured-output tool **injected**, so the package is consensus-agnostic) +
    `ChatSession` (multi-turn, role-aware `messages[]`). `api-client.ts` `git mv`'d out of runtime-core; runtime-core
    rewired to import it + inject `buildProtocolToolSchema`. **T4 wire contract byte-identical.**
  - **Phase 2-core** (committed `877577c`): **`McpChatCompleter`** + the injected **`ExecTransport`** plug +
    `McpExecError` — a registry-free turn driver. Plus `design/llm-client-architecture.md` (full diagrams; read it).
  - **Phase 2 / Option B** (this branch `mcp-exec-server`, **about to be committed+merged+pushed**): the
    consensus-free "chat via an MCP CLI executor" path. `McpServer` `git mv`'d out of `apps/orchestrator` into a new
    pure-`ws` leaf **`@agenttalk/mcp-transport`** (it was already generic — all consensus is in the *injected* tools/
    handler; orchestrator only changed its import path, 1 line). New **`@agenttalk/mcp-exec-server`** injects the exec
    subset (`await_turn`+`submit_exec_result`) backed by a minimal single-flight `ExecTurnQueue`, exposing
    `McpExecServer.transport(agentId)` for `McpChatCompleter`. **End-to-end test over a REAL WebSocket passes.**
  - **Gate at handoff: tsc 0, suite 245/245.** Decisions: D1 extract McpServer · D3 minimal single-flight queue (no
    M08 reconnect) · D4 contract-hash unset for v1. Plans: `design/llm-client-extraction-spike.md` +
    `design/mcp-exec-server-plan.md`. Full record: **logbook LB-27** (+ LB earlier for bridge v3 = LB-26).
  - **⚠️ OWED (honest gap):** NO live smoke vs a real `agentalk-mcp-client` CLI executor — the e2e test uses an
    in-test echo executor (real socket + real wire protocol, strong evidence, but not the real CLI). Parked, same
    posture as the other transport live-smokes (gated on a provider/CLI being available).
- **M10 status (the prior epic — graded protocol brain + DiagramTalk viz):** **T1/T2/T4 all MERGED + pushed** on
  `master`. **DiagramTalk bridge v1/v2/v3 all merged** (v3 = endorse stop + eject/correction overlay, LB-26). The
  remaining M10 item is **T3** — single-tool `consensus_respond` (wire-contract v5→v6, lockstep with the
  `agentalk-mcp-client` repo; higher risk) — **deferred (D3)**.
- **⏭️ NEXT CANDIDATES (none committed-to; Fausto picks):** the **owed live CLI smoke** for mcp-exec-server · **M10-T3**
  (deferred, cross-repo) · **gemini live gate** (`node scripts/test-mcp-gate.mjs gemini`, parked — gemini out of
  weekly budget) · backlog tech-debt **"unify protocol state-change event emission"** (`onPhaseChange` vs
  `onProtocolEvent`) + the **`McpCompleter`→`ExecTransport` dedup** (runtime-core's McpCompleter could be re-expressed
  over the new plug).

**5. Where state lives.** Resume from `design/logbook.md` (**LB-27** = mcp-exec-server; LB-26 = bridge v3; LB-25 = T4) +
`design/llm-client-architecture.md` (the reference doc) + the two plans + `design/milestone10-implementation.md` (M10
ledger) + `design/backlog.md`, **not chat**. **Gate baseline on `master` after this merge = 245/245, tsc 0.** Verify
before/after any new code.

**6. Op notes / gotchas.**
- **Gate:** `npm run build` (tsc -b) AND `npm test` (vitest). **LB-9:** `planning_runs/` is gitignored and some tests
  write into it — pre-existing, NOT pollution; check `git status` (in-scope files only).
- **Package map (new):** `@agenttalk/llm-client` (zero-dep leaf: `Completer`/`ApiCompleter`/`ChatSession`/
  `McpChatCompleter`/`ExecTransport` — imports NOTHING from AgentTalk; keep it that way) · `@agenttalk/mcp-transport`
  (pure `ws` leaf: generic `McpServer`) · `@agenttalk/mcp-exec-server` (exec tools + `ExecTurnQueue` + `McpExecServer`).
  **Invariant:** structured-output stays INJECTED into `ApiCompleter`, never imported in llm-client (keeps it
  domain-agnostic). **Vitest gotcha:** a new package needs BOTH a `resolve.alias` AND an `include` glob entry in
  `vitest.config.ts` — a missing glob silently drops its tests from the run (cost me a 225→217 count drop once).
- **Engine map (M10, unchanged):** `team-coordinator.ts` — `setPlanningPhase`/`onPhaseChange` (forward-spine viz),
  `emitProtocolEvent`/`onProtocolEvent` (off-spine viz, bridge v3), `ejectPlanner` (T1), `validateProtocolStep` (T2
  graded loop), `pauseTaskForOperator` (M08-T3 fence). **Do NOT touch brain behaviour without a scope call (Rule 2).**
- **Budget:** `node scripts/usage.mjs` — check the `(updated …)` stamp. At handoff: claude **weekly ~70%**, session
  ~84% (session resets ~5:30pm Rome; weekly resets Jul 1 ~9am Rome). **Gemini still out of weekly budget** → you remain
  implementer (LB-14).
- **🌍 GitHub:** `git@github.com:faustothegrey/AgentTalk.git`. Feature code branches off `master`. **`master` is pushed
  through this session's work.** Don't push without Fausto's go.
- **DiagramTalk repo** (`/Users/fausto/Software/DiagramTalk`) + **agentalk-mcp-client** (`/Users/fausto/Software/agentalk-mcp-client`)
  are **separate** repos — you only ever **read** them to verify contracts; never edit; relay via Fausto.
