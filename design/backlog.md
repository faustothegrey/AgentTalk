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
status: todo          # todo | doing | done | dropped — nothing else
date: YYYY-MM-DD      # optional
epic: M08 | null      # optional owning/target epic
promoted_to: X | null # optional lineage: the epic/spike this item became
tags: [a, b]          # optional; free labels for UI filtering
-->
```

The **header is authoritative for the API**; if it disagrees with the prose `[STATUS]` tag the parser
emits a drift warning (surfaced at the §3b gate). Validate with `npm run backlog:check` after any edit.
Parser + endpoint: `apps/orchestrator/src/backlog.ts`. **The API's default view is the live queue only
(`doing` + `todo`); `GET /api/backlog?all=true` includes `done`/`dropped`** (the UI's future
show-done/show-dropped toggles ride this param). The response's `total` field always counts all items.

---

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
closed **ATTACH-BLOCKED → BL-026** (`design/spike2-consensus-real-cli-implementation.md`): two real CLIs cannot yet
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
Plan authored after the gate: `design/milestone18-self-hosting-plan.md` (Gate 1 review: Claude).

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
(`design/milestone15-arbiter-consensus-plan.md`). Context: **PO direct decision in session** — preserving the
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
plan at `design/milestone14-facilitator-extraction-plan.md`. Inception closed by the PO in session
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
`design/arbiter-shadow-spike-plan.md` — inception draft, pending Planner POV + PO go). PO (Fausto) directed the
groundwork this session; ratification calls are marked.

| Item | Disposition for this gate |
|---|---|
| **BL-001 / BL-004 / BL-006 / BL-008** | Already terminal (done/promoted/absorbed) — confirmed, no action. Note on BL-008: its residual debt (two protocol event-emission shapes) sits exactly on the surface the future facilitator-extraction epic touches → carry a "compose with arbiter Epic 1" reminder there. |
| **BL-002 auto-handoff** | **Reopen trigger FIRED** (M11 closed). Architect recommendation: **absorb into the arbiter program** — the facilitator ("the push") is the natural owner of turn-driving, making a separate auto-handoff epic redundant. **PO deferred the ratification (2026-07-01)** → stays `deferred`; **re-raise at the gate that opens arbiter Epic 1**. |
| **BL-003 M07-T2 live smoke** | Blocker half-lifted (M11 shipped tolerance; quota gate remains). Likely **superseded** by the arbiter direction (the arbiter judges advancement semantically, making the old strict-protocol live bar moot). Keep `open`/parked; final supersede-or-run call when arbiter Epic 1 opens. |
| **BL-005 worker-prompt worktree** | Unchanged — parked with explicit trigger (orchestrator collecting worker output). Not arbiter-adjacent. |
| **BL-007 operator abort/recovery** | Unchanged — experience-triggered (needs real `awaiting_operator` cases). Not arbiter-adjacent. |
| **BL-009 semantic arbiter** | **PROMOTED → arbiter shadow spike** (`design/arbiter-shadow-spike-plan.md`). The program decomposition (spike + 4 epics) stays in `design/arbiter-consensus-draft.md` §8/§10; only the spike opens now. |

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
  `design/milestone10-t4-api-enforcement-plan.md` + ledger §T4 + **LB-25**. *(Sibling T3 single-tool
  `consensus_respond`, v5→v6 cross-repo, stays deferred per D3.)*

- **[done] 2026-06-27 — M10-T4 live-verification probe — VERIFIED ✅ (reviewer-run), endorsed for merge.**
  `scripts/probe-t4-api-tools.mjs` sends one cheap real `/chat/completions` per provider with the exact T4 combo
  (`tools`+`tool_choice:'required'`+`response_format:{type:'json_object'}`) and classifies by HTTP response.
  **Measured findings (LB-46, reproduced independently by Claude):** `openrouter`/gpt-4o-mini = **fit**;
  `google`/gemini-2.5-flash = **http_reject 400** (ANY-mode + JSON mime explicitly unsupported);
  `nous`/deepseek-v4-flash = **http_reject 404** (default model missing — see LB-1). Script-only, zero production
  change; tsc 0, suite 245/245. Plan `design/milestone10-t4-live-probe-plan.md`, ledger §"T4 Live Probe", LB-46.
  **Follow-on left open (SM decision):** the probe makes Google's unfitness a *measured fact* → whether to reopen
  **D-T4-2** (declare-unfit → detect-and-gate, with provider-verdict cache) is now a real, triggerable choice, not
  a hypothesis. *(MERGED to `master` at `461791d` + pushed, 2026-06-27; branch deleted.)*

### Backlog gate — 2026-06-22 (opening M08 · architect: Claude)

Per §3b, every open item was dispositioned **before** opening the M08 epic. M08 = transport/lifecycle
fault tolerance, plan at `design/milestone08-transport-fault-tolerance-plan.md`.

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

<!-- @item
id: BL-019
status: done
date: 2026-07-09
epic: M17
tags: [self-hosting, identity, roles, enforcement]
-->
- [done · was: doing · opened AND closed 2026-07-09 (one day, three tasks); merges `5e4ca27` (T1) +
  `59856f9` (T2) + `467bd4a` (T3/epic), each PO-gated] — **M17 — The gate over the channel (self-hosting
  program, epic 2 of M16→M18)** — DELIVERED: session→identity→role mapping enforced by the brain
  (registry-owned `workflowRole`; bracketed text never authoritative; `product-owner` unassignable to any
  agent — Authority Invariant in the ledger); real reviewer verdict + SM go over the live attach channel,
  recorded (`design/m17-gate-channel-proof.ndjson`); PO-level act from an attached session refused
  pre-delivery (test-proven + live-recorded + UI-observed). Contract hash unchanged at v7 (send_to_agent
  extension, hash-neutral by design). Gate catches: 2 gate-2 refutes + 2 gate-3 refutes (G3-1 tag-vs-act,
  G3-2 provider≠trust-channel) — all pre-merge. Rider findings: BL-020 (orchestrator dies on client
  disconnect — flywheel catch #2), port-9899/meter collision note. Epic relay count ≈15 — flat vs M16, as
  expected: gates still relay via terminal until BL-017 (the fall is M18's claim, not M17's). Ledger:
  `design/milestone17-gate-over-channel-implementation.md`.

<!-- @item
id: BL-013
status: done
date: 2026-07-08
epic: M16
tags: [self-hosting, attach-mode, baton]
-->
- [done · was: doing · opened AND closed 2026-07-08 (one day, three tasks); merges `c5b7212` (T1) + `624110d`
  (T2a) + `1604b5c` (T2/epic), each PO-gated] — **M16 — One real baton (self-hosting program, epic 1 of
  M16→M18)** — DELIVERED: one `[SM]`-tagged role→role baton through the real orchestrator attach server,
  recorded (`design/m16-one-real-baton.ndjson`, full `workflow_baton` envelope in the conversation transcript).
  Rider finding: the mandatory healthcheck path was dead in every mode (zero production resolvers) — fixed as
  scope amendment M16-T2a (first working resolver + wire-contract v7, synced cross-repo). Deviations D1/D2
  recorded+accepted at gate 3; **owed piece for M17: the exec-bridge translation layer cannot carry `baton`
  args** (real CLI sessions can't send envelopes yet). Epic relay count ~15 vs M15 baseline ~20–30/day.
  Ledger: `design/milestone16-one-real-baton-implementation.md`.

<!-- @item
id: BL-012
status: done
date: 2026-07-02
epic: M15
tags: [consensus, arbiter, direct-path]
-->
- [done · opened and closed 2026-07-02 — PO direct-path decision; merged & pushed `fdbd766` (fix) atop
  `f70f23c`/`a329b19`/`f406feb`/`14a22f6`, PO merge go same evening] — **M15 — Arbiter Consensus, Direct
  Path** — parallel `ArbiterCoordinator` delivered: free-form NL planning turns, hard turn budget,
  readiness-triggered LLM arbiter (`gpt-4o-mini`/OpenRouter), arbiter-authored plan on `converged` →
  existing `awaiting_confirmation` human gate → unchanged worker path. Protocol machine frozen-intact
  (275/275 suite + M14 identity harness green at close). Live recorded proof
  `design/m15-t3-live-arbiter.ndjson`. T3 closed by Codex as temporary implementer+reviewer (PO-requested);
  Claude's independent review found + Codex fixed one work-routing regression (composition guard) before
  merge. Ledger: `design/milestone15-arbiter-consensus-implementation.md`.

<!-- @item
id: BL-001
status: done
promoted_to: M12
date: 2026-07-01
epic: M12
tags: [consensus, cross-provider]
-->
- [done · was: promoted→M12 · epic complete 2026-07-01; state corrected done→promoted 2026-07-02 (PO check)] — **Cross-provider consensus** — M12 epic complete.
  Structural proof (T1-T3) merged. C-PF1 fix confirmed by PF2. T4 honest partial — Codex bridge collision resolved by removing bridge MCP config; remaining R1 (protocol compliance) is a behavioral finding. Epic closed per PO Q6.

<!-- @item
id: BL-004
status: done
promoted_to: M11
date: 2026-06-30
epic: M11
tags: [consensus, robustness]
-->
- [done · was: promoted→M11 (consensus robustness) · planned, 2026-06-30, renamed per §3e convention 2026-06-30] — **Consensus / Protocol Robustness — the
  remaining pieces after M08/M10.** Opened as M11, plan at `design/milestone11-consensus-robustness-plan.md`
  and ledger at `design/milestone11-consensus-robustness-implementation.md`. Naming per §3e: SP1 (done), M11-T1 (next, origin: M10-T3), M11-T2, M11-T3.
  The original
  "Failure-modes split" item below carries the full history; this line is the promotion record.
  **M08 OPENED 2026-06-22** → `milestone08-transport-fault-tolerance-plan.md` (the three transport
  sub-bullets below are now spec'd there). **The M09 sub-bullets remain open here** until M09 opens. There are *many* failure modes (agent crash mid-task,
  partial worktree writes, network drops, mid-turn quota exhaustion, deadlocks, corrupted state, …);
  bolting them onto M07 would bloat it. Two genuinely different problem classes → two milestones,
  **deterministic-first**:
  - **M08 — Transport / lifecycle fault tolerance** (do first; deterministic, mockable, low ambiguity).
    Routes the sub-bullets below: **effect-fence D4**, **exec-RPC reconnect delivery gap (IMP-T3b-1)**,
    **`McpCompleter` disconnect/timeout rejection**. Consolidates + extends M03 agent-failure
    propagation; T3b's effect-fence is the first forced instance. Builds the safety net M09 leans on
    (a derailed planner *is* a lifecycle event).
  - **M09 — Consensus / protocol robustness** (the deep, model-dependent one; **spike-led**). Routes the
    "consensus protocol fault-tolerance" + "late-message race" + "live-test gate" sub-bullets, plus two
    new pieces from the 2026-06-22 review:
    1. **Defensive tolerance (the floor, must-have):** extend cf05d50 — every engine handler **warns +
       coerces/re-prompts instead of throwing** for illegal/out-of-phase/malformed messages *during*
       active planning too (today only the post-planning straggler is soft). Provider-agnostic; works on
       mcp; keeps the team alive whatever the model does.
    2. **Turn-budget / referee:** bound discussion → force-advance or fail-the-round on non-convergence.
       Kills looping (orthogonal to affordance — a model can pick legal-but-wrong actions forever).
    3. **Affordance-protocol spike — as "dynamic per-phase skill + phase-scoped MCP toolset"** (reframed
       Fausto + Claude, 2026-06-22; supersedes the earlier "provider-native function-calling, API-path-only"
       framing). **Goal:** make phase-illegal transitions impossible/unlikely *by construction* instead of
       today's "prose protocol" (JSON-in-text → parse → runtime-reject). **Mechanism — two layers the
       brain composes per turn and the dumb harness merely passes through to the MCP/API agent:**
       - **Skill layer (guidance):** the brain injects the *current-phase* skill = instructions + worked
         per-phase examples ("here's the task; here's how you talk to your team *now*"). Builds the deferred
         **M05 native-loop/skill path**. Portable across the MCP agents (agy/claude/codex) **and** API agents.
       - **Phase-scoped MCP toolset (enforcement):** the agent connects via MCP, so the brain exposes **only
         the legal tools for this phase** — illegal moves aren't *present* to call. Skill = "how/why";
         scoped toolset = "you literally can't do otherwise."
       **Why this beats the old framing:** the **brain authors** skill + legal-tool-set, the **edge only
       executes** → intelligence stays centralized, **harness stays dumb → M07 inversion preserved** (the
       earlier "un-invert" worry dissolves), and it **covers mcp**, not just the API path.
       **Spike unknowns to probe first:** (a) do agy/claude/codex respect a **dynamically-injected,
       per-turn** skill (vs. only one loaded at launch)? — mechanics differ per MCP; (b) measured compliance
       vs. the prose baseline on ≥1 provider. **Still orthogonal:** affordance/skills stop *illegal* moves,
       **not looping** (→ piece 2, referee). So pieces 1+2 remain the survivable floor; piece 3 is the
       structural upgrade.
       *(Fine-tuning a model into the harness was considered and rejected for the mainline — we don't own
       the hosted MCPs, it's overkill vs. constrained tooling, and brittle to protocol churn. Niche only:
       a local open-weight protocol-agent + small LoRA, as a separate research spike, not M09 mainline.)*
  - **Testing principle for both (learned 2026-06-22):** the failure is **probabilistic** — live
    consensus sometimes completes, sometimes derails (Gemini saw timeouts; reviewer ran the same tests →
    both passed). So gates MUST be **deterministic tolerance tests** (inject the illegal/late message,
    assert warn+survive) **plus recorded live observations** — never a flaky live pass/fail bar.
  - **Next step:** open M08 first with its own `milestone08-…-plan.md`; M09 follows. Don't start until a
    plan exists (backlog gate). The sub-bullets below carry the per-item detail + what's already partially
    landed.
  - **Explicitly absorbs (Fausto, 2026-06-21):** the **effect-fence** (D4 = worker crash mid-exec →
    stop-and-ask; *policy* decided, *implementation* lives here, not T3b-2); the **exec-RPC reconnect
    delivery gap** (**IMP-T3b-1** from the T3b-1 ledger); and **`McpCompleter` disconnect/timeout
    rejection** (today it never rejects → a mid-exec disconnect hangs the turn). These were re-scoped OUT
    of T3b-2 to keep it inversion-only.
  - **Also absorbs (Fausto + Claude, 2026-06-21) — consensus protocol fault-tolerance:** the phase
    state machine has **zero tolerance for a well-formed-but-illegal transition** — one planner emitting
    the wrong `message_type` for the current phase (e.g. a 2nd `agreement_proposal`, or `agreement_acceptance`
    with nothing pending) crashes **both** planners into `error` → forced shutdown (facts: **LB-6/LB-7**).
    Q1's structured-output retry only catches *malformed JSON*, not *valid-but-wrong-phase* messages. The
    centralized brain (it now owns lifecycle + `message_type→tool`) is the right place to add tolerance —
    **detect the illegal transition → coerce / re-prompt / fail soft for that one agent**, instead of the
    dual force-kill. *Open design call (spike when M08 opens):* bolt-on tolerance vs. rethink the strict
    phase machine to be tolerant-by-design.
    — **PARTIALLY ✅ (tactical, 2026-06-21, Claude as implementer):** the *fatal* half is fixed — a protocol violation
    on a planning tool (`submit_plan`/`agreement_*`/`ack_planning_protocol`/`fact_collection_end`) is now **soft-rejected**
    at `registry.handleMcpToolCall` (returns `isError`, action discarded, **agent stays alive**) instead of throwing →
    crashing the driver → M03 killing the team (`registry.ts`, branch `m08-protocol-violation-soft-reject` `dae80c2`;
    reproduce-first test). The coordinator still rejects the action (its throws unchanged). **Still open (full M08
    quality):** *re-prompting / coercing* the offending agent toward a valid transition rather than just discarding —
    that's the richer tolerance work.
  - **Concrete instance hit LIVE (2026-06-21, Gemini's T4b-2 run) — late-message race:** a late planner message
    (2nd `submit_plan`/`opinion`/`agreement_*`) reaching the registry **after** the task left `planning` (→
    `awaiting_confirmation`) makes `TeamCoordinator.handlePlanSubmitted`/`handleAgreementProposal`/
    `handleAgreementAcceptance` **throw** → `InProcessAgentDriver` → agent `error` → **M03 kills the team task.** Same
    fragility as LB-6/7, now reproduced on the **mcp consensus path**. Fix = ignore/warn on out-of-phase messages
    instead of throwing (M08 work — was reverted out of T4b-2). **This is the dependency that blocks T4b-2.2's live proof.**
    — **✅ RESOLVED 2026-06-21** (Claude as implementer, role reassigned): the 5 planning-phase "not in planning" guards
    now **warn + no-op** on a post-planning straggler instead of throwing (`team-coordinator.ts`, branch
    `m08-consensus-race-tolerance` `cf05d50`). Deterministic regression test (fail-before/pass-after); in-phase
    enforcement intact; 164/164; tsc 0; live consensus clean. **Unblocks T4b-2.2.** *(The broader LB-6/7 "illegal
    transition during active planning → coerce/re-prompt" question above is still open — this slice only covers the
    benign post-planning straggler.)*
  - **Live-test gate (Fausto, 2026-06-21):** until this tolerance lands (or a protocol-compliant model with
    available quota exists), **do NOT spend live *consensus* runs on protocol-unfit models** (`gemma-4-26b`,
    `gemini-*-flash-lite`) — they only re-confirm LB-6/7, zero new signal. **Worker / single-agent live runs
    are unaffected** (they don't exercise the consensus state machine).

<!-- @item
id: BL-006
status: done
promoted_to: M08-T4
date: 2026-06-22
epic: M08
tags: [registry, test-coverage]
-->
- [done · was: absorbed→M08-T4] 2026-06-22 — **No-driver rejection is untested (T4b-3, IP-4)** — T4b-3.2 changed
  `registry.activateAgent` to **throw** for provider-less/unknown providers (caught at `server.ts:565` →
  clean error response) and removed the old "activate without a command" test (correct — that wire path is
  gone), but **no test pins the new rejection.** Add a small server/registry test asserting a provider-less
  `createAgent` → `/start` returns the error status (not 200, not a crash). Low-risk; closes the IP-4 gap.
  (IP-3 — the report mischaracterising this as pre-existing — is logged in `implementer-pitfalls.md`, not here.)

- [done] 2026-06-27 (gate sweep — was stale `[open]`) — **Type `provider` as a union instead of `string`** — ✅
  **ALREADY DONE**: `export type AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex'` exists at
  `packages/contracts/src/types.ts:13` and the field uses it (`provider?: AgentProvider`, `:29`/`:74`); every
  branch site is exhaustiveness-checkable. Landed with the M09 rename work. The text below is the original (stale)
  rationale, kept for history. *(Found by the §3b gate, 2026-06-27 — see LB-47 staleness pattern.)*
  <!-- STALE BELOW (pre-M09): -->
  `provider` is
  currently `string` (`contracts/src/types.ts:23,67`), and the runtime branches on its *value* (`registry.ts:210,322`
  enumerate `'api'|'mcp'|'gemini'|'claude'|'codex'`). Because it's untyped, **the compiler cannot catch a typo or
  a missed value** at any branch/createAgent site — a wrong/missed value silently misroutes an agent to the wrong turn
  path. **Fix:** define `type AgentProvider = 'api' | 'mcp' | 'gemini' | 'claude' | 'codex'` (current set) and use
  it for the field → every branch becomes exhaustiveness-checkable and every call site compiler-validated. **Small,
  but it IS a behaviour-adjacent change** (tightening a type can surface latent invalid values) → own confirmation +
  full suite. **Independently valuable**, and a **recommended prerequisite** for the mcp→mcp/api rename below (makes
  that rename compiler-safe). Recommendation surfaced during the mcp-rename assessment; recorded standalone so it
  survives even if the rename is deferred.
  - **Source:** Claude recommendation, 2026-06-22 (T3-prep session). Related: ↓ mcp→mcp/api rename item.

