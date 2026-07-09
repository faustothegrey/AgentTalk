---
role: plan-reviewer
key: none
written: 2026-07-09 by Claude (session close — M17 closed; next gate-1 work is the M18 plan)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. Active program: AgentTalk improves itself (self-hosting, M16→M18).

**Roles:** bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. This primer is for the **plan
reviewer** seat (gate 1; default Claude, who currently also holds task-end reviewer + SM + architect —
declare every hat, keep each gate's discipline separate; the ⛔ Reviewer Rules bind all seats).

**Workflow / source of truth:** `design/collaboration-workflow.md` + `AGENT.md` ⛔ Reviewer Rules. Ledger of
record for the last epic: `design/milestone17-gate-over-channel-implementation.md` (frozen). Logbook LB-63.

**Where we are (verify — this primer can be stale):** **M17 CLOSED** (2026-07-09; BL-019 done; suite
291/291; no `doing` item). Next expected gate-1 work: **the M18 plan** (self-hosting milestone — one real
dev epic runs on the substrate), authored by the planner after PO+Architect inception. Method template: the
M17 Gate-1 record — verify load-bearing plan claims against the code *before* ruling (the wire-contract
hash check settled tool-vs-metadata in minutes and kept v7).

**Standing vigilance from M17:**
1. **BL-020 is a feasibility landmine for any M18 live proof:** the orchestrator dies on client disconnect
   mid-turn. An M18 plan that runs a real epic on the substrate hits this immediately — it must be in-fence
   (or the plan must explain why not). Same class: BL-017 (real CLI sessions can't send envelopes) is
   probably M18-T1; without it M18's relay≈0 DoD is unreachable.
2. Both M17 gate-3 refutes were **conceptual-boundary** holes (tag≠act; provider `api` ≠ human channel) —
   review authority/trust claims from outside the implementation's own vocabulary.
3. Demand §3c deviation rows and distrust asserted observations — the T3 implementer claimed a UI
   observation it had only inferred; observations must be made, not derived.
4. Port hygiene for live proofs: LB-63 (pick a port free on both address families; 9899 is the meter's).

**Op notes:** freeze bar: full suite + M14 identity harness (leaks one worktree/branch per run — sweep) +
zero `team-coordinator.ts` diff + grep for `as any` pokes. Budgets pre-registered per check — 1 attempt per
bar at task-end-style re-verification. Meter: `node scripts/usage.mjs` best-effort (LB-11); when it's down,
tag telemetry figures as [est] and reconcile later (this session's estimates ran ~10 points low).
