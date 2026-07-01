# M12 — Cross-Provider Consensus — Architect Plan

> **Status:** Architect deliverable — PO decisions recorded, awaiting Planner advisory POV before epic open.
> **Author:** Claude (Architect seat, PO-assigned for this epic). Planner is **Codex** (≠ Architect, so the
> Planner's advisory POV stays independent).
> **PO:** Fausto. **Date:** 2026-07-01.
> **Ledger (to be created at epic open):** `design/milestone12-cross-provider-consensus-implementation.md`.
> **Depends on:** M11 (consensus/protocol robustness) — DONE, merged to master. This epic *cashes in* M11's
> robustness claim by proving a mixed-provider round.

---

## 1. Thesis (what this epic actually is)

Every consensus round up to M11 used **two Gemini planners**. M11's robustness work (`consensus_respond`
single tool, active re-prompting, turn-budget/referee, soft-reject) was explicitly built so that a round no
longer depends on both planners being the *same* model behaving *identically*. **M12 is the proof of that
claim:** run one `planner-planner-worker` team where the two planners are **different providers** (default
**Gemini + Codex**) and show the round reaches `submit_plan` → worker completion cleanly through the existing
MCP infrastructure.

**The headline architectural finding: this is a *validation* epic, not a *build* epic.** The engine is already
provider-blind on the MCP path (evidence in §2). The bulk of the deliverable is a **cross-provider live
harness + recorded runs**, plus **one deterministic regression test** and **one small, real coupling fix**
found during this analysis (§4, the fact-collection-timeout gap). If a provider derails at runtime, that is a
*finding to report* under the show-stopper rule — not licence to rewrite the engine.

---

## 2. Ground-truth architecture findings (verified against the code today)

I read the engine and both existing live harnesses. The MCP consensus path is provider-agnostic by
construction:

```
  Cross-provider MCP consensus — data flow (verified)

  planner-a (Gemini)                 planner-b (Codex)
  external process                   external process
  llm-agent.mjs --provider gemini    llm-agent.mjs --provider codex
  GeminiPersistentExecutor           CodexPersistentExecutor      ← per-provider parsing lives HERE
  (isolated temp home, agy --continue) (codex persistent, --continue)  (client repo, already exists)
        │  emits consensus_respond            │  emits consensus_respond
        │  over its own WebSocket             │  over its own WebSocket
        ▼                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    AgentTalk (the "brain")                    │
  │  McpServer  →  Registry.handleMcpToolCall                     │
  │                  case 'consensus_respond' (registry.ts:406)   │
  │                    dispatches on `action`, NOT on provider ───┼──► provider-BLIND
  │  turn routing: awaitExecTurn() for mcp|gemini|claude|codex    │
  │                  (registry.ts:336) — one identical path       │
  │  TeamCoordinator: phase state machine, referee, re-prompting  │
  └─────────────────────────────────────────────────────────────┘
```

**F1 — Turn routing is provider-blind for MCP agents.** `registry.ts:336` uses `awaitExecTurn()` for every
non-API provider (`mcp | gemini | claude | codex`) via one identical branch. There is no per-provider queue,
no provider-keyed conversation state — each MCP agent owns its own external process and its own persistent
executor with an isolated temp home. **Two different providers in one team do not touch each other's state.**

**F2 — `consensus_respond` is provider-agnostic.** The handler (`registry.ts:406–439`) dispatches on the
`action` field (`opinion`/`agreement_proposal`/`agreement_acceptance`/`ack_planning_protocol`/
`fact_collection_end`/`submit_plan`) and never reads the agent's provider. Illegal/out-of-phase actions go to
`softProtocolReject` (M08/M11 tolerance) regardless of who sent them.

**F3 — `translateStructuredResponse` is on the API path ONLY.** It is called at
`in-process-driver.ts:169` (the in-process API driver), *not* on the MCP path. For MCP agents the "LLM text →
structured `consensus_respond`" mapping happens in the **external client's per-provider PTY drivers**
(`gemini-pty.mjs` / `codex-pty.mjs` / `claude-pty.mjs`), which already exist in `agentalk-mcp-client`. So the
answer to the PO's Q2 ("does `translateStructuredResponse` handle them differently?") is: **it doesn't touch
the mixed-MCP team at all.** Provider-specific output handling is the client's job, and the client already
supports all three.

