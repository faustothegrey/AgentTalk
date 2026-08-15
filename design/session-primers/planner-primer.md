---
role: planner
key: 20260815-0820-9e4c7b
written: 2026-08-15 by Claude — session close. One plan written and gate-1'd (BL-134), two items filed,
  the live orchestrator finally redeployed. Everything below was checked against the repo at close.
  Check it again yourself — three claims in this file's predecessor had already rotted by the time
  anyone acted on them, and one of them was mine.
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

Clean on `master` at **`086fc0d`**. Backlog **136 items, 0 warnings** — 103 done · 26 deferred · 4 dropped ·
**3 todo** (BL-028, BL-134, BL-136). The agent-selectable set is **still `{}`**; nothing this session became
launchable. Ask the instruments:

```
node scripts/validate-backlog.mjs
curl -s "http://127.0.0.1:3741/api/backlog?all=true"    # LIVE orchestrator; NOT 3100, NOT 3600
npx vitest run                                           # expect 779 / 94 files — NOT re-verified this
                                                         # session (no code changed); treat as inherited
git log --oneline -6 && git status --porcelain
lsof -nP -iTCP:3741 -sTCP:LISTEN -t                      # read the pid, then read its START TIME
```

## What this session did

**1. The live orchestrator was redeployed — and the warning telling us to do it was already stale.**
`tsc -b` exit 0 → `launchctl kickstart` → **pid 7121, 15 Aug 07:47:19**. All four fixes of the non-reply thread
now run for the first time. **The lesson is in the discovery, not the act:** BL-028 and BL-133 both said "pid
89437, started 13 Aug, a day before the merge." That pid no longer existed — the service had been restarted at
14 Aug 23:28, *after* every merge. The conclusion survived for a **different, checkable** reason: the restart
came with no rebuild, so `exec-timeout` (BL-129) and `team_no_progress` (BL-133) were absent from `dist`
entirely. **A restart is not a redeploy.** Both stale passages are corrected in the backlog.

**2. [[BL-134]] — planned and gate-1'd.** The PO asked that any *workable* item also be launchable by Hermes.
The finding: **two independent authorization systems for one act, which never reference each other.** Gate A
(`autonomy: eligible` + todo + blockers, `backlog.ts:274`) and Gate B (`hmp-commission.mjs` — committed brief at
a sha, `<run>.authorized`, hashed bar, replay guard). **`autonomy` appears nowhere in hmp-commission.mjs's 626
lines**; Gate A's only consumers are `server.ts:260`, the BL-093 test and `infra-invariant.mjs:439` — none in
the launch path. Diagnosis: **`autonomy` is a readiness field wearing an authorization field's clothes.** Shape
adopted: **workable** (`todo` + blockers resolved, mechanical) vs **launchable** (PO-committed per-run
authorization). Readiness becomes `blocked_by`; recursion moves to the launch gate.

**3. Filed [[BL-135]]** (BL-028's §9 q2 — *should the sweep ever kill?* — `deferred`, so it fences without being
proposable) and **[[BL-136]]** (the commission scans the brief but never `config.goal`, the string the worker
actually receives as its first turn — `bite0-launcher.mjs:195`). **BL-134 is `blocked_by: [BL-136]`**, which is
a dogfood of its own mechanism.

## What is open, in the order the backlog now forces

**1. [[BL-136]] is the ONLY workable item** — small, additive, refuse-only, and it unblocks BL-134. Note it
touches Gate B, the real fence; a launch-gate change was deliberately kept out of BL-134's scope.
**2. [[BL-134]]** — the predicate change. Plan `design/bl134-plan.md` passed gate 1 on its second pass; **§11 q5
(rename `?selectable=true` or not — recommendation: not) is still open for the PO.**
**3. [[BL-135]] is the PO's alone.** Now answerable-in-principle for the first time: the instrument is deployed
and the sink `~/.agenttalk/agent-non-reply.jsonl` is a clean zero — **zero traffic, not zero silence**
(`/api/teams` and `/api/agents` were both `[]` all session).
**4. Drive real traffic and read the sink.** Still not done. It is the precondition for BL-135 and for BL-028 T3c.

## Op notes — the ones that cost real time

- **The plan reviewer caught two BLOCK-class defects in the planner's work, and both were the same author.**
  Read `bl134-plan.md` §13 before writing your own plan; the pattern is not exotic.
- **Run the predicate, don't reason about it.** A DoD row asserting a set was wrong, and one `curl` + six lines
  of node settled it. That command is in §13 F1.
- **Use `node scripts/wt-setup.mjs create <id>`** for a task worktree; **stage files EXPLICITLY, never
  `git add -A`** (the symlinked `node_modules` slips past `.gitignore`).
- **`/api/agents` does not serialize `transport`.** An endpoint's output is a projection, not the object.
- **The meter is up.** `node scripts/usage.mjs`. Close of session: claude weekly **25%**, session **24%**.
- **Docs/governance are directly master-editable; code is not** (worktree MANDATE).

## The through-line — a warning about yourself, not the code

The predecessor primer said: *the most expensive mistakes were claims about code I had not read.* This session
produced the sharper version — **claims about code I could have RUN.**

Three times the fix was one command away. The stale pid: one `ps`. The false DoD bar: one `curl`. The "79 items
become selectable": one filter. Each was stated confidently in a durable artifact, and two of them had already
influenced a decision before being caught. **The counterweight held, though, and it is the thing to imitate:**
every one was caught by *executing the question* — and the one genuine near-miss avoided (the `cap.wallClockMs`
"containment hole", which is enforced downstream at `bite0-launcher.mjs:36`) was avoided by forty seconds of
reading *before* filing, not after.

So: **when a claim is checkable, check it before you write it down — not before you're challenged on it.** A
backlog item and a plan are read later, by someone who will act on them. That is the definition of load-bearing.
