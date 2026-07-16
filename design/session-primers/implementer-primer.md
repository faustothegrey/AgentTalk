---
role: implementer
key: 20260716-2312-27b4ac
written: 2026-07-16 by Claude (session close — BL-062 merged & pushed; agy 2/2 on real code tasks)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, an orchestrator (you) driving a worker (agy) against real backlog
items.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex + Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely sole agent under the resource-scarcity fallback: wear every hat, declare each, keep
each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated —
the PO says "merge" and "push" as separate words.** ⚠️ agy is unavailable as an *Implementer* but is fit as an
*MCP attach client* **and fit to execute** — different things. **Say the independence caveat out loud in every
delivery:** as sole agent you author AND review; BL-062 was closed by one pair of eyes.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). A past session built a whole
delivery on a checkout 23 commits behind and found out at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block
+ telemetry; read those before re-deriving anything.

## Where we are (2026-07-16 close)

AgentTalk mainline `a41891a` (**pushed**); client `508c617`, untouched tonight. Suites: AgentTalk **328/328**,
client 73/73. Nothing is in flight — no branches, no worktrees, clean tree (the modified
`com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing, not yours).

**The ladder started, and rung 1 passed twice.** We ran the real launcher → real orchestrator → real agy against a
real bug, attended. **agy is 2 for 2 on real code tasks**: correct minimal one-line fix, committed, nothing else
touched, ~27s (`db2a464`, then `e1fca14` post-fix). It is fit to execute.

**But read this before you conclude anything from that: both runs were DICTATION, not engineering.** The goal
handed agy the literal string to write. **agy's judgment is still completely unmeasured.** The open question the
ladder exists to answer is untouched.

**BL-062 done** (`70d88c3`) — the rung-1 run's real yield. A worker-only team was handed the *two-agent
plan-review* prompt ("the planner has created a plan for you to review — critically evaluate it") with the goal
synthesized into a stand-in plan, so it arrived twice. **A worker that COMPLIED would change no files and report
`completed` — the BL-059 accusation shape.** agy succeeded despite it, which is exactly why no outcome-based test
ever caught it. Mid-fix a second defect surfaced and the PO widened scope: **`.join('\\n')` is a literal
backslash-n** (charCodes 92,110 — prove it with `node -e`, don't squint at it), so **every** driver prompt,
including the planner's fact-collection one, reached the model as one line with the escape printed as text. Both
fixed. BL-053's contract **moved** (PO-approved) from the EVT payload to the prompt, where its guarantee is now
asserted.

## What's next (PO has not chosen — ask)

- **Rung 2 = BL-056** (durable transcript). The PO deferred it to a **fresh session with full budget** — it's a
  design job (task read endpoint, retain completed tasks, UI) and needs a PO go (LB-93). **Its argument is weaker
  than the item claims:** the launcher's stdout already gives you the prompt + lifecycle durably, and git gives you
  the artifact. What's actually missing is **agy's response text** — which is where the *why* lives when a run
  fails. It matters before *unattended* runs, not attended ones.
- **Rung 1.5 — a HARDER agy task.** Cheaper than BL-056 (spends agy's meter, 3%, not yours) and answers the
  question that matters: can agy handle *judgment*, multiple files, a test suite? Now worth doing because the
  prompt is no longer a confound.
- **BL-058** — still open. **My spec was the wrong call: I told agy to use an absolute path, which pins a
  checked-in config to Fausto's machine. `../AgentTalk` is the portable fix.** agy complied exactly; the spec was
  the weak link, not the worker.
- **New candidate, unfiled:** the **two-agent** path still gets `WORKTREE_CONTEXT` **twice** — driver `:266` +
  `buildWorkerPlan` `:1340` (`GIT_WORKTREE_REQUIREMENT` is the same constant). Same family as BL-062, deliberately
  left out of its scope.
- **BL-060**, **BL-050**, **BL-054** (PO-parked), **BL-036** (worktree discipline detail).

## Op notes / gotchas (starred ones are new tonight)

- **★ The launcher already does the whole run** — `agentalk-mcp-client/scripts/launcher.mjs <config.json>`: boots
  the orchestrator, **parses the dynamic MCP url from stdout**, launches the agent, creates a worker-only team,
  delivers the goal through the product's own API, races a **real cap** (`wallClockMs` + a meter delta), records
  NDJSON. **Don't hand-build a harness — write a config.** Copy `scripts/bl040-d1d3.config.json`'s shape.
- **★ There are TWO launchers. `lib/agent-launcher.mjs` is the low-level worker launch; `scripts/launcher.mjs` is
  the ladder.** I grepped the first for a cap, found none, and told the PO the cap didn't exist. **It does** — it's
  in the second, and the config carries it. Wrong coordinates again (see the lesson below).
- **★ `run-d1d3.sh` forces a fake worker** via `AGENTTALK_PERSISTENT_COMMAND_JSON` → `fake-worker-bridge.cjs`.
  Invoke `launcher.mjs` **directly, without that env var**, and `provider: gemini` gives you real agy. Don't read
  that config as agy coverage.
- **★ Redirect the launcher's stdout to a file — that's your transcript.** It holds the exact prompt the worker
  received, which is how BL-062 was found. The NDJSON holds **lifecycle only** (run-start / agent-launched /
  goal-delivered / outcome). Neither holds agy's **response** (BL-056).
- **★ CHECK THE DIST BEFORE ANY LIVE RUN.** The repo's `dist` was 3 days stale on arrival — a run would have
  exercised **pre-BL-053** code and "proven" something about a system we no longer have. `find packages apps -name
  "*.ts" -not -path "*/dist/*" -newer <a dist file>`, then `npm run build`, then **grep the dist for your change**.
- **★ Worktree `node_modules` — the trap is real, and here is the recipe that works.** Symlink every entry of the
  real `node_modules` individually **plus `.bin`**, but **skip `@agenttalk`**; then create
  `node_modules/@agenttalk/<name>` → the **worktree's** own `packages/*`/`apps/*` (derive `<name>` from each
  `package.json`). `runtime-core` IS resolved via `@agenttalk`, so a blanket symlink makes tests import the **real**
  repo. Baseline the suite before touching anything (325/325 at a326f82).
- **★ Mutation-check every bar.** Break the fix → the bar must fail, alone. All three BL-062 bars were checked this
  way. One command; converts "it's green" into "it would catch the bug".
- **`completed` is NOT evidence** — check the artifact, in **`<workdir>/agentalk-task-<id>/`**. Design the
  observable *before* the run (a computed answer; absent-before/present-after).
- **Two sandboxes.** Orchestrator cwd ≠ worker `workdir`. Give the worker a **throwaway clone** — post-BL-053 the
  orchestrator no longer shells git in its own cwd, so pointing it at the real checkout is safe, but the worker's
  workdir must be a **real git repo** or provisioning **fails the turn** (BL-061, by design).
- **Fresh `agentId` per run; kill leftovers first** — a squatting worker makes the next run die on **HTTP 409**
  that looks like a hang. **But verify before believing in a stray:** mine were a *transient read during teardown*.
  `ps -p <pid> -o args=`, check the port.
- **`workdir` is MANDATORY** on `launchAgent`/configs: absolute, must exist, never auto-created (BL-052).
- **UI needs the orchestrator on 3000** (`apps/web/vite.config.ts` hardcodes the proxy — BL-060). **DiagramTalk
  also wants 3000** — `lsof -nP -iTCP:3000` and **ask before touching it**. **The PO develops REMOTELY over SSH:
  you cannot witness the UI; the PO is the only witness.**
- **🛑 Bare `sleep` in a foreground Bash call is BLOCKED** (silent exit 1) and **`timeout` is not installed.** Put
  waits in a `.sh` poll loop; background long runs and read the log.
- **`pkill -f <pattern>` kills its own shell**; `pgrep -f`/`grep` match the shell running them.
- **`rm -rf` is in the settings `deny` list** — fresh dir names, or `git worktree remove --force` + `git branch -D`.
- **Chained `cd repoA && git push` then `git push`** pushes **repoA twice** and says "Everything up-to-date", which
  reads like success. **Use `git -C <repo>`, and verify with a `fetch` afterwards, not the push output.**
- **Backlog edits:** run **`npm run backlog:check`** (it gates). Valid statuses are **todo · doing · done ·
  dropped · deferred** — *`deferred` is real and widely used; `AGENT.md` says four and is wrong.* The prose status
  token must be **plain**: `- [done · **MERGED …**]`, never `- [**done · …**]`.
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**.
- **Env:** both repos built; `claude` + `agy` CLIs authed on PATH; meter `:9899` UP — poll with
  **`node scripts/usage.mjs`** (never hand-parse). At this close: claude weekly **32%**, session **76%** (resets
  01:49 Rome); codex weekly 35%; antigravity **3%** — agy is nearly free, use it.

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` BL-062 / BL-056 / BL-058
closing blocks and `design/logbook.md` LB-93/LB-94) before acting. Report your understanding, then STOP for the
PO's go.
