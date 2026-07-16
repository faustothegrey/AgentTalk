---
role: implementer
key: 20260716-0740-d4course-impl
written: 2026-07-16 by Claude (session close — BL-039 merged, big reconcile pushed, BL-040 D1/D3 merged + D4 proven live, BL-048 UI spike scoped)
---

This is your session primer.

**Project.** AgentTalk is a multi-agent orchestration system: isolated LLM agents (Claude/Codex/Gemini) attach as
MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a planner→implementer→reviewer
workflow. Current thrust: the **autonomous-development ladder** — Bite 0 → 1 → 2 … A deterministic **(AgentTalk)
launcher** takes a config `{instance, agents[], goal, cap}`, starts an instance, launches the agent(s), delivers the
goal, machine-enforces a resource cap, and reports.

**Roles.** Human = PO (Fausto). Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. **Codex + Gemini
(agy) UNAVAILABLE** (PO, 2026-07-15) → **Claude is the sole agent**, resource-scarcity fallback: you wear every hat,
declare each, keep each gate separate; **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges
stay PO-gated.** This primer is for the **implementer** thread.

**⚠️ DO THIS FIRST — `git fetch` both repos at startup.** Last session's biggest trap: the local checkout was **23
commits behind** an active `origin/master` with a **4-way BL-037..040 ID collision**, only discovered at push time.
`git fetch origin` in BOTH `AgentTalk` and `agentalk-mcp-client` before trusting any doc or building on local state.
(That divergence is now reconciled + pushed — but make fetching a reflex.)

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — resume from the **backlog** (BL-037..040, BL-048) and the two
design docs: `design/bite0-autonomous-launch-plan.md`, `design/spike-ui-external-events.md`.

**Where things stand (all pushed except noted):**
- **BL-039** (NDJSON D6) — DONE, merged `agentalk-mcp-client:9090f37`.
- **Reconcile** — two dev lines converged; Bite 0 kept BL-037..040, origin's OpenRouter/tester items → BL-044..047.
  Pushed. Backlog validates (`node scripts/validate-backlog.mjs`, 48 items).
- **BL-040 D1/D3/D6 slice** — MERGED `agentalk-mcp-client:1e80ef6`: `scripts/launcher.mjs` real-deps entrypoint
  (real `startInstance` parses the DYNAMIC MCP url from orchestrator stdout; BL-037 launch; meter; NDJSON). Verified
  live (attach + wall-clock cap termination).
- **BL-040 D4** — **mechanism PROVEN live + sandboxed** (babysat probe) but **NOT yet baked into the launcher**
  (`deliverGoal`/`waitForOutcome` are still stubs). Real `claude` worker completed a trivial goal correctly.
- **BL-048** — UI-reactivity spike SCOPED (`design/spike-ui-external-events.md`); the UI doesn't show
  externally-created agents. Not built.
- **Unpushed:** `AgentTalk` master is **ahead of origin** (vite-host `abf5fcd`, spike/backlog `24a817d`, and more) —
  the PO had not said "push" for these at close. `agentalk-mcp-client` master IS pushed (`1e80ef6`).

**FUTURE DEV COURSE (PO-laid, 2026-07-16 — the plan for next sessions):**
1. **BL-048 first — make the UI reactive to external events** so the PO can *witness* runs. Minimal fix (root-caused
   in the spike doc): emit `agent_registered` in `registry.ts` → `broadcast({type:'agent_added'})` in `server.ts` →
   frontend `case 'agent_added'` upserts the agent; audit team/task rendering. Do it in a **git worktree**.
2. **Then resume BL-040 D4/D5 with UI observability** — bake into `scripts/launcher.mjs`:
   `deliverGoal` = `POST /api/teams {members:[{agentId,role:'worker'}]}` (worker-only) + `POST /api/teams/:id/task
   {description}`; `waitForOutcome` = poll `GET /api/teams` for `team.status === 'completed'` (/`failed`/
   `awaiting_operator`). Then the deterministic acceptance: one COMPLETED + one forced cap-breach, sandboxed,
   witnessed in the UI. That closes Bite 0 (D2/D4/D5).
3. **Bite 0 complete → Bite 1** (the *Hermes* agent layer that invokes the launcher + monitors a live session —
   deferred, a distinct future bite; do NOT re-conflate the launcher (deterministic) with Hermes (an agent)).

**CRITICAL OP NOTES / GOTCHAS:**
- **🔒 SANDBOX THE ORCHESTRATOR.** `in-process-driver.ts:283` runs `git worktree add /tmp/agentalk-task-<id> -b
  task-<id>` **in the orchestrator's CWD**. Start the orchestrator with **cwd = a throwaway git repo** (last session
  used `/tmp/att-sandbox`, `git init` + one commit) — **NEVER the primary AgentTalk checkout**, or every task creates
  real `task-*` branches/worktrees in your repo. (Bring-up: `cd /tmp/att-sandbox && AGENTTALK_RECORDING_PATH=… PORT=3000
  node <primary>/apps/orchestrator/dist/index.js`.)
- **Dynamic MCP port.** The orchestrator prints `MCP server URL set to: ws://localhost:<PORT>/` AFTER "Ready to
  manage agents." — parse it from stdout; it is NOT the fixed `:3000/mcp`.
- **Worker provider.** BL-037 uses one `provider` for both the orchestrator record AND the harness CLI. The harness
  rejects `provider:'mcp'` (wants claude/gemini/codex). Use a real provider; a fake bridge
  (`AGENTTALK_PERSISTENT_COMMAND_JSON`) overrides the actual CLI for hermetic D1/D3.
- **Capturing worker output.** Until BL-048, the UI shows nothing for API-driven runs — set
  `AGENTTALK_RECORDING_PATH` and read the NDJSON (`team_task_updated` events carry the transcript + `work_accept`).
- **🛑 Bash tool BLOCKS bare `sleep`** in foreground commands (they silently fail, exit 1, no output). Put waits
  inside `.sh` files, or use `run_in_background` + read the output file. This ate several turns last session.
- **Env is READY on this machine:** main repo built (`node_modules` + `dist` present; `npm run backlog:check`/`tsc -b`
  clean); `claude`/`codex`/`gemini` CLIs authed on PATH; meter `:9899` UP (`claude` weekly ~5%, session ~43% at
  close — ample). `node scripts/usage.mjs` works.
- **Scratch tool:** `agentalk-mcp-client:scripts/explore-launch-worker.mjs` (UNTRACKED) launches one real worker
  against a running orchestrator — handy for D4 probing.
- **Independence caveat:** you author AND review as sole agent. Flag it; real gate-2 needs Codex/agy back or BL-038.

Verify all of the above against ground truth (`git fetch` + read the backlog + the two design docs) before acting.
Report your understanding, then STOP for the PO's go.
