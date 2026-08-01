---
role: planner
key: 20260802-0025-b73f1a
written: 2026-08-02 by Claude — session close. A rung was commissioned but NOT launched: hmp5's
  brief, bar and config are committed and pushed, and the run is waiting on the one file only the
  PO may write. Governance drift found and corrected along the way.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**, and the `autonomy: eligible` bit.
Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy
remain PO-declared UNAVAILABLE, so you are almost certainly the sole agent under the **resource-scarcity
fallback**: wear every hat, handshake once per role, declare all of them, keep each gate's discipline
separately. **Standing Conditional Reassignment ACTIVE** (you may implement). Hermes holds the **OPERATOR seat**
— it launches and monitors, holds no authority, and its reports are *observations*, unverified until you check
the artifact.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. **Closed
items carry a closing block + telemetry inside the backlog item — read those first.** Resume from the backlog,
**NOT from chat**.

## Where we are — ask the instruments, they answer in one command each

**No queue state and no run state is asserted here.** That claim has gone stale six times, once inside the
paragraph written to prevent it. Two commands answer everything.

The first pins the *exact* agent-selectable set, so its assertion is the answer and a red is a finding rather
than a chore:

```
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
```

The second is **the commissioning verifier in `scripts/`** — the one lawful entry point, deliberately not named
here (see the recursion-fence note below; this file would refuse any brief that copied it). Invoke it with your
commission text file and `--dry-run`. It tells you precisely how far the hmp5 ladder has got, because **each
refusal names the next check**:

- `no-po-authorization` → the PO has not authorized yet. **This is where the run stood at session close.**
- `workdir-missing` → authorized; the sandbox is not provisioned. **That refusal is progress, not a fault.**
- `accepted` → every check passed. **Anything reaching the wire after this LAUNCHES.**

Verified at the moment of writing (2026-08-02 00:25Z), not remembered: `tsc -b` clean · **both repos pushed and
in sync** (`51339ff` / `d43be0f`) · **no worktrees but the two primaries, no branches but `master` in either** ·
ports 3500/3600 free · claude weekly **41%**, session **39%**.

## ⚠️ The one thing to do first

**Find out whether `design/operator/hmp5.authorized` exists, and do not assume either answer.** Its entire
content must be `[PO] AUTHORIZED-RUN: hmp5`, committed and reachable from `master`.

- **If it exists:** re-take `repo-sha` (it must be a sha that *contains* the authorization), dry-run again,
  provision, dry-run again, snapshot, send, grade. The bar is `design/operator/hmp5-bar.md`, sha256
  `da0a58a63e906199fdf7f9d71e38abdc525ab172e6f2037372f2e1a366430444` — **pre-registered and pushed**, so any
  edit refuses with `bar-hash-mismatch`. That is the intended behaviour.
- **If it does not:** the run waits. **Do not write it.** An agent that mints its own authorization has forged
  exactly what the check protects, and the check stays green. Its being undone is the evidence the fence binds
  its author.

## What hmp5 is, and the two things that make it different

**[[BL-105]] — the client repo has no worktree helper**, so a `git worktree add` there yields a checkout where
nothing runs. It is the **fifth rung and the first whose workdir is NOT AgentTalk**: the worker sits in a
worktree of `agentalk-mcp-client`.

**1. It is the first live test of governance inheritance in that repo.** [[BL-086]] shipped `AGENT.md` +
symlinks there on 2026-07-30, and its closure says in its own words: *"Do not read this closure as proof that
workers are governed — it proves the file exists and is complete on its own."* Bar row **R7** is that follow-up,
open and unlooked-at since. It is **recorded, not pass/fail** — what must not happen is the question going
unasked a third time.

**2. Its workdir arrives already fixed, and that is a trap for the grader too.** Provisioning the sandbox means
hand-doing the exact dance the item asks the worker to automate. Running the suite in the workdir passes and
proves nothing. Brief §4 tells the worker to create a *fresh* worktree to observe the failure; **hold yourself
to the same standard when grading.**

