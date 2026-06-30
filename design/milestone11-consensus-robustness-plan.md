# Milestone 11 — Consensus / Protocol Robustness — Plan

> **Status:** Proposed — SM decision (Hermes, 2026-06-30, on PO's behalf), pending PO confirmation.
> **Origin:** Follow-on to the old M10 (graded, stateful protocol brain). T1 (ejectPlanner), T2 (graded
> loop), T4 (API enforcement), and Bridge v3 (DiagramTalk overlay) were **done under M10**. The remaining
> work — T3 (single tool), turn-budget/referee, affordance spike, and active re-prompting — gets a fresh
> number here.
> **Old plans:** `design/milestone10-protocol-compliance-plan.md` (thesis), `design/milestone10-phase2-plan.md`
> (T1–T4 implementation breakdown, D1/D2/D3). M10 became the DiagramTalk overlay; these deferred items
> carry forward into M11.
> **Backlog:** The "Failure-modes split → M09 portion stays open" item in `design/backlog.md` is promoted
> here.

---

## 1. Thesis

The old M10 built the **graded, bounded, closed-loop protocol brain**: illegal move → correct + retry (N=2) → peer-safe eject (not dual-kill). That shipped (T1+T2 merged).

What it didn't ship:
- **T3** — single-tool collapse (replacing the 12-tool surface with one `consensus_respond`)
- **Turn-budget / referee** — bound discussion, force-advance or fail the round on non-convergence
- **Affordance-protocol spike** — dynamic skills per phase + phase-scoped MCP toolset
- **Active re-prompting** — the richer tolerance (coerce toward a valid transition, not just soft-reject)

These are the remaining pieces to make multi-agent consensus genuinely robust — not just tolerant (survives), but efficient (succeeds consistently).

## 2. What's already done

| Item | Status |
|------|--------|
| T1 — Peer-safe `ejectPlanner(agentId, reason)` | ✅ merged (`76e5b34`) |
| T2 — Graded loop (correct → retry N=2 → eject) | ✅ merged (`5fea20c`) |
| T3 — Single tool `consensus_respond` | ❌ deferred (D3) |
| T4 — API enforcement (tools + tool_choice + strict enum) | ✅ merged (`d0462b6`) |
| Bridge v3 — DiagramTalk overlay | ✅ merged (`53593a4`) |
| Late-message race tolerance (post-planning stragglers) | ✅ merged (`cf05d50`) — part of M08 |
| Protocol violation soft-reject (isError, not crash) | ✅ merged (`dae80c2`) — part of M08 |

## 3. M11 task breakdown

### T3 — Single tool `consensus_respond(action, payload)`

Collapse `submit_plan` / `agreement_proposal` / `agreement_acceptance` / `fact_collection_end` / `ack_planning_protocol` / etc. into a **single** `consensus_respond(action, payload)` tool. With one tool, the model **cannot call the wrong tool** — a whole failure class disappears for free.

- **Scope:** `translation.ts:11-82` (the `translateStructuredResponse` function map), `STRUCTURED_MESSAGE_TYPES`, and the wire-contract (`wire-contract.json`). Brain reads `action`, validates vs the legal set.
- **Wire-contract change:** bump v5→v6 (or current→v7 if already bumped), recompute hash, **lockstep with `agentalk-mcp-client`**.
- **DoD:** live gate green on ≥1 provider with the new contract; both copies byte-identical.
- **Risk:** hash mismatch rejects all clients — reuse the proven byte-identical + verify-contract + live-handshake procedure from the harness-division spike.

### MT1 — Turn-budget / Referee

Bound discussion: force-advance or fail-the-round on non-convergence after N turns.

- **Scope:** add a turn counter per phase to `team-coordinator.ts`; after `MAX_DISCUSSION_TURNS` without agreement → either force-advance (baton moves despite no agreement) or fail the round cleanly.
- **Relationship to T3:** orthogonal — a model can pick legal-but-wrong actions forever (T3 doesn't prevent looping; referee does).
- **DoD:** deterministic regression test: N turns without consensus → force-advance/fail; N+1 turn never happens. Live observation with a weak model.

### MT2 — Affordance-protocol spike (dynamic skills + scoped toolset)

Investigate whether the brain can dynamically inject a per-phase **skill** + expose only the **legal MCP tools** for that phase, making illegal transitions impossible by construction.

- **Scope:** probes only (spike, no production code). Per-harness test: do `agy`/`codex` respect a **dynamically injected, per-turn** skill? Does MCP toolset scoping (expose only `consensus_respond` with a narrowed `action` enum) actually bind the model, or merely suggest?
- **Non-goals:** no production changes. No milestone opened for this spike. Output: recommendation (implement / defer / drop).
- **DoD:** per-harness findings recorded in spike doc or logbook; a clear go/no-go for implementation in this or a later milestone.

### MT3 — Active re-prompting (richer tolerance)

Currently, an illegal move gets soft-rejected (isError, action discarded). The richer tolerance would **coerce** the offending agent toward a valid transition — e.g. "You sent 'submit_plan' but we're in discussion phase. Your options are: agree, back_off. Please pick one."

- **Scope:** extend the correction message (already sent as a bare "not valid here") to include the **current legal set** in natural language.
- **Relationship to T2:** T2's `parseWithRetry` extension already handles the mechanism; this sharpens the re-prompt content.
- **DoD:** a weak model given an illegal-action probe replies with a valid action after ≤1 correction.

## 4. Decisions needed (PO)

| Decision | Options | Default |
|----------|---------|---------|
| Milestone number | M11 (proposed) | — |
| T3 priority | Before or after MT1/MT2/MT3? | T3 first (it unblocks the cleanest fail-safe surface) |
| MT2 spike timing | Run in parallel with T3, or separate? | Separate (spike is read-only, low risk) |
| Turn-budget N | Tunable constant | Start at `MAX_DISCUSSION_TURNS = 6` |

## 5. Definition of Done (M11)

1. T3: single `consensus_respond` tool live on ≥1 provider; wire-contract hash-verified; old multi-tool surface removed.
2. MT1: turn-budget/referee proven (deterministic test + live observation); discussion bounded, non-convergence handled cleanly.
3. MT2: affordance spike complete with per-harness findings and recommendation.
4. MT3: active re-prompting ships the current legal set on correction; probe test green.
5. Gate: `tsc -b` 0 + full suite green (updated contracts where changed); no pollution (LB-9); telemetry block per task.
6. All ledger entries written; backlog updated.

## 6. Sequencing (proposed)

1. **MT2 (spike)** — read-only, zero production changes, informs later decisions. Run first.
2. **T3** — single-tool collapse. Independent of spike outcome; wire-contract work.
3. **MT3** — active re-prompting. Depends on T3 (the tool vocabulary changes).
4. **MT1** — turn-budget/referee. Depends on T3 (the action set is final). Last, and lowest priority if budget is tight.

## 7. Open items

- PO confirmation of the milestone number and scope above.
- Planner (Codex) to write the detailed task breakdown with file/line scope, retry budgets, and DoD per task.