**F4 — `providerName` is never branched on for MCP agents.** Grep confirms the engine reads `providerName`
only on the `api` path (`registry.ts:226`, to pick `google`/etc.). For MCP agents it is stored metadata; the
real model is chosen by the external launch flag `llm-agent.mjs --provider <p>`.

**F5 — The external client already supports Gemini + Codex + Claude in persistent MCP-attach mode.**
`agentalk-mcp-client/lib/executor-runtime.mjs` has `CodexPersistentExecutor`, `GeminiPersistentExecutor`,
`ClaudePersistentExecutor`; `createExecutor` wires codex → `CodexPersistentExecutor` (line 820);
`supportsPersistentExecution` returns true for all three. **No client-side capability gap for the default
Gemini+Codex pairing** (subject to the runtime behaviour risk in §5).

### The ONE real coupling I found — C1 (fact-collection timeout)

**`team-coordinator.ts:1019`** gives a *longer* fact-collection window **only when `team.provider === 'gemini'`**:

```ts
const timeoutMs = team.provider === 'gemini'
  ? Math.max(this.factCollectionTimeoutMs, DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS)
  : this.factCollectionTimeoutMs;
```

`team.provider` is a *team-level* field. In a mixed team it is `undefined` (the live harness calls
`createTeam(members)` with no provider arg), so a Gemini planner in a mixed team **loses** the extended window
it would get in an all-Gemini team. This is exactly the "hidden provider-keyed branch" the PO's Q1 asked about.
It is subtle (a timing/robustness gap, not a crash) but real, and it is the one deliberate engine touch this
epic should make (see M12-T2). **Everything else is zero-engine-change.**

---

## 3. Scope

### In scope (what changes)
- **Harness (new):** a cross-provider live script (default Gemini + Codex planners, one worker) — §6 recommends
  the shape.
- **Engine (one small fix):** C1 — make the fact-collection timeout heterogeneity-aware (use the longer window
  if *any* member provider needs it), so a Gemini planner isn't starved in a mixed team.
- **Test (new, deterministic):** a regression test that pins F1/F2/F4 — a mixed-provider team routes turns and
  handles `consensus_respond` identically regardless of provider mix (no live LLM; mock exec turns).
- **Docs:** ledger, this plan, `logbook.md` calibration entry, backlog disposition (close the deferred
  cross-provider item).
- **Recorded live runs:** ≥1 clean mixed-provider run reaching `submit_plan` + worker completion, transcript
  captured in the ledger.

### Explicitly NOT in scope (do not touch)
- **The wire contract** (`packages/contracts/wire-contract.json`) — unchanged; hash stays.
- **The MCP tool surface** (`AGENTTALK_MCP_TOOLS`) and the **`consensus_respond` vocabulary/actions** — unchanged.
- **The API path** (`in-process-driver.ts`, `translateStructuredResponse`) — not exercised, not touched.
- **Provider-specific output parsing** — lives in the *client* repo (`agentalk-mcp-client`), which is ancillary
  (see memory: "client harness is ancillary"). If a client parser needs work, that is a **separate cross-repo
  finding**, reported, not silently folded in here.
- **M11 robustness mechanisms** (referee, re-prompting, soft-reject) — reused as the safety net, not modified.

---

## 4. Task breakdown (independently verifiable units)

