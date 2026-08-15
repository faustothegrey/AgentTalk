# Backlog — containment

Open items owned by the **containment** module. Closed items live in `90-closed.md`.

<!-- Split from design/backlog.md (Wave 1). -->
<!-- @item
id: BL-005
status: deferred
date: 2026-06-21
epic: M08
tags: [worktree, worker-prompt]
-->
- [deferred · was: deferred · adjacent to M08-T3; re-statused open→deferred 2026-07-02 (PO ordering review)] 2026-06-21 — **Worker-prompt worktree cleanup (FIND-T3b2-1)** — the worker prompt
  (`in-process-driver.ts` `handleTeamWorkAssign`) still tells agy *"you must use strictly `git worktree`…
  or refuse,"* but the orchestrator **already** runs the worker inside a per-task worktree (its `cwd`). So
  agy creates a **nested** worktree (`./worker-worktree`) and the real change lands one level deeper than
  where the orchestrator looks. Confirmed live in T3b-2.5 (change *is* inside a worktree → DoD met, but
  nested). **Fix candidate:** drop/relax the redundant "create a worktree" instruction since isolation is
  already provided; **behavior change → needs its own spec** before touching. Matters once the orchestrator
  needs to *collect* worker output (M07-T4 / failure-modes), not before.

<!-- @item
id: BL-007
status: deferred
date: 2026-06-23
epic: null
tags: [recovery, awaiting-operator]
-->
- [deferred · was: deferred · future · own milestone; re-statused open→deferred 2026-07-02 (PO ordering review)] 2026-06-23 — **Operator abort / recovery for `awaiting_operator` tasks** —
  split OUT of M08-T3 (Fausto's call, 2026-06-23). M08-T3 now ships the **fence only** (worker crash mid-exec →
  `awaiting_operator` → record + surface → **kill nobody**); the *recovery gesture* an operator makes afterwards
  is deferred to its own milestone. **Why deferred (Fausto):** the abort splits in two — **"stop ASAP"** is cheap
  and bounded (cancel turn, release team), but **"…and clean up"** is the dragon: the task is paused *precisely
  because the worker's effects may be partial* (half-written file, partial commit, an external side-effect already
  out the door). There is no generic "undo a half-finished agent" — cleanup depends on the tool, the task, and
  whether the effect is even reversible; guess wrong and abort is *more* destructive than the crash. So the
  end-state design (task→? team→? agents shut down/alive?) can't be settled in the abstract — **let experience
  dictate the cure:** collect a few real partial-effect messes first, then design recovery around what actually
  gets left behind. **v1 interim (what the fence already gives us):** the paused task is **harmless** (spike LB-16
  proved no re-schedule, no timer, no M03 kill) — it sits frozen + surfaced with the operator standing in front of
  the mess; manual cleanup + orchestrator restart is the honest v1 recovery. **Caveat to honour in the fence work:**
  don't let the pause path's UI/transcript wording promise an "abort" button that doesn't exist yet.
  - **Trigger to promote:** a handful of observed real `awaiting_operator` pauses (so the recovery model is
    grounded in actual partial-effect cases, not guessed). **Source:** Fausto ↔ Claude T3 decisions, 2026-06-23.

