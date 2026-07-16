---
role: implementer
key: 20260716-1545-bite0-done
written: 2026-07-16 by Claude (session close — Bite 0 COMPLETE: BL-048/049 UI reactivity + BL-040 D4/D5 accepted live; BL-052 🔴 safety finding open)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — a deterministic **launcher** takes `{instance, agents[], goal, cap}`, starts an instance, launches the
agent, delivers the goal, machine-enforces a resource cap, and reports.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex + Gemini (agy) UNAVAILABLE** (PO, 2026-07-15) → you are
likely the sole agent under the resource-scarcity fallback: wear every hat, declare each, keep each gate
separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated.**

**⚠️ `git fetch` BOTH repos at startup.** `AgentTalk` and `agentalk-mcp-client`. A past session built a whole
delivery on a checkout 23 commits behind, discovered only at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**, which is where the state is.

## 🎉 Bite 0 is COMPLETE (2026-07-16, PO-witnessed)

The launcher now runs a config end-to-end: starts a real orchestrator (parsing its **dynamic** MCP port from
stdout), launches a real agent, delivers the goal via the product's HTTP API, detects the outcome, enforces the
cap. Accepted with two live scenarios: **COMPLETED** (a real `claude` worker answered `pong` — verified in the
*recording*, not the exit code) and **CAP-BREACH** (worker really reaped with SIGTERM). Merged
`agentalk-mcp-client:34eec6a`; `AgentTalk` at `bd69873`. Both repos pushed and clean.

Landed today: **BL-048** (UI reactive to external events + WS keepalive + connection indicator), **BL-049** (teams
resync), **BL-040** (D4/D5). Also merged: the arbiter `consensusMode` enabler and the goose executor.

## 🔴 START HERE — BL-052: the sandbox does NOT contain the worker

**An autonomous worker committed into a real repo.** During the D4 cap-breach run the worker (a real `claude` CLI)
created a worktree + branch **inside the `agentalk-mcp-client` checkout**, wrote files, and **committed**
(`4193a4e`, branch `task-count-1-10000`) before the cap killed it. Not pushed; master unaffected; **left in place
for the PO to inspect — do not delete it without asking.**

Root cause is one line: `lib/agent-launcher.mjs:90` spawns the worker with **no `cwd`**, so it inherits the
launcher's. The `exec_rpc` turn carries `cwd:/tmp/agentalk-task-<id>` but that never reaches the process, while the
worker prompt *orders* it to "use strictly `git worktree`". It obeyed, in the wrong repository.
**`/tmp/att-sandbox` protects the ORCHESTRATOR's cwd only** — the worker is a separate process. Two containment
problems; only one was solved. `agents[].workdir` is accepted by the config and threaded to `launchAgent` —
**verify whether it is honoured at all**; on the evidence it is not.

This is the safety premise of the whole ladder, and **Bite 1 puts an agent in charge of the launcher**. Fix
direction (needs a PO call): explicit `cwd`, and a missing workdir should be a **hard error**, not a silent
inherit. Full detail: **BL-052**.

**Also open, PO-parked:** **BL-051** — the UI shows *that* a run finished but never *what it produced* (the
transcript is already in the browser inside `activeTeamTask`; `TeamSidebar.tsx:152-153` renders only the goal and
the status — one render away). **BL-050** — the Team view doesn't make clear which team you're looking at.
**Next rung after BL-052:** Bite 1 — the agent layer that invokes the launcher and monitors a live session. Do NOT
re-conflate the deterministic launcher with that agent.

## Op notes / gotchas (each of these cost real time)

- **🔒 Sandbox the orchestrator.** `in-process-driver.ts:283` runs `git worktree add` in the orchestrator's CWD.
  Start it with **cwd = a throwaway git repo** (`/tmp/att-sandbox`: `git init` + one commit) — never a real
  checkout. Verified working; the task branch lands there. **But see BL-052: this does not cover the worker.**
- **Dynamic MCP port.** The orchestrator prints `MCP server URL set to: ws://localhost:<PORT>/` **after** "Ready to
  manage agents." Parse it; it is NOT `:3000/mcp`. In a launcher config, **omit `instance.mcpUrl`** — if you set
  it, `startInstance` resolves with the stale value the moment it sees "Ready", before the real url arrives.
- **Team states:** `idle|planning|awaiting_confirmation|working|completed|interrupted|error`. **`failed` and
  `awaiting_operator` DO NOT EXIST** — old notes claim otherwise and would make `waitForOutcome` never resolve.
- **An agent must be `ready` before joining a team** ("must be ready before joining a team"). `launchAgent` returns
  at spawn; ready comes later, when the MCP client connects. The cap race starts **after** `deliverGoal`, so any
  wait in there must be bounded or it hangs outside the anti-hang rail.
- **The worker's result text is not reachable via the API** — tasks have no read endpoint and completing deletes
  `team.currentTaskId`. Read the NDJSON (`AGENTTALK_RECORDING_PATH`) for the transcript.
- **READ THE RECORDING, not your harness summary.** The launcher's exit code says `completed`; only the NDJSON
  proves the worker did real work (`workerAccepted`, transcript). This has nearly caused a false verdict twice.
- **🛑 Bare `sleep` in a foreground Bash tool call is BLOCKED** (silent exit 1). Put waits in a `.sh` file or use
  background + read the log.
- **Teardown with explicit PIDs, and loop over ALL matches** — `pgrep … | head -1` left a second orchestrator
  holding :3000. `pkill -f <pattern>` can match the very shell running it and kill itself (exit 144).
- **The UI dev server proxies `/api` and `/ws` to a hardcoded `localhost:3000`** — the orchestrator must be on
  3000 or the UI sees nothing.
- **Env:** both repos built; `claude` CLI authed on PATH; meter `:9899` UP (`node scripts/usage.mjs`; claude weekly
  **14%**, session 51% at close — ample). **New:** `.claude/settings.local.json` now grants broad tool permissions
  (PO, 2026-07-16) with lethal fs/disk commands in `deny` — you should not be asked to approve routine commands
  any more. **The PO-gates in AGENT.md (merges, behaviour changes) are unchanged and still apply.**
- **No UI test infrastructure, by PO decision (LB-93)** — `apps/web` has none and gets none. The bar for UI work is
  a **live, witnessed run**. Do not file or build test infra for it; do not report its absence as a gap.
- **Live validation must isolate what it claims.** BL-048 was **324/324 green with the bug still live**; the defect
  only surfaced in a PO-witnessed run. And "I saw it appear" proves little — a reload or HMR remount refetches. The
  decisive evidence was watching a **stale entity disappear** on reconnect: broadcasts only add, so only a real
  refetch can remove.
- **Independence caveat:** as sole agent you author AND review. Say so plainly in every delivery; real gate-2 needs
  Codex/agy back or BL-038.

Verify all of the above against ground truth (`git fetch`, read `design/backlog.md` BL-048→052 and `design/
logbook.md` LB-93) before acting. Report your understanding, then STOP for the PO's go.
