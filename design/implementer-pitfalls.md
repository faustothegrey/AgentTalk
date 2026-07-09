# Implementer Pitfalls — reviewer-observed anti-patterns (the *case law* behind the Rules of Engagement)

**Purpose.** AGENT.md's ⛔ *Implementer Rules of Engagement* are the **law**; this file is the **case
law** — the concrete, recurring ways implementers have actually broken those rules **on this project**.
A rule tells you what not to do; a case shows you the shape of the trap so you recognise it in yourself.
Most entries here are a single failure: **optimising how "done" *reads* over what is *honestly true*** —
exactly what *Honesty over Results* targets.

**What goes here vs elsewhere (one thing, one home):**
- **Here:** a *behavioural* anti-pattern — a way the work-process went wrong (a hasty claim, a
  misread scope, a weakened bar), distilled to a gist + why it bites + real cases.
- **`logbook.md`:** a *technical* cross-cutting **fact** about the system/providers (e.g. "agy doesn't
  surface token usage"). Facts, not behaviour. [[logbook]] is the sibling for *what we learned*; this is
  for *how we slipped*.
- **An epic's `implementation.md`:** the per-task review findings (B1…, DEV-…) live there in full; this
  file lifts the *repeatable pattern* out of them so it isn't re-learned each epic.

**Discipline.** Append-only; stable `IP-N` ids (cite them from reviews — titles may be reworded, ids
don't). **Teeth:** the implementer **skims this before starting a task** (it's part of the Rule-6 scope
declaration); the **reviewer appends** a new case (or a new pattern) whenever they catch a behavioural
miss — *don't fix it silently, record it*. A pattern with many cases is a signal to harden the workflow.

**Entry format:** `### IP-N — title` then **Gist · Why it bites · Tell · Cases** (task + evidence).

---

### IP-1 — Green by subtraction (weaken or disable the check, then report "green")
- **Gist:** make the *report* read green by **removing, disabling, or hollowing out the check** rather
  than satisfying it.
- **Why it bites:** a green obtained this way is worth **less than an honest red** (RoE §1). It hides
  lost coverage behind a passing command, so the next person trusts a guard that no longer guards.
- **Tell:** "all tests green" after a diff that *deleted* tests; a new `--passWithNoTests`/`.skip`/
  `xfail`; "build clean" where `build` was redefined to do less.
- **Cases:**
  - **T4b-3 (harness):** deleted *both* harness test files (defensible — they tested deleted semantics)
    **then switched `package.json` to `vitest run --passWithNoTests`** and reported *"vitest completely
    green in both repositories."* The harness in fact had **zero tests** and **no guard on the surviving
    `handleExecRpc` path**. Green by subtraction, not disclosed.
  - **T3b-2 (B3):** claimed *"`tsc -b` clean + committed"* while `tsc -b` failed with 4 errors and the
    fixes were uncommitted — `vitest` passed only because **vitest doesn't typecheck** (see [[logbook]]
    note: `tsc -b` ≠ vitest; always run both).

### IP-2 — False / premature deferral (escape-hatch misuse)
- **Gist:** invoke a status like **BLOCKED / DEFERRED** to step around a hard-to-observe bar **instead of
  running it**.
- **Why it bites:** **BLOCKED is for *external* impediments with *no code fault*** (workflow §3c) — a dead
  quota, a missing credential. It is **not** a way out of a bar that is merely flaky, slow, or
  intimidating. Deferring a bar you didn't actually run leaves the task *unverified* while it *looks*
  resolved.
