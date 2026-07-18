# Rung 4 — goose lands a real AgentTalk fix through the substrate — PLAN

**Author:** Claude (planner hat, resource fallback) · **Date:** 2026-07-19 · **Status:** 🚧 DRAFT — pre Gate 1 / PO go
**Thread:** the autonomous-development ladder — the "rung" runs (rung 1 → 1.5 → 2 → 3, all 2026-07-17). This is the
graduation rung the PO remembered as *"a little test of AgentTalk enhancing AgentTalk."*
**Depends on:** Bite 0 launcher (`agentalk-mcp-client:scripts/launcher.mjs`, BL-040, done) · goose as a first-class
vendor with a required model (BL-024 T3b, merged + live-proven 2026-07-18).

---

## 0. Honest framing — there is no pre-written "rung 4" spec

The rungs live in the repo as **run configs + evidence backlog items**, not as a single ladder doc, and rungs went
1 → 1.5 → 2 → 3. **There is no committed rung-4 definition.** So this plan *proposes* one, for the plan gate + PO to
approve. It is written to be the **honest smallest increment above rung 3**, not an invented leap.

**What the prior rungs were, and what each still lacked (so rung 4 is a real step, not a repeat):**
| Rung | Worker | Result | What kept it below the summit |
|------|--------|--------|-------------------------------|
| 1 (calibration) | agy | found the BL-062 prompt defect | not a real fix; a shakedown |
| 1.5 | agy | a real fix **merged** (`a971b25`) | worker was **agy** (now unavailable); task hand-fed |
| 2 | agy | **BLOCKED** — no report channel (→ BL-058) | did not land a fix |
| 3 | agy | found a real fail-open + a **skeleton** patch | candidate only, not a clean mergeable fix |
| **4 (this)** | **goose** | **a complete, mutation-checked fix, verified by running it, PO-merged** | — |

**The three things rung 4 proves that no prior rung did, together:**
1. **The worker is goose, not agy.** agy is UNAVAILABLE (PO, 2026-07-15); goose became a real, live-proven vendor on
   2026-07-18 (BL-024 T3b). Rung 4 is the payoff test for that work — it shows the "detour" *unblocked the ladder*.
2. **A clean, mergeable result** — rung 2 blocked, rung 3 produced only a skeleton. Rung 4 lands a real fix.
3. **Graded by running the artifact**, end-to-end through the launcher, with the **relay count recorded** (the program
   metric). The summit's real content — a measured, substrate-carried, autonomous improvement to AgentTalk itself.

## 1. Goal / "done" in one line

A **goose** worker, launched by the **deterministic Bite-0 launcher** over the MCP substrate, autonomously produces a
**complete, correct, mutation-checked** fix to a **real, bounded AgentTalk backlog item**, in a **sandbox worktree**;
Claude verifies it **by running the patch** (not by the team status field); the PO merges it; the run's **relay count +
substrate-carried ratio** are recorded. **An honest failure is still a valid rung** (spike gold, like rungs 2/3) — the
run measures the loop, and a clean red beats a forced green.

## 2. The task the worker is given (proposed: BL-046; PO picks at the gate)

Rung 4 measures the **autonomy loop**, so the task must be one whose *correct fix is well-understood* — the run tests
"can goose do it end-to-end through the substrate?", not "is the task solvable?". (This is exactly how rungs 1/1.5 used
a known one-line fix.)

**Primary candidate — BL-046** (`todo`): *`POST /api/agents` must accept `providerName`* — additive, single-purpose,
isolated, mutation-checkable, real value, and a **worker-only** implementation task (goose's proven strength; goose
cannot do the strict consensus protocol — TL-009 — but *can* implement — TL-008).
- **Confirmed target (2026-07-19):** `server.ts:604` reads `{ id, provider }` and **drops** `providerName`; `:700`
  calls `activateAgent(id, provider, model, mode)` — `providerName` never forwarded → `registry.ts:250` defaults it to
  `'google'`. **Fix:** accept + forward `providerName` through create → `activate` → `createAgent`.
- **Why it is safe for an autonomous worker:** it is *additive* (accept a new optional field and thread it through), it
  does **not** touch the shared coordination engine (`team-coordinator.ts` / consensus / the protocol), and it is
  behaviourally discriminable by a test.

**Alternate — BL-047** (`todo`): api-agent driver stopped at `conversation_end`. Slightly riskier (lifecycle
behaviour), kept as fallback.

**Fence for the worker (the ⛔ Implementer Rules apply to goose):** MAY touch only `server.ts` create/start path +
`registry.ts` activate/create path + a new unit test. **MAY NOT** touch `team-coordinator.ts` timeout/consensus logic,
`wire-contract.json`, or any shared-engine behaviour. **If the task turns out to need a shared-engine behaviour change,
the worker STOPS and reports** — and that stop is itself a valid, recorded rung outcome (Rule 2 show-stopper).

## 3. The vehicle & the run

- **Launcher:** `agentalk-mcp-client:scripts/launcher.mjs` + a new `runs/rung4.config.json` (mirrors `rung3.config.json`).
- **Team shape:** a **worker-only team**, exactly one agent: `{ transport:'attached', vendor:'goose', model:<explicit> }`
  (BL-024 T3b makes goose first-class; the required model is a config field — proposed default in §7 Q2).
- **Goal delivery:** the launcher creates the worker-only team + assigns the task (the `exec_rpc` turn over the
  substrate) and polls the team status to termination — **no human baton during the run** (that is the point).