| Task | What | DoD | Risk |
|---|---|---|---|
| **M12-T1** | Cross-provider **live harness** script (`scripts/test-live-cross-provider.mjs`): planner-a=Gemini, planner-b=Codex, worker=Gemini; providers overridable via env (`PLANNER_A_PROVIDER` / `PLANNER_B_PROVIDER` / `WORKER_PROVIDER`). Derived from `test-live-gate.mjs`. | Script exists, `tsc` clean, runs structurally (launches 3 external agents against one MCP server; provider flags plumbed). No live LLM needed to land the script. | Low — mechanical fork of an existing script. |
| **M12-T2** | Fix **C1**: fact-collection timeout becomes heterogeneity-aware (longest window required by any member provider). Behaviour change → confined + spec'd here → needs PO confirm per M06 rule. | Deterministic regression test: a team containing ≥1 Gemini planner gets the extended fact-collection window even when `team.provider` is unset/mixed. Full suite green; tsc 0. | Low-med — touches shared `team-coordinator.ts`; small, guarded diff + regression test. |
| **M12-T3** | Deterministic **provider-mix invariance test**: create a team with mixed `providerName` metadata, drive mocked exec turns, assert turn routing + `consensus_respond` dispatch are identical regardless of mix (pins F1/F2/F4 against future regression). | New test passes; full suite green; no live dependency. | Low. |
| **M12-T4** | **Recorded live run(s)**: execute M12-T1's harness (Gemini+Codex), capture transcript, record observations in the ledger. **≥1 clean run reaching `submit_plan` + worker completion.** | ≥1 recorded clean run; observations (including any derailments + how M11 mechanisms handled them) logged. | **Med-High — the real epic risk (§5).** Probabilistic; budget-bound. |
| **M12-T5** | **Docs/close**: ledger telemetry blocks, `logbook.md` cross-provider calibration entry, backlog item closed, memory `run-gemini-live-gate…` updated. | Backlog cross-provider item dispositioned; ledger complete. | Low. |

**Sequencing:** T1 → T2 → T3 can proceed deterministically (no live budget). **T4 is the gate** and should run
last, once T2/T3 give a clean, coupling-fixed base. T2 and T3 are independent of each other.

**Note on the standing implementer default:** implementer → Gemini. All of T1–T3, T5 are ordinary
implementation. T4 is a *live run*, not a code change — whoever runs it records honest observations
(Rule 4: try-it/test-it/report-it), and a derailment is a reported finding, not a failure to hack around.

---

## 5. Risk assessment

The risk is **behavioural (runtime), not structural.** The engine mixes providers cleanly (§2); the open
question is whether Codex's LLM, driven through its PTY/persistent executor, **reliably emits
protocol-compliant `consensus_respond` under the same prompts Gemini gets.**

- **R1 — Codex protocol compliance under the consensus prompt (primary risk).** Codex has never run a
  consensus round in this project (all prior rounds were Gemini). Its CLI differs (`keepStdinOpen`, exit-code
  handling, PTY alt-screen). It may phrase structured output differently, or need the extended fact-collection
  window. **Mitigation:** M11's referee + active re-prompting + soft-reject are exactly the floor for this;
  T4's job is to *observe* whether they hold. Per the backlog's testing principle, T4 is **recorded live
  observation, never a flaky pass/fail gate** — the deterministic proof of no-engine-coupling is T3.
- **R2 — Probabilistic outcome.** Live consensus sometimes completes, sometimes derails (documented in the
  backlog). DoD is "**≥1 clean run**," and a derailment must be logged with the mechanism that caught it — not
  buried. Budget for a few attempts.
- **R3 — Codex output parsing (cross-repo).** If Codex wraps its response such that the client's
  `extractResponse('codex', …)` doesn't yield clean structured JSON, the fix is in `agentalk-mcp-client`, not
  AgentTalk. Flag as a cross-repo finding; do not fold client changes into an AgentTalk task.
- **R4 — Budget.** Codex weekly is at 38% (as of 2026-07-01). Each live consensus round burns several Codex
  turns. **Cap live attempts** (recommend ≤4 across the epic) and run T4 in one focused window; if Codex quota
  tightens, T4 can defer while T1–T3 (deterministic) still deliver the structural proof.
- **R5 — C1 regression.** The timeout fix touches shared coordinator logic. Keep the diff minimal, gate with
  the T2 regression test + full suite (Implementer Rule 2: shared logic = show-stopper caution).

