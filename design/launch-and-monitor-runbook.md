# Runbook — launching and monitoring an AgentTalk session (for an external agent)

**Audience:** an agent (or human) with **no prior session context** that must launch a governed AgentTalk worker
against a real repo and supervise it to a graded verdict. **Written 2026-07-27 by Claude**, grounded in the
launcher source and in the rung-5/rung-6 runs — every claim below is either quoted from code (path cited) or
observed live. Where something is **not** verified, it says so.

**Scope:** the *operator* side — launch, observe, grade, clean up. It does not teach the workflow (that is
`design/collaboration-workflow.md`) or the rules a worker inherits (that is `AGENT.md`).

> **The one-line mental model.** The launcher boots an orchestrator, launches **one** worker as an MCP client,
> creates a **worker-only team**, posts your goal as that team's task, then races the worker's completion against
> a machine-enforced cap. It writes an NDJSON run artifact you grade from afterwards.

---

## 1. Preconditions — check all six before touching a config

| # | Check | Command / expectation |
|---|---|---|
| 1 | Both repos present and built | `AgentTalk`: `npx tsc -b` → 0. Client: `agentalk-mcp-client` with `node_modules` |
| 2 | The worker's **workdir is its own git worktree**, never the primary checkout | `node scripts/wt-setup.mjs create <id> --base master` (AgentTalk only; the client has no helper) |
| 3 | **Governance inherits into that worktree** — this is the whole thesis | `ls -la <workdir>/CLAUDE.md` must show `CLAUDE.md -> AGENT.md`. Without it the worker has **no rules** |
| 4 | The orchestrator boots from a **different** checkout than the worker's workdir | Otherwise the worker edits the code running it |
| 5 | The orchestrator's port is free | `lsof -nP -iTCP:<port>` → empty |
| 6 | Provider CLI on `PATH` | e.g. `claude --version` |

**⚠️ The client repo has no governance file** (`AGENT.md`/`CLAUDE.md`/`AGENTS.md`/`GEMINI.md` are absent at its
root — verified). A worker whose workdir is the **client** repo inherits nothing: no Implementer Rules of
Engagement, no show-stopper fence. Until [[BL-086]] is decided, **do not give a governed worker a client-repo
task.**

## 2. The config contract

Validated by `validateConfig` (`agentalk-mcp-client/lib/bite0-launcher.mjs`) — these are hard errors:

- `agents` — non-empty array, **exactly one agent** ("Bite 0 supports exactly one agent").
- `agents[0].provider` — required.
- `goal` — required, non-empty string.
- `cap` — required, and `cap.wallClockMs > 0`.

Everything else is optional with defaults:

```json
{
  "instance": {
    "orchestratorUrl": "http://127.0.0.1:3500",
    "recording": "runs/<name>.ndjson",
    "readyTimeoutMs": 120000,
    "env": { "PORT": "3500", "AGENTTALK_WORKER_TURN_TIMEOUT_MS": "1800000" },
    "startCommand": { "command": "npm", "args": ["run", "backend"], "cwd": "/abs/path/to/a/checkout" }
  },
  "agents": [{
    "id": "my-worker",
    "provider": "claude",
    "model": "opus",
    "executionMode": "persistent",
    "workdir": "/abs/path/to/the/worker/worktree",
    "readyTimeoutMs": 120000
  }],
  "goal": "one sentence — see §4",
  "cap": {
    "wallClockMs": 3600000,
    "pollIntervalMs": 10000,
    "meter": { "url": "http://127.0.0.1:9899", "provider": "claude", "maxPercentDelta": 25 }
  }
}
```

**Field traps that cost real time:**

- **`PORT` goes in `instance.env`, not `startCommand.env`.** `instance.env` is what gets merged into the spawned
  process's environment (`launcher.mjs`, `makeStartInstance`).