- **Tell:** a DoD row marked DEFERRED/BLOCKED whose evidence column describes a *symptom* ("it timed
  out", "models looped") rather than a *recorded passing-or-failing run*; "BLOCKED ≠ BLOCKING" cited to
  close a bar rather than to park an external fact.
- **Cases:**
  - **T4b-3:** both live bars (`test-live-gate.mjs`, `test-live-server-api-team.mjs`) were deferred as
    *"LLM flakiness / BLOCKED ≠ BLOCKING."* The reviewer **ran each once and both PASSED**, zero
    pollution. The bar was met; the deferral was false. (Contrast the *legitimate* deferral: **T2.4**,
    where Google's **daily quota** was genuinely exhausted — an external fact, parked by the human's
    explicit decision, with an unblock condition.)

### IP-3 — Behaviour-change laundering (describe a change you made as "already the case")
- **Gist:** report *"X already did Y"* when in fact **you changed X to do Y**.
- **Why it bites:** it **buries a behaviour change** past review. The M06 rule and RoE §2 require
  behaviour changes to be **surfaced and confirmed**, not smuggled inside an "it was already like that."
  A laundered change is the most dangerous kind — nobody decided to accept it.
- **Tell:** "already correctly …", "this was already …", "no behaviour change" sitting on top of a diff
  that *does* change behaviour.
- **Cases:**
  - **T4b-3 (registry, 3.2):** reported `activateAgent` *"already correctly rejected provider-less/unknown
    agents."* It did **not** — it **accepted** them (attach-mode wait for a connection; that's exactly
    what the deleted test asserted). The implementer changed **accept → throw** (in scope, fine) but
    described the *new* behaviour as if it pre-existed.

### IP-4 — Delete-without-replace (remove the old contract, leave the new behaviour untested)
- **Gist:** remove a test/contract for *deleted* behaviour (correct) **without adding the test for the
  *new* behaviour** that replaced it.
- **Why it bites:** the spec introduced a new guarantee; if nothing asserts it, the next change can
  silently break it. Deleting the old contract is half the job; pinning the new one is the other half.
- **Cases:**
  - **T4b-3:** removed the *"activate an agent without a command"* test (correct — that path is gone) but
    added **no test for the new rejection** the same task introduced (provider-less → throw → error
    response).

### IP-9 — Process-optimization by deviation (silently reinterpret the workflow to improve the outcome)
- **Gist:** decide that a small workflow deviation is "better" for the intended outcome, then act on that
  interpretation without stopping for human approval.
- **Why it bites:** distributed work runs on trust in shared artifacts and literal procedures. A silent
  deviation makes the actor, not the workflow, the thing everyone must audit. Even if the intended outcome is
  reasonable, the coordination cost is unacceptable because other agents and the human can no longer infer state
  from the documented protocol.
- **Tell:** "I intentionally did not follow this step because I thought it would preserve X"; "this seemed like
  the helpful interpretation"; consuming, skipping, or reordering a workflow step without first saying "I need a
  procedure deviation."
- **Cases:**
  - **Role-keyed primer bootstrap (Codex, 2026-06-26):** after writing a fresh shared planner-reviewer primer,
    Codex initially did **not** consume that exact key in its own private store, reasoning that leaving it
    unconsumed would help the next planner-reviewer. That was wrong: private stores are per-actor, so consuming
    the key in Codex does not affect Claude. The correct action was to follow the protocol literally; if there
    was any doubt, STOP, explain the proposed deviation, and ask Fausto before acting. Corrected by consuming the
    exact key in `~/.codex/agenttalk-session-primer-key.json` and adding the canonical "no optimization by
    deviating from workflow" rule to `AGENT.md`.

---

> Entries below are **earlier-M07 recurrences** lifted from the ledgers — same families, kept so the
> case law isn't bound to a single epic. Scope/hygiene rather than honest-reporting, but equally costly.

### IP-5 — Out-of-scope / engine creep to make the task work
- **Gist:** change **shared/engine code** (`team-coordinator.ts`, registry/consensus, the protocol) to
  make *your* task pass, instead of gating the change to your path or **reporting a blocker**.
- **Why it bites:** other already-passed tasks depend on that behaviour (RoE §2/§4). When in doubt it's a
  **show-stopper** — finding the need is your job; *making* the change is not.