<!-- @item
id: BL-091
status: deferred
date: 2026-07-27
epic: null
tags: [infrastructure, harness, operator-seat, bl087, observability, accepted-risk]
-->
- [deferred · **PO DECIDED 2026-07-27: UNMITIGATED, ACCEPTED**, with a compensating manual sweep (see the
  disposition at the end of this item) · found because the **PO noticed two shells still running**, not by any
  check we own] — **The invariant
  harness cannot see a process that holds no port, so an operator's stray poll loop is invisible to it.**

  **How it surfaced.** During the O-1 re-run the operator left an `until grep …; do sleep 5; done` loop spinning,
  waiting on a marker that never arrived (→ [[BL-090]] for why it never arrived). It ran unnoticed for ~10
  minutes across two subsequent rungs. **The harness reported `exit 0` the whole time**, correctly by its own
  rules and uselessly in fact.

  **Why it is invisible.** `snapshotGlobal` builds its process list *from listening sockets* — it enumerates
  `lsof -iTCP -sTCP:LISTEN`, then decorates those pids. A shell loop binds nothing, so it never enters the state
  vector, and `isWatchedProcess` is never even consulted. **The port is the discovery mechanism, not just the
  filter.**

  **Why this matters more than it looks.** The operator seat's defining property is that it **launches process
  trees** — that is the whole reason the implementer's fence was said not to transfer, and the reason BL-087 was
  built first. A harness that only sees *servers* misses the most likely operator residue: pollers, waiters,
  watchers, orphaned `sleep`s. **We built the rail for the stated risk and it does not cover the stated risk.**

  **Not urgent, and not free.** The obvious fix — enumerate `ps` for launcher/provider/shell patterns — is
  exactly where [[IP-15]] lives: guessing from a command line which processes are "ours" is how a reviewer once
  filed a defect against a service the PO runs deliberately. Any design here must produce **positive evidence**
  (the BL-023 discipline), not a pattern match. Consider process-group/session ancestry from the launcher's own
  pid, which the launcher already tracks (`detached: true`, negative pid — [[BL-081]]).

  ---

