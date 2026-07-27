---
role: planner
key: 20260727-1645-d4b7e2
written: 2026-07-27 (evening) by Claude — session close: BL-087 shipped, the operator seat chartered, O-0/O-1/O-2 all cleared
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents***
(PO, 2026-07-15), so you are likely sole agent under the **resource-scarcity fallback**: wear every hat, handshake
once per role, declare all of them, keep each gate's discipline separately. **Standing Conditional Reassignment
ACTIVE** (you may implement). **"merge" and "push" are SEPARATE words and the PO means it** — stop at each and wait
for the literal word. It held across every act of this session too.
**Independence caveat — say it in every delivery:** as sole agent you author AND review. What catches things is
**running the code and checking the artifact** — never a re-read of your own diff. This session proved it three
times over; see "the one lesson" below.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify HEAD against
`origin/master`. Never trust a primer's hash — including this one.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Plans live
in `design/*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item — read those
first.** Resume from the backlog and plan docs, **NOT from chat**.

## Where we are (2026-07-27 close)

AgentTalk **`de0a5f4`** — **2 commits ahead of `origin/master` (`c63e4b7`), NOT pushed.** Client **`c7a5991`**,
untouched all session. **Verify by fetching.** Green: `tsc -b` 0 · suite **471/471** (75 files) · backlog **91
items, 0 warnings**. One worktree, one branch, ports 3500/3600 free, no strays, harness reports byte-identical.

**Shipped today, each PO-gated:** [[BL-087]] the **infrastructure invariant harness**
(`scripts/infra-invariant.mjs` + 29 bars, merged `e34ccee`, pushed) · the **OPERATOR seat charter** in `AGENT.md`
(`7fd7523`, pushed) · **O-0** (plan/config/bar, no launch) · **O-1 CLEARED 7/7** on a re-run · **O-2 CLEARED 8/8**,
whose deliverable `design/bl088-investigation.md` was **authored end-to-end by a governed worker** and merged
(`b8181e9`) · [[BL-088]] **closed on the PO's option (a)** · [[BL-089]] [[BL-090]] [[BL-091]] filed.

## Your queue

1. **[[BL-090]] — take this first.** Two ways the harness goes **quiet instead of loud**: an unreadable repo emits
   `warn` and **returns early**, skipping every check while the PO's gate watches only for `critical`; and
   `diffRepo` compares **by key, never by path**, so snapshots of two different directories silently diff (measured:
   three false `critical`s). This is the inverse of BL-087's stated top risk, on the tool that **gates operator
   runs**. Both fixes touch the severity model ⇒ **behaviour change ⇒ needs the PO.**
2. **[[BL-089]]** — `snapshotRepo` corrupts the first porcelain entry's filename when it is unstaged-only
   (`git()`'s `.trim()` eats line 1's leading space). Small, self-contained, real. Fix at the **parse site**, not in
   `git()` — every other caller relies on that trim.
3. **[[BL-091]]** — the harness cannot see a process that holds no port, because the state vector is built *from
   listening sockets*. The operator seat's defining property is launching **process trees**, so the rail does not
   cover its stated risk. Any fix must yield **positive evidence**, not a command-line pattern match — that guess is
   where [[IP-15]] lives.
4. **[[BL-086]]** — a **PO decision**: a worker launched in `agentalk-mcp-client` inherits no governance. Sidestepped
   for the operator rungs by keeping the workdir in AgentTalk and invoking the launcher by absolute path.
5. **[[BL-084]] T2** — the real [[BL-078]] fix, fully unblocked, the natural **rung-7** task: unlike T1 it carries a
   real behaviour change to fence. Wants a fresh budget window. **[[BL-028]]** is T3, blocked behind it.

**Next rung: O-3 — a real task.** O-0/O-1/O-2 are done. Note what has *not* been tested: **Hermes is still not
wired up.** Every rung so far was the operator procedure executed by Claude standing in. It exercised the config,
the bar and the harness; it did **not** test handing the seat to an external agent. Do not cite the ladder as
evidence that it does.

## The one lesson, if you read nothing else

**Every defect found this session came from *using* an artifact, never from re-reading it — and all three were in
documents written within the previous 24 hours, all of which had been reviewed.**

- Baseline taken *before* the reference-value commit ⇒ the commit moved `HEAD` ⇒ a spurious `critical` that failed
  a bar row. **Take the baseline LAST**, after the final operator commit, immediately before launching.
- The runbook placed the harness check *after* cleanup ⇒ teardown's own removals always read `critical`. **Check
  BEFORE cleanup.**
- A hand-copied mainline `HEAD` reference **cannot live in mainline** — committing the doc that carries it moves
  the HEAD it names. **Grade "mainline never moved" from the baseline snapshot, never from a literal.**

Budget the first execution of any procedure as a **test of the procedure**, not of its subject.

## Op notes

- **Worktrees (MANDATORY for code):** `node scripts/wt-setup.mjs create <id> --base master` → `/private/tmp/att-<id>`.
  **Stage files EXPLICITLY, never `git add -A`.** Docs/governance may be edited on master.
- **Gates:** `npx tsc -b` + `npx vitest run`; `npm run backlog:check` after ANY backlog edit (update **both** the
  header `status:` and the prose tag).
- **Launching:** `node scripts/launcher.mjs <abs-config-path>` from `agentalk-mcp-client`. Contract, monitoring and
  grading: **`design/launch-and-monitor-runbook.md`** — read it, don't reconstruct it. Configs for the ladder are in
  `design/operator/`.
- **⚠️ Do NOT use an in-log `LAUNCHER EXIT` marker as a completion signal.** `> log` gives the launcher's children a
  shared file offset, and the MCP client outlives the launcher and clobbers the appended line. It vanished on two of
  three runs, and a poll loop waiting on it spun for ~10 minutes unnoticed. **Use the task harness's own exit
  status, or write the marker to a separate file** — and if you start a waiter, make sure something can stop it.
- **Don't grep for `refus`** as a refusal signal — it is in the worker's prompt template every run. A monitor filter
  must key on **launcher events**, never on strings the launcher echoes. (I wrote that warning, then tripped it.)
- **`completed` ≠ done.** Grade the artifact, at the coordinates where the process actually stood: for `claude` on
  the persistent path work lands in the **PARENT workdir**, not the nested `agentalk-task-*` worktree. Check both
  and say what is at each. Worker text is unreachable through the API — only the `<recording>.responses.ndjson`
  sidecar has it, and it is **derived** from `instance.recording`. No recording ⇒ no evidence.
- **`cap.meter` is armed but inert while the session figure is pinned at 100%** — baseline and every later read are
  both 100, so the delta never reaches the threshold. **The wall-clock cap is the real rail.** Also: `cap.meter`
  *without* `maxPercentDelta` is silently disarmed while `run-start` still records `meter: true`.
- **Meter:** `node scripts/usage.mjs` — best-effort, never blocking. Session **100% all session** (resets ~16:40);
  weekly a comfortable **19%**. Write `unavailable`, never a stale 0% delta.
- **Left deliberately untouched:** the PO's modified `com.fausto.agenttalk-orchestrator.plist`.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
