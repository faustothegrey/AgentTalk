# Design Collaboration Workflow (multi-agent + human)

**Status:** Draft for review (2026-06-18)
**Author:** the Reviewer/Verifier agent (at the Human's request)
**Purpose:** Make explicit the working method we converged on while designing the MCP
orchestration migration, so it can be reviewed, refined, and reused deliberately.

> For the other agent reviewing this: critique the workflow itself. Where is it slow,
> redundant, or fragile? What roles or steps are missing? Open questions are at the end.

---

## 1. The participants and a key constraint

- **Human** — sets scope and goals, makes final decisions, decides what is
  in/out of scope (e.g. parking HITL, removing the auth-tier discussion), and **relays
  messages between the two agents.**
- **Development Orchestrator / Scrum Master** — the authority for **task-assignment ambiguity**. When an
  agent is asked to do work outside its current role (for example, a planner-reviewer being asked to
  implement code), the agent stops and reports the mismatch to the Scrum Master for a course-of-action decision.
  The agent may propose alternatives or a temporary role reassignment, but it must present the issue first
  and then do what the Scrum Master decides. The function may be held by a human or by a designated agent; the
  current holder/delegates are named in the project instructions.
- **Author agent** — drafts and revises the design (e.g. owns the proposal's decision
  sections).
- **Reviewer/Verifier agent** — critiques without deference, verifies claims empirically,
  tracks caveats and their resolution.

The roles are not fixed to a person — they **alternate by turn**. What matters is that on
any given turn one side is *proposing* and the other is *challenging*.

**Roles are functions, not fixed labels.** Although each role is normally assigned to a
particular agent (or agents) for simplicity and continuity, the roles are **dynamic by
nature and may be temporarily reassigned whenever the work calls for it** — for example,
the Reviewer/architect stepping in as Implementer for a change too sensitive or specialised
to delegate, or the Human taking a role directly. What is bound is the **responsibility of
the role**, never the identity of the agent performing it. When such a reassignment happens
it is **stated explicitly** — in the relay and in the ledger — so it is always unambiguous
who currently holds which function (the no-shared-memory constraint below makes this
mandatory, not optional).

**Role-boundary disputes go to the Scrum Master before action.** If a request crosses role lines and the assignment is
doubtful, the agent does not infer permission from urgency or convenience. It reports: current role, requested action,
why the action appears out-of-role, and any safe alternatives. Then it waits for the Scrum Master's authoritative
course-of-action decision and follows it.

**Defining constraint:** the two agents do **not** share a conversation or memory. The
only channel between them is the **shared design docs** plus what the human relays. This
is why "write it down" is not a nicety here — **the durable artifacts *are* the
inter-agent communication bus.** Anything not written down does not survive the handoff.

---

## 2. Core principles

1. **Adversarial but constructive.** Reviews steelman the proposal, then attack it. No
   sycophancy; disagreement is stated plainly with reasons. The goal is a stronger design,
   not consensus theater.
2. **Verify, don't assert.** Capability claims are settled by **running the actual tools**
   and recording exact versions, commands, and outputs — not by citing memory or docs
   alone. Where docs and reality conflict, reality wins, and the doc is corrected. Findings
   are reproduced **independently** by the other side before being trusted.
3. **Everything lives in durable docs.** Decisions, findings, and disagreements go into
   versioned design docs with **dates, status, and sources** — never only in chat.
   - **3a. Auto-persist — standing rule, no reminder required.** An agent **must write its
     analysis into the project docs on its own initiative** (creating or updating the
     relevant doc in `design/` in the same turn it produces the analysis) whenever its
     output either:
     1. **substantially changes the docs themselves** (a new decision, a revised
        architecture, a resolved/added caveat, a capability finding, a readiness verdict,
        a reordered plan), **or**
     2. **writes code or tests, or greenlights writing code/tests** on the project
        (e.g. an implementation plan, a spike design, a "ready to start" call, or the code
        itself) — the rationale, scope, and verification approach are recorded *before or
        alongside* the change, not left in chat.
     - The user should **not** have to ask "write this down" each time. Persisting is the
       default; ephemeral chat-only analysis is the exception (reserved for trivial
       clarifications that change no doc and gate no code).
     - When unsure which doc, prefer updating an existing one over a new file; keep
       cross-references and status tags consistent (principle 6).
4. **Severity- and status-tagged.** Open issues are tagged by how blocking they are
   (**[BLOCK] / [RESOLVE] / [NOTE]**); after a revision each is marked
   **RESOLVED / PARTIAL / OPEN** and mapped to the section that resolves it.
   - **4a. Edit in place — but never delete an *unresolved* point.** To keep docs lean,
     agents revise existing sections in place rather than appending endlessly, and may
     prune items already marked **RESOLVED** once both sides have seen them. An agent must
     **not delete or overwrite another agent's open/unresolved point**; instead it
     downgrades it (mark **RESOLVED** with a one-line pointer to where, or fold it into the
     revised text). The open set shrinks; nothing open vanishes silently. **Git history is
     the backstop** — any overwrite is recoverable via `git diff`, so edit-in-place is safe
     to default to.
5. **Decide, park, or open — never silently drop.** Out-of-scope topics are explicitly
   *parked* (with a one-line marker), so nothing disappears without a trace.
6. **Internal consistency is maintained.** When sections are removed or reordered, headings
   are renumbered and cross-references fixed in the same pass, across all affected docs.
7. **A readiness gate precedes code.** We state explicitly whether we are ready to plan /
   start, and what specifically gates the next step.
8. **Step-by-step with smoke tests.** Implementation proceeds in small phases, each with a
   concrete smoke checkpoint; the riskiest unknowns are validated first, in isolation,
   before touching production paths.
9. **Ambiguous assignment escalates before execution.** When role ownership is unclear, especially when a
   non-implementer is asked to implement, the actor asks the Development Orchestrator / Scrum Master for an
   explicit course-of-action decision instead of silently widening its role.

---

## 3. The artifacts

| Artifact | Role |
|---|---|
| **Proposal / spec** | The living design. Carries a status (Draft → Refined → Decisions Documented) and a decisions section that the Author agent revises. |
| **Capability / verification note** | Empirical findings: per-target capability matrix, exact versions, commands, outputs, sources. The Reviewer's evidence base. |
| **Caveats / discussion agenda** | Consolidated open issues, severity-tagged, with a resolution-status table after each revision and a readiness verdict. |
| **`<name>-plan.md`** *(from M07)* | The stable plan for one milestone/epic. Owned by the **architect**. Scope, decisions, acceptance criteria, **Definition of Done**. Changes only on a real design change — **no status churn here**. |
| **`<name>-implementation.md`** *(from M07)* | The volatile **status ledger** for that epic. A claim/verdict table (below) + an append-only log. The **implementer** records claims; the **reviewer** records verified/refuted verdicts. |
| **`backlog.md`** *(from M07)* | One rolling, append-only parking lot for work **not attached to an open epic/spike**. Each item leaves by being **promoted** (→ spike/epic), **absorbed** (→ folded-into-EpicN), or **dropped** (explicitly). |
| **`logbook.md`** *(from M07)* | Append-only, dated log of cross-cutting **findings/gotchas** not tied to one task (environment, providers, real system behaviour). Backlog is *work to do*; the logbook is *facts we learned*. |
| **`implementer-pitfalls.md`** *(from M07)* | Append-only **case law** for the Implementer Rules of Engagement: reviewer-observed *behavioural* anti-patterns (hasty claims, misread scope, weakened bars), each as gist + concrete cases (stable `IP-N` ids). The logbook is *facts we learned*; this is *how we slipped*. Implementer skims it as part of the Rule-6 scope declaration; reviewer appends a case on every behavioural miss. |
| **(This) workflow doc** | The method itself, made explicit for reuse. |

Each doc is self-describing: status, author, date, and "Related" links at the top.

### 3b. Per-epic document pair + refinements/backlog (adopted from Milestone 07 onward)

**The pair.** Every **milestone/epic** (large unit) gets two docs: a stable `<name>-plan.md`
(architect-owned design + DoD) and a volatile `<name>-implementation.md` (status). This keeps the
plan clean instead of bloating it with review checkpoints. **Small units don't get the pair** —
everything is either a **spike** or an **epic**; there are no standalone "small stories."

**Naming (fixed).** The doc-type suffix is **always `-plan` / `-implementation`**, whatever the
unit is called (`milestone07-…-plan.md`, not `-epic.md`). `<name>` identifies the unit; the suffix
identifies the doc type — so the two always pair cleanly. Use `-plan`, never `-epic`, as the suffix.

**Claim/verdict table** — the core anti-drift device. The `implementation.md` mirrors the plan's
DoD as rows, each carrying an explicit, separately-authored status:

```
| Item (from the plan's DoD) | Implementer claim | Reviewer verdict            | Evidence            |
|----------------------------|-------------------|-----------------------------|---------------------|
| <DoD item>                 | done / wip / —    | VERIFIED ✅ / REFUTED ❌ /   | command + output /  |
|                            |                   | PARTIAL ⚠️ / not-checked    | file:line           |
```

Status ∈ {CLAIMED → VERIFIED ✅ / REFUTED ❌ / PARTIAL ⚠️ / BLOCKED ⛔ / not-checked}.
**BLOCKED ⛔** = verification could not be completed because of an **external** impediment (a dead
API quota, a missing credential, a flaky upstream) — **no code fault**. It is *not* REFUTED (that
means "the code is wrong"); it points to an entry in the **Impediments** space (§3c) carrying an
*unblock condition*. A BLOCKED row does not merge, but it is parked on a fact about the world, not a
defect. The implementer fills the
*claim* column; the reviewer fills the *verdict* column **only after running it** (principle 2),
with evidence. This structurally enforces rule 4a: a "done" claim cannot silently overwrite a
prior "not done" — the two columns coexist until the reviewer flips the verdict. On milestone
close, `implementation.md` freezes (it is the historical record); `plan.md` becomes the design
record. Merge/archive then to avoid drift (open question 5).

**Tasks & branches** — how work is sliced and committed. An epic is broken into **tasks** (the
smallest independently reviewable + mergeable unit; a.k.a. a "story"). Each task has an id
`<EPIC>-T<N>` and its DoD as claim/verdict rows in the epic's `-implementation.md`.
- The **implementer creates the branch** (off the current mainline) named
  **`<epic-lower>-t<N>-<slug>`** (e.g. `m07-t1-api-agent-driver`) — **branch creation is the
  implementer's responsibility, not the reviewer's** — and commits **claim-only** there: small,
  ideally one per DoD item. A commit records progress and makes the diff reviewable; it must **not
  self-close**: no ticking DoD boxes, no editing `CLAUDE.md`/`AGENT.md`, no "milestone complete".
- The **reviewer** verifies the branch **by running it**, fills the *verdict* column, and **merges
  to the mainline only when every row is VERIFIED — or explicitly DEFERRED** (the merge *is* the
  task's closure). REFUTED work stays on the branch and is fixed there. **The reviewer's only branch
  action is the merge — it never creates the branch.**
- **The mainline stays verified-only.** The branch is the claim; the merge is the verdict.

**Backlog gate — before opening any new macro unit (epic/task).** The architect/reviewer **reviews
`backlog.md` and dispositions every open item in the same pass**: promote (→ spike/epic), absorb (→
fold into this unit), drop (explicitly), defer (keep, with a trigger), or — for a one-off chore now
done — mark done and remove the line (git is the record). Rationale: an un-reviewed backlog is how
parked work silently rots (it violates §5 by omission). The gate is anti-oblivion, not control —
humans forget; the gate doesn't. A new macro unit doesn't start until its backlog pass is done.

**Refinements** are **not** a document type. A refinement is always one of three:
1. **Design refinement** → edit `plan.md` in place (the *Revise* step) + a status-log line.
2. **Work inside an open epic** → a row in that epic's `implementation.md` under a
   *Refinements / follow-ups* section (same claim/verdict discipline).
3. **Anything not tied to an open epic/spike** → a one-line entry in `backlog.md`, later
   promoted, absorbed, or dropped.

### 3c. Two more institutional spaces — impediments & implementer dissent (adopted 2026-06-20)

The claim/verdict table answers *"is the work done and correct?"* Two things it can't hold, and
that must not silently vanish (principle 5), get their own named spaces — **both live in the epic's
`implementation.md`** (volatile, per-epic; no new file — open question 5):

**(a) Impediments** — *the world got in the way.* External blockers that stop verification but are
**not** code defects (dead API quota, missing key, flaky upstream, sandbox limit). Format — a small
table:

```
| ID    | What blocked | Blocks (DoD row) | Status {open/worked-around/resolved} | Unblock condition |
```

An impediment makes the affected verdict **BLOCKED ⛔** (not REFUTED) with a pointer to its ID. It
closes only when its **unblock condition** is met (then the row is re-verified). This keeps "I
couldn't check it, and it's not the implementer's fault" visible instead of buried in an evidence
cell or laundered into a false "done".

**BLOCKED ≠ BLOCKING — a BLOCKED row may be *deferred*.** A blocked verification does **not**
automatically gate the task's closure. The human may **defer** a BLOCKED ⛔ row: the task closes on
its remaining rows, and the deferred verification moves to `backlog.md`. Deferral is allowed **only**
when *all* of these hold:
1. the verdict is **BLOCKED ⛔** (external impediment, no code fault) — **never** REFUTED or a
   defect-driven PARTIAL;
2. another **VERIFIED** row already covers the same behavior by a different route (e.g. a deterministic
   mocked test stands in for a quota-blocked *live* smoke), so closing doesn't ship something unproven;
3. the **human explicitly signs off**, and the backlog item carries a **reopen condition** — the
   concrete result that would force re-opening the task (e.g. "if the deferred live run fails or
   surfaces a defect → reopen TX").

A deferred row is recorded in `implementation.md` as **BLOCKED ⛔ → DEFERRED (backlog: …)** — it never
becomes VERIFIED retroactively; the historical record shows it was parked, not proven. Reopening on
the backlog's condition is normal, not a failure.

**(b) Implementer notes & deviations** — *the doer's voice.* The symmetric counterpart to the
reviewer's verdict column: the implementer's sanctioned channel to **dissent, deviate, or judge**,
instead of obeying-in-silence or deviating-in-silence (the latter is what produces surprise diffs).
Format — a table:

```
| ID    | Type {deviation/opinion/question} | Re: (DoD row) | What & why | Reviewer disposition |
```

- **deviation** — "spec said X, I did Y because Z." The reviewer **must** dispose of it
  (accept / reject → code changes / fold-to-backlog). This is the mirror image of REFUTED: as the
  implementer must answer every REFUTED, the reviewer must answer every deviation. A deviation that
  touches a **DO-NOT-TOUCH guardrail or changes established behavior** is **[BLOCK]-class** and also
  needs the human's confirmation (CLAUDE.md), regardless of merit.
- **opinion** — "the spec is fine but I think Z is better / I have a concern" → becomes a refinement
  row or a backlog item.
- **question** — "did you mean X or Y?" → routes to the human.

**Symmetry rule.** Neither column may ignore the other: every REFUTED gets an implementer answer;
every deviation/opinion gets a reviewer disposition. Nothing open vanishes silently (4a).

### 3d. The logbook — cross-cutting findings (adopted 2026-06-20)

`logbook.md` is an **append-only, dated** log of durable **findings/gotchas not tied to a single
task** — facts about the environment, providers, or the system's *actual* behaviour that future work
needs. It is the home for the *orphan finding* (mirror of the backlog, which is the home for the
orphan *task*).

- **One finding, one home.** A finding tied to an open task stays in that task's `implementation.md`;
  only cross-cutting ones go to the logbook. Backlog = *work to do*; logbook = *facts learned*;
  `plan.md` = *decisions*.
- **Append-only.** Never rewrite an entry — mark it **SUPERSEDED** with a pointer (git is the backstop).
- **Teeth (or it rots).** Skim the relevant entries **before starting related work**, and as part of
  the **backlog gate** (§3b). A write-only logbook is worthless; the read is the point.

---

## 4. The loop

```
   ┌─ Human sets scope/goal
   │
   ▼
  DRAFT  ──►  REVIEW  ──►  VERIFY (run the tools, reproduce)
 (Author)   (Reviewer)        │
   ▲                          ▼
   │                   CONSOLIDATE CAVEATS  (tag BLOCK/RESOLVE/NOTE)
   │                          │
   │                          ▼
   └──────────  REVISE  ◄── human relays caveats to Author
              (Author answers point-by-point in the doc)
                              │
                              ▼
                   RE-ASSESS  (Reviewer maps each caveat → RESOLVED/OPEN)
                              │
                  ┌───────────┴───────────┐
            BLOCK items open          all BLOCK resolved
                  │                         │
                  └──► iterate              ▼
                                   READINESS VERDICT  ──►  PHASED IMPLEMENTATION
                                                            (smoke test each phase)
```

Steps:
1. **Draft** — Author writes/updates the proposal.
2. **Review** — Reviewer critiques against the actual codebase and the design's own claims.
3. **Verify** — Reviewer runs the tools, records versions/commands/output, and reproduces
   the other side's experiments independently. Docs are corrected to match reality.
4. **Consolidate** — All open issues collected into the caveats doc, severity-tagged, with
   a suggested decision order.
5. **Revise** — Human relays the caveats; Author answers each point in the design doc.
6. **Re-assess** — Reviewer marks each caveat RESOLVED/PARTIAL/OPEN, mapped to sections,
   and surfaces any *new* residuals the revision introduced.
7. **Readiness gate** — Reviewer states explicitly whether we're ready to plan / start, and
   what gates the next step.
8. **Implement** — Small phases, riskiest-unknown-first, each with a smoke checkpoint;
   production behavior preserved behind a flag until a phase is proven. **(From M07)** the
   implementer records each phase's outcome as a *claim* row in `<name>-implementation.md`; the
   reviewer then **runs it** and flips the *verdict* column (VERIFIED/REFUTED/PARTIAL) with
   evidence (§3b). A phase is "done" only when its verdict is VERIFIED — never on the claim alone.
   Work is sliced into **tasks**, each on its own branch `<epic>-t<N>-<slug>`; the reviewer merges
   to the mainline only when all of a task's rows are VERIFIED (§3b *Tasks & branches*).

---

## 5. Why it has worked here

- The **empirical-verification** step caught doc-vs-reality gaps (e.g. a doc-cited 60s
  timeout that was not enforced in practice; a workspace-trust gate nobody had documented)
  that pure review would have missed.
- **Severity tagging + resolution mapping** turned a long list of objections into a short,
  trackable set of decisions, and made "are we done?" answerable.
- **Writing everything down** let two agents with no shared memory build on each other's
  work across many turns without losing context.
- The **readiness gate** prevents drifting into code before the load-bearing decisions are
  made, while still allowing isolated, zero-risk spikes to start early.

---

## 6. Open questions for review

1. **Role assignment.** Should Author/Reviewer roles be fixed per workstream, or keep
   alternating? Fixed roles add consistency; alternating reduces blind spots.
2. **Relay overhead.** The human is the sole channel between agents. Is that a feature
   (human stays in control, curates signal) or a bottleneck we should reduce (e.g. a shared
   "open questions" doc each agent reads/writes directly)?
3. **When to stop reviewing.** What's the explicit exit criterion for the review loop
   besides "all BLOCK items resolved"? Should PARTIAL items ever block?
4. **Verification depth.** We reproduced spikes independently. Is that always worth the
   cost, or only for [BLOCK]-class claims?
5. **Doc sprawl.** We now have proposal + capability note + caveats + this. At what point do
   these get merged or archived to avoid drift between them?
