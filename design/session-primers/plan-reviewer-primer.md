---
role: plan-reviewer
key: none
written: 2026-07-13 (late) by Claude — session close after the goose arc: dev-executor + BL-041 merged + arbiter consensus WIN (TL-013)
key_retired: 2026-07-17 by Claude (PO-approved) — was `20260713-1839-c7e4a9`, never consumed by any agent, so it
  kept reading as "fresh" at every cold start ~4 days after the work it describes. `none` = no fresh cold-start due
  for this role; the body below stays as historical context. Git history holds the original key.
---

This is your session primer.

**Project (1–2 lines).** AgentTalk orchestrates several *real* heterogeneous LLM agents as one software-development
team that plans/builds/reviews/merges code through a deterministic, auditable MCP substrate, under a human Product
Owner (Fausto) who holds scope + merges. Aim: **self-hosting** — the team improves its own codebase.

**Roles.** Human = PO (apex; scope/direction/merges/relay). Agents: planner, three reviewer seats (plan /
implementation / task-end; no self-review), implementer, architect, Tester. Bindings live **only** in
`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. **This primer is for plan-reviewer — but read the degraded-team note:**

**⚠️ DEGRADED SCRUM TEAM (PO, 2026-07-13, "for the foreseeable future").** **Codex is ruled out** (PO, no reason
given) and **agy/Gemini is broken** (LB-92 attach hang). So **Claude (you) is effectively the SOLE agent, wearing
all hats** (planner + all reviewer seats + implementer + tester + architect + delegated SM) under the
resource-scarcity fallback. Declare your hats loudly each turn; **merges stay PO-gated**; keep each gate's discipline
separately. Do the First Entry Point handshake, verify this brief against the repo, report, and **STOP** for the PO's go.

**Workflow / source of truth.** `design/collaboration-workflow.md` + artifacts: `*-plan.md`/`*-implementation.md`,
`design/backlog.md`, `design/logbook.md` (LB-N), **`design/testlog.md` (TL-N — the running Tester record; TL-013 is
the latest and the big win)**, `design/lessons/claude-lessons.md` (skim at start). Verify-don't-assert.

**Where we are — the goose arc (verify against git; `master` at HEAD; two feature branches UNMERGED, PO-gated).**
Between epics; the day was a testing/experiment arc that ended on a win:
- **goose is a proven dev-capable, vendor-neutral agent.** Integrated as a one-shot OpenRouter-backed executor in
  `agentalk-mcp-client` (branch **`task-goose-executor`**, pushed, **not merged**) + a coordination profile
  (`AGENTTALK_GOOSE_MAX_TURNS`/`_NO_PROFILE`/`_SYSTEM`). **TL-008 pair chat PASS.** goose 1.41.0 via brew.
- **Strict-protocol consensus FAILED across 4 runs (TL-009→012)** — the two-planner message_type handshake
  (opinion→propose→accept→submit) is the wall; deepseek nails schema+content but the choreography doesn't land by
  prompt tuning. **We are NOT pursuing strict protocol now** (PO: later, after research).
- **BL-041 MERGED to master** (`019db72`) — bounded the ack-phase re-request runaway (eject after budget).
- **🎯 TL-013 — ARBITER (semantic) consensus WORKS.** The PO's intended path: planners debate free-form, a
  gpt-4o-mini Judge declares `converged`, a Synthesizer authors the plan. **goose+deepseek reached consensus
  first try.** Enabler: `POST /api/teams` now forwards `consensusMode` (branch **`task-arbiter-enable`**, `d06893f`,
  +2 tests, **not merged**). Caveat: the Judge's convergence bar was **lax** (planners endorsed different ideas, it
  still converged).

**Next up (what to pick up).**
1. **PO merge decisions** on the two unmerged branches: `task-goose-executor` (client repo) and `task-arbiter-enable`
   (AgentTalk). Both validated + tested; merge is the PO's call.
2. **🌟 BL-043 (the PO's next-session experiment):** **Claude-backed MCP client as the Arbiter/Judge, goose agents
   for planners+worker** — a strong judge fixes the TL-013 laxness + first true mixed-provider team. Needs the
   arbiter Judge/Synthesizer made pluggable (today hardcoded `callApi({provider:'openrouter', model:'gpt-4o-mini'})`
   in `arbiter-coordinator.ts`). Depends on `task-arbiter-enable` merging.

**Where state lives.** Resume from `design/testlog.md` (TL-008→013) + `design/backlog.md` (BL-039..043), not chat.

**Op notes / gotchas.**
- `OPENROUTER_API_KEY` set. Models on this account: `openai/gpt-4o`, `openai/gpt-4o-mini`, `deepseek/deepseek-v4-flash`,
  `deepseek/deepseek-chat`, `deepseek/deepseek-r1` all resolve; `anthropic/claude-3.5-sonnet*` and
  `google/gemini-2.0-flash-001` **404** on this account — always probe a model id with a one-word `goose run` first.
- **Run isolated: `PORT=3001 AGENTTALK_MCP_PORT=3011`** (a PO launchd instance may hold :3000 — do NOT reap
  `com.fausto.agenttalk-orchestrator`). Rebuild `npx tsc -b` before an isolated dist run.
- **READ THE RECORDING for ground truth, not your harness summary** — TL-013 nearly got mis-reported as a failure
  because the harness read `currentTask` (the API returns `currentTaskId`); the `AGENTTALK_RECORDING_PATH` ndjson had
  the real success. Hard lesson.
- Teardown with **targeted PIDs**, never broad `pkill`. Harnesses live in the session scratchpad (`tl0NN-*.mjs`).
- Budget at close: claude weekly **78%** (resets Jul 15 ~9am Rome), session ~84%.
