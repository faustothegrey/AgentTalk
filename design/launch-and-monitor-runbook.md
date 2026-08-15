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
| 2 | The worker's **workdir is its own git worktree**, never the primary checkout | `node scripts/wt-setup.mjs create <id> --base master` (AgentTalk only — the client has no helper, [[BL-105]]). **⚠️ It prepends `att-`: `create <id>` → `<root>/att-<id>` on branch `task-<id>`.** Default root is **`os.tmpdir()`** since [[BL-100]] (2026-07-30), so it is **platform-derived — check yours, don't assume the box this was written on** ([[BL-108]]): on **Linux** it is `/tmp` and `--root` is unnecessary; on **macOS** `$TMPDIR` makes it `/var/folders/…/T`, which is **outside** every `/tmp/att-op-*` sweep and the harness's own allowlist — so on macOS **pass `--root /tmp`**. So id `op-h1` yields `/tmp/att-op-h1` — **passing `att-op-h1` as the id yields `att-att-op-h1`**, which then mismatches the `workdir` in your config |
| 3 | **Governance inherits into that worktree** — this is the whole thesis | `ls -la <workdir>/CLAUDE.md` must show `CLAUDE.md -> AGENT.md`. Without it the worker has **no rules** |
| 4 | The orchestrator boots from a **different** checkout than the worker's workdir | Otherwise the worker edits the code running it |
| 5 | The orchestrator's port is free | `lsof -nP -iTCP:<port>` → empty |
| 6 | Provider CLI on `PATH` | e.g. `claude --version` |

**✅ The client repo IS governed as of 2026-07-30 ([[BL-086]] closed, `0b770c2`).** `agentalk-mcp-client` now
carries its own `AGENT.md` plus `AGENTS.md`/`CLAUDE.md` symlinks: Implementer Rules of Engagement, the
show-stopper fence, scope discipline, honesty-over-results, and the worktree/merge/push rules. **The former ban
on client-repo tasks is LIFTED** — a worker whose workdir is the client repo now inherits real rules.

> **Two bounds before you rely on that.** The rules are written **inline** in that file, not behind a pointer,
> precisely so they survive in a worktree — but **inheritance itself is proven for claude only** ([[BL-080]],
> headless `-p`); codex/gemini is assumed from convention. And the client has **no worktree helper**, so a
> client workdir needs its `node_modules` wired by hand ([[BL-105]]).

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
- **`instance.orchestratorUrl` is ALWAYS required — `startCommand` does not derive it.** The launcher reads
  it straight from your config (`launcher.mjs:82-83`) and only ever parses **`mcpUrl`** from the backend's
  stdout. Omit it and the run dies **after** the backend has started, with
  `FATAL Error: createLauncherCore requires orchestratorUrl` — a late failure that looks like a launch problem
  and is a config problem. *(This bullet previously implied the pair was needed only when `startCommand` was
  absent; that reading cost the first live HMP-commissioned run.)*
- **Omitting `startCommand` means "an instance is already running"** — then you must *also* supply `mcpUrl`,
  because nothing will parse it from stdout for you.
- **`AGENTTALK_WORKER_TURN_TIMEOUT_MS` is ORCHESTRATOR-side.** It is read where the worker's exec turn is
  issued (`in-process-driver.ts`), so it must be in the env of the process `startCommand` boots — i.e. the
  orchestrator's checkout must contain that code. Default **600 000 ms (10 min)**; a malformed value falls back
  to the default and can never remove the deadline.

## 3. The two caps — configure BOTH, but only ONE of them stops a run

> **⬛ AMENDED 2026-08-06** (client `e04c576`; [[BL-117]] PO option (b), [[BL-114]], [[BL-118]]). This section
> previously called `cap.meter` *"the rail that stops a run from eating the window you need to grade it."*
> **It no longer terminates anything, and that claim is retracted.** The retracted wording is quoted here rather
> than deleted, so a reader who remembers the old behaviour meets the correction instead of a silent rewrite.

The runner races the worker finishing against the wall clock, and **polls** the resource meter alongside them
(`raceCapAndOutcome`).

