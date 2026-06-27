---
role: planner-reviewer
key: 20260627-0727-6d50bf
written: 2026-06-27 by Claude
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration. It coordinates in-process API providers and externally launched MCP-attached agents through a server-side consensus brain (`packages/runtime-core/src/registry/team-coordinator.ts`): planners debate, submit a plan, then a worker executes.

2. **Roles.** Fausto is the human supervisor and holds the Development Orchestrator / Scrum Master function unless explicitly delegated (Hermes Agent is an allowed delegate when Fausto assigns it). The **planner-reviewer** role can be held by Claude or Codex; Gemini is the normal implementer. This primer is for the **planner-reviewer** role, and the active hand-off is addressed to **Codex** (see §4).

3. **Workflow and source of truth.** Start with `AGENT.md` — FIRST ENTRY POINT, Workflow Rules, the role-declaration / role-boundary rules, Session Primer vs baton, and Honesty over Results. `design/collaboration-workflow.md` is the method. Durable state lives in `*-plan.md`, `*-implementation.md`, `design/backlog.md`, and `design/logbook.md`. The inter-agent bus is the committed artifacts, not chat.

4. **Active objective — pick up the reviewer→Codex baton (docs-only).** Claude (planner-reviewer) reviewed Codex's commit `36cbf81` (role-boundary workflow + T4 probe plan) and recorded the result in **`design/logbook.md` LB-33** (committed at `3640b57`), which ends with a **"Baton — Claude (reviewer) → Codex (author)"** block. That baton is your task: **fix the import specifier in `design/milestone10-t4-live-probe-plan.md` §3 "Implementation approach".** The plan currently tells the implementer to import `buildProtocolToolSchema()` / `parseStructuredResponse()` from `@agenttalk/runtime-core`'s built output, but that package has **no root barrel** — its `package.json` `exports` only exposes subpaths (`./agents/*`, `./registry/*`, …), so a package-root import won't resolve. Pin the exact specifier: `@agenttalk/runtime-core/agents/response-schema.js` (or a direct `dist/agents/response-schema.js` path; note no existing script imports these helpers, so you set the precedent). Docs-only; the probe plan stays **DRAFT for human review** after the fix — do not implement the probe itself.

5. **Where state lives.** Resume from git + the docs, not chat. The review verdict and both findings are in LB-33; the one actionable is the baton block at the end of LB-33. The other LB-33 finding (a stale "uncommitted" status in `design/llm-client-extraction-spike.md`) is **already corrected** in `3640b57` — verify with `git show 3640b57`, no further action needed on it.

6. **Required cold-start behavior.** This primer carries fresh non-`none` key `20260627-0727-6d50bf`. Compare it to your private `consumed` list. If absent: append exactly this key to your private store, gather read-only context, **verify the claims above against the repo** (especially that `3640b57` / LB-33 / the baton exist, and that `master` is ahead of `origin/master`), report your understanding and any discrepancies, **clearly declare your current role at the end**, then **STOP and wait for Fausto's explicit go.** Do not edit, build, test, commit, or push during the cold-start report.

7. **Op notes.** Local `master` is ahead of `origin/master` by 3 unpushed commits (`36cbf81`, `086679a`, `3640b57`) when this primer was written — verify current state. `npm run build` / `npm test` are later implementation gates, not for the cold-start report. Resource meter is best-effort via `node scripts/usage.mjs` (note it, never block). Separate repos (`/Users/fausto/Software/DiagramTalk`, `/Users/fausto/Software/agentalk-mcp-client`) are read-only unless Fausto changes scope.
