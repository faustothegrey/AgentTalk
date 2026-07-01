# M12 — Cross-Provider Consensus — Architect Plan

> **Status:** **Epic inception complete — ready for Planner breakdown.** PO decisions recorded (§9), Planner
> advisory POV incorporated (§10), and a ground-truth correction folded in (F3/R3 — see below).
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
  GeminiPersistentExecutor           CodexPersistentExecutor
  (isolated home, agy --continue)    (codex persistent, --continue)
   extractResponse('gemini')          extractResponse('codex')  ← CLI-output cleanup (client, per-provider)
        │  submit_exec_result({text})         │  submit_exec_result({text})   ← RAW cleaned text, NOT structured
        │  over its own WebSocket             │  over its own WebSocket        (client is a PURE RELAY)
        ▼                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    AgentTalk (the "brain")                    │
  │  McpServer → registry emits exec_result → completer resolves  │
  │  InProcessAgentDriver (used for ALL providers, incl. MCP):    │
  │    parseWithRetry → parseStructuredResponse (text→structure)  │  ← STRUCTURED PARSE lives HERE, in AgentTalk
  │    → translateStructuredResponse (in-process-driver.ts:145-169)│    (provider-blind CODE, one retry)
  │    → registry.handleMcpToolCall('consensus_respond', …)       │
  │        case dispatches on `action`, NOT on provider ─────────┼──► provider-BLIND
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

