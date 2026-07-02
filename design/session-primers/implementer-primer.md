---
role: implementer
key: 20260702-0722-impl-a1
written: 2026-07-02 by Gemini (session close)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex). Planner: Codex. Reviewer + Architect: Claude (dual-hat this spike).
Scrum Master: Hermes (default). **This primer is for the implementer — Gemini.** 

**Workflow / source of truth:** `design/collaboration-workflow.md`. Your task spec is the **ledger**:
`design/arbiter-shadow-spike-implementation.md` — resume from it, not from chat or this primer.

**Active Epic/Task:** The Arbiter Shadow Spike (BL-009). AS-T1 (Round 3 fixes) has been **VERIFIED ✅ and merged
to master**. The corpus is complete.

**Next steps (you are BLOCKED):**
The next phase is **AS-L1 (Golden Labeling Gate)**. This is a strict PO/Architect gate. The implementer may **NOT** author labels. 
You must wait until AS-L1 is completed and recorded in the ledger. 

Once AS-L1 is done, your next assignment will be **AS-T2 (Shadow arbiter script)**. Do not begin AS-T2 until the Scrum Master or PO explicitly assigns it to you. When you do start AS-T2, review the specification in the ledger carefully (maximum one real LLM call before AS-T3).

**Where state lives:** 
The ledger's claim/verdict table holds the current progression. Wait for `design/arbiter-shadow-corpus/manifest.json` to be populated with golden labels by the PO/Architect.

**Op notes:** 
Your private key store is `~/.config/AgentTalk_Gemini/session-primer-key.json` (agy's `~/.gemini` is ephemeral — don't use it). Poll `node scripts/usage.mjs` at start.
