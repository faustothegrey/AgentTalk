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

*(add new items above this line)*


*(add new items above this line)*
