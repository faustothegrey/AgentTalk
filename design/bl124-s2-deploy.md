# BL-124 S2 — deploy the sink and drive traffic (PO runbook)

**Written:** 2026-08-13 by Claude (planner), after S1 merged (`96ab154`) and pushed (`4b0d7db`).
**Status:** **NOT EXECUTED.** Every step below is written from verified facts about this machine, but **none
of the deploy steps have been run** — deployment is the PO's hand (plan §6). Where I verified something, the
command that verified it is given; where I did not, it says so.

> **Why this file exists.** S1 is merged and **not deployed**: the live orchestrator still runs the pre-S1
> build, so the sink is exactly as absent from production as `recorder?.record(...)` was. Left alone, BL-124
> sits in precisely the state it was filed to describe. This turns S2 into apply-restart-verify instead of a
> research task.

---

## 0. The coordinates, verified — read these before touching anything

| Thing | Value | How I checked |
|---|---|---|
| launchd label | `com.fausto.agenttalk-orchestrator`, domain **`gui/501`** | `launchctl print gui/$(id -u)/…` |
| **The plist that is actually loaded** | **`/Users/fausto/Software/AgentTalk/com.fausto.agenttalk-orchestrator.plist`** | `launchctl print` → `path =` |
| `~/Library/LaunchAgents/…plist` | a **symlink** to the repo file above — same file, not a copy | `ls -la` |
| …and it is **git-tracked** | so the S2 edit is a repo change: it shows in `git status` and wants a commit | `git ls-files` |
| Runs | `/usr/local/bin/node dist/index.js` from `apps/orchestrator` | plist |
| Live ports | HTTP **3741**, MCP **54321** | plist `EnvironmentVariables` |
| `KeepAlive` | **true** — the job restarts itself if killed | plist |
| Logs | `~/.hermes/logs/agenttalk-orchestrator{.log,.err.log}` — **append across restarts** (41 boots) | `grep -c "Orchestrator V1 started"` |
| Sink default path | `~/.agenttalk/agent-non-reply.jsonl` — **does not exist yet** | `ls` |
| Idle threshold | `agentIdleTimeoutMs: 180000`, **not env-overridable** — a constructor default | `registry/config.ts:19` |

**⚠️ The plist coordinate is the one that can waste an evening.** Editing the file under
`~/Library/LaunchAgents/` is fine *because it is a symlink to the repo file*; editing a **copy** there, or
assuming the repo file is inert, would produce a deploy that silently changes nothing. This exact class of
mistake — a rigorous check at the wrong coordinates — is [[BL-053]]/[[BL-059]] and it cost this project twice.

---

## 1. Build (nothing is deployed until this runs)

```bash
cd /Users/fausto/Software/AgentTalk
npm run build          # tsc -b && the web build; `npx tsc -b` alone suffices for the backend
```

**Verify the build actually carries S1** — this is the check whose *wrong* version produced Gate 1's F2:

```bash
grep -c NonReplySink apps/orchestrator/dist/server.js        # expect >= 1  (currently 0)
ls -la packages/observability/dist/recordings/non-reply-sink.js
```

> **⬛ CORRECTION 2026-08-13, same session — this paragraph said "I deliberately did NOT run this build … so
> `dist/` is still pre-S1 as you read this, and the `grep -c` above returns `0` until you build." THAT IS NO
> LONGER TRUE, AND I AM THE ONE WHO MADE IT UNTRUE.** My end-of-session verification sweep ran `npx tsc -b`
> from the repo root as a *gate check*, which rebuilds `apps/orchestrator/dist` as a side effect. **The build
> in step 1 is therefore already done:** `grep -c NonReplySink apps/orchestrator/dist/server.js` now returns
> **3**, not 0.
>
> **What this changes for you.** Step 1 is satisfied — verify it rather than repeat it (repeating is harmless).
> **What it also means, and this is the part worth knowing:** `KeepAlive` is `true`, so **the next time the
> orchestrator restarts for any reason — crash, reboot, your hand — it will load S1**, with or without step 2.
> That is the intended end state and it is safe (the sink defaults to `~/.agenttalk/`, writes only when a
> notice fires, and cannot propagate anything), but it is now a thing that can happen **without a deliberate
> deploy**, which is precisely what I claimed to be preventing.
>
> **Why the original caution was right anyway:** a build is a deployment step, and I performed it while
> believing I was only checking a gate. `tsc -b` is not a read. The running process (pid 672) still holds the
> old code in memory, so nothing changed *yet* — but the artifact on disk is no longer the one I described.

## 2. Edit the plist — add the recording path

Add **one** key to `EnvironmentVariables` in
`/Users/fausto/Software/AgentTalk/com.fausto.agenttalk-orchestrator.plist`:

```xml
    <key>AGENTTALK_RECORDING_PATH</key>
    <string>/Users/fausto/.agenttalk/session-recording.jsonl</string>
```

