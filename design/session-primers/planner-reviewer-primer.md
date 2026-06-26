---
role: planner-reviewer
key: 20260626-1951-e6d338
written: 2026-06-26 by Codex
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration. It coordinates in-process API providers and externally launched MCP-attached agents through a server-side consensus "brain" (`packages/runtime-core/src/registry/team-coordinator.ts`): planners debate, submit a plan, then a worker executes.

2. **Roles.** Fausto is the human supervisor: scope, decisions, relay, and merge/closure approval. The **planner-reviewer** role can be held by Claude or Codex; both are eligible, but the human chooses who proceeds after any fresh-primer report. Gemini is the normal implementer, currently budget-constrained, so Claude/Codex may implement only after explicit scope and procedure confirmation.

3. **Workflow and source of truth.** Start with `AGENT.md`, especially **FIRST ENTRY POINT**, **Receiving a Session Primer**, **Workflow Rules**, and **Honesty over Results**. `design/collaboration-workflow.md` is the method. Durable state lives in `*-plan.md`, `*-implementation.md`, `design/backlog.md`, and `design/logbook.md`. `design/implementer-pitfalls.md` is case law and now includes **IP-9**, the lesson from Codex's first session: never optimize by deviating from workflow; if a deviation seems useful, STOP, explain, and ask Fausto first.

4. **Where the repo stands.** Codex completed the first planner-reviewer onboarding/session. The role-keyed primer mechanism was introduced in LB-29, tightened in LB-30, and then hardened with the new canonical trust rule in `AGENT.md` plus `design/implementer-pitfalls.md` IP-9. Local `master` includes commit `41e766b` (`docs(process): record workflow-deviation trust rule`) after `96ac187` (`primer(planner-reviewer): arm role-keyed cold start`). At the time this primer was written, local `master` was ahead of `origin/master`; verify current git state before reporting.

5. **Active objective.** The immediate objective remains validating the role-keyed priming mechanism with two planner-reviewers. Because this primer has a fresh non-`none` key, compare `20260626-1951-e6d338` to your private `consumed` list. If it is absent, append exactly this key to your private store, gather read-only context, verify these claims against the repo, report your understanding and discrepancies, then **STOP and wait for Fausto's explicit go**. Do not edit, build, test, commit, push, or start feature work during the cold-start report.

6. **Op notes.** Gate commands for later implementation work are `npm run build` and `npm test` (recent baseline 245/245), but do not run them during the cold-start report. Resource meter is best-effort via `node scripts/usage.mjs`; note the reading and never block on it. Separate repos (`/Users/fausto/Software/DiagramTalk`, `/Users/fausto/Software/agentalk-mcp-client`) are read-only unless Fausto explicitly changes scope.
