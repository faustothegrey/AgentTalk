---
role: implementer
key: 20260717-0702-7afc17
written: 2026-07-17 by Claude (session close — rung 1.5 run: agy's first REAL engineering task, not dictation)
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
delivery:** as sole agent you author AND review. Rung 1.5 is a live example of why that matters: I designed the
task, graded it, and my grading instrument was wrong (below).

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). A past session built a whole
delivery on a checkout 23 commits behind and found out at push time.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
No `*-implementation.md` ledger for this thread — **resume from the backlog**. Closed items carry a closing block
+ telemetry; read those before re-deriving anything.

## Where we are (2026-07-17 close)

AgentTalk mainline `d46234d` + this session's docs commits; client `508c617`, untouched. Suite **328/328**.
**Nothing merged, nothing pushed, no branches, no worktrees in either repo.** The modified
`com.fausto.agenttalk-orchestrator.plist` is the PO's, pre-existing, not yours.

**Rung 1.5 ran, and it is the first REAL measurement of agy's judgment.** Rung 1 was **dictation** (agy was handed
the literal string). Rung 1.5 handed it only a *symptom* — no file, no line, no answer — against a real defect I
had first proven live. **Verdict: agy can engineer. Its bars cannot be trusted.**

- ✅ **The fix was correct and path-complete.** In ~144s agy located the mechanism across 3 files and chose the
  non-obvious fix, avoiding the trap: the *obvious* fix (delete the driver's copy) leaves `arbiter-coordinator`
  still duplicating. agy instead deleted the append from **both** coordinators, leaving the driver the single
  source. runtime-core **97/97 green**.
- ❌ **Its regression test is VACUOUS — mutation-proven.** The goal explicitly demanded a test that fails before and
  passes after. agy's test feeds the driver a **raw** plan, but the duplication never lived in the driver — it came
  from the *coordinator* appending before the driver saw it. I restored the bug completely and **agy's test still
  passed.** It is the *same false-assurance shape the codebase already had* at `in-process-driver.test.ts:218-219`,
  which is exactly why the bug survived. **The worker inherits the codebase's blind spots.**
- ⚠️ Left an **unused import** (`WORKTREE_CONTEXT`, `team-coordinator.ts:7`) + a stray blank line in the arbiter.

**⛔ READ THIS BEFORE YOU JUDGE ANY agy RUN — I nearly filed BL-059 all over again.** My pre-registered probe
printed `2` *after* agy's correct fix, which reads as "the fix failed." **It didn't — my probe was invalid.** The
probe hardcoded the *pre-fix* plan shape (`plan + WORKTREE_CONTEXT`, i.e. old `buildWorkerPlan` output), and agy
had **deleted `buildWorkerPlan`**. It fed the driver an input that can no longer occur and counted a duplicate it
manufactured itself. **A pre-registered probe encodes the OLD world; a correct fix can INVALIDATE the measurement
rather than fail it.** Before believing any post-fix number: **ask whether the probe's INPUT still exists after the
change.** Mutation-checking is the only thing that caught it.

## What's next (PO has not chosen — ask)

- **BL-063 — UNFILED. File it first; it is not in `backlog.md`.** agy's fix is genuinely good and worth having, but
  it must come back as a proper task: it needs the **real integration test agy didn't write** (one that drives the
  *coordinator→driver* path, not the driver alone — that is the whole point, and the missing coverage is the bug's
  cause), plus the unused import cleaned up. **Do not merge agy's patch as-is.** Independence: it should be
  reviewed by someone who didn't design the task — flag the conflict to the PO if that's still you.
  **Artifacts preserved (durable, gitignored) in `agentalk-mcp-client/runs/`:** `rung15-agy-e966992.patch` (the
  fix), `rung15-run-transcript.log`, `rung15.config.json` (a working attach-mode config), and
  `rung15-probe-STALE-see-notes.test.ts` — **that probe is the INVALID one above; do not reuse it without fixing
  its input assumption.** The `/tmp/rung15` sandbox is NOT durable — assume it is gone.