<!-- @item
id: BL-054
status: deferred
date: 2026-07-16
epic: null
tags: [safety, sandbox, autonomy, policy]
-->
- [deferred · **PARKED by the PO 2026-07-16** — *"se sono worktree laterali pazienza per ora"* · **reopen condition:** before any **unattended/unwitnessed** autonomous run (Bite 1 is explicitly allowed to proceed WITHOUT this, PO call), or on the first sign of a worker touching anything outside `/tmp` · split out of BL-052] — **Should
  `workdir` be restricted to a blessed root?** BL-052 makes `workdir` **mandatory** — but a required-yet-arbitrary
  workdir still permits `workdir: /home/fausto/Software/AgentTalk`. It only makes the choice **explicit and
  auditable**; it does not make it **safe**. The remaining question is whether the launcher should additionally
  **refuse any workdir outside an allowed root** (e.g. `/tmp/att-*`, or a PO-configured list), turning "the
  operator named a directory" into "the operator named a *permitted* directory". **Why it was split:** enforcement
  is a **policy** decision about what the system is allowed to touch — it deserves its own PO call rather than
  riding along inside a containment bugfix. **Why it matters:** Bite 1 puts an *agent* in charge of invoking the
  launcher; at that point "explicit" stops being much of a guard, because the agent writes the config. A blessed
  root is what keeps an autonomous caller from naming a real checkout. Source: BL-052 implementation, PO-approved
  split.

  **Sharpened by the BL-055 live run (2026-07-16) — this is observed, not theoretical.** The real worker's worktree
  landed at `/tmp/att-worker-count-task`, a **sibling** of its assigned `/tmp/att-worker-sandbox` — ordinary
  `git worktree ../name` resolution. Nothing was at risk (it stayed in `/tmp`; the branch/commit live in the
  sandbox's object store), but it proves the shape of the remaining hole: **BL-052 constrains where a worker
  STARTS, not where it may WRITE.** The worker never *asked* to go sideways — it just did.
  **Two holes, two fences (the design, worked out 2026-07-16 — recorded so the next session doesn't re-derive it):**
  1. **Policy — the wrong place is *requested*.** Launcher refuses a `workdir` outside a PO-configured root
     (`/tmp/att-*`). Cheap (a few lines beside the BL-052 checks). **Weak alone — today's escape sails straight
     past it**, since nothing was requested. Its real value is **Bite 1**: once an *agent* writes the config, the
     allowlist is the one part the agent does not control.
  2. **Enforcement — the wrong place is *used*.** Wrap the worker in **bubblewrap**: `bwrap --ro-bind / /
     --dev /dev --proc /proc --bind <workdir> <workdir> --chdir <workdir> -- node llm-agent.mjs …`. The filesystem
     itself refuses; no cooperation from the worker required — which matters, because the incident happened while
     the worker was *obeying instructions*.
  **Feasibility — TESTED on this machine, not assumed:** `bwrap` is installed, unprivileged user namespaces are
  enabled (`kernel.unprivileged_userns_clone=1` — no root, no Docker), Landlock is compiled in
  (`CONFIG_SECURITY_LANDLOCK=y`) as a future alternative. Measured under a bwrap fence: the sideways worktree is
  **BLOCKED** (`fatal: could not create leading directories … Read-only file system`); a write into the real
  checkout is **BLOCKED** (`Read-only file system`); creating a branch in the real repo is **BLOCKED**
  (`cannot lock ref … Read-only file system`); and crucially the worker can still **READ** the real repo
  (`git log` works — agents need this) and **commit normally inside its own sandbox**.
  **Open questions before adopting (one short spike, same shape as BL-055):** (a) does the real `claude` CLI survive
  a read-only `$HOME` — it needs `~/.claude` config/credentials and may want a writable cache; (b) does the MCP
  WebSocket survive (the test shared the network namespace, so it *should* — untested). Both were tested with
  `bash`/`git` only, **not** the provider CLI.
  **Recommendation on the table when this reopens:** do **both** layers — layer 1 constrains the request, layer 2
  constrains the use — and do not let layer 1 stand alone, or it is security theatre. Threat model is
  **obedient-but-misdirected**, not adversarial: nothing here defends against an attacker.

<!-- @item
id: BL-098
status: deferred
date: 2026-07-28
epic: null
tags: [infrastructure, portability, linux, harness, operator-seat, bl087-followup]
autonomy: human-only
-->
- [deferred · **PARKED by the PO 2026-08-07 — reopen: work resumes on a Linux box** · filed 2026-07-28 while surveying the machine move (`PORTING.md` §8) · **found by reading, not by
  running — nobody has yet run this harness on Linux**] — **On Linux nothing can ever be classified
  `LEGITIMATE`, because the only source of that evidence is `launchctl`.**

  `classifyProcess` grants `LEGITIMATE` **only** when the service registry knows the PID
  (`check-orchestrator-ports.mjs:85-87`), and the registry is `launchctl list`
  (`infra-invariant.mjs:452`, `check-orchestrator-ports.mjs:176`) — **macOS-only, with no systemd equivalent
  implemented.** The call degrades rather than crashing (`managedPids()` catches and returns empty), so this is
  not a crash; it is worse in one specific way: **the harness still reports, and it reports UNKNOWN.**

  **Why that matters more than it looks.** `UNKNOWN` **fails the sweep by design** — the module's own comment
  calls the "unclassifiable ⇒ report clean" branch the fail-open it exists to remove. And a `critical` from this
  harness **GATES the next operator run**. So on a Linux box the orchestrator the operator just launched is
  liable to be flagged as an unknown listening process **by the very check that decides whether the operator may
  run again.** The escape valve exists (`AGENTTALK_SWEEP_DECLARED`, and declaring is positive evidence too), so
  this is not a blocker — but it turns a should-be-silent gate into a manual declaration on every run, and a gate
  that always needs hand-waving is a gate people learn to wave through.

  **Fix:** give `managedPids()` a Linux branch — `systemctl --user show -p MainPID <unit>` (the porting doc's own
  systemd unit is the natural source), or read the cgroup. Keep the macOS path unchanged and select on platform.
  **Do not** widen `PASSING` to include `UNKNOWN`; that is the fail-open the module was built to delete.

  **Bar:** on Linux, an orchestrator started by the systemd user unit classifies `LEGITIMATE` **without** any
  `AGENTTALK_SWEEP_DECLARED`, and a genuinely stray process still fails. Needs a Linux box to verify — this item
  cannot be closed from macOS, and it should not be closed on reasoning alone.

  **✅ AMENDED 2026-07-28 — RUN ON LINUX FOR THE FIRST TIME. The prediction above is CONFIRMED, verbatim.**
  Filed "found by reading, not by running"; it has now been run, on the Linux box, against a real orchestrator
  (`PORT=3500 node apps/orchestrator/dist/index.js`, pid 90205) with a `snapshot`/`check` bracket:

  ```
  $ node scripts/infra-invariant.mjs check --before before.json ; echo $?
  [CRITICAL] 1
    · process-appeared: UNKNOWN: pid 90205 | ports 3500 | no positive evidence: the service
      registry does not know it, it is not declared, and nothing marks it as leaked
  1
  ```

  Plus the predicted `WARNING: could not read the service registry (launchctl list).` So: the harness **works**,
  it **degrades rather than crashing**, and the orchestrator the operator just launched *is* flagged `UNKNOWN` by
  the very check that decides whether the operator may run again. Nothing here needs restating — **the item was
  right.** Its status is unchanged (`todo`), and the fix direction (a Linux branch in `managedPids()`) stands.

  **⚠️ SECOND AMENDMENT 2026-07-28 (H-L1 run) — the harness's launchctl failure is SILENT, and its own comment
  says otherwise.** `infra-invariant.mjs`'s `managedPids()` (`:449-465`) catches the missing `launchctl` with an
  **empty catch** whose comment reads *"no registry ⇒ no positive evidence ⇒ things land in UNKNOWN. **Loud, not
  silent.**"* — but nothing is printed. The loud warning exists only in `check-orchestrator-ports.mjs:184-185`,
  a different file. **Observed:** the H-L1 operator was briefed to expect the warning from the harness, ran
  `infra-invariant check`, and correctly reported seeing none. **The brief was wrong, not the operator.**
  Consequence: on Linux the harness silently loses its only source of `LEGITIMATE`, so a reader has no signal
  that the classification is degraded — the exact "we could not look ⇒ looks fine" shape this family of checks
  exists to remove. Fold into this item's fix: whatever supplies `managedPids` on Linux should also **say so
  when it cannot**.

  **One thing this item did NOT predict, and could not have — see [[BL-099]].** The prediction holds for
  `infra-invariant.mjs`, which parses `lsof` **without** filtering on the command name. Its sibling
  `check-orchestrator-ports.mjs`, run standalone **at the same moment against the same process**, printed
  *"No orchestrator-ish node processes are listening"* and exited **0**. Two consumers of one `lsof` call,
  opposite verdicts. **So the escape valve this item leans on is narrower than written:**
  `AGENTTALK_SWEEP_DECLARED` cannot rescue the standalone sweep, because declaring a port only helps a process
  that was *seen* — and there, none ever is. Fix BL-099 first, or the "manual declaration on every run"
  mitigation is silently a no-op for one of the two callers.

  ---

  **⬛ PARKED BY THE PO, 2026-08-07. Nothing above is retracted — the defect is real, confirmed by running, and
  unchanged.** It is parked because it **cannot be worked from the machine we are on.**

  The dev box moved back to **macOS** on 2026-07-30, where `launchctl` is present. So on this machine the defect
  **cannot fire, cannot be reproduced, and cannot be verified** — and this item's own text already ruled out the
  alternative: *"Needs a Linux box to verify — this item cannot be closed from macOS, and it should not be closed
  on reasoning alone."* An item that can neither progress nor be tested is parked, not open.

  **↩ REOPEN CONDITION: work resumes on a Linux box** — or the operator is ever run anywhere but this Mac.

  **⚠️ Read this before assuming the park is cheap.** The moment it reopens it is not cosmetic: it turns a
  should-be-silent gate into a **manual declaration on every single run**, and a gate that always needs
  hand-waving is a gate people learn to wave through. The Linux evidence recorded above is the **only** real run
  this harness has ever had off macOS; do not let the park make it look like a hypothesis again.
  **Still true and not fixed by parking:** the `launchctl` failure is **silent** (`managedPids()`'s empty catch
  claims "Loud, not silent" and prints nothing), and [[BL-099]] means `AGENTTALK_SWEEP_DECLARED` is a no-op for
  one of the two callers.

<!-- @item
id: BL-140
status: deferred
date: 2026-08-15
epic: null
tags: [operator, hermes, containment, authorization, signatures, bl-137]
autonomy: po-decision
-->
- [deferred · **PARKED 2026-08-15 by [[BL-134]]'s migration — a PO DECISION, and a question is not a task**
  (same rationale as [[BL-139]]). **Reopen condition:** the threat model changes, [[BL-139]] option (a) makes
  key handling routine anyway, or a `critical` shows a seat writing where it should not. · filed 2026-08-15 at
  BL-137's close so it stays a DECISION rather than a planner's omission**] —
  **Signature verification is the only option that would actually fence a shell-holding operator — and it
  trades away exactly the lightness the PO asked for.**

  [[BL-137]] option (b), deliberately excluded from that item's scope. Its own §2 concluded: *no file
  location, directory, store or git ref can prevent a defecting operator from authorizing its own run; only a
  secret it cannot read can.* A `git verify-commit` check on the authorization commit, against a key whose
  passphrase lives only in the PO's head, **is** that secret.

  **The cost is the reason it was not just done.** The PO's brief was *"make this process lighter"*, and BL-137
  delivered an act of one word. Signing means **a passphrase typed per approval** — plus key generation,
  distribution, rotation, and a `verify-commit` path in `hmp-commission.mjs` that must fail closed on a missing
  or unknown key. That is a straight trade of convenience for a real fence, and **only the PO can make it.**

  **Do not file this as "the fix BL-137 should have made."** BL-137 addressed the failure modes that are real
  on this machine — accident, drift, and two false safety claims. This addresses **defection**, which has not
  occurred and may never. Reopen when the threat model changes, when [[BL-139]] option (a) makes key handling
  routine anyway, or when a `critical` finding shows a seat writing where it should not.

<!-- @item
id: BL-146
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, observability, instrument-panel]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16 at the PO's direction — "a list of backlog items to climb the autonomy ladder
  itself". The defect it names cost most of the session that found it**] —
  **Nothing reports where the autonomy ladder actually stands, so every reader reconstructs it by hand — and
  the last two readers got it wrong.**

  **Evidence, gathered 2026-08-16.** The planner primer stated the ladder was at "O-1/O-2". The truth on disk
  is **nine PO-authorized commissioned runs**, `hmp1` … `hmp9`, the last of them 2026-08-13. `AGENT.md`'s
  soft-ladder table still presents O-1 as *"first real test of the harness"* and O-3 as aspirational — three
  weeks and fifteen runs after both were passed. Establishing this took reading the recorded-run ledger
  (`design/operator/.hmp-launched.json`, 9 entries) plus **13 grading documents** scattered among the **81
  files** in `design/operator/`. **Two separate artifacts, written by the actor closest to the work, both
  understated what had actually been proven.**

  **Why this is a rung and not housekeeping.** The operator seat's entire product is *reporting the
  development situation to the PO* (charter → Visibility). The seat that is meant to be the instrument panel
  has no instrument for the one process it exists to run. That cost is paid on every cold start, by every
  reader, forever, and it is paid in the currency this project is shortest of.

  **Deliverable.** A status tool over the recorded-run ledger and the grading documents beside it. One line
  per recorded run: identifier · date · subject item · verdict · wall-clock. It must **flag any recorded run
  with no grading document** (see [[BL-147]] — `hmp6` is one today), and report the ladder's furthest verified
  position as a *derived* fact rather than a remembered one.

  **The trap, and it is the whole difficulty.** Verdicts live in **two** places and in **prose**. Grading
  headers use at least four shapes — `**Verdict: PASS**`, a title-line `: **PASS**`, a `| Verdict |` table
  row, and `**NOT PASS**` — and `hmp6`'s verdict is not in a grading document at all. **A tool that silently
  reports "no verdict" for a run that was graded is worse than no tool**: it would tell the next session
  exactly the false story the primer told this one. Prefer an explicit `unparsed` / `missing` classification
  over a confident blank — **positive evidence, not pattern-matching optimism** (the [[BL-023]] discipline,
  and the [[IP-15]] trap it exists to avoid).

  **Scope.** In: a new script under `scripts/`, its test, an npm script. **Out:** the launcher, the invariant
  harness, `AGENT.md` (its stale table is [[BL-153]], PO-fenced), and the grading documents themselves — this
  item *reads* the corpus, it does not rewrite the corpus to suit the parser.

  **Done** = the tool prints all nine recorded runs with verdicts; names `hmp6` as *lacking a grading
  document* rather than lacking a verdict; a test pins the parse of at least the four header shapes above.

<!-- @item
id: BL-147
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, convention, gate]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16, same pass as [[BL-146]] — found by trying to answer "what was the verdict of
  every run?" and discovering one could not be answered from the expected place**] —
  **A commissioned run can be graded with no grading artifact beside it, and one was — nothing noticed for
  nine days.**

  **Evidence.** `design/operator/hmp6*` yields a bar, a brief, an authorization file and a config — and **no
  `hmp6-grading.md`**. Its verdict exists, in prose, inside the backlog item it delivered. Every other
  recorded run has a grading document. **The convention is real, universally followed but for one case, and
  enforced by nothing** — which is precisely the shape that rots: eight conforming instances are exactly what
  makes the ninth invisible.

  **Why it matters beyond tidiness.** The grading document is where a rung's verdict, its evidence and its
  independence caveats live. It is the artifact a later reader trusts. A run whose verdict survives only as
  prose inside a closed item is a run whose grading **cannot be audited without knowing where to look** — and
  knowing where to look is exactly what a fresh reader lacks.

  **Deliverable.** A check proving every entry in the recorded-run ledger has a corresponding grading
  document, **or an explicitly recorded exemption** naming where the verdict lives instead. It must fail when
  that does not hold. Wire it where the other gates live.

  **The trap.** The obvious implementation makes `hmp6` red and tempts the implementer to fix `hmp6` by
  writing the missing document. **Do not.** Back-filling a grading document nine days later, from an item
  rather than from a run that was actually observed, manufactures an artifact that looks like evidence and is
  not — this project's most-repeated lesson ([[BL-053]] / [[BL-059]]). Record `hmp6` as a **declared
  exemption** pointing at where its verdict really is. **Reporting that the exemption mechanism is the wrong
  answer, with reasons, is a valid outcome** worth more than a green.

  **Scope.** In: the check, its test, its npm wiring, and one exemption record. **Out:** writing or editing
  any grading document; the launcher; the ledger format.