- [done] 2026-06-27 (gate sweep — was stale `[PROMOTED → M09]`) — **Rename `mcp` → `mcp`/`api` across the
  codebase** — ✅ **DONE + EPIC CLOSED** (M09, merged + history squashed `565ad3d`, 2026-06-25; ledger
  `design/milestone09-mcp-vocabulary-removal-implementation.md` = "DONE + EPIC CLOSED"). The taxonomy is now
  `api | mcp | gemini | claude | codex`; the open sub-questions (scenario-runner name, `Mcp*` form, provider-union
  first) were all resolved during M09. The promotion text below is kept for history. *(Found by the §3b gate,
  2026-06-27.)*
  <!-- HISTORICAL (M09 promotion brief, now closed): --> drop the
  "mcp" vocabulary; an agent client is either **`api`** (in-process) or **`mcp`** (externally-launched, attaches over
  MCP). Assessment requested by Fausto; **scope decisions settled** (below). **Promoted to its own milestone (M09)
  ahead of consensus/protocol robustness, which renumbers M09 → M10** (Fausto, 2026-06-24). Plan +
  ledger: `milestone09-mcp-vocabulary-removal-plan.md` / `-implementation.md`. ⚠️ The 2026-06-22 file paths below
  are **pre-monorepo and stale** — the plan/ledger carry the refreshed, verified map.
  - **Decisions (Fausto, 2026-06-22):** (1) `provider:'mcp'` → **`'mcp'`** (taxonomy becomes `api` vs `mcp`,
    matching M05/M07 attach-mode + the sibling `agentalk-mcp-client` repo); (2) **also rename `scenario-runner.ts`**
    (the app's own MCP entrypoint — *different* "mcp" meaning) — target name TBD; (3) **rewrite docs incl. history**
    (all 28 `design/*.md`); (4) **leave** the `gemini`/`claude`/`codex` provider values (no "mcp" string — separate
    taxonomy-debt item).
  - **Scope buckets + effort (~1 day, mostly mechanical):**
    - TS identifiers `McpCompleter` (18) / `McpError` (11) → `Mcp*` — `tsc`-guarded rename, low risk, ~30 min.
      *(Sub-choice: drop "exec" (`McpCompleter`) for consistency with the `'mcp'` value, or keep it (`McpExecCompleter`) to preserve the exec-RPC lineage — recommend drop.)*
    - `provider:'mcp'` → `'mcp'` value — `registry.ts:210,322` branches + ~6 scripts + 3 tests, ~45 min.
    - Filenames: `test-mcp-*.mjs` ×2, `mcp-*.test.ts` ×3 → rename + import fixups, ~20 min.
    - `scenario-runner.ts` → also updates `apps/orchestrator/package.json:9` (`node dist/scenario-runner.js`) + the root
      `npm run scenario` chain + any doc refs, ~30 min. **Needs a target name** (e.g. `scenario-runner.ts`).
    - Docs incl. history: all 28 `design/*.md` (ledgers, logbook, plans, `mcp-capability-assessment.md`,
      `phase5-client-extraction-proposal.md`) — mechanical but ~1–1.5 h to do + review carefully.
  - **🚩 The ONE not-naming-only caveat (honesty):** `'mcp'` is an **untyped magic-string discriminant the
    runtime branches on** (`registry.ts:210/322` pick the turn path from it), and `provider` is typed **`string`,
    not a union** (`contracts/src/types.ts:23`) — so **the compiler will NOT catch a missed rename site**; a missed
    one silently misroutes an agent. **Low blast radius** (verified NOT in `wire-contract.json`, NOT in the web UI,
    NOT persisted to disk) but needs grep-discipline, not a blind sweep. **Recommend:** type `provider` as a union
    *first* (small implementative change, separate confirm) → then the rename + all future ones become compiler-safe.
  - **Caveat on "docs incl. history":** the `.md` content can be rewritten, but **git commit messages already record
    "mcp"** and won't be rewritten (no history-rewrite) — so the term survives in `git log` by design.
  - **Open sub-questions before implementing:** (a) `scenario-runner.ts` target name; (b) identifier form `Mcp*` vs
    `McpExec*`; (c) do the `provider`-union-first pass (recommended) or accept the untyped grep-sweep risk.
  - **Source:** read-only survey + scope Q&A, Claude ↔ Fausto, 2026-06-22 (T3-prep session). Not started.

<!-- @item
id: BL-008
status: done
promoted_to: protocol-state-event-unification-spike
date: 2026-06-29
epic: null
tags: [protocol, events, tech-debt]
-->
- [done · was: promoted→protocol-state-event-unification-spike · planned, 2026-06-29] — **Unify protocol state-change event emission** —
  planned as `design/protocol-state-event-unification-spike.md` (exploratory only; no production-code
  implementation in the spike). Original item: after the
  DiagramTalk overlay work (bridge v3, `milestone10-diagramtalk-overlay-plan.md`) the brain emits protocol
  state changes through **two shapes**: the `onPhaseChange` funnel (forward phases, via `setPlanningPhase`,
  which *also* feeds `getPlanningPhase`/validation) **and** the new `onProtocolEvent` hook (off-path
  `endorsed`/`correction`/`eject`, deliberately kept OFF the validation path for Rule-2 safety). They diverged
  for a real reason, but conceptually both are "the protocol changed state — notify observers," so the split is
  a mild inconsistency. **Debt:** ideally all protocol state-change emissions share one uniform mechanism.
  **Note (don't conflate):** this is **NOT** what the `AGENTTALK_DIAGRAM_RECORD` flag was about — that flag is
  opt-in record-for-replay gating (drop attempt `25ab372` reversed by `8004ae3`, LB-24), an unrelated concern.
  **Low priority / not blocking;** revisit if a third emission site appears or the two shapes start drifting.
  **Source:** Fausto ↔ Claude, 2026-06-26 (overlay-plan session).

- [done] 2026-06-27 — **`@agenttalk/llm-client` — standalone chat-with-LLM package (API + MCP plug)** — ✅
  **VERIFIED DONE** (Claude, reviewer-run). The reusable LLM-calling core is extracted out of `runtime-core` into a
  zero-dep leaf package: Phase 1 (`ApiCompleter` + multi-turn `ChatSession`, `eae6321`), Phase 2 core
  (registry-free `McpChatCompleter` + `ExecTransport` plug, `877577c`), Phase 2 **Option B** (standalone exec-only
  attach server `@agenttalk/mcp-exec-server`, `b67a6ce`), owed adapter gap closed by a live smoke vs the real
  `agentalk-mcp-client` CLI (`4fb2a69`) + operator runbook (`e1524ba`) — all on `master`. Decisions Q1–Q4 were
  resolved (widen / Phase 1+2 / structured-output stays in runtime-core / name). Reviewer gate 2026-06-27: tsc 0,
  suite 245/245, consensus-free (grep-clean), `npm run smoke:exec` PASSED end-to-end. Record:
  `design/llm-client-extraction-spike.md` + LB-47. **NOTE — this item's prior `[open · SPIKE/proposed]` line and the
  spike doc's "owed piece remaining" status were both stale**; ground-truth check against git found the work already
  merged (the three-layer staleness LB-47 records). **Source:** Fausto ↔ Claude, 2026-06-26/27.

<!-- @item
id: BL-009
status: done
promoted_to: arbiter-shadow-spike
date: 2026-07-01
epic: null
tags: [consensus, arbiter, architecture, heavyweight]
-->
- [done · was: doing · PROMOTED 2026-07-02 — spike complete, merged to master (a905b2e)] — **Semantic arbiter & the two consensus modes** —
  promoted at the 2026-07-01 gate: first macro unit is the shadow-mode spike
  (`design/arbiter-shadow-spike-plan.md` — inception complete: architect draft + planner POV + disposition + PO
  go; planner task breakdown next); program decomposition stays in the draft
  §8/§10. Original seed below. — heavyweight direction to re-architect the
  consensus core: advancement decided by a **semantic arbiter** (reads agents' responses, advances by meaning)
  instead of the rigid protocol state machine. Refined into **two complementary modes over one shared "push"**:
  **A — arbiter-synthesis** (the arbiter authors the deliverable; semantic consensus) and **B — collective-signing**
  (all agents sign the same artifact; today's protocol ≈ B). Draft: `design/arbiter-consensus-draft.md`. **Ideation
  only — may father one or more epics; PO revisits with more input.** Absorbs/supersedes the M11 "referee"/tolerance
  thread and composes with the SP1 affordance spike. **Source:** Fausto ↔ Claude (architect), 2026-07-01.

### Doing (exactly one)

<!-- @item
id: BL-021
status: done
date: 2026-07-09
epic: M18
tags: [self-hosting, flywheel, scope-fence, robustness, baton]
-->
- [done · was: doing · **OPENED AND CLOSED 2026-07-09** (same day) — merges T1 `7c9cdee`, T2 `872bfed`,
  T3a `e1a4346` (+ client `9af84c7`); T3 died at gate 3 and was superseded by T3a (archived unmerged).
  **CLOSED WITH C3 DEFERRED (not met, PO sign-off):** relays 19, **substrate events 0** — T3a removed the
  blocker (real CLI sessions could not attach: BL-017 was misdiagnosed, LB-66) but no gate has yet crossed the
  channel. Reopen condition: the next epic carries ≥1 real gate/baton over the substrate and reports the
  substrate-carried ratio (BL-027). Friction filed (C7): BL-022…BL-027. Case law: IP-14, IP-15] —
  **M18 — Self-hosting milestone (self-hosting program, epic 3 of M16→M18)** — T1: BL-015 **L0 only**
  (scope-check script + per-task scope manifest; the guinea-pig process shakedown; L1/L2 stay M19-gated);
  T2: BL-020 (orchestrator must survive attached-client disconnect mid-turn); T3: BL-017 (exec-bridge
  carries baton/workflowEvent args — prefer extending `send_to_agent`, a new tool reopens BL-018; the relay
  count falls here). DoD per the draft §M18: every baton/gate in the recording; friction→backlog entries
  cite recording evidence (the program's true DoD); C3 reworded — relay count recorded per task, falls
  measurably after T3, every relay a declared fallback moment. Inception + planner POV (endorses, architect-
  verified): `design/self-hosting-program-draft.md` §M18. Plan: `design/milestone18-self-hosting-plan.md`.
  **Source:** PO + Architect inception, 2026-07-09.

<!-- @item
id: BL-011
status: done
date: 2026-07-02
epic: M14
tags: [consensus, arbiter, facilitator, refactor]
-->
- [done · was: doing · CLOSED-RESCOPED 2026-07-02 (PO): T1 delivered+merged `36fa888` (identity harness =
  regression pin for the frozen protocol path); T2/T3 superseded before start by M15 (BL-012)] — **M14 —
  Facilitator Extraction (Arbiter Epic 1)** — extract the
  phase-advancement decision authority out of `team-coordinator.ts` behind a **Facilitator interface**; default
  implementation reproduces today's deterministic rules **byte-identically** (zero behaviour change, zero LLM
  calls). Absorbs the BL-008 residual (unify the two protocol event-emission shapes — same surface). Leaner
  scope per PO (2026-07-02): all judge-touching work parked → BL-010. Plan:
  `design/milestone14-facilitator-extraction-plan.md`. Program: `design/arbiter-consensus-draft.md` §7/§8/§10.
  **Source:** PO + Architect inception, 2026-07-02.

### Deferred (intentionally parked — each carries a reopen condition)

<!-- @item
id: BL-010
status: deferred
date: 2026-07-02
epic: null
tags: [arbiter, judge, llm-client, shadow-mode]
-->
- [deferred · parked at M14 inception (PO, 2026-07-02) — the spike's PROMOTE qualifications, bundled] — **Judge
  hardening + shadow wiring (parked from Arbiter Epic 1)** — the four judge-touching items the leaner M14 scope
  excluded: (1) full-vocabulary gloss + judge-frame line in the judge prompt, then **re-measure the failure
  ladder** on the 11×3 matrix with a pre-registered numeric bar (suggested: success ≥5/6 AND ladder ≥2/3 at
  readiness-triggered); (2) **`llm-client` transport fix** — omit `response_format` when tools are forced on the
  google-via-OpenRouter path (shared-code behaviour change, own plan/DoD; restores `gemini-2.5-flash` as judge
  candidate); (3) **shadow wiring** — the judge rides the Facilitator interface read-only at readiness-triggered
  cadence, logging judgment-vs-machine per decision point; (4) **second-model spot-check** (all spike numbers are
  single-model `gpt-4o-mini`). Evidence base: `design/arbiter-shadow-spike-implementation.md` AS-T4 addendum.
  **Reopen condition: the §3b gate that opens the next arbiter epic** (Epic 2 / the judge epic).
  **Source:** spike PROMOTE (qualified) + PO leaner-scope decision, 2026-07-02.

<!-- @item
id: BL-002
status: dropped
date: 2026-06-30
epic: null
tags: [auto-handoff, turn-scheduler]
-->
- [dropped · PO decision 2026-07-02 — no longer a separate backlog item; done step by step in the normal workflow] — **Auto-handoff between agents (remove the human
  as turn-scheduler)** — re-evaluated 2026-06-29: Fausto confirmed this is **premature**,
  still DEFER for its own future epic. Reopen after M11 closes. (Seed text kept below for reference.)
  **Gate update 2026-07-01: the reopen trigger FIRED (M11 closed).** Architect recommendation at the gate:
  absorb into the arbiter program (the facilitator layer owns turn-driving — see BL-009 /
  `arbiter-consensus-draft.md`). **PO decision (Fausto, 2026-07-01): ratification itself DEFERRED** — pressing
  on with the arbiter spike instead. Stays `deferred`; **re-raise condition: the §3b gate that opens arbiter
  Epic 1 (facilitator extraction)** — the natural moment, since that epic builds the layer that would absorb this.

<!-- @item
id: BL-003
status: dropped
date: 2026-06-20
epic: M07
tags: [live-smoke, quota-blocked]
-->
- [dropped · superseded by the arbiter direction — PO ratified at the M14 gate 2026-07-02; the strict-protocol live bar is moot once advancement is judged semantically. History below kept for reference] 2026-06-20 — **Re-run the M07-T2 live smoke** (`scripts/test-live-api-team.mjs`, all-Google
  `gemini-2.5-flash`, 2 planners + worker in-process) **after the Google daily quota resets** — the
  deferred T2.4 / IMP-1. T2 was allowed to close without it (T2.3 mocked proves the flow
  deterministically). **Reopen condition:** if this live run fails or surfaces a defect → **reopen
  M07-T2**. On green, note T2.4 as confirmed-live in the (frozen) ledger.
  - **DOUBLY blocked (updated 2026-06-21, facts LB-6/7/8):** not just quota. `gemini-2.5-flash` is the
    only model observed to hold the protocol, and its quota is **family-wide** (2.5/2.0 all share one 429
    cap; 3.0/gemma-4-31b 404 — LB-8). Every quota-*free* model (`gemma-4-26b`, `*-flash-lite`) **fails
    protocol compliance** (LB-6/7). So T2.4 needs **quota relief AND consensus protocol-tolerance** (see
    the M08 item), **or** a frontier-compliant model with available quota. **Do not burn live runs on
    unfit models meanwhile** (live-test gate, M08 item).

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

### Deferred (recent additions)

<!-- @item
id: BL-018
status: done
date: 2026-07-09
epic: M19
tags: [self-hosting, wire-contract, cross-repo, governance]
-->
- [done · **M19-T1 DELIVERED & MERGED 2026-07-11 (AgentTalk `45daaf0`, client `847bcc6`), Gate 2+3 VERIFIED** — contract aligned to v7 + fail-closed divergence guard (generate-from-source); stale-client no longer blocks attach (live-proven). Full multi-version negotiation NOT built (a successor item if ever wanted). · was: todo · reopen condition MET** — SP2 reproduced the recurrence live
  (client v5 `1236003f…` vs server v7 `ffa94e93…` rejected). **M19 scope = contract *alignment / fail-fast*, NOT
  full negotiation** (planner refinement, architect-adopted): one source of truth or a generated/synced client
  contract + fail-fast diagnostics + no stale committed client path. Full versioned negotiation stays a *later*
  epic unless the PO widens it. · was: deferred · M17 inception disposition (PO+Architect, 2026-07-09) — contract
  evolution stays a manual, PO-gated act; reopen: a bump recurs and bites again, OR the PO calls it — **the PO
  called it 2026-07-11**] — **Versioned wire-contract negotiation** — replace the
  orchestrator's hard-reject on client contract-hash mismatch with versioned negotiation between
  AgentTalk and `agentalk-mcp-client`, so cross-repo contract evolution no longer requires a synchronized
  human act. Evidence so far: exactly one occurrence (M16-T2a's v7 bump, resolved via a Gate-1 cross-repo
  sync grant) — building negotiation now would be process for a problem observed once (program risk #3).
  M17 may at most add a clearer version label on the contract, no negotiation machinery. Source:
  `design/self-hosting-program-draft.md` §M17 inception; architect remark parked 2026-07-08.

<!-- @item
id: BL-016
status: deferred
date: 2026-07-08
epic: null
tags: [workflow, scrum-master, retrospective, growth]
-->
- [deferred · PO hint 2026-07-08, explicitly NOT operational — deferred by the PO to a more mature phase to
  avoid process bloat; reopen condition: PO calls it, OR an IP class recurs despite existing mechanisms] —
  **SM growth function — event-triggered micro-retrospectives** — extend SM duty 2 one step: *close the
  learning loop*. On a real event only (a REFUTE, a late-caught deviation, an IP mint) the SM runs a short
  evidence-anchored debrief **with** the erring agent — its reasoning at the time first, then a proposed
  *mechanism* (not a resolution) — dialogic, never a reprimand. Key reframe (architect): agents don't persist,
  so "growth" = improving the **artifacts the next instance reads** (elicited lessons in the agent's own
  words — agy's M16 close proved unguided reflection skips the behavioral lesson) and the **system around the
  agents** (root causes are often ours: e.g. the claim template has no mandatory "Deviations:" field — that's
  what let D1/D2 go unfiled). Guards: evidence-anchored to avoid contrition theater; each agent still writes
  only its own lessons file (SM elicits, never writes it for them); yardstick = **IP-class recurrence rate**.
  Third instrument of one theme: fences enforce (BL-015), briefs instruct (BL-014), **debriefs adapt**.
  Trial informally at the next real REFUTE before any doc change.

### Doing

<!-- @item
id: BL-030
status: done
date: 2026-07-11
epic: M20
tags: [self-hosting, relay, human-in-the-loop, program]
-->
- [done · **M20 DELIVERED & CLOSED 2026-07-12 (T1 `9b3f64d` · T2 `571d956` · T3 `0f82006`), all Gate 2+3 VERIFIED** — the brain-routes/you-approve mechanism is built and proven end-to-end with a real CLI: agent→agent relays are HELD pending and delivered only under PO approval (via UI/WS), denial honored, **default OFF** (all prior behavior preserved). **Adoption** (turning it on for real coordination) + the **consent-dimmer relaxation** (approve-each → by-exception → autonomous) are the ongoing program work, not this item. · was: doing · M20 *is* this item's work] —
  **PO-approved autonomous relay (the brain routes, you approve)** — begin retiring the PO-as-relay-between-agents:
  the brain autonomously computes/proposes each **agent→agent** relay (from-role → to-role + baton/gate envelope) and
  **holds delivery pending the PO's one-click yes/no** in the UI, delivering on *yes*. Mechanism in now; per-message
  consent stays manual, relaxed later one notch at a time. **Invariant (LB-68 F3):** the **PO channel is the
  reference clock — never mediated by AgentTalk**; only agent↔agent relays move, PO gates/opinions/merges stay direct;
  terminal fallback stays live. **Interposition point (grounded):** the single `sendProtocol` EVT delivery at
  `registry.ts:437-443`, after the M17 authority check (`:379-395`), on the `to !== 'user'` path only. **Behaviour
  change on shared routing code → full planning + Gate 1.** Smallest first bite: two agents, one hand-off, PO approves
  each. **Key planner question:** sender `send_to_agent` blocks-until-approved vs. returns-pending-with-async-queue;
  and how a held message waits for a target not currently on `await_turn`. Full inception: `self-hosting-program-draft.md`
  §M20. **Adjacent (not pulled in): BL-028** (typed non-reply reason / wake) becomes the dependency when the dimmer is
  relaxed toward autonomous delivery.

### Todo (next first)

<!-- @item
id: BL-022
status: todo
date: 2026-07-09
epic: null
tags: [scope-fence, tooling, cross-repo, friction-m18]
-->
- [todo · **M18 C7 friction item** — filed from evidence at epic close; the fence we shipped in M18-T1 has a
  hole we hit in M18-T3a the same day] — **`scope-check` is single-repo blind** — `scripts/scope-check.mjs`
  diffs only the AgentTalk working tree, so any task whose code lives in `agentalk-mcp-client` (or any other
  repo) is **unfenced while reporting green**. M18-T3a's *primary* change was `bridge.mjs`; its `scope-check`
  passed having inspected none of it. **Evidence:** M18-T3a Gate-1 condition 2 + the task-end review's declared
  honesty note (`design/milestone18-self-hosting-implementation.md`). Fix sketch: manifest gains a per-repo
  section; the script iterates declared repos. Until then a green `scope-check` must not be read as "the diff
  was fenced." **2026-07-10 backlog gate:** rather than fix this for M19, the **PO constrained M19-T1's refactor
  target to the AgentTalk repo** — so the fence is not blind for that task. The hole remains; ranked for after M19.

<!-- @item
id: BL-023
status: todo
date: 2026-07-09
epic: null
tags: [hygiene, pollution, gates, friction-m18]
-->
- [todo · **M18 C7 friction item — PREMISE CORRECTED 2026-07-09 at session close, before anyone acted on it**]
  — **Gates cannot tell a leaked process from a managed service** — *(Original filing claimed `pid 3177` was an
  orchestrator leaked by the M18-T3 proof run, surviving 4+ hours across two gate-3 closures. **That was wrong.**
  At the PO's request I moved to kill it, identified it first, and found it was
  **`com.fausto.agenttalk-orchestrator`, a launchd KeepAlive service the PO runs on purpose**: an always-on
  orchestrator whose job is to **serve `GET /api/backlog` (port 3741) to a backlog UI that lives outside this
  repo** — it reads `design/backlog.md` from the working tree, so uncommitted edits appear in that UI. No agent
  has ever attached to it (16 boots, 7 days). It also opens an unused WebSocket MCP listener on a **random
  ephemeral port each boot** (`AGENTTALK_MCP_PORT` unset — seen at 49288 / 49242 / 58733 / 49426), which is why
  no gate's port check ever saw it, and why one could collide with the ephemeral range. Logs land in
  `~/.hermes/logs/` — a path inherited from the retired Hermes era, not a live dependency. launchd restarted it within seconds; no harm. The
  reviewer who filed this — me — did exactly what **IP-15** warns about: inferred a cause from a correlation
  (`ppid 1`, cwd `apps/orchestrator`, right time window) without running the one command that would have refuted
  it.)* **The real, narrower gap stands:** the closure hygiene sweep checks worktrees and branches but **never
  processes or ports**, so it can neither catch a genuinely leaked orchestrator **nor recognise a legitimate
  service** — the M18-T2/T3 live proofs each left this ambiguity unresolved. **Evidence:** this correction;
  M18-T3 gate-3 hygiene finding (now known to have misidentified its subject). Fix sketch: the sweep reports
  `pgrep -f dist/index.js` + listening ports **with each process's ppid/launchd origin**, and **reports rather
  than reaps** — only the actor that started a process may kill it. Bonus lesson: a hygiene check that cannot
  distinguish "leak" from "service" produces false findings, which is worse than no check.

<!-- @item
id: BL-024
status: todo
date: 2026-07-09
epic: null
tags: [architecture, brain, types, friction-m18]
-->
- [todo · **M18 C7 friction item** — PO asked "is the brain shielded from client shape?"; audit says no.
  **M19 inception candidate**, pairs naturally with BL-014/BL-015-L2] — **The brain leaks client shape: `AgentProvider`
  conflates transport with vendor** — `packages/contracts/src/types.ts:13` is
  `'api' | 'mcp' | 'gemini' | 'claude' | 'codex'` — two shapes and three vendors in one union. It already caused
  the M17 G3-2 refute (`provider: 'api'` read as "the human channel"). Two more leaks: `team-coordinator.ts:977-986`
  bumps the fact-collection timeout `if (team.provider === 'gemini')` — **a vendor name changes protocol timing
  inside the frozen engine**; `registry.ts:239-259` selects driver/completer by provider rather than behind a
  factory. The *law* (authority, routing) is genuinely shape-blind and survives audit; the *plumbing* is not.
  **Evidence:** **LB-65** (full audit with line refs). Fix sketch: `transport` (`attached` | `in-process`) ×
  `vendor`; move the timeout to per-agent capability metadata; factory for driver selection.
  **⚠️ 2026-07-10 backlog gate — this item is load-bearing for SP2 and nobody had noticed.** SP2's whole subject is
  running `fact_collection → discussion → proposal` across two **real attached CLIs** — and the `provider === 'gemini'`
  branch above **changes the timing of `fact_collection` itself, inside the frozen engine**. It is unknown what
  `provider` value a real attached CLI carries (`'mcp'`? the vendor name?); the union admits both, and that ambiguity
  already caused the M17 G3-2 refute. **SP2 must RECORD each attached agent's `provider` value as a first-class
  observation** — the spike cannot interpret its own result without it. Recording is a spike act (read-only);
  **fixing this is not, and is out of scope for SP2 and M19.**
  **2026-07-11 M19 gate — SP2 CONFIRMED it: both real CLI candidates registered `provider:mcp`** (14 recorder events,
  0 vendor-shaped). Disposition **unchanged — stays a recorded constraint, NOT folded into M19** (planner pushback,
  architect-adopted; consistent with the 2026-07-10 out-of-scope ruling). M19 records `provider:mcp` and works within it.

<!-- @item
id: BL-025
status: todo
date: 2026-07-09
epic: null
tags: [live-proof, evidence, gates, friction-m18]
-->
- [todo · **M18 C7 friction item** — the highest-value lesson of the epic; a proof that cannot fail is not
  evidence] — **Live proofs need a mandatory A/B baseline and a fresh-recorder assertion** — M18-T3 shipped a
  passing live proof that **passed identically on the unfixed code** and survived six gate-2 rounds
  (**IP-15**). Separately, `scripts/m17-live-gate-proof.mjs` asserts against a **committed** NDJSON file rather
  than the run's own recorder output, so it can print `LIVE SMOKE PASSED` with no recorder attached (M17 finding
  **G2-1**, still open — it printed a spurious FAILED during the M18-T2 gate-3 run). **Evidence:** M18-T3 gate-3
  refute; M17 ledger G2-1; M18-T2 task-end review. Fix sketch: a live-proof convention — every proof states its
  A-side (the bar failing on the pre-change baseline) and asserts on a **fresh** recording path unique to the run.
  **2026-07-10 backlog gate:** the **mechanism stays parked** (PO ruled the evidence-determinism work comes "in
  time"), but two **constraints bind SP2 and M19 now**, because the defect in this item's body is live: (a) **do
  not use `scripts/m17-live-gate-proof.mjs` as evidence** — it can print `LIVE SMOKE PASSED` with no recorder
  attached; (b) M19's DoD must state **how a recorded `workflow_gate_event` is distinguished from an injected
  one**. C3's reopen condition already demands "actual coordination, **not a proof**" for exactly this reason:
  M18-T3's log could not tell an agent that *chose* the envelope from a bridge that *stapled it on*.

<!-- @item
id: BL-026
status: done
date: 2026-07-09
epic: M19
tags: [attach-mode, ergonomics, real-cli, friction-m18]
-->
- [done · **M19-T2 DELIVERED & MERGED 2026-07-11 (`acdb0cd`), Gate 2+3 VERIFIED** — supported attach ritual (`scripts/m19-real-cli-attach.mjs`) for Codex CLI + Claude Code; Claude `await_turn` permission wall (SP2) CLEARED via `--allowedTools`; no global config mutation. · was: todo · M18 C7 friction item, re-filed from evidence] — **Attaching a real CLI session is a hand-assembled ritual** — every real-CLI
  attach in M18 required hand-writing an `mcpServers` JSON with an absolute `bridge.mjs` path, a WS URL, an
  `agentId`, and the contract hash — done ad hoc four times today (twice by the implementer, twice by the
  task-end reviewer) with a `creating`-state trap waiting for anyone who forgets `POST /api/agents/:id/start`.
  **Evidence:** LB-66; `design/evidence/m18-t3a-proof-a.txt` / `-b.txt`; M18-T3a Gate-1 condition 3.
  **This is the friction standing between "the channel works" and "the team uses the channel"** — rank it high
  for M19. Fix sketch: a committed `.mcp.json` template + an `attach-real-session` runbook/script that registers,
  starts, assigns the role, and prints the config.
  **2026-07-10 backlog gate — ranked #1 for M19-T1, and SP2 discharges half of it for free.** It is *not* strictly
  necessary for SP2 (the ritual has been hand-performed four times; a fifth is possible). But a spike is
  read-only/probe/**docs** by definition (workflow:289), so SP2 must perform the ritual anyway and can **emit the
  runbook as a spike deliverable at zero production code** — written from evidence rather than guessed. The
  `.mcp.json` template + script (production tooling) stay for M19-T1.
  **2026-07-11 M19 gate — re-sequenced to M19-T2 (after BL-018-lite T1).** SP2's finding is that the *stale client
  contract* must be fixed before a supported attach ritual can be blessed (you must not certify a runbook while the
  sibling client can fail by design). SP2 discharged the docs half (runbook: `design/evidence/sp2-attach-runbook.md`);
  the production `.mcp.json` template/script + the **Claude `--allowedTools`/`--permission-mode` pre-approval proof**
  (`await_turn`/`consensus_respond`/`send_to_agent`/`submit_plan`) remain for T2.

<!-- @item
id: BL-027
status: done
date: 2026-07-09
epic: M19
tags: [metric, program, self-hosting, friction-m18]
-->
- [done · **M19-T3 DELIVERED & MERGED 2026-07-11 (`f5f975a`), Gate 2+3 VERIFIED** — 2 real attached CLIs (Claude + Codex) carried provenance-proven substrate relays the brain accepted; BL-027 ratio reported T3 2/4, milestone 2/~9. **CAVEAT: those are demonstration relays (narrow-A), NOT organic burden reduction — 2/~9 is 'capability proven + first data point', not a productivity stat.** Program C3 discharged (qualified); organic burden-reduction measurement is future work. · was: doing · M19 *is* this item's work. C3's
  reopen condition requires reporting the ratio beside the raw count, so the epic cannot close without it
  (workflow:362 — when an item's work opens as an epic, the item goes `doing`). · was: todo ·
  **M18 C7 friction item** — the program's headline metric can move for reasons that have nothing to do
  with the program] — **Relay count has no denominator** — the counting rule (program draft) counts *relays*,
  but a task's raw relay count also moves with **how many review rounds it happened to need**: M18-T1 = 9 relays
  (3 gate rounds), M18-T2 = 2 (1 round), M18-T3a = 8 (4 rounds) — none of which reflects substrate adoption,
  which stayed **0 substrate events all epic**. A smooth epic can therefore "prove" a relay fall it never earned.
  **Evidence:** the three M18 Coordination Evidence blocks; PO↔architect exchange 2026-07-09. Fix sketch: report
  the **ratio** — of all role→role hand-offs in a task, how many the substrate carried vs. the terminal — beside
  the raw count. The ratio holds review-round noise fixed and measures the only thing the program changes.

<!-- @item
id: BL-028
status: todo
date: 2026-07-10
epic: null
tags: [engine, m03, dead-code, false-claim, fault-tolerance]
-->
- [todo · **dead mechanism + false feature claim; found while scoping M19, PO-approved to file 2026-07-10**] —
  **The idle timeout has never been able to fire** — `agentIdleTimeoutMs: 180000` is configured
  (`registry/config.ts:12`) and swept every 30s (`registry.ts:155`), but `hasAgentTimedOut()` short-circuits on
  `if (!agent.lastProgressAt) return false` (`registry.ts:663`) and **`lastProgressAt` is never assigned** —
  declared at `agents/agent.ts:28`, read twice, written nowhere in either repo (exhaustive grep incl. dynamic
  write paths). Doubly dead: only `status === 'busy'` agents are swept at all. **Consequence:** a *hung* agent is
  never detected. Clean disconnect → `terminated` (M05) and explicit `error` propagation both still work; it is
  wedging that goes unseen — verbatim the Hermes failure mode (LB-49). **No test covers it**: the only idle test
  (`__tests__/team-worker-effect-fence.test.ts:70-71`) asserts the *exemption* predicate, so it passes identically
  whether the timeout works or not — **IP-15 in our own suite**, shipped by M08-T3, which added a guard against a
  timeout that could not occur. `AGENT.md`'s M03 "including idle timeouts" claim corrected 2026-07-10.
  **Evidence:** LB-70. **Not a blocker for M19** (the sweep cannot kill a slow real-CLI conversation — we are
  accidentally immune). **Fix sketch — and the ordering is load-bearing:** do **not** land the timeout alone. The
  moment the sweep goes live, an agent paused `awaiting-input` (blocked on a human) is observationally identical to
  a dead one and M03 kills the team task for an agent that behaved correctly. Land it **together with** the typed
  non-reply `reason` from LB-67 Finding 1 (`turn-ended · exited · quiet · user-stopped · errored · awaiting-input ·
  receiver-cancelled`). One piece of work, not two.

<!-- @item
id: BL-029
status: todo
date: 2026-07-11
epic: null
tags: [process, governance, reassignment, rating, sm, honesty]
-->
- [todo · **earned by a real failure, not pre-written: filed after the SP2 attach breach, PO-approved 2026-07-11**]
  — **No signal tells the SM *when* to reassign an under-performing agent** — the reassignment *authority* is fully
  specified (SM owns it, LB-34; standing conditional reassignment, LB-38; PO overrides) but the **trigger** is a
  gut call. When the SM judged Gemini "over-matched" on SP2 and proposed swapping in Codex, that call rested on
  *vibes*, not a durable, auditable per-agent record. **Gap:** a **per-agent capability / track-record signal** the
  SM reads to decide reassignment (and inception assignment). **The raw signal already exists, un-aggregated** —
  `implementer-pitfalls.md` (reviewer-authored failure case law), per-task closure telemetry + verdict rows
  (`*-implementation.md`: VERIFIED-first-pass vs. REFUTED-and-redelivered), and per-agent `lessons/*.md`. This item
  is to **aggregate them into a reviewer-fed, never-self-fed per-agent dossier.** **Four hazards the design must
  answer (else it does harm):** (1) **attribution is known-broken** — same reason we run agents serially
  (per-provider meter, not per-actor); a miss may be the plan's / environment's / an impossible task's fault, not
  the agent's; (2) **difficulty confound** — SP2 is the trap: Gemini's "miss" may be a task that is *impossible
  in-scope* (the fence forbids the `bridge.mjs` edit the attach needs), so it must **normalize by task
  difficulty/feasibility**; (3) **honesty-gaming — the load-bearing one** — rating on "green" incentivises exactly
  the scope-creep-green the *Honesty over Results* section forbids, so it must **reward an honest RED and penalise a
  scope-creep GREEN**, i.e. rate *scope discipline + honesty*, not pass/fail; (4) **sample size** — N=1 is noise; a
  *pattern* of breaches counts, a single one should not tank a rating. **Not an ELO number** — a lightweight dossier
  in the project's own idiom. **Evidence:** SP2 breach + revert (`design/spike2-consensus-real-cli-implementation.md`
  2026-07-11 finding); grep confirms no prior rating mechanism exists (all repo "capability" hits are *transport*
  capability, not competence). **Stub:** `design/agent-rating-signal-note.md`. **Deferred:** revisit when M19 yields
  more data points — nothing to implement yet.

<!-- @item
id: BL-020
status: done
date: 2026-07-09
epic: null
tags: [self-hosting, robustness, attach-mode, runtime-core]
-->
- [done · was: todo, absorbed into M18-T2 at the 2026-07-09 gate (BL-021); **CLOSED at the T2 merge
  `872bfed` (2026-07-09)** — fix live-proven at gate 3 (disconnect race fired, contained, orchestrator
  survived) · found live at M17-T3 gate-3 close (flywheel catch: live run surfaced it, suite never did)] —
  **Orchestrator crashes on attached-client disconnect during an in-flight turn** — when MCP
  proof clients disconnect at teardown, `InProcessAgentDriver.loop` races the clean-disconnect path: exec
  fails with "entered 'terminated' state during exec", the loop then attempts `terminated -> busy` /
  `terminated -> error` transitions, `Agent.setStatus` throws, the throw escapes the driver loop and **kills
  the whole orchestrator process** (observed exit 1; full stack in the M17 ledger gate-3 close). Pre-existing
  `runtime-core` defect (M17 touched none of these files); out of M17's fence — recorded, not fixed. Fix
  surface: `packages/runtime-core/src/agents/in-process-driver.ts` error path must tolerate terminal states.

<!-- @item
id: BL-017
status: done
date: 2026-07-09
epic: null
tags: [self-hosting, attach-mode, baton, handshake, wire-contract]
-->
- [done · was: todo · **CLOSED at the M18-T3a merge** (AgentTalk `e1a4346`, client `9af84c7`, 2026-07-09) —
  gate 3 VERIFIED on an independently reproduced A/B (unfixed bridge rejected `got undefined`; fixed bridge
  injected the hash and a real `claude` CLI natively emitted baton + workflowEvent, brain-accepted) ·
  **DIAGNOSIS CORRECTED 2026-07-09 after the Door 1 live proof (LB-66)** — the original text below was wrong;
  kept struck-through for the record · was absorbed into M18-T3a (T3 died at gate 3, superseded)] —
  **Real CLI sessions cannot ATTACH: `bridge.mjs` never injects `contractHash` at `initialize`** — a real CLI
  (Claude Code / Codex CLI / agy) sends its **own** `clientInfo` and cannot know our wire-contract hash;
  `mcp-server.ts:150` requires `params.clientInfo.contractHash` at `initialize` and closes the socket (1008,
  `got undefined`) — so real CLI sessions never connect, and therefore never send anything. Live-observed
  2026-07-09 with a real `claude` session; with the hash injected, the **same** session natively emitted
  `send_to_agent` carrying `baton` + `workflowEvent`, brain-accepted under M17 authority
  (`design/evidence/m18-door1-real-cli-proof.ndjson`). **Fix:** the bridge injects the hash it already receives
  in its URL (`?contractHash=...`); transport-only, no protocol logic in the relay.
  ~~*Superseded diagnosis (M16 D1 / LB-62): "the exec-bridge translation layer cannot carry `baton` arguments."*~~
  **False as a transport claim** — the relay always carried structured args verbatim (proven by A/B against the
  pre-fix bridge; **IP-15**). Every prior "live proof" used SDK MCP clients, which **do** set
  `clientInfo.contractHash`, which is why the real wall stayed hidden for three epics. Note `llm-agent.mjs` was
  never blocked either (SDK client → sets the hash); its only limit is that it has no `send_to_agent` emission
  path (LB-64/LB-65). Source: LB-66, M18-T3 gate-3 refute, IP-15; was M16 ledger D1, LB-62.

<!-- @item
id: BL-015
status: deferred
date: 2026-07-08
epic: null
tags: [self-hosting, scope-fence, governance, harness]
-->
- [deferred · **DEFERRED at the 2026-07-10 backlog gate (PO + architect, sitting together)**. **PO ruling
  (2026-07-10): governance moves to a *ranking* model, not a fencing one** — "external agent unfaithfulness is
  uncontrollable by definition; we'll have a ranking system. If the agent is not fit for the role, just flip
  do-not-use." L1/L2 are therefore not the road. **Reopen condition:** *when the ranking system needs a
  detection signal a fence would supply, or on explicit PO revisit.*
  **⚠️ TWO FACTS ANY FUTURE PLANNER MUST READ FIRST (LB-69, 2026-07-10) — this item is not safe to plan as
  written:** (1) **an ownership hole**: this item's non-goals defer authority/identity enforcement to M17
  (`scope-fences-design-note.md:72`), but M17 only refuses a *falsely-labelled* `workflowEvent` — and
  `workflowEvent` is **optional** on `send_to_agent` (`mcp-tools.ts:74`, required = `['to','payload']`). M17
  governs the truthfulness of a **claim**; it never binds a **role** to a **capability**. **Neither document
  owns role→capability enforcement, and each believes the other does.** (2) **L2 contradicts M05**: L2 assumes
  "launch machinery provisions the task branch + a fenced worktree," but M05's founding premise is that provider
  MCPs are **externally launched by the operator**. *You cannot deterministically constrain a process you did not
  launch.* L2 therefore requires attach mode to grow a **launched** variant — i.e. AgentTalk becomes a supervisor
  owning process + filesystem, not merely a wire. That is precisely the road Traycer took, and their host is the
  **closed** half of their repo (LB-67). **This is an unnamed architectural decision, and it is the PO's.**
  **Also (LB-69 Finding 2, empirical):** classifying all 16 `IP-N` cases against a deterministic file fence gives
  **3 prevented** (IP-5, IP-6, IP-12) and **≥7 untouched** (IP-1, IP-2, IP-3, IP-4/IP-8, IP-13, IP-15). The
  untouched column is not "did a forbidden thing" — it is "**said a false thing**." Our dominant failure class is
  **evidence dishonesty**, which no fence at any tier touches. This item's own principle 4 ("necessary, not
  sufficient") is thereby quantified. · was: todo · **L0 absorbed into M18-T1 at the 2026-07-09 gate (BL-021)** — the guinea-pig shakedown epic; item
  stays open for L1/L2, which share the M19 gate with BL-014 · PO+Architect, 2026-07-08 (mid-M16) —
  evidence-driven from a live violation] — **Deterministic scope fences — machine-readable per-task
  scope manifest + layered enforcement** — move the implementer scope fence from *policy* (prose RoE +
  self-discipline) to *mechanism* (the environment refuses or loudly flags out-of-scope acts). Design note:
  `design/scope-fences-design-note.md`. **Evidence:**
  during M16-T2a an implementer found a real bug, spec'd the fix, then made changes beyond task scope
  (acknowledged after); same failure class as IP-2 / IP-9 / IP-12 / IP-13 — different agents, same broken
  behavioral rule. **Policy source already exists:** each ledger task's "Allowed/Forbidden surfaces" prose —
  formalize it as a per-task scope manifest (allowed/forbidden globs). **Layered shape (build in order):**
  **L0** manifest + `scope-check` script diffing the tree against it (detective; run at implementer Rule-5
  self-check, gates, CI — ≈a day, candidate M18 rider); **L1** provider-level preventive guards (e.g. Claude
  Code PreToolUse hook blocking out-of-manifest writes; per-provider, weakest portability); **L2**
  substrate-administered: the baton carries the manifest, the launch machinery provisions a fenced worktree
  (kills IP-12 as a side effect), violations become recorded runtime events the flywheel counts —
  **two halves of one thing with BL-014 role-skill injection: the seat's law, served AND enforced at attach —
  gate them together (M19).** **Design principles (binding):** stopping must be cheaper than proceeding (the
  fence message IS the deviation-report template); fences amended only at gates (the T2a flow, made physical);
  fence product code, keep tests/scratch free; file fences are necessary-not-sufficient (semantic pokes like
  the M15 `as any` and IP-13 mock-arounds remain reviewer work). Also consider a time/tool-call circuit
  breaker as backstop (proxy signal — rank below file fences).

<!-- @item
id: BL-014
status: deferred
date: 2026-07-08
epic: null
tags: [self-hosting, role-skill, governance]
-->
- [deferred · **DEFERRED at the 2026-07-10 backlog gate (PO + architect, sitting together)** — the re-gate its
  own note called for has now happened: M17 closed and delivered the session→identity→role mapping, so this
  item became rulable, and the ruling is *not yet*. **Reason:** serving role briefs over the substrate is
  premature while the substrate has carried **zero** real role→role hand-offs (M18 closed with 0 substrate
  events; C3 DEFERRED). Build the channel's first real use before administering governance over it.
  **Reopen condition:** *after M19 demonstrates that the substrate carries actual coordination (C3's reopen
  condition met — ≥1 recorded `workflow_gate_event` from a real attached CLI doing real work, plus the
  BL-027 ratio).* · was: todo · M19 candidate — ruled at the 2026-07-08 gate (options were M18 rider / M19
  candidate / parked); re-gate after M17 delivers the session→identity→role mapping] — **Role-skill injection — brain-served
  role briefs at attach** — condense the scrum workflow (roles, gates, batons, origin tags, Rules of
  Engagement, primer handshake) into a brief the substrate serves at attach time: "you are `<role>`; here
  is your law" — versioned from the repo, identical for every provider, recorded like any message. Rides
  M17's session→identity→role mapping; would collapse primer-handshake drift (the brain knows what's fresh)
  and administer the 2026-07-08 role-only governance model (`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`) over
  the channel instead of per-CLI context files. Source: PO idea 2026-07-02 + architect read,
  `design/self-hosting-program-draft.md` §Candidate.

<!-- @item
id: BL-032
status: done
date: 2026-07-12
epic: null
tags: [attach-mode, conversation, healthcheck, validation-blocker, tester-finding]
-->
- [done · **merged to master 2026-07-12 (PO-resolved; Gate 2 PASS, Claude; commit 7dc3f19)** · Tester finding 2026-07-12 during BL-031 validation run (LB-78) — blocked real UI validation of
  BL-031 until fixed or bypassed by an explicitly approved test harness] — **Attach-mode pair chat can fail before
  conversation creation because one attached client never receives/processes the startup healthcheck** — in the
  human-driven BL-031 validation attempt, the UI sent `start_pair_chat` for `bl031-source` + `bl031-target`; the
  backend sent healthchecks to both; `bl031-source` acknowledged every attempt; `bl031-target` stayed connected and
  `ready` but never logged/processed the healthcheck turn, so `ConversationCoordinator.startConversation()` timed out
  after 30s and no conversation was created. That means the inline pending-relay UI could not be exercised at all.
  Evidence: LB-78; backend log lines `Sending EVT ... healthcheck` for both agents followed by
  `Agent bl031-target did not respond to healthcheck within 30000ms`; source `agentalk-mcp-client` logged
  `Received turn`; target companion did not. Suspected shape: attached provider-labelled agents consume
  `awaitExecTurn()` while conversation startup uses `sendProtocol(... EVT ...)` / `queueTurn()`, but this is a
  lead, not a verdict. Fix should preserve existing M20 relay behavior and must not silently weaken healthchecks.
  Plan: `design/bl-032-attach-pair-chat-healthcheck-plan.md` (Gate 1 passed after conditional fold).

<!-- @item
id: BL-033
status: done
date: 2026-07-13
epic: null
tags: [attach-mode, conversation-lifecycle, mcp]
-->
- [done · closed by PO-driven real-provider validation 2026-07-13 (LB-88); surfaced during the BL-031 real-provider validation run (LB-86)] — **MCP pair-chat agents remain busy after
  conversation_end**. After both a natural reply-limit completion and an operator Stop completion, the conversations
  were correctly marked `completed`, but the involved MCP agents stayed in `busy` status and the real
  `agentalk-mcp-client` processes continued waiting for turns. Suspected implementation shape: `conversation_end` is
  sent through the semantic `queueTurn` path for the in-process conversation driver, while the external MCP client is
  blocked on the exec-turn path; additionally, the in-process driver stop path does not restore the agent from `busy`
  to a terminal/ready state after handling the end event. Scope this separately from BL-031: preserve the verified
  Continue/Stop relay gating behavior, and make pair-chat completion cleanly settle attached agents/clients without
  leaving stale busy state. **Implementation pass 2026-07-13 (LB-87):** targeted runtime fix added; pending
  independent reviewer validation. **Validation pass 2026-07-13 (LB-88):** real Codex and Claude companion clients
  received `conversation_end` and shut down on both reply-limit and operator Stop completion; final agent states were
  `terminated`, not stale `busy`.

<!-- @item
id: BL-031
status: done
date: 2026-07-12
epic: null
tags: [ui, relay-approval, ux]
-->
- [done · **MERGED 2026-07-13 — real-provider validated (LB-86: Continue/Stop works) after the LB-79→LB-85 rework saga; backend gate-2 by Claude, inline UI accepted on live validation, PO-directed merge**; surfaced 2026-07-12 by the PO during the first un-scripted UI-driven relay run (LB-77); reframed same
  day from a sidebar-card patch into the redesign below — the patch is **superseded**, do not do both] —
  **Inline relay approval in the conversation window** — move agent→agent relay approval *out* of the cramped
  sidebar card and *into* the main conversation thread. **Root cause of the observed confusion:** today the main
  window (`ConversationTranscript`) shows only *delivered* messages, while the pending message + Approve/Deny live
  in a separate sidebar card (`apps/web/src/RelayApprovalPanel.tsx`, payload truncated ~54px) — so the operator
  reads the decision in one place and its context in another, and the held message isn't in the conversation flow
  at all until after approval. **Redesign (PO spec, 2026-07-12):** (1) render each agent message in the **main
  conversation window**, not the sidebar; (2) put **Approve / Deny directly below** the message awaiting a
  decision; (3) **lightly highlight** the message that is still pending. **Refinements:** design for **N pending
  relays at once** (a 3+ agent setting can hold several — each gets its own inline buttons; don't assume exactly
  one), and decide whether the sidebar `RelayApprovalPanel` is retired or kept as a global/fallback view (primary
  surface becomes the conversation window). Data is all present (main view has the conversation; `pendingRelays`
  carries from/to/payload) — a moderate frontend change, **no backend change**. Supersedes the earlier
  "make the sidebar cards visually distinct" patch. **Tester validation result:** the core backend path works after
  BL-032, but the branch's UI is not acceptable yet: the sidebar approval panel remains as a duplicate primary
  approval surface, the inline pending card is visually heavy rather than lightly highlighted, and the layout still
  leaves the operator deciding between two approval surfaces. **Implementer rework 2026-07-13 (LB-80):** active
  conversation relays are no longer duplicated in the sidebar approval controls, and the inline pending card was
  toned down to a message-level highlight. **Retest failure 2026-07-13 (LB-81):** after browser refresh, the web UI
  receives the pending relay but does not restore the active conversation context, so the same approval falls back
  into the sidebar instead of rendering in the main conversation panel. **Additional retest finding 2026-07-13
  (LB-82):** even when the panel is visible, it is not an intelligible conversation audit surface: the topic is not
  prominent, coordinator↔agent events are hidden or collapsed away, and the operator cannot inspect the actual
  message content/flow needed to understand why a relay is awaiting approval. **Implementer rework 2026-07-13
  (LB-83):** the active conversation is restored from history/pending-relay state after refresh, the main header
  now foregrounds the topic/participants, the transcript timeline includes coordinator system rows, and pending
  relays render inline as timeline items. Awaiting joint visual retest; no headless test was run per PO instruction.
  **Retest failure 2026-07-13 (LB-84):** the panel still exposes relay mechanics rather than the intended
  conversation-control model. The operator expects a turn-by-turn agent conversation: show one proposed agent message,
  offer **Continue / Stop** on that message, deliver it only on Continue, then show the next agent's reply proposal,
  repeating until the conversation ends with agreement or non-agreement. **Implementer rework 2026-07-13 (LB-85):**
  pending conversation relays now render as the current proposed turn with **Continue / Stop** actions, Stop denies the
  pending turn and closes the active conversation, delivered turns remain as history, and the header shows waiting /
  in-progress / stopped / ended state. **Real-provider validation 2026-07-13 (LB-86):** with real
  `agentalk-mcp-client` + Gemini/Antigravity execution and PO-driven browser actions, Continue held and delivered
  proposed turns correctly, and Stop denied a pending turn and completed the conversation without delivering that
  turn. Residual lifecycle cleanup issue split to BL-033. Source: LB-77 + PO design note + LB-79 + LB-80 + LB-81 +
  LB-82 + LB-83 + LB-84 + LB-85 + LB-86.

<!-- @item
id: BL-035
status: todo
date: 2026-07-13
epic: null
tags: [tester, observability, artifacts, browser]
-->
- [todo · surfaced 2026-07-13 during autonomous Tester instrumentation rehearsal] — **Tester run artifacts:
  durable testlog + passive screen recording** — the Tester role now needs replayable validation records, not only
  chat-local narration. `design/testlog.md` exists as the durable index, but artifact capture is still manual and
  lossy: Browser Use screenshots currently overwrite a temp path, logs are not bundled, and no `.webm` recording is
  saved. Implement a lightweight Tester harness convention that creates `design/test-artifacts/<test-id>/`, captures
  targeted screenshots and logs, and, when available, records a passive browser/session `.webm`. The recording is an
  offline human-review artifact and must not be AI-analyzed by default; only paths and metadata go into context unless
  the PO requests a specific visual review. Prefer a browser-harness or tab-level recording path that does not add
  token cost; fall back to screenshot checkpoints when recording is unavailable.

<!-- @item
id: BL-034
status: todo
date: 2026-07-13
epic: null
tags: [observability, ui, attach-mode, client-repo]
-->
- [todo · surfaced 2026-07-13 (PO + Claude design chat)] — **PTY-tee observability panel — surface each attached
  agent's real interactive TUI beside the AgentTalk UI** — the attach client (`agentalk-mcp-client`) already runs each
  provider as its **real interactive TUI inside a PTY** (`claude-pty.mjs` / `codex-pty.mjs` / `gemini-pty.mjs`,
  node-pty): it types the prompt in as keystrokes and reads the screen back. That TUI stream already exists but is
  **consumed silently** by the executor to parse the answer (`llm-agent.mjs` forwards only `stderr`, not the PTY
  `stdout`). **Proposal:** add a **flow-neutral observer tee** of `pty.onData` to a per-agent sink (log file or a
  second read-only PTY), then view it live via a web terminal (**wetty**/**ttyd**, or an embedded xterm.js panel) next
  to the conversation panel — giving the PO real-time visibility into what each agent is *actually doing* (thinking,
  tool calls, errors), not just the orchestrator's final messages. **Scope/notes:** the tee lives in the *ancillary*
  `agentalk-mcp-client` repo (pure-relay today — small observability addition, no orchestration-path change); it is
  **read-only** (typing into the mirrored TUI would fight the client's keystroke puppeteering — a true take-the-wheel
  hand-off is separate, larger work); and it exposes a shell/CLI stream, so any non-`localhost` surface needs
  auth/TLS. Related: the TUI-scraping model is also why provider "thinking" preamble sometimes leaks into replies.
  Source: 2026-07-13 design discussion following the wetty question.

<!-- @item
id: BL-036
status: todo
date: 2026-07-13
epic: null
tags: [governance, worktree, parallel-dev, process]
-->
- [todo · surfaced 2026-07-13 (PO decision LB-90)] — **Define a parallel-code-development worktree discipline** —
  LB-90 relaxed the serial-actor rule for *everything except code development*; the **blocker to lifting the code-dev
  half is a deliberate worktree discipline.** Three near-misses on 2026-07-13 showed the collision surface: a parallel
  session advanced `master`/primers under an in-flight session (stale primer within minutes); a delivery arrived
  **uncommitted in two worktrees on two branches** (the BL-033 mess); origin advanced twice under a running session;
  and two actors independently claimed the same backlog id (BL-035). **Design a convention that makes concurrent code
  work collision-safe:** per-task worktrees + branch-naming (`task-<id>`), who-owns-`master` / merge serialization,
  how uncommitted work is isolated (never the same edits uncommitted in two trees), backlog-id allocation without
  races, and stale-worktree/branch cleanup at close. Deliverable is a short discipline doc + any tooling
  (e.g. an id-reservation or worktree-create helper). When adopted, LB-90's code-dev restriction can be lifted.
  Source: LB-90 + the 2026-07-13 coordination near-misses.
  **UPDATE (PO mandate, 2026-07-16):** worktrees are now **mandatory for all code development** (recorded in AGENT.md,
  Resource-Monitoring interim rule) — the policy call is made and LB-90's code-dev restriction is lifted under it.
  This item's remaining scope narrows to the **discipline detail + tooling** (branch-naming, merge serialization,
  id allocation without races, stale-worktree cleanup, and the per-agent `workdir`→worktree assignment used by the
  launcher / Hermes). Doubles as the **autonomous-agent safety sandbox** for the Bite ladder.

<!-- @item
id: BL-037
status: done
date: 2026-07-15
epic: null
tags: [self-hosting, launcher, agents, on-demand]
-->
- [done · 2026-07-15 (merged)] — **HTTP launcher: launch agents on demand, no shell command** — Option A of
  `design/http-launcher-proposal.md`. New `agent-launcher` service in `agentalk-mcp-client` (`lib/agent-launcher.mjs`
  core + bin, binds `127.0.0.1`): `POST /agents` creates+starts the agent via the orchestrator's existing HTTP API
  and spawns the `llm-agent` harness locally, which attaches over WS as a manual launch would; plus `GET /agents`,
  `DELETE /agents/:id`, `GET /healthz`. **Orchestrator core untouched** — the M05 "orchestrator launches nothing"
  invariant is preserved (integration 5a). Built by Claude as temporary implementer (PO-directed, agy offline);
  E2E-validated (real launcher → real orchestrator-stub HTTP → real harness spawn → real WS attach); full suite
  20/20, lint clean; PO-gated merge (`agentalk-mcp-client` master). **Follow-on (todo):** wire the web UI "start
  agent" button to `/agents`, and make readiness reflect the real WS-attach event, not the launcher's `201`
  ("launched ≠ ready"). Why: first concrete "create a team on demand" piece toward the autonomous-development goal.

<!-- @item
id: BL-038
status: todo
date: 2026-07-15
epic: null
tags: [self-hosting, attach, native-loop, goose, openrouter, provider-diversity]
-->
- [todo · surfaced 2026-07-15 (PO)] — **Native-loop attach lane via Goose + OpenRouter** — enable MCP-attach agents
  backed by OpenRouter models, driven by **Goose** running the `attach-skill.md` poll loop
  (`await_turn`→work→`submit_*`→`await_turn`). This is the **native-loop/skill lane** (M05 open follow-up), distinct
  from the built PTY-harness lane (claude/codex/gemini via `llm-agent.mjs`). Value: restores **independent agents
  (workers AND reviewers) without Codex/agy**, and adds provider diversity for Bite 1+. **Known blocker:** the
  server demands `clientInfo.contractHash` at `initialize` (LB-66); a generic MCP client can't know it — needs a
  bridge that injects the hash (à la `bridge.mjs`/BL-017) or server-side handling for skill-path agents. Deliberately
  **off Bite 0's critical path** (Bite 0 uses the built Claude-via-launcher worker). Source: PO, this session.

<!-- @item
id: BL-039
status: done
date: 2026-07-16
epic: null
tags: [self-hosting, bite0, launcher, observability]
-->
- [done · 2026-07-16 (merged `agentalk-mcp-client:9090f37`, PO-gated)] — **Bite 0 launcher: NDJSON run-artifact
  capture (D6)** — added an **optional** injected `record()` effect to the launcher core emitting `run-start →
  agent-launched → goal-delivered → (cap-breach) → outcome`, plus a default `createNdjsonRecorder(filePath)` sink
  honoring `config.instance.recording`. Recording is optional (absent → no-op; existing callers unchanged) and
  best-effort (a throwing sink never disturbs the run); the core stays pure (no clock) — time+fs live at the
  recorder edge. No pre-existing session recorder to reuse, so the sink was written fresh. Tests: record-sequence
  (happy + cap-breach + best-effort), NDJSON round-trip, runner→file E2E. **Verify:** stash-and-rerun proved the
  new tests depend on the fix (4 fail without it) while the 11 pre-existing tests stayed green (D7 preservation);
  full sibling suite 38/38, lint clean, BL-037 untouched. Independence caveat: authored+reviewed by Claude (sole
  agent, resource fallback). Source: Bite 0 delivery, deferred honestly. This merge also landed the Bite 0 launcher
  core itself (`a86733d`), previously committed-but-unmerged.

<!-- @item
id: BL-040
status: done
date: 2026-07-16
epic: null
tags: [self-hosting, bite0, live-validation, acceptance]
-->
- [done 2026-07-16 · PO-witnessed · **Bite 0 COMPLETE (D1–D6)**] — **Bite 0 launcher: live run against a real
  CLI (acceptance)** — the PO-babysat acceptance step from the Bite 0 plan §6. The core + cap are proven hermetically
  and by E2E (real BL-037 launcher + real spawned harness + real wall-clock termination), but the **live** path —
  the launcher *starting a real orchestrator instance* (D1's instance-start, stubbed in the E2E) and driving a real
  authed provider CLI to complete/​fail a real bounded task — is unexercised. Prereqs on this machine: **build the
  main repo** (`npm install` + `tsc` build; currently absent — no `node_modules`/`dist`) and confirm an authed CLI.
  Deliverable: one supervised live run to COMPLETED and one forced cap-breach, with the artifact from BL-039.
  Source: Bite 0 delivery §6.
  **Investigation 2026-07-16 (Claude, temp implementer) — prereqs met + build mapped:** main repo now **builds**
  (`npm install` + `tsc -b` clean; suite not re-run) and the **orchestrator boots cleanly** (`node
  apps/orchestrator/dist/index.js`, "Ready to manage agents.", `GET /api/agents`→200). **Authed `claude` CLI present**
  on PATH (+ codex/gemini/agy); **meter :9899 UP** (`claude ok:true`, session ~34%, weekly ~4%). **Key live finding
  the E2E stubs hid:** the orchestrator's **MCP server is on a DYNAMIC separate port**, announced in stdout (`MCP
  server URL set to: ws://localhost:<port>/`) — *not* the fixed `ws://…:3000/mcp` the example config assumes; the
  real `startInstance` must parse the announced URL. **Build map:** a real-deps entrypoint (default `scripts/
  launcher.mjs`) wires the `bite0-launcher` core to real effects; the attach flow mirrors **`scripts/m19-real-cli-
  attach.mjs`** (`POST /api/agents {provider:'mcp'}` → `/start` → real CLI attaches via `bridge.mjs` over the SHA-256
  wire-contract handshake → `await_turn` → goal turn → outcome via server log/status). **Remaining unknowns (the
  babysat part):** real goal-delivery + outcome-detection semantics against the live orchestrator, and the real
  authed-CLI worker turn (D4). D1 (instance-start) + D3 (cap) are verifiable solo with a fake-bridge worker.
  **D1/D3/D6 slice MERGED** (`agentalk-mcp-client:1e80ef6`, PO-gated): real `startInstance` (parses the orchestrator's
  DYNAMIC MCP url from stdout), BL-037 launch, meter, NDJSON — verified live (attach + wall-clock cap termination).
  **D4 mechanism PROVEN live + sandboxed (babysat probe 2026-07-16), NOT yet baked into the launcher:** deliver a
  goal to a lone worker via a **`worker-only` team** — `POST /api/teams {members:[{agentId,role:'worker'}]}` then
  `POST /api/teams/:id/task {description}` — which `assignTask` sets to `delegated` (skips planning) and delivers to
  the worker as an `exec_rpc` (wrapped in the worker-protocol prompt + the git-worktree mandate, `cwd:/tmp/
  agentalk-task-<id>`). **Completion signal = `team.status: completed`** (task: `delegated → in_progress →
  completed`). A real `claude` worker completed a trivial goal with a correct `work_accept` answer (captured in the
  session recording). **⚠️ Sandbox requirement (PO):** the orchestrator runs `git worktree add … -b task-<id>` **in
  its own CWD** (`in-process-driver.ts:283`), so it MUST be started with cwd = a throwaway git repo (used
  `/tmp/att-sandbox`) — never the primary AgentTalk checkout, or it creates real `task-*` branches/worktrees there.
  **Remaining for D4/D5:** bake `deliverGoal`(create worker-only team + assignTask) + `waitForOutcome`(poll
  `team.status`) into `scripts/launcher.mjs`; then the deterministic acceptance (one COMPLETED + one forced
  cap-breach) — ideally witnessed via the UI once **BL-048** (UI reactivity) lands. Probe artifacts:
  `/tmp/att-sandbox/session.ndjson`, `agentalk-mcp-client:scripts/explore-launch-worker.mjs` (now tracked,
  `27afae5`).
  **✅ OUTCOME 2026-07-16 — D4/D5 BAKED IN + ACCEPTED. Bite 0 is COMPLETE.** Merged
  `agentalk-mcp-client:34eec6a`. `deliverGoal` creates the worker-only team + assigns the task; `waitForOutcome`
  polls the team's own status. **Deterministic acceptance, PO-witnessed in the UI** (BL-048/BL-049 landed first, on
  purpose — otherwise D4's first run would have been half-invisible for reasons unrelated to D4):
  **(A) COMPLETED** — a real `claude` worker took the goal through the product API and answered; verified against
  the **recording**, not the exit code (`workerAccepted: True`, transcript `d4-worker → user | "pong"`); the PO saw
  the team, its goal and `completed`. **(B) CAP-BREACH** — `cap-wallclock` at 20s with the worker really reaped
  (`pid … exited (signal SIGTERM)`), task still `delegated`. Sandbox containment re-verified: the task branch +
  worktree landed in `/tmp/att-sandbox`, nothing in the real repos.
  **Three things the plan got wrong, corrected here (do not copy the old prose above):**
  (1) **`failed`/`awaiting_operator` DO NOT EXIST** — the TeamStatus contract is
  `idle|planning|awaiting_confirmation|working|completed|interrupted|error`. Waiting on the invented states would
  have made every run die at the cap, looking like the worker's fault.
  (2) **The cap does NOT cover `deliverGoal`** — the runner's cap race starts *after* it (step 4), and a team
  rejects an agent that is not yet `ready` ("must be ready before joining a team"). The readiness wait is therefore
  BOUNDED (`agents[0].readyTimeoutMs`, default 60s); unbounded, it would have hung outside the very rail Bite 0
  exists to provide.
  (3) **The worker's result TEXT is not reachable via the API** — tasks have no read endpoint and completing
  deletes `team.currentTaskId`, so `waitForOutcome` returns the terminal TEAM state; the transcript lives in the
  NDJSON. Stated as a limit, not papered over.
  **Findings raised, deliberately NOT fixed here:** the UI shows *that* a run finished but never *what it produced*
  (**BL-051** — the transcript is already in the browser, one render away); and a worker-only team hands the worker
  a planner-worker prompt claiming *"the planner has created a plan"* when no planner exists — a **ghost plan**;
  it works, but a more suspicious worker could refuse it (coordinator behaviour, out of scope, unrecorded elsewhere
  → worth its own item if it ever bites). **Next rung: Bite 1** (the agent layer that invokes the launcher and
  monitors a live session — do NOT re-conflate the deterministic launcher with that agent).

<!-- @reconciliation-note 2026-07-16
Two development lines forked at 1fbac5e and each independently allocated BL-037..BL-040. On reconcile (PO:
"Bite 0 takes precedence") the Bite 0 items kept BL-037..BL-040; the OpenRouter/tester-thread items below were
RENUMBERED: old BL-037→BL-044, BL-038→BL-045, BL-039→BL-046, BL-040→BL-047. Living docs were updated to match.
HISTORICAL records were intentionally NOT rewritten — in `design/testlog.md`, `design/logbook.md` (LB-91/LB-92),
pre-reconcile git commit messages, and the `task-BL-039` branch name, a bare "BL-037..040" carries its
ORIGINAL (pre-remap) meaning; resolve it via this table. -->

<!-- @item
id: BL-044
status: todo
date: 2026-07-13
epic: null
tags: [consensus, arbiter, api-agents, tester-finding, product-gap]
-->
- [todo · Tester finding 2026-07-13 (TL-005 / LB-91)] — **API-driven multi-agent consensus is non-functional through
  the product; the arbiter is orphaned** — three stacked walls found while trying to run a planner-planner-worker
  "agree on a file to refactor" scenario with API agents (real keys present; these are wiring gaps, not credentials):
  **(1) Arbiter unreachable** — `consensusMode` defaults to `'protocol'` and the only product team-creation path
  (`POST /api/teams` → `createTeam(members, provider)`, `server.ts:738`) never sets `'arbiter'`, so
  `arbiter-coordinator.ts` (the `gpt-4o-mini` convergence Judge) is built but dead from every UI/API control.
  **(2) `POST /api/agents` ignores `providerName`** (`server.ts:593` reads only `{id, provider, model}`) → `api` agents
  default to `google` (`registry.ts:250`); can't create OpenRouter/Nous API agents via the product.
  **→ PROMOTED to BL-046** (2026-07-13; the enabler for the OpenRouter-coordination decision).
  **(3) `google` endpoint 400s** on the consensus tool schema (*"Forced function calling (ANY mode) with response mime
  type application/json is unsupported"*) → API-driven planners can't run the protocol at all.
  **Decisions needed (PO/architect):** wire `consensusMode` to the product **or** retire the arbiter as dead code;
  accept `providerName` in agent creation (unlock non-google API agents); make `buildProtocolToolSchema` compatible
  with Google's endpoint (or route consensus API agents to OpenRouter). Note: the only currently-working consensus path
  is **MCP-attached CLI agents** (`McpCompleter`). The per-reply-**soundness** arbiter from the original scenario is the
  separate "**Conductor/SM agent**" idea (architect). Source: TL-005, LB-91.
  **UPDATE 2026-07-13 — wall (1) RESOLVED + arbiter validated (TL-013):** `POST /api/teams` now forwards
  `consensusMode` to `createTeam` (branch `task-arbiter-enable`, `d06893f`, +2 server tests), so the arbiter Judge
  path is reachable through the product. **Validated live in TL-013**: goose+deepseek planners debated free-form, the
  gpt-4o-mini Judge declared `converged`, and a real plan was synthesized (`awaiting_confirmation`). Walls (2)
  `providerName` → **BL-046** (done), and (3) google tool-schema 400 — both are **API-agent-specific and moot for the
  MCP-attach path** (goose isn't an API completer hitting google; it debates as an attach worker). Remaining on this
  item: consider hardening the **Judge's convergence bar** (TL-013 caveat: it was lax — declared converged though the
  two planners endorsed different ideas). Merge of `task-arbiter-enable` is PO-gated.

<!-- @item
id: BL-045
status: todo
date: 2026-07-13
epic: null
tags: [healthcheck, gemini, attach-mode, tester-finding, root-cause-found]
-->
- [todo · **UN-PARKED 2026-07-16 (LB-93): root cause found — these are the "further facts" the LB-92 park waited for; that park is superseded, see the ROOT CAUSE FOUND note at the end of this item**; was: PO-PARKED 2026-07-13 (LB-92), agy declared unfit as an MCP attach client, fix deferred; Tester finding 2026-07-13 (TL-006); reopens the TL-002 residual] — **Attach-mode Gemini/agy agents time out
  the startup healthcheck (30s)** — re-running TL-001 with real `agy` clients, both agents attached fine but
  `start_pair_chat` failed: `Agent tl006-a did not respond to healthcheck within 30000ms`. **Root cause:** the
  healthcheck reaches an attached agent as a full `exec_rpc` requiring a complete provider-CLI generation (the BL-032
  bridge; the client's prompt asks for a `healthcheck_ack` JSON) — the agy/gemini CLI's cold-start + first-turn latency
  exceeds (or hangs past) the 30s window; the client process stays alive still generating. **Codex acks fine** (fast
  enough — TL-004), so it's gemini-CLI latency, not the `McpCompleter` transform. **Options:** raise the healthcheck
  timeout for slow providers; make the healthcheck a *lightweight liveness ping* that does NOT require a full LLM
  generation (a real fix — the dedicated `handleHealthcheck` path also runs a full turn, `llm-agent.mjs:138`); or
  reduce agy client cold-start latency. Note: contradicts the expectation that this residual was already resolved.
  **Fix attempt 1 (provider-specific timeouts; gemini/agy → 90000ms) — REFUTED at gate 2 (Claude, 2026-07-13, live
  verify):** the timeout *is* correctly raised to 90000 (confirmed in the agy client turn), unit tests pass, but a
  real agy agent **still fails** — `did not respond to healthcheck within 90000ms`, and the client produced **no
  response at all** (process alive + silent past 90s). So the root cause is **not "the timeout was too short" — the
  agy client HANGS on the healthcheck `exec_rpc`** (never produces a `healthcheck_ack`). No timeout value fixes a
  hang. **Real fix must target the agy/gemini client executor** (why the first `exec_rpc` never returns) **or replace
  the healthcheck with a lightweight liveness ping** that doesn't depend on a full agy generation. The
  provider-timeout code is a fine building block but insufficient alone. Source: TL-006, TL-002 residual, LB-89.
  **ROOT CAUSE FOUND 2026-07-16 (LB-93) — the recorded cause above (gemini-CLI cold-start latency) is DISPROVEN.**
  `agy` has **no `mcp` subcommand** (`agy --help`), but the client starts the persistent gemini session as `agy mcp`
  (`lib/executor-runtime.mjs`, `getPersistentProviderCommand`); agy ignores the unknown arg and boots its
  **interactive TUI**, which stays alive, emits nothing, accepts the JSON-RPC stdin write without error, and never
  answers = LB-92's "alive and silent past 90s". Not latency — **it never runs a model at all** (it answers our
  protocol frames on stderr with `failed to send message: no active conversation`, i.e. it read them as chat input).
  The working bridge path (`agy --print`, flags all real) is gated on `AGENTTALK_PERSISTENT_MCP=true`, which **only
  the test suite sets** (`__tests__/exec-rpc.test.ts:222`) — so the working path is test-only and the broken path
  production-only: green tests, broken production. Explains the gate-2 refutation: no timeout fixes a chat UI being
  fed JSON-RPC ("deeper than a timeout" upheld; only the attributed cause was wrong). **Codex acks fine** because
  `codex mcp-server` exists — the discriminator was never speed. Reproduced in ~20s at zero LLM cost via the real
  code path, and now reproduced in the client test suite. **Candidate fix:** set `AGENTTALK_PERSISTENT_MCP=true` on
  the launcher spawn env (there is no "fix `agy mcp`" alternative — an stdio MCP server mode does not exist in that
  binary). **FIXED + VERIFIED LIVE 2026-07-16 (LB-93)** — the env flag alone was **not** the fix; three more things
  were needed, each found by the previous one: (2) **HOME-level `~/.gemini/config/mcp_config.json`** — agy only
  spawns MCP servers from there; a **project-local** mcp_config is *discovered then silently ignored*
  (**antigravity-cli#60**, open, agy v1.0.0 — its impact note names orchestration agents exactly), which is why
  `agy plugin validate` passes (`✔ mcpServers : 1 processed`) on a workspace plugin that loads nothing; (3) a
  **per-agent `HOME` redirect** so global HOME-level config resolves per agent (isolation preserved, real `~`
  untouched); (4) **carrying agy's auth + keychain** — its token is `~/.gemini/antigravity-cli/antigravity-oauth-token`
  (the old copy list was the *gemini CLI's*), and it reads the **macOS Keychain** via go-keyring under `$HOME/Library`,
  so a `Library` symlink is required or macOS raises a GUI "keychain not found" dialog — invisible to an automated
  probe and fatal unattended; **caught only because the PO watched the screen while the probe reported green**.
  **Verified:** full round trip against the real binary — bridge connected · initialize · tools/list · **tools/call**
  (agy called an MCP tool and returned its token). **Refuted en route:** "print mode lacks MCP" (false — #60 was the
  cause) and the plugin route (`569dd09`, project-local → ignored). **Healthcheck:** verified turns took **22–34s**,
  exceeding the 30s default — so fix-attempt-1's provider-specific timeout (gemini/agy → 90000ms) is **necessary
  after all** (it was refuted only as a *complete* fix); ship both. **Still unverified:** a live orchestrator + a real
  `start_pair_chat` (all proof used a fake MCP server over the real WS transport) — the PO-babysat last mile.
  **Shipped** (`agentalk-mcp-client`, branch `task-BL-045`, PO-gated): hang-hardening (per-turn deadline — bounds the
  failure) + the verified fix (`3072e01`, `e9f63b7`). **Fitness:** LB-92's UNFIT ruling now has a concrete path to
  being lifted, but is **not** lifted here — a PO call, and it should follow the live-orchestrator check. Source: LB-93.

  **✅ LIVE-ORCHESTRATOR LAST MILE — PROVEN 2026-07-16 (PO-witnessed).** The "still unverified" gap above is now
  closed: a real `agy`, launched by the real BL-037 launcher against a **real orchestrator** (not a fake MCP
  server), completed a **full MCP round trip**. Evidence (run 3, log `/tmp/bl045-run3.log`, recording
  `runs/bl045-agy-live3.ndjson`, orchestrator log `/tmp/orch.log`):
  - `19:50:21.941` goal delivered → `19:50:36` **`/tmp/att-worker-sandbox/answer.txt` = `391`** → `19:50:46` outcome.
  - **Why `391` is the evidence, not the `status` field:** the goal was *compute 17×23 and write only the result*.
    A computed answer on disk can only come from a real generation **plus a real file-writing tool call**; a stub,
    a vacuous completion, or a hung TUI all leave the file **absent** — which is exactly what run 2 showed
    (`answer.txt` ABSENT). The pair run2-absent / run3-`391` is the discriminator. Do not re-prove this from the
    `completed`/`error` status: run 1 reported **`completed` while proving nothing at all** (no transcript, no
    artifact — see BL-056).
  - Bridge proven both directions: orchestrator log records `MCP tool call from bl045-agy: submit_work_response`.
  - **The `error` outcome was NOT a defect — agy refused, correctly.** The orchestrator **appends** a hardcoded
    clause to every plan (*"Execution requirement: use strictly `git worktree` … otherwise refuse and abort"*);
    the probe goal (write a file) is not a git-worktree op, so agy refused with a lucid reason
    (`accepted: false, reason: 'I cannot strictly execute this task inside a git worktree, as it is a simple
    file-writing operation outside of any git repository context.'`). **Probe-design fault, not an agy fault.**
  - **🔑 The 22–34s healthcheck figure above is DISPROVEN.** Measured bare turn `agy --print` = **9.65s**; the
    live worker turn = **~14s** — comfortably **under the 30s default**. The 22–34s was *bridge + tool-call*
    overhead, not agy cold-start. **Consequence: fix-attempt-1's provider-specific 90s timeout is NOT needed**
    — that line above ("necessary after all; ship both") is wrong and is superseded here. The healthcheck is an
    `exec_rpc` requiring a full generation, and agy now answers one in ~14s.
  - **Boundary (do not overclaim):** proven for the **launcher/worker attach path with
    `AGENTTALK_PERSISTENT_MCP=true`**. A real `start_pair_chat` was **still not exercised** (the launcher builds a
    *worker-only* team and never calls it) — though the healthcheck rides the same `exec_rpc` mechanism just proven.
    **Production remains one env var short → BL-057.**
  - **Minor oddity (unresolved):** agy **wrote the file and *then* refused** — it did the work before declining.
    Harmless here; a protocol-compliance smell worth a look.
  - **Independence caveat:** sole-agent session — Claude authored the probe *and* judged it. The `391`-on-disk
    artifact is deliberately operator-checkable so the claim does not rest on the author's word.
  - **Telemetry:** budget session 70%→84% (Δ ~14%), weekly 22%→23% (Δ ~1%), antigravity 3%→4%; wall-clock
    ~18:35→19:57; 3 live runs; **no code changed** (env-var probe only). Repo pollution: one stray worktree
    created and removed (see LB entry) — real repo verified back at `b7de4c1`, clean.

<!-- @item
id: BL-046
status: todo
date: 2026-07-13
epic: null
tags: [api-agents, openrouter, product-gap, enabler]
-->
- [todo · promoted from BL-044 #2 (2026-07-13); the enabler for `decision-api-agents-for-coordination.md`] —
  **`POST /api/agents` must accept `providerName` (unblock OpenRouter/non-google API agents)** — the create handler
  reads only `{id, provider, model}` (`server.ts:593`) and **drops `providerName`**, so an `api`-provider agent
  always defaults to `google` (`registry.ts:250`, `providerName || 'google'`). This is the **single real blocker** to
  creating OpenRouter/Nous-backed API agents through the product — the foundation of the PO's 2026-07-13 decision to
  run the **coordination layer on OpenRouter agents** (keeping MCP clients for the implementation layer). **Fix:**
  accept + forward `providerName` through create → `activate` → `createAgent` so `ApiCompleter` gets the intended
  `ApiProvider`. **Verified prerequisite met:** OpenRouter is schema-compatible — a faithful consensus request
  (forced `tool_choice` + json `response_format` + tools) returned HTTP 200 with a valid `opinion` tool call on
  `openai/gpt-4o-mini` (the Google 400 was google-specific). Small, targeted. Source:
  `design/decision-api-agents-for-coordination.md`, TL-005, LB-91.

<!-- @item
id: BL-047
status: todo
date: 2026-07-13
epic: null
tags: [api-agents, driver-lifecycle, conversation, tester-finding]
-->
- [todo · Tester finding 2026-07-13 (TL-007)] — **API agents are not reusable across conversations — the driver stops
  at conversation_end** — the `InProcessAgentDriver` calls `this.stop()` on `conversation_end` (the BL-033 lifecycle
  path). For an **MCP-attached** agent that's correct (the client shuts down too). For an **API agent** there is no
  client, so the agent goes `busy → ready` (looks reusable) but its **driver is stopped** — the next conversation's
  startup healthcheck is never processed and times out at 30s. Observed in TL-007: the first conversation completed
  cleanly, but a **second** conversation with the *same* agents failed (`tl007-a did not respond to healthcheck within
  30000ms`); **fresh** agents worked. **Fix options:** re-activate/restart the driver when a ready API agent is pulled
  into a new conversation, OR make `conversation_end` not stop the driver for `provider === 'api'` agents (only
  terminate the CLI-client path). Low-severity workaround today: create fresh API agents per conversation (cheap). Note:
  the agent `status` (`ready`) is misleading — it does not reflect the stopped driver. Source: TL-007, decision note.

<!-- @item
id: BL-041
status: done
date: 2026-07-13
epic: null
tags: [consensus, planning-protocol, robustness, provider-cost, tester-finding]
-->
- [done · merged 2026-07-13 (master `019db72`); Tester finding 2026-07-13 (TL-010)] — **Cap the planning reject/resubmit loop — a malformed agent can spin
  it unbounded (provider-cost + robustness risk)** — when a planner emits a protocol message the orchestrator rejects
  (invalid JSON / wrong `message_payload` envelope / unmet `ack_planning_protocol`), it replies "Please resubmit your
  intended response as valid JSON" and re-prompts — with **no bound**. In TL-010 a goose planner span **120 turns** on
  `openai/gpt-4o` (peer 12) without advancing; `maxRepliesPerAgent=2` did **not** cap it because an ack/resubmit is
  not counted as a "reply". A badly-behaved agent thus stalls the planning session *and* burns real provider budget.
  **Fix:** a bounded retry per protocol step (e.g. N resubmits → interrupt planning with a clear error), and/or count
  resubmits against a cap. Independent of provider — surfaced with goose but applies to any agent that emits malformed
  protocol JSON. Source: TL-010, testlog.
  **Resolution (merged `019db72`):** added a per-agent ack re-request budget (`MAX_ACK_REREQUESTS=2` +
  `ackRetryCounts`) in `team-coordinator.ts`, mirroring the existing regression-correction budget; on exhaustion the
  offender is ejected peer-safe (`ejectPlanner` → `awaiting_operator`), budget resets on a valid ack and clears on task
  teardown. Regression test `team-ack-budget.test.ts` (never-ack → ejected; single stumble → graceful). Suite 281/281.

<!-- @item
id: BL-042
status: todo
date: 2026-07-13
epic: null
tags: [goose, consensus, planning-protocol, coordination-profile, optional]
-->
- [todo · optional · Tester finding 2026-07-13 (TL-009/TL-010)] — **(Optional) Full goose consensus recipe — embed the
  protocol contract so goose can plan** — goose is verified as a dev + pair-chat agent (spike, TL-008) but **cannot
  complete the strict multi-phase consensus protocol** (TL-009: content good on gpt-4o but stalls opinion→
  agreement_proposal + 60s force-shutdown; TL-010: the `--max-turns 3 --no-profile --system` coordination profile
  fixed latency but goose emits `{message_type,text}` while the protocol wants a `message_payload` envelope + an
  `ack_planning_protocol` handshake → reject/resubmit runaway). Root cause: the protocol expects an exact JSON contract
  delivered in the turn briefing, which a general agentic wrapper doesn't reproduce reliably. **If** goose-as-planner
  is still wanted, author a **full protocol recipe** — a goose `--recipe`/`--system` that embeds every `message_type`'s
  exact `message_payload` schema + the ack handshake and the phase-advancement rules (≈ replicating the contract).
  **Default recommendation instead:** goose for implementation + pair chat; keep strict consensus on the M06 CLI-agent
  path. The env-driven coordination profile (`AGENTTALK_GOOSE_MAX_TURNS`/`_NO_PROFILE`/`_SYSTEM`, client
  `ee258b6`) is the building block. Source: TL-009, TL-010, `decision-api-agents-for-coordination.md`.

<!-- @item
id: BL-043
status: todo
date: 2026-07-13
epic: null
tags: [arbiter, consensus, heterogeneous-team, claude, goose, experiment, next-session]
-->
- [todo · PO idea 2026-07-13 · **next-session experiment**] — **Heterogeneous arbiter: a Claude-backed MCP client as
  the Arbiter/Judge, goose agents for planners + worker** — TL-013 proved arbiter (semantic) consensus works with
  all-goose+deepseek, but the **Judge's convergence bar was lax** (it declared `converged` though the planners
  endorsed different ideas — the Judge is hardcoded to openrouter `gpt-4o-mini` via `callApi` in
  `arbiter-coordinator.ts`). The PO's test: run the debate with **goose planners/worker** but the **Judge (and
  Synthesizer) backed by a real Claude MCP client** — a strong model judging convergence + authoring the plan.
  **Value:** (a) harder convergence rigor (fixes the TL-013 caveat); (b) first true **mixed-provider** team test
  (goose attach + Claude attach + the arbiter path). **Work needed:** make the arbiter Judge/Synthesizer **pluggable**
  — today they're a hardcoded `callApi({provider:'openrouter', model:'openai/gpt-4o-mini'})`; route them to a
  Claude-backed completer/MCP client instead (config or a dedicated arbiter-agent seat). Depends on
  `task-arbiter-enable` (BL-044 wall 1) being merged. Source: PO, TL-013.

<!-- @item
id: BL-060
status: todo
date: 2026-07-16
epic: null
tags: [dx, config, ports, papercut, po-raised]
-->
- [todo · **PO-raised 2026-07-16** — *"what is port 3000 used for? if it's internal, that's a pretty stupid choice"*
  · **agreed, and the env knob is worse than the default**] — **The orchestrator's internal HTTP+WS backend squats on
  port 3000, and `PORT` only half-works.** What 3000 is: the orchestrator's HTTP API + WebSocket for the web UI
  (`apps/orchestrator/src/index.ts:33`, `Number(process.env.PORT) || 3000`) — **internal**; only the browser and the
  launcher's `orchestratorUrl` use it.
  **Three faults, worst last:**
  1. **3000 is the most contended port in JS dev** (Next.js / CRA / Express / Rails all default there). Collision is
     arithmetic, not luck: **observed 2026-07-16** — the PO's DiagramTalk (`next-server`) held 3000 while AgentTalk
     needed it.
  2. **Inconsistent with the project's own better pattern:** the **MCP** server already takes a **dynamic** port
     (hence `ws://localhost:54417` etc., differing every run, parsed from stdout by `scripts/launcher.mjs:57`). The
     collision-free choice was made deliberately for MCP and skipped for the UI backend.
  3. **🔑 `PORT` is illusory — the knob turns and nothing happens.** The orchestrator honours `PORT`, but
     **`apps/web/vite.config.ts:12-15` HARDCODES** `http://localhost:3000` + `ws://localhost:3000` with no env
     read. So moving the orchestrator **silently breaks the UI** — configurable in name only. Hit for real on
     2026-07-16: a headless probe ran fine on 3100, but the UI witness **forced** the orchestrator back onto 3000,
     which is the only reason the DiagramTalk collision mattered at all.
  **Fix (small):** have `vite.config.ts` read `process.env.PORT ?? <default>` so both halves agree, and move the
  default off 3000 to something unclaimed; optionally adopt the dynamic-port + discovery pattern the MCP side
  already uses. **Behaviour change → PO call.** Source: PO question at 2026-07-16 session close; LB-94 run notes.

<!-- @item
id: BL-059
status: todo
date: 2026-07-16
epic: null
tags: [agy, gemini, protocol-compliance, false-green, autonomy-risk]
-->
- [todo · **found 2026-07-16 during the BL-045 UI witness** · **`completed` ≠ the work was done**] — **agy accepts a
  plan and then does not execute it — and the team still reports `completed`.** Observed live, PO-witnessed run
  `agy-w2` (orchestrator log `/tmp/orch-ui.log`, recording `runs/bl045-ui3.ndjson`): goal was *compute 17×23, create
  a git worktree, write `answer.txt`, commit it*. agy called `submit_work_response { accepted: true }` then
  `submit_work_result { result: '391' }` — **the number is right and really computed**, but **no worktree, no
  `answer.txt`, no commit** (sandbox still at `e0a2b02` with only `README.md`). Team → **`completed`**; the UI
  rendered `391`. **A green run in which the accepted execution requirement was silently skipped.**
  **The inverse also observed the same day** (run 3, BL-045): agy **wrote the file and *then* refused**
  (`accepted: false`) — doing work it declined. So compliance is unreliable **in both directions**: it does work it
  refuses, and skips work it accepts.
  **Why this matters more than it looks:** the ladder's whole premise is an agent that *executes*. `completed` is
  currently a claim by the worker about itself, checked by nobody — and with **BL-056** (no task read endpoint, no
  durable transcript) there is often **no artifact to check it against**. That combination — a self-asserted green
  plus an unreadable transcript — is exactly an **unwitnessed Bite 1 run reporting success for work it did not do**.
  **Not an agy-only question:** is the orchestrator's `submit_work_result` supposed to be *evidence* or just *prose*?
  Nothing verifies the claim against the world. **Possible directions:** require an artifact/DoD check before a team
  may report `completed`; or treat `submit_work_result` as unverified narration in the UI and label it as such.
  **Related:** the orchestrator **appends a hardcoded clause to every plan** (*"use strictly `git worktree` …
  otherwise refuse and abort"*) — it reshapes any non-git task into a refusal and is what agy accepted-then-ignored
  here; worth revisiting alongside this. Source: BL-045 live UI witness, 2026-07-16.

<!-- @item
id: BL-057
status: todo
date: 2026-07-16
epic: null
tags: [agy, gemini, attach-mode, test-only-path, production-gap, one-line-fix]
-->
- [todo · **found 2026-07-16 while proving BL-045's last mile** · **the BL-045 fix is real but PRODUCTION CANNOT
  REACH IT**] — **`AGENTTALK_PERSISTENT_MCP=true` is set by NOTHING outside the test suite, so the verified agy path
  is test-only and the broken path is production-only.** `GeminiPersistentExecutor` has two paths gated on
  `process.env.AGENTTALK_PERSISTENT_MCP === 'true'` (`lib/executor-runtime.mjs:455` initialize, `:546` executeTurn).
  The **gated** path is the BL-045 fix (HOME redirect + `writeAgyMcpConfig` + `agy --print`) — **live-proven**. The
  **fall-through** is `super.*` → `getPersistentProviderCommand()` → **`{ command: 'agy', args: ['mcp'] }`**
  (`:73-78`) — and **`agy` has no `mcp` subcommand** (re-confirmed 2026-07-16 at zero cost: `agy --help` lists
  agent/agents/changelog/help/install/models/plugin/plugins/update — no `mcp`). That is LB-92's original hang,
  still live in production today.
  **This is the SAME "green tests, broken production" structure LB-93 named as the root cause — it survived the
  fix, because the fix was written *inside* the test-only branch.** Grep evidence: the only setters of the flag are
  `__tests__/exec-rpc.test.ts:222-226` and `__tests__/agy-mcp-config.test.mjs:68`. `agent-launcher.mjs` sets only
  `AGENTTALK_PERSISTENT_MCP_URL` — **a different variable** (easy to misread as coverage; it is not).
  **Why it was invisible:** `scripts/bl040-d1d3.config.json` declares `"provider": "gemini"` and *looks* like Bite 0
  exercising agy — but `scripts/run-d1d3.sh` exports `AGENTTALK_PERSISTENT_COMMAND_JSON` pointing at
  `fake-worker-bridge.cjs`, overriding the command entirely. **That config never launches agy.** Fake bridge wearing
  the gemini label — the same shape as the test-only flag: the thing that looks like coverage isn't.
  **Candidate fix (a decision, not a mechanic):** (a) set the flag on the launcher spawn env (`lib/agent-launcher.mjs:145`,
  where env is already built as `{ ...process.env, ... }`) — smallest diff; or (b) **delete the flag and the
  `agy mcp` fall-through entirely** — the fall-through is dead code that can only ever hang, and keeping a
  test-only/production-only split is what caused BL-045. **(b) is the honest fix; it is a behaviour change → PO call.**
  **Verified workaround (needs no code):** `export AGENTTALK_PERSISTENT_MCP=true` before the launcher — the env
  flows through to the worker. This is how BL-045's last mile was proven; see that item.
  Source: BL-045 live-orchestrator probe, 2026-07-16.

<!-- @item
id: BL-058
status: todo
date: 2026-07-16
epic: null
tags: [bite0, config, launcher, broken-artifact, papercut]
-->
- [todo · found 2026-07-16 · **a checked-in Bite 0 config cannot start an orchestrator as written**] —
  **`scripts/bl040-d1d3.config.json` has a broken `startCommand.cwd`.** It says `"cwd": "../../AgentTalk"`, but
  `scripts/launcher.mjs:40` resolves it against **`clientRoot`** (the repo root, `:29`), not against `scripts/` —
  so it lands on **`/Users/fausto/AgentTalk`**, which does not exist, and the run dies with a confusing
  **`Error: spawn node ENOENT`** (the ENOENT is the *cwd*, not `node` — highly misleading). Correct value is
  `"../AgentTalk"`, or better an **absolute path**. Cost real time on 2026-07-16: the value was copied in good
  faith into a new probe config and inherited the bug. **Fix:** correct the config; consider having
  `makeStartInstance` **fail fast with a clear message** when `cwd` does not exist, rather than surfacing ENOENT.
  Source: BL-045 live-orchestrator probe, 2026-07-16.

<!-- @item
id: BL-056
status: todo
date: 2026-07-16
epic: null
tags: [ui, observability, self-hosting, autonomy]
-->
- [todo · surfaced by the BL-051 live run · **the panel is a live window, not a record**] — **A run's output does
  not survive a page reload — and there is no way to see a past run at all.** BL-051 made the worker's answer
  visible *while the socket is connected*; refresh the page and it is **gone for good**. Root cause is structural,
  not cosmetic: **tasks have no read endpoint** (only `GET /api/teams` exists), and completing **deletes**
  `team.currentTaskId`, so `App.tsx:282` can only drop a task it can no longer place — the comment there says as
  much ("only dropped… the next `team_task_updated` repopulates it"), and after completion nothing ever
  repopulates. The transcript lives in orchestrator state and reaches the browser **exactly once**, as an event.
  **Why it matters for the ladder:** Bite 1 runs an agent-driven session the PO will want to *review*, possibly
  after the fact — and "you had to be watching at the right moment" is not review, it is luck. The NDJSON recording
  is today's only durable artifact, and it holds lifecycle events, **not** the transcript (verified on the BL-055
  and BL-051 runs). **Likely shape:** a task read endpoint (`GET /api/teams/:id/task[s]`) + retain completed tasks,
  or persist the transcript into the run recording. **Needs a PO go** (LB-93: UI stays fluid). Source: BL-051
  closure, raised to the PO at merge.

<!-- @item
id: BL-055
status: done
date: 2026-07-16
epic: null
tags: [safety, sandbox, autonomy, bite0, live-validation]
-->
- [done · **the live bar BL-052 owed — PASSED, PO-accepted 2026-07-16** · run log `/tmp/att-sandbox/bl055-run.log`] — **Prove the worker containment fix against a
  real CLI, not just the launcher boundary.** BL-052 is merged (`1800dc4`) on its **code** bar: unit + e2e prove
  the launcher refuses a missing/relative/nonexistent `workdir` and spawns with an explicit `cwd`, and a really
  spawned harness was observed landing in its assigned dir (`[llm-agent] Working directory set to /tmp`). **What
  is still unproven is the claim the item actually makes:** that a *real autonomous worker cannot reach a real
  repo*. **The bar:** re-run the D4 cap-breach scenario with a real `claude` CLI worker, launched from inside a
  real checkout, with `workdir` pointing at a throwaway git repo — then confirm the worker's worktree/branch/commit
  land **there** and the host checkout is untouched (`git worktree list` + `git status` + `git log` on the real
  repo). **Design the observation so one mechanism explains it** (LB-93 / BL-048 lesson: "it appeared" proves
  little — the decisive evidence is the real repo staying *clean* while the sandbox *gains* the commit).
  **Why it's separate:** BL-048 was 324/324 green with the bug live; a green suite is not evidence about a
  cross-process, cross-filesystem safety property. Source: BL-052 closure.

  **RESULT (2026-07-16) — PASSED.** A real `claude` worker, launched **from inside the real
  `agentalk-mcp-client` checkout** (the exact condition that caused the incident) with
  `workdir: /tmp/att-worker-sandbox`, was given the same "use strictly `git worktree`, else refuse and abort"
  task that produced `4193a4e`. Both halves of the decisive pair held, measured against a pre-run baseline:
  - **The real checkout is byte-for-byte unchanged** — HEAD still `1800dc4`, same 3 branches, same 2 worktrees,
    0 dirty, no `count.txt` anywhere.
  - **The sandbox gained the work** — branch `count-task`, commit `0a472a7`, a real `count.sh` + a real
    10,000-line `count.txt` (verified: first line `1`, last `10000`).
  Only containment explains **both** at once: a broken fix would have dirtied the real repo; a refusal or no-op
  would have left the sandbox empty. Mechanism directly witnessed in the log:
  `[llm-agent] Working directory set to /tmp/att-worker-sandbox`. Teardown clean (no stray processes, :3000 free).
  **Evidence gap, stated:** the recording held only lifecycle events (`run-start`/`agent-launched`/
  `goal-delivered`/`outcome`) — **no transcript**, unlike the D4 run. The verdict rests on the filesystem, which
  for *this* claim is the stronger evidence (the commit is the work; its location is the whole question), but it
  is a real difference from D4 and is noted rather than smoothed over.
  **🔎 UNEXPECTED FINDING → BL-054.** The worker's worktree landed at `/tmp/att-worker-count-task` — a **sibling**
  of the assigned workdir, **not inside it** (ordinary `git worktree ../name` resolution; the branch/commit do live
  in the sandbox's object store, and everything stayed in `/tmp`, so nothing was at risk). It proves BL-052
  constrains **where the worker starts**, not **where it may write**: a worker that steps sideways is unconstrained.
  This turns BL-054 from theory into observed behaviour.

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
id: BL-053
status: todo
date: 2026-07-16
epic: null
tags: [safety, sandbox, protocol, autonomy]
-->
- [todo · found while fixing BL-052 · **the sibling defect, one layer down**] — **The `exec_rpc` `cwd` is
  discarded — the protocol transmits per-task isolation that never reaches the process.** Every turn carries a
  proper `cwd: /tmp/agentalk-task-<id>`, and `llm-agent.mjs` dutifully forwards it into `executeTurn` — then
  `lib/executor-runtime.mjs` **throws it away**, hardcoding `process.cwd()` at **lines 162 and 679** (only line
  493 honours a `sink.cwd`). So the one piece of per-task isolation the wire protocol actually carries is dead on
  arrival. **Relationship to BL-052:** same safety story, different layer. BL-052 fixes containment at the
  *process* boundary (the worker is spawned into an assigned directory); this is containment at the *turn*
  boundary (each task gets its own directory **within** a session). BL-052 makes the worker's whole session
  land in one assigned dir; it does **not** give each task its own. **Deliberately not folded into BL-052** — a
  different blast radius (it changes where every executor turn runs), and merging them would have made the diff
  unreviewable. Source: BL-052 implementation.

<!-- @item
id: BL-052
status: done
date: 2026-07-16
epic: null
tags: [safety, sandbox, autonomy, bite0, self-hosting]
-->
- [done · **🔴 SAFETY — the sandbox does not contain the WORKER** · found by the BL-040 D4 acceptance run ·
  **MERGED `agentalk-mcp-client:1800dc4` (PO-gated, 2026-07-16)** · ⚠️ **the live bar is still owed — see
  BL-055**] — **An
  autonomous worker committed into a real repo.** During the D4 cap-breach scenario the worker (a real `claude`
  CLI) created a git worktree `/home/fausto/Software/wt-count-task` and branch `task-count-1-10000` **inside the
  agentalk-mcp-client checkout**, wrote `scratch/generate_count.py` + a 10,000-line file, and **committed**
  (`4193a4e`) under the machine's git identity — before the cap reaped it. Not pushed; master unaffected; caught
  only because the closing hygiene sweep listed worktrees.
  **Root cause (one line):** `lib/agent-launcher.mjs:90` — `spawn('node', [llmAgentPath, ...args], { env, stdio:
  'inherit' })` passes **no `cwd`**, so the worker inherits the launcher's working directory. The launcher was run
  from a client worktree → the worker landed in a real git repo. The `exec_rpc` turn *does* carry
  `cwd: /tmp/agentalk-task-<id>`, but that never reaches the spawned process; meanwhile the worker prompt
  **orders** it to *"use strictly `git worktree` for this task"*. It obeyed — in the wrong repository.
  **Why the existing sandbox missed it:** `/tmp/att-sandbox` protects the **orchestrator's** CWD
  (`in-process-driver.ts:283` runs `git worktree add` there). Nothing constrains the **worker**, which is a
  separate process with its own inherited CWD. Two different containment problems; only one was solved.
  **Why it matters now:** this is the safety premise of the whole autonomy ladder — AGENT.md's worktree mandate
  calls the per-task worktree *"the safety sandbox for autonomous agents"* and names the launcher's `workdir`
  param as the assignment hook. ~~`agents[].workdir` … **verify whether it is honoured at all**; on this evidence
  it is not.~~ **CORRECTED 2026-07-16 (implementation):** `workdir` **IS** honoured —
  `agent-launcher.mjs:88` → env `AGENTTALK_WORKDIR` → `llm-agent.mjs:78-81` `process.chdir()`. The mechanism
  worked; it was simply **optional**, and **no config or caller in either repo passed it**, so every launch took
  the silent-inherit path. The defect was never a missing feature — it was a **safety-critical parameter that
  failed open**. Bite 1
  puts an *agent* in charge of invoking the launcher: an unattended worker that can commit into whatever repo the
  parent happened to sit in is not an acceptable base for that.
  **Fix direction (needs a PO call):** spawn the worker with an explicit `cwd` (the assigned workdir / the
  `exec_rpc` cwd), and make a missing workdir a hard error rather than a silent inherit. Source: BL-040 D4
  acceptance run.
  **PO decision (2026-07-16):** hard error — *"Results would be unpredictable otherwise."* Accepted rationale:
  when the default is dangerous **and** the violation produces no signal, refusing to start is the only design
  where the safe path is also the easy path. No legitimate consumer of the inherit behaviour existed.
  **Built (`bl052-worker-containment`, `d4011af`, plan: `design/bl052-plan.md`):** `launchAgent` refuses a
  missing / relative / nonexistent `workdir` with **400, before the orchestrator create** (a refusal leaves no
  half-made agent record); the check sits at the **`launchAgent` boundary** so `POST /agents` is covered too; the
  worker is spawned with an **explicit `cwd`**; the dir is **never auto-created** (create-if-missing would make any
  typo a fresh valid sandbox); callers + configs now name a throwaway workdir. Client suite **52/52**.
  **Split out, deliberately:** **BL-053** (the `exec_rpc` cwd is discarded by `executor-runtime.mjs`) and
  **BL-054** (should `workdir` be confined to a blessed root — policy, needs a PO call).
  **Still open — the live bar → BL-055.** The D4 scenario has **not** been re-run against a real `claude` CLI
  under the fix. Proven: the launcher boundary (unit + e2e, incl. a real spawned harness landing in its assigned
  dir). **Not** proven: a real autonomous worker being unable to reach a real repo — which is the claim this item
  actually makes. Closed as `done` on the **code** bar with the live bar tracked separately, because BL-048 taught
  us a green suite can coexist with a live defect.
  **Telemetry (task closure):**
  - task:        BL-052
  - wall-clock:  2026-07-16 16:23 → 16:44 (~21m)
  - budget:      weekly 15%→15% (Δ ~0%), session 0%→3% (Δ ~3%)
  - gate:        tsc n/a (JS), suite 52/52 (re-run on merged master), pollution clean (`wt-bl052` removed;
                 `wt-count-task` D4 evidence deliberately retained)
  - diff:        7 files, +126/-21, commits d4011af → merge 1800dc4 (pushed)
  - outcome:     MERGED ✅ — code bar only; live bar owed (BL-055)
  - caveat:      authored, reviewed and merged by ONE actor (Claude) — Codex + agy unavailable. Gates 1–3 were
                 each exercised, but none was independent. This is a declared weakness, not a passed gate.

<!-- @item
id: BL-051
status: done
date: 2026-07-16
epic: null
tags: [ui, observability, self-hosting, bite0]
-->
- [done 2026-07-16 · **MERGED `f3cffd0`, PO-witnessed** · found by the D4 acceptance run · **the data was already in the browser**] — **The Team view never shows
  what the worker actually produced.** `TeamSidebar.tsx:152-153` renders exactly two task fields — the goal
  (`description`) and `Status:` — and nothing else. PO, watching the first fully autonomous Bite 0 run land:
  *"C'e' il goal del task e lo status completed. Non c'e altro."* The worker had replied `pong`; the answer was
  nowhere on screen. **This is a rendering gap, not a data gap:** `team_task_updated` carries the full
  `transcript` (verified in the run's NDJSON — `d4-worker -> user | "pong"`) and it already lands in
  `activeTeamTask` in the frontend's state. The result is one render away. **Why it matters:** the whole point of
  the autonomy ladder is to watch a run and judge its *output*; today the UI answers "did it finish?" but not
  "what did it do?" — which is the question that decides whether an autonomous run was any good. Related: the run
  also gives no sense of *progress* — the team hits `working` ~6ms after `idle`, then sits still for ~29s, then
  jumps to `completed`; there is nothing to watch in between (recording: `/tmp/att-sandbox/d4-complete.ndjson`).
  Per **LB-93** the UI layer stays fluid — needs a PO go, no test infrastructure, live-validated. Source: BL-040
  D4 acceptance run, PO-witnessed.

  **✅ DONE 2026-07-16 — merged `f3cffd0` (PO-gated, "merge as-is").** Confirmed a **rendering** gap, not a data
  gap: `TeamTask.transcript` (contracts `types.ts:64`) already arrives on `team_task_updated` and already lands in
  `activeTeamTask` (`App.tsx:224`). `TeamSidebar` now renders a `TaskTranscript` — each entry as `from → to`
  (+ `messageType`) with the payload in monospace, scrollable, with an explicit empty state — plus
  `workerRefusalReason` when a worker refuses. One file, +48/-1. tsc clean, suite **325/325**.
  **The live bar (LB-93: no UI test infra; a witnessed run IS the bar) — PASSED.** A real `claude` worker was given
  `17 * 23`; the PO saw the panel render 4 entries ending in **`391`**.
  **Why that is decisive:** `391` appears in **no code, no config, and no log** — the launcher records only the
  **outgoing** prompt (the run log's `work_accept` is the *instructions*, not the reply), the NDJSON holds only
  lifecycle events, and tasks have **no read endpoint**. The worker's answer therefore existed in exactly **one**
  place: the rendered panel. Only the render could put it there — a hardcoded string could have faked "pong", which
  is precisely why a *computed* answer was chosen. Green suites were irrelevant to this claim (BL-048 was 324/324
  with its bug live).
  **Telemetry (task closure):**
  - task:        BL-051
  - wall-clock:  2026-07-16 16:58 → 17:11 (~13m)
  - budget:      weekly 15%→15% (Δ ~0%), session ~6%→~9% (Δ ~3%)
  - gate:        tsc 0, suite 325/325 (re-run on merged master), pollution clean (`wt-bl051` removed)
  - diff:        1 file, +48/-1, commits 457a80e → merge f3cffd0
  - outcome:     MERGED ✅ (live bar PASSED, PO-witnessed)
  - caveat:      one actor authored, reviewed and merged (Codex + agy unavailable) — gates exercised, none independent.
  **Known warts, PO-accepted at merge ("merge as-is"), NOT defects:** the goal echoes twice (as the description and
  again as the first transcript entry) and `Task assigned directly to worker.` is protocol bookkeeping — of 4
  entries only the last two inform. **Left open → BL-056** (output does not survive a reload) and the *progress*
  half of this item's original complaint (a run sits at `working` ~30s with nothing to watch) — that half is
  **NOT** addressed here.

<!-- @item
id: BL-050
status: todo
date: 2026-07-16
epic: null
tags: [ui, observability, ux]
-->
- [todo · PO observation during the BL-049 live run · **deliberately not acted on**] — **The Team view does not
  make it clear which team you are looking at.** PO, watching a real worker-only team appear: *"si capisce male
  qual è il team sulla UI"* — with the team identified only by a generated `team-<epoch>` id, the panel reads
  ambiguously, and the agent list rendered beside it (all agents, not just members) makes it easy to misread which
  agents are actually **in** the team. Recorded verbatim because it was seen once, live, and observations that are
  not written down get rediscovered later at full cost. **Explicitly parked by the PO** (*"non vorrei perderci
  tempo adesso"*) — do not pick this up without a PO go. Consistent with **LB-93** (the UI layer stays fluid for
  now); this is a legibility/UX item, not a defect: the data is correct, the presentation is ambiguous.

<!-- @item
id: BL-049
status: done
date: 2026-07-16
epic: null
tags: [ui, observability, self-hosting, bite0]
-->
- [done 2026-07-16 · PO-witnessed live · found by the BL-048 live run · **closed before D4 could trip on it**] —
  **Teams/tasks carry the same
  reconnect hole BL-048 just closed for agents — and have no resync path at all.** BL-048's audit (spike point 3)
  found the *rendering* is fine: `team_updated → setActiveTeam` surfaces a team the human never opened, so no
  "live view" is needed. The hole is elsewhere: a broadcast only reaches clients connected when it fires, and
  while `GET /api/teams` exists server-side (`server.ts:745`), **the web client never calls it** — `api.teams`
  exposes only `create` and `assignTask`, with no `list`. So a `team_updated` that arrives while the socket is
  down is lost for good, and BL-048's `fetchAgents()` on WS open does not cover it (agents only). This is exactly
  the failure that made the first BL-048 run show a frozen UI, still lying in wait: today nothing creates teams
  externally, but **once D4 implements `deliverGoal` (team + task via API) the launcher's runs will drop them the
  same way**. **Fix (symmetric to BL-048):** add `api.teams.list()` and resync the active team alongside the agents
  in the `onOpen` handler (`App.tsx`). **Decide first:** whether a refetch that finds no team should clear a stale
  `activeTeam` — that is a UI behaviour call, hence PO's. **Testing:** do NOT add UI test infrastructure — the PO
  ruled that layer stays fluid (**LB-93**); the bar here is a **live, witnessed run**, and it must isolate what it
  claims (BL-048's decisive evidence was a stale entity *disappearing* on reconnect — a reload or HMR remount
  refetches and proves nothing). Source: BL-048 spike point 3 audit.
  **OUTCOME (2026-07-16): DONE — `api.teams.list()` + `fetchTeams()` in the WS `onOpen` handler.** PO decisions
  taken at the outset: (a) **align to backend truth** — the backend's most-recently-updated team wins, none clears
  `activeTeam` (not a new selection policy: `team_updated` already calls `setActiveTeam` blindly); (b) **teams
  only, no tasks** — there is **no read endpoint for tasks** (only `GET /api/teams` exists), so `activeTeamTask` is
  cleared unless it still matches the team's `currentTaskId`, and the next `team_task_updated` repopulates it; full
  task coverage would need new server API surface. Validated live (PO-witnessed) in two halves that admit no other
  explanation: a team created **before the UI existed** appeared on connect though no `team_updated` ever reached
  that client, and against a fresh backend it **disappeared** with no reload (broadcasts only add/update; only a
  refetch removes). Side observation from the run → **BL-050** (team legibility, PO-parked).

<!-- @item
id: BL-048
status: done
date: 2026-07-16
epic: null
tags: [ui, observability, spike, self-hosting, bite0]
-->
- [done 2026-07-16 · merged `d4ac001` · PO-witnessed live · **spike** · prereq for witnessing autonomous runs] —
  **Make the Web UI reactive to
  EXTERNAL (API-/launcher-driven) events** — during the BL-040 D4 babysat run the PO could not *see* agents/teams/
  tasks created outside the UI. Root cause (traced): agent **creation** emits no registry event and no UI broadcast
  (only `recorder.record('runtime','agent_created')`, `server.ts:609`); the frontend fills its agent list via
  `api.agents.list()` on mount and only *updates existing* agents from `status` events (`App.tsx:199`), so an
  externally-created agent never gets a row. The `/ws` broadcast path + `team_updated`/`team_task_updated`/`status`
  handlers already exist — the hole is the missing `agent_added` push. **Fix (minimal, spike):** emit
  `agent_registered` in `registry.ts` → `broadcast({type:'agent_added',agent})` in `server.ts` → frontend
  `case 'agent_added'` upserts into the list (+ refetch on unknown-id `status`); audit team/task rendering for
  entities the human never opened. Full design + files: **`design/spike-ui-external-events.md`**. Do it in a git
  worktree (touches `apps/web` + orchestrator). Source: BL-040 D4 babysat run, PO.
  **OUTCOME (2026-07-16, merged `d4ac001`) — the plan above was wrong twice; keep reading before you copy it.**
  (1) **Do NOT emit from `registry.createAgent()`** as prescribed: `POST /api/agents` assigns `provider`/`model`
  *after* `createAgent()` returns (behind an `isUsageCaptureProvider` guard), so the emit would ship both
  `undefined` — and nothing repairs it, because the registry emits `provider`/`model` only from `activateAgent()`
  and the frontend has **no case for them**. The broadcast went in the route instead; `registry.ts` is untouched.
  (2) **The broadcast alone did not fix the real case.** The launcher creates its worker ~100ms after the
  orchestrator is ready while the UI's socket retries every 2s, so `agent_added` reached **zero clients** and the
  whole `creating→starting→ready` burst fell inside the same window, leaving nothing for the unknown-id refetch to
  fire on. **The suite was 324/324 with that hole in it** — only the PO-witnessed live run found it. Real fix:
  `fetchAgents()` on WS `onOpen`, so every (re)connect resyncs with backend truth. Also shipped (PO-requested): a
  server-initiated WS **keepalive** + a live connection indicator — without ping/pong a half-open socket keeps the
  indicator green over a dead backend. Point 3 (team/task audit) done: rendering is fine, but teams carry the same
  reconnect hole → **BL-049**.

*(add new items above this line)*