**One scope honesty you should not quietly re-open.** The item names two fix directions; the cross-repo one
(teaching AgentTalk's `wt-setup` a `--repo` argument) is **not buildable from a client worktree**. Rather than
disguise that as a design conclusion, brief §5a states the constraint and routes the option to §7 — **a reasoned
refusal with evidence is a graded valid outcome.** If the worker argues that case well, that is a *success*.

## What the five rungs have established — read before writing the next brief

Cumulative, each proving one new thing:

- **`hmp1`** — a commissioned worker can *observe*. Its own grading says what it left open.
- **`hmp2`** ([[BL-104]]) — it can *write*: tracked files, its own branch, in scope. Its best output was refuting
  the item's own suggested fix with evidence.
- **`hmp3`** ([[BL-115]]) — **it can take reasoning over precedent.** The obvious fix would have passed a naive
  bar while regressing live output. First evidence a fenced brief can carry a *negative* instruction.
- **`hmp4`** ([[BL-116]]) — **it can repair the instrument that grades it, and choose a SHAPE nobody specified.**
- **`hmp5`** — commissioned, not yet run. Aims at *governance inheritance outside this repo* and again at
  reasoning-over-precedent (bar row R2 fails a green run whose mechanism is justified only by the sibling's).

**Still unproven, and where later rungs should aim.** **Duration** ([[BL-096]]): longest run is 13m28s against
caps of 30–45m, so nothing has approached that failure class — and BL-096's own text says to test the cap
against a deliberately stalling worker rather than hoping a task is big enough. **Whether a worker speaks up
unprompted:** `hmp3` and `hmp4` were both silent on out-of-scope matters; bar row **R8** watches for a third,
which would be a pattern about *our briefs*, not about workers.

## How a run actually goes — the parts that are not obvious

- **`design/hmp-session-submission.md` is the design; the commissioning verifier in `scripts/` is the law.** Read
  the second. It is the only lawful entry point and every check fails closed.
- **Authorization is the PO's commit, not a message.** See above. Do not write it yourself.
- **There is no rehearsal once `.authorized` lands** — the dry-runs are the rehearsal, and they launch nothing.
- **The recursion fence scans the BRIEF's committed text**, and it is worth running over *anything* you write,
  including the wrap-up. It refuses tooling filenames, the discriminator, the send endpoint, and phrasings that
  read as instructing the receiver to start further sessions. Check while writing; it costs one command.
  *(This paragraph is worded around the patterns rather than quoting them — the matcher cannot tell an example
  from an instruction, so a primer that spelled them out would refuse any brief that copied it.)*
- **Keep the wire message short; put the commission in a FILE.** ~220–250 chars carrying one command that reads
  the commission locally. A 342-char message once arrived as 154.
- **Pass a real `message_id` and confirm the response echoes it back.** An early probe sent `undefined` and the
  POST still looked healthy — replay protection travelled as nothing.
- **Status reads taken too early lie.** The ledger entry lands ~20s after the POST.

## Op notes

- **Grade at both coordinates.** For `claude` persistent the work lands in `<workdir>`; the nested
  `agentalk-task-*` worktree is normally empty. A check at the wrong coordinates is worse than none
  ([[BL-053]] / [[BL-059]]).
- **`completed` is not a verdict.** Grade the artifact by running things yourself, and prove new tests red at
  the baseline by reverting **only** the source.
- **Run the harness from the PRIMARY checkout.** A worktree's copy snapshots the *worktree*; BL-090's
  path-mismatch check catches it only if you read the output rather than the exit code. [[BL-116]] now emits a
  `warn` for an `--expect` declaration that cannot have matched — **this does not retire the habit** of testing
  your declaration against a path it must permit *and* one it must refuse.
- **[[BL-114]]: `cap.meter` is configured, never verified.** A missing figure coerces to `0`, the delta goes
  negative, and the rail cannot fire while looking healthy. **`cap.wallClockMs` is the only rail you may
  honestly claim.**
- **[[BL-107]] is now PARKED, not fixed** (PO, 2026-08-02: internal-only, single-user development). The channel
  is **accepted-open**, which is a different sentence from secure with the same configuration behind it. Three
  reopen conditions are on the item; the first is exposure beyond this machine. **No claim anywhere may read
  "the channel is secure."**
- **Ground truth for relay traffic is `~/.hermes/state.db`** (`messages` table, `timestamp` unixepoch) — not the
  phone, not the HTTP response.

## The through-line, if you read only one paragraph

**Verify the premise before you build a brief on it, and name the PROPERTY rather than the mechanism.** BL-105's
own text quotes a failure message that does not reproduce, and its two "fix directions" are not equally
available — both found by spending ten minutes in a throwaway worktree instead of trusting the item. The traps
in the brief are named because they were *checked*: the client declares no workspaces, so the sibling's
per-entry linking has nothing to bite on, and a plain whole-directory symlink takes its suite to 110/110. **A
brief that specifies the mechanism cannot be outperformed; one that specifies the property can be** — and a
trap you verified is worth more than three you imagined.
