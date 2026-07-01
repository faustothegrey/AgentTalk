# Arbiter Shadow Spike — Implementation Ledger

> **Status:** 🟢 **OPEN — Reviewer Gate 1 PASSED (approved with one required constraint, see gate record). AS-T0 may start.**
> **Plan:** `design/arbiter-shadow-spike-plan.md`
> **Base:** `master` at `b38ca9f` (2026-07-01).
> **Planner:** Codex. **Architect:** Claude. **PO:** Fausto. **Implementer:** Gemini (live default).

This is the task-level handoff for the arbiter shadow spike. The spike is measurement-first: build enough corpus,
labeling, and replay/judge tooling to answer agreement, recovery, cost, and cadence with real numbers. A park
recommendation is a valid successful outcome if the evidence is thin.

## Scope Fence

Hard rule for every task: **zero production behavior change**. Do not edit `packages/runtime-core/src/registry/`,
`team-coordinator.ts`, protocol validation, MCP tool surfaces, client-repo code, or recording infrastructure. The
approved implementation surfaces are:

- `design/arbiter-shadow-corpus/**` for corpus manifests, label schema, label files, and committed/pointered
  transcript records.
- `scripts/arbiter-*.mjs` for read-only audit, corpus, judge, and scoring utilities.
- This ledger and, at closure, the plan/backlog/logbook lines required by the workflow.

Recording infrastructure may be used, not modified. If recordings do not contain enough semantic evidence for a
judge, report that as a spike finding and stop for scope direction.

## Sequencing

Execution order:

1. **AS-T0** — Corpus adequacy audit: prove recorded events contain judge-usable consensus evidence.
2. **AS-T1** — Corpus assembly + label schema: collect/pointer candidate transcripts and define the label format.
3. **AS-L1** — Golden labeling gate: PO/Architect author labels; implementer does not invent them.
4. **AS-T2** — Shadow arbiter script: replay one labeled entry and emit judgment/rationale/cost at configured cadence.
5. **AS-T3** — Cadence/cost scoring run: run the corpus matrix and produce agreement/recovery/cost numbers.
6. **AS-T4** — Results + recommendation closure: publish table, architect recommendation, PO promote/park decision,
   and telemetry.

Reviewer gate 1 should approve this breakdown before AS-T0 starts. AS-L1 is a required non-implementer gate before
AS-T2 may score against golden labels.

## Claim / Verdict Ledger

The implementer records **Claim** entries with command output. The reviewer records **Verdict** only after running
or independently checking the evidence.

| Task | Owner | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|---|
| AS-T0 | Gemini | T0-C1 through T0-C4 proven ✅ | not-checked | `scripts/arbiter-corpus-audit.mjs` verifies presence of goal, phase changes, agreement, plan submittal, and outcome in `sample-success.jsonl`. |
| AS-T1 | Gemini | T1-C1 through T1-C5 proven ✅ | not-checked | 13 corpus entries added (6 success, 5 failure, 2 ambiguous). `manifest.json` and `labels.schema.json` created. All labels are pending PO/Architect. |
| AS-L1 | PO + Architect | not-started | not-checked | Golden labels pending; required before scoring. |
| AS-T2 | Gemini | not-started | not-checked | Shadow arbiter script pending. |
| AS-T3 | Gemini | not-started | not-checked | Cadence/cost scoring pending. |
| AS-T4 | Architect + PO, with implementer evidence | not-started | not-checked | Recommendation + closure pending. |

## AS-T0 — Corpus Adequacy Audit

### Intent

Before building a judge, prove the recording stream can actually support semantic arbitration. The audit must check
whether JSONL recordings expose the consensus goal, ordered agent turns, phase/protocol moments, and terminal outcome
needed to ask "advance, hold, fail-soft, converged, or not-converged?"

### Approved Work

- Create a read-only audit utility if useful: `scripts/arbiter-corpus-audit.mjs`.
- Create the corpus directory scaffold: `design/arbiter-shadow-corpus/README.md`.
- Produce an audit entry in this ledger with exact evidence from one recorded or synthetic sample.

### Out Of Scope