<!-- @item
id: BL-148
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, bar-quality, gate, leg-2]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16. The highest-value item of this batch: it is the precondition for ever delegating
  bar-authoring, which is the un-built half of the loop's step ②**] —
  **A pre-registered bar can ship with mutually unsatisfiable rows — and one did, having passed every control
  we have.**

  **Evidence, and it is not hypothetical.** `hmp7`'s **R4 pinned the suite at 722/722 while its R2 required a
  new test file.** No delivery could satisfy both. That bar was written by a human, committed to master,
  PO-authorized, and launched; the contradiction was found only at grading and disposed after the fact as a
  bar defect. The correction was written down at the time — *"never pin a fixed suite total on a rung that
  also requires a new test"* — and writing it down is all that has happened since.

  **Why the existing controls do not cover this.** `modules/containment/docs/brief-authoring-rung-plan.md`
  §3b states it outright: the PO committing and authorizing a bar is *"a control against an **unauthorized**
  bar, not an **incoherent** one."* That plan then keeps bar-authoring human **specifically because
  incoherence has no mechanical check** — while conceding that human authorship is what produced the one
  known incoherent bar. **Build the check and that reasoning changes.**

  **Deliverable.** A checker for pre-registered bars that proves: each row is **individually falsifiable**
  (states an observable outcome, not a sentiment); the rows are **mutually satisfiable** (no two rows that no
  single delivery could meet); no row **pins an absolute suite total** while another requires adding tests;
  and the document is clean under the recursion fence.

  **The honest limit, which must be stated in the deliverable rather than discovered later.** Mutual
  satisfiability is not decidable in general over prose. The target is **the known contradiction shapes**,
  starting with the pinned-total-versus-new-test pair that actually occurred. **A checker that claims more
  than it proves is the failure mode here** — it would license exactly the delegation it is too weak to
  protect. Say what it catches and what it does not.

  **Scope.** In: the checker, its tests (including `hmp7`'s R4/R2 pair as a fixture that must go red), npm
  wiring. **Out:** rewriting any historical bar; the launcher; `LAUNCH_PATTERNS`; deciding whether
  bar-authoring gets delegated — that call is the PO's and this item only makes it available.

<!-- @item
id: BL-149
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, measurement, leg-2]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16 — the metric this rescues was already lost once, which is the entire argument
  for the item**] —
  **The one number that decides whether brief-delegation succeeds or gets abandoned is computed by a
  remembered procedure, and it was never computed.**

  **Evidence.** `hmp8` delegated brief-authoring to a worker and passed structurally. Its **R9 — the discard
  rate — is recorded as "not yet computable: needs the PO's edit commit on top of `43fa42e`."** `git log` over
  that brief shows **exactly one commit, ever.** The edit never happened, the subject item was closed by PO
  decision two days later, and **the pre-registered measurement of the experiment was never taken.** Its
  thresholds were real ones — ≤30% success, 30–60% inconclusive, **>60% abandon rather than tune** — so what
  was lost is not a statistic but the verdict itself.

  **Deliverable.** A tool computing the discard rate between two commits of the same document: **deleted lines
  over the base line count**, bounded [0,1], with **added lines reported alongside and never folded in**. The
  formula is already specified and already survived one correction —
  `modules/containment/docs/brief-authoring-rung-plan.md` §2 — because the original *"lines changed / lines
  produced"* was not computable under `--numstat`, where a rewritten line counts once as added and once as
  deleted, scoring a full rewrite at 200%.

  **Why a tool rather than the procedure.** The procedure has one step people forget — the edit must be made
  **on the worker's file**, not written fresh alongside it — and if it is forgotten the number is
  unrecoverable rather than merely late. **A measurement that depends on someone remembering to make it
  possible is not a measurement.**

  **Scope.** In: the script, its tests, npm wiring. **Out:** re-running any past rung; editing `hmp8`'s
  artifacts to make its number retrospectively computable — **it is not, and pretending otherwise would
  fabricate the exact evidence this item exists to protect.**

  **Done** = one command, two commits and a path in, discard rate and added-line count out; tests cover the
  rewrite case that broke the original formula.

