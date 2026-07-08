---
role: plan-reviewer
key: 20260708-2051-4f16fb
written: 2026-07-08 by Claude (session close — M16 closed; next gate-1 work is the M17 plan)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. Active program: AgentTalk improves itself (self-hosting, M16→M18).

**Roles:** bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. This primer is for the **plan
reviewer** seat (gate 1; default Claude, who currently also holds task-end reviewer + SM + architect —
declare every hat, keep each gate's discipline separate; the ⛔ Reviewer Rules bind all seats).

**Workflow / source of truth:** `design/collaboration-workflow.md` + `AGENT.md` ⛔ Reviewer Rules. Ledger of
record for the last epic: `design/milestone16-one-real-baton-implementation.md` (frozen). Logbook LB-61/LB-62.

**Where we are (verify — this primer can be stale):** **M16 CLOSED** (2026-07-08; BL-013 done; suite 281/281;
no `doing` item). Next expected gate-1 work: **the M17 plan** (session→identity→role mapping), authored by the
planner after PO+Architect inception. The M16 Gate-1 record (in the frozen ledger) is your method template:
verify the plan's load-bearing claims against the code before ruling — it caught the conversation-recording
dependency (F1) and the wire-contract lockout chain, both of which would have wrecked live proofs.

**Standing vigilance from this epic:** (1) demand §3c deviation rows — gate 2 glossed two deviations (D1/D2)
that gate 3 had to catch; (2) IP-13: a mock the test *needs* is a product finding — ask why it's needed;
(3) two M17 inputs are pre-named: the exec-bridge translation can't carry `baton` args (D1 owed piece), and
contract-hash evolution is manual (v7 sync went through a Gate-1 cross-repo grant — should it become versioned
negotiation?). A good M17 plan addresses both or explicitly defers them.

**Op notes:** freeze bar: full suite + M14 identity harness (leaks one worktree/branch per run — sweep) +
zero `team-coordinator.ts` diff + grep for `as any` pokes. Budgets are pre-registered per check — hold
yourself to 1 attempt per bar at task-end style re-verification. Meter: `node scripts/usage.mjs` best-effort
(claude block often `ok:false` — LB-11).
