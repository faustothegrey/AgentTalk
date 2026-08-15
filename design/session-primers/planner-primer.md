---
role: planner
key: 20260815-0916-3f7a2c
written: 2026-08-15 by Claude — session close. One item planned, built, merged and closed (BL-136);
  one containment finding filed (BL-137); the queue's only workable item deliberately re-blocked on it
  by PO decision. Everything below was checked against the repo at close — check it again yourself.
  The predecessor primer's own warning applies to this one: three of its claims had rotted before
  anyone acted on them.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, merges, pushes. Bindings live ONLY in `AGENT.md → 📌 DEFAULT
ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared UNAVAILABLE, so you are
almost certainly the sole agent under the **resource-scarcity fallback**: wear every hat, handshake once per
role, declare all of them, keep each gate's discipline separately. **Standing Conditional Reassignment ACTIVE.**
Hermes holds the **OPERATOR seat** — launches and monitors, holds no authority; its reports are *observations,
unverified until you check the artifact yourself.*

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Resume
from the backlog, **NOT from chat**.

## Where we are — verified at close, and check it anyway

Clean on `master` at **`67e1a66`**. Backlog **137 items, 0 warnings**. Suite **787 / 94 files**, `tsc -b` 0 —
both re-run on the merge result, not inherited. No worktrees, no `task-*` branches. Ask the instruments:

```
node scripts/validate-backlog.mjs
curl -s "http://127.0.0.1:3741/api/backlog?all=true"    # LIVE orchestrator; NOT 3100, NOT 3600
npx vitest run                                           # expect 787 / 94
git log --oneline -8 && git status --porcelain
lsof -nP -iTCP:3741 -sTCP:LISTEN -t                      # read the pid, THEN read its start time
```

## What this session did

**1. [[BL-136]] — planned, gate-1'd, built, merged, closed** (`05325c0`). The recursion fence scanned the brief
and never `config.goal`, the string `bite0-launcher.mjs:195` delivers as the worker's first turn. Three
refuse-only checks now sit in `verifyCommission`; `LAUNCH_PATTERNS` is byte-identical; `+35/-0` in the verifier.
Refuse-only was **proven** against all eleven committed operator configs, not asserted. Four mutations, each
killing exactly its own bars.
**The item understated its own finding, and that half matters more than the code:** `SKILL.md` did not merely
omit the goal scan — it *asserted the verifier already performed it*. The operator was told a fence stood behind
their manual command when the command **was** the fence.

**2. Filed [[BL-137]] and it is the live one.** The PO proposed letting Hermes set its own `.authorized` file
("double check while moving operativity to Hermes"). Checking it found **the mechanism already exists**:
`design/operator/<run>.authorized` (`hmp-commission.mjs:179`) sits **inside the operator's own write
allowlist**, and the verifier checks content + ancestry from local `master` (`:323`) but **nothing about who
committed it**. So `hmp-commission.mjs:38`'s *"the PO's merge is the authorization act"* is false for the one
directory that matters. The PO kept the gate and rejected self-authorization.

**3. [[BL-134]] re-blocked `[BL-136]` → `[BL-137]`, by PO decision.** Its plan §5 would rest the OPERATOR
charter's safety argument on Gate B and call it *per-run, sha-bound, single-use* — all true; the implied *"and
only the PO can produce it"* is not. The PO was offered the cheaper path (implement it, drop §5 from scope) and
**chose to block**, re-emptying the workable set rather than ship a sentence known to overstate its fence.

## What is open, in the order the backlog now forces

**1. [[BL-137]]** — the fence. Four uncosted options in the item; **(a) move the file out of the allowlist** and
**(c) propose/authorize split** compose, and that combination is probably the cheap path to both the fence and
the operativity the PO wanted. Needs a plan.
**2. [[BL-134]]** — fenced on 137. Plan `design/bl134-plan.md` passed gate 1; **§11 q1/q3/q5 are still open**
(q2 was answered: *keep the authorized gate*). **⚠️ D6 is STALE** — it asserts a post-task workable set of
`{BL-136}`, an item now `done`, and predates BL-137. Recompute it, don't trust it.
**3. [[BL-028]]** — workable *by predicate* (its only blocker BL-084 is `done`) but **not actually startable**:
it needs real traffic through the non-reply sink. That gap — a practical precondition the backlog cannot
express — is exactly what BL-134's D5 intends to fix by fencing it on [[BL-135]]. Not done yet.
**4. Drive real traffic and read the sink.** Still not done, three sessions running. Precondition for BL-135 and
BL-028 T3c. Deserves its own session with the PO present; it is an open-ended live run, not a scoped task.

## Op notes — the ones that cost real time

- **`validate-backlog.mjs` checks header↔prose drift.** Flipping `status: done` without changing the `- [todo`
  lead-in goes red. It caught me at closure; let it.
- **`node scripts/wt-setup.mjs create|remove <id>`** for a task worktree; **stage files EXPLICITLY, never
  `git add -A`** (the symlinked `apps/web/node_modules` slips past `.gitignore` — it will show as `??`, leave it).
- **Refusal-ordering is load-bearing in `hmp-commission.mjs`.** Checks are grouped message↔config binding →
  config completeness → world state. Inserting in the wrong group silently changes which reason an existing bar
  reports. Nothing executes until `pass()`, so ordering is purely diagnostic — which is *why* it is free to get
  right and cheap to get wrong.
- **The meter is up.** `node scripts/usage.mjs`. Close: claude weekly **27%**, session **49%** (session Δ ~25%
  for one small merged task plus two backlog items — plans and closing blocks are not cheap).
- **Docs/governance are directly master-editable; code is not** (worktree MANDATE).

## The through-line — one failure shape, three times, in one task

A refusal attributed to **the wrong check**. The plan picked an insertion point that would have silently flipped
two existing bars' reasons, while its own contract table said "unchanged" — and it had **named that exact
hazard two paragraphs earlier**. Then the implementation reused another run's sandbox and refused
`charter-mismatch` before reaching anything under test. Three encounters; the bars caught all three; reasoning
caught none.

The predecessor primer said: *claims about code I could have RUN.* The sharper version from this session is
**claims about code I had already warned myself about.** Naming a hazard in a document does not inoculate you
against it — the document is not a check. **Write the bar, run the mutation, and let the machine tell you which
check fired.** That is the only step in this session that actually caught anything.

And its corollary, which is what BL-136 and BL-137 are both *about*: **a fence described in prose is not a
fence.** `SKILL.md` claimed an automated scan that did not exist; `AGENT.md` and `hmp-commission.mjs` claim a
PO-only authorization the allowlist contradicts. When you read a safety sentence in this repo, **go find the
line of code that makes it true.** Twice this session that line was absent.