- **`cap.wallClockMs`** — required, and **the ONLY terminating rail in the system.** The idle timeout is dead
  code ([[BL-028]]), so nothing else detects a wedged worker — and since 2026-08-06 nothing else ends a run at
  all. It is also the only rail ever *proven* to terminate: real process, real timeout, PID confirmed dead
  ([[BL-096]]). Since [[BL-118]] a termination now **cascades to the provider CLI**, which previously survived as
  an orphan and kept drawing on the pool after the kill. **Check its value on every config. Nothing else will
  stop your run.**
- **`cap.meter`** — still `{ url, provider, maxPercentDelta }`, still **mandatory for operator runs** (charter),
  still **easy to forget, which is still a mistake** — but it is now a **WARNING, not a rail.** On breach it
  emits `cap-warning` into the run artifact and **the run continues.**
  **Why it was demoted, because you will be tempted to re-arm it:** the meter reports **machine-wide,
  per-provider** percentages. It cannot separate the worker's spend from *your own supervising session's*, so it
  fires on the **sum** and attributes it to the worker. On `hmp5` it killed complete, verified work **fourteen
  seconds after the commit**, and destroyed the worker's report along with it. A shared-fate trigger is not a
  containment rail.
  A failed meter read is best-effort and skipped — it never blocks the run — and since [[BL-114]] an unreadable
  meter is **recorded** (`meter-unreadable`, `meter-baseline-unavailable`) instead of silently coerced to a
  plausible `0`. If the baseline could not be read, the rail arms **late** from the first trustworthy reading
  rather than comparing against a fabricated zero.
  *(Still learned the hard way, and still worth configuring: the rung-6 run was launched with the budget named as
  its top risk and **no `cap.meter`** at all. You now get the observation without the false kill — which is the
  whole point of the change, not a consolation.)*

**⚠️ So what actually protects the budget now?** The wall clock, plus a human who reads the meter. The budget
risk is **real, named, and explicitly unmitigated** — see `AGENT.md`'s OPERATOR charter, which was amended in the
same breath. Do not read the demotion as having solved it.

## 4. The goal statement

Keep it to **one or two sentences**, and do not restate rules, scope, or file lists. The repo supplies those:
`AGENT.md` (via the `CLAUDE.md` symlink) carries the Implementer Rules of Engagement, and any plan document you
point at carries the scope and fences. Rung 5's entire prompt was one sentence and the worker still reproduced
before designing, refuted a filed fix direction on evidence, and flagged an adjacent defect instead of fixing it.

A restated ruleset in the prompt is worse than none: it invites the worker to follow *your summary* instead of the
source of truth, and it makes the run untestable as evidence about inheritance.

## 5. Launch

```bash
node /abs/path/to/agentalk-mcp-client/scripts/launcher.mjs /abs/path/to/<name>.config.json
```

**Invoke the launcher by absolute path, and pass the config by absolute path — do not `cd` into the client.**
The OPERATOR charter requires the operator's workdir to stay in AgentTalk. *(Corrected 2026-07-27: this section
previously said to `cd` into the client and use a relative config path, which contradicted the charter. H-0
followed the runbook and inherited the conflict.)*

**⚠️ Corrected again 2026-08-02 — this paragraph used to justify the rule with "the client repo carries no
governance file ([[BL-086]])", which had been false since 2026-07-30 and contradicted this very document's own
precondition note above (see the ✅ at the top).** The client **is** governed; the former ban on client-repo
tasks is lifted. **The workdir rule itself still stands** — it is a containment rule of the OPERATOR charter, and
relaxing it is a PO call rather than a consequence of BL-086's closure. What changed is only its *reason*. Note
also that governance-file **inheritance is verified for claude only** ([[BL-080]]); the file existing and a
launched worker being governed are different claims.

**Why that is safe — verified in code, not assumed.** `instance.recording`, its derived `.responses.ndjson`
sidecar, and `startCommand.cwd` are each resolved against **`clientRoot`** — the launcher's own directory via
`__dirname` (`launcher.mjs:29`, `:109`, `:116`, `:55`) — **not** against your cwd. So run artifacts still land in
the client's `runs/` no matter where you invoke from, and absolute-path invocation cannot scatter them into the
governed repo. **The one exception is the config path itself**: `path.resolve(configPath)` (`:255`) resolves
against `process.cwd()`, which is exactly why it must be absolute.

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
cap-breach       → the WALL-CLOCK rail fired and ended the run  (see below)
cap-warning      → the meter passed its threshold; the run CONTINUED  (BL-117)
meter-unreadable / meter-baseline-unavailable / meter-baseline-established
                 → the meter's reachability, recorded rather than guessed  (BL-114)
