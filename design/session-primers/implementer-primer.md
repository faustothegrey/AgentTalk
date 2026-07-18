---
role: implementer
key: 20260719-0118-a7d4f2
written: 2026-07-19 by Claude (session close — RUNG 4 CLEARED: goose autonomously fixed BL-046, merged + pushed)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely sole agent under the resource-scarcity fallback: wear every hat, declare each, keep
each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated —
the PO says "merge" and "push" as SEPARATE words and means it** (held all session — stop at each, wait for the
literal word). **Independence caveat, say it in every delivery:** as sole agent you author AND review — what
actually catches things is *running the code* (and, for a cross-repo seam or an autonomous run, checking the
*artifact*), never re-reading your own diff or trusting a status field.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). Verify HEAD against `origin/master` —
never trust a primer's hash.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
Plans for a BL live in `design/bl0NN-*-plan.md`. Closed slices carry a closing block + telemetry in the backlog
item — read those first. **Resume from the backlog + design/plan docs, NOT chat.**

## Where we are (2026-07-19 close)

**AgentTalk master `eb1716a` (pushed — verify via `git fetch`). Client `agentalk-mcp-client` master `79b6268`
(unchanged, pushed).** No worktrees/branches of ours left (rung-4 sandbox + task-BL-046 torn down). PO's `.plist`
shows modified — leave it. Stand up your own orchestrator on **3100** (`PORT=3100 npm run dev` → backend 3100 +
vite 5173; the MCP port is DYNAMIC, announced in backend stdout as `MCP server URL set to: ws://localhost:<port>/`).

**Just shipped (PO-gated, merged + pushed): RUNG 4 of the autonomous-development ladder.** A **goose /
claude-sonnet-5** worker, launched by the deterministic Bite-0 launcher over the MCP substrate into a sandbox,
**autonomously produced + committed a correct, type-clean, tested fix to AgentTalk's own code** — **BL-046** (`POST
/api/agents` forwards `providerName`), merge `216c664`, crediting goose. Independently graded by running it (tsc 0,
suite 208/208, an independent mutation-checked bar red→green). This is the first real "AgentTalk improves AgentTalk"
datum. Plan/record: `design/rung4-plan.md`; capstone note appended to `design/self-hosting-program-draft.md`.

## What's next — PO picks (no fresh task assigned; report + STOP for the PO's go)

1. **More rungs / a real multi-task epic on the substrate, measured** — rung 4 is a *datum, not the trend*; the
   program's ultimate claim (a measured fall in the PO's relay burden across a real dev epic) is still unproven.
2. **Fix the rung-4 findings** (all `todo`): **BL-075** (goose ignores its assigned task-worktree `cwd` — works in
   the workdir main tree; only gemini honours cwd, BL-053), **BL-076** (goose's worker report doesn't survive the
   worker protocol — work lands, report is lost; BL-042/TL-009 family), **BL-077** (web UI froze at `starting` —
   `ready`/`busy` status transitions aren't broadcast to connected clients).
3. **The deferred BL-024 T3b-2 remainder** (drop legacy `provider` *input*; migrate ~12 scripts + a recordings
   shim) — still open, still not needed for goose. See `design/bl024-t3b-plan.md` §4.

## Op notes / gotchas (hard-won this session)

- **`completed` ≠ done (BL-062) — NEVER trust the team status field for an autonomous run. Check the ARTIFACT.**
  And check it at the RIGHT coordinates: **goose works in its `workdir`'s MAIN tree, not the assigned
  `agentalk-task-<id>` worktree** (it ignores the forwarded cwd — BL-053/BL-075). I mis-graded a good run as "no
  work" by checking the empty worktree. Look in the main tree too.
- **Running a real goose worker (the rung vehicle):** the **Bite-0 launcher** — `agentalk-mcp-client:scripts/
  launcher.mjs <config.json>` — boots/uses an orchestrator, launches ONE goose agent into a **worker-only team**,
  delivers the goal, enforces a wall-clock cap, records NDJSON. Template: `runs/rung4.config.json`. Config agent
  needs `provider:"goose"` + an explicit **`model`** (BL-024 T3b) — **`anthropic/claude-sonnet-5` over OpenRouter is
  verified working** (`OPENROUTER_API_KEY` is set; goose CLI 1.41.0 present). For a REAL code task: set
  **`AGENTTALK_GOOSE_MAX_TURNS=150`** (default 30 starves it) and **wire `node_modules` into the sandbox** so goose
  can run `tsc`/`vitest` and self-verify.
- **Sandbox discipline:** goose's `workdir` must be a **throwaway git checkout of AgentTalk** (a local clone) — never
  the primary checkout. Post-BL-053 the orchestrator no longer creates worktrees in its own cwd, so the orchestrator+UI
  can run from the primary safely; the sandbox is only the worker's `workdir`. Tear down the sandbox + any nested
  `agentalk-task-*` worktrees at close.
- **Grading discipline (honest bar):** pre-register a mutation-checked hidden test in a real `task-<id>` worktree
  (`node scripts/wt-setup.mjs create <id> --base origin/master`), confirm it's RED, then apply the worker's fix and
  verify RED→GREEN + `tsc -b` (exactOptionalPropertyTypes!) + full suite, by RUNNING them.
- **Tests:** AgentTalk `npx vitest run` (orchestrator suite 208 as of BL-046); `tsc -b` uses
  `exactOptionalPropertyTypes` (optional fields must not receive `undefined` — a conditional spread
  `...(x ? { x } : {})` is the fix goose used). `npm run backlog:check` gates the backlog (it catches header/prose
  status drift — update BOTH). Stage files EXPLICITLY, never `git add -A`.
- **Meter:** `node scripts/usage.mjs` (best-effort). The `claude` block returned **ok:false all session** (LB-11) —
  budget telemetry was unavailable; don't block on it.

Verify all the above against ground truth (`git fetch` both; read BL-046's closing block + `design/rung4-plan.md`)
before acting. Report your understanding, then STOP for the PO's go.
