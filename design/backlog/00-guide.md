# Backlog — the project's ordered task list

**What the backlog IS (PO definition, Fausto, 2026-07-02 — supersedes the "parking lot" model):**
the ordered task list of the project — **tasks done, the task being worked on, tasks intentionally
parked (with a reopen condition), and tasks to be done next, in sequence.** An item has exactly
one of **five states — `todo · doing · deferred · done · dropped` — period.** Where a task came from (an epic it fathered, an item it was folded into, the trigger it
waits on) is the **description's** job, not a state. The file order IS the timeline: **done history
**done history on top, the single `doing` item after that, then `deferred` items (in trigger-priority order), then the `todo` queue below in planned order.**
item is `doing` at a time. A refinement that belongs to an open epic goes in that epic's
`implementation.md` instead, not here. Canonical statement: `design/collaboration-workflow.md` §3b.

**Backlog gate (workflow §3b):** before opening any new macro unit (epic/task), the
architect/reviewer reviews this file and **dispositions every `todo` item** in the same pass — so
nothing rots by being forgotten.

**Entry format:** `- [STATUS · free notes] — <what> — <why>` where STATUS ∈ {todo · doing · done ·
dropped} and the notes after `·` are free text (provenance, triggers, dates).

**Machine-readable header (M13, required for todo/doing).** Each item carries a header comment
directly above its bullet so the backlog can be served via API (`GET /api/backlog`) and rendered in a UI.
It is an HTML comment (invisible when the markdown renders) and the prose bullet below stays the human
record, unchanged:

```
<!-- @item
id: BL-NNN            # stable, never reused; next id = max existing + 1
status: todo          # todo | doing | done | dropped | deferred — nothing else
date: YYYY-MM-DD      # optional
epic: M08 | null      # optional owning/target epic
promoted_to: X | null # optional lineage: the epic/spike this item became
tags: [a, b]          # optional; free labels for UI filtering
blocked_by: [BL-NNN]  # optional; ids that must be done/dropped first. Default []
autonomy: eligible    # optional; eligible | human-only | po-decision. DEFAULT human-only
-->
```

**`autonomy` (BL-093) fails CLOSED — an item that does not say it is eligible is not eligible.** The field
is **advisory readiness metadata since [[BL-134]] — it does NOT gate anything.** The workable set is
`status: todo` + every `blocked_by` resolved, and nothing else; what stops an agent being handed work is the
PO-authorized launch file ([[BL-137]]), not this field. Absent or unrecognised is simply unset. Express a real
fence as `blocked_by` instead: it names its reason as a filed item and releases itself when that item closes.
`po-decision` is **RETIRED** as a value — a question is not a task, so such items are `status: deferred`.
`eligible` = boundable, handable to an agent unattended. `human-only` = real work, but it carries a behaviour change to fence, needs
judgement the item does not encode, **or its execution would itself mean launching a session** (the OPERATOR
charter's no-recursion rule — a judgement no parser can make, so it rests on whoever files the item and is
re-checked at each §3b gate). `po-decision` = the item's resolution *is* a PO call, not agent work.
`blocked_by` is resolved only when every id it names is `done` or `dropped`; a dangling, self- or circular
reference **fails `backlog:check`**. Selector view: `GET /api/backlog?workable=true`.

The **header is authoritative for the API**; if it disagrees with the prose `[STATUS]` tag the parser
emits a drift warning (surfaced at the §3b gate). Validate with `npm run backlog:check` after any edit.
Parser + endpoint: `apps/orchestrator/src/backlog.ts`. **The API's default view is the live queue only
(`doing` + `todo`); `GET /api/backlog?all=true` includes `done`/`dropped`** (the UI's future
show-done/show-dropped toggles ride this param). The response's `total` field always counts all items.

---

### PO directive — 2026-07-27: park everything not instrumental to "AgentTalk within AgentTalk"

**Directive (PO, in session):** *"defer everything that is not instrumental to reach the goal of AgentTalk within
AgentTalk."* Applied the same day, immediately after the §3b gate below. **The goal it is measured against** (PO,
2026-07-27): *run AgentTalk's own development inside an AgentTalk session, the in-session agent inheriting the
configuration built up so far; a single agent that plans, implements and reviews alone is fine for now; replacing
the human-in-the-TUI is the point.*

**Result: the live queue went from 15 `todo` to 3.** Everything parked carries a **reopen condition** (§3b requires
one — a park without a trigger is just rot), written into each item's status tag.

**KEPT — instrumental:**

| Item | Why it survives the cut |
|---|---|
| [[BL-084]] (typed error reason) | An unsupervised agent that fails must be **detectable**. Today in-process errors do not propagate at all, so a failing autonomous worker leaves its team silently stuck. Planned: `design/archive/bl084-plan.md`. |
| [[BL-028]] (dead idle timeout) | **Nothing detects a hung agent** — the wall-clock cap is the only rail. For unsupervised runs a hang burns time and provider budget invisibly. Blocked behind BL-084. |
| [[BL-086]] (client repo has no governance) | **NEW, filed under this directive.** A worker launched in `agentalk-mcp-client` inherits no rules, yet the launcher/executors/bridge that *run* the ladder live there. Until decided, client-repo tasks are human-only. |

**PARKED — 13 items, each with its trigger:** BL-024 (client-shape leak) · BL-025 (live-proof A/B baseline —
reopens at the next rung verdict, i.e. **soon**) · BL-029 (agent rating signal — needs >1 agent) · BL-034
(PTY-tee panel) · BL-035 (Tester artifacts) · BL-038 (goose+OpenRouter lane) · BL-042 (goose consensus recipe) ·
BL-043 (heterogeneous arbiter) · BL-044 (API multi-agent consensus — reopens when the goal moves past a single
agent) · BL-050 (Team-view identity) · BL-068 (id convention) · BL-070 (client test flake) · BL-079 (sourcemap
noise).

**Two judgement calls the PO may want to overturn** — flagged rather than buried:
1. **BL-025 parked, and it is the closest call.** "A proof that cannot fail is not evidence" is the highest-value
   lesson of M18, and rung verdicts depend on it. I parked it because the *discipline* is already being applied by
   hand (bar written before the fix, mutation-checked, precondition-guarded — all three used today), so it does
   not need an open item to happen. Its trigger fires at rung 6 regardless.
2. **BL-044 parked** on the strength of *"a single agent is fine for now"*. If multi-agent returns to the plan,
   this is the item that unparks first — it reports the whole API consensus path as non-functional, and it is
   **the largest un-audited claim in the backlog** (see the gate below).

### Backlog gate — 2026-07-27 (before planning BL-084 · planner+reviewer: Claude, sole-agent fallback · PO directed the pass)

Per §3b, all **16** `todo` items dispositioned before opening [[BL-084]]. **Claims were checked against the code,
not read off the file** — this backlog has produced phantom items before (LB-47), and this pass found **one
genuinely stale item, two overstated ones, and three stale line-number citations**. Verification notes are in the
table; anything I did **not** re-verify says so.