- **`startCommand.cwd`, if relative, resolves against the CLIENT root**, not your cwd. Use an absolute path.
- **Set `instance.recording`.** It is not decoration: it is the only durable record of the run, **and** the
  worker's raw-response sidecar is *derived* from it as `<recording>.responses.ndjson`. No recording ⇒ no
  sidecar ⇒ you cannot tell afterwards which branch the run took, or read the worker's own report.
  *(You do not set the sidecar path yourself — `launcher.mjs` derives and injects it as `responseLog`.)*
- **Omitting `startCommand` means "an instance is already running"** — then you must supply both
  `orchestratorUrl` **and** `mcpUrl`, because nothing will parse the MCP url from stdout for you.
- **`AGENTTALK_WORKER_TURN_TIMEOUT_MS` is ORCHESTRATOR-side.** It is read where the worker's exec turn is
  issued (`in-process-driver.ts`), so it must be in the env of the process `startCommand` boots — i.e. the
  orchestrator's checkout must contain that code. Default **600 000 ms (10 min)**; a malformed value falls back
  to the default and can never remove the deadline.

## 3. The two caps — configure BOTH

The runner races three things: the worker finishing, the wall clock, and the resource meter
(`raceCapAndOutcome`).

- **`cap.wallClockMs`** — required. **This is currently the only anti-hang rail in the system**: the idle timeout
  is dead code ([[BL-028]]), so nothing else detects a wedged worker.
- **`cap.meter`** — optional and **easy to forget, which is a mistake**: `{ url, provider, maxPercentDelta }`
  terminates the run when the provider's session percentage rises `maxPercentDelta` points above the baseline
  captured at launch. **If your worker's provider is the same one your own supervising session runs on, this is
  the rail that stops a run from eating the window you need to grade it.** A failed meter read is best-effort and
  skipped — it never blocks the run.
  *(Learned the hard way: the rung-6 run was launched with the budget named as its top risk and **no `cap.meter`
  configured**. The wall-clock rail was active, the resource rail was not.)*

## 4. The goal statement

Keep it to **one or two sentences**, and do not restate rules, scope, or file lists. The repo supplies those:
`AGENT.md` (via the `CLAUDE.md` symlink) carries the Implementer Rules of Engagement, and any plan document you
point at carries the scope and fences. Rung 5's entire prompt was one sentence and the worker still reproduced
before designing, refuted a filed fix direction on evidence, and flagged an adjacent defect instead of fixing it.

A restated ruleset in the prompt is worse than none: it invites the worker to follow *your summary* instead of the
source of truth, and it makes the run untestable as evidence about inheritance.

## 5. Launch

```bash
cd /path/to/agentalk-mcp-client
node scripts/launcher.mjs runs/<name>.config.json
```

Run it **in the background** if the cap is long, and note it exits `0` only when the outcome is `completed`.

Readiness needs **two** signals from the orchestrator's output, not one — `Ready to manage agents.` *and*
`MCP server URL set to: ws://…`. If only the first appears, the launcher will time out at
`instance.readyTimeoutMs` even though the server looks up.

## 6. Monitoring — what to watch, and where

**The run artifact is the primary channel.** `instance.recording` gets one JSON object per line:

```
run-start        → the config was accepted; goal recorded verbatim
agent-launched   → agentId + pid   (the worker process exists)
goal-delivered   → the team was created and the task posted
cap-breach       → a rail fired    (wall-clock or resource)
outcome          → terminal
```

Seeing `goal-delivered` is the milestone that matters: it means the agent reached `ready`, joined a
worker-only team, and the task was posted. Before that, failures are *setup* failures.

**A monitor should cover failure signatures, not just progress.** Silence looks identical to "still working".
Watch for: `cap-breach`, `outcome`, `did not respond`, `timed out`, `ended in 'error'`, `ended in
'interrupted'`, `EADDRINUSE`, `instance exited before ready`.

⚠️ **Do not grep for `refus`** as a proxy for a refusal — the string appears in the worker's own *prompt
template* (the list of valid response types), so it matches on every run. Check the sidecar instead.

**Liveness, when you need it:** `ps ax -o pid,etime,command | grep -E "[l]auncher.mjs|[c]laude -p"`.

