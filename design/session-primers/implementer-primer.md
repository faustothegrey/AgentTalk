---
role: implementer
key: 20260702-1249-m14-t1-arm
written: 2026-07-02 by Hermes (SM)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane. **Roles:** Fausto is PO. Planner: Codex. Reviewer + Architect: Claude. Scrum Master: Hermes. **This primer is for the implementer — Gemini.**

**Active task: M14-T1 — Identity harness + baseline capture.** The epic is M14 (facilitator extraction), BL-011 (`doing`). Plan at `design/milestone14-facilitator-extraction-plan.md`. Ledger at `design/milestone14-facilitator-extraction-implementation.md` (Gate 1 APPROVED).

**T1 spec:** Build a standalone harness in `scripts/` that drives the engine in-process on deterministic scenarios and captures a normalized identity stream via harness-level listeners. Strip volatile fields (taskId, teamId, timestamps, atMs). Baselines are captured BEFORE the refactor and committed as the identity reference.

- Allowed surfaces: `scripts/` for the harness, `packages/runtime-core/src/registry/` for reading (not modifying), the M14 ledger for claim rows.
- Forbidden: modifying recording/playback infra, weakening any existing test.
- Zero LLM calls.
- Retry budget: full suite max 1, git diff --check max 2.

**Critical:** The Reviewer Gate 1 rule says nothing after T1 starts until the committed baselines and harness command are verified by the reviewer. So commit the harness and baselines on the `m14-t1-<slug>` branch, push, and hand off.

**Op notes:**
- The identity bar is defined in the plan's "The identity bar" section — read it carefully.
- Shared recording/playback infrastructure must NOT be modified. If the harness cannot produce stable output, stop and report.

**Private key store:** `~/.config/AgentTalk_Gemini/session-primer-key.json`. Poll `node scripts/usage.mjs` at start and skim `design/lessons/gemini-lessons.md`.