| Item | Disposition for this gate |
|---|---|
| [[BL-084]] (typed non-reply reason) | **stay `todo` → the next unit.** PO directed planning; it unblocks BL-078 + BL-028. |
| [[BL-028]] (idle timeout) | stay `todo`, **blocked on BL-084**. **RE-VERIFIED still dead:** `lastProgressAt` declared (`agents/agent.ts:32`), read twice (`registry.ts:781`, `:785`), **written nowhere**. ⚠️ its cited `registry.ts:663` is **stale** — my BL-083 additions shifted it. Status left `todo` not `deferred` — a **PO call** (it is genuinely blocked). |
| [[BL-045]] (agy attach healthcheck) | **CLOSED → `done` this pass — the premise is superseded.** LB-93 found the root cause: bare `agy --print` = 9.65s, live worker turn ~14s, **comfortably under the 30s default**, so the feared provider-specific 90s timeout is unnecessary — and **absent from the code** (no `90_000`/`90000` anywhere in `packages/`/`apps/`). Its own residual blocker (*"production remains one env var short → BL-057"*) is **`done`**: BL-057 deleted the flag entirely. What remains is a **verification gap, not the filed defect** — a real `start_pair_chat` was never exercised — recorded as the reopen condition. |
| [[BL-079]] (client sourcemap noise) | stay `todo` but **the claim is OVERSTATED and corrected in the item**: not "every `lib/*.mjs`" and not "a wall of errors" — **4 of 10** files carry a dangling `sourceMappingURL`, and a real `npm test` emits **4** matching lines (suite 93/93 green). Real, trivial, no longer justified by the "buries a real error" argument. |
| [[BL-024]] (brain leaks client shape) | stay `todo`, **RE-SCOPED — partly landed already.** The two-axis split exists: `AgentTransport` (`types.ts:44`), `normalizeAgentKind`, and `bl024-transport-vendor.test.ts`. Remaining work is retiring `AgentProvider`/`legacyProvider` from the surfaces that still carry it (`types.ts:65, 75, 145, 205`). ⚠️ cited `types.ts:13` is **stale** (now `AgentStatus`). ⚠️ its T3b plan was **untracked, on the PO's machine alone** — now committed (2026-07-27) with a PARKED banner, since its "PO greenlit 2026-07-18" line is superseded by the same-day directive: `design/archive/bl024-t3b-plan.md`. |
| [[BL-070]] (client test flake) | stay `todo`, low priority. Test still present (`agentalk-mcp-client/__tests__/exec-rpc.test.ts:199`); client suite **93/93** green, so still "reproduce-or-park", not reproduced this pass. |
| [[BL-044]] (API multi-agent consensus non-functional) | stay `todo` — **NOT re-verified this pass.** Its three-stacked-walls claim needs a live run with real keys; I did not do one, so it is neither confirmed nor refuted here. **The largest un-audited claim in the queue.** |
| [[BL-068]] (id convention unenforced) | **propose `deferred`** — the PO already chose *"file the findings, build nothing"* (2026-07-1x), which is a park, not a queue item. Reopen when the cross-repo contract change becomes PO scope. **PO call; not changed unilaterally.** |
| [[BL-025]] · [[BL-029]] · [[BL-035]] | stay `todo` — standing method/process items (A/B live-proof baseline · reassignment signal · tester artifacts). None blocks BL-084. |
| [[BL-034]] · [[BL-038]] · [[BL-042]] · [[BL-043]] · [[BL-050]] | stay `todo` — feature/experiment queue (PTY-tee panel · goose+OpenRouter lane · goose consensus recipe · heterogeneous arbiter · Team-view identity). Untouched, none blocking. |

**Two gate observations for the PO, deliberately NOT filed** (filing is a PO act):
1. **`agentalk-mcp-client` carries no governance file** — verified: no `AGENT.md`/`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`
   at its root. A worker launched there inherits **nothing**, which structurally confines every governed
   autonomous run to the AgentTalk repo (it is why rung 5 had to be an AgentTalk task). Worth a decision.
2. **`task-BL-039` is still unmerged** and carries a real fix (`313d089`, `providerName` forwarding), across
   several sessions now. Merge it or fold it into the backlog.

**Closed today, for the record:** [[BL-083]] (merged `bf83811`), [[BL-085]] (merged `f1d5b95`), and [[BL-078]]
decided → `deferred` on BL-084.

### Backlog gate — 2026-07-11 (M20 inception · architect: Claude · PO direction in session)

Per §3b, dispositioned before opening **M20 — The brain routes, you approve** (the self-hosting transition's first
operational step). **PO direction (in session):** the brain routes agent↔agent messages autonomously but **holds each
delivery for the PO's one-click yes/no**; mechanism now, per-message consent relaxed later, slowly, checking.
Architect ratified it as a better first step than shadow-mode (keeps the PO the reference clock, cuts burden
immediately, defers the wake unknown). Grounded feasibility: interpose at `registry.ts:437-443`. Full inception:
`self-hosting-program-draft.md` §M20.

| Item | Disposition for this gate |
|---|---|
| BL-030 (PO-approved relay) | **NEW → `doing`** — M20's driver. |
| BL-018 / BL-026 / BL-027 | `done` (M19 closed 2026-07-11). |
| BL-028 (typed non-reply / wake) | stay `todo` — **adjacent**: becomes the dependency when M20's dimmer relaxes toward autonomous delivery (M20 defers autonomous wake; the PO's *yes* is the delivery trigger for now). |
| BL-022 / BL-023 / BL-024 / BL-025 | stay `todo` — general substrate constraints; not pulled into M20's smallest bite. |
| BL-029 (rating signal) | stay `todo`, deferred post-transition. |
| BL-014 / BL-015 / BL-016 | stay **deferred** — M20 gates manually (PO), so their triggers (system-enforced fences/briefs) are still unmet. |

### Backlog gate — 2026-07-11 (M19 inception, 2nd pass · architect: Claude · planner POV: Codex · PO ruling in session)

Per §3b, the second-pass M19 gate — the one LB-71 deliberately deferred until **SP2's answer was in hand**. SP2
closed **ATTACH-BLOCKED → BL-026** (`design/archive/spike2-consensus-real-cli-implementation.md`): two real CLIs cannot yet
coordinate — Codex reaches `await_turn`; Claude's non-interactive tool-permission gate denies it; the client
wire-contract is stale (v5 vs server v7); attached CLIs register `provider:mcp`.

**Inception (PO + Architect, planner advisory POV from Codex).** M19's first duty is M18's deferred **C3** (a real
substrate-carried relay fall + the BL-027 ratio). SP2 forced a feasibility fork; architect and planner **converged
on C-first, never B** (SDK clients may only *rehearse* the substrate, labeled and counted separately — they do
**not** discharge C3). **PO ruling (`[PO]`, 2026-07-11): Fork C-first, with narrow-A conversion pre-authorized iff
T1 proves cheap** — i.e. M19 is the attach *enabler*; if T1 (contract-align + Claude-permission) proves affordable,
M19 also runs a minimal real relay for a first honest ratio, else C3 defers to M20. Two planner refinements the
architect adopted: **BL-018 scoped to contract *alignment / fail-fast*, not full negotiation**; **BL-024 stays a
recorded constraint, not folded** (full provider split remains out of M19 scope — unchanged from the 2026-07-10 gate).

**M19 shape:** **T1 = BL-018-lite** (contract alignment / fail-fast; hard prerequisite) → **T2 = BL-026** (supported
attach ritual + prove Claude `--allowedTools`/`--permission-mode` pre-approval early). Ladder entry + full inception
block: `design/self-hosting-program-draft.md` §M19. Next act: the planner authors the M19 plan → Gate 1 (reviewer ≠
planner). Concentration noted (architect+SM+plan-reviewer = Claude); the PO ruled the fork personally.

| Item | Disposition for this gate |
|---|---|
| BL-027 (relay ratio) | `doing` — **is** M19's metric; C3 remains its reopen condition. Unchanged. |
| BL-018 (contract) | **deferred → todo**, `epic: M19` — **M19-T1**, scoped to alignment/fail-fast. Reopen condition MET (SP2 = the recurrence that bit again). |
| BL-026 (attach ritual) | `todo`, `epic: M19` — **M19-T2** (after T1). SP2 wrote the runbook half; production template/script + permission proof remain. |
| BL-024 (provider conflation) | **unchanged — out of M19 scope** (2026-07-10 ruling holds); SP2 **confirmed** `provider:mcp`; stays a recorded constraint. |
| BL-025 / BL-022 / BL-023 / BL-028 | stay `todo` — **binding constraints / relevant** to M19 (proof A-B + fresh recorder; cross-repo scope-check; leaked-process detection; the `awaiting-input` vs dead distinction if real CLIs wait). |
| BL-029 (rating signal) | stay `todo`, deferred post-M19 (needs the data M19 produces). |
| BL-014 / BL-015 / BL-016 | stay **deferred** — reopen conditions unmet (BL-014 needs real substrate coordination *first*; still 0 real hand-offs). |

