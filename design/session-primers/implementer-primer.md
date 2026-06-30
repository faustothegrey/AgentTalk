---
role: implementer
key: none
written: 2026-06-30 by Hermes (session close — M11-T1 merged to master)
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration. Your role is **implementer** (Gemini/agy).

2. **Roles.** Fausto = PO/Architect (apex). Hermes = Scrum Master (operational authority, [Hermes] binding). Codex = planner + reviewer (resource fallback, Claude out of budget until Jul 1).

3. **Active epic: M11 — Consensus / Protocol Robustness.** Plan at `design/milestone11-consensus-robustness-plan.md`, approved by reviewer gate 1 (status: `reviewer approved`). Ledger at `design/milestone11-consensus-robustness-implementation.md`.

4. **Your task: SP1 — Affordance-protocol spike.** This is a **read-only spike**: probe agy/Gemini, Codex MCP, and the MCP tool surface for dynamic per-phase affordances. No production code changes. Scope and DoD are in the M11 plan §3 -> SP1. Read it carefully.

5. **Source of truth:** `design/collaboration-workflow.md` (the method). Artifacts: the M11 plan, the M11 ledger, `design/backlog.md`. The implementer Rules of Engagement in AGENT.md (the ⛔ section) are mandatory reading before starting.

6. **Budget:** Gemini at 3% (ample for read-only probes). Codex at 2% weekly. Claude at 92% (unavailable). Check `node scripts/usage.mjs` at start.

7. **Required cold-start behavior.** This primer has fresh key `20260630-0740-M11-SP1`. Compare it to your private store at `~/.config/AgentTalk_Gemini/session-primer-key.json`; if absent, consume it, gather read-only context, report your understanding, then **STOP** for Fausto's explicit go before implementing anything.
