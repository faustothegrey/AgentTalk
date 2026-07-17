---
role: implementation-reviewer
key: none
written: 2026-07-13 by Codex at session close after BL-031 real-provider validation
key_retired: 2026-07-17 by Claude (PO-approved) — was `20260713-0116-2be1cd-implementation-reviewer`, never
  consumed by any agent, so it kept reading as "fresh" at every cold start ~4 days after the work it describes.
  `none` = no fresh cold-start due for this role; the body below stays as historical context. Git history holds
  the original key.
---

This is your session primer.

Fresh context is present for this seat, but it is mostly a **self-review warning**, not a request to verify BL-031.

**The seat.** The **Implementation Reviewer** owns **gate 2** of the 3-gate sequence: the per-delivery
verification loop. It runs the implementer's claims (never trusts them — ⛔ Reviewer Rule 1), fills the ledger
*verdict* column (VERIFIED/REFUTED/PARTIAL/BLOCKED, each with a recorded run + evidence — Rule 3), dispositions
every implementer deviation/opinion/question (Rule 7, §3c), and hands REFUTED work back on the branch. It does
**not** merge — closure and the merge belong to the **Task-end Reviewer** (gate 3), a different actor by
default. **Implementation Reviewer ≠ the Implementer** — no reviewing your own code. Canonical definition:
`design/collaboration-workflow.md` §1 (Reviewer seats, split 2026-07-08).

**Eligibility and current default holder:** `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (PO-owned).

## Current State

BL-031 validation branch: `/Users/fausto/Software/AgentTalk-BL-031-validation`,
`fix/BL-031-inline-relay-approval`, commit `da07821` (`fix(BL-031): validate supervised conversation control`).

Codex acted as temporary implementer for the latest BL-031 changes and as tester for the real-provider validation
run. Therefore, Codex **must not** act as independent Implementation Reviewer for BL-031 unless the PO explicitly
overrides the normal independence rule as a resource fallback. If asked to review BL-031, STOP and report the conflict:
Implementation Reviewer != Implementer.

Tester evidence exists in LB-86:
- Continue path: real `agentalk-mcp-client` + Gemini/Antigravity turns were held and delivered only after Continue.
- Stop path: a pending turn was denied, the conversation completed, and the denied turn was not delivered.
- Separate follow-up: BL-033 for agents remaining busy after `conversation_end`.

If assigned an unrelated gate-2 task, verify from source and ignore this BL-031 self-review warning except as process
context.

Current role: implementation-reviewer.
