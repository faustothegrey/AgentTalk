---
role: planner-reviewer
key: 20260626-1903-737ccd
written: 2026-06-26 by Codex
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration: in-process API providers and externally launched MCP-attached agents coordinate through a server-side consensus "brain" (`packages/runtime-core/src/registry/team-coordinator.ts`). The normal product path is planners debate, submit a plan, then a worker executes.

2. **Roles.** Fausto is the human supervisor: scope, decisions, relay, and merge/closure approval. The **planner-reviewer** role can be held by Claude or Codex, one actor at a time by human choice after the primer report. Gemini is the normal implementer, currently budget-constrained; Codex/Claude may be asked to implement only after explicit scope confirmation.

3. **Workflow and source of truth.** Read `AGENT.md` first, especially **FIRST ENTRY POINT**, **Receiving a Session Primer**, the Implementer/Reviewer Rules of Engagement, and Honesty over Results. The build workflow source of truth is `design/collaboration-workflow.md`. Durable state lives in `*-plan.md`, `*-implementation.md`, `design/backlog.md`, and `design/logbook.md`; do not rely on chat alone.

4. **Active task.** The immediate objective is to verify that the **role-keyed session-primer mechanism works with two planner-reviewers**. The mechanism was introduced in LB-29 and tightened by Codex review in **LB-30**. Commit `c56f115` (`docs(primers): tighten role-keyed handoff edge cases`) is pushed to `origin/master` and clarifies:
   - cold-start primers live in the keyed role-primer file, not unkeyed pasted chat;
   - `key: none` short-circuits to normal human briefing;
   - pasted briefs while `key:none` are normal human briefs, not private-store consume events;
   - Codex is bootstrapped at `~/.codex/agenttalk-session-primer-key.json`; Gemini is still pending first run.

5. **What you must do now.** Because this primer has a fresh non-`none` key, compare `20260626-1903-737ccd` to your private `consumed` list. If it is not consumed, append it to your private store, gather read-only context, verify the claims above against the repo, report your understanding and any discrepancies, then **STOP and wait for Fausto's explicit go**. Do not edit, build, test, commit, or push during this cold-start report. If another eligible planner-reviewer also reports, that is expected; Fausto chooses who proceeds.

6. **Op notes.** Repo should be clean at `master`/`origin/master` with `c56f115` or newer. Gate commands for later implementation work are `npm run build` and `npm test` (baseline recently 245/245), but do not run them during the cold-start report. Resource meter is best-effort via `node scripts/usage.mjs`; note the reading, never block on it. Separate repos (`/Users/fausto/Software/DiagramTalk`, `/Users/fausto/Software/agentalk-mcp-client`) are read-only unless Fausto explicitly changes scope.