### Backlog gate — 2026-07-09 (opening M18 · SM: Claude, PO go `[PO]` in session)

Per §3b, dispositioned before opening **M18 — Self-hosting milestone** (the program's flywheel-first-turn
epic, 3 of M16→M18). Inception: `design/self-hosting-program-draft.md` §M18 **INCEPTION** block
(PO+Architect, 2026-07-09 — T1=BL-015-L0 shakedown · T2=BL-020 · T3=BL-017; C3 reworded to
relay-recorded/falls-after-T3). Planner advisory POV delivered same day (PO-relayed, recorded in the draft):
endorses the sequence; T3 must extend the existing `send_to_agent` argument path (new tool ⇒ BL-018 reopen ⇒
PO escalation); architect verified the POV's three file-level claims against both repos. SM go/no-go reason
(durable, per the SM grant): inception + POV aligned with no open feasibility question, no competing `doing`
item, budgets healthy (claude 33% / codex 31% / gemini 26% weekly at gate time).
Plan authored after the gate: `design/archive/milestone18-self-hosting-plan.md` (Gate 1 review: Claude).

| Item | Disposition for this gate |
|---|---|
| **BL-021** (new) | **NEW `doing`** — M18 itself (the single doing item). |
| **BL-015** | Stays `todo` — **L0 absorbed into M18-T1** (the guinea-pig shakedown); the item remains open for L1/L2, which stay gated at M19 with BL-014 (pulling them into T1 is an automatic Gate-1 hand-back). |
| **BL-020** | Stays `todo`, **absorbed into M18-T2** — flips `done` when T2 merges. |
| **BL-017** | Stays `todo`, **absorbed into M18-T3** — flips `done` when T3 merges (re-gate condition from the M17 record: satisfied — this IS the M18 re-gate). |
| **BL-018** | Unchanged — deferred; reopen condition live for T3 (a new tool would bump the contract hash — escalate to the PO before plan authoring). |
| **BL-014 / BL-016** | Unchanged — BL-014 re-gates at M19 (now paired with BL-015 L2); BL-016 stays deferred on PO call. |
| **BL-005 / BL-007 / BL-010** | Unchanged — deferred; none touched by M18's fence. |

*Nothing dropped. DiagramTalk repair stays a droppable rider-if-genuinely-cheap after T3 (not a backlog item; named in the draft §M18).*

### Backlog gate — 2026-07-09 (opening M17 · SM: Claude, PO go in session)

Per §3b, dispositioned before opening **M17 — The gate over the channel** (self-hosting program epic 2 of
M16→M18). Inception: `design/self-hosting-program-draft.md` §M17 **INCEPTION** block (PO+Architect,
2026-07-09 — fence + two dispositions). Planner advisory POV delivered same day (PO-relayed): the C1 live
proof runs on **direct SDK MCP clients** — BL-017 need not enter the fence; recommendation to open for plan
authoring. SM go/no-go reason (durable, per the SM grant): inception + POV both landed, the one open
feasibility question (BL-017 in/out) is answered, no competing `doing` item, budgets healthy (all providers
≤17% weekly at gate time).

| Item | Disposition for this gate |
|---|---|
| **BL-017** (new at inception) | Stays `todo` — **confirmed out of M17's fence** by the planner POV (the live proof does not structurally require it). Re-gate at M18 inception. |
| **BL-018** (new at inception) | Unchanged — deferred; reopen condition (a contract bump recurs) untouched by M17, which may add a version label only. |
| **BL-014 / BL-015 / BL-016** | Unchanged — BL-014 re-gates after M17 evidence (ruled 2026-07-08); BL-015 L0 stays an M18-rider candidate; BL-016 stays deferred on PO call. |
| **BL-005 / BL-007 / BL-010** | Unchanged — deferred; none touched by M17's fence. |
| **BL-019** (new) | **NEW `doing`** — M17 itself (the single doing item). |

### Backlog gate — 2026-07-08 (opening M16 · SM: Claude, PO go in session)

Per §3b, dispositioned before opening **M16 — One real baton** (self-hosting program M16→M18; inception
artifact `design/self-hosting-program-draft.md`, PO↔Architect 2026-07-02, planner advisory POV recorded).
First gate under the **2026-07-08 governance model**: reviewer split into three seats, role-only docs with
the single bindings table (`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`), role tags `[PO]`/`[SM]`, SM handed
Codex → Claude (commit `789850d`). SP-WAKE layer (a) **PASS** (600 s idle `await_turn` wake in 3 ms) fixes
M16's shape: **blocking `await_turn`**; pull-on-poke demoted to declared fallback.

| Item | Disposition for this gate |
|---|---|
| **BL-005 / BL-007 / BL-010** | Unchanged — deferred; none touched by M16's fence. Re-examine when the flywheel starts filing friction items (M18's true DoD). |
| **Todo queue** | Empty at gate open — nothing else to disposition. |
| **BL-013** (new) | **NEW `doing`** — M16 itself (the single doing item). |
| **BL-014** (new) | **NEW `todo`** — role-skill injection, ruled **M19 candidate** at this gate (options per the draft: M18 rider / M19 candidate / parked). Not an M18 rider — it structurally rides M17's session→identity→role mapping, which doesn't exist yet; not parked — the PO wants it in durable memory. Re-gate after M17 evidence. |