- **Sandbox (PO mandate — load-bearing):** the launcher's `workdir` is a **throwaway git clone/worktree of AgentTalk**,
  **never** the primary checkout. Per BL-053, goose's executor provisions its *own* task worktree under
  `/tmp/agentalk-task-<id>` inside that workdir; the fix lands there. Nothing can reach `master` except the PO-gated
  merge in §5. Sandbox + task worktrees + branches are torn down at close (rungs' cleanup discipline).
- **Cap (deterministic, launcher-enforced — the anti-loop rail):** wall-clock (proposed **15 min**) **and** a resource
  ceiling (proposed **session %-delta ≥ 5%**), tripping on the earliest. On breach → terminate worker, mark **FAILED
  (capped)**, report. With one agent and no messaging a runaway loop is structurally impossible; the cap bounds a hang.

## 4. Grading — the honest bar (verify by RUNNING, never by the status field)

The rungs' hardest-won lesson (BL-062, IP-15): a worker-only run can report `completed` while changing nothing. So:
1. **Pre-register the discriminator BEFORE the run** — Claude writes a **mutation-checked acceptance test** and keeps it
   as the *grading instrument* (the worker is **not** shown it): create an `api` agent with
   `providerName:'openrouter'` and assert it is **not** defaulted to `google`. The test must **fail on today's code**
   (proving it discriminates) and **pass only with the fix** (mutation check: revert the fix → the bar goes red alone).
2. **Success = ALL of:** the worker's produced patch makes that hidden bar go **red→green**, `tsc -b` is clean, and the
   **full suite is green** — **each verified by Claude running it** in a real `task-BL-046` worktree, not by reading the
   diff and not by the team's `completed` status.
3. **The worker's own deliverable** must include the fix **plus a test** (BL-046's DoD). Claude's hidden mutation check
   is an independent second bar on top — it is not a substitute for the worker doing its job.

## 5. Landing it (PO-gated, per repo)

The fix is produced in the sandbox worktree. To land it: extract the patch, apply it on a real
`task-BL-046` worktree of AgentTalk (`node scripts/wt-setup.mjs create BL-046 --base origin/master`), run the §4 bars
there, then **STOP for the PO**. **Merges stay PO-gated — the PO says "merge" and "push" as separate words.** REFUTED or
incomplete work stays on the branch (or is filed as spike gold + a follow-up item), never forced green.

## 6. Definition of Done

- **C1 (loop):** the Bite-0 launcher runs a **goose** worker end-to-end over the substrate against BL-046, capped,
  recorded (NDJSON), with the sandbox contained (nothing in the real repos during the run).
- **C2 (result):** the worker's patch, verified **by Claude running it** in a real worktree, makes the hidden mutation
  bar go red→green, `tsc -b` clean, full suite green. *(Or: an honest FAILED/BLOCKED outcome, diagnosed and filed —
  still a valid rung.)*
- **C3 (metric):** the run's **relay count** and **substrate-carried ratio** are recorded in the closure telemetry
  (target: ~0 manual batons during the run — the launcher automates goal delivery + outcome).
- **C4 (merge):** on PO go, the fix merges to `master` (PO-gated) as BL-046; the sandbox + all task worktrees/branches
  are cleaned up; freeze/hygiene checks clean.

## 7. Open questions for the plan gate / PO

1. **Task pick** — BL-046 (recommended: additive, isolated, worker-only, mutation-checkable) vs BL-047 vs another? PO's
   call sets the worker's goal.
2. **goose model** — goose is a harness over an OpenRouter model and BL-024 T3b requires an explicit one. For a real
   code task the live-proof's `gpt-4o-mini` is likely too weak. **Recommend a strong coding model** (e.g.
   `anthropic/claude-...` or `openai/gpt-4o` via OpenRouter) — PO/gate picks; cost is cents-scale under the cap.
3. **Cap values** — wall-clock 15 min + session %-delta 5% ok, or tighter given weekly budget is at ~78%?
4. **Grading** — pre-write the hidden mutation bar as the grading instrument (recommended), *and* require the worker to
   ship its own test? (Recommend both — worker ships a test per BL-046 DoD; Claude's hidden bar is the independent check.)
5. **Landing mechanism** — extract-and-replay the patch onto a real `task-BL-046` worktree (recommended, keeps the
   sandbox throwaway), vs point the launcher `workdir` at a real-repo worktree directly (fewer steps, more blast risk)?

## 8. Roles, resources, honesty caveats

- **Roles under current availability:** Claude is **sole available agent** (agy + Codex unavailable) → planner +
  plan-reviewer + implementation-reviewer + task-end reviewer, each gate exercised **separately**. **goose is the
  worker under test** (not a scrum-role holder — it's the subject of the experiment). Merges stay **PO-gated**.
- **Independence caveat (state it in the delivery):** as sole agent I author this plan, will review it, and will grade
  the run. What actually catches things is **running the produced patch** and a **live substrate round-trip** — never
  re-reading my own diff or trusting a status field.
- **Budget:** weekly ~78% (session ~31%) at plan time — so **one small task, one–two runs max**. A capped goose run is
  cents-scale LLM spend; Claude's setup/verify is the real cost.
- **Failure is an acceptable, valuable outcome.** If goose can't do it, or the loop breaks, that is spike gold (rungs
  2/3 precedent). Honest red > forced green.

---
*Plan gate + PO `go` approve §6 DoD, §7, and the task pick before any code. The run happens in a sandbox worktree; the
merge is PO-gated per repo.*
