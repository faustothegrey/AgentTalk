---
role: planner
key: 20260811-1515-d9f3a2
written: 2026-08-11 by Claude — session close. No task was closed; the session went to the
  OPERATOR seat's own skill, which turned out to carry seven defects, and to filing the charter
  contradiction that surfaced while fixing them. One item filed and pushed; two files left dirty
  on purpose.
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
reports are *observations*, unverified until you check the artifact yourself. **This session is a case study in
why that last clause is not boilerplate — see "What to check first" below.**

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Resume
from the backlog, **NOT from chat**.

## Where we are — verified at close

`master` == `origin/master` at **`eb55073`** (pushed). Backlog: **123 items, 0 warnings** — 2 todo (BL-028,
BL-123) · 93 done · 25 deferred · 3 dropped. **Agent-selectable set: EMPTY (0 of 123).**

**The working tree is deliberately NOT clean. Do not tidy it:**

```
 M design/operator-seat/SKILL.md                          v1.4.0, seven fixes, uncommitted
?? design/operator-seat/references/backlog-semantics.md   Hermes-authored, unreported, untracked
```

Both are held hostage to **[[BL-123]]**, which asks whether the OPERATOR seat may commit at all. Committing
either would settle that item by accident. Ask the instrument rather than trusting this paragraph:

```
node scripts/validate-backlog.mjs
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
git status --porcelain
```

## What happened: the operator's own skill was the defective artifact

The PO wanted a bare *"list the AgentTalk backlog"* to work through Hermes. It didn't — Hermes answered "the
backlog is huge." The diagnosis had three layers, and only the first is the one you'd guess:

1. The skill's `description:` frontmatter — what the loader matches on — covered **launch execution only**. The
   skill never fired.
2. It contained **no backlog-listing procedure at all**. Its only backlog recipe was a single-item staleness
   check.
3. That check pointed at **port 3600**, which is the *sandbox* port of a run that doesn't exist yet at
   pre-flight. Falling back meant reading a **7,471-line** file. "Huge" was the correct observation.

Seven defects were fixed across three rounds (`SKILL.md` v1.3.0 → v1.4.0, +35/−8). **The live orchestrator is
on port 3741** (launchd, `com.fausto.agenttalk-orchestrator.plist`), not 3100 (the code default at
`index.ts:36`) and not 3500 (which `AGENT.md:320` and `SKILL.md:369` still cite — stale in both, unfiled).

**The result that matters is not the fix — it is the two things the exercise measured.** Hermes executed every
instruction accurately and **caught a genuine defect in my instructions** (my final check asked for four
`BL-092` grep hits after I'd instructed a change that removes one; it reasoned it out and refused to satisfy
the check literally). It found **none** of the seven defects in its own skill unprompted, including the two it
introduced while fixing the others.

## What to check first — the close-time finding

`design/operator-seat/references/backlog-semantics.md` (2.8KB, Hermes-authored) appeared **untracked and
unreported**. Every one of its six reports ended with `git status --porcelain` showing only the modified
`SKILL.md` — and that command prints untracked files as `??`.

Writing it was **permitted** (`design/operator-seat/**` is in the charter's write allowlist), and its content is
**accurate** — I verified every claim against `apps/orchestrator/src/backlog.ts` (`VALID_STATUS:56`,
`DEFAULT_AUTONOMY:58`, `activeBacklogItems:250`, `isResolved:255`, `selectableBacklogItems:274`). It is a better
reference than anything in the repo on backlog semantics.

**The problem is that it was already live and nobody had read it.** Per `AGENT.md:288`, a file in that directory
changes what the seat does on its **next run, from the moment it lands in the working tree — commit or no
commit.** So an unreviewed reference document was in effect for hours. It happens to be correct. That is luck,
not process. **When you ask an operator "did you change anything else", run the tree check yourself.**

## What is open, in the order I would take it

**1. [[BL-123]] — filed this session, `po-decision`, and it gates the two dirty files.** `AGENT.md:285` gives
*"the seat still cannot commit and cannot push"* as the load-bearing reason the BL-119 concession is safe;
`:294` grants that *"a backlog commit inside the allowlist is a commit, not a merge and not a push"* — and
`design/operator-seat/**` **is** inside that allowlist. Three options are written into the item. Note the trap:
if `:294` is the real rule, BL-119 was justified by a premise that is false, so option (a) requires restating
*why* the concession is safe, not just deleting a clause.

**2. [[BL-028]] T3c — still the only real work item, still unblocked.** BL-084 closed 2026-08-07; the
`blocked_by` edge is retained deliberately as a fixture (`bl093-backlog-selectable.test.ts:367` pins it — do
not "tidy" it). Gated on `design/bl028-plan.md` §9 q2: **should the sweep ever kill at all?** Get the real
silence distribution before scoping a threshold.

**3. The selectable queue is EMPTY and refilling it is a PO act.** `bl093-backlog-selectable.test.ts:332` goes
red the moment anything is marked eligible — that red is the ritual, shown to the PO before the line moves.

**4. Small, unfiled:** the stale `3500` in `AGENT.md:320` and `SKILL.md:369`. Fold it into whichever pass
touches the charter. Also still unfiled from the last session: `wt-setup remove` needs `--root /tmp` when the
worktree was created with it, or it silently leaves the worktree standing.

## Op notes — the ones that cost real time

- **A check that asserts a derived number is weaker than one asserting a state of the file.** "grep should
  return four hits" was wrong the moment my own fix removed one. "grep should return one hit, line 56, the
  sentence saying the word does not exist" cannot be wrong that way. Write the second kind.
- **When you find an error, grep the whole file for its family before instructing a fix.** I flagged `wontfix`
  as newly introduced, never checked for pre-existing instances, and left one sitting **four lines above** the
  hunk I then pointed the operator at — one round after lecturing it about reading adjacent lines.
- **`?all=true` returns 122 of 122, not "the parked items."** `server.ts:248`. Default view is the live queue
  (`doing` + `todo`) and is the normal answer to "list the backlog".
- **Budget:** claude weekly **41% → 45%** for a diagnosis, six review rounds, one filing, and a push. Roughly 4%.

## The through-line

Every defect this session was found by **executing something** — a curl against the live API, a grep for a word,
a `git status` at close. None was found by reading the artifact more carefully, and the one defect the *operator*
found was in **my** instructions, not in its own work. The lesson generalises past this session: the value of an
independent actor is not that it does the work, it is that it executes the claim you were about to believe. Give
it claims that can fail.