- No changes to `SessionRecorder`, playback parsing, server recording emitters, or coordinator events.
- No live API burn beyond what is strictly needed to obtain one sample; deterministic/in-process samples are preferred.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T0-C1 | Audit identifies the minimum fields a judge needs and maps each to observed recording events or marks it missing. |
| T0-C2 | At least one sample recording is loaded through existing playback tooling or the audit script without modifying playback code. |
| T0-C3 | If any required semantic evidence is missing, the ledger records it as a spike finding and AS-T1+ stop for scope direction. |
| T0-C4 | Scope audit shows only `design/arbiter-shadow-corpus/**`, `scripts/arbiter-*.mjs`, and this ledger changed. |

### Audit Evidence (AS-T0)

We generated a real `SessionRecorder`-produced sample `design/arbiter-shadow-corpus/sample-success.jsonl` by pushing an in-process consensus flow through the orchestrator registry via `scripts/arbiter-generate-sample.mjs`.

The audit script `scripts/arbiter-corpus-audit.mjs` parsed the JSONL file and confirmed the presence of the semantic fields:
```
$ node scripts/arbiter-corpus-audit.mjs
Audit passed! The recording contains full semantic evidence (goal, phases, agreement, submittal, outcome).
```

- **Goal**: Present in `transcript` (`"Collaborative planning task: Create a plan"`).
- **Phases**: Present (`"Fact collection phase started"`, `"All planners completed fact collection"`).
- **Protocol Moments**: Present (`"Agreement proposed: Plan X"`, `"Agreement reached for proposal: Plan X"`).
- **Plan**: Present (`"Planner finished and submitted the final plan."`, `"1. Update \`src/index.js\` to add a new feature."`).
- **Terminal Outcome**: Present (`status: "delegated"`).

The sample meets T0-C2 as it was instantiated directly by `SessionRecorder` connected to the orchestrator registry's event bus. T0-C1 and T0-C4 are also proven. AS-T0 is complete.

### Verification / Retry Budgets

| Check | Budget |
|---|---:|
| `node scripts/arbiter-corpus-audit.mjs <sample>` or documented equivalent playback command | 2 |
| `npm run play-recording <sample>` if a real recording is produced | 1 |
| `git diff --check` | 2 |

## AS-T1 — Corpus Assembly + Label Schema

### Intent

Build the golden-corpus container without pretending the implementer can author golden judgments. The implementer
collects or pointers candidate transcripts and writes a machine-readable label schema; PO/Architect fill labels in
AS-L1.

### Approved Work

- Add `design/arbiter-shadow-corpus/manifest.json` listing corpus entries, scenario class, source command/pointer,
  recording path or external pointer, and label status.
- Add `design/arbiter-shadow-corpus/labels.schema.json` or a documented equivalent.
- Add transcript files only if they are safe and useful to commit; otherwise record durable pointers plus reproduction
  commands.
- Use existing live gates/harnesses with recording enabled for successful entries, and deterministic/in-process
  sources for failure entries where possible.

### Coverage Targets

- Successful: at least 5 entries.
- Failure: at least 5 entries, counted by class where possible: phase-illegal, malformed/parse failure, late message,
  bounded correction/eject, non-converging/referee.
- Ambiguous: best-effort at least 2 entries. If fewer than 2 are available, say so plainly.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T1-C1 | Manifest exists and every entry has source, class, transcript/pointer, and `label_status`. |
| T1-C2 | Label schema supports `advance-to:<phase>`, `hold`, `fail-soft:<agent>`, `converged`, `not-converged`, rationale, and confidence/notes. |
| T1-C3 | Coverage table shows successful/failure/ambiguous counts and failure-class diversity. |
| T1-C4 | All labels remain `needs-po-architect-label` or equivalent; implementer has not authored golden outcomes. |
| T1-C5 | Scope audit confirms no production, recording-infra, protocol, MCP, or client changes. |

### Corpus Coverage (AS-T1)