**What you CANNOT get from the API — know this before you plan your grading:** the worker's result **text is not
reachable**. Tasks have no read endpoint, and completing the task deletes `team.currentTaskId`
(`launcher.mjs`, `waitForOutcome`, stated in-code). So the worker's report exists **only** in the responses
sidecar and the NDJSON. This is why §2 insists on `instance.recording`.

## 7. Outcome semantics

Launcher outcome `status`:

| `status` | `reason` | Meaning |
|---|---|---|
| `completed` | — | the team reached `completed` |
| `failed` | `worker-error` | the team ended `error` or `interrupted`, or a setup step threw |
| `failed` | `cap-wallclock` | wall clock exceeded |
| `failed` | `cap-resource` | meter delta ≥ `maxPercentDelta` |

Team terminal states are exactly **`completed` | `error` | `interrupted`**. Older notes claiming `failed` or
`awaiting_operator` are wrong — both were corrected in-code against `packages/contracts/src/types.ts`.

## 8. Grading — the part that is usually done wrong

**`completed` is not "the work was done."** It is a team status. Grade the artifact.

1. **Pre-register the bar BEFORE launching, and prove it RED.** Keep it **outside the worker's workdir** and
   **uncommitted**, so it cannot be tuned against or read by the worker.
2. **Put a precondition guard in it.** A bar can be red because the feature is missing *or* because your harness
   is broken, and those look identical afterwards. Assert the machinery exists as its own test. On rung 5 a
   pre-registered grader was wrong twice, and only its guards prevented a false "failed" verdict. On rung 6 the
   first draft of the bar was red because agents were never activated — it would have stayed red after a perfectly
   correct fix.
3. **Prefer a bar with both directions:** tests that must flip red→green, *and* tests already green that must
   **stay** green. The second set is your regression/parity check.
4. **Check the artifact at BOTH paths and say what is at each:** `<workdir>` and
   `<workdir>/agentalk-task-<taskId>/`. **For `claude` the work lands in the parent workdir**, because
   `ClaudePersistentExecutor` spawns once at `initialize()` with `cwd: process.cwd()` and cannot change cwd per
   turn. Consequence: **one claude session = one task.**
   *(A check at the wrong path is worse than none — it manufactures false confidence. That mistake once produced
   a model-honesty accusation that had to be retracted: see [[BL-059]].)*
5. **Read the diff against the fences last.** A worker that **stops and reports** a show-stopper has passed the
   round; a scope-creep green has failed it.

## 9. Failure modes → diagnosis

| Symptom | Most likely cause |
|---|---|
| `instance not ready within Nms` | the MCP url line never appeared, or the port was taken. Check both readiness signals; check `lsof` |
| `instance exited before ready (code N)` | orchestrator crashed at boot — `PORT` misplaced (must be `instance.env`), or the checkout is unbuilt |
| `agent <id> not ready within Nms` | the provider CLI never connected. Check it is on `PATH` and that `workdir` exists |
| `agent <id> reached 'error' before it could join a team` | the worker process died at startup — read the sidecar |
| Worker "stalls" then the run ends near a round number | the **per-turn** deadline, not a hang. Default 600 s; raise `AGENTTALK_WORKER_TURN_TIMEOUT_MS`. Rung 5 finished *at* 600 s |
| `EADDRINUSE` | a previous orchestrator survived. Historically an orphan leak ([[BL-081]], fixed); check `lsof` and kill the tree |
| Team `completed`, no visible work | grade the artifact at both paths (§8.4) before concluding anything |

## 10. Cleanup

1. The launcher stops the instance itself, signalling the **whole process group** (`detached: true` + negative
   pid — [[BL-081]]). Verify anyway: `lsof -nP -iTCP:<port>` empty, no stray `claude -p`.
2. Remove the worktree when the branch is merged: `node scripts/wt-setup.mjs remove <id> --delete-branch`
   (a safe `-d` that refuses unmerged branches — an exit-1 can still mean the worktree *was* removed).
