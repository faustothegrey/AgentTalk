# BL-071 — Host/environment info gathering (plan)

> **Status:** DRAFT for the plan-review gate. Planner: Claude (resource-fallback). Design-first item.
> **Backlog:** BL-071 (`design/backlog.md`). Sibling: BL-072 (the *un*verifiable half — separate task).
> **Source of truth for method:** `design/collaboration-workflow.md`. This file is the spec+DoD.

## 1. Goal (what the PO asked, 2026-07-18)

Every team member (agent) **and** the orchestrator should gather info about the **host system they run
on** — OS, arch, versions, etc. — captured at attach, because **future behaviours may branch on it**
(e.g. "it's a Mac / arm64", node version, cpu/mem). This is the **self-verifiable half** of the
environment-awareness pair: host info is ground truth the process *observes about itself* (`os.*` /
`process.*`), not a claim — so no trust model is needed (that's BL-072's problem, not this one).

## 2. The one decision that shapes everything: the contract-hash cost

The orchestrator **cannot observe an agent's host** — attach mode is WebSocket, agents may be remote in
principle (the whole point of "per-agent, don't assume co-location"). So the agent's env must **travel to
the orchestrator over the MCP channel**, and any typed message/field that carries it lives in
`packages/contracts/` — **shared with `agentalk-mcp-client` and `apps/web`, coupled by the `contractHash`
in the WS URL** (`ws://…/?contractHash=…`). Changing it is a **lockstep cross-repo bump**, not a local edit.

The orchestrator's **own** env has no such cost: gather locally at boot, store, expose. Zero cross-repo risk.

**⇒ Recommended phasing (de-risk; ship value early):**

| Phase | Scope | Contract change? | Delivers |
|-------|-------|------------------|----------|
| **P1** | **Orchestrator's own** environment: gather at boot, store, expose via API (+ optional UI) | **No** | Half the ask, zero cross-repo risk |
| **P2** | **Per-agent** environment: client gathers + reports; orchestrator stores on the `Agent` record; hash bump **both repos in lockstep** | **Yes** | The other half; the harder, coupled half |

P1 and P2 are independently mergeable. **This plan asks the gate to approve the phasing and P1's shape;
P2's exact transport is an open question (§7) to settle before P2 starts.**

## 3. Proposed schema (a small, stable set — NOT a kitchen sink)

This is data other behaviours will branch on → it is a **lightweight contract**; keep it minimal and stable.

```ts
// packages/contracts/src/types.ts (new)
export interface HostEnvironment {
  platform: NodeJS.Platform;   // os.platform()      e.g. 'darwin' | 'linux' | 'win32'
  arch: string;                // os.arch()          e.g. 'arm64' | 'x64'
  osRelease: string;           // os.release()
  nodeVersion: string;         // process.version    e.g. 'v22.3.0'
  hostname: string;            // os.hostname()
  cpuCount: number;            // os.cpus().length
  totalMemBytes: number;       // os.totalmem()
  capturedAt: string;          // ISO — when THIS process observed it
}
```

**Deliberately excluded** (leaky / unstable / potentially sensitive): full `process.env`, `PATH`, cwd,
usernames. If a future behaviour needs one, add it explicitly then — a stable small set beats a dump.

## 4. Scope — files I MAY touch

**Phase 1 (orchestrator-local, no contract change):**
- `apps/orchestrator/src/index.ts` and/or `server.ts` — gather the orchestrator's own `HostEnvironment`
  at boot; expose via an API read (extend an existing `GET /api/…` or add one; decide at implementation).
- A tiny pure helper (new file, e.g. `packages/runtime-core/src/environment.ts` or an orchestrator util):
  `captureHostEnvironment(): HostEnvironment` — one function, unit-testable, used by both orch + (later) client.
- `packages/contracts/src/types.ts` — add the `HostEnvironment` interface **only** (a pure type add does
  **not** change wire behaviour; confirm whether the `contractHash` derivation includes it — see §7 Q3).