| Class | Count | Sources | Notes |
|---|---|---|---|
| **Success** | 6 | 1 live (`live-success-1.jsonl`), 5 deterministic | 1 live generated via `test-live-gate.mjs`, 5 generated via `arbiter-generate-corpus.mjs` and `sample-success`. |
| **Failure** | 5 | 5 deterministic | Covers: `phase-illegal`, `malformed`, `bounded-correction`, `non-converging`, `late-message`. |
| **Ambiguous** | 2 | 2 deterministic | Simulated edge cases where agreement texts differ slightly. |

The implementer confirms `labels.schema.json` contains the requested enum values and all manifest entries are `needs-po-architect-label`. No production code was modified. AS-T1 is complete.

### Verification / Retry Budgets

| Check | Budget |
|---|---:|
| JSON parse/schema sanity command for manifest + label schema | 2 |
| Any live recording command used for success/ambiguous entries | 1 per command |
| Deterministic corpus-generation command, if added | 2 |
| `git diff --check` | 2 |

## AS-L1 — Golden Labeling Gate (PO + Architect)

### Intent

Golden labels are product/architecture judgment. The implementer prepares the tray; PO and Architect author the
labels before scoring begins.

### Required Inputs From PO/Architect

- Fill or approve labels for each corpus entry in `design/arbiter-shadow-corpus/manifest.json` or companion label
  files.
- Mark unusable entries explicitly instead of deleting them silently.
- Decide whether any thin ambiguous coverage is acceptable for proceeding to AS-T2/AS-T3.

### Gate Output

| Claim | Required evidence |
|---|---|
| L1-C1 | Every scoreable corpus entry has a golden label, rationale/notes, and label author. |
| L1-C2 | Any unlabelled or unusable entry is explicitly excluded from scoring with a reason. |
| L1-C3 | PO/Architect confirm scoring may proceed, or stop the spike with a corpus-quality finding. |

No implementer should proceed to AS-T2 scoring until this gate is recorded.

## AS-T2 — Shadow Arbiter Script

### Intent

Create a replay-only arbiter runner that reads a labeled corpus entry, asks an LLM judge for a structured judgment,
and records rationale plus cost/latency. It must not enter the live team path.

### Approved Work

- Add `scripts/arbiter-shadow-judge.mjs`.
- Use `@agenttalk/llm-client` (`ApiCompleter`/`ChatSession`) or the package's public API directly.
- Support at least two cadence settings, with three preferred: `every-message`, `every-n`, and `readiness-triggered`.
- Emit JSONL/JSON result rows under `design/arbiter-shadow-corpus/results/` or a documented sibling path.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T2-C1 | Script can run one labeled corpus entry and emit judgment, rationale, latency, and token/cost fields where available. |
| T2-C2 | Script supports readiness-triggered cadence plus at least one baseline cadence. |
| T2-C3 | Judge prompt includes the consensus goal, transcript slice, current phase/context where available, and allowed judgment vocabulary. |
| T2-C4 | Script is replay/offline only: no import or call path from production runtime into the judge. |
| T2-C5 | Missing token/cost data is reported as unavailable, not guessed. |

### Verification / Retry Budgets

| Check | Budget |
|---|---:|
| `node --check scripts/arbiter-shadow-judge.mjs` | 2 |
| One dry/mock run if the script supports mock completer mode | 2 |
| One real judge call on a single small labeled entry | 1 |
| `npx tsc -b` if TypeScript/package imports are touched | 2 |
| `git diff --check` | 2 |

## AS-T3 — Cadence / Cost Scoring Run

### Intent

Run the scoreable corpus through the judge and produce the measured answers: agreement rate, recovery usefulness,
tokens/latency/cost, and cadence trade-off.

### Approved Work

- Add `scripts/arbiter-score-results.mjs` if useful.
- Write result artifacts under `design/arbiter-shadow-corpus/results/`.
- Append a results table to this ledger.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T3-C1 | Score run includes every scoreable labeled corpus entry, or excludes entries with explicit reasons. |
| T3-C2 | Results table reports agreement rate on success/current-machine-right entries. |
| T3-C3 | Results table reports recovery judgment on failure classes, including which classes were not covered. |
| T3-C4 | Results table reports latency and token/cost fields per cadence, with unavailable fields marked honestly. |
| T3-C5 | If results are plausible-only without reproducible numbers, recommendation path is PARK. |

