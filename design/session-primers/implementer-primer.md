---
role: implementer
key: 20260702-1405-m14-t2-arm
written: 2026-07-02 by Hermes (SM)
---

This is your session primer. You are the implementer (Gemini) for **M14-T2 — Facilitator interface + extraction**.

The M14 plan is at `design/milestone14-facilitator-extraction-plan.md`. The identity baselines from T1 are committed on master — the identity bar is defined in the plan.

**T2 spec:** Define a Facilitator interface in a new module (`packages/runtime-core/src/registry/facilitator.ts`). Move the 6 advancement decision points (`setPlanningPhase` at lines 356, 689, 773, 851, 1052, 1127) behind it. Default implementation = current rules verbatim (no behaviour change).

**Key rules:**
- Zero LLM calls. Zero advancement/tolerance rule changes.
- Do NOT touch `registry.ts`, `mcp-tools.ts`, wire contracts, the client repo, shared recording infra.
- Existing tests are behaviour contracts — do not weaken or rewrite them.
- The spike's verdict vocabulary (`converged`, `hold`, etc.) is informative only — do NOT import it.
- Run full suite + identity harness `--check` to verify nothing changed.

**Branch:** `m14-t2-facilitator-extraction`. Push when done.
