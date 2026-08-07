---
role: planner
key: 20260806-1600-4d9a2e
written: 2026-08-06 by Claude — session close. A backlog gate, then six items closed: BL-096 re-scoped,
  BL-114/117/118 (the meter cap), BL-109, BL-100, BL-103; BL-098 + BL-112 then PARKED by the PO. FIVE todos
  remain and EVERY ONE needs the PO.
  Three times this session an item's description of the code did not survive contact with the code.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, `autonomy: eligible`, charter wording. Bindings live ONLY in
`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared
UNAVAILABLE, so you are almost certainly the sole agent under the **resource-scarcity fallback**: wear every
hat, handshake once per role, declare all of them, keep each gate's discipline separately. **Standing
Conditional Reassignment ACTIVE** (you may implement). Hermes holds the **OPERATOR seat** — launches and
monitors, no authority, and its reports are *observations*, unverified until you check the artifact.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. **Closed
items carry a closing block + telemetry inside the backlog item — read those first.** Resume from the backlog,
**NOT from chat**.

## Where we are — the queue is empty AND every open item is PO-gated

**Verified at the moment of writing, not remembered:** both repos **pushed and in sync** · clean · **no
worktrees but the two primaries, `master` only in both** · AgentTalk `tsc -b` clean, suite **703/703 (83
files)** · client lint clean, contract v8, suite **139/139 (24 files)** · **agent-selectable set: EMPTY**.

Ask the instruments rather than trusting that paragraph — it will rot:

```
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
```

**Five todos remain and NOT ONE of them is startable by you alone.** That is the state, not a gap:

| Item | Why it is not yours | Recommendation put to the PO 2026-08-06 (undecided at close) |
|---|---|---|
| BL-084 | T2 is a real behaviour change on `registry.ts` + `team-coordinator.ts`; its own plan says land T1, then **re-gate**. PO go-ahead. | **Do it** — the only item that unblocks others (BL-028 **and** BL-078). Rider: keep BL-028 `todo`, it is scheduled work behind a live blocker, not abandoned. |
| BL-028 | `blocked_by: [BL-084]`. Genuinely blocked, not parked. | — follows BL-084 |
| BL-096 | Third question only (*whether cleanup behaves*). BL-103 fixed **task-worktree** teardown; the rest is the operator's own `att-op-*` sweep, a human procedure, not code. | **Close it.** If the operator sweep should be automated, that is a new item with a clear shape, not a leftover clause. |
| BL-110 | `po-decision`. | **Close it.** Its "still open" list is stale — the `[PO-RELAY]` decision *was* taken and encoded in `AGENT.md` 2026-07-31. What remains is write-class HMP verbs (a governance act) + parked BL-107; file that separately rather than leaving it in a closed item's tail. |
| BL-119 | `po-decision` — the charter allowlist gap. | **Option (a)**, extend the allowlist to name `design/operator-seat/**`. Cheapest, makes the doc true. Option (d) — mechanise the fence in the harness — is the real fix and a BL-087-sized follow-up. |

**✅ Two of the seven were DECIDED on 2026-08-07: the PO parked BL-098 (Linux `launchctl` — dormant on macOS,
reopen on a Linux box) and BL-112 (relay excision — unchaseable, inside the PO's own Hermes install; reopen if
a needed datum starts depending on surviving the courier). Read their park blocks before touching either:
each records what the park does NOT license, and for BL-112 that rule is operative — never build a bar row, a
grading step or a decision on a value that exists only in a relayed acknowledgement.**

**Two more things were put to the PO and are also undecided:** a charter line pointing at BL-109's new
dispositions mechanism (governance wording, PO's — offer to draft stands), and **relaying the drafted Hermes
task** to correct the stale cap passages in `design/operator-seat/SKILL.md` (its runbook half is already done).

**Do not read an empty queue as permission to pick something, and never mark anything `eligible`.** Ask.
**And do not treat the recommendations above as decisions** — they are one agent's opinion, recorded so the PO
does not have to re-elicit them, and every one of them is still the PO's to take or reject.

## What closed, and the one thing worth carrying forward

Six items: **BL-096** (re-scoped, then its harness half delivered), **BL-114 / BL-117 / BL-118** (the meter-cap
cluster), **BL-109**, **BL-100**, **BL-103**. Details are in their closing blocks; don't re-derive them here.

**The pattern that repeated three times, and it is the thing to internalise:**

1. **BL-096** recommended building a stalling-worker harness. It already existed and was green — shipped
   **eleven days before the item was filed**. Caught only because scope was declared *before* building.
2. **BL-114**'s prescribed fix ("reject instead of coercing") was **incomplete**, and applying it alone would
   have been **worse than the bug**: the coercion lived in two places, and fixing one turns a rail that never
   fires into one that kills instantly on the first real reading.
3. **BL-109**'s fix sketch **contradicted itself** — it named a path inside the very write-fence it said to stay
   out of.

**A backlog item's "fix direction" is a hypothesis, not a spec. Re-derive it from the code at implementation
time, even when — especially when — the item hands you one.** All three cost minutes instead of a wasted
delivery, and in each case the reason was the same: the check ran *before* the build, not after.

## Op notes

- **`cap.meter` no longer terminates anything** (PO chose BL-117 option (b)). `cap.wallClockMs` is the **only**
  terminating rail, and since BL-118 it cascades to the provider CLI. `AGENT.md`'s charter and the runbook are
  both amended; `design/operator/*-brief.md` and `*-bar-*.md` still say the old thing **and must stay that way**
  — they are records of what was believed, and rewriting a pre-registered bar falsifies the audit trail. The
  test is *"is this document acted on, or is it a record?"*, not *"is it stale?"*
- **The budget risk is real, named, and now explicitly UNMITIGATED.** The demotion removed a bad instrument; it
  did not solve the problem the instrument was pointed at. Do not let any doc imply otherwise.
- **`design/operator-dispositions.json` is new** (BL-109): a PO disposition of a `critical` now has somewhere a
  check can read. Read from **HEAD**, never the working tree — an uncommitted edit clears nothing.
- **Stage explicitly in a worktree. Never `git add -A`** — `wt-setup` symlinks `node_modules` and it slips past
  `.gitignore`. The tool prints this reminder; heed it.
- **`$?` after a pipe is the LAST command's status.** An `EXIT: 0` from `node … | tail` told me a gating run had
  passed when it had exited 1. Re-run unpiped before believing an exit code.
- **Use `git -C <path>` for multi-repo work.** A persisted `cd` once pushed the wrong repo and reported
  "Everything up-to-date".
- **Hermes has a drafted task waiting on the PO's relay** — correct the stale cap passages in
  `design/operator-seat/SKILL.md` (its own write path). Its runbook half is already done.
- **Budget at close:** claude weekly **9%**, session 32%. Six items, a gate, a charter amendment and a runbook
  fix cost roughly **6% weekly** across the session.

## The through-line, if you read only one paragraph

**Ground every claim about the code in the code, including the claims written by people who had read it.** The
backlog is this project's memory and it was wrong three times today in three different ways — stale, incomplete,
self-contradictory. None of those were careless entries; two were written by someone looking straight at the
source. What caught all three was the same cheap habit: state the scope, check it against reality, *then*
build. The instruments are worth more than the notes about them.
