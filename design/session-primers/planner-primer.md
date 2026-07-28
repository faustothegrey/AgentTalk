---
role: planner
key: 20260728-0905-e2a94f
written: 2026-07-28 by Claude — session close on the OLD machine, ahead of the move to Linux. BL-097 shipped; the
  OPERATOR charter was amended and is now machine-enforced.
---

This is your session primer.

**You are very likely reading this on a different machine than the one that wrote it.** Read §"The move" first —
some of what follows is about your environment, not the code.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared UNAVAILABLE, so you
are almost certainly sole agent under the **resource-scarcity fallback**: wear every hat, handshake once per
role, declare all of them, keep each gate's discipline separately. **Standing Conditional Reassignment ACTIVE**
(you may implement). Merge and push both happened at explicit PO instruction last session — ask, don't assume.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Plans in
`design/*-plan.md`; operator briefs, bars and gradings in `design/operator/`. **Closed items carry a closing
block + telemetry inside the backlog item — read those first.** Resume from the backlog, **NOT from chat**.

## The move — read this before you trust anything below

The PO is relocating development to a **Linux** box with **claude and hermes installed** (no codex, no agy, and
goose only if he chose to add it). **`PORTING.md` was rewritten 2026-07-28 for exactly this** — it is verified
against ground truth, and §0 lists four things the previous version got wrong. Three sections are load-bearing:

- **§7 — worktrees.** `scripts/wt-setup.mjs:22` hardcodes `DEFAULT_ROOT = '/private/tmp'`, a macOS path. On
  Linux **pass `--root /tmp`**, every time. Worktrees are MANDATORY for code, so this bites on your first task.
- **§8 — the invariant harness.** `launchctl` does not exist on Linux, and it is the *only* source of
  `LEGITIMATE`. Everything lands in `UNKNOWN`, which fails the sweep by design and gates operator runs. Export
  `AGENTTALK_SWEEP_DECLARED` or expect a wall of findings. Filed as **[[BL-098]]**.
- **§6 — your own key store.** It is keyed by the repo's absolute path, so the slug changed and your `consumed`
  set is empty unless the PO copied it. I retired the implementer primer's key to `none` before leaving so you
  would not cold-start-stop on two primers at once. If you find a *third* primer reading fresh, that is the
  empty-store artefact, not a real hand-off — say so rather than acting on it.

**Verify the environment before scoping work:** `git fetch` BOTH repos (`AgentTalk`, `agentalk-mcp-client`) and
compare against `origin/master`. Never trust a primer's hash, including this one.

## Where we are (2026-07-28 close, on the old machine)

AgentTalk **`04043a5`**, pushed and in sync. Client `c7a5991`, untouched. Green: `tsc -b` 0 · suite **513/513**
(76 files) · backlog **98 items, 0 warnings**. One worktree, `master` only, ports 3500/3600 free. The PO's
modified `com.fausto.agenttalk-orchestrator.plist` is deliberately untouched — leave it.

**Shipped this session — one arc, two commits of consequence:**

1. **The OPERATOR charter was amended** (`7948ea4`). Hermes is now the PO's gateway/monitoring platform: full
   READ of backlog and metrics, and a **fenced WRITE** — it may file items and append observations, never
   `autonomy: eligible`, `blocked_by`, `status: done`, or anything on a deferred item. Path allowlist
   `design/backlog.md` + `design/operator/**`. **It still holds no authority**: no baton, no instruction, no
   verdict, no push. The retirement of 2026-07-02 stands — that banned *workflow participation*, and operating
   is not that.
2. **[[BL-097]]** (`6ab9aaf`) made that fence machine-checked — **because the amendment blocked itself.** The
   harness treated any HEAD move as `critical` and *"never allowlisted"*, so the operator's first lawful commit
   would have fired three criticals and gated the next run. `expect.allowWritePaths` fixes it, failing closed.
   Plus one check no allowlist can suppress: the **effective agent-selectable set**.

## Your queue

1. **[[BL-094]] — still the only `autonomy: eligible` item, and the natural next agent task.** BL-092
   instrumented **one of four** WebSocket dial sites in `server.test.ts`; `openSocketWithMessage()` and the raw
   dial in the BL-048 keepalive test are still blind. **The root cause was a goal that named a FILE instead of a
   PROPERTY** — internalise that before you write the next one.
2. **[[BL-098]] — the Linux harness gap above.** Cannot be closed from macOS and should not be closed on
   reasoning alone; it needs the new box. If you are *on* the new box, it is cheap and it unblocks clean
   operator runs.
3. **[[BL-096]] — the long-run failure class is STILL untested.** No run in this project's history has ever been
   interrupted. Split the two questions O-4 conflated: test the cap against a trivially-stalling worker (cheap),
   and test long monitoring separately.
4. **[[BL-086]]** — a **PO decision**: a worker launched in `agentalk-mcp-client` inherits no governance.
5. **[[BL-084]] T2** — the real [[BL-078]] fix, unblocked, carries a genuine behaviour change to fence.
   **[[BL-028]]** is T3, blocked behind it (machine-enforced, not just prose).

**Do NOT cite O-3 or O-4 as evidence that long runs work.** They were 4m44s and 9m04s.

## What to reuse — mechanisms that keep earning their keep

**The mutation check.** Before believing any "it's green now", ask: *would this look identical if the change did
nothing?* BL-097 shipped only after two deliberate mutations — neutering the eligibility filter, and making
`classifyHeadMove` return `allowed` unconditionally — each reddened the expected bars and was reverted. Cheap,
and it is the difference between a bar and a decoration.

**Gate 1 is not a formality, even when you are both seats.** Reviewing my own BL-097 plan caught that a **merge
commit** prints no paths under `git log --name-only` and would have satisfied *"every path matches"* vacuously —
waving through the one act the operator may never perform. Found by reading the plan as an adversary, before any
code existed. Wearing both hats does not excuse skipping the pass; it makes the pass the only thing standing in.

**Grade at the coordinates where the process actually stood.** `completed` ≠ done. For `claude` on the
persistent path, work lands in the **parent workdir**, not the nested `agentalk-task-*`.

## Op notes

- **Worktrees:** `node scripts/wt-setup.mjs create <id> --base master` (**`--root /tmp` on Linux**). It prepends
  `att-`. **Stage files EXPLICITLY and run `git status` AFTER committing** — a multi-path `git add` where one
  path is missing stages that path silently. It has now bitten three sessions running; the check after the
  action is the control, the rule before it is decoration.
- **Gates:** `npx tsc -b` + `npx vitest run`; `npm run backlog:check` after ANY backlog edit (update **both** the
  header `status:` and the prose tag). Closing an item with `autonomy: eligible` **fails the gate** — drop the
  field on closure.
- **`git merge -F -` does not read stdin** (unlike `git commit`). Write the message to a file.
- **Operator runs:** `design/launch-and-monitor-runbook.md` is the contract. **Pass `--expect` with
  `allowWritePaths`** or the fence is not applied and a lawful operator commit reads as two criticals — nothing
  forces the flag yet (recorded in BL-097's closing block, and a fair follow-up).
- **`npm run backend` leaves a child that outlives the npm wrapper.** Confirm with `lsof` that the port is free.
- **Meter:** `node scripts/usage.mjs` — best-effort, never blocking, and **it will not exist on the new machine**
  (external service, PORTING.md §11). Write `telemetry: unavailable` and carry on. At close here: weekly **35%**
  (resets Jul 29 ~09:00), session 16%.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the
PO's go.
