---
role: planner
key: 20260731-2118-e4a7c9
written: 2026-07-31 (late) by Claude — session close after the ladder actually ran. BL-104 was
  commissioned over HMP, delivered by a launched worker, graded PASS, merged and closed in one
  session. The queue is EMPTY again, and refilling it is a PO act — which is why this hands to
  the planner rather than to an implementer.
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
ports 3500/3600 free · **no worktrees but the primary, no branches but `master`** · claude weekly **27%**.
**⚠️ 9 commits UNPUSHED on AgentTalk** (client repo is 2 ahead from an earlier session). Push is the PO's.

## ⚠️ The one thing to know first

**The ladder is no longer broken — it is unstocked.** BL-104 was marked eligible, commissioned over HMP,
delivered by a launched worker, graded PASS on R1–R5, merged (`602db8f`) and closed — all in one session. The
pipeline works end to end. **And closing it emptied the agent-selectable queue: nothing can currently be handed
to an agent unattended.**

**Refilling it is a PO act and only a PO act** ([[BL-093]] fails closed; `bl093-backlog-selectable.test.ts` pins
the set exactly). So **do not open by looking for something to launch** — there is nothing, by design. Open by
asking the PO which rung is next, with a recommendation.

**Your strongest recommendation is [[BL-115]]** — `create`'s `npx tsc -b` / `npx vitest run` calls still throw
raw stacks, the same defect BL-104 fixed for `git()`. It became unblocked the moment BL-104 closed. **Read its
trap before proposing it:** BL-104's mechanism does **not** transfer — those calls must keep `stdio: 'inherit'`
because live build/test output is the point, so the fix converts only the non-zero *exit*, with no captured
stderr to quote. It is also a genuinely harder rung than BL-104: testing it requires running `create`, which
provisions a real worktree.

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