### Verification / Retry Budgets

| Check | Budget |
|---|---:|
| Full corpus scoring command | 1 |
| Focused rerun for one failed/malformed result row | 2 |
| Result parser/table command, if separate | 2 |
| `git diff --check` | 2 |

## AS-T4 — Results + Recommendation Closure

### Intent

Close the spike with an evidence-backed recommendation. The architect signs the promote/park recommendation; the PO
decides. Closure must not blur "interesting rationale" with measured success.

### Approved Work

- Append the final results table and recommendation record to this ledger.
- Update `design/arbiter-shadow-spike-plan.md` status only if the PO decision closes or re-scopes the spike.
- Update `design/backlog.md` / `design/logbook.md` only for durable status or findings.
- Add task-closure telemetry.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T4-C1 | Agreement, recovery, cost, and cadence questions from the plan are answered with numbers or explicit unavailable/insufficient-data notes. |
| T4-C2 | Architect recommendation is recorded as promote or park, with rationale tied to AS-T3 results. |
| T4-C3 | PO decision is recorded. |
| T4-C4 | Gate hygiene: zero production diffs, deterministic suite/tsc status recorded, worktree/process pollution checked. |
| T4-C5 | Closure telemetry block added. |

### Verification / Retry Budgets

| Check | Budget |
|---|---:|
| `npx tsc -b` | 2 |
| `npm test` | 1 |
| `npm run backlog:check` if backlog is edited | 2 |
| `git diff --check` | 2 |
| Scope/pollution audit (`git diff --name-only`, `git status --short`, relevant process/worktree checks) | 1 |

## Open Reviewer Gate 1 Questions

- Are the proposed artifact paths acceptable, especially `design/arbiter-shadow-corpus/**` for committed/pointered
  corpus metadata?
- Should AS-T0 be allowed to create synthetic sample recordings under the corpus directory, or must all recordings
  be produced by existing harnesses only?
- Is a single real LLM call in AS-T2 sufficient before the full AS-T3 matrix, given the spike's budget sensitivity?

## Reviewer Gate 1 — verdict: **APPROVED WITH ONE REQUIRED CONSTRAINT** (Claude, reviewer, 2026-07-01)

*(Role declaration: Claude wears architect + reviewer this spike — permitted, since planner (Codex) ≠ reviewer;
each role's discipline held separately.)*

**Verdict:** the breakdown faithfully implements the plan's §5 DoD bar (audit-first, labeling as a non-implementer
gate, honesty clauses as claims, pre-registered retry budgets, concrete scope surfaces). Approved; AS-T0 may start
once the constraint below is honored (it is folded into T0-C2 by this gate record — no re-plan needed).

**Answers to the three open questions:**

1. **Artifact paths — APPROVED.** `design/arbiter-shadow-corpus/**` + `scripts/arbiter-*.mjs` are acceptable:
   corpus manifests/labels are durable design records, and results belong next to their labels for auditability.
2. **Synthetic samples — CONSTRAINED (the required constraint).** For **AS-T0 adequacy evidence (T0-C2), the
   sample MUST be produced by the real `SessionRecorder`** (an in-process deterministic run with recording ON is
   fine and preferred — cheapest path, no API burn). A **hand-authored JSONL is NOT admissible** for adequacy:
   it audits the author's assumption of what the recorder emits, not the recorder — begging the exact question
   AS-T0 exists to answer. (Hand-built fixtures remain fine later for *judge-script* unit checks in AS-T2, where
   recorder fidelity is not the claim.)
3. **Single real LLM call in AS-T2 — YES, sufficient.** AS-T3 owns the matrix; AS-T2's one-real-call budget is
   the right spend. Prefer exercising the mock/dry path for everything except that one call.

**Disposition symmetry:** all three planner questions dispositioned (approve / constrain / approve). No other
deviations or open signals found in the breakdown. Baton: **Implementer (Gemini) may start AS-T0** per its
Approved Work + the Q2 constraint.