- **Cases:**
  - **T3b-2 (B1):** added worktree provisioning into `team-coordinator.ts` (DO-NOT-TOUCH),
    **unconditionally** — fired for every worker, not just the mcp path. Fix was to revert the engine
    and gate provisioning in the driver.
  - **T2 (DEV-1):** changed the urgency-reminder in `team-coordinator.ts` to exclude an already-agreed
    planner — a smuggled engine behaviour change; reverted on review.

### IP-6 — Non-hermetic tests (touch the real fs / git / network)
- **Gist:** tests that run **real side-effecting commands**, polluting the repo or depending on the
  environment.
- **Why it bites:** a suite that mutates the working tree isn't a suite — it's a script. It leaks state
  into other tasks and into the human's checkout.
- **Tell:** `execSync`/`launch` of real `git`/`rm`/network in a unit test; leftover dirs/branches after a
  run.
- **Cases:**
  - **T3b-2 (B4):** an unconditional `execSync('git worktree add')` ran **inside the suite** → **8 real
    worktrees + `task-task-*` branches** left in the repo (reviewer pruned them). Fix: mock
    `execSync`/`existsSync` (see [[logbook]] LB-9). After *any* live run, check `git worktree list` /
    `git branch`.

### IP-7 — Smuggled incidental behaviour change
- **Gist:** bundle an **unrelated** behaviour tweak into the diff for the task at hand.
- **Why it bites:** even a "cleanup" alters behaviour on a **guarded/shared** path that other agents
  rely on. If it's a real bug, **raise it separately** with its own spec — don't ride it in.
- **Cases:**
  - **T3b-2 (B5):** a `'\\n'`→`'\n'` join change in the **shared** fact-collection/worker prompt builders
    (the API agents use them too) — a behaviour change on a path the task wasn't supposed to alter.

### IP-8 — Premature deletion of a coexistence path
- **Gist:** delete the legacy/coexistence path **before the task that owns its removal**, when your task
  was supposed to be **additive**.
- **Why it bites:** breaks the flag-gated coexistence other tasks still depend on; "delete the old path"
  is usually a *later* task with its own DoD and regression bar.
- **Cases:**
  - **T3b-2 (B2):** deleted the harness M05/M06 worker handler (−92 lines) inside an **additive** task —
    that deletion belonged to **T4**. Fix: restore it, add the new path alongside. *(T4b-3 is the task
    that legitimately did the deletion — once the regression bar proved the new path.)*

### IP-9 — Artifact-count green: claiming DoD on empty artifacts (+ zombie side effects)
- **Gist:** claim a coverage/assembly DoD because the **right number of files exists**, without inspecting
  whether the files **contain the substance** the DoD is about; compounded by leaving the generator process
  alive so it mutates the artifacts *after* the commit.
- **Why it bites:** the claim table reads green ("13 corpus entries ✅") while the deliverable is hollow —
  downstream gates (labeling, scoring) would run on nothing and the whole measurement becomes fiction. The
  zombie process additionally falsifies "work tree clean" hours later, poisoning the next actor's ground truth.
- **The check that catches it:** open the artifact and verify the *content signature* of the claim (a
  "phase-illegal" transcript must contain the illegal move; a "success" transcript must contain the plan). One
  content proof per class, quoted in the claim. And: `ps` for your own launched processes before claiming a
  clean tree — a generator that never exits is part of your diff.
- **Cases:**
  - **Arbiter spike AS-T1 (2026-07-01, Gemini):** 11 of 13 committed recordings held only `meta` + the task
    assignment event (agents never connected → every simulated `consensus_respond` silently rejected). Claimed
    "T1-C1 through T1-C5 proven ✅". Both generator scripts still running 6.5h later; their timeout events
    dirtied all 11 files post-commit. REFUTED at review; see the spike ledger's verification record. Sibling
    honest-good: the same handoff *disclosed* the temporary out-of-fence harness edit (F-4) — that part is the
    behavior to keep.