- **BL-056 (durable transcript) — its argument is now STRONGER than my last primer claimed.** I wrote "it matters
  before *unattended* runs, not attended ones." **That was wrong, and rung 1.5 disproved it.** I asked agy to
  justify its fix over the alternatives it rejected; it did, and **that text is gone** — not in the NDJSON
  (lifecycle only), not in the launcher stdout. For grading *judgment* the artifact shows the answer and hides the
  thinking. This is the best evidence we have for BL-056.
- **Rung 2** — agy's meter is nearly free (didn't visibly move for a real 3-file task). The next rung's question:
  can agy be trusted to write a bar that actually bites? On this evidence, **no** — so either the goal must demand
  a mutation-check explicitly, or the reviewer must mutation-check every agy bar. Cheap either way.
- **BL-058** — still open. My spec was the wrong call (absolute path pins a checked-in config to Fausto's machine;
  `../AgentTalk` is the portable fix). agy complied exactly; the spec was the weak link.
- **BL-060**, **BL-050**, **BL-054** (PO-parked), **BL-036** (worktree discipline detail).

## Op notes / gotchas (starred ones are new this session)

- **★ You can run the whole ladder WITH THE UI, and here is the recipe** (the PO asked to watch; it works):
  1. `PORT=3000 AGENTTALK_MCP_PORT=54322 node apps/orchestrator/dist/index.js > /tmp/<run>/orchestrator.log 2>&1 &`
     — **3000 because `apps/web/vite.config.ts` hardcodes the proxy** (BL-060). **Pin the MCP port** (`54322`) and
     you don't need to scrape stdout for the dynamic url.
  2. `npm run frontend` → vite **5173**, already `host: 0.0.0.0` (PO, 2026-07-16) → reachable over LAN/SSH.
  3. Config with **NO `startCommand`** + explicit `orchestratorUrl`/`mcpUrl` → the launcher **attaches** to your
     running instance (`launcher.mjs:38`) and **`stopInstance` leaves it alive** (`:203` only kills a proc it
     spawned). **With `startCommand` the launcher KILLS the orchestrator at run end and the UI dies with it.**
  4. Verify the proxy before launching: `curl -s http://127.0.0.1:5173/api/agents` must answer.
- **★ `AGENTTALK_MCP_PORT` pins the MCP port** (`apps/orchestrator/src/server.ts:881`; `0` = dynamic). `PORT`
  defaults to 3000 (`index.js:33`).
- **★ The PO runs a launchd service `com.fausto.agenttalk-orchestrator` (was PID 4064) on PORT 3741 /
  AGENTTALK_MCP_PORT 54321 — LEAVE IT ALONE.** It is not a stray. **`pgrep -fl "orchestrator/dist|agenttalk"` does
  NOT find it** (I checked and wrongly reported "nothing running"); **`lsof -nP -iTCP:<port>` does**, and
  `launchctl list | grep -i agenttalk` names it. **Check ports with `lsof`, never a guessed `pgrep` pattern.**
- **★ The worker turn timeout is `600000` (10 min), not the 5 min the client default suggests.** I read
  `DEFAULT_PERSISTENT_TURN_TIMEOUT_MS = 300000` (`executor-runtime.mjs:135`) and told the PO agy had 5 minutes —
  **wrong**: the exec event carries `timeoutMs: 600000`. A real 3-file task + suite fit in **~144s**, so this has
  never been the binding constraint. Read the *event*, not the default.
- **★ Sandbox recipe that worked (worker workdir, node_modules and all):** `git clone <real-repo> /tmp/<run>/sandbox`
  then **`git remote remove origin`** (agy then physically cannot push — this is the containment, not a nicety).
  node_modules: symlink each entry of the real `node_modules` + `.bin`, **skip `@agenttalk`**, then point
  `node_modules/@agenttalk/<name>` at the **sandbox's own** `packages/*`/`apps/*`. Baseline the suite before the
  run (**328/328**).
