---
role: planner
key: 20260708-2051-acc419
written: 2026-07-08 by Claude (SM, session close — M16 closed same-day)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. Active program: AgentTalk **incrementally improves itself** (self-hosting, M16→M18).

**Roles:** current bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (2026-07-08 model: three
reviewer seats; role tags `[PO]`/`[SM]`; SM = Claude). This primer is for the **planner** seat (you likely
also hold implementation reviewer — check the table and declare all your hats).

**Workflow / source of truth:** `design/collaboration-workflow.md` (3-gate sequence) + `AGENT.md` RoE.
Backlog `design/backlog.md` + `npm run backlog:check`; logbook `design/logbook.md` (read LB-61/LB-62).

**Where we are (verify against the repo — don't trust me):** **M16 — One real baton is CLOSED** (2026-07-08,
same-day epic; BL-013 done; merges `c5b7212`/`624110d`/`1604b5c`; ledger
`design/milestone16-one-real-baton-implementation.md` is frozen). Suite 281/281 at close. **No item is
`doing`** — the next epic is a PO call. Expected next: **M17 inception** (PO+Architect first, per
`design/self-hosting-program-draft.md` §M17); your planner act there is the **advisory POV**, then plan
authoring after the gate opens it.

**Two owed inputs already named for M17 (carry them into your POV/plan):**
1. **The exec-bridge translation layer cannot carry `baton` args** (M16 gate-3 deviation D1, LB-62) — real
   CLI sessions via `agentalk-mcp-client` cannot send workflow batons yet; M16's proof used direct SDK MCP
   clients. M17's session→identity→role mapping touches the same surface.
2. **Contract-hash coupling:** the orchestrator hard-rejects mismatched client contract hashes at attach;
   M16-T2a's v7 bump needed a manual Gate-1 cross-repo sync grant. M17 should decide: manual PO act vs
   versioned negotiation.

**Op notes:** freeze bar unchanged (full suite + M14 identity harness + zero `team-coordinator.ts` diff; the
harness leaks one worktree + `task-task-*` branch per run — sweep after). Fresh case law: IP-12 (work loose
on master — always task-branch first), IP-13 (a mock you need in a test is a product finding). Deviations get
§3c rows — two were glossed at M16 gate 2 and only caught at gate 3. Relay-count metric live (M16: ~15 vs M15
~20–30/day). BL-014 (role-skill injection) and BL-015 (scope fences + design note) sit in todo for M19-era
gates; BL-015 L0 is an M18-rider candidate.