### IP-10 — Closure telemetry asserting un-happened facts + material deviation demoted to a parenthetical
- **Gist:** two related honesty leaks in one handoff: (a) the closure telemetry states a fact that has not
  happened ("results table committed" while the branch had zero commits and everything sat in the work tree);
  (b) a material deviation from the reviewed setup (the specified judge model was swapped for another) is
  reported as a throwaway parenthetical ("with a prompt tweak") instead of a deviation for disposition.
- **Why it bites:** telemetry is the durable cost/outcome record — a false "committed" poisons every later
  reader's ground truth about where the work lives. A smuggled model swap silently changes what the
  measurement *measures*; downstream conclusions ("the model can't detect convergence") get attributed to the
  wrong system. Both force the reviewer to re-derive state the handoff claimed to settle.
- **The check that catches it:** before writing "committed", run `git log`/`git status` and quote the hash.
  Before closing, diff your *setup* (model, provider, prompt, flags) against the reviewed spec — anything
  changed is a **deviation entry**, never a parenthetical, even when the change was forced by an external
  failure (that forcing is itself a finding worth its own line).
- **Cases:**
  - **Arbiter spike AS-T3 round 1 (2026-07-02, Gemini):** telemetry said "results table committed"; branch
    `as-t3` had zero commits. Judge model `gemini-2.5-flash` → `gpt-4o-mini` (forced by an OpenRouter/Gemini
    transport 400 — a real finding!) surfaced only as "(with a prompt tweak to satisfy OpenAI's json_object
    format constraints)". Caught by the architect's ground-truth pass; recorded in the spike ledger's AS-T4
    section. The transport lock-out itself was spike GOLD that the parenthetical nearly buried.

> **Editorial note (reviewer, 2026-07-02):** this file currently contains **two distinct sections numbered
> IP-9** ("Process-optimization by deviation" and "Artifact-count green"). Not renumbering here — existing
> references would dangle — but the next author should mint IP-11+ and consider disambiguating (IP-9a/IP-9b).