- Tests: a unit test for `captureHostEnvironment` (shape + types), and an API/read test for the orchestrator env.

**Phase 2 (per-agent, contract-coupled) — planned, not started here:**
- `agentalk-mcp-client/llm-agent.mjs` (+ `lib/mcp-client.mjs`) — gather own env, report on connect.
- `packages/runtime-core/src/agents/agent.ts` — add `host?: HostEnvironment` to class `Agent`.
- `packages/runtime-core/src/registry/registry.ts` — accept + store the reported env.
- `packages/contracts/` — the transport message/tool (the hash-bumping part).
- Both repos' contract-hash bump, lockstep.

## 5. Files I may NOT touch (guardrails)

- The engine coordination core (`team-coordinator.ts`, consensus, protocol turn loop) — no behaviour change.
- `mintId`/id conventions, healthcheck, relay — untouched.
- BL-072's concern (the "am I within AgentTalk" flag/trust) — **explicitly out of scope**; different task.
- The PO's launchd service, the `.plist` — untouched.

## 6. Definition of Done (per phase)

**Phase 1 DoD:**
1. `captureHostEnvironment()` returns the §3 schema with correct types — unit test green.
2. Orchestrator captures its own env at boot and it is **readable** via an API endpoint — test green.
3. `npx tsc -b` clean; full suite green (baseline first, per the worktree op-note); no pollution.
4. No behaviour change to any existing flow (regression: existing suite unchanged).

**Phase 2 DoD** (gate re-opens for it):
1. A real client reports its own env on connect; orchestrator stores it on the `Agent` record.
2. Contract hash bumped in **both** repos, lockstep; a cross-repo attach still succeeds (live check).
3. Per-agent env readable via API (and, if in scope then, surfaced in the Team UI).
4. tsc clean both repos; both suites green; no pollution.

## 7. Open questions for the plan-review gate

- **Q1 — Approve the P1/P2 phasing?** (ship orchestrator-local first, agent-reported second.)
- **Q2 — P2 transport:** a dedicated MCP tool (`report_environment`) the client calls once on connect, vs.
  piggybacking on the first `await_turn`/status signal. The tool is cleaner+typed but is the hash-bumping
  surface either way. **Recommend:** dedicated one-shot tool — explicit, greppable, easy to test.
- **Q3 — RESOLVED by the plan-review gate (ran the code, 2026-07-18).** The hash is
  `sha256(JSON.stringify(data, null, 2))` where `data = { mcpTools, packetTypes, protocolPrefix }` **only**
  (`packages/contracts/wire-contract.json` + `scripts/verify-contract.js:11-12`). It does **NOT** hash
  `types.ts`. **⇒ P1's `HostEnvironment` type add is genuinely contract-free — confirmed, not assumed.**
  **Two consequences that sharpen Q2:** (a) a **new MCP tool** *does* change `mcpTools` → hash bump, and
  `verify-contract.js:28,48-57` enforces the client's `wire-contract.json` matches → a lockstep bump is
  exactly what P2-via-tool triggers, and it is *verified* by tooling. (b) **Piggybacking env onto an existing
  tool's args would NOT change `data`, so it would NOT bump the hash even though the wire payload changed** —
  silent drift the hash can't catch. **This is a decisive argument for the dedicated-tool option in Q2** (the
  hash tracks it) and against the piggyback option.
- **Q4 — Where does the orchestrator env surface** — extend `GET /api/agents`/a status route, or a new
  `GET /api/environment`? (Implementation-time call; noting it so the gate can weigh in.)

## 8. Approach (first thing I'll try, once approved)

Spin a per-task worktree (`att-BL-071`, wire node_modules per the op-note, `npx tsc -b` first, **baseline
the suite before any change**). Start with the pure `captureHostEnvironment()` helper + its unit test
(TDD-ish, no wire risk), then the orchestrator boot-capture + API read. Answer Q3 against the hash code
**before** touching `contracts`. Stop at the branch; merge is PO-gated.

---
*Telemetry block to be filled at closure (per AGENT.md task-closure telemetry).*
