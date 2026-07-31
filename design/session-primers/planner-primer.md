---
role: planner
key: 20260731-2118-e4a7c9
written: 2026-07-31 (late) by Claude — session close after the ladder actually ran. BL-104 was
  commissioned over HMP, delivered by a launched worker, graded PASS, merged and closed in one
  session; the PO then pushed and marked BL-115 eligible. So the queue is STOCKED and a rung is
  waiting — this hands to the planner because BL-115's brief is the hard part, not its selection.
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

## Where we are

**No sha is written here, deliberately** — run `git log --oneline -5` and `git status -sb` in **both** repos and
take what you find. (Naming shas in this file has invalidated it within the hour, three times.)

At close: AgentTalk `npm test` **665/665 across 82 files**, `tsc -b` clean · backlog **116 items, 0 warnings** ·
ports 3500/3600 free · **no worktrees but the primary, no branches but `master`** · claude weekly **27%** ·
**both repos PUSHED and in sync** (the PO authorized the push at close).

## ⚠️ The one thing to do first

**[[BL-115]] is `autonomy: eligible` and the ladder is stocked — you have a rung waiting.** BL-104 ran the full
cycle in one session (eligible → commissioned over HMP → delivered by a launched worker → PASS on R1–R5 →
merged `602db8f` → closed), and the PO marked BL-115 eligible immediately behind it. **So do not open by asking
what to do — open by verifying BL-115 is still real, then plan its run.**

**Verify before you hand it out.** The session before last picked BL-108, and checking showed it had already
been fixed inline; an eligible no-op produces a green run that proves nothing, which is worse than not running.
For BL-115 the check is thirty seconds: `grep -n "execFileSync('npx'" scripts/wt-setup.mjs` should still show
the two calls with `stdio: 'inherit'` and no surrounding try/catch.

**Two things to get right in its brief, and they are the whole difficulty:**

1. **BL-104's mechanism does NOT transfer.** BL-104 pipes stderr so it can capture and reformat it. These two
   calls must keep `stdio: 'inherit'` — a build's and a test run's live output *is* the point, and buffering
   `vitest` until it exits is a worse regression than the stack trace. So the fix converts only the non-zero
   **exit**, with no captured stderr to quote. **The obvious move is to copy the pattern from next door and it
   is wrong.**
2. **Exercising it requires running `create`, which provisions a real worktree — and `primaryCheckout()`
   resolves the MAIN checkout even from inside a sandbox.** So a careless run registers worktrees against the
   primary repo, outside its own sandbox, and reads as pollution. **Pin the throwaway-repo pattern** BL-104's
   own new end-to-end tests established (real script as a child process, temp git repo, cleaned up) and make
   the failure real (a deliberately broken `tsconfig`) rather than stubbing `npx`. This is why BL-115 is a
   genuinely harder rung than BL-104, and it is the reason to write the brief carefully rather than to hesitate.

## How a run actually goes — the parts that are not obvious

- **`design/hmp-session-submission.md` is the design; `scripts/hmp-commission.mjs` is the law.** Read the second
  one. The verifier is the only lawful entry point and every check fails closed.
- **Authorization is the PO's commit, not a message.** `design/operator/<run>.authorized`, whose **entire**
  content must equal `[PO] AUTHORIZED-RUN: <run>`, reachable from `master`. **Do not write it yourself** — an
  agent that mints its own authorization has forged exactly what the check protects, and the check stays green.
- **The recursion fence scans the BRIEF's committed text.** It will refuse `launcher.mjs`, `hmp-commission.mjs`,
  the discriminator, `/hmp/send`, and phrasings like "launch the run". Check your brief against
  `findsLaunchInstruction` **before** committing it. It refused mine on the first try.
- **Order that works:** write brief/bar/config → PO commits `.authorized` → provision the sandbox
  (`wt-setup.mjs create op-<run> --base master --root /tmp` on **macOS**) → snapshot → send → grade.
  `workdir-missing` before provisioning is expected, not a fault.
- **Send a refusal probe first.** A commission sent before authorization exists can only refuse, and it proves
  the whole channel for free. `design/operator/hmp2-channel-probe.md`.
- **Keep relay messages short.** 250 chars arrived intact; the primer before this recorded 342 arriving as 154.

## Op notes

- **[[BL-116]], filed at close, is about you.** Two consecutive runs produced exactly one `critical` each and
  **both were the grader's `--expect` file, not the run**. `matchesWritePath` anchors end-to-end, so
  `design/operator/` matches nothing and you need `design/operator/**`. Nothing warns you. **Get this right or
  you will burn a cycle diagnosing an innocent run.**
- **[[BL-114]]: `cap.meter` is configured, never verified.** The reader coerces a missing figure to `0`, so the
  delta goes negative and the rail cannot fire while looking healthy. **`cap.wallClockMs` is the only rail you
  may honestly claim.** Do not write "containment held, cap.meter configured" as if it meant enforced.
- **[[BL-107]] is open and load-bearing.** HMP is `0.0.0.0` + `allow_all_peers`, confirmed live. Runs are safe
  because the PO's *commit* authorizes them, not because the channel is secure. Nothing shipped has changed this.
- **Ground truth for relay traffic is `~/.hermes/state.db`** (`messages` table, `timestamp` is unixepoch), not
  the phone and not the HTTP response — there is no status endpoint; `POST /hmp/send` returns `working` and the
  reply lands in the db.
- **Grade at both coordinates.** For `claude` persistent the work lands in `<workdir>`; the nested
  `agentalk-task-*` worktree is the orchestrator's and is normally empty. An artifact check at the wrong
  coordinates is worse than none ([[BL-053]]/[[BL-059]]).
- **`completed` is not a verdict.** It means the message was answered. Grade the artifact.

## The through-line, if you read only one paragraph

**This session's best output was a worker telling me my premise was wrong.** BL-104's own "Fix:" direction could
not have worked — a catch alone would have printed nothing, because stderr was inherited and the thrown error
carried `stderr: null`. The worker found that, refuted the instruction with evidence, mutation-checked its own
tests unprompted, and reported a same-class defect *without* fixing it because the brief forbade the verb needed
to exercise it. **A well-fenced brief did not constrain a good agent — it gave it something solid to push
against.** Write the next brief that way: name the property, name what is out of bounds and why, and leave the
mechanism to the worker.
