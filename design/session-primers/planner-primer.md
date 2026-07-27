---
role: planner
key: 20260727-1520-a3e8f1
written: 2026-07-27 (late) by Claude — session close: rung 6 passed, BL-084 T1 merged, the operator-seat handoff planned
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
for the literal word. It held across ~a dozen separate acts today.
**Independence caveat — say it in every delivery:** as sole agent you author AND review. What catches things is
**running the code and checking the artifact** — never a re-read of your own diff, never a status field.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify HEAD against
`origin/master`. Never trust a primer's hash — including this one.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Plans live
in `design/*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item — read those
first.** Resume from the backlog and plan docs, **NOT from chat**.

## The PO's goal — everything is measured against this

> **Run AgentTalk's own development inside an AgentTalk session**, the in-session agent inheriting the
> configuration built up so far. A **single agent** that plans, implements and reviews alone is fine for now.
> Replacing the human-in-the-TUI is the point.

Standing PO decisions: provider **claude/opus** · the agent **commits and stops; the PO merges** · the **PO states
a goal, the agent decomposes it** · **inherit the rules, skip the primer ritual** (BL-082).

## ⚠️ The queue is deliberately tiny (PO directive, 2026-07-27)

*"Defer everything not instrumental to reach the goal of AgentTalk within AgentTalk."* 22 items are `deferred`,
**each with a reopen condition**. The record is the `### PO directive — 2026-07-27` block near the top of
`design/backlog.md`. **Do not treat a parked item as available work; do not un-park one without the PO.**

**Live queue — 4 items, and this is the order I'd take them:**

1. **[[BL-087]] — DO THIS FIRST. Planned, needs Gate 1 + PO answers to §9.** Plan: `design/bl087-plan.md`. A
   **read-only** infrastructure invariant harness: snapshot both repos' HEAD/sync, worktrees, branches, untracked
   sets, orchestrator ports and live processes; diff before/after a run; exit non-zero on undeclared deltas. It is
   the **safety rail for handing session-launching to an external agent**, which is the PO's next big move.
   Central idea: **additions can be expected, removals and `HEAD` moves never are** (an operator doing its job
   adds; one burning infrastructure removes). Fence: **it REPORTS and NEVER REPAIRS.** §9's key open question — does
   a `critical` finding *gate* the next operator run? I recommend yes.
2. **[[BL-086]] — a PO decision.** A worker launched in `agentalk-mcp-client` inherits **no governance** (verified:
   no `AGENT.md`/`CLAUDE.md` at its root), yet the launcher and executors live there. **Until decided, treat any
   client-repo task as human-implemented.** Recommendation: a short client-specific `AGENT.md` inheriting the rules
   of engagement by pointer.
3. **[[BL-084]] T2 — the real [[BL-078]] fix, now fully unblocked.** T1 merged; all eleven §4 rows ratified. T2
   routes the driver's error transition through the reason-aware path so fault-class in-process errors propagate
   and the six non-fault ones do not. **This is where BL-077's pinning test is deliberately rewritten.** It is the
   natural **rung-7** task: unlike T1 it carries a real behaviour change to fence.
4. **[[BL-028]]** — T3, blocked behind T2.

## The operator-seat handoff — the PO's strategic thrust

The PO wants **session launching handed to an external agent: Hermes.** Understand the reframe: every rung so far
tested an **implementer**, structurally contained (own worktree, own branch, no merge rights). An **operator**
spawns process trees, binds ports, creates/removes worktrees and branches. **That fence does not transfer** — which
is why BL-087 comes first.

