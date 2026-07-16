---
role: implementer
key: 20260716-1755-b7f3c2-postfence
written: 2026-07-16 by Claude (session close — BL-052 + BL-055 containment closed live; BL-051 shipped; BL-054 PO-parked)
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
**Say the independence caveat out loud in every delivery** — as sole agent you author AND review; four items
closed green in one session is not four independent gates, and pretending otherwise is the failure mode.

**⚠️ `git fetch` BOTH repos at startup.** `AgentTalk` and `agentalk-mcp-client`. A past session built a whole
delivery on a checkout 23 commits behind, discovered only at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**, which is where the state is.

## Where we are (2026-07-16 close)

**Bite 0 is complete and its safety premise is now proven, not assumed.** Both repos clean, pushed, level with
origin: `AgentTalk:144cc5f`, `agentalk-mcp-client:1800dc4`.

Closed this session (all PO-gated, all with telemetry in their backlog entries):
- **BL-052** (`agentalk-mcp-client:1800dc4`) — 🔴 the containment hole. The worker was spawned with **no `cwd`**
  and inherited the launcher's; during the D4 run it committed into a real checkout. `workdir` *was* honoured
  (env → `llm-agent.mjs` chdir) but was **optional and failed open**, and nothing passed it. Now: `launchAgent`
  refuses a missing/relative/nonexistent `workdir` with **400 before the orchestrator create**, at the
  `launchAgent` boundary (so `POST /agents` is covered), spawns with an explicit `cwd`, and **never auto-creates**
  the dir.
- **BL-055** — the live bar for the above. **PASSED**: a real `claude` worker, launched **from inside the real
  checkout** with the same "use strictly `git worktree`" task, did its work in the sandbox while the real repo
  stayed **byte-for-byte identical**. Both halves of the pair are the evidence; either alone proves nothing.
- **BL-051** (`AgentTalk:f3cffd0`) — the Team panel now renders the worker's **output**, not just its status.
  PO-witnessed: a real worker computed `17*23` and the panel showed **`391`**.

**PO-parked:** **BL-054** (fence: should `workdir` be confined to a blessed root). PO: *"se sono worktree laterali
pazienza per ora"* — **Bite 1 is explicitly allowed to proceed WITHOUT it.** The item already contains the full
design and the **measured** bwrap feasibility — do NOT re-derive it; read it.

## What's next (PO has not chosen — ask)

**Bite 1** — the agent layer that invokes the launcher and monitors a live session. **Do NOT re-conflate it with
the deterministic launcher.** Before it, two items have a live argument behind them:

- **BL-056** (filed today, my recommendation) — a run's output **does not survive a reload**, and past runs are
  unviewable at all. Structural: tasks have **no read endpoint** and completing deletes `team.currentTaskId`. It
  bit me for real today: I could not verify the BL-051 run myself — the worker's answer existed **only** on the
  PO's screen, for one socket connection. Bite 1 is exactly the case where nobody is watching at the right moment.
- **BL-053** — `executor-runtime.mjs` **discards** the `exec_rpc` `cwd` (hardcodes `process.cwd()` at lines 162 /
  679; only 493 honours `sink.cwd`). Per-task isolation the protocol transmits but never applies. Lower priority:
  BL-052 gives each worker *session* an assigned dir, which is enough for now.

Also open, PO-parked: **BL-050** (which team am I looking at). Known warts accepted at the BL-051 merge: the goal
echoes twice in the panel, and there is still **no progress indicator** (a run sits at `working` ~30s with nothing
to watch) — that half of BL-051's complaint was explicitly **not** addressed.

## Op notes / gotchas (each cost real time — most are still live)

- **🔒 Two sandboxes, not one.** `in-process-driver.ts:283` runs `git worktree add` in the **orchestrator's** CWD →
  start it with `cwd=/tmp/att-sandbox` (throwaway git repo). The **worker** is a *separate process* → that's what
  BL-052 fixed via `workdir`. Confusing the two is how the incident happened; `/tmp/att-worker-sandbox` is the
  worker's.
- **`workdir` is now MANDATORY** on `launchAgent` / configs / `explore-launch-worker.mjs` (`WORKER_WORKDIR`). It
  must be **absolute and already exist** — the launcher will not create it. This is deliberate fail-closed.
- **Dynamic MCP port.** The orchestrator prints `MCP server URL set to: ws://localhost:<PORT>/` **after** "Ready to
  manage agents." Parse it; it is NOT `:3000/mcp`. **Omit `instance.mcpUrl`** in launcher configs.
- **Team states:** `idle|planning|awaiting_confirmation|working|completed|interrupted|error`. **Team `failed` /
  `awaiting_operator` DO NOT EXIST.** ⚠️ But **`TeamTaskStatus` *does* have `awaiting_operator`** (contracts
  `types.ts:38-46`) — different enum. Don't conflate them, and don't "correct" one using the other.
- **The worker's result text is NOT reachable via the API** — no task read endpoint; completing deletes
  `team.currentTaskId`. The launcher log holds only the **OUTGOING** prompt (a `work_accept` in it is the
  *instructions*, not the reply). The NDJSON holds **lifecycle events only — no transcript**. Today the answer
  existed *only* in the rendered UI. That's BL-056.
- **🛑 Bare `sleep` in a foreground Bash call is BLOCKED** (silent exit 1). Put waits in a `.sh` file
  (`/tmp/att-sandbox/wait.sh` exists) or background + read the log.
- **`pkill -f <pattern>` kills its own shell (exit 144)** and `pgrep -f` matches the shell running it — a "stray
  process" that is really you. Verify with `ps -p <pid> -o args=` before believing it; check the **port** instead.
- **`rm -rf` is in the settings `deny` list** — use fresh dir names instead of cleaning up.
- **The UI dev server proxies `/api` + `/ws` to a hardcoded `localhost:3000`** — the orchestrator must be on 3000.
- **The PO develops REMOTELY over SSH.** Your Chrome cannot see the dev server's `localhost` — that is not a bug,
  it is a different machine. **You cannot witness the UI yourself; the PO is the only witness.** Set it up, ask
  them to open it **BEFORE** the run (the transcript arrives once, over the socket, and cannot be refetched).
- **Proving the UI socket was connected:** the vite log's `ws proxy error` lines are continuous while the backend
  is down — a **GAP** in them is exactly the window the UI was connected. Cheap, decisive evidence.
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**. Do not
  build or file test infra for it.
- **Design the observation so ONE mechanism explains it.** Today's two wins were built this way: BL-055 =
  *real repo clean* **AND** *sandbox gained the commit* (a broken fix dirties the repo; a refusal leaves the
  sandbox empty). BL-051 = a **computed** answer (`391`), because a hardcoded string would have faked "pong".
- **Env:** both repos built; `claude` CLI authed on PATH; meter `:9899` UP (`node scripts/usage.mjs`; claude weekly
  **15%**, session ~9% at close — ample). `.claude/settings.local.json` grants broad tool permissions with lethal
  fs commands denied.

Verify all of the above against ground truth (`git fetch` both, read `design/backlog.md` BL-050→056 and
`design/logbook.md` LB-93) before acting. Report your understanding, then STOP for the PO's go.
