---
role: planner-reviewer
key: 20260627-0831-b02d95
written: 2026-06-27 by Codex
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration. It coordinates in-process API providers and externally launched MCP-attached agents through a server-side consensus brain (`packages/runtime-core/src/registry/team-coordinator.ts`): planners debate, submit a plan, then a worker executes.

2. **Roles.** Fausto is the human supervisor and holds the Development Orchestrator / Scrum Master function unless explicitly delegated. The **planner-reviewer** role can be held by Claude or Codex; Gemini is the normal implementer. This primer is for the **planner-reviewer** role, and the active hand-off is addressed to **Claude** for an independent opinion before Fausto makes a Scrum Master go/no-go decision.

3. **Workflow and source of truth.** Start with `AGENT.md` — FIRST ENTRY POINT, Workflow Rules, the per-turn assignment-compliance rule, role boundaries, Session Primer vs baton, and Honesty over Results. `design/collaboration-workflow.md` is the method. Durable state lives in `*-plan.md`, `*-implementation.md`, `design/backlog.md`, and `design/logbook.md`. The inter-agent bus is the committed artifacts, not chat.

4. **Active objective — review the M10-T4 live probe planning state.** Fausto asked Codex to explain and then plan the T4 live API structured-tools probe before Fausto decides go/no-go. Codex committed the current planning state at `65a7e22` (`docs(M10): ready T4 live probe plan`). Please review, read-only unless Fausto explicitly authorizes otherwise:
   - `design/milestone10-t4-live-probe-plan.md`: now marked **READY for Scrum Master go/no-go** and includes §6 "Implementer task plan" with suggested branch, files in/out of scope, implementation sequence, and verification gates.
   - `design/logbook.md` LB-35: records Codex's correction after Fausto challenged an over-broad logbook entry. The final LB-35 should document the request, what Codex did, why the original logbook entry was wrong, and the amendment.
   - `design/logbook.md` LB-34 + `AGENT.md` + `design/collaboration-workflow.md`: committed at `900a79b`, clarifying that the Scrum Master alone owns role reassignment/de-assignment and go/no-go decisions, and that agents must check assignment compliance each turn.
   - `design/logbook.md` LB-33: prior Claude review that found the T4 probe-plan import specifier issue; Codex fixed that in `900a79b` by pinning `@agenttalk/runtime-core/agents/response-schema.js`.

5. **What Fausto wants next.** Fausto plans to ask Claude's opinion on "all this" before green-lighting a T4 live probe go/no-go. The useful review is likely: whether the T4 probe plan is actually ready for implementer handoff, whether Codex's LB-35 correction is the right documentation discipline, and whether the Scrum Master gate wording is consistent with the workflow. Do **not** implement the probe.

6. **Where state lives.** Resume from git + the docs, not chat. Current mainline before this primer commit was `65a7e22`, with local `master` ahead of `origin/master` by 6 commits. This primer commit may make that 7; verify current state. The active task is planning/review only. Separate repos (`/Users/fausto/Software/DiagramTalk`, `/Users/fausto/Software/agentalk-mcp-client`) are out of scope unless Fausto changes scope.

7. **Required cold-start behavior.** This primer carries fresh non-`none` key `20260627-0831-b02d95`. Compare it to your private `consumed` list. If absent: append exactly this key to your private store, gather read-only context, verify the claims above against the repo, report your understanding and any discrepancies, clearly declare your current role at the end, then **STOP and wait for Fausto's explicit go**. Do not edit, build, test, commit, or push during the cold-start report.

8. **Op notes.** Resource meter is best-effort via `node scripts/usage.mjs` (note it, never block). The T4 live probe itself may spend provider calls only after Scrum Master go/no-go; the current review should not run it.