<!-- @item
id: BL-150
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, doc-defect, self-contradiction, small]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16 · deliberately small — the intended warm-up rung, chosen so the loop itself is
  what gets tested rather than the subject matter**] —
  **The brief-authoring rung plan's header contradicts its own body about whether it was ever reviewed.**

  **Evidence.** `modules/containment/docs/brief-authoring-rung-plan.md` opens with **"Status: DRAFT — gate 1
  not yet held."** Its own **§8a** is titled *"Gate 1 — plan review, held 2026-08-09"* and records a verdict of
  **APPROVED WITH CHANGES** with four findings dispositioned; the body then refers to gate-1 decisions in at
  least four further places. **The plan was reviewed, and its header says it was not.**

  **Why it is worth an item.** This is the same defect class [[BL-145]] just cleared out of `AGENT.md`: a
  document long enough that its header and its body can disagree, where the disagreement survives because
  nobody reads both in one pass. Here it is load-bearing — a reader deciding whether to trust the plan reads
  the status line first, and the status line tells them not to.

  **Deliverable.** Correct the header to match the body. Check the **rest** of the document for the same class
  of drift while there, and **report** what is found rather than fixing beyond the header.

  **Scope.** In: that one document. **Out:** everything else — notably the §7a decisions and the §2 formula,
  which are correct as written and are not this item's business.

  **Done** = header and §8a agree; a one-line report of any further drift found.

