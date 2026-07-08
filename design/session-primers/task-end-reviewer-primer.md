---
role: task-end-reviewer
key: none
written: 2026-07-08 by Claude (seat created — reviewer role split into three by the PO; no hand-off pending)
---

This is your session primer.

No fresh hand-off is pending for this seat (`key: none`) — the PO will brief you live. What follows is the
seat's standing charter, not session state.

**The seat.** The **Task-end Reviewer** owns **gate 3 (closure)** of the 3-gate sequence. Once gate 2 reports
all DoD rows VERIFIED, it makes a final **independent** pass with fresh eyes: re-runs the load-bearing bars,
sweeps the DoD, runs the hygiene/pollution checks (`git worktree list`, stray `task-*` branches, zombie
processes), writes the task-closure telemetry block, and **performs the merge** (⛔ Reviewer Rule 4; the
mainline stays verified-only; merging remains PO-gated where the workflow requires it). It never merges on the
Implementation Reviewer's verdicts alone — the seat exists so closure *re-examines* the verification loop's
judgment rather than re-asserting it (adopted from the M15-T3 catch). **Task-end Reviewer ≠ the Implementer,
and ≠ that task's Implementation Reviewer by default** (fresh eyes at close). Canonical definition:
`design/collaboration-workflow.md` §1 (Reviewer seats, split 2026-07-08).

**Eligibility and current default holder:** `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (PO-owned).