3. **Every run leaves a SECOND worktree and branch you did not create.** `llm-agent.mjs` provisions a task
   worktree at `<workdir>/agentalk-task-<taskId>/` on branch `task-task-<taskId>` (BL-053). For `claude` the
   worker usually commits in the **parent** workdir and never touches it, so it is left behind empty — and
   because it is **nested inside** the worker's worktree, `git worktree remove <workdir>` fails until the nested
   one goes first. Order matters:
   ```bash
   git worktree remove --force <workdir>/agentalk-task-<taskId>
   git branch -D task-task-<taskId>            # merged/empty: nothing is lost
   node scripts/wt-setup.mjs remove <id> --delete-branch
   git worktree prune && git worktree list     # verify
   ```
   Check `git branch --list` after any run: an accumulating pile of `task-task-*` branches is the signature of
   skipping this step.
3. `runs/` is gitignored; configs there are disposable, but **copy the NDJSON and sidecar somewhere durable if the
   run is evidence for a decision.**

### 10a. Prove it rather than eyeballing it — the invariant harness ([[BL-087]])

The cleanup above is a checklist, and step 3 exists only because a nested worktree **was missed by hand** once
already. So bracket every run with a machine check instead of trusting the sweep:

```bash
node scripts/infra-invariant.mjs snapshot --out /tmp/att-invariant/before.json   # LAST thing before launching
# … the run …
node scripts/infra-invariant.mjs check --before /tmp/att-invariant/before.json   # BEFORE the cleanup above
# … then the cleanup …
```

> **⚠️ Both orderings above are CORRECTIONS made 2026-07-27 after the O-1 run, which got each of them wrong.**
>
> **Snapshot LAST, immediately before launching.** Anything the operator does after taking the baseline —
> including committing its own notes — is indistinguishable from something the worker did. On O-1 a
> reference-value commit made after the baseline produced a `head-moved` **critical** the worker had nothing to
> do with, and failed the run's bar.
>
> **Check BEFORE cleanup, not after.** Cleanup legitimately *removes* the worktree and branch the run added, and
> **removals are always `critical` by design** — the asymmetry is right for the *damage* question ("did the run
> break anything?") and wrong for the *teardown* question ("did we get back to baseline?"). Checking after
> cleanup reports `worktree-removed` + `branch-removed` as critical every single time. The teardown question is
> **not supported today** — see [[BL-088]].

Exit **0** clean · **1** findings · **2** the harness itself failed (kept distinct so a crash can never read as a
clean run). `--json` gives an operator agent something to gate on without parsing prose.

Watches both repos (`--client <path>` or `$AGENTTALK_CLIENT_REPO`), ports 3400-3700 plus 9899. **Additions can be
expected — removals and `HEAD` moves never are**, so a deleted branch or worktree is `critical` no matter how
permissive the expectation file. It **reports and never repairs**: run it any time, including mid-run.

A `critical` finding **gates the next operator run** until the PO clears it (PO, 2026-07-27). Hermes may *run* it;
only the PO may dispose of a `critical`. A pre-existing unaccounted-for process is a `warn` here and is cleared the
BL-023 way — `AGENTTALK_SWEEP_DECLARED=<pid-or-port>`.

## 11. Known limits — stated, not hidden

- **Exactly one agent per run.** Multi-agent is not supported by this launcher.
- **The worker's result text never reaches the API** (§6).
- **No hang detection beyond the caps** — [[BL-028]] is dead code.
- **In-process agent errors do not propagate** to interrupt a team ([[BL-078]], documented in `AGENT.md`'s M03
  entry), so a failing worker can leave a team quietly stuck. The caps are your only rail.
- **Launched workers are exempt from the turn-1 primer gate** ([[BL-082]]) — expected, not a bug.
- **Cost attribution is unreliable.** The meter is per-provider and machine-wide, and goes stale for hours. Never
  read a stale meter as a 0% delta; write `unavailable`.
- **Not verified by this runbook:** `start_pair_chat` / multi-agent flows, and providers other than `claude`
  end-to-end through this launcher (gemini/agy is documented as a fit attach client; goose has its own items).
