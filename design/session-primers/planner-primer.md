---
role: planner
key: 20260727-1912-c4e7a2
written: 2026-07-27 (late) by Claude — session close: BL-090/089 shipped, BL-091 accepted, the H-ladder run to completion with Hermes in the operator chair
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
`design/*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item — read those first.**
Resume from the backlog, **NOT from chat**.

## Where we are (2026-07-27 close)

AgentTalk **`cff1cfa`**, pushed and in sync with origin. Client `c7a5991`, untouched. Green: `tsc -b` 0 · suite
**481/481** (75 files) · backlog **92 items, 0 warnings**. One worktree, `master` only, ports 3500/3600 free, no
strays, harness byte-identical. The PO's modified `com.fausto.agenttalk-orchestrator.plist` is deliberately
untouched — leave it.

**Shipped today:** [[BL-090]] + [[BL-089]] (the harness goes loud, not quiet — `repo-unavailable` is now
`critical`, `diffRepo` compares paths) · [[BL-091]] **deferred: unmitigated, accepted** with a manual sweep now
wired into runbook §10a · [[BL-092]] filed, then **corrected against its own investigation** · the H-ladder
(H-0/b/c/d, H-1, H-2) with **Hermes in the operator chair** · the BL-092 investigation merged, authored by a
governed worker under a Hermes-operated launch · a hygiene fix (`server.mcpReady`).

## Your queue

1. **[[BL-092]] is OPEN and has a recommendation waiting** — `design/bl092-investigation.md` recommends **option
   D**: instrument `openSocket()` to catch `ws`'s `unexpected-response` event, which carries the `Server:` header
   and would name the listener that answers the `403`. Test-local, additive, no production risk. **Both originally
   recorded options are refuted**; binding `127.0.0.1` is held as a conditional fix and would be a Rule-2
   show-stopper in production (`server.ts:967` — the UI is browsed over the LAN).
2. **[[BL-086]]** — a **PO decision**: a worker launched in `agentalk-mcp-client` inherits no governance. Still
   open; sidestepped for the ladder by keeping the workdir in AgentTalk.
3. **[[BL-084]] T2** — the real [[BL-078]] fix, fully unblocked, carries a genuine behaviour change to fence.
   Wants a fresh budget window. **[[BL-028]]** is T3, blocked behind it.
4. **Incidental, unfiled:** `apps/orchestrator/tsconfig.json` excludes `src/__tests__/**`, so **test files are
   never typechecked**. Found while fixing the hygiene item; annotations corrected, exclusion left alone. Filing
   it is a judgement call — fixing it likely surfaces a pile of pre-existing errors.

**Next rung: a LONG operator run.** H-1 was 50s and H-2 ~5min. **Nothing has tested monitoring a long-running
process** — which is precisely the failure class that retired Hermes (LB-49/LB-50). Do not cite the ladder as
evidence that it works. Also untested: anything not PO-relayed by hand.

## What to reuse — the mechanism that worked

**Pre-registration without concealment.** Write the bar, keep it OUTSIDE the repo, commit only its **SHA-256**
before hand-over, publish the bar at grading. The hash proves no row was added, softened or retuned after the
results were seen. Four rounds, all verified clean. Concealment on a shared filesystem is impossible and
pretending otherwise is theatre — the property you actually need is pre-registration, and the hash delivers it.

**But:** the forensic half fails. **atime is not usable on this filesystem** — a file certainly read showed no
update. A fence like "don't read the bar" rests on self-declaration; make the tripwire *self-declaring* (a decoy
that asks its reader to report it, scoring the same either way) rather than pretending you can detect it.

## Op notes

- **Worktrees (MANDATORY for code):** `node scripts/wt-setup.mjs create <id> --base master`. **It prepends
  `att-`**: `create op-h2` → `/private/tmp/att-op-h2`, branch `task-op-h2`. Passing `att-op-h2` yields
  `att-att-op-h2` — this bit us and is now documented in runbook §1. **Stage files EXPLICITLY.** A multi-path
  `git add` where one path does not exist stages **nothing** — check `git status` after committing.
- **Gates:** `npx tsc -b` + `npx vitest run`; `npm run backlog:check` after ANY backlog edit (update **both** the
  header `status:` and the prose tag).
- **Operator runs:** `design/launch-and-monitor-runbook.md` is the contract — corrected today for the `wt-setup`
  output contract and for absolute-path invocation (§5; the old `cd`-into-client text contradicted the charter).
  Briefs and bars for the ladder are in `design/operator/`.
- **Baseline discipline:** snapshot **LAST**, after your final commit, immediately before handing over — and then
  **stay off the repo**. I contaminated H-0b's baseline by working after taking it and had to grade fences by
  attributing commits instead of reading the rail.
- **BL-091 sweep** (now procedure, before cleanup):
  `ps ax -o pid,etime,command | grep -E "[s]leep [0-9]|[u]ntil |[w]hile |[l]auncher\.mjs|[c]laude -p"` — a list
  for a human to judge, never a verdict.
- **`completed` ≠ done.** Grade the artifact, at the coordinates where the process actually stood: for `claude`
  on the persistent path work lands in the **parent workdir**, not the nested `agentalk-task-*`.
- **Meter:** `node scripts/usage.mjs` — best-effort, never blocking. Session hit **87%** at close (resets ~21:40);
  weekly a comfortable **26%**. A launched worker draws on the **same claude pool** as you — `cap.meter` is
  mandatory and, now that the session figure is no longer pinned at 100%, it can actually fire.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
