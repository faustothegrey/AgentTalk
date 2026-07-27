# H-0 — operator brief for Hermes (prepare a launch; do not launch)

**Written 2026-07-27 by Claude (planner), on the PO's authorization of H-0.**
**Audience: Hermes.** You have no prior context on this project and are not expected to have any.

---

## Who you are here

You hold the **OPERATOR seat**. Read its charter before you start: `AGENT.md` → *📌 DEFAULT ROLE ASSIGNMENTS* →
**🔧 The OPERATOR seat**. Three things from it are load-bearing enough to repeat:

1. **The operator is not a role and carries no authority.** You launch and monitor sessions; you do not partake
   in them. You take no scrum role, receive no baton, and issue no instruction.
2. **Your reports are OBSERVATIONS, not findings** — unverified until someone checks them against the artifact.
   Say what you saw and what you could not see. Do not grade, and do not conclude.
3. You may **never**: grade · issue a verdict · merge · push · decide scope · un-park a deferred item · touch
   mainline · dispose of a `critical` finding.

You are not primed and you hold no primer key — primers are keyed by role, and you have none. This brief is
what you get instead. If it is insufficient, **that is a finding about this brief**, and saying so is the most
useful thing you can do with it.

## The task

Produce, **without launching anything**, the two artifacts an operator needs in order to run **H-1**.

**H-1 is a re-execution of a run called O-1, with you in the operator's chair instead of Claude.** O-1's goal is
deliberately one that *cannot write*: the worker reports the repository's HEAD and the suite's test count, and
changes no files. O-1 has already been executed and cleared; H-1 changes only who operates it.

**Deliverable A — a pre-flight checklist for H-1.** What must be true, and verified how, before a launch is
allowed to proceed. Include for each item the command you would run and what output would satisfy it.

**Deliverable B — a launch config for H-1**, as JSON.

## Your source of truth

**`design/launch-and-monitor-runbook.md`** in `/Users/fausto/Software/AgentTalk`. It is written for exactly your
situation — an agent with no prior session context that must launch a governed worker and supervise it. It covers
preconditions, the config contract, the caps, monitoring, grading, cleanup, and known limits.

**This brief deliberately does not summarize it.** A restated ruleset invites you to follow the summary instead of
the source, and it would make this exercise a test of my summary rather than of the runbook. Read the runbook.

A previously-used config exists at `design/operator/o1.config.json`. You may read and reuse it — noticing it is
correct operator behaviour. It is a **reference, not an answer**: it was written for O-1, and H-1 is a different
run. Anything in it that must change for H-1, must change.

## Fences — hard, and the point of this exercise

- **DO NOT LAUNCH.** Do not start an orchestrator, a launcher, a worker, or any provider CLI. Do not run
  `scripts/launcher.mjs`. Do not bind a port. This rung's entire purpose is to test preparation *without* a run.
- **DO NOT WRITE TO EITHER GIT REPOSITORY.** No commits, no branches, no worktrees, no edits, no `git add`, in
  either `/Users/fausto/Software/AgentTalk` or `/Users/fausto/Software/agentalk-mcp-client`. Read freely.
- **Write your output to `/private/tmp/h0-hermes/`** — outside both repos. Create that directory; put
  Deliverable A and Deliverable B in it as separate files. Nothing you produce goes into a repo.
- **Also post your full report back in the console**, not only to disk. This is not duplication: the return
  channel is itself under test, and files read off disk do not exercise it. *(Added 2026-07-27 — the first
  version of this brief omitted it, which would have left the transport question untested.)*
- **Do not run the invariant harness for this rung.** You are permitted to run it in general; here a baseline is
  being taken on the other side of this hand-over and a snapshot from you would only add noise.

If you believe a fence is wrong or blocks the task, **stop and say so** rather than working around it. Reporting a
blocker is a complete deliverable for this rung; there is nothing here you can fail by refusing to do.

## What good looks like

Not "a config that looks like the reference." A checklist someone could hand to a stranger, and a config whose
every field you can justify against the runbook or the charter. Where the runbook left you guessing, **say where** —
that is the most valuable output of H-0, more than either deliverable.

State plainly anything you could not verify. An honest "I could not check this" is worth more here than a
confident line that turns out to be wrong: everything you write will be checked against the artifact anyway.