outcome          → terminal
```

**`cap-breach` used to mean "a rail fired (wall-clock or resource)". Since 2026-08-06 only the wall clock can
produce it** — the meter emits `cap-warning` instead and does not end the run (§3). A `cap-warning` with no
`cap-breach` is a healthy run that spent more than expected, **not** a capped one.

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
| ~~`failed`~~ | ~~`cap-resource`~~ | **NO LONGER REACHABLE** since 2026-08-06 ([[BL-117]]). The meter warns and the run continues; it cannot produce a terminal outcome. Kept struck-through, not deleted: prior run artifacts contain `cap-resource` outcomes (`hmp5`) and a reader meeting one needs to find it here. |

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
node scripts/infra-invariant.mjs check --before /tmp/att-invariant/before.json --expect scripts/operator-run.expect.json   # BEFORE the cleanup above
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

**⚠️ The harness cannot see a process that holds no port — run the manual sweep too ([[BL-091]], deferred:
UNMITIGATED, ACCEPTED by the PO, 2026-07-27).** `snapshotGlobal` builds its process list *from listening
sockets*, so a shell loop, poller, waiter or orphaned `sleep` never enters the state vector and the harness
reports `exit 0` while it spins. This is exactly how an O-1 poll loop ran unnoticed for ~10 minutes. So, on every
operator run, **before cleanup**, alongside the `check` above:

```bash
ps ax -o pid,etime,command | grep -E "[s]leep [0-9]|[u]ntil |[w]hile |[l]auncher\.mjs|[c]laude -p"
```

**This is a LIST FOR A HUMAN TO JUDGE, never an automated finding.** That is deliberate, and it is why BL-091
was not "fixed" by simply adding this to the harness: a machine cannot tell *our* stray loop from a service the
PO runs on purpose, and guessing is where [[IP-15]] lives — a reviewer once filed a defect against exactly such a
service. A human reading five lines tells them apart instantly. Hermes may run the sweep and reports the output
as an **observation**; the PO disposes of what it shows.

Watches both repos (`--client <path>` or `$AGENTTALK_CLIENT_REPO`), ports 3400-3700 plus 9899. **Additions can be
expected — removals and `HEAD` moves never are**, so a deleted branch or worktree is `critical` no matter how
permissive the expectation file. It **reports and never repairs**: run it any time, including mid-run.

A `critical` finding **gates the next operator run** until the PO clears it (PO, 2026-07-27). Hermes may *run* it;
only the PO may dispose of a `critical`. A pre-existing unaccounted-for process is a `warn` here and is cleared the
BL-023 way — `AGENTTALK_SWEEP_DECLARED=<pid-or-port>`.

## 11. Known limits — stated, not hidden

- **Exactly one agent per run.** Multi-agent is not supported by this launcher.
- **The worker's result text never reaches the API** (§6).
- **No hang detection beyond the wall-clock cap** — [[BL-028]] is dead code, and since [[BL-117]] the meter
  cannot end a run either.
- **In-process agent errors do not propagate** to interrupt a team ([[BL-078]], documented in `AGENT.md`'s M03
  entry), so a failing worker can leave a team quietly stuck. **`cap.wallClockMs` is your only rail** — since
  [[BL-117]] the meter cap cannot end a run (§3), so "the caps" is now a singular.
- **Launched workers are exempt from the turn-1 primer gate** ([[BL-082]]) — expected, not a bug.
- **Cost attribution is unreliable — and this is now load-bearing, not a footnote.** The meter is per-provider
  and **machine-wide**, and goes stale for hours. It cannot tell your spend from the worker's. That is precisely
  why the meter cap was demoted to a warning ([[BL-117]]) and why **per-actor accounting remains unbuilt**.
  Never read a stale meter as a 0% delta; write `unavailable` — and since [[BL-114]] the artifact will say so for
  you (`meter-unreadable`) instead of quietly recording a zero that never happened.
- **Not verified by this runbook:** `start_pair_chat` / multi-agent flows, and providers other than `claude`
  end-to-end through this launcher (gemini/agy is documented as a fit attach client; goose has its own items).
