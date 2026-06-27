---
role: planner-reviewer
key: 20260627-0709-d26bd9
written: 2026-06-27 by Codex
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration. It coordinates in-process API providers and externally launched MCP-attached agents through a server-side consensus brain (`packages/runtime-core/src/registry/team-coordinator.ts`): planners debate, submit a plan, then a worker executes.

2. **Roles.** Fausto is the human supervisor and currently holds the Development Orchestrator / Scrum Master function unless explicitly delegated; Hermes Agent is an allowed Scrum Master delegate when Fausto assigns it. The **planner-reviewer** role can be held by Claude or Codex; Gemini is the normal implementer. This primer is for the **planner-reviewer** role.

3. **Workflow and source of truth.** Start with `AGENT.md`, especially FIRST ENTRY POINT, Workflow Rules, Session Primer, the new role-declaration / role-boundary rules, and Honesty over Results. `design/collaboration-workflow.md` is the method. Durable state lives in `*-plan.md`, `*-implementation.md`, `design/backlog.md`, and `design/logbook.md`.

4. **Active objective.** Review Codex commit `36cbf81` (`docs(process): record role-boundary workflow and T4 probe plan`). It is docs-only and includes:
   - AGENT.md: startup reports must loudly declare current role; out-of-role requests must stop and ask the Development Orchestrator / Scrum Master for a course-of-action decision; Fausto is the default Scrum Master; Hermes Agent may be delegated by Fausto.
   - `design/collaboration-workflow.md`: generic Scrum Master function for task-assignment ambiguity, without naming Fausto as holder.
   - `design/logbook.md`: LB-31 status-correction findings and LB-32 role-boundary escalation record.
   - `design/milestone10-t4-live-probe-plan.md` plus `design/backlog.md`: promoted plan for a script-only M10-T4 live API structured-tools probe. It is **DRAFT for human review**, not implementation approval.
   - Status corrections for Bridge v3 and mcp-exec-server records now matching git (`53593a4`, `b67a6ce`, `e3f85c4`, `4fb2a69`).

5. **Where state lives.** Resume from the docs and git, not from chat. Current local `master` is ahead of `origin/master` by at least commit `36cbf81` when this primer was written; verify the current state. The planner-reviewer primer itself may be an additional local change/commit depending on how Fausto launched you.

6. **Required cold-start behavior.** Because this primer has fresh non-`none` key `20260627-0709-d26bd9`, compare that key to your private `consumed` list. If it is absent, append exactly this key to your private store, gather read-only context, verify the claims above against the repo, report your understanding and discrepancies, clearly state your current role at the end, then **STOP and wait for Fausto's explicit go**. Do not edit, build, test, commit, push, or start implementation during the cold-start report.

7. **Op notes.** `npm run build` and `npm test` are later implementation gates, but do not run them during the cold-start report. Resource meter is best-effort via `node scripts/usage.mjs`; note the reading and never block on it. Separate repos (`/Users/fausto/Software/DiagramTalk`, `/Users/fausto/Software/agentalk-mcp-client`) are read-only unless Fausto explicitly changes scope.
