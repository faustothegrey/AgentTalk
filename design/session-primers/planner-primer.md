---
role: planner
key: 20260708-1422-c13b1b
written: 2026-07-08 by Claude (SM — M16 gate hand-off)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. The active program: AgentTalk **incrementally improves itself** (self-hosting, M16→M18).

**Roles — READ THE TABLE FIRST: `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (new, 2026-07-08).** Governance
changed today (PO acts, commit `789850d`): the single Reviewer is now **three seats** (plan / implementation
/ task-end); all role→agent bindings live **only** in that table; origin tags are now **role tags
`[PO]`/`[SM]`** (legacy `[Human]`/`[Codex]` mapped; details in the Origin Tag Protocol). Your seats:
**planner + implementation reviewer**. **You no longer hold the Scrum Master function** — the PO handed SM
to Claude on 2026-07-08 (see the table's history); `[SM]` messages now originate from Claude via PO relay.
This primer is for your **planner** seat.

**Workflow / source of truth:** `design/collaboration-workflow.md` (now a 3-gate sequence) + the ⛔ Rules of
Engagement in `AGENT.md`. Backlog: `design/backlog.md` (`npm run backlog:check`); this gate's record is the
2026-07-08 entry there, and logbook **LB-61** is the durable decision record.

**Active epic: M16 — One real baton (BL-013 `doing`), opened at the 2026-07-08 backlog gate.** Your
assignment: **author the M16 plan** (`design/milestone16-one-real-baton-plan.md`: spec, DoD claim table,
per-check budgets, fences) from the inception artifact `design/self-hosting-program-draft.md` (§M16 +
§SP-WAKE result). Fixed by evidence and by the gate, not yours to re-litigate:
- Shape: **blocking `await_turn`** (SP-WAKE layer (a) PASS — 600 s idle wake in 3 ms); pull-on-poke is the
  declared fallback, not the design.
- Fence: no new consensus logic, **zero `team-coordinator.ts` diff** (freeze bar = full suite + M14 identity
  harness), no new UI. "Embarrassingly small" is a Gate-1 hand-back criterion — your own advisory caution 2.
- Gate 1 (plan review): Claude, per the assignments table.

**Where state lives:** the backlog gate record + the program draft; the epic ledger
(`design/milestone16-*-implementation.md`) gets created alongside your plan. Not chat.

**Op notes (honor these in the plan):** SP-WAKE caveats — the spike ran against `McpExecServer` in-process,
so M16's live proof must run against the **real orchestrator attach server**; layer (b) (a native CLI
session attaching without the client shim) is M16's **stretch question, not its foundation**. The
relay-count metric is live (counting rule in the draft; M15 baseline ~20–30/day). Serial-actors rule
stands. Resources at hand-off: codex weekly 0% (resets 15 Jul), antigravity 0%, claude fresh (meter
`ok:false` — LB-11).
