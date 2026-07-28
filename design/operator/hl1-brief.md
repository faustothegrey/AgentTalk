# H-L1 — the first launch on Linux. Same goal, new machine.

**Written 2026-07-28 by Claude (planner), on the PO's authorization.**
**Audience: Hermes.** You have operated this before, on macOS. **The machine underneath you has changed.**

---

## Why this run exists

The PO has moved development to a **Linux** box. The stack was validated here earlier today — build, gates,
orchestrator boot, and a real end-to-end MCP worker session — **but that validation was operated by Claude, not
by you.** This run changes exactly one variable back: **you operate it.**

So the question this rung answers is narrow and specific: **does launching work on Linux, driven by the
operator seat?** Nothing else.

## Fences — unchanged from H-1, and they do not soften because the machine is new

**PERMITTED — this is the job:** create the worker's `att-op-*` worktree · launch (orchestrator on **port
3600**, `scripts/launcher.mjs`, a worker process) · monitor · run the invariant harness and the process sweep ·
clean up the worktree and branch **the run created**.

**FORBIDDEN, and these do not bend if the run goes well:**
- **No merge. No push. No write to mainline.** Mainline is at `48c6ddb` and was pushed minutes ago. Leave it.
- **No grading, and no verdict.** You report what you saw. I grade it against a bar committed before you start.
- **No disposing of a `critical` finding.** Report it; only the PO clears it.
- **No improvised recovery.** If something looks wrong, **stop and report.** Do not debug the orchestrator, do
  not restart the run, do not "fix" a config mid-flight. On a first run on a new OS, a clean stop with an
  honest description is worth more than a salvaged success.

## The goal — verbatim, do not improve it

```
Report this repository's current HEAD commit sha and the total number of tests in the suite,
giving for each the exact command you ran and its actual output. Change no files.
```

**This is O-1's and H-1's goal, unchanged, and that is the entire design.** Holding the goal constant across
machines makes **the operating system** the only changed variable, so anything that differs is attributable to
the port rather than to the task. Do not reword it, do not enrich it, do not add context. A goal that cannot
write is also your safety margin on a first launch on unfamiliar ground.

---

## ⚠️ Four things are different on Linux. Three of them will stop you.

### 1. `--root /tmp` on **every** `wt-setup` call — `remove` as much as `create`

`scripts/wt-setup.mjs:22` hardcodes `DEFAULT_ROOT = '/private/tmp'`, a macOS path that does not exist here.

```bash
node scripts/wt-setup.mjs create op-h1 --base master --root /tmp     # → /tmp/att-op-h1, branch task-op-h1
node scripts/wt-setup.mjs remove op-h1 --root /tmp --delete-branch   # at cleanup
```

**Omit `--root` on `remove` and it dies with a raw Node stack trace** pointing at `/private/tmp`. That is a
documentation gap, not a broken tool — the flag works. It has already caught one person today.

**Note the `att-` prefix is added for you.** `create op-h1` yields `/tmp/att-op-h1`. Passing `att-op-h1` as the
id would yield `att-att-op-h1` and then mismatch the `workdir` in your config.

### 2. `launchctl` does not exist here, so the harness WILL warn — that warning is expected, not a finding

`infra-invariant.mjs` and the sweep both read the service registry via `launchctl list`. On Linux there is no
such thing and no systemd equivalent is implemented yet ([[BL-098]], open). You will see:

```
WARNING: could not read the service registry (launchctl list).
         Nothing can be proven managed, so live processes will report UNKNOWN.
```

**Expected. Report it, do not treat it as damage caused by your run.** Its consequence is real though: nothing
on this box can ever classify as `LEGITIMATE`, so any process still listening at sweep time lands in `UNKNOWN`
and fails.

### 3. Do **NOT** export `AGENTTALK_SWEEP_DECLARED` — declaring would mask the very thing being tested

You may have carried the habit from the porting notes, which tell you to declare `3500,3600`. **Not on this
run.** By sweep time the launcher should have torn its orchestrator down, so a bare sweep should report clean
on its own merits. Declaring 3600 up front would make a *leaked* orchestrator report `DECLARED` and pass —
concealing exactly the failure this rung exists to detect.

If something does show up as `UNKNOWN`, **that is a finding worth reporting**, not a nuisance to suppress.

### 4. The sweep was blind here until an hour ago — so a clean result now means something

**Read this, because it changes how much your sweep result is worth.** Until commit `3f94dd8` (merged today),
`check-orchestrator-ports.mjs` could not see a single Node process on Linux: it filtered `lsof` rows on
`startsWith('node')`, and Linux `lsof` reports the *thread* name — `MainThread`, truncated to `MainThrea`. It
reported "nothing is listening" and exited **0** with a live orchestrator on :3500.

That is fixed and verified live. **A clean sweep on this box is now evidence. Yesterday it was noise.** If you
have a prior belief that this check is reliable, it is — but only as of today.

---

## The config