**What could block the epic:** only R1 at the extreme — if Codex simply cannot hold the protocol even with
M11's mechanisms, T4's DoD can't be met with the default pairing. Fallbacks, in order: (a) try a different
prompt/model for Codex; (b) swap the second provider to Claude (also client-supported); (c) if a genuine
tolerance gap is exposed, that is a **reported finding feeding a follow-on**, and the epic closes on the
structural proof (T1–T3) with the live gap documented — an honest partial beats a hacked green.

---

## 6. Harness design recommendation (PO's Q3)

**Recommendation: a dedicated script with explicit per-agent providers, env-overridable — NOT a
`MIXED_PROVIDER_GATE` flag on the existing script.** Rationale: the existing `test-live-gate.mjs` hard-wires
three Gemini agents; a boolean flag would fork its control flow and hide *which* providers are in play. An
explicit script is more auditable (you read the providers at the top), matches how `test-live-api-team.mjs`
already reads, and keeps the proven all-Gemini gate untouched as a baseline.

Shape (fork of `test-live-gate.mjs`, only the agent-creation/launch lines change):

```js
const PA = process.env.PLANNER_A_PROVIDER || 'gemini';
const PB = process.env.PLANNER_B_PROVIDER || 'codex';   // the cross-provider default
const PW = process.env.WORKER_PROVIDER  || 'gemini';

await registry.createAgent('planner-a', { provider: 'mcp', providerName: PA });
await registry.createAgent('planner-b', { provider: 'mcp', providerName: PB });
await registry.createAgent('worker-1',  { provider: 'mcp', providerName: PW });
// …launch llm-agent.mjs --provider ${PA} / ${PB} / ${PW}, same as the existing gate
```

**Keep the worker on Gemini by default** so the *only* cross-provider variable is the two planners — the
consensus round is planner↔planner, so isolating the mix there keeps the experiment clean and the signal
attributable.

---

## 7. Definition of Done (epic)

1. `scripts/test-live-cross-provider.mjs` exists, is `tsc`-clean, and plumbs per-agent providers (M12-T1).
2. C1 fixed: a Gemini planner gets its extended fact-collection window even in a mixed team, proven by a
   deterministic test (M12-T2).
3. A deterministic provider-mix invariance test pins F1/F2/F4 (M12-T3).
4. **≥1 recorded live Gemini+Codex run reaches `submit_plan` cleanly and the worker completes** (M12-T4),
   transcript + observations in the ledger. Derailments (if any) logged with the M11 mechanism that handled them.
5. Full suite green + tsc 0 at close; backlog cross-provider item dispositioned; ledger telemetry blocks filled.

---

## 8. Resource estimate

- **Deterministic work (T1, T2, T3, T5):** implementation + tests, no live LLM. Estimate on the order of a
  typical small-task session for the implementer (Gemini); calibrate against `logbook.md` LB-11 at task close.
- **Live runs (T4):** the budget-sensitive part. **Cap at ≤4 live Gemini+Codex rounds** across the epic; each
  consumes Codex + Gemini quota (Codex 38% weekly headroom as of 2026-07-01 — enough for a handful of rounds if
  focused). Run T4 in one window; record `/usage` before/after per the token-budget-checkpoints rule.
- **Reviewer:** gate-1 (this plan) + gate-2 (verify each task by running it, per Reviewer Rules). Reviewer must
  independently reproduce T4's live claim or mark it recorded-observation with evidence.

---

## 9. PO decisions (confirmed 2026-07-01)

| Question | Decision |
|----------|----------|
| Q1 — Second provider default: Codex or Claude? | **Codex** (primary), Claude as fallback. |
| Q2 — C1 fix (T2) behaviour change in shared engine? | **Approved** — folded into this epic. |
| Q3 — Live-run cap: ≤4 rounds acceptable? | **Acceptable.** |
| Q4 — Filename: `m12-` vs `milestone12-`? | **`milestone12-`** (house convention). Renamed. |

## 10. Open questions for the Planner (advisory POV)

These are handed to Codex (Planner) for an advisory, non-binding point-of-view — the second, independent read on feasibility/risk/effort that PO and Architect weigh.
