---
role: implementer
key: 20260716-2015-a4c9d1-agyfit
written: 2026-07-16 by Claude (session close — BL-045 last mile PROVEN + agy attach-ban LIFTED; BL-057/058/059/060 filed)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — a deterministic **launcher** takes `{instance, agents[], goal, cap}`, starts an instance, launches the
agent, delivers the goal, machine-enforces a resource cap, and reports.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex + Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely the sole agent under the resource-scarcity fallback: wear every hat, declare each,
keep each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay
PO-gated.** ⚠️ **Do not conflate two different "agy" facts:** agy is UNAVAILABLE as an *agent/Implementer*, but as
an **MCP attach client it is now FIT** (park lifted 2026-07-16 — below). Different things.
**Say the independence caveat out loud in every delivery** — as sole agent you author AND review; green in one
session is not an independent gate, and pretending otherwise is the failure mode.

**⚠️ `git fetch` BOTH repos at startup.** `AgentTalk` and `agentalk-mcp-client`. A past session built a whole
delivery on a checkout 23 commits behind, discovered only at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**, which is where the state is.

## Where we are (2026-07-16 close)

**Bite 0 is complete; agy's attach capability is PROVEN and the LB-92 ban is LIFTED (PO-witnessed).** A real agy,
launched by the real launcher against a **real orchestrator**, attached → `exec_rpc` → real generation →
`submit_work_response` + `submit_work_result` → team **completed**, and the **PO saw `391`** (a *computed* 17×23)
in the Team panel. An earlier probe also wrote `answer.txt` = `391` to disk (tool use proven). Read **LB-94** and
**BL-045**'s closing block — do NOT re-derive any of it.

**🔑 The finding that matters most (BL-057): agy is fixed AND still broken in production, at the same time.** The
verified path is gated on `AGENTTALK_PERSISTENT_MCP === 'true'` (`lib/executor-runtime.mjs:455`, `:546`), and
**nothing outside the test suite sets it**. The fall-through is `{ command: 'agy', args: ['mcp'] }` (`:73-78`) —
and **`agy` has no `mcp` subcommand**, so production still hangs exactly as LB-92 described. **The fix was written
inside the test-only branch** — the same "green tests, broken production" shape LB-93 named as the root cause,
surviving the fix that named it.