- **★ Why the task-worktree/node_modules trap did NOT bite, and when it will.** BL-053 means the worker's worktree
  is created **at runtime** inside the workdir (`agentalk-task-<id>`), so you cannot pre-seed node_modules in it —
  Node walks **up** to the sandbox's. That is fine **only because runtime-core's tests import the code under test
  RELATIVELY** (`from '../in-process-driver.js'`) → they exercise the worktree's edits. **Cross-package
  `@agenttalk/*` imports resolve UP to the sandbox's unmodified copy**, so a *full-suite* green from inside the
  worktree is partly **vacuous**. Scope agy's bar to the package it edits; re-verify the diff yourself.
  **`tsc -b` is NOT a usable bar inside that worktree** — the clone has no built `dist`, so `@agenttalk/*` type
  decls don't resolve; the errors are your sandbox's, not the worker's. (And `cmd | head` returns **head's** exit
  code — don't read that as tsc passing.)
- **★ Mutation-check every bar — including the worker's.** One command turns "it's green" into "it would catch the
  bug": restore the defect (`git checkout <base> -- <src files>`, keep the test), re-run, demand a **fail**. This
  is what exposed agy's vacuous test *and* saved me from a false accusation. **Do not accept any agy-authored test
  without it.**
- **`completed` is NOT evidence** — check the artifact, in **`<workdir>/agentalk-task-<id>/`** (BL-053 verified
  working live this run). Design the observable *before* the run — but see the ⛔ probe warning above.
- **Fresh `agentId` per run; check for leftovers first** — a squatting worker makes the next run die on **HTTP 409**
  that looks like a hang. **Verify before believing in a stray** (`lsof`/`ps -p <pid> -o args=`).
- **`workdir` is MANDATORY** on `launchAgent`/configs: absolute, must exist, be a **real git repo** (else the turn
  fails by design — BL-061), never auto-created (BL-052).
- **DiagramTalk also wants 3000** — `lsof -nP -iTCP:3000` and **ask before touching it**. **The PO develops
  REMOTELY over SSH: you cannot witness the UI; the PO is the only witness.**
- **🛑 Bare `sleep` in a foreground Bash call is BLOCKED** (silent exit 1) and **`timeout` is not installed.** Put
  waits in a `.sh` poll loop; background long runs and read the log. (Worked well this session.)
- **`rm -rf` is in the settings `deny` list** — fresh dir names, or `git worktree remove --force` + `git branch -D`.
- **Chained `cd repoA && git push` then `git push`** pushes **repoA twice** and says "Everything up-to-date", which
  reads like success. **Use `git -C <repo>`, and verify with a `fetch` afterwards, not the push output.**
  (Related: `cd` **persists between Bash calls** — I ran `ls scripts/` and read the *wrong repo's* scripts. Use
  absolute paths.)
- **Backlog edits:** run **`npm run backlog:check`** (it gates). Valid statuses are **todo · doing · done ·
  dropped · deferred** — *`deferred` is real and widely used; `AGENT.md` says four and is wrong.* The prose status
  token must be **plain**: `- [done · **MERGED …**]`, never `- [**done · …**]`.
- **No UI test infrastructure, by PO decision (LB-93)** — the bar for UI work is a **live, witnessed run**.
- **Env:** both repos built and **dist verified current** at close; `claude` + `agy` CLIs authed on PATH. Meter
  `:9899` — poll with **`node scripts/usage.mjs`** (never hand-parse). At this close the **claude block read
  `ok:false`** (LB-11, best-effort — never block on it); codex weekly 39%; **antigravity 4% — agy is nearly free,
  use it.** My session window hit 93% before the PO's overnight gap and has almost certainly reset — **confirm,
  don't assume.**
- **★ Check `dist` freshness the RIGHT way.** `find ... -newer <a dist file>` is the cheap invariant — but use the
  **NEWEST** dist file as the reference, not `index.js`: `tsc -b` only rewrites what changed, so `index.js` can be
  weeks old while the build is current. I nearly rebuilt for nothing off that misread. Then **grep the dist for
  your change** before any live run.

Verify all of the above against ground truth (`git fetch` both; read `design/backlog.md` and `design/logbook.md`
LB-93/LB-94) before acting. Report your understanding, then STOP for the PO's go.