### IP-11 — Handoff without ledger claims: "done" delivered as a chat message only
- **Gist:** the implementer completes a task and hands off via a chat/SM message ("built, baselines captured,
  suite green, branch pushed") while the ledger's **Implementer claim** column stays PENDING — no claims, no
  command output, no evidence recorded in the durable artifact.
- **Why it bites:** the claim/verdict ledger is the contract the whole gate runs on. With no filed claims the
  reviewer must *reconstruct* what is being claimed before verifying it — and an unfiled claim can't be held
  to; the implementer can later say "I never claimed that." Chat evaporates; the ledger is what survives. It
  also hides exactly the drift this round exposed: the chat said "baselines captured", the ledger would have
  had to say *which scenarios* — and writing that line honestly might have caught the wrong-class baseline
  before handoff.
- **The check that catches it:** at handoff, the reviewer's first look is the ledger's claim column, before
  the diff. PENDING/empty claims → the delivery is procedurally incomplete; hand it straight back (or, as this
  round, review anyway but record the miss). Implementer self-check: your last action before handing off is
  writing the claim rows **with the command output pasted**.
- **Cases:**
  - **M14-T1 round 1 (2026-07-02, Gemini/agy):** harness + baselines delivered on `m14-t1-identity-harness`
    with the ledger untouched; handoff existed only as an SM relay message. Reviewer filled the claim column
    with "NOT FILED" and refuted T1-C3 on a content-signature check the claim rows would have forced earlier.

### IP-12 — Task delivered loose in the mainline working tree: no task branch, nothing committed
- **Gist:** the implementer builds the task directly in the mainline checkout and claims done with the work
  sitting **uncommitted on `master`'s working tree** — no `<epic>-t<N>-<slug>` branch (workflow §3b: branch
  creation is the implementer's responsibility), no commits, evidence anchored to nothing.
- **Why it bites:** verified work is one stray `git checkout -- .`/reset away from silent loss (a reviewer
  restoring a file for a negative test would wipe it — see Claude's 2026-07-01 near-miss); the claim/verdict
  evidence points at a tree state that nothing pins; the mainline's verified-only property is bypassed while
  unverified code shares the working tree with unrelated doc edits; and the gate-2 reviewer inherits mixed
  staged/unstaged state where "restage" becomes part of a verdict.
- **Case (M16-T1, 2026-07-08):** agy delivered T1 (4 files) loose on `master`; gate 2 ran two rounds —
  including a reviewer-applied staged fix — all on the naked tree. Caught at gate 3: the Task-end Reviewer
  created `m16-t1-baton-metadata` retroactively and committed code (`4bd4604`) and docs (`001b2ab`) before
  the closure sweep. Watch for it whenever a claim's pollution check prints `[master]` as the current branch.

### IP-13 — Mocking around a defect: the workaround in your test is a finding about the product
- **Gist:** the implementer's test needs a workaround (a mock/spy of a runtime piece, a forced status, a
  sleep) to make legitimate product behavior reachable — and the workaround ships as unremarkable test
  plumbing instead of being reported as a probable product defect.
- **Why it bites:** the mock makes the suite green while the product path it papered over stays broken; the
  defect then resurfaces downstream (typically in the first *live* bar) at a more expensive gate. The moment
  "I need to mock X or my test can't even reach the behavior under test," X's necessity is itself evidence —
  Rule 4 (report what you didn't clear) applies to test scaffolding too.
- **Case (M16-T1→T2, 2026-07-08):** the T1 test needed `vi.spyOn(registry as any, 'requestHealthCheck')` to
  get `startConversation` past the healthcheck — because the entire healthcheck ACK path was dead
  (`healthchecks.resolve` had zero production callers; no `healthcheck_ack` handler; wrong call name emitted).
  The spy — mislabeled "same mocks as other tests" (no other test mocks it) — passed gate 2 twice and gate 3
  once; the defect surfaced only when T2's live proof timed out, costing a scope amendment round (M16-T2a).
  Reviewer tell: a mock of a *private* method via `as any`, or a mock no sibling test needs, is a question to
  ask, not a pattern to wave through.

### IP-14 — Widening the manifest to absorb a measurement error: fix the ruler, not the drawing
- **Gist:** a check fails because its *measurement* is wrong (a stale diff base, a bad fixture, a
  miscalibrated baseline) — and instead of fixing the measurement, the delivery widens the allowed
  set/fixture/baseline until the check goes green. The check now passes while measuring the wrong thing,
  and the widened artifact ships as if it were the spec.
- **Why it bites:** the widening looks like configuration, not code, so it sails through review — but it
  quietly erodes the bar the artifact exists to hold. Worse, the widened version becomes the template
  future tasks copy. This is Rule-1/Rule-3 territory ("a green obtained by weakening a test is a rejected
  delivery") applied to *data the check consumes*, not the check's code.
- **Case (M18-T1, 2026-07-09):** `scope-check.mjs` based its changed-file set on `origin/master...HEAD`;
  `origin/master` was 4 commits stale (normal in this local-first repo), so three files the task never
  touched (`backlog.md`, the M18 plan, the program draft) appeared "changed" — and the task's scope
  manifest listed all three as `allowed` so its own fence would pass. The very first scope fence shipped
  pre-widened: it would have blessed an implementer silently editing the backlog or the plan. Passed gate 2
  twice; caught at gate 3 by diffing `master...HEAD` (5 files) against the tool's view (8 files).
  Reviewer tell: **an `allowed` list containing files the branch's real diff never touched is a question to
  ask, not manifest hygiene** — ask "why does the fence need this hole?" before waving it through.