<!-- @item
id: BL-151
status: todo
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, tooling, leg-2, cost-reduction]
blocked_by: []
autonomy: eligible
-->
- [todo · **filed 2026-08-16 — attacks the cost of step ② directly, from the side that needs no judgement**] —
  **Every rung hand-assembles its preparation documents from exemplars, and that cost is the whole distance
  between "the PO picks an item" and "the work starts."**

  **Evidence.** Each rung needs a brief (~150 lines), a pre-registered bar (~110–137 lines) and a config,
  built by reading two or three prior exemplars and copying their shape. `brief-authoring-rung-plan.md` §2
  puts that at roughly one planner session per rung, and names it as the reason the loop is not yet routine.
  Nine rungs have now paid it nine times.

  **Deliverable.** A scaffold that generates, from the existing exemplars, skeleton preparation documents for
  a chosen backlog item — with the structural properties of §3c present as an explicit checklist rather than
  as prose to remember: names the item and the concrete deliverable; verifies the premise **by symbol, not
  line number**; lists **≥2 plausible wrong answers that would look green**; declares files in and files
  explicitly out; states a show-stopper condition and that refuting the brief is a valid outcome; every bar
  row individually falsifiable and the rows mutually satisfiable.

  **The trap, and it is specific.** Generated text must **refer to its outputs by role, never by mechanism** —
  a skeleton that names the launcher would produce documents that trip the recursion fence, and **a trip is a
  finding about the generator, never a reason to touch `LAUNCH_PATTERNS`.** Run the fence over the generator's
  own output as a test.

  **The honest risk.** A scaffold can lower the cost of producing documents without raising the quality of
  the thinking in them, and a well-shaped empty brief is worse than a rough good one — it passes review by
  looking right. **Generate structure and prompts; never generate content that reads as analysis.**

  **Scope.** In: the scaffold, its tests, npm wiring, and the checklist. **Out:** `LAUNCH_PATTERNS`, the
  launcher, the meta-brief, and any historical brief or bar.