**Hermes, resolved with the PO (2026-07-27):** it **launches and monitors, and does not partake in the session.**
Therefore its 2026-07-02 retirement **stands** (that ban was on routing batons/reports/**authority** through it —
workflow participation, which this is not), it gets **no scrum role** (roles carry authority; this seat must have
none), and **`[Hermes]` stays VOID as an authority tag — correctly, since an operator must never instruct.**
**Owed: a charter in `AGENT.md`** — may launch, monitor, report observations, run the harness; may **never** grade,
verdict, merge, push, decide scope, un-park items, or touch mainline. Its reports are **observations, unverified
until checked against the artifact.**

**The soft ladder the PO asked for** (first runs prove the operator can guide the process, not deliver value):
**O-0** produce a valid config + launch plan + pre-registered bar and **do not launch** (zero risk; safe even
given Hermes's wedge history) → **O-1** launch a goal that cannot write ("report HEAD and the suite count; change
no files") → **O-2** a read-only investigation committed to a branch → **O-3** a real task. Containment rules to
apply: operator never reaches mainline · sandbox prefix `att-op-*` · its own port (3600, not 3500) · **`cap.meter`
mandatory** · no recursion (its goal is never "launch a session") · pre-flight checklist printed before launching.
**Tip:** put the operator's workdir in **AgentTalk** (governed) and invoke the client's launcher by absolute path —
that sidesteps BL-086 for the soft rungs.

## Where we are (2026-07-27 close)

AgentTalk **`48ba176`** + this primer's commit on top; client **`c7a5991`**, untouched all session. **Verify by
fetching.** Green: `tsc -b` 0 · suite **442/442** (74 files) · backlog **87 items, 0 warnings**. One worktree, one
branch, no stray processes, port 3500 free.

**Shipped today, each PO-gated:** [[BL-083]] (relay outside a conversation now bounded — the filed item was too
narrow; **no team task creates a conversation**, so the missing cap was the standing condition of the normal
team/baton path) · [[BL-084]] **T1** (`05f78e3`) — **authored end-to-end by a governed claude/opus worker as RUNG
6**, 574s, relay count 0 · the ratified `unknown-mcp-tool` → **non-fault** flip · [[BL-085]] (backlog titles were
silently wrong for any status tag containing a `[[wiki-link]]` + bold) · the configurable worker turn deadline ·
[[BL-078]] decided **(a)** · [[BL-045]] closed as a phantom at the §3b gate · `design/launch-and-monitor-runbook.md`
written from the launcher source.

**Rung 6 = PASS, and the fence held** — T2 not done despite the worker sitting one condition away, BL-028 not
revived, `team-coordinator.ts` a 0-line diff. Full verdict: `design/rung6-plan.md` §9.

## Hard-won gotchas — these cost real time

- **A bar may assert only observable BEHAVIOUR, never an API's shape.** Mine was wrong for the **third rung
  running** — asserted `isFaultClass` was an instance method (module-level export) and `setAgentStatus.length >= 3`
  (overloads leave runtime arity 2). Precondition guards prove the harness *ran*, not that the spec is *right*.
- **Next to every risk you write, put the mitigation you actually configured.** Budget was rung 6's stated risk #1
  and `cap.meter` — the launcher's rail for exactly it — was left unset; the session window hit 100%.
- **Document from the code, not from having operated it.** Writing the runbook corrected two of my own beliefs.
- **The shell's `grep` in this environment silently returns no matches on files that contain the string.** It cost
  a false alarm that a merged fix had vanished. **Use `git grep` / `git diff` for anything load-bearing.**
- **`git diff master..<branch>` on an old branch reads as thousands of deletions** — pure divergence, not damage.
  Judge a branch by `git show <commit>` against its own parent.
- **Every run leaves a SECOND worktree + branch** (`<workdir>/agentalk-task-<id>` on `task-task-<id>`), nested, so
  the outer removal fails until it goes first. Runbook §10 has the order.
- **For `claude`, work lands in the PARENT workdir**, not the per-task worktree (session-level cwd) → **one session
  = one task.** Check both paths and say what is at each.
- **`completed` ≠ done.** Grade the artifact. The worker's result **text is unreachable through the API** — it
  exists only in the recording + the `<recording>.responses.ndjson` sidecar, which is **derived** from
  `instance.recording` (not an env var). No recording ⇒ no evidence.
- **Don't grep for `refus`** as a refusal signal — it appears in the worker's own prompt template every run.
- **Nothing detects a hung agent** ([[BL-028]] dead) and **in-process errors don't propagate** ([[BL-078]] (a),
  documented in `AGENT.md`'s M03 entry). The caps are the only rail.

## Op notes

- **Worktrees (MANDATORY for code, never the primary checkout):** `node scripts/wt-setup.mjs create <id> --base
  master`. **Stage files EXPLICITLY, never `git add -A`.** Docs/governance may be edited on master.
- **Gates:** `npx tsc -b` (`exactOptionalPropertyTypes` — conditional spread is the idiom) + `npx vitest run`;
  `npm run backlog:check` after ANY backlog edit (update **both** the header `status:` and the prose tag).
  **Capture real exit codes** — `echo $?` after a pipe reports the *pipe's* status.
- **Launching a worker:** `node scripts/launcher.mjs <config.json>` from `agentalk-mcp-client`. Full contract,
  monitoring, grading and failure-mode diagnosis: **`design/launch-and-monitor-runbook.md`** — read it before any
  run rather than reconstructing it.
- **Meter:** `node scripts/usage.mjs` — best-effort, never blocking; `ok:false` for long stretches today. **Never
  read a stale meter as a 0% delta; write `unavailable`.** Session window hit **100%** at close (resets ~16:40);
  weekly a comfortable 19%. **The worker draws on the same claude pool as you** — that is why `cap.meter` matters.
- **Left deliberately untouched:** the PO's modified `com.fausto.agenttalk-orchestrator.plist`.
- **Cleaned up:** `task-BL-039` is gone (its fix had shipped independently as [[BL-046]] via rung 4 — the same
  defect was fixed twice), and `design/bl024-t3b-plan.md` is now committed with a PARKED banner.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