*SP-WAKE layer (a2) (overnight-scale idle probe): **SKIPPED** (SM rec, PO in session) — M16's live proof
exercises realistic idle against the real orchestrator anyway; a separate probe is ceremony (program risk #3).*

### Backlog gate — 2026-07-02, second gate (opening M15 · architect: Claude)

Per §3b, dispositioned before opening **M15 — Arbiter Consensus, Direct Path**
(`design/archive/milestone15-arbiter-consensus-plan.md`). Context: **PO direct decision in session** — preserving the
protocol machine byte-identically while extracting (M14's approach) proved too costly in practice; M15 builds
a **parallel ArbiterCoordinator** and freezes (not removes) the protocol path. Inception ceremony compressed
by PO: direct PO↔Architect discussion in session replaces the formal inception doc round; Planner advisory
POV (Codex) still runs before breakdown.

| Item | Disposition for this gate |
|---|---|
| **BL-011 M14** | **CLOSED as done-partial:** T1 delivered & merged (`36fa888`) — the identity harness now pins the frozen protocol path; T2/T3 superseded before start (PO). agy stood down cleanly; empty T2 branch deleted. T1b deprioritized (harness demoted to rare use). |
| **BL-010 parked judge work** | **PARTIALLY ABSORBED → M15-T2:** the vocabulary gloss + judge-frame line (probe-proven) become part of M15's judge wiring. Transport fix (gemini-as-judge) + second-model spot-check **stay deferred** — reopen if/when the judge model choice is revisited. Shadow wiring is **superseded** (the arbiter is now primary, not shadow). |
| **BL-005 / BL-007** | Unchanged — deferred, not arbiter-adjacent. |
| **BL-012** (new) | **NEW `doing`** — M15 itself (the single doing item). |

*Judge model decision (PO, this gate): `gpt-4o-mini` via OpenRouter (spike-proven, temp 0, cents).*

### Backlog gate — 2026-07-02 (opening M14 · architect: Claude)

Per §3b, every item dispositioned before opening **M14 — Facilitator Extraction (Arbiter Epic 1)**,
plan at `design/archive/milestone14-facilitator-extraction-plan.md`. Inception closed by the PO in session
(2026-07-02): **leaner scope — extraction only; all judge-touching work parked**; naming = milestone
series (M14); BL-008 residual absorbed; BL-003 superseded; BL-010 confirmed; the pending BL-002 drop
committed with this gate record.

| Item | Disposition for this gate |
|---|---|
| **BL-001 / BL-004 / BL-006 / BL-009** | Terminal (done) — confirmed, no action. BL-009's promotion completed: the spike closed PROMOTED (`a905b2e`); M14 is the program's first epic. |
| **BL-002 auto-handoff** | **Dropped** (PO, 2026-07-02) — not a separate item; handled step by step in the normal workflow. The drop edit sat uncommitted in the work tree since the decision; committed with this gate record. |
| **BL-003 M07-T2 live smoke** | **DROPPED — superseded** (PO ratified at this gate, per the standing recommendation): the strict-protocol live bar it guards is exactly what the arbiter direction replaces; semantic advancement judgment makes the old bar moot. |
| **BL-005 worker-prompt worktree** | Unchanged — deferred with explicit trigger. Not arbiter-adjacent. |
| **BL-007 operator abort/recovery** | Unchanged — deferred, experience-triggered. Not arbiter-adjacent. |
| **BL-008 residual** (two protocol event-emission shapes) | **ABSORBED → M14 scope** (PO, this gate) — the extraction refactors exactly that surface; unification gets its own DoD row + the replay-diff bar. Closes the "compose with arbiter Epic 1" reminder from the 2026-07-01 gate. |
| **BL-010** (new) | **NEW `deferred`** — the spike's parked judge qualifications (ladder re-measure w/ numeric bar, `llm-client` transport fix, shadow wiring, second-model spot-check). Reopen condition: the §3b gate that opens the next arbiter epic. |
| **BL-011** (new) | **NEW `doing`** — M14 itself (the single doing item). |

*Nothing else touched.*

### Backlog gate — 2026-07-01 (opening the arbiter shadow spike · architect: Claude)

Per §3b, every item dispositioned before opening the first arbiter macro unit (the shadow-mode spike,
`design/archive/arbiter-shadow-spike-plan.md` — inception draft, pending Planner POV + PO go). PO (Fausto) directed the
groundwork this session; ratification calls are marked.

| Item | Disposition for this gate |
|---|---|
| **BL-001 / BL-004 / BL-006 / BL-008** | Already terminal (done/promoted/absorbed) — confirmed, no action. Note on BL-008: its residual debt (two protocol event-emission shapes) sits exactly on the surface the future facilitator-extraction epic touches → carry a "compose with arbiter Epic 1" reminder there. |
| **BL-002 auto-handoff** | **Reopen trigger FIRED** (M11 closed). Architect recommendation: **absorb into the arbiter program** — the facilitator ("the push") is the natural owner of turn-driving, making a separate auto-handoff epic redundant. **PO deferred the ratification (2026-07-01)** → stays `deferred`; **re-raise at the gate that opens arbiter Epic 1**. |
| **BL-003 M07-T2 live smoke** | Blocker half-lifted (M11 shipped tolerance; quota gate remains). Likely **superseded** by the arbiter direction (the arbiter judges advancement semantically, making the old strict-protocol live bar moot). Keep `open`/parked; final supersede-or-run call when arbiter Epic 1 opens. |
| **BL-005 worker-prompt worktree** | Unchanged — parked with explicit trigger (orchestrator collecting worker output). Not arbiter-adjacent. |
| **BL-007 operator abort/recovery** | Unchanged — experience-triggered (needs real `awaiting_operator` cases). Not arbiter-adjacent. |
| **BL-009 semantic arbiter** | **PROMOTED → arbiter shadow spike** (`design/archive/arbiter-shadow-spike-plan.md`). The program decomposition (spike + 4 epics) stays in `design/arbiter-consensus-draft.md` §8/§10; only the spike opens now. |

*Nothing dropped.*

## Items

### ✅ DONE — M09 epic-close squash (Fausto, 2026-06-25)

- **[done] 2026-06-25 — SQUASHED the history at epic close (Fausto, explicit; confirmed scope = whole history).**
  D6's "no legacy token anywhere, including git history" is now fully satisfied. Fausto chose to go **beyond** the
  originally-recorded M09-only recipe: the whole 201-commit history was collapsed into a **single clean root
  commit** (`565ad3d`), because the old provider token also lived in M07/M08 commit messages, not just M09.
  Method: orphan branch with byte-identical tree → `push --force` (public repo) → pruned the dead `m09-t1/t2/t3`
  and `m08-*` branches (local + remote). Gate at squash: tsc 0, suite 183/183. Known side effect: short-hash
  citations in `design/*.md` no longer resolve (inherent to any history rewrite). Agent memory
  `m09-squash-at-epic-close` deleted as satisfied.

### M10 follow-ons (post DiagramTalk bridge-v2)

- **[done] 2026-06-26 — M10-T4 API-path protocol enforcement — MERGED to `master` (`d0462b6`).** Shipped:
  structured API turns send an OpenAI-compat `respond(message_type, message_payload)` tool with
  `tool_choice:"required"` + a strict `enum` derived from `STRUCTURED_MESSAGE_TYPES`, so an off-list
  structural action is unrepresentable at generation time. Decisions (Fausto): D-T4-1 static enum ·
  D-T4-2 declare-unfit (no `json_object` fallback) · D-T4-3 keep `response_format`. Deviation: generic
  `message_payload` (enum is the guarantee; `validatePayload` is the net). Gate: tsc 0, 213/213. Record:
  `design/archive/milestone10-t4-api-enforcement-plan.md` + ledger §T4 + **LB-25**. *(Sibling T3 single-tool
  `consensus_respond`, v5→v6 cross-repo, stays deferred per D3.)*

- **[done] 2026-06-27 — M10-T4 live-verification probe — VERIFIED ✅ (reviewer-run), endorsed for merge.**
  `scripts/probe-t4-api-tools.mjs` sends one cheap real `/chat/completions` per provider with the exact T4 combo
  (`tools`+`tool_choice:'required'`+`response_format:{type:'json_object'}`) and classifies by HTTP response.
  **Measured findings (LB-46, reproduced independently by Claude):** `openrouter`/gpt-4o-mini = **fit**;
  `google`/gemini-2.5-flash = **http_reject 400** (ANY-mode + JSON mime explicitly unsupported);
  `nous`/deepseek-v4-flash = **http_reject 404** (default model missing — see LB-1). Script-only, zero production
  change; tsc 0, suite 245/245. Plan `design/archive/milestone10-t4-live-probe-plan.md`, ledger §"T4 Live Probe", LB-46.
  **Follow-on left open (SM decision):** the probe makes Google's unfitness a *measured fact* → whether to reopen
  **D-T4-2** (declare-unfit → detect-and-gate, with provider-verdict cache) is now a real, triggerable choice, not
  a hypothesis. *(MERGED to `master` at `461791d` + pushed, 2026-06-27; branch deleted.)*

### Backlog gate — 2026-06-22 (opening M08 · architect: Claude)

Per §3b, every open item was dispositioned **before** opening the M08 epic. M08 = transport/lifecycle
fault tolerance, plan at `design/archive/milestone08-transport-fault-tolerance-plan.md`.

| Open item | Disposition for the M08 gate |
|---|---|
| **Failure-modes split (2026-06-20)** | **M08 portion PROMOTED → M08 plan** (effect-fence D4, exec-RPC reconnect IMP-T3b-1, `McpCompleter` disconnect/timeout rejection). **M09 portion stays open** (consensus/protocol robustness — spike-led, opens after M08). |
| **No-driver rejection untested — IP-4 (2026-06-22)** | **ABSORBED → M08-T4** (tiny hygiene row; M08 already touches the registry/server reject surface). Closes the IP-4 coverage gap there. |
| **Worker-prompt worktree cleanup — FIND-T3b2-1 (2026-06-21)** | **DEFER, adjacent to M08-T3.** The effect-fence touches the worker exec path; **absorb into M08-T3 only if the fence work reopens the worker prompt**, else stays parked (it's a behavior change needing its own spec). |
| **Cross-provider consensus (2026-06-20)** | **DEFER** — consensus/API-path, not transport. Revisit with M09 or a later API-consensus epic; trigger = M09 open or quota relief. |
| **Auto-handoff / remove human turn-scheduler (2026-06-20)** | **DEFER** — its own future epic (item already says "revisit after M07-T3"). Not M08. |
| **Re-run M07-T2 live smoke (2026-06-20)** | **DEFER** — doubly-blocked (quota + consensus tolerance = M09); reopen condition unchanged. Not M08. |

*Nothing dropped. Items below keep their `[open]` lines; the table above is the gate record.*

---

### Done

### Doing (exactly one)

### Deferred (intentionally parked — each carries a reopen condition)

### Deferred (recent additions)

### Doing

### Todo (next first)

  ## 📌 THE STANDING POSITION — `apps/web` is verified BY EYE (PO, 2026-08-10)

  **This is the artifact BL-122 asked for.** It is deliberately here, in the item, rather than in a new design
  doc: this is where someone asking *"why is `apps/web` untested?"* will land, and a fresh document for one
  decision is the opposite of the simplicity that motivated the choice. `vitest.config.ts:18-33` points here.

  **The decision.** The web UI is thin enough that eyeball verification during a live session is proportionate to
  its risk. `apps/web` is therefore **not collected by the test suite, on purpose.** The exclusion is no longer a
  config line nobody chose — it is this line, chosen, by the Product Owner, for stated reasons.

  **What is KNOWINGLY NOT VERIFIED — stated precisely, because a position that hides its cost is not a position:**

  1. **That the `agent_non_reply` arm actually renders its notice.** Its *input* is proven
     (`bl028-t3b-nonreply-reader.test.ts` — a connected client receives the broadcast with `reason` and
     `silentForMs` intact). Nothing proves the arm displays anything. This is BL-028 T3b's bar row **C8**,
     accepted `not-checked`, and it stays not-checked.
  2. **Every other UI behaviour**, without exception. There are zero assertions over `apps/web`.
  3. **The specific hazard this leaves open**, which is the honest cost of (B): `App.tsx`'s WebSocket switch has
     **no `default` branch**, so a missing or mistyped `case` drops a message **silently**. The failure mode this
     gap cannot catch is precisely the one that produces no error anywhere. That was true before this decision
     and remains true after it.
  4. **A wrinkle for anyone doing the eyeball check** (found by run `hmp8`): the notice lands in the *Agent
     Events* sidebar panel, which initialises **collapsed** (`App.tsx:167`, `useState(true)`; the entry list is
     gated at `SidebarEvents.tsx:41` and `:50`). **Verifying by eye means knowing to expand that panel first.**
     A check that mounts the UI and looks at the default screen will see nothing and conclude wrongly.

  **REOPEN CONDITION — the one thing to watch for.** Reopen when **a second UI assertion wants a harness.** One
  six-line display arm does not justify the infrastructure; a second customer changes the arithmetic, because
  infrastructure with one customer gets fitted to that customer and has to be rebuilt for the next. Reopening is
  a normal act, not a reversal of a mistake — this position is calibrated to today's UI, and it expires when the
  UI stops being thin.

  **Also reopen if** the hazard in (3) ever actually fires — a UI message silently dropped in a real session is
  evidence that eyeball verification is not sufficient, and it should be treated as such rather than as a one-off.

  **If you reopen: the enabling change is ADDING an include glob, not deleting the exclusion.** See the corrected
  fix direction above and `vitest.config.ts:18-33`. Deleting the exclusion alone collects zero new files — proven
  by execution, and it is the tempting wrong answer.

  **Provenance.** The fork was framed by `design/operator/bl122-brief.md` §4 — an operator brief written by a
  commissioned worker in run `hmp8`, which presented both ends and explicitly refused to choose because the
  choice is product scope. Grading: `design/operator/hmp8-grading.md` (PASS). The no-op finding that corrected
  this item came from that brief's §3.1 and was confirmed by execution at grading.

  ## Disposition — UNMITIGATED, ACCEPTED (PO, 2026-07-27)

  **The risk is accepted as stated, and nothing is being built.** Say it in the plainest terms so no later reader
  mistakes this for a fix: **the invariant harness does not and will not detect a portless stray process, and an
  operator run can therefore leave a poller, waiter or orphaned `sleep` behind with the harness reporting
  `exit 0`.** That is the known, accepted state of the rail.

  **Why accepting is defensible.** The blast radius is a wasted process and wasted budget, not damaged
  infrastructure — the damage classes the harness *does* cover (worktrees, branches, `HEAD`, ports) are the ones
  that can actually burn the repo. And the honest fix is not cheap: a `ps` pattern match is precisely where
  [[IP-15]] lives, where a reviewer once filed a defect against a service the PO runs deliberately. Building the
  positive-evidence version (process-group ancestry from the launcher's own pid) is real design work that would
  block the operator ladder behind it for no proportionate safety gain.

  **The compensating control — and it is deliberately NOT automated.** After every operator run, **before**
  cleanup, a listing is produced for a **human to judge**:

  ```bash
  ps ax -o pid,etime,command | grep -E "[s]leep [0-9]|[u]ntil |[w]hile |[l]auncher\.mjs|[c]laude -p"
  ```

  **This produces a LIST, never a verdict** — which is the whole point. The reason BL-091 could not simply be
  "fixed" this way is that a machine cannot tell *our* stray loop from the PO's deliberate service; a human
  reading five lines can, instantly. Keeping the judgement human is the mitigation, not a shortcut around it.
  Hermes may run it (read-only, like the harness) and reports the output as an **observation**; disposing of
  what it shows is the PO's.

  **The control was PROVEN, not assumed — and the gap was demonstrated live at the same moment (2026-07-27).**
  A procedure nobody has watched work is exactly the trap that produced three defects earlier this same session,
  so both halves were exercised:

  1. **The pattern discriminates.** Against representative `ps` lines it matched the O-1 poll loop
     (`until grep …; do sleep 5; done`), a bare `sleep 300`, `launcher.mjs`, and `claude -p` — and did **not**
     match `node orchestrator/index.js` or the PO's `hermes-live-transcript/server.py`. That negative half is the
     load-bearing one: those are the deliberately-running services whose misclassification *is* [[IP-15]].
  2. **The harness is blind and the sweep is not — measured side by side.** A real `sleep 40` (pid 53836) was
     started after a baseline snapshot and left running. The sweep listed it. `infra-invariant.mjs check` against
     that same baseline, **with the process still alive**, reported two `critical`s — both of them
     `tracked-file-modified` about edited docs — and **said nothing whatsoever about the process**:

     ```
     [CRITICAL] 2
       · tracked-file-modified: agenttalk: … design/backlog.md
       · tracked-file-modified: agenttalk: … design/launch-and-monitor-runbook.md
     ```

     That is this item, reproduced on demand: a process appeared inside the observation window and the rail
     could not see it. It is also why the sweep is `before cleanup` — the same position as the harness check.

  **It is wired into `design/launch-and-monitor-runbook.md` §10a, not only recorded here.** A compensating
  control that lives in a deferred backlog item is a note, not a control — nobody reads the backlog at run time.

  **Reopen condition (§3c).** Reopen this item if **any** of the following happens:
  1. A stray portless process from an operator run is found **after** the sweep was performed — i.e. the manual
     control demonstrably failed, not merely was skipped;
  2. Operator runs become unattended (no human reviewing the sweep between runs), which removes the judgement
     the control depends on;
  3. A stray process causes real harm rather than waste — holds a lock, corrupts an artifact, or consumes
     budget beyond a single run's cap.

  **Not a reopen trigger:** finding another stray when the sweep was simply not run. That is the procedure
  lapsing, not the accepted risk changing.

  ### ✅ CLOSED — merged `602db8f`, 2026-07-31

  **Delivered by a worker commissioned over HMP — the first task in this project completed end to end by an
  agent a courier launched.** PO authorization `0eeebb4` → Hermes → fence → `att-op-hmp2` → `0ccff42`. Graded
  **PASS on R1–R5** against the pre-registered bar `053b8a75`
  (`design/operator/hmp2-grading.md`), and the closure sweep was re-run on the **merge result** rather than the
  branch: `tsc -b` exit 0, suite **665/665 / 82 files**, and the behaviour verified on master itself —
  `[wt-setup] fatal: '…' is not a working tree`, exit 1, **0** stack markers.

  **This item's own "Fix:" direction was WRONG, and the worker proved it rather than following it.** The line
  above says *"catch around the `git()` calls."* **A catch alone would have printed nothing useful:** `remove`
  passed `stdio: ['ignore','inherit','inherit']`, so git's message went straight to the terminal and the thrown
  error carried **`stderr: null`** — there was nothing left to report. The fix therefore had to *capture* stderr,
  not merely catch. `git()` now uses `spawnSync` with stderr piped, throws a typed **`WtSetupError`** carrying
  git's own words, and a single top-level handler prints `[wt-setup] <message>` and exits 1. Success-path stderr
  is forwarded verbatim so `worktree add`'s progress still reaches the terminal.

  **The constraint this item insisted on holds, and is pinned by a test:** the error is **not** swallowed and
  `remove` is **not** idempotent. Only `WtSetupError` is caught — an unexpected error is a code defect and keeps
  its stack, which is the reason the class exists at all.

  **Two things the worker did unprompted, both worth imitating:** it **mutation-checked its own tests** (5 of the
  7 go red against the unfixed script; it named the 2 that stay green as regression guards that *should* hold
  either way), and it found the **same-class defect in `create`'s `npx tsc -b` / `npx vitest run` calls and
  reported it WITHOUT fixing it**, because the brief forbade running `create` and an unexercised fix to an error
  path is a guess. → **[[BL-115]]**.

  **One deviation, accepted with the record:** `parseArgs` was declared out of scope in the brief and the worker
  changed it anyway (bare `Error` → `WtSetupError`). Declared prominently rather than slipped in, trivial, and
  provably safe — but the instruction was to report it. Partly the brief's fault for naming it beside a fix whose
  mechanism naturally sweeps it up.

  **⚠️ Closing this emptied the agent-selectable queue** — BL-104 was the only `autonomy: eligible` item, so
  `bl093-backlog-selectable.test.ts` went red **by design** and the pin was updated only after the red was shown
  to the PO — that sequence is the ritual, not a formality.
  **↳ Refilled the same session (2026-07-31):** the PO marked **[[BL-115]]** eligible, and the pin went red a
  *second* time — proving the blocker chain, since BL-115's `blocked_by: [BL-104]` resolved the moment this item
  flipped to `done`, with nothing editing the dependency.

  **Telemetry (task closure):**
  - task:        BL-104 (run `hmp2`)
  - wall-clock:  2026-07-31 18:51:43Z → 18:56:41Z (worker 4m58s); merged 21:06Z
  - budget:      claude weekly 25%→26% (Δ ~1%), session 7%→18% (Δ ~11%, mostly the grader's own suite runs)
  - gate:        tsc 0, suite 665/665 (82 files), invariant check 0 critical / 3 info, pollution clean
  - diff:        2 files, +155/-10; commits 0ccff42, merge 602db8f
  - outcome:     MERGED ✅ — **PUSHED** `20e3f0a` (PO-authorized at session close, 2026-07-31)

  ### ✅ CLOSED — merged `0868fd9`, 2026-08-01

  **Delivered by a worker commissioned over HMP (run `hmp3`, 6m05s).** PO authorization `db27cdc` → Hermes →
  fence → `att-op-hmp3` → `56d2ea1`. Graded **PASS on R1–R6** against the pre-registered bar `7530aea0`
  (`design/operator/hmp3-grading.md`). Closure sweep re-run on the **merge result**, not the branch: `tsc -b`
  exit 0, suite **671/671 / 82 files**.

  **The point of this rung was that the obvious fix was wrong, and it stayed wrong under pressure to be
  green.** BL-104 fixed its half by *piping* stderr so git's own words could be reformatted. Copying that here
  would have satisfied every naive test while regressing the thing that matters: buffering a whole `vitest run`
  until it exits, so its output arrives in one block after the fact. `runStreaming()` instead keeps
  `stdio: 'inherit'` at both call sites and converts **only the non-zero exit** into `WtSetupError`, with a
  message synthesised from label/cwd/status — because with inherited stdio there is nothing captured to quote.
  **Nothing is captured, so nothing can be buffered: the streaming property is structural, not asserted.**

  **Verified by running, at both ends.** Same fixture through both versions: before, a stack ending
  `stderr: null` / `Node.js v24.14.1`; after, `error TS2322` from `tsc` itself **followed by**
  `[wt-setup] tsc -b failed (exit 1) in …`, exit 1, zero stack markers. The diagnostic arriving *first* is only
  possible if the child owned the terminal — which is the R2 property observed live rather than inferred from
  the diff.

  **Two things the worker did unprompted:** it handled `res.signal` (`spawnSync` reports `status: null` on a
  signal kill, so a bare `status !== 0` would have been true with a useless message), and it added the
  **success path of `create`**, which had no test at all — the case where an error-handling change could
  regress in silence. Its new tests are red-first: 5 of 6 go red against the unfixed script, and the sixth is
  the success-path guard that *should* hold either way. **[[BL-104]]'s four end-to-end tests are byte-identical
  after the change** — no contract weakened to fit.

  **The hazard this item was held back for did not materialise, and was checked where it could only have
  shown.** Exercising the fix requires `create`, which provisions a real worktree, and `primaryCheckout()`
  resolves the PRIMARY even from inside a sandbox. `git worktree list` / `git branch` **in the primary** show
  only `task-op-hmp3` and the orchestrator's own nested worktree — nothing attributable to the worker's
  `create` runs, because its tests set their cwd inside a throwaway repo, exactly as the brief required.

  **One difference from `hmp2` worth recording, since a silence is easy to misread as an endorsement.** The
  brief invited out-of-scope reports and named two known conditions; the worker reported none. Nothing obliged
  it to find something, so this is not a mark against it — but `hmp2`'s most valuable output was a refutation,
  and **a quiet run is weaker evidence than a talkative one.** Do not cite this closure as showing the worker
  would have spoken up.

  **A property of the design surfaced by this run: the channel rehearsal and the authorization are mutually
  exclusive.** `hmp2` could send a real commission for free because `hmp2.authorized` did not yet exist, so
  refusal was the only outcome available. Once the PO's authorization commit lands, any commission reaching the
  wire launches. **Every future send is therefore unrehearsed** — not a defect, but not something to discover
  mid-run either.

  **[[BL-114]] unchanged.** `cap.meter` was configured (`maxPercentDelta: 20`) and remains unverifiable — the
  reader coerces a missing figure to `0`. **`cap.wallClockMs` is still the only rail this run may honestly
  claim**, at 13.5% of its 45m cap.

  **⚠️ Closing this empties the agent-selectable queue again** — BL-115 was the only `autonomy: eligible` item,
  so `bl093-backlog-selectable.test.ts` goes red **by design**, and the pin is updated only after the red has
  been shown to the PO. That sequence is the ritual, not a formality.

  **Telemetry (task closure):**
  - task:        BL-115 (run `hmp3`)
  - wall-clock:  2026-08-01 09:32:39Z → 09:38:44Z (worker 6m05s); merged 10:24Z
  - budget:      claude weekly 30%→32% (Δ ~2%), session 0%→24% (Δ ~24%, mostly the grader's own suite runs)
  - gate:        tsc 0, suite 671/671 (82 files), invariant check 0 critical / 3 info, pollution clean
  - diff:        2 files, +190/-7; commits 56d2ea1, merge 0868fd9
  - outcome:     MERGED ✅

  ### ✅ CLOSED — merged `6231172`, 2026-08-01

  **Delivered by a worker commissioned over HMP (`hmp4`), graded PASS on R1–R7.** Brief
  `design/operator/hmp4-brief.md`, pre-registered bar `design/operator/hmp4-bar.md`, grading
  `design/operator/hmp4-grading.md`. Worker commit `4f652e2`, 2 files, +430/−13.

  **What shipped.** `diffSnapshots` now takes the **raw declaration as a fourth parameter**, kept separate from
  the merged object, and `loadExpect` returns both. `unmatchedDeclarations` reports at `warn`: any key not in
  `DEFAULT_EXPECT`, and any `allowNewWorktrees` / `allowNewBranches` / `allowProcesses` / `allowWritePaths`
  pattern that matched zero of the candidates the diff actually tested.

  **Verified on the real historical failure, not a synthetic one.** The branch's harness against `hmp4`'s own
  baseline with `allowWritePaths: ["design/operator/"]` — the exact `hmp2` typo — now emits the bogus
  `critical` **next to a warn naming the path the pattern failed to match**
  (`design/operator/.hmp-launched.json`). Corrected to `design/operator/**`, the warn disappears and the write
  reclassifies to `INFO (declared operator write)`. Re-confirmed live from the primary checkout after the merge.

  **The three wrong answers the brief named, all avoided and each checked directly:** the matcher was **not**
  loosened (`matchesWritePath('design/operator/.hmp-launched.json', ['design/operator/'])` still `false`, and
  the tail-match trap still refuses); nothing the new code emits is ever `critical`; and the **declaration** is
  inspected rather than the merged object, so `DEFAULT_EXPECT`'s own patterns are never judged and a
  byte-identical run stays clean. `DoD row 6 — a clean run is clean` is **untouched** — the test file is
  **+297/−0**, purely additive, no existing row edited. `exitCodeFor` untouched.

  **Accepted consequence, shipped unmitigated and stated by the worker:** `exitCodeFor` already returns 1 for a
  `warn`, so an otherwise clean bracket carrying a legitimately unused declaration now exits **1** instead of 0.
  Out of scope to change; no floor case was demoted to dodge it.

  **Beyond the brief** (nobody specified these): each field is re-tested with the **same matcher that judged it
  during the diff**, so *"never matched"* means what it meant there; `allowPorts` is exempt **with an argument**
  (numbers compared by equality, not patterns) though the item listed only four fields; candidates are left
  empty wherever the range was never read, commented *"'we did not look' must not read as 'nothing was
  there'"* — the BL-023/BL-090 discipline applied unprompted to new code.

  **The rung's own hazard held.** The worker edited the grader. The primary checkout's
  `scripts/infra-invariant.mjs` was **byte-identical** (`46f28def…`) throughout the run while the worktree's
  differed (`fa6949e5…`) — confirmed by git object hash. The bracket produced **0 critical, 0 warn, 3 info**:
  the first of four operator runs with no `critical` at all, because the grader tested its `--expect`
  declaration against a path it must permit **and** paths it must refuse *before* trusting it.

  **Recorded, not celebrated:** the worker reported **nothing out of scope**. Two rungs running (`hmp3`,
  `hmp4`) have been quiet. It was under no obligation to find anything, but an ungraded silence quietly becomes
  *"it would have spoken up if there were something"* — so it is written down as a fact about the run.

  **Telemetry (task closure):**
  - task:        BL-116 (operator rung `hmp4`)
  - wall-clock:  2026-08-01 17:14:38Z → 17:28:06Z (worker 13m28s, cap 45m); merged 21:11Z
  - budget:      claude weekly 32%→36% (Δ ~4%), session 38% — machine-wide, whole session, not attributable
                 to the run alone
  - gate:        tsc 0, suite 692/692 (82 files) **re-run on the merge commit**, invariant check
                 0 critical / 0 warn / 3 info, pollution clean
  - diff:        2 files, +430/-13; commits 4f652e2, merge 6231172
  - outcome:     MERGED ✅

  ### CLOSING BLOCK — merged `fb7c45e`, 2026-08-15

  **What shipped, and what it is worth.** `authorizationPathFor` now resolves to
  **`design/po/<run>.authorized`**, outside the operator's write allowlist, and the PO's act is a single
  **`approve <token>`** (`relay-approve.mjs`, action `launch`) which writes, commits and **verifies** the file
  before burning the token. 8 files, +572/−40, suite **798/798**, `tsc -b` 0.

  **⚠️ READ THIS BEFORE CITING THIS ITEM AS A FIX.** The path move buys **conspicuousness, not prevention**.
  `design/operator/**` is written routinely by the seat, so an authorization there was camouflaged; `design/po/`
  is written by nothing else, so a write there is visible — and `classifyHeadMove` can name it as a foreign
  path *inside a bracketed run*. **Nothing mechanically stops a process holding a shell from writing it.** The
  `origin/master` anchor was tested and killed during planning: `~/.ssh/id_rsa` is unencrypted and `ssh-add`
  holds no identities, so there is **no credential boundary** between the operator and the remote either.
  **Only a secret the operator cannot read would be a fence, and none exists on this machine** — that is
  option (b), filed separately.

  **The primary deliverable was the retraction, not the move.** `hmp-commission.mjs`'s header claimed the PO's
  merge *was* the authorization act; `AGENT.md`'s never-write table omitted `.authorized` entirely. Both now
  state what is true, and DoD row **D9** pinned it: the words *fence*/*prevents* may not describe the path move
  anywhere in the diff. A false fence retires the reader's vigilance, which is worse than no fence — [[BL-136]]
  and [[BL-101]] before it.

  **A guardrail was lowered, deliberately and by the PO.** `relay-approve.test.mjs` asserted this module never
  calls `git()` with a write verb — *"a fence against a future 'just merge it here'"*. Making `approve` commit
  breaks it. The implementer **stopped and reported** rather than trimming the verb list; the PO chose to
  **narrow** it (option A): `commit` is now a shape-asserted **single call site**, pathspec-limited to an
  `authorizationPathFor` path, with every other write verb still absolutely forbidden. **The bar records its own
  history so the next reader repeats the conversation, not the shortcut.**

  **Both quality gates refuted before passing, and the findings were real:**
  - **Gate 1** killed draft 1 on two internal contradictions (an import the scope forbade; a title claiming
    option (c) that nothing implemented). The PO's *"rethink"* then killed the **premise** — a plan can be
    perfectly self-consistent and still solve the wrong problem.
  - **Gate 2** found bar **B3 was never written** while DoD row D2 claimed it: a verifier patched to read
    **both** paths passed all 54 other bars. It also found **B5b had been silently reverted** by the
    implementer's own `git checkout -- scripts/` during the mutation run, so the reported *40/40* was a
    pre-revert reading of a post-revert artifact. **Commit the bar, then mutate.**

  **Two checks ship UNCOVERED and are not proven behaviour:** the internal "commit touched exactly one path"
  guard and the post-commit blob read-back. Mutations M5 and M6 deleted each and **killed no test**, because
  neither is reachable while the commit is pathspec-limited. They are kept as defence-in-depth and reported
  rather than deleted — which is what produced **B5b**, the bar attacking the property that *is* falsifiable.

  **Not live-proven.** No Hermes-authored authorization has been driven through a real commission. The bars are
  unit-level; BL-137's original honest limit carries forward unchanged.

  **Follow-ups filed:** [[BL-138]], [[BL-139]] (the unencrypted SSH key vs the "push is the PO's alone"
  claim), [[BL-140]] (option (b), signature verification).

  **⛔ CORRECTION 2026-08-15, same day, before BL-138 was started.** This block originally described BL-138 as
  *"populate `allowWritePaths` — without it this item's detection is available but never switched on."*
  **That was false and backwards, and the error was in this item's own closing block for about an hour.**
  `classifyHeadMove` with an empty allowlist returns **`foreign`** (`infra-invariant.mjs:413-415`) → **`critical`**
  (`:793-799`); the source says so directly at `:400-405`. **The harness is at its STRICTEST when nothing is
  declared**, and `allowWritePaths` is a deliberate **softening** that real runs already use ad hoc. So
  BL-137's detection is **not** waiting on anything: a write to `design/po/` during a bracketed run is
  `critical` today. BL-138 is now scoped as *preserving* that exclusion when the softening is applied — see
  its own correction block for the full retraction.

  **[[BL-134]] is unblocked** — its `blocked_by: [BL-137]` is self-releasing. **But its plan §5 must be
  re-checked against what actually shipped:** it may now describe Gate B as per-run, sha-bound, single-use
  **and conspicuous** — it may **not** imply "and only the PO can produce it", which remains false. **§11 D6 is
  also stale** and must be recomputed.

  **Telemetry (task closure):**
  - task:        BL-137
  - wall-clock:  2026-08-15 16:44 → 18:40 (~1h56m, incl. planning, 3 gates and the merge)
  - budget:      weekly 27%→31% (Δ ~4%), session 0%→40% (Δ ~40%)
  - gate:        tsc 0, suite 798/798 (94 files), pollution clean, worktree removed
  - diff:        8 files, +572/−40; merge `fb7c45e`; 5 commits on `task-bl137`
  - outcome:     **MERGED ✅**

  ### ⛔ CORRECTION 2026-08-15, by the planner who filed it, before any work started

  **This item was filed claiming: *"[[BL-137]]'s detection is BUILT but never SWITCHED ON … `classifyHeadMove`
  early-returns … the authorization is conspicuous to a human and invisible to the harness."* THAT IS FALSE,
  and it is backwards.**

  `classifyHeadMove` with an empty allowlist does **not** early-return into silence — it returns **`foreign`**
  (`infra-invariant.mjs:413-415`), which is emitted as **`critical`** (`:793-799`). The file's own contract
  comment states it plainly: *"no allowlist declared → `foreign` (today's behaviour, unchanged)"* and **"the
  softening is narrow on purpose"** (`:400-405`).

  **So `allowWritePaths` is a SOFTENING, not a detector.** With nothing declared the harness is at its
  **strictest**: every HEAD move during a bracketed run is critical. Declaring paths makes it report **less**.
  The filed item had it exactly inverted — it proposed "switching on detection" when the change is a
  deliberate, narrow **loosening**.

  **Two further facts the filing got wrong:** declarations are **already used** by real runs (hmp2 passed
  `allowWritePaths: ['design/operator/']`), and they are passed **ad hoc on the command line**, not from any
  committed config — which is why no committed file was found and why absence was misread as disuse.

  **How the error happened, recorded because it is the third of its kind today:** the planner read `:410`'s
  `if (!allowWritePaths || allowWritePaths.length === 0)` as "empty ⇒ no detection", never read the two lines
  it returns, and wrote the conclusion into a backlog item **and** into [[BL-137]]'s closing block. A citation
  points at the code that makes the claim true — reading the guard is not reading the branch.

  ### What the item actually is, restated

  Operator runs already declare `--expect` by hand, and **hmp2 already got it wrong**: `design/operator/`
  instead of `design/operator/**`, which matched nothing, contributed nothing, and produced a `critical` the
  run had not caused. That is the whole of [[BL-116]]'s origin.

  **Proposal:** a committed, reviewable `design/operator/operator-run.expect.json` carrying the seat's real
  write allowlist — `design/backlog.md`, `design/operator/**`, `design/operator-seat/**` — passed as
  `--expect` by the runbook, so the declaration is versioned and diffable instead of retyped each run.

  **`design/po/**` is deliberately EXCLUDED, and that exclusion is the item's only tie to [[BL-137]]:** when
  the softening is applied, a write to the authorization path must remain **foreign**. Not new detection —
  *preserved* detection, at the moment the surrounding noise is turned down.

  **⚠️ Read [[BL-116]] before writing a pattern.** Write paths match **end to end**, so a whole directory is
  `dir/**`, never `dir/`. A pattern matching nothing now warns (`expect-pattern-unmatched`) rather than
  passing in silence — but `warn` is the deliberate **ceiling**, so a wrong pattern still will not gate a run,
  and will not save you.

  **Honest scope note:** this is **housekeeping with a small safety edge**, not the second half of BL-137.
  BL-137 is complete as merged. Whether this is worth doing at all is a fair question for the gate — the
  status quo is *stricter*, merely noisier.

  ---

  ### CLOSING BLOCK — merged 2026-08-15

  **Shipped:** `scripts/operator-run.expect.json` (the seat's real allowlist — `design/backlog.md`,
  `design/operator/**`, `design/operator-seat/**`), `scripts/__tests__/bl138-operator-expect.test.mjs` (7
  bars), and `--expect` wired into all three bracket sites (runbook `:289`, SKILL `:402`, `:584`).
  **No production code changed** — `infra-invariant.mjs` is untouched. Suite **805/805 across 95 files**,
  `tsc -b` 0.

  **⚠️ THE FENCE ON THIS FILE IS THE SUITE, AND NOTHING ELSE.** An over-wide declaration produces at most a
  `warn`, and `warn` is [[BL-116]]'s deliberate ceiling — so **the harness will never catch a future edit that
  adds `design/po/**` here.** Bar **B3** is the only guard, and it must not be weakened to accommodate a path
  someone later wants allowed. Mutation N1 (adding `design/po/**`) kills 3 bars, B3 among them.

  **Gate 1 caught this session's own mistake one level down.** The plan put the declaration at
  `design/operator/operator-run.expect.json` — **inside the seat's own write allowlist** — defended by *"it
  only loosens what is reported, and B3 is the guard."* That fails: **B3 is a suite bar, not a run-time one**,
  so the seat could widen its own declaration, run, and revert with a clean report. Exactly [[BL-137]]'s
  shape. Moved to `scripts/`, verified outside the allowlist.

  **The defect found in the artifact itself.** The declaration's first version carried a `_comment` key — the
  natural way to document comment-less JSON. It produces a BL-116 `expect-key-unknown` **warn**, and a warn
  takes an otherwise clean bracket from **exit 0 to exit 1**. It would have made **every operator run fail**,
  in an item whose whole purpose is reducing false alarms. Caught by running `unmatchedDeclarations` against
  the file rather than assuming JSON comments are inert; the rationale moved into the test, where the
  enforcement lives.

  **Behaviour change, and it IS the deliverable:** lawful operator commits stop firing `critical` in a
  bracketed run. The benefit is that a reviewer stops learning to ignore a permanently-red signal — which is
  what any always-on alarm eventually produces.

  **Telemetry (task closure):**
  - task:        BL-138
  - wall-clock:  2026-08-15 18:45 → 19:10 (~25m)
  - budget:      weekly ~31%, session ~45% (Δ ~5%)
  - gate:        tsc 0, suite 805/805 (95 files), pollution clean, worktree removed
  - diff:        5 files (2 new), +181/−3, no production code
  - outcome:     **MERGED ✅**

