# Proposal: HTTP Launcher Service — launch agents on demand, no human shell command

**Author:** Claude (architect) · **Date:** 2026-07-15 · **Status:** IMPLEMENTED — pending Gate 2 review
**Decision context:** PO picked **Option A** (automate away the human shell step; keep the CLI/attach model)
over Option B (in-process/API agents, no subprocess). This doc specs Option A only.

> **Implementation status (2026-07-15).** Built by Claude as *temporary implementer* (PO-directed, standing
> conditional reassignment — Gemini offline). Branch **`feat/http-agent-launcher`** in `agentalk-mcp-client`
> (commit `4fe010a`): `lib/agent-launcher.mjs` (core + HTTP server, spawn/fetch injected), `agent-launcher.mjs`
> (bin, binds 127.0.0.1), `__tests__/agent-launcher.test.mjs` (14 hermetic tests). Full suite 19/19, lint clean,
> orchestrator core untouched (integration 5a). **Gate 2 must go to a different actor (Codex or PO)** — the
> author cannot review own code. **Merge stays human-gated.**

---

## 1. Why

Today, bringing an agent up is a **manual, per-agent shell command**. An operator runs
`node llm-agent.mjs --agentId <id> --provider <p> ...` in a terminal; the harness PTY-drives the underlying CLI
(claude/codex/gemini) and attaches to the orchestrator over WebSocket (`server.ts:904`,
`llm-agent.mjs`). The orchestrator itself **launches nothing** by deliberate M05 design
(`server.ts:632-633`; `mcp-external-launch-proposal.md §1`) — `POST /api/agents/:id/start` only *activates* a
record and waits for the external process to attach.

The objective: **launch agents on demand without a human typing a shell command.** Option A does this by adding a
small **launcher service** that performs the subprocess spawn on an HTTP trigger. The spawn does not disappear —
it moves from a human's terminal to a service — so the CLI-subscription auth model and every M05→M20 contract are
preserved unchanged.

## 2. The one invariant we must NOT break

M05 deliberately removed **orchestrator auto-launch** (it coupled MCP lifecycle into the orchestrator and caused a
live-test bug — `mcp-external-launch-proposal.md §1`). **This proposal must not re-introduce that coupling.** The
orchestrator continues to launch nothing. The spawn lives in a **separate launcher service**, and the orchestrator
still only creates/activates records and accepts WS attaches. We are not reverting M05; we are adding an external
automation in front of the same attach seam.

## 3. Design

A new lightweight service — **`agent-launcher`** — living in `agentalk-mcp-client` (where the CLIs, PTY drivers,
and `llm-agent.mjs` already are; it must run on the host that holds the CLI credentials).

```
  UI / operator                 agent-launcher (NEW)            orchestrator (unchanged core)
       │  POST /agents {provider,…}   │                                  │
       ├─────────────────────────────►│                                  │
       │                              │  POST /api/agents  (create)      │
       │                              ├─────────────────────────────────►│
       │                              │  POST /api/agents/:id/start      │
       │                              ├─────────────────────────────────►│  (activates, waits)
       │                              │                                  │
       │                              │  child_process.spawn(            │
       │                              │    'node llm-agent.mjs           │
       │                              │       --agentId … --provider …', │
       │                              │    env:{ AGENTTALK_WORKDIR,       │
       │                              │          AGENTTALK_PERSISTENT_MCP_URL })
       │                              │            │                     │
       │                              │            └── harness attaches ──► WS 'attach' (server.ts:904)
       │  ◄──── 201 {agentId,pid} ────┤                                  │
```

The launcher passes exactly what the harness already consumes today — **no harness change required**:
- **args:** `--agentId <id> --provider <p> --model <m> --execution-mode <mode>` (`llm-agent.mjs:12-20`)
- **env:** `AGENTTALK_WORKDIR` (`:64`), `AGENTTALK_PERSISTENT_MCP_URL` (`:158`, default `ws://localhost:3000/mcp`),
  optional `AGENTTALK_PERSISTENT_COMMAND_JSON` (`:28`).

## 4. Interface (proposed)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/agents` | `{ provider, model?, executionMode?, agentId?, workdir? }` | `201 {agentId, pid, status}` |
| `GET`  | `/agents` | — | list of launched processes `{agentId, pid, provider, alive}` |
| `DELETE` | `/agents/:id` | — | terminates the child process; `204` |
| `GET`  | `/healthz` | — | liveness |

The launcher owns the **process table** (pid ↔ agentId), so it can list/terminate — the lifecycle piece a bare
shell command never had. On child exit it can optionally notify the orchestrator (or leave the existing
clean-disconnect → `terminated` path from M05 to handle it).

## 5. Integration options (pick one at planning)

- **(5a) Launcher-fronts-orchestrator** *(recommended)*: the UI/operator calls the **launcher**, which then calls
  the orchestrator's existing create + start APIs and spawns the harness. Orchestrator untouched. Cleanest
  separation; the launcher is purely additive.
- **(5b) Orchestrator-calls-launcher**: `POST /api/agents/:id/start` additionally POSTs to the launcher URL to
  bring the process up. More convenient (one existing endpoint does it all) but it **couples the orchestrator to
  a launcher address** — softer version of the exact coupling §2 warns about. Only behind a config flag, default
  off, if chosen.

Recommendation: **5a** — keeps the M05 invariant literally intact.

## 6. What this preserves (behavior-change audit, per M06 rules)

- The harness (`llm-agent.mjs`) and its protocol: **unchanged**.
- The orchestrator's attach seam, WS contract, registry, `/api/agents*`: **unchanged** under 5a.
- CLI-subscription auth (no metered API): **unchanged** — still spawns the real CLIs.
- Existing manual `node llm-agent.mjs …` launch: **still works** (the launcher is additive, not a replacement).

## 7. Risks / open questions

1. **Where does the launcher run?** It must be co-located with the CLI credentials and the `agentalk-mcp-client`
   checkout. Single-host assumption for v1; multi-host is out of scope.
2. **Security surface.** An HTTP endpoint that spawns local processes is an RCE vector if exposed. v1: bind
   `127.0.0.1` only, no external listen; auth token later.
3. **Process supervision.** Crash/restart policy, zombie reaping, max-concurrent-agents cap. v1: spawn + track +
   terminate; no auto-restart.
4. **Workdir / worktree.** Ties into BL-036 (parallel-code-dev worktree discipline) if launched agents will edit
   code concurrently — the launcher is the natural place to assign a per-agent worktree. Flag, don't solve here.
5. **Provider readiness.** The launcher spawns the process but "attached & ready" is still the orchestrator's WS
   event — the `201` means *launched*, not *ready*. Callers must not assume ready-on-201.

## 8. Scope / effort (rough)

Small. New service file(s) in `agentalk-mcp-client` (~1 HTTP server + a spawn/track map), reusing the existing
arg/env contract. No changes to `llm-agent.mjs` or the orchestrator core under 5a. Optional thin UI wiring to call
`/agents` instead of instructing the operator. Estimated one focused implementer task; testable with a spawn mock.

## 9. Next step

If the PO accepts the direction: open a backlog item (next id **BL-037**), route to the **Planner (Codex)** for a
`*-plan.md` with DoD, through the normal gate sequence. This doc is the architect's inception input, not a plan.
