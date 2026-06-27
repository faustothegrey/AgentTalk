---
role: planner-reviewer
key: 20260627-1017-89ede0
written: 2026-06-27 by Claude (handing planner-reviewer to Codex)
---

This is your session primer.

1. **Project.** AgentTalk is a monorepo orchestrator for multi-agent AI collaboration — in-process API providers
   and externally-launched MCP-attached agents coordinated by a server-side consensus brain
   (`packages/runtime-core/src/registry/team-coordinator.ts`): planners debate → submit a plan → a worker executes.

2. **Roles.** Fausto = human supervisor, holds the **Scrum Master** function (scope, go/no-go, assignment, relay).
   **planner-reviewer** = Claude *or* Codex (co-eligible, one at a time) — **this primer hands the role to Codex**.
   **implementer** = Gemini/agy, which is now **available and bootstrapped** (see op notes). Read `AGENT.md` first:
   FIRST ENTRY POINT, the ⛔ Implementer **and** Reviewer Rules of Engagement, the Scrum Master role + its new
   standing duties (§1), Honesty over Results.

3. **Workflow / source of truth.** `design/collaboration-workflow.md` (the method). Durable artifacts are the bus:
   `*-plan.md` (spec+DoD), `*-implementation.md` (ledger), `design/backlog.md`, `design/logbook.md`. New this
   session: `design/lessons/<agent>-lessons.md` (per-agent self-authored lessons — **skim `codex-lessons.md` at
   start, append to it at close**) and `design/live-test-models.md` (live-test gateways/models).

4. **Active state — a large governance/process overhaul just landed (Claude, 2026-06-27), committed.** Logbook
   **LB-36 → LB-45** is the record. In brief: governance-doc consistency audit (staleness/redundancy, LB-36–39);
   added the **Reviewer Rules of Engagement** and a **standing conditional reassignment** clause; **de-duplicated**
   the Scrum-Master authority rule to one canonical statement + pointers; **bootstrapped Gemini's key store**
   (LB-40); **priming-loop diagram** (LB-41); confirmed **OpenRouter as a live-test gateway** (LB-42); **refined the
   Scrum Master role** — duties/allowances/comms-channel/baton-facilitation (LB-43/44); added **per-agent
   lessons-learned** files (LB-45). All docs-only; no code/test changes.

5. **What's likely next (Fausto assigns — do NOT assume).** Two candidates: **(a)** an **independent review of this
   session's governance changes** — Claude authored them and they have had *no* independent eyes (symmetric to how
   *this* session began, as a review of Codex's work); verify them against the repo without deference. **(b)** Move
   the **M10-T4 live probe** toward implementation: `design/milestone10-t4-live-probe-plan.md` is **READY for Scrum
   Master go/no-go**, and it is newly feasible now that Gemini is available as implementer and OpenRouter is a
   confirmed live gateway. Likely flow: planning round (you) → hand to Gemini.

6. **Where state lives.** Resume from git + the ledgers + logbook (LB-36–45), **not chat**. Latest commit
   `f4c1188`; local `master` is **ahead of origin by 11** (all docs-only this session; **unpushed — push is
   human-gated, do not push without Fausto's go**).

7. **Required cold-start behavior.** This primer carries fresh non-`none` key `20260627-1017-89ede0`. Compare it to
   your private `consumed` store (`~/.codex/agenttalk-session-primer-key.json`). If absent: append exactly this key,
   gather read-only context, **verify these claims against the repo** (don't trust this primer blindly — it's a
   claim about state), report your understanding + any discrepancies, declare your role, then **STOP and wait for
   Fausto's explicit go**. Do not edit/build/test/commit during the cold-start report.

8. **Op notes.**
   - **Gemini available + bootstrapped:** key store at `~/.config/AgentTalk_Gemini/session-primer-key.json`. So
     `implementer → Gemini` is the live default and the **standing conditional reassignment is DORMANT** (it only
     activates while Gemini is unavailable).
   - **OpenRouter live gateway:** `OPENROUTER_API_KEY` is in the env and works. Use
     `meta-llama/llama-3.3-70b-instruct` for reliable cheap pings; the `:free` tier is flaky. See
     `design/live-test-models.md`.
   - **Budget:** best-effort via `node scripts/usage.mjs` (poll your *own* provider at start; never blocking). This
     was a docs-heavy session.
   - Separate repos (`DiagramTalk`, `agentalk-mcp-client`) are out of scope unless Fausto changes scope.
