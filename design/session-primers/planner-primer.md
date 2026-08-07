---
role: planner
key: 20260807-0930-8f1c73
written: 2026-08-07 by Claude — session close. A backlog gate, then TEN items closed and two parked. The
  engine changed: an in-process agent that errors now interrupts its team (BL-084 T2 / BL-078). ONE todo
  remains — BL-028 — unblocked, actionable, and needing a plan before anyone touches it.
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
items carry a closing block + telemetry — read those first.** Resume from the backlog, **NOT from chat**.

## Where we are

**Verified at the moment of writing:** both repos **pushed and in sync** · **no worktrees but the two primaries,
`master` only in both** · AgentTalk `tsc -b` **0**, suite **711/711 (84 files)** · client lint clean, contract
**v8**, suite **139/139 (24 files)** · **agent-selectable set: EMPTY**.

Ask the instruments rather than trusting that paragraph:

```
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
```

**Backlog: ONE todo, 26 deferred, 91 done.**

**⚠️ ONE UNCOMMITTED CHANGE IS WAITING, and it is not yours to commit.** `design/operator-seat/SKILL.md` carries
a one-line edit **written by Hermes** through the write path [[BL-119]] legitimised on 2026-08-07 — a pointer
correction (`symlinked-skills` → `skill-repo-hosting`). It behaved exactly as the charter designs: written only
inside its allowlist, **not committed**, left as a diff for the PO to gate. **Leave it for the PO.** A dirty
tree at handover is deliberate here, not an oversight.

## The one open item — BL-028, and do NOT just implement it

**BL-028 is unblocked and actionable** (BL-084 closed 2026-08-07, PO option (a); `isResolved` released it with
no edit to BL-028 itself). It is `human-only`, so it is **not** agent-selectable — that is its *autonomy*, not a
blocker. Don't confuse the two.

**It is the T3 the BL-084 arc always pointed at, and it is a BIGGER behaviour change than T2 was.** It makes the
idle sweep **live** — code that has never executed. `lastProgressAt` is declared and read but **never written**,
so `hasAgentTimedOut()` always returns false.

**The trap is already written into the taxonomy:** an agent paused `awaiting-input` (blocked on a human) is
**observationally identical to a dead one**. Land the sweep alone and M03 kills a team for behaving correctly.
`contracts/src/types.ts` says of the `idle-timeout` row, in terms: **"Do NOT flip it here"** — it is fault-class
*only* to preserve today's behaviour, and BL-028 is the item that revisits it.

**What it needs that does not exist yet:** the **sender-side non-reply reason** (LB-67 Finding 1 —
`turn-ended · exited · quiet · user-stopped · errored · receiver-cancelled · awaiting-input`). That vocabulary
answers *"why did a peer not reply?"*, a **different question** from the fault taxonomy T1 built (*"is this the
agent's fault?"*) — `design/bl084-plan.md` §0 records why conflating them was rejected once already.
**Plan it, take Gate 1, then implement.** `design/bl084-t2-plan.md` is the shape to copy.

## What changed in the engine — read before touching failure paths

**An in-process agent that errors now interrupts its team.** For a fault, and only for a fault. Before
2026-08-07 that path propagated **nothing**, for any cause.

- Single decision point: `isFaultClass`, consulted in `setAgentStatus` (`registry.ts`).
- Drivers report errors via **`Registry.reportAgentError(agent, reason)`** — new in T2. `notifyAgentStatus` is
  unchanged and stays side-effect-free for `starting`/`ready`/`busy`.
- **Two "unknowns" point OPPOSITE ways, on purpose, both pinned by tests:** `isFaultClass(undefined)` is
  **true** (guards call sites not yet migrated); `'driver-error-unclassified'` is **false** (a migrated site
  that cannot know its cause). Both say: **a surprise never changes what happens.**
- Exactly one condition changed behaviour: `conversation-start-failed`.

## The pattern this session kept hitting

**Four times the backlog was wrong about the code**, in four different ways:

1. **BL-096** recommended building a harness that already existed, green, shipped **eleven days before the item
   was filed**.
2. **BL-114**'s prescribed fix was **incomplete in a way that would have been worse than the bug** — the
   coercion lived in two places, and fixing one turns a rail that never fires into one that kills instantly.
3. **BL-109**'s fix sketch **contradicted itself** — it named a path inside the write-fence it said to avoid.
4. **BL-110** listed as open a decision taken and encoded **the same day** those lines were written.

**A backlog item's "fix direction" is a hypothesis, not a spec. Re-derive it from the code at implementation
time — especially when the item hands you one.** None cost more than minutes, always for the same reason: the
check ran **before** the build.

## Op notes

- **`cap.meter` no longer terminates anything** (BL-117 option (b)). `cap.wallClockMs` is the **only**
  terminating rail; since BL-118 it cascades to the provider CLI. Charter + runbook amended.
  `design/operator/*-brief.md` and `*-bar-*.md` still say the old thing **and must stay that way** — records,
  not operative docs. The test is *"is this acted on, or is it a record?"*, never *"is it stale?"*
- **The budget risk is real, named, and explicitly UNMITIGATED.** The demotion removed a bad instrument; it did
  not solve the problem. Let no doc imply otherwise.
- **`design/operator-dispositions.json`** (BL-109): a PO disposition of a `critical` is read from **HEAD**,
  never the working tree — an uncommitted edit clears nothing.
- **Stage explicitly in a worktree. Never `git add -A`** — `wt-setup` symlinks `node_modules` past `.gitignore`.
- **`$?` after a pipe is the LAST command's status.** An `EXIT: 0` from `node … | tail` hid a real exit 1.
- **Never put backticks inside a double-quoted `git commit -m`** — the shell runs them. Use `-F -` + heredoc.
- **`grep` returned silently empty on two large files** (`infra-invariant.mjs`, `registry.ts`) while `sed`/node
  read them fine. If a search comes back empty on a file you expect to match, **verify with a second tool.**
- **Use `git -C <path>` for multi-repo work.** A persisted `cd` once pushed the wrong repo and said
  "Everything up-to-date".
- **Still waiting on the PO:** a charter line pointing at BL-109's dispositions mechanism (offer to draft
  stands); **relaying the drafted Hermes task** (its `SKILL.md` still teaches `cap-resource` as a live rail,
  which is false — the runbook half is done); and Hermes's uncommitted one-liner above.
- **Budget at close:** claude weekly **14%**, session 6%. The whole session — a gate, ten closures, an engine
  change, two charter amendments — cost roughly **11% weekly**.

## The through-line

**Build the instrument so it can fail, then believe it when it does.** The `bl093` guard went red four times
this session; every one was a real finding, none was loosened to make the session look tidy — and the last
became a *stronger* assertion than the one it replaced. Pre-registered bars caught two mutations that would
otherwise have shipped silently. And the backlog, this project's memory, was wrong four times in four different
ways, each caught by the same cheap habit: **check before building, never after.**
