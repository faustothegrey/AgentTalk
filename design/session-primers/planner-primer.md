---
role: planner
key: 20260811-1612-b4e7c1
written: 2026-08-11 by Claude — session close (rewritten after the close, when BL-123 was decided
  and landed in the same session; the earlier version described a deliberately-dirty tree that no
  longer exists). No feature task was closed. The session went to the OPERATOR seat's own skill,
  which carried seven defects, and to the charter contradiction that surfaced while fixing them.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, `autonomy: eligible`, merges, pushes. Bindings live ONLY in
`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared
UNAVAILABLE, so you are almost certainly the sole agent under the **resource-scarcity fallback**: wear every hat,
handshake once per role, declare all of them, keep each gate's discipline separately. **Standing Conditional
Reassignment ACTIVE.** Hermes holds the **OPERATOR seat** — it launches and monitors, holds no authority, and its
reports are *observations*, unverified until you check the artifact yourself. **This session is the case study in
why that last clause is not boilerplate.**

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Resume
from the backlog, **NOT from chat**.

## Where we are — verified at close

`master` == `origin/master` at **`99dea5f`** (pushed), **working tree CLEAN**, one worktree, zero local `task-*`
branches. Backlog: **123 items, 0 warnings** — **1 todo (BL-028)** · 94 done · 25 deferred · 3 dropped.
**Agent-selectable set: EMPTY (0 of 123).** Ask the instrument rather than trusting that paragraph:

```
node scripts/validate-backlog.mjs
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
git status --porcelain
```

**Not verified at close:** full `tsc -b` and the whole suite. The last recorded green was **743/743 (89 files)**
at `0c6f3b3`; everything since is docs and governance, so it *should* hold — but nobody ran it. If you need that
number, earn it.

## What happened: the operator's own skill was the defective artifact

The PO wanted a bare *"list the AgentTalk backlog"* to work through Hermes. It didn't — Hermes answered "the
backlog is huge." The diagnosis had three layers and only the first is the one you'd guess:

1. The skill's `description:` frontmatter — what the loader matches on — covered **launch execution only**. The
   skill never fired.
2. It contained **no backlog-listing procedure at all**; its only backlog recipe was a single-item staleness
   check.
3. That check pointed at **port 3600** — a *run's sandbox* port, dead by construction at pre-flight. Falling
   back meant reading a **7,471-line** file. "Huge" was the correct observation.

Seven defects fixed across three hand-back rounds; `SKILL.md` **v1.3.0 → v1.4.1**, landed in `99dea5f`. **The
live orchestrator is port 3741** (launchd, `com.fausto.agenttalk-orchestrator.plist`) — not 3100 (the code
default, `index.ts:36`) and not 3500 (which `AGENT.md:320` and `SKILL.md:369` still cite — stale in both,
**unfiled**).

**What the exercise measured, which matters more than the fix.** Hermes executed every instruction accurately
and **caught a genuine defect in my instructions** (my final check asked for four `BL-092` grep hits after I had
instructed a change that removes one; it reasoned it out and refused to satisfy the check literally). It found
**none** of the seven defects in its own skill unprompted, including the two it introduced while fixing others.
**Good executor, good checker of instructions handed to it, not yet an auditor of its own artifacts** — scope
what you hand it accordingly.

## [[BL-123]] — filed and decided the same day

`AGENT.md` contradicted itself nine lines apart on whether the OPERATOR seat may **commit**. Closed by **PO
decision, option (a): it MAY, inside its write allowlist** (`design/backlog.md`, `design/operator/**`,
`design/operator-seat/**`). **PUSH REMAINS THE PO'S, absolutely** — the decision moved the commit boundary only.

**The reasoning is a fact, not a principle, and it is worth carrying:** the commit gate **does not bind**. Hermes
loads its skill over a symlink **from the working tree**, so an edit is live the moment it lands. `:288` had
already conceded exactly that, one line under the sentence claiming the opposite. And it was demonstrated —
the seat authored `references/backlog-semantics.md`, left it **untracked**, never mentioned it across **six**
reports (each ending in a `git status --porcelain`, which prints untracked files as `??`), and it ran for hours.
Accurate by luck, not process. **So committing is the safer arrangement: it grants no new power and adds
visibility, attribution, a diff and a revert.** Full reasoning in the item's closing block.

**Still true and stated plainly there:** the allowlist is **behavioural, not enforced** —
`scripts/infra-invariant.mjs` checks neither the path allowlist nor commit authorship. Mechanising it was
deliberately **not** filed; file it when someone needs the enforcement, not because the decision felt
incomplete.

## What is open, in the order I would take it

**1. [[BL-028]] T3c — the only real work item, and it is UNBLOCKED.** BL-084 closed 2026-08-07; the `blocked_by`
edge is retained deliberately as a fixture (`bl093-backlog-selectable.test.ts:367` pins it — do **not** "tidy"
it). Gated on the PO question in `design/bl028-plan.md` §9 q2: **should the sweep ever kill at all?** A detector
that only reports is a legitimate end state. Get the real silence distribution before scoping a threshold, or
you are guessing at the one phase that can kill something.

**2. The selectable queue is EMPTY and refilling it is a PO act.** `bl093-backlog-selectable.test.ts:332` goes
red the moment anything is marked eligible — that red is the ritual, shown to the PO before the line moves.

**3. Small, unfiled** (all cheap, none urgent): the stale `3500` in `AGENT.md:320` and `SKILL.md:369`; and from
the prior session, `wt-setup remove` needs `--root /tmp` when the worktree was created with it, or it prints
*"is not a working tree"* and **silently leaves the worktree standing**.

## Op notes — the ones that cost real time

- **A check that asserts a derived NUMBER is weaker than one asserting a STATE OF THE FILE.** "grep should
  return four hits" was wrong the moment my own fix removed one; "grep should return one hit, line 56, the
  sentence saying the word does not exist" cannot fail that way. Write the second kind.
- **When you find an error, grep the whole file for its family before instructing a fix.** I flagged `wontfix`
  as newly introduced, never checked for pre-existing instances, and left one **four lines above** the hunk I
  then pointed the operator at — one round after lecturing it about reading adjacent lines.
- **A relayed `git status` is not a `git status`.** Six operator reports showed a tree with one modified file;
  my own run at close found an untracked 2.8KB file nobody had mentioned.
- **`?all=true` returns 122 of 122, not "the parked items"** (`server.ts:248`). The default view is the live
  queue (`doing` + `todo`) and is the normal answer to "list the backlog". Backlog semantics now have a
  verified reference: `design/operator-seat/references/backlog-semantics.md`.
- **`validate-backlog` passing does not mean the entry is right.** An unbalanced bracket in my BL-123 closing
  edit silently retitled the item in the API; the validator stayed green. Only `GET /api/backlog/BL-123` showed
  it.
- **Budget:** claude weekly **41% → ~45%** for a diagnosis, six review rounds, a filing, a governance decision
  and three pushes. Roughly 4–5%.

## The through-line

Every defect this session was found by **executing something** — a curl against the live API, a grep for a word,
a `git status` at close, a query for one item's title. None was found by reading the artifact more carefully, and
the one defect the *operator* found was in **my instructions**, not in its own work. The lesson generalises past
this session: the value of an independent actor is not that it does the work, it is that it executes the claim
you were about to believe. **Give it claims that can fail.**