<!-- @item
id: BL-152
status: deferred
date: 2026-08-16
epic: null
tags: [operator-seat, ladder, leg-2, human-only, no-recursion]
blocked_by: []
autonomy: human-only
-->
- [deferred · **human-only by the charter's own no-recursion rule: executing this item IS launching a run, so
  it can never be handed to a worker. Parked as the PO's to sequence, not as work anyone is waiting on ·
  filed 2026-08-16**] —
  **The loop's step ② has been demonstrated once, measured never, and its product has never governed
  anything.**

  `hmp8` proved a commissioned worker can author a brief — and did it well, finding a decision nobody had
  noticed was needed and rediscovering the [[BL-148]] mutual-satisfiability lesson unprompted. **Two things
  then did not happen:** its discard rate was never computed (→ [[BL-149]]), and the 273-line brief it
  produced **never governed a run**, because the subject item was closed by PO decision two days later. Step 6
  of the plan's own sequence — *"the first time a commissioned artifact governs a later run"* — has not
  occurred.

  **What closing it takes:** a live subject item; a worker authors the brief; **the PO edits that brief in
  place**, on the worker's own file, so the discard rate is computable; that brief then governs the next rung.
  **Reopen condition:** the PO chooses to run it — [[BL-149]] makes the measurement one command, so this is
  cheaper after that lands than before.