**What's next (PO has not chosen — ask).** My recommendation is **BL-057**, specifically **option (b): delete the
flag and the `agy mcp` fall-through outright** rather than set the flag in one more place — the fall-through is
dead code that can only ever hang, and the test-only/production-only split is what caused BL-045. It is a
**behaviour change → PO call**, and it is **code → per-task worktree (PO mandate 2026-07-16)**. Also filed today:
**BL-059** (agy accepts a plan then silently doesn't execute it — team still says `completed`), **BL-060**
(PO-raised: `PORT` is a knob that turns while the UI proxy doesn't follow), **BL-058** (checked-in D1/D3 config's
`cwd` is broken). Open from before: **BL-056** (no durable transcript — *it blocked verification twice in one
day*), **BL-053**, **BL-054** (PO-parked), **BL-050**.

## Op notes / gotchas (each cost real time — most are still live)

- **🔒 Two sandboxes, not one.** `in-process-driver.ts:283` runs `git worktree add` in the **orchestrator's** CWD →
  start it with `cwd=/tmp/att-sandbox` (throwaway git repo). The **worker** is a *separate process* → that's what
  BL-052 fixed via `workdir`. **I polluted the real repo with this on 2026-07-16 having read this exact warning
  hours earlier** — the guard lapses while *debugging*, not while planning. Nothing contains the *orchestrator*
  (BL-052 contains only the worker); BL-054's fence would have refused it.
- **To attach agy at all: `export AGENTTALK_PERSISTENT_MCP=true`** before the launcher — the env flows through
  (`lib/agent-launcher.mjs:145` builds `{ ...process.env, ... }`). Without it you get the `agy mcp` hang. This is
  the whole of BL-057.
- **`completed` is NOT evidence of work.** Observed twice: a vacuous `completed` proving nothing, and agy accepting
  a plan then skipping the work while the team reported `completed` (BL-059). **Design a durable observable and
  check the world** — a *computed* answer on disk (`391`) beats any status field. Pair it: run2-absent vs
  run3-present is what makes it proof.
- **The orchestrator APPENDS a hardcoded clause to every plan** — *"use strictly `git worktree` … otherwise refuse
  and abort"*. It silently turns any non-git task into a **refusal** (agy refused twice, correctly). Give the worker
  a real git repo, or expect a refusal. Related: the worker never lands in the task worktree the `exec_rpc` names —
  it stays in its `workdir` (**BL-053**), so "use a git worktree" is often literally impossible for it.
- **The launcher does NOT exit** when the config has no `startCommand` (it never stops the instance), and the worker
  **outlives the run, squatting on its agent id** → the next run dies on **HTTP 409** that looks like a hang.
  **Use a fresh agentId per run, and kill leftover `llm-agent.mjs` before re-running.** Two "stuck"s on 2026-07-16
  were this, not agy.
- **`workdir` is MANDATORY** on `launchAgent` / configs (`WORKER_WORKDIR`): absolute, must already exist, never
  auto-created. Deliberate fail-closed (BL-052).
- **Dynamic MCP port.** The orchestrator prints `MCP server URL set to: ws://localhost:<PORT>/` **after** "Ready to
  manage agents." Parse it; it is NOT `:3000/mcp`. **Omit `instance.mcpUrl`** unless you started the orchestrator
  yourself (then pass the parsed url and expect the no-exit behaviour above).
- **UI needs the orchestrator on 3000** — `apps/web/vite.config.ts` hardcodes the proxy there; `PORT` moves the
  orchestrator but **not** the UI (**BL-060**). UI dev server: `cd apps/web && npm run dev` → `:5173`. **The PO's
  DiagramTalk also wants 3000** — check `lsof -nP -iTCP:3000` and **ask before touching it**.
- **The PO develops REMOTELY over SSH.** Your Chrome cannot see the dev server's `localhost`. **You cannot witness
  the UI yourself; the PO is the only witness.** The transcript arrives **once** over the socket and cannot be
  refetched (BL-056) — **ask them to open the page BEFORE the run**.
- **agy is fast:** bare `agy --print` = **9.65s**; live worker turn **~14s** — under the 30s healthcheck default.
  The old "22–34s" was **bridge+tool overhead**; the provider-specific 90s timeout is **NOT** needed. *(The PO
  disbelieved the written number and was right — measure, don't inherit.)*
- **`agy --help` is free root-cause tooling** — it lists real subcommands (no `mcp`) at zero LLM cost.
- **`bl040-d1d3.config.json`'s `cwd` is broken** → misleading `spawn node ENOENT` (it's the *cwd*, not `node`); and
  its `"provider": "gemini"` **never launches agy** — `run-d1d3.sh` overrides the command to
  `fake-worker-bridge.cjs`. **Don't read it as agy coverage** (BL-058 / BL-057).
- **🛑 Bare `sleep` in a foreground Bash call is BLOCKED** (silent exit 1) and **`timeout` is not installed**. Put
  waits in a `.sh` file with a poll loop (the `/tmp/wait-*.sh` pattern) or background + read the log.
- **`pkill -f <pattern>` kills its own shell (exit 144)** and `pgrep -f`/`grep` matches the shell running it — a
  "stray agy process" that is really you. Verify with `ps -p <pid> -o args=` before believing it; check the **port**.
- **`rm -rf` is in the settings `deny` list** — use fresh dir names, or `git worktree remove --force` + `git branch -D`.
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**.
- **Env:** both repos built; `claude` + `agy` CLIs authed on PATH; meter `:9899` UP (`node scripts/usage.mjs`).
  At this close: claude weekly **24%**, session ~92% (resets 20:49 Rome); antigravity 4%.

Verify all of the above against ground truth (`git fetch` both, read `design/backlog.md` BL-045 + BL-050→060 and
`design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for the PO's go.
