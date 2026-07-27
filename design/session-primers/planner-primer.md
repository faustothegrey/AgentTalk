---
role: planner
key: 20260727-2338-b71e5c
written: 2026-07-27 (night) by Claude — session close: BL-093 shipped, BL-092 and BL-095 merged from agent-authored branches, O-3 cleared and O-4 INCOMPLETE
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared UNAVAILABLE, so you
are likely sole agent under the **resource-scarcity fallback**: wear every hat, handshake once per role, declare
all of them, keep each gate's discipline separately. **Standing Conditional Reassignment ACTIVE** (you may
implement). **"merge" and "push" are separate words and the PO means it** — it held all session again.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify against `origin/master`.
Never trust a primer's hash, including this one.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Plans in
`design/*-plan.md`; operator briefs, bars and gradings in `design/operator/`. **Closed items carry a closing block
+ telemetry inside the backlog item — read those first.** Resume from the backlog, **NOT from chat**.

## Where we are (2026-07-27 close)

AgentTalk **`1a0b02f`**, pushed and in sync. Client `c7a5991`, untouched. Green: `tsc -b` 0 · suite **496/496**
(76 files) · backlog **96 items, 0 warnings**. One worktree, `master` only, ports 3500/3600 free, no strays. The
PO's modified `com.fausto.agenttalk-orchestrator.plist` is deliberately untouched — leave it.

**⚠️ THE GATE CHANGED TODAY.** `apps/orchestrator/tsconfig.json` no longer excludes `src/__tests__/**`, so
**`npx tsc -b` now typechecks test files** — 25 of them, previously invisible. A red in a test file is now
possible where it was structurally impossible before. Expect it rather than being surprised.

**Shipped today:** [[BL-093]] (the backlog became machine-selectable: `blocked_by` + `autonomy`, fail-closed) ·
[[BL-092]] (the 403 now names its listener) · [[BL-095]] (48 hidden type errors, gone) · **two of those three were
written by governed workers under Hermes-operated launches and merged into mainline** — a first.

## Your queue

1. **[[BL-094]] — the only `autonomy: eligible` item, and the natural next agent task.** BL-092 instrumented
   **one of four** WebSocket dial sites in `server.test.ts`; `openSocketWithMessage()` and the raw dial in the
   BL-048 keepalive test are still blind. **The root cause was a goal that named a FILE instead of a PROPERTY** —
   worth internalising before you write the next one.
2. **[[BL-096]] — the long-run failure class is STILL untested.** O-4 was built to observe an abnormal
   termination; the worker finished in 9 minutes and the cap never fired. **No run in this project's history has
   ever been interrupted**, so what a kill leaves behind remains unknown. My recommendation, recorded in the item:
   **split the two questions O-4 conflated** — test the cap against a trivially-stalling worker (cheap), and test
   long monitoring separately.
3. **[[BL-086]]** — a **PO decision**: a worker launched in `agentalk-mcp-client` inherits no governance.
4. **[[BL-084]] T2** — the real [[BL-078]] fix, unblocked, carries a genuine behaviour change to fence.
   **[[BL-028]]** is T3, blocked behind it (now machine-enforced, not just prose).

**Do NOT cite O-3 or O-4 as evidence that long runs work.** They were 4m44s and 9m04s.

## What to reuse — mechanisms that earned their keep

**The mutation check.** Before believing any "it's green now", ask: *would this look identical if the change did
nothing?* BL-095's "48 → 0 errors, tsc clean" would have — the gate was green that morning *because it was
blind*. Injecting a deliberate error and watching it get caught is what proved the gate live. Same instinct
rebuilt BL-092's 403 from scratch rather than trusting a suite that never touches that path.

**Pre-registration without concealment.** Write the bar, hold it **outside the repo in a DURABLE location**
(`~/.claude/projects/<slug>/` — a transient temp dir nearly lost the H-2 bar), commit only its **SHA-256** before
hand-over, publish at grading. Six rounds, all clean.

**A deliberately brittle tripwire test.** `bl093-backlog-selectable.test.ts` pins the selectable set *exactly*, so
any change to what an agent may be handed goes red and forces a human look. It fired on its first real change.
**Do not loosen it to silence a red** — the brittleness is the feature.

**Sizing: read the histogram, not the total.** This is how O-4 failed. 48 errors across five error codes, 28 of
them the same missing property, is a *mechanical* task. The count measured repetition; I read it as size.

## Op notes

- **Worktrees (MANDATORY for code):** `node scripts/wt-setup.mjs create <id> --base master`. **It prepends
  `att-`**: `create op-o4` → `/private/tmp/att-op-o4`, branch `task-op-o4`. **Stage files EXPLICITLY and run
  `git status` AFTER committing** — a multi-path `git add` where one path is missing stages that path silently.
  This trap has now fired in two consecutive sessions.
- **Gates:** `npx tsc -b` + `npx vitest run`; `npm run backlog:check` after ANY backlog edit (update **both** the
  header `status:` and the prose tag). Closing an item with `autonomy: eligible` **fails the gate** — drop the
  field on closure (a small tax BL-093 created; revisit it if it bites again).
- **`git merge -F -` does not read stdin** (unlike `git commit`). Write the message to a file.
- **Operator runs:** `design/launch-and-monitor-runbook.md` is the contract; briefs/bars/gradings in
  `design/operator/`. **Do not tell Hermes to curl port 3600 at pre-flight** — that's the launcher's own
  orchestrator, so nothing answers before launch (my O-3 error, corrected in the O-4 brief).
- **`npm run backend` leaves a child that outlives the npm wrapper.** Killing the wrapper is not enough — confirm
  with `lsof` that the port is actually free.
- **`completed` ≠ done.** Grade the artifact, at the coordinates where the process actually stood: for `claude`
  on the persistent path work lands in the **parent workdir**, not the nested `agentalk-task-*`.
- **Meter:** `node scripts/usage.mjs` — best-effort, never blocking. Weekly **32%** at close (resets Jul 29 ~09:00);
  session 53% (resets ~02:39). A launched worker draws the **same claude pool** as you — `cap.meter` is mandatory.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
