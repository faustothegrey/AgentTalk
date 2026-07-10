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
status: deferred
date: 2026-07-09
epic: null
tags: [self-hosting, wire-contract, cross-repo, governance]
-->
- [deferred · M17 inception disposition (PO+Architect, 2026-07-09) — contract evolution stays a manual,
  PO-gated act; reopen condition: a wire-contract bump recurs and bites again (another manual cross-repo
  sync grant needed), OR the PO calls it] — **Versioned wire-contract negotiation** — replace the
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
  was fenced."

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

<!-- @item
id: BL-026
status: todo
date: 2026-07-09
epic: null
tags: [attach-mode, ergonomics, real-cli, friction-m18]
-->
- [todo · **M18 C7 friction item** — the rider T3a explicitly dropped, now re-filed *from evidence* exactly as
  its Gate-1 record instructed] — **Attaching a real CLI session is a hand-assembled ritual** — every real-CLI
  attach in M18 required hand-writing an `mcpServers` JSON with an absolute `bridge.mjs` path, a WS URL, an
  `agentId`, and the contract hash — done ad hoc four times today (twice by the implementer, twice by the
  task-end reviewer) with a `creating`-state trap waiting for anyone who forgets `POST /api/agents/:id/start`.
  **Evidence:** LB-66; `design/evidence/m18-t3a-proof-a.txt` / `-b.txt`; M18-T3a Gate-1 condition 3.
  **This is the friction standing between "the channel works" and "the team uses the channel"** — rank it high
  for M19. Fix sketch: a committed `.mcp.json` template + an `attach-real-session` runbook/script that registers,
  starts, assigns the role, and prints the config.

<!-- @item
id: BL-027
status: todo
date: 2026-07-09
epic: null
tags: [metric, program, self-hosting, friction-m18]
-->
- [todo · **M18 C7 friction item** — the program's headline metric can move for reasons that have nothing to do
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
status: todo
date: 2026-07-08
epic: null
tags: [self-hosting, scope-fence, governance, harness]
-->
- [todo · **L0 absorbed into M18-T1 at the 2026-07-09 gate (BL-021)** — the guinea-pig shakedown epic; item
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
status: todo
date: 2026-07-08
epic: null
tags: [self-hosting, role-skill, governance]
-->
- [todo · M19 candidate — ruled at the 2026-07-08 gate (options were M18 rider / M19 candidate / parked);
  re-gate after M17 delivers the session→identity→role mapping] — **Role-skill injection — brain-served
  role briefs at attach** — condense the scrum workflow (roles, gates, batons, origin tags, Rules of
  Engagement, primer handshake) into a brief the substrate serves at attach time: "you are `<role>`; here
  is your law" — versioned from the repo, identical for every provider, recorded like any message. Rides
  M17's session→identity→role mapping; would collapse primer-handshake drift (the brain knows what's fresh)
  and administer the 2026-07-08 role-only governance model (`AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`) over
  the channel instead of per-CLI context files. Source: PO idea 2026-07-02 + architect read,
  `design/self-hosting-program-draft.md` §Candidate.

*(add new items above this line)*