**F3 — The structured parse (`parseStructuredResponse` → `translateStructuredResponse`) runs IN AgentTalk, on
the MCP path too — one shared, provider-blind code path.** *(Corrected from the first draft, which wrongly
placed this in the client — verified against the code; Planner point 3 was right.)* There are **two** parse
layers, and it matters where each lives:
- **Layer 1 — CLI-output cleanup (in the client, per-provider):** each executor's `extractResponse('gemini'|
  'codex'|'claude', …)` strips ANSI / pulls the assistant message out of the CLI wrapper, then the client
  calls **`submit_exec_result({ text })`** — **raw, unstructured text**. The client is a **pure relay**; it
  never emits `consensus_respond` itself (it only ever calls `await_turn` + `submit_exec_result`). *(Matches the
  standing "client harness is ancillary / pure relay; consensus logic stays in AgentTalk" invariant.)*
- **Layer 2 — structured protocol parse (in AgentTalk, shared):** the registry emits `exec_result`, the
  completer resolves it, and **`InProcessAgentDriver` — which the registry starts for *every* provider incl.
  MCP (`registry.ts:222`)** — runs `parseWithRetry` → `parseStructuredResponse` → `translateStructuredResponse`
  (`in-process-driver.ts:145-169`), turning the raw text into the `consensus_respond` action. **This is the same
  code for Gemini and Codex** — so the answer to the PO's Q2 is: it does *not* branch per provider. **But it
  *does* parse each provider's raw output**, so it is the true cross-provider surface (see the corrected R3).

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

**C1 is double-sided (Planner point 1).** The `else` branch — `this.factCollectionTimeoutMs` — is *also
Codex's* timeout in a mixed team. So the fix is not merely "give Gemini its window back"; it must decide the
window for a **heterogeneous** team where different members may each want different minimums. The correct fix is
therefore **member-provider-aware, not team-provider-aware**: compute the window as the **max of the per-member
required minimums** across the team's providers (so Codex's needs are honoured too, not just Gemini's), rather
than reading the single `team.provider` field. M12-T2's spec below reflects this.

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
- **The `consensus_respond` dispatch, the phase state machine, and the exec/completer plumbing** — reused
  unchanged.
- **Layer-1 CLI-output cleanup** (`extractResponse` in the *client* repo, `agentalk-mcp-client`) — ancillary
  (memory: "client harness is ancillary"). If Codex's CLI wrapper needs different extraction, that is a
  **separate cross-repo finding**, reported, not silently folded into an AgentTalk task.
- **NOTE — Layer-2 structured parse is NOT off-limits.** `parseStructuredResponse` / `parseWithRetry` /
  `translateStructuredResponse` live in AgentTalk (`in-process-driver.ts`) and *are* exercised by the mixed team
  (F3). They are **shared by the API path**, so any change is a behaviour-change to a load-bearing, shared,
  already-passed path → **show-stopper discipline** (report + PO confirm), not a casual edit. In scope only if
  T4 proves Codex's output defeats the current parser; then a **minimal, additive** hardening (spec'd as a fresh
  task), never a rewrite.
- **M11 robustness mechanisms** (referee, re-prompting, soft-reject) — reused as the safety net, not modified.

---

## 4. Task breakdown (independently verifiable units)

Task IDs are stable; the **execution order** is set by the sequencing note below (Planner point 4: **T2 before
T1**), not by the numbering.

| Task | What | DoD | Risk |
|---|---|---|---|
| **M12-T2** | Fix **C1**, **member-provider-aware** (not team-provider-aware): the fact-collection window = the **max of the per-member required minimums** across the team's providers, so *both* a Gemini planner's extended window **and** Codex's needs are honoured in a mixed team (the current `else` branch is also Codex's timeout — Planner point 1). Behaviour change to shared `team-coordinator.ts` → **PO-approved** (§9 Q2), still M06/show-stopper discipline. | Deterministic regression test: a mixed team (≥1 Gemini) gets the extended window even when `team.provider` is unset; all-Gemini and all-other teams unchanged. Full suite green; tsc 0. | Low-med — shared engine; small, guarded diff + regression test. |
| **M12-T1** | Cross-provider **live harness** script (`scripts/test-live-cross-provider.mjs`): planner-a=Gemini, planner-b=Codex, worker=Gemini; providers overridable via env (`PLANNER_A_PROVIDER` / `PLANNER_B_PROVIDER` / `WORKER_PROVIDER`). Derived from `test-live-gate.mjs`. **Must account for Codex's PTY differences (Planner point 2):** `codex-pty.mjs` handles `keepStdinOpen` / exit codes / alt-screen differently from `gemini-pty.mjs`, so the Codex launch args + env must match what `CodexPersistentExecutor` expects (don't assume the Gemini launch line ports verbatim). | Script exists, `tsc` clean, runs structurally (launches 3 external agents against one MCP server; provider flags plumbed; Codex agent attaches). No live consensus needed to land the script. | Low-med — Codex PTY plumbing is the wrinkle. |
| **M12-T3** | Deterministic **provider-mix invariance test**: mixed `providerName` metadata team, mocked exec turns, assert turn routing + `consensus_respond` dispatch identical regardless of mix (pins F1/F2/F4). | New test passes; full suite green; no live dependency. | Low. |
| **M12-PF** | **Preflight (Planner point 5):** a cheap **single-agent Codex MCP ping** — launch one Codex `llm-agent.mjs` against the MCP server, confirm it attaches, takes one `await_turn`, and returns a `submit_exec_result` that AgentTalk's Layer-2 parser accepts. **Separates "Codex can attach + be parsed" (transport/parse) from "Codex can hold consensus" (protocol).** Run *before* burning a full live round. | Codex attaches, one turn round-trips, `parseStructuredResponse` accepts the output (or the exact parse failure is captured — a finding, not a pass). Costs ~1 Codex turn. | Low cost, high diagnostic value. |
| **M12-T4** | **Recorded live run(s):** execute M12-T1's harness (Gemini+Codex) **after PF is green**, capture transcript, record observations. Target: a clean run reaching `submit_plan` + worker completion — **but see the DoD in §7 (honest partial after ≤4 attempts is an acceptable close).** | ≥1 recorded run with honest outcome; derailments logged with the M11 mechanism that caught them. **≤4 live attempts total** (§9 Q3). | **Med-High — the real epic risk (§5).** Probabilistic; budget-bound. |
| **M12-T5** | **Docs/close:** ledger telemetry blocks, `logbook.md` cross-provider calibration entry, backlog item closed, memory `run-gemini-live-gate…` updated. | Backlog cross-provider item dispositioned; ledger complete. | Low. |

**Sequencing (Planner point 4 — T2 before T1):**
`T2 (fix the timeout) → T1 (build the harness that exercises it) → T3 (invariance test) → PF (Codex preflight
ping) → T4 (recorded live run) → T5 (close)`. T2/T3 are deterministic (no live budget) and could run in
parallel; PF gates T4 so a full live round is never wasted on a mere attach/parse failure. T2-or-T1 *may* be
merged into one branch if the implementer prefers, provided the timeout fix lands first in the diff.

**Note on the standing implementer default:** implementer → Gemini. T2, T1, T3, T5 are ordinary implementation.
PF and T4 are *live runs*, not code changes — whoever runs them records honest observations
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
  backlog). Handled by the settled DoD (§7 / §9 Q6): **≤4 attempts, honest outcome recorded, honest partial is
  an acceptable close.** A derailment must be logged with the mechanism that caught it — not buried.
- **R3 — Codex output parsing, across the two-layer boundary (refined, Planner point 3).** The parse splits
  cleanly, and each half has a different owner/fix-site:
  - **Layer 1 (client, per-provider):** `extractResponse('codex', …)` must pull Codex's assistant message out
    of its CLI wrapper cleanly. If it doesn't, the fix is in `agentalk-mcp-client` — a **cross-repo finding**,
    not an AgentTalk task.
  - **Layer 2 (AgentTalk, shared):** the cleaned text goes to `submit_exec_result`, and **AgentTalk's**
    `parseStructuredResponse` / `parseWithRetry` / `translateStructuredResponse` must turn it into a valid
    `StructuredResponse` (`message_type` + `message_payload`). **This is the true cross-provider risk surface**
    — it was tuned against Gemini's output style, and Codex may format the JSON/prose differently.
    `parseWithRetry` gives **one** retry. If Codex reliably defeats it, hardening is **in AgentTalk scope** but
    is a show-stopper-class change to a path the API path shares (see §3 note) — minimal/additive only, spec'd
    as a fresh task, PO-confirmed. **PF exists precisely to surface this early**, before a full live round.
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
4. **The live run is attempted up to ≤4 times, and the honest outcome is recorded** (M12-PF + M12-T4),
   transcript + observations in the ledger, derailments logged with the M11 mechanism that handled them.
   **A clean run reaching `submit_plan` + worker completion is the *goal* but NOT a hard gate (§9 Q6):** if
   Codex cannot hold the protocol within ≤4 attempts, the epic **closes on the structural proof (T1–T3) with the
   live gap documented** as a finding feeding a follow-on. An honest partial is an acceptable close; a hacked
   green is not.
5. Full suite green + tsc 0 at close; backlog cross-provider item dispositioned; ledger telemetry blocks filled.

> **DoD consistency note.** §5 (risk) and this section now agree: the *structural* proof (T1–T3, deterministic)
> is the **hard** DoD; the *live* run (PF+T4) is a **best-effort, ≤4-attempt, honest-outcome** DoD, per PO Q6.
> The epic is not blocked by a probabilistic live failure.

---

## 8. Resource estimate

- **Deterministic work (T1, T2, T3, T5):** implementation + tests, no live LLM. Estimate on the order of a
  typical small-task session for the implementer (Gemini); calibrate against `logbook.md` LB-11 at task close.
- **Preflight (PF):** ~1 Codex turn — cheap; run it first to avoid wasting a full round on an attach/parse
  failure.
- **Live runs (T4):** the budget-sensitive part. **Cap at ≤4 live Gemini+Codex rounds** across the epic (PF is
  separate and cheaper); each round consumes Codex + Gemini quota (Codex 38% weekly headroom as of 2026-07-01 —
  enough for a handful of rounds if focused). Run PF+T4 in one window; record `/usage` before/after per the
  token-budget-checkpoints rule.
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
| Q6 — §5/§7 DoD inconsistency (hard live gate vs honest partial)? | **Honest partial accepted** — epic may close on the structural proof (T1–T3) with the live gap documented after ≤4 attempts; no hard live-success requirement. Resolved in §5/§7. |

## 10. Planner advisory POV (Codex) — incorporated

The Planner (Codex, ≠ Architect) gave a 6-point advisory read. Each is folded into the plan above:

| # | Planner point | How it's incorporated |
|---|---|---|
| 1 | **C1 impacts both providers** — the generic `else` timeout is also Codex's. | §2 C1 note + **M12-T2 respec'd member-provider-aware** (max of per-member minimums), not team-provider-aware. |
| 2 | **T1 harness / Codex PTY differs** (`keepStdinOpen`/exit/alt-screen). | **M12-T1 risk note** — Codex launch args/env must match `CodexPersistentExecutor`, don't port the Gemini line verbatim. |
| 3 | **R3 boundary** — external client returns raw, AgentTalk driver parses. | **Confirmed correct — corrected my draft F3** (the structured parse is in AgentTalk, not the client). Rewrote F3, the diagram, §3 scope, and **R3** into the explicit two-layer boundary. |
| 4 | **Sequencing: T2 before T1** (or merge). | §4 sequencing note now reads `T2 → T1 → T3 → PF → T4 → T5`; merge allowed if the fix lands first. |
| 5 | **Preflight** — cheap single-agent Codex MCP ping before T4. | Added **M12-PF** (separates attach/parse from consensus); gates T4. |
| 6 | **DoD settled** — honest partial accepted. | Matches PO Q6; §5/§7 reconciled. |