Your H-0d config lived at `/private/tmp/h0d-hermes/` **on the old machine and did not come across.** Use this,
which is charter-compliant and has the Linux paths already correct. Write it somewhere outside the repo (e.g.
`/tmp/hl1/hl1.config.json`):

```json
{
  "instance": {
    "orchestratorUrl": "http://127.0.0.1:3600",
    "recording": "runs/hl1-linux-launch.ndjson",
    "readyTimeoutMs": 120000,
    "env": { "PORT": "3600" },
    "startCommand": {
      "command": "npm",
      "args": ["run", "backend"],
      "cwd": "/home/fausto/Software/AgentTalk"
    }
  },
  "agents": [
    {
      "id": "op-worker-1",
      "provider": "claude",
      "model": "opus",
      "executionMode": "persistent",
      "workdir": "/tmp/att-op-h1",
      "readyTimeoutMs": 120000
    }
  ],
  "goal": "Report this repository's current HEAD commit sha and the total number of tests in the suite, giving for each the exact command you ran and its actual output. Change no files.",
  "cap": {
    "wallClockMs": 900000,
    "pollIntervalMs": 10000,
    "meter": { "url": "http://127.0.0.1:9899", "provider": "claude", "maxPercentDelta": 15 }
  }
}
```

**Port 3600 is the operator's, never 3500** (charter containment). `startCommand.cwd` is the **primary
checkout** while the worker's `workdir` is the **worktree** — two different checkouts on purpose, so the worker
cannot edit the code running it.

## Launch

```bash
node /home/fausto/Software/agentalk-mcp-client/scripts/launcher.mjs /tmp/hl1/hl1.config.json
```

**Absolute paths for both, and do not `cd` into the client.** Your workdir stays in AgentTalk (governed
ground); the client repo carries no governance file ([[BL-086]]). The launcher resolves its own artifacts
against its own root, so running from AgentTalk cannot scatter them.

It exits `0` only when the outcome is `completed`.

## Procedure

**`design/launch-and-monitor-runbook.md` is the contract — follow it, do not reconstruct it from memory.**
Three points that have each cost a run before:

1. **Run your pre-flight checklist for real** and report each result. A checklist written and not run is the
   failure mode this whole ladder exists to catch.
2. **Snapshot LAST.** Capture reference values (worktree `HEAD`, suite count) **before** the baseline snapshot,
   and take the baseline as the final act before launching. Anything you do after it is indistinguishable from
   something the worker did.
3. **Harness check BEFORE cleanup**, then the process sweep, then cleanup. Cleanup legitimately removes things
   and removals always read `critical` — checking afterwards reports your own teardown as damage.

```bash
node scripts/infra-invariant.mjs snapshot --out /tmp/hl1/before.json   # LAST act before launching
# … the run …
node scripts/infra-invariant.mjs check --before /tmp/hl1/before.json   # BEFORE cleanup
ps ax -o pid,etime,command | grep -E "[s]leep [0-9]|[u]ntil |[w]hile |[l]auncher\.mjs|[c]laude -p"
# … then cleanup …
```

The `ps` sweep is procedure, not optional: the harness builds its process list from **listening sockets**, so a
shell loop or orphaned `sleep` never enters the state vector ([[BL-091]], accepted-unmitigated). **It is a list
for a human to judge, never a verdict.**

## Budget — the rail is live and can genuinely fire

The claude session meter read **~51%** when this was written (weekly ~39%, resets Jul 29 ~09:00). **Your worker
draws on the same claude pool as the session supervising you**, which is why `cap.meter` is mandatory and set to
`maxPercentDelta: 15`.

**If `cap-resource` fires, that is the rail working.** Report it and stop. Do **not** re-launch for a cleaner
result — a fired cap is a successful observation, not a failed run.

## What to report

Observations, in this order: pre-flight results · reference values and when you captured them · the launch
command and its outcome · the NDJSON's key events · **what the worker actually reported** · the harness check
verbatim (including the launchctl warning) · the `ps` sweep · cleanup state (`git worktree list`, `/tmp/att-*`,
ports 3500/3600).

**Do not tell me whether it passed.** Grading is not yours, and after a run that goes well "the run passed" is
one word away from a verdict you may not issue. Describe what happened.

**And do not report `completed` as though it meant the work was done.** It does not, and that mistake has been
made here twice. If the worker says it read the HEAD sha, **say which sha it reported** so a human can check it.
For `claude` on the persistent path the worker's cwd is session-level, so its work lands in the assigned
`workdir` — **not** the nested `agentalk-task-*` directory that appears inside it.

If the run fails, that is a completely acceptable outcome and an honest report of it is a complete deliverable.
**A worker that stops and reports a blocker has not failed this rung — you are the one under test, not it.**

---

**Baseline at time of writing:** AgentTalk `48c6ddb` (master, pushed, clean) · one worktree, master only ·
`/tmp` free of `att-*` · ports 3500 and 3600 free · client `c7a5991`, wire contract **v8**, hash matches.
