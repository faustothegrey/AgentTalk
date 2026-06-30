# Milestone 11 — Consensus / Protocol Robustness — Implementation Status

> **Plan:** `design/milestone11-consensus-robustness-plan.md`
> **Opened:** 2026-06-30 (SM Hermes, PO Fausto confirmed)
> **Old plans:** `design/milestone10-protocol-compliance-plan.md` (thesis), `design/milestone10-phase2-plan.md` (T1–T4 breakdown)
> **Previous work (done under M10):** T1 (ejectPlanner), T2 (graded loop), T4 (API enforcement), Bridge v3 — all merged to `master`.

**Baseline before M11:** `master` `5cd03df`, check `tsc -b` + suite before first task.

## Task ledger

| Task | What | Status |
|------|------|--------|
| **MT2** | Affordance-protocol spike (per-harness probe: dynamic skills + scoped toolset) | ⬜ not started |
| **T3** | Single tool `consensus_respond(action, payload)` — wire-contract v5→v6, lockstep client | ⬜ not started |
| **MT3** | Active re-prompting (current legal set in correction message) | ⬜ not started |
| **MT1** | Turn-budget / Referee (bound discussion, force-advance on non-convergence) | ⬜ not started |

## Reviewer gate 1 — plan review

**2026-06-30 — Codex reviewer verdict: REFUTED ❌**

Evidence run/read:
- `git rev-parse --short HEAD` → `5cd03df`; baseline line is correct.
- `git status --short --branch` → `master...origin/master [ahead 16]` with only the M11 docs modified.
- Read `design/milestone11-consensus-robustness-plan.md` and checked cited files/line ranges with `wc -l` / `nl -ba`.
- `git diff --check -- design/milestone11-consensus-robustness-plan.md design/milestone11-consensus-robustness-implementation.md` → clean.

Gate findings:
1. **MT2 file/line scope is not precise enough.** The plan cites
   `/Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs` and
   `/Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs` without line ranges. The actual useful spans
   are discoverable (for example `mcp-client.mjs:20-38` handshake, `mcp-client.mjs:97-99` tool calls,
   `executor-runtime.mjs:25-38` execution-mode routing, Gemini around `380-610`, Codex around `627-760`,
   executor factory around `811-832`) and should be recorded before approval.
2. **MT1 DoD is internally inconsistent.** The MT1 task text makes live observation optional ("if budget allows"),
   while the milestone DoD still requires "deterministic test + live observation". Pick one gate. If live is required,
   it needs a concrete command/provider/retry rule; if it is observational, the milestone DoD must say so.
3. **T3 leaves a gate-level implementation decision open.** The plan says to decide during implementation whether the
   API structured-tool schema stays `respond(message_type,message_payload)` or adopts
   `consensus_respond(action,payload)`. That is an implementation-affecting contract decision and should be settled
   in the approved plan before T3 starts, or explicitly split into a reviewer-approved T3 preflight decision.

What is acceptable:
- The sequence MT2 → T3 → MT3 → MT1 is sound.
- Retry budgets are generally reasonable once the DoD inconsistency above is resolved.
- Baseline commit `5cd03df` is correct.

**2026-06-30 — Codex reviewer verdict after planner corrections: VERIFIED ✅**

Evidence run/read:
- Re-read `design/milestone11-consensus-robustness-plan.md` after corrections.
- `wc -l /Users/fausto/Software/agentalk-mcp-client/lib/mcp-client.mjs /Users/fausto/Software/agentalk-mcp-client/lib/executor-runtime.mjs`
  confirmed the cited client ranges exist (`107` and `837` lines respectively).
- `git rev-parse --short HEAD` → `5cd03df`; baseline remains correct.
- `git diff --check -- design/milestone11-consensus-robustness-plan.md design/milestone11-consensus-robustness-implementation.md`
  → clean.

Disposition of prior blockers:
1. **MT2 file/line scope** — VERIFIED: `mcp-client.mjs:20-38`, `mcp-client.mjs:86-99`,
   `executor-runtime.mjs:25-38`, `executor-runtime.mjs:811-837`, `executor-runtime.mjs:380-615`, and
   `executor-runtime.mjs:627-768` are now listed.
2. **MT1 DoD consistency** — VERIFIED: live referee observation is now required, with one attempt on one available
   fit provider and explicit reviewer/PO deferral if quota/provider is unavailable.
3. **T3 API schema naming** — VERIFIED: M11 keeps API `respond(message_type, message_payload)` and translates
   post-parse to MCP/runtime `consensus_respond(action,payload)`.

Gate 1 outcome: **plan status updated to `reviewer approved`; MT2 is ready for implementer handoff.**