**This is belt-and-braces, not the deliverable.** The sink needs **no** configuration — that is the entire
point of S1 and bar B1. Setting `AGENTTALK_RECORDING_PATH` merely switches the *other*, optional channel back
on so the session recordings are richer. **If you skip this step the measurement still works.** Do not let a
future reader conclude the sink depends on it.

Optionally also set `AGENTTALK_NON_REPLY_SINK_PATH` to move the sink; leaving it unset is recommended, so the
default path is what gets exercised.

## 3. Restart so the new env is picked up

`kickstart -k` restarts the job from its **already-loaded** definition, so it will **not** pick up a plist
edit. Reload the job:

```bash
launchctl bootout   gui/$(id -u)/com.fausto.agenttalk-orchestrator
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.fausto.agenttalk-orchestrator.plist
```

*(If you skipped step 2 entirely, `launchctl kickstart -k gui/$(id -u)/com.fausto.agenttalk-orchestrator` is
enough — no config changed, only the code on disk.)*

**Not executed by me.** `bootout` on a `KeepAlive` job is the standard reload and is expected to be clean, but
I have not run it on this machine.

## 4. Verify the deploy BEFORE driving any traffic

```bash
lsof -ti :3741                                     # a NEW pid
ps -o pid,lstart -p $(lsof -ti :3741 | head -1)    # started AFTER your build
curl -s http://127.0.0.1:3741/api/backlog | head -c 80
launchctl print gui/$(id -u)/com.fausto.agenttalk-orchestrator | grep -i -A6 environment
```

**What this proves and what it does not.** A new PID plus `NonReplySink` in `dist/` proves the **build** is
live. It does **not** prove the sink **writes** — nothing does until a real notice fires. The bars prove the
behaviour in-process; only §5 proves it end to end. Do not report "deployed" as "measuring".

## 5. Drive traffic

Real multi-agent work, until the pre-registered stopping rule fires (plan §8 q2, fixed **before** any result
was visible):

> **Stop at 20 notices, or 3 real multi-agent runs, whichever comes first** — and report the distribution
> as-is, even if thin.

A notice requires an agent to hold an **outstanding turn** (`currentTurnId` set) and stay silent **> 180 s**,
with the sweep running every 30 s — so expect a notice no sooner than ~3.5 min into a genuine stall. The
threshold is **not** env-tunable, and **tuning it is a show-stopper** (plan §6): the number is the output.

Watch it arrive:

```bash
tail -f ~/.agenttalk/agent-non-reply.jsonl
grep -c '"kind":"notice"' ~/.agenttalk/agent-non-reply.jsonl
```

**A restart mid-run splits the measurement.** A `{"kind":"boot"}` line marks that split — but it is written
**on the first notice of a boot, not at startup**. The marker is emitted inside the sink's single guarded
write path, behind `bootPending` (grep `non-reply-sink.ts`), and nothing reaches that path until a notice is
recorded; construction opens nothing, deliberately — the wiring comment above `new NonReplySink` in
`server.ts` says so in as many words: *"Nothing is opened until a notice actually arrives."*

**So a boot that records zero notices leaves no boot line at all** — and until the first notice is ever
recorded, no file and no `~/.agenttalk/` directory either. **An absent `~/.agenttalk/` after a restart is the
expected state, not a failed deploy.** Do not read it as one, and do not "fix" a sink that is behaving as
specified; the lazy open is intended and bar-covered.

**The reduction rule is unchanged by any of that**, and it is the reason the marker exists: the sweep's state
(`lastProgressAt`, `currentTurnId`, the dedup map) is rebuilt per process, so silence must accumulate inside
one boot. Never reduce across a boot line without saying so — and note that a boot which produced no notices
leaves no line to reduce across, so a restart can split the measurement **without** leaving a visible marker.

## 6. ⛔ Stop conditions — report, do not fix

- **The sink stays empty after genuine >180 s stalls.** **That is a RESULT, not a failed spike** (plan §5). It
  refutes W1 and lands us in W2 — a shipped detector that cannot fire, a **larger** finding than the threshold
  it was meant to inform. **Report it. Do not widen the run until something appears.**
- **A `[NonReplySink] DEGRADED` line on stderr.** The sink is designed to fail loudly; that line means it
  could not write and names the path. Fix the path, do not silence the message.
- **Any urge to lower the threshold** because notices are slow to appear. Show-stopper.

## 7. Then S3

Reduce the sink to a distribution by `reason` × `transport` — `quiet` vs `awaiting-input`, `attached` vs
`in-process` vs `null` — write it into a durable artifact, and state **which of W1/W2 it resolves**. That
artifact is what T3c consumes, and BL-124 closes on it, not on this deploy.

**`transport: null` is its own bucket, never folded into a known one** — it means the agent was gone at
resolution time or genuinely carried no transport. Folding it would recreate the attached-vs-in-process
confusion ([[BL-120]]) the field exists to prevent.