<!-- @item
id: BL-153
status: deferred
date: 2026-08-16
epic: null
tags: [governance, agent-md, stale-claim, po-fenced]
blocked_by: []
autonomy: human-only
-->
- [deferred · **PO-fenced: `AGENT.md` is outside the standing grant, so this waits on the PO's word rather
  than on any agent · filed 2026-08-16**] —
  **`AGENT.md`'s soft-ladder table describes a ladder that has not been climbed, fifteen runs after it was.**

  The table presents **O-1** as *"first real test of the harness"* and **O-3** as *"a real task — the actual
  seat"*, aspirational. Both were passed on 2026-07-27, and nine further commissioned runs have since
  delivered real tasks including engine-code changes. The table is not merely stale: it **understates what has
  been proven**, which is the direction that makes a reader more cautious than the evidence warrants and
  invites re-proving what is already established. Directly adjacent to what [[BL-145]] fixed elsewhere in the
  same file.

  **Reopen condition:** the PO authorizes an `AGENT.md` edit. Worth pairing with [[BL-146]], which makes the
  ladder's real position a derived fact rather than a sentence someone has to remember to update.

<!-- @item
id: BL-154
status: deferred
date: 2026-08-16
epic: null
tags: [governance, agent-md, inheritance, provider-parity, human-only]
blocked_by: []
autonomy: human-only
-->
- [deferred · **human-only: verifying it means launching each provider, which is the no-recursion rule ·
  filed 2026-08-16**] —
  **A worker being governed by `AGENT.md` is verified for `claude` only; for codex and gemini it is assumed
  from convention.**

  [[BL-080]] verified inheritance on the headless `claude` path. `AGENT.md` states the gap plainly — *"a file
  existing and a worker being governed are different claims, and a symlink is not evidence a worker reads
  it"* — and every rung so far has run `claude`, so the assumption has never been tested. **It becomes
  load-bearing the moment a rung is commissioned against another provider**, which is also the moment it would
  be discovered the expensive way.

  **Reopen condition:** a rung is proposed against codex or gemini, or the PO asks for provider parity in the
  ladder.

*(add new items above this line)*
