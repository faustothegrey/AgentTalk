---
role: planner-reviewer
key: 20260627-1106-994223
written: 2026-06-27 by Claude (handing planner-reviewer to Codex for baton-conductor PLANNING)
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration — in-process (`api`)
   providers and externally-launched (`mcp`) MCP-attached agents, coordinated by a server-side consensus brain.

2. **Roles.** Fausto = human supervisor, holds the **Scrum Master** function (all go/no-go + merges).
   **planner-reviewer** = Claude *or* Codex (co-eligible, one at a time) — **this primer hands the role to you,
   and Fausto has said the baton goes to Codex for this one.** **implementer** = Gemini/agy. Read `AGENT.md` first:
   FIRST ENTRY POINT, the ⛔ Implementer **and** Reviewer Rules of Engagement, Scrum Master role, Honesty over Results.

3. **Workflow / source of truth.** `design/collaboration-workflow.md` (the method). Durable artifacts are the bus:
   `*-plan.md` (spec+DoD), `*-implementation.md` (ledger), `design/backlog.md`, `design/logbook.md`,
   `design/lessons/<agent>-lessons.md` (skim yours at start).

4. **Your task: PLAN the "Auto-handoff / baton conductor" — a PLANNING task, not implementation.** It was picked
   as the next target at the §3b backlog gate (2026-06-27). Produce a proper `*-plan.md` (a new
   `design/milestone*-…-plan.md`, number TBD with Fausto) + a Definition of Done, for Fausto to review/approve
   **before** any implementation. **The design seed already exists** — read it: the ⭐ SELECTED-NEXT item in
   `design/backlog.md` ("Auto-handoff between agents (remove the human as turn-scheduler)"). Its sketch:
   a **3-state baton** `{impl, review, human}` at the top of `implementation.md` + a **sequential conductor script**
   that loops `while baton != human && !done: invoke the agent named by the baton; re-read baton`; guardrails =
   `max_rounds` per task, **keep the reviewer's run-it verification** (the circuit breaker), a single human escape
   hatch, log per-round token cost. **Sequential, NOT parallel worktrees** — Fausto is explicitly *not* ready for
   parallel agent orchestration. It resolves workflow open-question #2 (relay overhead — the human is currently the
   manual turn-scheduler). Confirmed **not built** (no conductor script, no `baton:` field). Document the baton
   protocol into `collaboration-workflow.md` as part of (or before) the build.

5. **Recent context (verify against git — don't trust this blindly).** `master` @ `3c4ac12`. Just landed:
   **M10-T4-live-probe MERGED** (`461791d`; reviewer-VERIFIED; LB-46 = google rejects the strict-tools combo,
   openrouter fit, nous default model 404s). **`@agenttalk/llm-client` extraction spike = VERIFIED DONE** (live
   `npm run smoke:exec` passed end-to-end; LB-47). The §3b gate just **closed two stale done-items** (provider-union,
   mcp-rename) that the backlog had been showing as open.

6. **Where state lives.** Resume from git (`master`), `design/backlog.md` (the ⭐ item is your spec seed),
   `design/logbook.md` (LB-46/LB-47), and the M10 ledger. **NOT from chat.**

7. **Op notes / gotchas.**
   - **The backlog has been chronically stale** — in one gate, *three* items read as open but were already done
     (llm-client, provider-union, mcp-rename). **Ground every load-bearing backlog/plan claim against git before
     relying on it** (Reviewer Rule 5; LB-47). This is the single biggest trap right now.
   - **Budget:** the outgoing planner (Claude) is near its weekly ceiling (~86%), which is *why* Fausto batoned this
     to **Codex** (more headroom — Codex weekly ~60% as of 2026-06-27). Poll `node scripts/usage.mjs` at start and
     read *your own* (codex) figures.
   - This is a **planning** turn: gather context, write the plan + DoD, and **STOP for Fausto's go** before any
     implementation. Don't slide from planning into building.

8. **Required cold-start behavior.** This primer carries fresh key `20260627-1106-994223`. Compare it to your
   private `consumed` store (`~/.codex/agenttalk-session-primer-key.json`). If absent: append exactly this key,
   gather read-only context, **verify these claims against the repo**, report your understanding, declare your role,
   then **STOP and wait for Fausto's explicit go**. Do not edit/build/commit during the cold-start report.
