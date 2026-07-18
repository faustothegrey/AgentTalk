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
id: BL-074
status: done
date: 2026-07-18
epic: null
tags: [tooling, worktree, wt-setup, dx]
-->
- [done · **DONE 2026-07-18** — opened+closed same session · merge `3d84c43` (branch `task-BL-074`, per-task
  worktree, PO-gated) · found by dogfooding the BL-036 discipline while closing [[BL-073]]] — **`wt-setup create`
  made task branches track `origin/master`, crashing `remove --delete-branch`** — `create --base origin/master`
  (the discipline doc's recommended base) set the new `task-<id>` branch's upstream to `origin/master`. Then
  `remove --delete-branch`'s safe `git branch -d` compared against that **unpushed** upstream instead of local
  `master`, refused, and threw uncaught — removing the worktree but **orphaning the branch**. **Fix:** add
  `--no-track` to `git worktree add` (`scripts/wt-setup.mjs`), so the branch has no upstream and `-d` checks local
  `master` (the actual merge target). **Safety preserved:** `-d` still refuses a genuinely-unmerged branch.
  **Verified:** throwaway-repo test in the exact BL-073 state (real commit, merged to local master, not pushed) —
  `git branch -d` **REFUSED** without the flag, **SUCCESS** with it; dogfooded the fixed tool (create off
  `origin/master` → no upstream → `remove --delete-branch` clean, no leak); wt-setup unit test 4/4; full suite
  **372/372**. Independence caveat: sole agent (resource fallback) — authored+reviewed by Claude; the real check was
  the exact-scenario run + the dogfood.

<!-- @item
id: BL-073
status: done
date: 2026-07-18
epic: null
tags: [tooling, wire-contract, live-proof, scripts]
-->
- [done · **DONE 2026-07-18** — opened+closed same session · merge `6815b6b` (branch `task-BL-073`, per-task
  worktree, PO-gated) · flagged in BL-071's closing note] — **m16/m17 live-proof scripts hardcoded the retired v7
  wire-contract hash** — `scripts/m16-live-baton-proof.mjs` and `scripts/m17-live-gate-proof.mjs` embedded the v7
  hash (`ffa94e93…`, 2 sites each), so a current **v8** orchestrator rejects them at `initialize` (close code 1008).
  **Fix:** read `packages/contracts/wire-contract.json` at module load and use `wireContract.hash` (the idiom
  `test-live-gate.mjs` / `m19-real-cli-attach.mjs` already use), so a future contract bump can't re-break them.
  **Verified:** 0 v7 literals remain; `CONTRACT_HASH` wired at both Client-init and `await_turn` sites per file;
  syntax OK; read resolves to live v8 (`8df9593…`), not v7; both scripts execute past module-load in situ (reach the
  connection attempt); full suite **372/372**. **Honest boundary:** the full live end-to-end (attaching to a
  *running* v8 orchestrator) needs infra not stood up here — the hash-source fix itself is proven deterministically.
  First real dogfood of the BL-036 worktree discipline (`wt-setup.mjs` create→work→remove). Independence caveat:
  sole agent (resource fallback) — authored+reviewed by Claude; the real check was running the code.

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
id: BL-072
status: deferred
date: 2026-07-18
epic: null
tags: [agents, identity, trust, security, launcher, design-first]
-->
- [deferred · **DECISION TAKEN, MECHANISM DEFERRED (PO, 2026-07-18)** · reopen trigger below · sibling of [[BL-071]] (DONE)] — **Agents should be aware whether they are operating WITHIN AgentTalk — but that awareness cannot be independently verified, so decide deliberately what it's allowed to mean.** PO ask (2026-07-18): a team member should know it's running as part of an AgentTalk team (future behaviours may branch on it — e.g. coordinate, commit to a worktree, don't prompt interactively). The PO's own instinct — *"I think this can only be injected by the launcher and cannot be verified independently"* — is correct, with one important sharpening.

  **✅ DECISION (PO, 2026-07-18) — behaviour-tuning, NOT authorization; and defer the mechanism.**
  - **Behaviour-tuning is the meaning** (a self-reported context signal the agent reads), **not authorization.** The
    reframe that settled it: these are **not two versions of one feature** — they live in different places and do
    different jobs. Behaviour-tuning is a signal *to the agent* (agent-side); authorization is a check the
    *orchestrator* makes (server-side, and it already knows which agents it launched/accepted). So choosing the
    light option **costs nothing toward a future authorization**: authorization would never route through the
    agent's flag anyway. No corner is painted.
  - **DEFER the mechanism (chosen: option B).** BL-072 has **no consumer today** — nothing currently branches on
    "am I in a team." Building an `isWithinAgentTalk()` helper now would be infrastructure without a user (the
    mirror of the over-engineering we avoided in BL-071). From the **orchestrator's** side the awareness is already
    total (every agent that arrives via the protocol *is* within AgentTalk, and the registry knows it); the concept
    is only missing *inside the agent's own logic*, where nothing yet consults it. So record the decision, build
    nothing yet.
  - **Two guardrails that make "light" safe (must hold whenever this is eventually built):**
    1. **The flag is context, NEVER an authorization boundary.** The failure mode is always the same: someone later
       hangs a security decision on a spoofable agent-side flag. One doc line prevents it.
    2. **Prefer the OBSERVABLE over a bare env flag.** Ground "within AgentTalk" in the *live MCP connection to an
       orchestrator*, not in an env var — note `llm-agent.mjs:240` reads `AGENTTALK_PERSISTENT_MCP_URL` **with a
       `ws://localhost:3000/mcp` default**, so "the var is set" is NOT a clean signal; the live connection is.
  - **🔓 REOPEN TRIGGER:** the first time a real behaviour needs to branch on within-AgentTalk-ness (e.g. "don't
    prompt interactively when in a team", "always commit to the task worktree"). At that point build the **thin
    agent-side signal** grounded in the live connection (option A) — and if the need is *authorization*, build it
    **orchestrator-side**, never on the agent's word.

  **Two signals hide under one question; keep them apart:**
  1. **A static injected FLAG** (an env var such as `AGENTTALK_WITHIN=true`, or reading the already-injected `AGENTTALK_ORCHESTRATOR_URL` / `AGENTTALK_PERSISTENT_MCP_URL`). **NOT independently verifiable** — a standalone process can export the same var. **The agent takes it for granted.** That is acceptable *only* if it is treated as **self-reported context, never a security boundary.**
  2. **The LIVE PROTOCOL RELATIONSHIP** — "I hold an MCP socket to an orchestrator AND just completed an `await_turn` / `exec_rpc` turn." This **IS observable**: the agent actively participates in it, so the awareness can be **grounded in an observable** rather than merely granted (cf. `ENV=prod` string vs. actually holding a live prod-DB connection). **Prefer deriving awareness from this** where the code allows.

  **The one thing genuinely unverifiable:** whether the peer on the socket is *the real AgentTalk* vs. an impostor speaking the same protocol — an agent cannot authenticate the orchestrator from inside.

  **Load-bearing principle (the actual design constraint):** **never make an agent's self-belief an enforcement point.** If "within AgentTalk" is ever used for **authorization** ("only in-team agents may do X"), it MUST be enforced **server-side by the orchestrator** — which already knows which agents it launched/accepted — not by an agent trusting its own env var. If it's only used for **behaviour tuning**, a spoofable self-reported flag is adequate and "take it for granted" is the correct, cheap answer. **So the deliverable is first a decision — behaviour-tuning (flag OK) vs. authorization (orchestrator-enforced) — then the mechanism.**

  **Grounded facts (verified 2026-07-18):** the launcher already injects a rich `AGENTTALK_*` env set including `AGENTTALK_ORCHESTRATOR_URL` and `AGENTTALK_PERSISTENT_MCP_URL`, so a de-facto "within" signal partly exists as an injected value. **Source:** PO design discussion 2026-07-18; full write-up in that session's report.

<!-- @item
id: BL-071
status: done
date: 2026-07-18
epic: null
tags: [agents, environment, observability, platform, capabilities]
-->
- [done · **DONE 2026-07-18 — both phases MERGED + PUSHED. P1 AgentTalk `0e594bc`; P2 AgentTalk `6becfa2` + client `8f02b02` (lockstep v8)** · sibling of [[BL-072]] (same "environment awareness" ask, PO 2026-07-18) · genuinely self-verifiable, unlike BL-072] — **Every team member AND the orchestrator gather info about the host system they run on (OS, arch, versions…), because future behaviours may depend on it.** PO ask (2026-07-18): e.g. knowing it's a Mac (`darwin`/`arm64`), OS release, cpu/mem, node version, hostname. Delivered as two phases; both live-verified.

  **STATUS — DONE (plans: `design/bl071-plan.md`, `design/bl071-p2-plan.md`):**
  - **P1 ✅ MERGED (`0e594bc`, 2026-07-18):** the *orchestrator's own* host env. Added `HostEnvironment`
    (`packages/contracts/src/types.ts` — pure type, wire-contract hash **v7 unchanged**), a pure
    `captureHostEnvironment()` helper (`packages/runtime-core/src/shared/environment.ts`), and the
    orchestrator serving its own self-observed host at **`GET /api/environment`** (captured once at boot).
    Verified live via a real `index.js` boot (curl returned real `darwin` host data). Schema: `platform · arch ·
    osRelease · nodeVersion · hostname · cpuCount · totalMemBytes · capturedAt`.
  - **P2 ✅ MERGED (AgentTalk `6becfa2` + client `8f02b02`, 2026-07-18, lockstep):** the *per-agent* env. New
    **`report_environment`** MCP tool (wire contract **v7→v8**, hash `8df9593…`, identical in both repos — a
    dedicated tool because the plan-review gate proved piggybacking would change the payload WITHOUT bumping the
    hash → silent drift). The client (`agentalk-mcp-client`) gathers its own host and reports it **once on connect,
    fire-and-forget** (non-critical metadata must not gate the turn loop); the orchestrator stores it on the
    `Agent` record and surfaces it via **`GET /api/agents`**. Verified LIVE end-to-end: a real v8 client attached
    to a real v8 orchestrator and its real `darwin` host appeared via `/api/agents` (no LLM turn). AgentTalk suite
    **368**, client suite **84**, cross-repo contract alignment check green.
  - **Follow-up left open (flagged, not fixed — out of P2 scope):** `scripts/m16-live-baton-proof.mjs` and
    `scripts/m17-live-gate-proof.mjs` hardcode the old v7 hash and would be rejected by a v8 orchestrator (they
    are manual live-proof scripts, not in the suite). Update them to v8 or read the hash dynamically. → consider
    filing as its own BL if it bites.

  **Why this is the *easy* half (contrast with [[BL-072]]).** Host info is **fully self-verifiable ground truth** — the agent OBSERVES its own host via node `os.*` / `process.*` (`os.platform()`, `os.release()`, `os.arch()`, `os.cpus()`, `os.totalmem()`, `process.version`, hostname, cwd). It is not a claim and cannot be spoofed *to* the agent (nor faked *by* the launcher). No trust model needed.

  **Design shape (for the plan, not prescribed here):**
  - **Per-agent, do NOT assume co-location.** Attach mode is WebSocket; agents could in principle run on different hosts. Each agent reports **its own** environment; the **orchestrator reports its own** separately. They may differ.
  - **Capture at the attach handshake** and store on the agent record in the registry (net-new field, e.g. `host` / `environment`). Surfacing it in the Team UI is a possible follow-on, not required for the core.
  - Decide the **schema** deliberately (a small stable set beats a kitchen sink) — this is data other behaviours will branch on, so it's a lightweight contract, possibly touching `packages/contracts` (client sends it) → mind the contract-hash coupling if so.

  **Grounded facts (verified 2026-07-18):** a scan of `apps/orchestrator/src` + `packages` found **zero** host/os/platform reporting at attach or anywhere else — this is genuinely net-new. **Source:** PO design discussion 2026-07-18; full write-up in that session's report.

<!-- @item
id: BL-070
status: todo
date: 2026-07-18
epic: null
tags: [flake, tests, client, reproduce-or-park]
-->
- [todo · **low priority — reproduce-or-park, no urgency** · sibling of [[BL-065]], found during that session · CLIENT repo (`agentalk-mcp-client`)] — **`exec-rpc.test.ts > "propagates the CLI agentId into nested persistent MCP bridge URLs"` can time out under cold + load: a suspected timing flake.** During the BL-065 repro session (2026-07-18), this test (`__tests__/exec-rpc.test.ts:199`) **timed out at 5000ms once**, under the same cold-`.vite` + CPU-load condition that reproduced BL-065. It was **out of BL-065's scope, not chased, and not touched** (Rule 2 — report the fault, don't silently fix it).

  **Why it's a distinct failure class from BL-065.** BL-065 was a **~271ms race** on a *string* (a fixed 250ms sleep lost to an async `'close'` event), and its fix removed the racy wait with the assertion unchanged. This one is the **opposite shape: a genuine slow-test timeout** — the test is a heavy end-to-end bar that spawns a **real `llm-agent.mjs` child** (`--provider gemini --execution-mode persistent`), waits for it to connect to a mock MCP WebSocket server, and drives a full `exec_rpc` MCP round-trip — all inside vitest's **default 5000ms** per-test budget. On a cold/loaded first run the spawn + connect + round-trip can simply exceed 5000ms. So the plausible causes are (a) an honest slow-machine timeout the bar should tolerate, and/or (b) a real latency regression somewhere in the persistent-bridge spin-up — **not yet distinguished.**

  **Reproduce before scoping (learn from BL-065: use the ACTUAL observed condition, not a proxy).** Run the full client suite repeatedly in a **fresh worktree with cold `node_modules/.vite`** under CPU load (BL-065's `node scripts/usage.mjs` heavy-load recipe; `pkill -x yes` after, assert `pgrep -x yes | wc -l` == 0). Uniform load *hid* the BL-065 race, so don't assume it will surface this one either — read the BL-065 recipe literally. Also try `--no-file-parallelism` / `--pool=forks --poolOptions.forks.singleFork` to change worker scheduling.

  **Park condition & guardrail.** If it will not reproduce, **park it and say so** — do not "fix" it by blindly bumping the 5000ms timeout, which would hide a real spin-up regression if that's what this is. Any fix must first **attribute** the latency (slow box vs. regression): if it's genuinely just a slow-machine ceiling, a *justified, documented* timeout bump (or waiting on observable connection state instead of a fixed budget) is legitimate; if it points at a real bridge-spin-up regression, that's a product finding to file separately, not a test tweak.

  **Source:** observed 2026-07-18 while landing the BL-065 fix; recorded in the BL-065 closing block ("Sibling flake found").

<!-- @item
id: BL-068
status: todo
date: 2026-07-17
epic: null
tags: [engine, ids, convention, enforcement, refuted-approach, contracts, cross-repo]
-->
- [todo · **the disease behind BL-066/BL-067; the six sites were its symptoms** · the obvious guard is **REFUTED by its own survey** — read that before proposing it again · the cure with teeth is a **cross-repo contract change** = PO scope call · PO chose "file the findings, build nothing" 2026-07-17] — **The id convention is unenforced, and the obvious guard does not work.** `mintId(prefix)` (`registry/ids.ts`) is now the convention. **Nothing makes the next person find it.**

  **The disease (BL-067's closing finding, restated because it outlives both fixes).** `registry.ts:616` (`` `msg-${Date.now()}-${this.outboundMessageSeq}` ``) and `:802` (`` `pending-relay-${Date.now()}-${++this.pendingRelaySeq}` ``) **already appended a counter** before BL-066 existed. Two people hit this defect, solved it locally, and **it never became a convention** — so it was re-introduced six times. **It was never six bugs; it was a missing convention.** `mintId` cures the six sites and cures the class only if the next person finds it.

  **The proposed guard — a test that scans source for a `Date.now()` reaching an id — is REFUTED, before implementation, by the survey that was meant to justify it (2026-07-17).** It fails at both ends at once:

  1. **Broad, it cries wolf.** There are **49 `Date.now()` sites** in source (`packages`/`apps`/`scripts`, excluding tests/dist). **~40 are ordinary elapsed-time arithmetic** — deadlines, cutoffs, `Date.now() - startedAt`, `new Date(Date.now() + intervalSeconds*1000)`. A scan that flags them is [[BL-023]]'s *"a check that cries wolf gets disabled"* on day one — one item removed from the thing it is trying to prevent.
  2. **Narrowed to the id shape, it leaks — and it leaks on this very class.** `scenario-scheduler.ts:71` assigns `Date.now()` to a **variable** (`runSuffix`), passes it as an **argument**, and interpolates it in a **different function** (`:119`, `` `${agent.id}-${suffix}` ``). **No pattern-scan of practical precision follows that.** See [[BL-069]] — filed separately, and found only by the broad survey.

  **So the instrument is noisy at one end and blind at the other, and the site it misses is exactly the class it claims to guard.** Note the provenance: this refutation exists because the survey was run **before** the code, and run **broadly** ("every `Date.now()`") rather than shaped to its conclusion — which is precisely the discipline [[BL-067]] was filed to establish.

  **The cure with teeth: branded id types.** `mintId` returns `TeamId`; `Team.id: TeamId`; then `` id: `team-${Date.now()}` `` **fails to compile**. `tsc` becomes the thing that tells the next person — no wolf to cry, and it follows values through variables and across files, which is the leak above. **Two honest limits, both read out of the code rather than assumed:**
  - **It cannot cover agent ids.** `server.ts:604` — `const agentId = id || (provider ? mintId(...) : mintId('agent'))`. **External ids are legitimate for agents by design** (attach mode, `POST /api/agents`, scenario JSON). Branding covers **team/task/conversation only**; BL-069's site stays uncovered.
  - **It is a cross-repo contract change.** The id types live in **`packages/contracts/src/types.ts`** — shared with **`agentalk-mcp-client`** and **`apps/web`**. That is not a narrow test; it is the contract surface, with the contract-hash coupling that comes with it.
  - It also introduces its own escape hatch (`asTeamId(s)`) at external boundaries. Misusable — but **explicitly and greppably** so, unlike today's silent default.

  **Where it stands.** The greenlit thing should not be built; the thing that would work is bigger than the greenlight. **PO scope call.** Reopen trigger regardless: **if a seventh id site is ever introduced**, or if `packages/contracts` is opened for another reason, this is the moment to take it.

<!-- @item
id: BL-069
status: done
date: 2026-07-17
epic: null
tags: [engine, ids, follow-up, low-severity, scenarios]
-->
- [done · **MERGED 2026-07-17** (`340bd7f`, fix `6bc2a6b`) · **a SEVENTH site of the BL-066/067 class** — found by the broad survey, invisible to the shaped one · **severity LOW and stated precisely, not by analogy**: a loud throw, not silent eviction · its real value is as **evidence that the shaped grep leaks** — see BL-068] — **The scenario scheduler's run suffix was the clock, not a counter.**

  **`scenario-scheduler.ts:71`** — `const runSuffix = Date.now();` → **`:119`** — `` const newId = `${agent.id}-${suffix}` `` → `idMap.set(agent.id, newId)`, and those ids reach the registry's agent `Map` (`registry.createAgent(agentDef.id)` in `scenario-runner.ts:27`; `registry.removeAgent(agentId)` at `:98`). **Uniqueness comes from the clock resolution** — the exact property [[BL-066]] removed everywhere else.

  **Severity: LOW — and this time the function was read, not reasoned about.** `createAgent` **guards**: `if (this.agents.has(id)) throw new Error(...)` (`registry.ts:178`) → a collision is a **loud throw**, not silent data loss. And `tick()` opens with `if (this.running) { … return null; }` (`:62`), so two runs cannot overlap — a collision needs **a whole scenario run to complete inside one millisecond**. Not realistic. **This is filed for the class, not the risk.** *(Contrast BL-067, which first claimed "silently evicted" and had to correct itself: the same guard, read this time before filing.)*

  **Why it is filed at all.** It is the same defect class — and it is the concrete counter-example that killed the pattern-scanning guard in [[BL-068]]: `Date.now()` → variable → argument → interpolation in another function in another file. **The shaped grep (``id: `team-``/``id: `task-``) could never have found it; the honest one ("every `Date.now()`") found it in a single pass.**

  **Fix if ever taken:** advance a counter for `runSuffix` (or mint via `mintId`) so the clone cannot depend on the clock. **Bar:** frozen clock — two `tick()` runs at an unmoving clock produce distinct agent ids; red before the fix. **Do not** scope it as "make scenario ids unique enough".

  **CLOSED — MERGED 2026-07-17 (`340bd7f`, fix `6bc2a6b`).** Fix matches the local idiom already at
  `registry.ts:616`/`:802` — timestamp for legibility, `++this.runSeq` for the uniqueness guarantee — extracted
  into a `private nextRunSuffix()` seam (`scenario-scheduler.ts`) so the bar can hit it under a frozen clock
  without a heavy end-to-end `tick()`. `cloneWithSuffix`'s `suffix` param went `number` → `string`; no other
  behaviour changed (diff is the two lines + the seam + the counter field).

  **Bar (as specified — frozen clock, mutation-checked per assertion).**
  `apps/orchestrator/src/__tests__/scenario-scheduler-runsuffix.test.ts` (the runtime-scenarios package is not in
  vitest's `include`, so scheduler bars live under the orchestrator app — same as `scenario-runner.test.ts`). Two
  assertions: distinct suffixes, and distinct cloned agent ids, both with the clock frozen at
  `2026-01-01T00:00:00.000Z`. **Both confirmed RED against the pre-fix `Date.now()`-only body** (`worker-1767225600000`
  collided with itself) → neither passes vacuously. Green with the fix; dist grepped to confirm the artifact under
  test carried the change.

  **Telemetry (task closure):**
  - task:        BL-069
  - wall-clock:  2026-07-17 ~17:40 → ~17:50 (~10m, worktree build included)
  - budget:      claude meter `ok:false` (LB-11) at close; codex weekly 55%, antigravity 6% per prior read
  - gate:        tsc 0 (unpiped); suite 359 → 361 (the +2 are these bars, nothing else moved); scope 2 files; dist gitignored, staged explicitly
  - diff:        2 files (+73/-2); fix `6bc2a6b`, merge `340bd7f`
  - outcome:     MERGED ✅ (branch `task-BL-069`, worktree cleaned)

  **Independence caveat (sole agent):** authored and reviewed by one actor. What carried the verdict was the
  mutation check going red and the frozen clock making it machine-speed-independent — not a re-read of the diff.

<!-- @item
id: BL-067
status: done
date: 2026-07-17
epic: null
tags: [engine, ids, data-loss, silent, follow-up, under-scope]
-->
- [done · **MERGED 2026-07-17** (`91834ae`) · **the two sites BL-066 MISSED** — same defect, same fix, filed by its own author · agent-id collision **verified**; conversation-id storage **verified** (Map + persisted)] — **Agent and conversation ids still collide: `Date.now()` alone, no counter.** Follow-up to [[BL-066]]. BL-066 fixed team/task ids and its closing block claimed the class was closed. **It was four of six.**

  **`server.ts:599`** — `` `agent-${provider}-${Date.now()}` `` (used whenever `POST /api/agents` omits an explicit id — the UI's own agent-creation panel does exactly that). **⚠️ CORRECTED 2026-07-17 by its own author, before implementing: this item first claimed agents are "silently evicted", and marked it *verified*. THAT WAS WRONG.** `createAgent` **guards**: `if (this.agents.has(id)) throw` (`registry.ts:178`) — a line the survey never looked for, because it saw `agents.set(id, agent)` (`:191`) and **reasoned by analogy with teams instead of reading the function.** The real symptom is an **HTTP 409** for a caller who asked for a *fresh* agent: loud, confusing, and harmless to data. **Different severity from conversations, and they were filed as one.** (409 is also the code the implementer-primer warns "reads like a hang".)

  **`conversation-coordinator.ts:59`** — `` `conversation-${Date.now()}` ``. Storage is `Map<string, Conversation>` (`conversation-store.ts:7`) with `.set(conversation.id, …)` (`:39`) **followed by `persist()`** → the eviction is **written to disk**, so this one is durable, not just in-memory.

  **Fix:** the existing `mintId(prefix)` from `registry/ids.ts` at both sites. Nothing parses either id format (re-verified). **Bars:** frozen clock, same discipline as BL-066 — two agents / two conversations minted in one millisecond get distinct ids and neither evicts the other; both red before the fix.

  **Why this filing exists at all (keep the mechanism, not the apology):** BL-066's survey grepped for the shape it had already concluded — ``id: `team-`` / ``id: `task-`` — and so could only ever confirm itself. **A search shaped by your conclusion is not evidence about the class.** The honest survey is "every `Date.now()` that reaches an id", which is how these two surfaced — by accident, from an id rendered on screen during unrelated work.


  **CLOSED — MERGED 2026-07-17 (`91834ae`).** `mintId` at both sites. **The two halves had different
  severities and this item first gave them one** — corrected before implementing (see the ⚠️ above): conversations
  are data loss (evicted *and persisted*); agents are a **409**, loud and harmless. Both bars freeze the clock and
  were proven to bite against the mutation they own. **The agent bar's first draft was VACUOUS:** on unfixed code
  the second POST fails, so its body has no `id`, and `a.id !== undefined` passed for a reason unrelated to the
  guarantee — it asserts both statuses are 200 first. The conversation bar drives the coordinator with **stub
  deps**, because `startConversation` awaits a real healthcheck and a frozen clock stops that completing: the bar
  **times out instead of biting**, which reads identically in the summary and proves nothing.

  **★ The finding that outlives this fix — the disease, not the symptom.** `registry.ts:616`
  (`` `msg-${Date.now()}-${this.outboundMessageSeq}` ``) and `:802`
  (`` `pending-relay-${Date.now()}-${++this.pendingRelaySeq}` ``) **ALREADY append a counter.** Two people hit this
  defect, solved it locally, and **it never became a convention** — so it was re-introduced six times. **This was a
  missing convention, not six bugs**, and `mintId` only cures it if the next person finds it. *Nothing enforces it
  today.*

  **Surveyed, NOT fixed (out of scope, reported):** `registry.ts:280` `usage-${Date.now()}` and
  `conversations/runtime.ts:230` `req-${Date.now()}` are **correlation ids, not Map keys** (ambiguous in a
  recording, not lost; only the first verified) · **`apps/web/src/App.tsx:194` uses `String(Date.now())` as a React
  key** — two events in one ms collide (real, cheap, unfiled). Genuinely safe: `healthcheck-manager.ts:15` and
  `scheduler.ts:90` append `Math.random()`.

  **Telemetry (task closure):**
  - task:        BL-067
  - wall-clock:  2026-07-17 ~13:35 → 14:12 (~37m, file→merge)
  - budget:      weekly 46%→47%, session 18%→34% (Δ ~16%, incl. BL-056's live runs)
  - gate:        tsc 0, suite 355/355 (353 + 2), bars isolation-stable 4/4
  - diff:        4 files, +104/-2, commit `89a38e5` → merge `91834ae`
  - outcome:     MERGED ✅

<!-- @item
id: BL-066
status: done
date: 2026-07-17
epic: null
tags: [engine, ids, data-loss, silent, autonomy, proven]
-->
- [done · **MERGED 2026-07-17** (`fc3b55a`) · **proven live, not theorised** — probe output below · unblocked BL-056, whose fix is keyed on `teamId`] — **Team and task ids collide: `Date.now()` alone is the id, so two created in the same millisecond are the SAME id — and the second silently overwrites the first.** Four mint sites: `team-coordinator.ts:177` (`team-${Date.now()}`), `:262`, `:338` (`task-${Date.now()}`), `arbiter-coordinator.ts:59`. Storage is `Map.set(id, …)` (`team-coordinator.ts:186`), so a collision is a **silent overwrite — no error, no warning, an object simply ceases to exist.**

  **Proof** (probe, 2026-07-17 — two `createTeam` calls back-to-back):
  ```
  TEAM A id: team-1784286771163
  TEAM B id: team-1784286771163
  COLLIDED: true
  teams in registry: 1   (2 means no collision)
  ```

  **Why it matters more than its frequency suggests.** A human clicking the UI never hits it; today's 8 teams were minutes apart. **An autonomous orchestrator creating teams/tasks programmatically hits it exactly the way a test loop does — so this defect gets MORE likely the better the ladder works.** For tasks it is worse than a lost pointer: `tasks` is `Map<string, TeamTask>`, so a same-ms task id destroys a **transcript** — in the very map BL-056's fix depends on being lossless.

  **How it was found (worth keeping — the mechanism, not the anecdote):** a BL-056 bar written for another purpose ("does not leak another team's tasks") flaked. **In the full suite it PASSES 354/354; in isolation it fails 5 of 6** — full-suite load spaces the two `createTeam` calls into different milliseconds. **A green produced by timing, in a suite that would have passed every gate.** Had the bar been deleted as flaky, the defect would have shipped under a green.

  **Fix shape:** `Date.now()` + a monotonic counter (or random suffix) at all four sites. **Risk is provably low: nothing anywhere parses or asserts the generated id format** (grep: one test passes a literal `'team-1'` as input; no format assertions, no recording parses it). **Bars:** two teams back-to-back get distinct ids; two tasks back-to-back get distinct ids; both red on master.


  **CLOSED — MERGED 2026-07-17 (`fc3b55a`) — but INCOMPLETE: it fixed FOUR of SIX sites. See [[BL-067]].**
  One shared `mintId(prefix)` (`registry/ids.ts`) → `<prefix>-<epochMs>-<sequence>`, wired into the four
  team/task sites.
  **⚠️ The "four mint sites" figure in this item is WRONG — there are six.** Agent ids (`server.ts:599`) and
  conversation ids (`conversation-coordinator.ts:59`) carry the identical defect and were NOT fixed here. The
  miss has a mechanism worth keeping: the survey grepped for ``id: `team-`` and ``id: `task-`` — **the exact
  shape already assumed** — so it returned the assumption rather than the class, and "all four sites" read as
  complete. **A grep shaped by your conclusion cannot disconfirm it.** Found only when a stray `POST /api/agents`
  put `agent-gemini-1784289424679` on screen during unrelated work. **The counter carries uniqueness, not the
  timestamp** — so it holds under any clock resolution, NTP skew, or a clock that steps backwards. The timestamp
  stays only to keep an id legible; **nothing may depend on it for identity.** One mint shared by both
  coordinators, so their separate task maps never need reasoning about twice.

  **Every bar freezes the clock — that is the deliverable, not a detail.** The defect was found by a bar whose
  verdict was decided by *timing*: 354/354 green under full-suite load, 5-of-6 red in isolation, because load
  spaced two mints into different milliseconds. **A bar that reports on the machine rather than the code is not
  evidence.** Frozen, the collision is certain: isolation-stable 5/5. It also states the honest property —
  "ids are usually unique" is not one; **"ids are unique even when the clock does not move"** is.

  **Each bar was proven to bite against the mutation it OWNS — and the first reading was wrong.** Four reds
  looked like four bites; two were **crash-reds**: the task bars died on `Error: Team is already working on a
  task`, killed by the *team* collision before ever testing a *task* id. Staging the fix (team ids only) made the
  task bar fail on its own assertion — `expected 'task-...' not to be 'task-...'` — and only then were the task
  sites fixed. **Read the mutant and read the failure message; the summary line cannot tell the two apart**
  (the primer hazard, hit and caught).

  **Verified it unblocked BL-056 rather than asserting it:** BL-056's leak bar, isolated, went 5-of-6 red →
  **6-for-6 green**.

  **Telemetry (task closure):**
  - task:        BL-066
  - wall-clock:  2026-07-17 ~13:00 → 13:29 (~30m, file→merge)
  - budget:      weekly 45%→46% (Δ ~1%), session 12%→18% (Δ ~6%)
  - gate:        tsc 0, suite 353/353 (baseline 350 + 3), isolation-stable 5/5, sweep clean (BL-023; the
                 restarted orchestrator declared via `AGENTTALK_SWEEP_DECLARED=54344`)
  - diff:        4 files, +116/-4, commits `bf958ed` → merge `fc3b55a`
  - outcome:     MERGED ✅ (not pushed — PO said "merge")

<!-- @item
id: BL-065
status: done
date: 2026-07-17
epic: null
tags: [flake, tests, client, trust, reproduced]
-->
- [done · **MERGED + PUSHED 2026-07-18 — client `8d0a823` (fix `c1d05f2`, branch `task-BL-065`)** — reproduced 2/12 in a fresh worktree under CPU load, 0/37 warm; mechanism isolated; test-only fix, assertion unchanged, mutation-checked, 16/16 green under the repro battery] — **`executor-hardening.test.mjs` can fail under full-suite load: a suspected timing flake.** The test
  `persistent executor hardening > fails a turn loudly when the session died earlier, instead of waiting on a dead
  child` **failed once** during the first full-suite run of the vitest-scope fix (client `786f58a`), in a
  **freshly-created worktree** (cold caches, cold transform, symlinked `node_modules` — i.e. the slowest possible
  run).
  **Honest attribution — the numbers, not a verdict:** **1 failure in 4 full runs WITH the fix; 0 in 3 full runs on
  master; 0 in 3 isolated runs of the file itself.** Small samples both ways. The fix **does** change which files
  vitest collects (it stops collecting gitignored `runs/`), which changes worker scheduling — **so the fix cannot
  be ruled out**, and neither can plain cold-worktree timing. **It was NOT chased further and the test was NOT
  touched** (out of scope; Rule 2 — report a discovered fault, don't silently fix it).
  **Why it matters more than a one-off annoyance:** the test is timing-sensitive *by construction* — it is about a
  **dead child** and **waiting** — so a slow/loaded machine is exactly its failure mode, and CI is a slow, loaded
  machine. **A suite that can go red under load erodes every verdict the autonomous-development ladder rests on**
  (we grade agy against this suite). That is the same reason the standing collection red was worth clearing at all.
  **Reproduce before scoping:** run the full client suite repeatedly, ideally on a cold/loaded machine or with
  constrained parallelism (`--no-file-parallelism`, or `--pool=forks --poolOptions.forks.singleFork`), and try a
  fresh worktree — the one observed failure was a first-run-in-a-fresh-worktree. If it will not reproduce, say so
  and **park it rather than inventing a fix**: an unreproducible flake "fixed" by loosening the bar is worse than
  the flake, because it retires a real guarantee (the executor must fail loudly on a dead session — that guarantee
  is the point of the test).
  **Source:** observed 2026-07-17 while landing the client vitest-scope fix; full numbers in that session's report.

  **REPRODUCED 2026-07-18 (Claude, implementer under resource fallback) — it is a TEST timing bug, not a product
  defect.** 58 full-suite runs: **normal 0/10 · heavy CPU load (warm) 0/12 · cold `.vite` + load (primary checkout)
  0/15 · fresh worktree cold + load 2/12 (~17%)**. Reproduces **only** in a fresh worktree — the exact original
  condition — consistent with the reported 1/4. Both failures took **271ms / 289ms**, i.e. a race, **not** the
  5000ms timeout.
  **Mechanism:** hc-4 spawns a child that `exit(3)`s, waits a **fixed 250ms**, then calls `executeTurn` expecting
  the *synchronous* `_sendToStdin` guard (`executor-runtime.mjs:283-284`) to throw
  `"session is not available: the session exited with code 3"`. That guard only fires if the child's `'close'` event
  has set `_exitInfo` within the 250ms. On a cold/loaded first run the `'close'` callback lands **after** the sleep,
  so `executeTurn` meets a not-yet-reaped child, writes to stdin, and the child's later `'close'` rejects via the
  *async* handler (`:195`) with `"Persistent claude session exited with code 3"` — **equally loud and correct, but a
  different string** → the regex misses → red. Warm/uniform load doesn't hit it because the load stretches the 250ms
  timer too. The guarantee the test protects (executor fails loudly on a dead session) is **never violated** — the
  test merely pins the exact string of one of two equally-valid loud paths, gated on a racy sleep.
  **Fix (test-only, assertion byte-for-byte unchanged — does NOT relax the bar):** replace the fixed `setTimeout(250)`
  with a bounded `waitFor(() => executor.getStatus() === 'error')`, so the child is provably reaped before the turn
  and the synchronous guard is the deterministic path under test. **Not** widened to accept both messages (that would
  hide which path ran). **Mutation-checked:** removing the product's exit guard (`:283-284`) still reddens the fixed
  test. **16/16 green** under the same cold+load battery that gave 2/12 unfixed; full client suite 81/81; diff is one
  file, +20/-2. Awaiting the PO merge (client repo, `task-BL-065`, `c1d05f2`).
  **Sibling flake found (out of scope, unfiled):** under cold + load, `exec-rpc.test.ts > "propagates the CLI agentId
  into nested persistent MCP bridge URLs"` timed out at 5000ms **once** — a separate heavier-test flake; file its own
  BL if it recurs.

  **CLOSED 2026-07-18 — merged + pushed, client `8d0a823` (fix `c1d05f2`, branch `task-BL-065`, per-task worktree,
  PO-gated).** The item was reproduce-or-park and turned out **reproducible** → became a scoped test-only fix.

  **Telemetry (task closure):**
  - task:        BL-065
  - wall-clock:  2026-07-18 ~08:52 → 09:44 (~52m, prime → merge+push)
  - budget:      weekly claude 52%→54% (Δ ~2%), session unavailable (`claude` block ok:false, LB-11)
  - gate:        client suite 81/81 (merged master); mutation-check red-confirmed; diff test-only (+20/-2, 1 file)
  - diff:        client 1 file +20/-2, commits `c1d05f2` → merge `8d0a823`; backlog `3cc2a98` + this closure
  - outcome:     MERGED + PUSHED ✅

<!-- @item
id: BL-064
status: done
date: 2026-07-17
epic: null
tags: [observability, autonomy, ladder, run-artifact, client, bl056-sibling]
-->
- [done · **MERGED + PUSHED 2026-07-17** — client `1ffcd01` · filed from the rung-2 run, which it BLOCKED · PO-approved design: sidecar NDJSON via an env-passed path · sibling of BL-056, not a replacement — see the boundary below] —
  **The worker's report text is captured NOWHERE, so an agent-driven run cannot be graded.** The full model
  response exists client-side at **`llm-agent.mjs:125`** (`submit_exec_result` → `text: result.response`) and is
  **never logged** before it crosses MCP. It is **not** in the run recording — the NDJSON holds lifecycle only
  (`run-start · agent-launched · goal-delivered · outcome`; `bite0-launcher.mjs:154/158/171`) — and it is **not**
  recoverable from the launcher either: `agent-launcher.mjs:146` spawns the child with **`stdio: 'inherit'`**, so
  the child's output reaches the operator's terminal but the launcher process **cannot read it**. Orchestrator-side
  it lands in `task.transcript`, which has **no read endpoint** and is dropped on completion — that is BL-056's
  root cause.
  **Why it matters — it is a hard blocker on the autonomous-development ladder, twice proven.** **Rung 1.5**
  (2026-07-16): agy was asked to justify its fix over the alternatives it rejected; it did, and **that text is
  gone**. **Rung 2** (2026-07-17): the goal's central deliverable was a **pasted mutation-check transcript** — and
  the run was **ungradable**, because the report channel does not exist. agy diagnosed correctly (it built a
  two-repo fixture, `runs/rung2-agy-diagnosis-probe.mjs`), delivered no fix and no commit, and reported
  `completed` — **and we cannot know why.** That `completed`-with-no-artifact shape is the **BL-059 accusation
  shape**; without the report, the only available reading of a future occurrence is a model-honesty defect, which
  is exactly the false conclusion that cost two sessions. **For grading judgment, the artifact shows the answer and
  hides the thinking.**
  **Fix shape (PO-approved 2026-07-17):** the launcher passes the run's recording path to `llm-agent` via **env**;
  `llm-agent` appends an **`agent-response`** event (`{ agentId, text, usage }`) to a **SIDECAR**
  `<recording>.responses.ndjson`, reusing the existing `createNdjsonRecorder` (`bite0-launcher.mjs:193`).
  **Sidecar, not the main recording:** two processes appending to one file would interleave on a large response.
  **Rejected alternatives (recorded so they are not re-litigated):** switching the spawn to `stdio: 'pipe'` and
  parsing a marker line (touches the spawn path; buffering/backpressure risk for a pure-observability win); a bare
  `console.log` (unstructured, and durable only if the operator remembers to redirect).
  **Boundary vs [[BL-056]] — this does NOT close it.** BL-056 is the **UI-facing** half: survive a page reload, review
  a past run, task read endpoint, retain completed tasks (needs a PO go per LB-93). BL-064 is the **run-artifact**
  half: the grading channel for the ladder. They can land independently; BL-056's read endpoint would later be a
  cleaner source for the same text.
  **Scope:** `agentalk-mcp-client` only (`llm-agent.mjs`, `lib/bite0-launcher.mjs`, `lib/agent-launcher.mjs`) — no
  orchestrator change, no contract-hash movement. **DoD:** a test that fails before / passes after, **proven by
  mutation-check** (restore the defect, keep the test, demand a red — no mutation-check ⇒ no VERIFIED), plus the
  existing client suite green. ⚠️ **`scope-check` is single-repo blind ([[BL-022]])** — a green scope-check on this
  task inspects **none** of the diff, because the whole diff lives in the other repo. Do not read it as a fence.

  **CLOSED 2026-07-17 — merged + pushed, client `1ffcd01` (branch `task-BL-064`, per-task worktree, PO-gated).**
  The launcher derives `<recording>.responses.ndjson` and hands it down as `AGENTTALK_RESPONSE_LOG`; `llm-agent`
  files the report there **before** it crosses MCP. Main recording verified unaffected — still exactly
  `run-start · agent-launched · goal-delivered · outcome`, no interleaving.
  **PROVEN LIVE, not merely unit-green** (a passing unit test was never the claim): a real agy run captured
  *"The result of 17 multiplied by 23 is 391. I am confident because decomposing the problem into (17 * 20) +
  (17 * 3) yields 340 + 51, which straightforwardly equals 391."* — **391 is COMPUTED**, so no stub explains it,
  and the second clause is **the reasoning**, i.e. the exact class of text that was unrecoverable that morning.
  **The bar nearly repeated the very defect this item exists to fix.** A test asserting *"the env var is passed"*
  proves the **plumbing** while the **guarantee** (the report gets written) goes unasserted — a bar starting
  **below** the defect, the same shape that let BL-063's duplication live at `in-process-driver.test.ts:218-219`.
  Hence `createResponseRecorder`: the where-does-it-go decision is extracted so the bar can hit the guarantee
  itself. **Mutation-checked both halves:** remove the plumbing → `expected undefined to be
  '/runs/…responses.ndjson'`; restore the pre-BL-064 world → **3 of 4 fail**. The 4th survives **correctly** (it
  asserts the no-op-when-unset case, which the mutation satisfies by definition) — recorded rather than rounded up
  to 4/4.
  **Known limits, not hidden:** `usage` records `0/0` — that is what `result.tokenDetails` yields for
  gemini/persistent. **The sidecar carries the report, not the cost.**
  **Trap for the next worktree run:** `.gitignore` has `node_modules/` **with a trailing slash**, which matches a
  *directory*; a symlinked `node_modules` is a **file** and slips past it, so `git add -A` in a seeded worktree
  will commit the symlink. Stage explicitly.
  **Pre-existing red found while sweeping (NOT caused by this task, left for a PO call):** the client suite is
  **file-level red on master and on `origin/master` alike** — `runs/rung15-probe-STALE-see-notes.test.ts` fails
  collection with `Cannot find module '../in-process-driver.js'`. It is the **INVALID** rung-1.5 probe (see
  BL-063): gitignored local scratch, written against **AgentTalk** paths, sitting in the **client** repo where
  vitest collects it. All 79 tests pass; only that file errors. Verified pre-existing by running `origin/master`
  (`1 failed | 11 passed`, 73 tests). **Not deleted on purpose** — BL-063 preserved it deliberately as the record
  of an invalid probe, and destroying that record is a PO call, not a sweep-up. Options: delete it, rename it out
  of the test glob, or exclude `runs/` in the client's vitest config.

  **Telemetry (task closure):**
  - task:        BL-064
  - wall-clock:  2026-07-17 ~07:58 → 08:16 (~18 min)
  - budget:      telemetry unavailable at close (`antigravity` read `ok:false` after the rung-2 run; LB-11)
  - gate:        client suite 79/79 (was 73) + **live proof** (computed `391` + reasoning captured);
                 pollution clean (node_modules symlink kept out by explicit staging)
  - diff:        6 files, +170/-1; commits `17fb8be` (fix) + `1ffcd01` (merge), pushed & verified via fetch
  - outcome:     MERGED ✅ + PUSHED ✅

<!-- @item
id: BL-063
status: done
date: 2026-07-17
epic: null
tags: [worktree-context, duplication, prompt, vacuous-test, rung15, agy-authored, bl053-adjacent]
-->
- [done · **MERGED 2026-07-17** — `a971b25` · filed from the rung-1.5 run (agy's first real engineering task) · agy's
  fix was good and was taken; its regression test was mutation-proven vacuous and was NOT] —
  **`WORKTREE_CONTEXT` reaches a two-agent worker TWICE.** Both coordinators append it to the plan before the driver
  ever sees it — `team-coordinator.ts:1530` (`buildWorkerPlan`: `` `${plan}\n\n${GIT_WORKTREE_REQUIREMENT}` ``, called
  at `:1347`) and `arbiter-coordinator.ts:385` (`` `${task.plan!}\n\n${GIT_WORKTREE_REQUIREMENT}` ``) — and then
  **`in-process-driver.ts:277`/`:291` appends `WORKTREE_CONTEXT` again** when rendering the prompt. The worker-only
  path is clean (BL-062 set `plan: ''`), so **only the two-agent path duplicates**.
  **Why it survived, and why the fix alone is not the deliverable:** `in-process-driver.test.ts:218-219` already
  asserts the context appears **exactly once** — but it drives the **driver alone** (`runWorkAssign(plan)` hands the
  driver a raw plan, `:197`), and the duplication is **injected by the coordinator upstream**. A bar that starts
  below the defect cannot see it. **agy's regression test repeats that exact shape and is therefore vacuous: the bug
  was fully restored and its test still passed** (mutation-checked, 2026-07-17). **The worker inherited the
  codebase's blind spot.**
  **Fix shape (agy's, and it is the right one — path-complete, avoids the trap):** delete the append from **both**
  coordinators (`plan: task.plan!`), leaving the driver the **single source** of the context. The *obvious* fix —
  deleting only the driver's copy — leaves `arbiter-coordinator` still duplicating. Also delete the now-dead
  `buildWorkerPlan` + `GIT_WORKTREE_REQUIREMENT`, and **the now-unused `WORKTREE_CONTEXT` import at
  `team-coordinator.ts:7`** (agy left it, plus a stray blank line in the arbiter).
  **DoD — the real test is the whole point of this item:** a regression test that drives the **coordinator→driver**
  path (not the driver alone) and **fails before / passes after**, proven by **mutation-check** (restore the defect,
  keep the test, demand a red). No mutation-check ⇒ no VERIFIED. ⚠️ **Behaviour change on shared engine code**
  (`team-coordinator.ts`, `arbiter-coordinator.ts`) → **needs PO confirmation**; the worker-only path (BL-062) must
  stay byte-for-byte.
  **Artifacts (durable, gitignored) in `agentalk-mcp-client/runs/`:** `rung15-agy-e966992.patch` (the fix),
  `rung15-run-transcript.log`, `rung15.config.json`. ⛔ **`rung15-probe-STALE-see-notes.test.ts` is INVALID** — it
  hardcodes the pre-fix plan shape (old `buildWorkerPlan` output) that a correct fix deletes, so it manufactures the
  duplicate it counts; **do not reuse it without fixing its input assumption.**
  **Independence caveat:** the task that produced this fix was designed AND graded by Claude, the sole available
  agent — the author/reviewer split the workflow relies on does not currently exist. Flagged to the PO.

  **CLOSED 2026-07-17 — merged `a971b25` (branch `task-BL-063`, per-task worktree, PO-gated).** Both coordinators now
  send `plan: task.plan!` and the driver is the single source of `WORKTREE_CONTEXT`. agy's fix was taken as filed —
  it was path-complete. **agy's regression test was not taken.**
  **Two things surfaced that this item did not predict, and both matter more than the fix:**
  1. **The fix broke a live behaviour contract.** `apps/orchestrator/src/__tests__/team-coordinator.test.ts:204`
     demanded the context ride **inside** the `plan` payload — BL-053's guarantee asserted at the coordinator. That is
     the very mechanism this item deletes. **PO approved moving it** (2026-07-17): the assertion now lives on the
     **rendered prompt** (coordinator → driver), where the worker actually reads it. **Asserting the mechanism is what
     hid the defect** — the coordinator appended, the driver appended again, no bar spanned both, so each half looked
     correct in isolation.
  2. **The arbiter path was unbarred ENTIRELY.** With `arbiter-coordinator`'s append fully restored, **all 328 tests
     passed.** So **agy's "runtime-core 97/97 green" was never evidence the fix was safe** — the contract it broke
     lives in `apps/orchestrator`, a suite agy never ran (the primer's warning that scoping agy's bar to the package
     it edits makes a full-suite green partly vacuous — here it hid a real red, and a genuine consequence nobody had
     seen).
  **Both new bars are mutation-checked per ASSERTION, not per test** — the plan-equality check short-circuits ahead of
  the count check, so a naive mutation-run reds out without ever executing the guarantee. Neutralising it proved the
  count assertion itself bites: **`expected 2 to be 1`** on each path.
  **Method note worth keeping:** the vacuity trap is structural, not agy's alone — a bar that starts **below** where
  the defect is injected cannot see it, however green it looks. `in-process-driver.test.ts:218-219` (untouched, still
  guarding BL-062's worker-only path) is the original instance; agy's test reproduced its shape. **The worker inherits
  the codebase's blind spots.**

  **Telemetry (task closure):**
  - task:        BL-063
  - wall-clock:  2026-07-17 06:58 → 07:39 (~41 min)
  - budget:      weekly ~36% at close (Δ unavailable — the `claude` meter read `ok:false` at session start, LB-11),
                 session 22% at close
  - gate:        tsc 0, suite 329/329 (57 files; baseline 328 + 1 new arbiter bar), pollution clean (4 files, all in
                 scope; `in-process-driver.test.ts` untouched → BL-062's worker-only path byte-for-byte)
  - diff:        5 files, +185/-25; commits `7e353f7` (filing) + `7e60892` (fix) + `a971b25` (merge)
  - outcome:     MERGED ✅ (not pushed — PO says "merge" and "push" as separate words)

<!-- @item
id: BL-022
status: done
date: 2026-07-09
epic: null
tags: [scope-fence, tooling, cross-repo, friction-m18]
-->
- [done · **MERGED + PUSHED 2026-07-17** — `28aa670` · PO decided the open question: a declared repo missing from disk is a HARD FAILURE, not a silent skip · cross-repo shape + e2e bar originate from agy's rung-2 run] — **M18 C7 friction item** — filed from evidence at epic close; the fence we shipped in M18-T1 has a
  hole we hit in M18-T3a the same day] — **`scope-check` is single-repo blind** — `scripts/scope-check.mjs`
  diffs only the AgentTalk working tree, so any task whose code lives in `agentalk-mcp-client` (or any other
  repo) is **unfenced while reporting green**. M18-T3a's *primary* change was `bridge.mjs`; its `scope-check`
  passed having inspected none of it. **Evidence:** M18-T3a Gate-1 condition 2 + the task-end review's declared
  honesty note (`design/milestone18-self-hosting-implementation.md`). Fix sketch: manifest gains a per-repo
  section; the script iterates declared repos. Until then a green `scope-check` must not be read as "the diff
  was fenced." **2026-07-10 backlog gate:** rather than fix this for M19, the **PO constrained M19-T1's refactor
  target to the AgentTalk repo** — so the fence is not blind for that task. The hole remains; ranked for after M19.

  **2026-07-17 — a CANDIDATE FIX exists, from the rung-2 run (agy). PO: file it as this task's starting point.**
  **Artifact (durable, gitignored):** `agentalk-mcp-client/runs/rung2-take2-agy-8b9db8b.patch`, plus
  `rung2-take2-transcript.log` and the report sidecar `rung2-take2.ndjson.responses.ndjson` (the first agy run
  whose *reasoning* survives — [[BL-064]] shipped hours earlier and is what made it readable).
  **Do NOT merge the patch from the sandbox — it returns as a reviewed task.**
  **What agy found and chose (its own words, from the sidecar):** `getChangedFiles()` ran `git diff`/`git status`
  exclusively with `cwd: repoRoot` and never consulted the manifest for sibling repos. Its fix makes
  `getChangedFiles(scope)` extract every distinct `../<repo>` prefix declared across `allowed`/`forbidden`/`free`,
  iterate those repos, and prefix the returned paths. **It rejected an alternative and said why:** *"I chose this
  approach over attempting to run `git` from the parent directory (`..`) because `git` is restricted to its own
  workspace boundary."* That is a correct argument, and it matches this item's own fix sketch (per-repo section,
  script iterates declared repos).
  **Its bar BITES — verified independently, not taken on the paste.** agy pasted a mutation-check transcript; that
  is a *claim*. Claude restored the buggy source itself, kept agy's test, and re-ran: `× checks changes in other
  repositories declared in the scope manifest` → `AssertionError: expected undefined to be defined` →
  `1 failed | 7 passed (8)` — **reproducing agy's transcript exactly.** The bar is a real e2e: it stands up two
  temp git repos, copies the script in, runs it, and demands `❌ [OUT OF SCOPE] ../other-repo/foo.js`. Passing:
  **8/8** (baseline 7). Scope respected — `scripts/` only.
  **⚠️ CONCERN THE MUTATION-CHECK DOES NOT COVER — a fence that FAILS OPEN.** `if (!fs.existsSync(targetCwd))
  continue;` silently **skips a declared repo that is not on disk**, and agy described this as a feature
  (*"gracefully skipped"*). **That is this item's own defect class, reintroduced one layer up:** unfenced while
  reporting green. It also cuts against this codebase's settled instinct — [[BL-052]] refuses rather than inherits,
  [[BL-061]] fails closed when a worktree cannot be provisioned. **A decision, not a patch tweak: should a missing
  declared repo be a hard failure, a loud warning, or a silent skip?** Related residual: a repo the manifest never
  declares is still invisible, so a task that forgets to declare one is unfenced-while-green — inherent to the
  sketch, worth stating in the refusal message.
  **Also needs cleanup:** `scripts/__tests__/test-runner.js` (+62 lines) is scratch scaffolding duplicating the
  test's scenario — not a vitest file, so it is dead weight (the same shape as the unused import agy left in
  [[BL-063]]). And `catch (e) {}` on the `git status` call swallows errors silently.
  **DoD:** the fail-open decision made and implemented; the scratch runner removed; agy's bar kept and re-proven by
  **mutation-check** (no mutation-check ⇒ no VERIFIED); `npx vitest run scripts` green.
  **Independence caveat:** the rung-2 task was designed AND graded by Claude, the sole available agent.

  **2026-07-17 — CLOSED. MERGED + PUSHED (`28aa670`).**
  **The decision (PO):** a declared repo missing from disk is a **HARD FAILURE**. Implemented as a refusal that
  names each missing repo and its resolved path, and states the residual the item asked for: *the fence only sees
  repos the manifest DECLARES, so an undeclared repo is unfenced while green.* The **same rule was extended one
  step** — a declared path that exists but is **not a readable git repo** now refuses too, because the
  `catch (e) {}` on `git status` was swallowing that case into the identical unfenced-while-green hole. Consistent
  with [[BL-052]] (refuse rather than inherit) and [[BL-061]] (fail closed).
  **What came from agy (rung 2):** the `getChangedFiles(scope)` cross-repo shape (derive each distinct `../<repo>`
  prefix from `allowed`/`forbidden`/`free`, iterate, prefix the returned paths) and the e2e bar. Its patch was NOT
  merged from the sandbox — the shape was re-applied by hand and its bar kept. Its scratch
  `scripts/__tests__/test-runner.js` was deliberately **not** carried over.
  **Mutation-check — per ASSERTION, not per test, and it is the load-bearing evidence:**
  | mutation | agy's bar | new fail-hard bar |
  |---|---|---|
  | blind again (scope ignored) | **red** | **red** |
  | fail-open restored (silent skip) | **PASSES** | **red** |
  The bottom-left cell is the finding: **agy's bar cannot see the fail-open at all** — a mutation-check of its
  delivery alone would have blessed it. This is the concrete proof of the item's own warning that *"the
  mutation-check does not retire the reviewer's read"*; only reading the diff found it.
  **Two honest process notes** (both are [[IP-16]] shaped — a red earned for the wrong reason):
  (1) the first mutation attempt deleted `const files = new Set();` instead of neutering the arg, so both bars
  reddened on a `ReferenceError` — a crash-red is indistinguishable from a bite-red in the output; caught and
  re-mutated. (2) Both bars initially failed on `expect(error).toBeDefined()`, which **short-circuits ahead of**
  the `toContain` guarantees; the early assertion had to be neutralised and re-mutated before the guarantees
  could honestly be called proven.
  **Independence caveat:** authored AND reviewed by Claude, sole available agent (PO 2026-07-15).

  **Telemetry (task closure):**
  - task:        BL-022
  - wall-clock:  2026-07-17 08:33 → 08:50 (~17m)
  - budget:      weekly 38%→39% (Δ ~1%), session 43%→50% (Δ ~7%) [per scripts/usage.mjs]
  - gate:        tsc 0, suite 331/331 (57 files; baseline 329 + 2 new e2e bars), scripts 9/9 (baseline 7),
                 pollution clean (2 files, both in scope; node_modules symlink removed before staging)
  - diff:        2 files, +165/-17; commits `a380e6b` (fix) + `28aa670` (merge)
  - outcome:     MERGED ✅ + PUSHED ✅ (PO said both words)

<!-- @item
id: BL-023
status: done
date: 2026-07-09
epic: null
tags: [hygiene, pollution, gates, friction-m18]
-->
- [done · **MERGED + PUSHED 2026-07-17** — `fc53522` · fails closed on UNKNOWN (PO decision) · never consults ppid, which cannot discriminate · escape valve shipped with the check · **M18 C7 friction item — PREMISE CORRECTED 2026-07-09 at session close, before anyone acted on it**]
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

  **2026-07-17 — a CANDIDATE SKELETON exists, from the rung-3 run (agy). PO: file it as this task's starting point.**
  **Artifacts (durable, gitignored):** `agentalk-mcp-client/runs/rung3-agy-7aa4a0a.patch`, plus
  `rung3-run-transcript.log` and the report sidecar `rung3.ndjson.responses.ndjson`.
  **Do NOT merge the patch from the sandbox — it returns as a reviewed task.** Run: 09:14→09:18 (~3.5 min of a
  15-min cap); scope clean (only `scripts/`, 2 files, no leftovers); the sole `kill` is of its own dummy process,
  which the goal permitted; containment held (sandbox worktree, zero remotes).

  **⚠️ TWO PREMISES OF THE FIX SKETCH ABOVE ARE NOW CORRECTED — read before scoping:**
  1. **`pgrep` is NOT blind to the launchd service.** Verified live 2026-07-17: `pgrep -f dist/index.js` returns
     **4064**, the PO's `com.fausto.agenttalk-orchestrator`. The op-note claiming "pgrep does not find it" is
     imprecise — a *guessed* pattern misses it; this exact pattern does not.
  2. **`ppid` CANNOT discriminate, and this is the trap at the centre of the item.** The launchd service runs at
     **ppid 1** — but an **orphaned leak also reparents to ppid 1**. Classify `ppid 1` as "service" and every leak
     reads clean (fail-open); classify it as "leak" and you reproduce **exactly the false finding that got this
     item's own premise corrected** (IP-15). The only **positive** evidence is **`launchctl list`**, which names
     4064 and knows nothing about a hand-started process.

  **What agy built:** `scripts/check-orchestrator-ports.mjs` — `lsof -iTCP -sTCP:LISTEN` for listening node procs,
  then per-PID `lsof -p <pid> -a -d cwd` + `ps -o command=`; "orchestrator-ish" = cmd/cwd contains `index.js` or
  `orchestrator`. Read-only via `lsof`/`ps`, which **correctly honours report-not-reap**. It rejected an alternative
  and said why (`netstat` lacks PIDs in some contexts). A reasonable **skeleton**.

  **✅ THE RUNG-3 QUESTION IS ANSWERED — YES, and against Claude's explicit prediction.** agy **found a fail-open in
  its own work, unprompted**: the goal never said "fail open", never named `ppid` or `launchctl`, and only asked
  what the check *cannot see*. Its own words: *"If `lsof` fails to retrieve the CWD... my script defaults the CWD to
  `'unknown'`. Because `'unknown'` does not explicitly match the test directory naming convention, the process is
  **silently classified as LEGITIMATE, causing a false negative**."* It **also** volunteered what its test does not
  prove (that a genuinely legitimate orchestrator is correctly ignored — *"it only asserts the presence of the dummy
  PID log"*). **Its mutation-check reproduced exactly** on independent replay (Claude restored `isLeaked = false`
  itself: same assertion, right reason) — the second consecutive honest agy transcript. This is a real advance on
  rung 2, where it shipped a fail-open and called it *"gracefully skipped"*.

  **❌ AND THE DELIVERY IS REFUTED — it missed the CENTRAL fail-open while naming a peripheral one.**
  1. **The classifier IS a fail-open, by design, and agy did not name it.**
     `const isLeaked = isDeleted || isTaskWorktree;` — **default LEGITIMATE**, with **no positive evidence for
     "service" anywhere**; `launchctl` is never called. It does not distinguish *leak from service*; it
     distinguishes *task-worktree process from everything else*. **So the ORIGINAL BL-023 scenario — an
     orchestrator leaked by a proof run from the repo root — reports LEGITIMATE.** Proven live:
     ```
     [LEGITIMATE] PID: 4064  | CWD: /Users/fausto/Software/AgentTalk/apps/orchestrator
     [LEGITIMATE] PID: 46412 | CWD: /private/tmp/rung3/sandbox
     All good: no leaked orchestrator processes found.        exit 0
     ```
     **4064 is the PO's real launchd service; 46412 was hand-started by Claude minutes earlier** — `launchctl`
     knows nothing about it, and left behind it is *precisely this item's leak*. **Both read LEGITIMATE.** That is
     this item's literal title, unresolved, reporting green.
  2. **The test only passes where it was born.** It flags the dummy as LEAKED only because the dummy's CWD contains
     `agentalk-task-`. **Verified: the identical files run from a checkout without that in the path FAIL**
     (`expected … to contain '[LEAKED] PID: …'`). **Merged to master it goes red on the first run.** The goal
     explicitly required a test that does not depend on the ambient environment. *(Its dummy is also only
     "orchestrator-ish" because the filename `dummy-orchestrator.mjs` contains the substring "orchestrator".)*

  **The shape of the result, stated precisely:** agy named a *symptom* of the root cause (unknown CWD ⇒ LEGITIMATE)
  while the *root cause* — default-legitimate with no positive service evidence — went unnamed. **Introspection
  found the fail-open it could see; it did not find the one it was standing on.** Note this is the mirror of
  [[BL-022]]: there, the mutation-check passed through agy's fail-open and only a diff read caught it; here, agy's
  own introspection caught a fail-open and only a diff read caught the bigger one. **Neither instrument retires the
  reviewer's read.**

  **What this task now needs (small, and precisely known):** positive evidence via **`launchctl list`** (or the
  equivalent registry) to establish "managed"; **unknown/ambiguous ⇒ report as UNKNOWN, never clean** (fail closed,
  per [[BL-052]]/[[BL-061]]); **decouple the test from its own path**; and keep agy's read-only `lsof`/`ps` +
  report-not-reap, which are right.
  **✅ DECIDED (PO, 2026-07-17): an UNKNOWN process FAILS the sweep — exit non-zero.** Fail closed, consistent with
  [[BL-052]] (refuse rather than inherit) and [[BL-061]]. So the classes are: **managed** (positive evidence —
  `launchctl` knows it) ⇒ LEGITIMATE · **not-managed + task-worktree/`(deleted)` cwd** ⇒ LEAKED · **not-managed +
  anything else** ⇒ **UNKNOWN ⇒ exit non-zero**. There is no "assume fine" branch left — that absence *is* the fix.
  **⚠️ Consequence the implementer must design for, not discover:** this **fires on the PO's own processes**. A
  hand-started orchestrator (the live-run recipe starts one every time) and a `npm run dev` that happens to be up
  at closure are both not-managed and not in a task worktree ⇒ UNKNOWN ⇒ fail. That is *correct* at closure — a
  live-run orchestrator left behind IS this item's leak — but it collides head-on with this item's own bonus lesson
  (*false findings are worse than no check*), and a check that cries wolf at the PO gets disabled.
  **So the refusal must be actionable, not just loud:** name the process, its ports, its cwd and command, and state
  the two ways out — **stop it, or declare it** (an allowlist / env for "yes, it's mine, I know"). A declared
  process is positive evidence too, and it keeps the fence fail-closed while staying usable. **The escape valve is
  part of the deliverable, not a follow-up.**

  **2026-07-17 — CLOSED. MERGED + PUSHED (`fc53522`).** `scripts/check-orchestrator-ports.mjs` + 15 bars.
  **The classifier never consults `ppid`** — that is the point, not an omission. Positive evidence only:
  **LEGITIMATE** = `launchctl list` knows the PID (and the output *names the service*) · **DECLARED** = a human
  declared it via `AGENTTALK_SWEEP_DECLARED` (pid **or** port) · **LEAKED** = task-worktree cwd or `(deleted)` cwd ·
  **UNKNOWN** = no positive evidence either way ⇒ **exit 1**. The escape valve shipped with it: every refusal names
  process/ports/cwd/command and offers **stop it, or declare it**.
  **Live evidence — the exact case agy's rung-3 version got wrong:**
  ```
  [LEGITIMATE] PID 4064  | ports 54321, 3741 | why: service registry knows PID 4064 (com.fausto.agenttalk-orchestrator)
  [UNKNOWN]    PID 51511 | ports 54399, 3100 | why: no positive evidence...
  SWEEP FAILED: 1 process(es) without positive evidence.            exit 1
  ```
  4064 is the PO's real launchd service; 51511 was hand-started minutes earlier. **agy's version called 51511
  LEGITIMATE.** Declaring its port flips it to DECLARED and the sweep goes clean. Re-run from the real checkout
  post-merge: clean, exit 0.
  **How the path-coupling was fixed at the root:** the classifier is a **pure function**, so the load-bearing bars
  drive it with **synthetic records** — the machine's live process table is not a fixture. The one e2e **creates**
  a temp dir named `agentalk-task-*` rather than depending on being run from inside one; it passes from
  `/private/tmp/agenttalk-bl023`, where agy's bar fails.
  **Mutation-check — each bar against the mutation it OWNS:**
  | mutation | classification bars | e2e | sweep-verdict bars | escape-valve bars |
  |---|---|---|---|---|
  | fail-open (UNKNOWN ⇒ LEGITIMATE) | **6 red** | green (not its job) | red | — |
  | blind to task worktrees | 1 red | **red** | green | — |
  | sweep tolerates UNKNOWN | — | green | **3 red** | — |
  | escape valve never fires | — | green | — | **1 red** |
  **⚠️ Declared residuals — do not read the check as stronger than it is:**
  1. The **LEAKED** markers (task-worktree cwd, `(deleted)` cwd) are **heuristics**. A leak wearing neither marker
     lands in **UNKNOWN** — which still **fails**, so it is safe, but `LEAKED` vs `UNKNOWN` is *not* "we always know
     which."
  2. `isOrchestratorIsh` still filters on `index.js`/`orchestrator` substrings, so an orchestrator launched under an
     unrelated wrapper name is not inspected at all (agy named this one; it is unfixed and inherent to the approach).
  3. The demo of the DECLARED path was piped, so **exit 0 was not observed directly** — "Sweep clean" only prints on
     the exit-0 branch and a mutation-checked unit bar covers the logic, but the number itself was not watched.
  **Independence caveat — weight it here:** Claude **designed the rung that judged agy's attempt, refuted it, wrote
  the replacement, and reviewed its own work**, as sole available agent. The mutation matrix is the only independent
  check that ran, and this same day it twice failed to catch what a diff read caught. **This classifier deserves a
  second pair of eyes when one is available.**

  **Telemetry (task closure):**
  - task:        BL-023
  - wall-clock:  2026-07-17 09:32 → 09:47 (~15m)
  - budget:      weekly ~41%, session ~73%→77% (Δ ~4%) [per scripts/usage.mjs]
  - gate:        tsc 0, suite 350/350 (59 files; baseline 335 + 15 new bars), pollution clean (2 new files, both
                 in scope; node_modules symlink staged around, never committed)
  - diff:        2 files, +402/-0; commits `6de7aa6` (impl) + `fc53522` (merge)
  - outcome:     MERGED ✅ + PUSHED ✅ (PO said both words)
  **Independence caveat:** the rung-3 task was designed AND graded by Claude, the sole available agent.

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
  **UPDATE (2026-07-18) — DESIGN DOC written (architect): `design/bl024-provider-split-design.md`.** Ground-truth
  re-audit (line refs had drifted): the 3 leaks confirmed at `types.ts:31`, `team-coordinator.ts:1004-1017`,
  `registry.ts:246/249/360/597`. **Key finding:** the registry sniff sites never distinguish the vendor names from
  `'mcp'` — they collapse to one **transport** predicate (in-process vs attached); the *only* vendor-behavioural
  site is the frozen-engine gemini timeout (leak #2). Proposed: `transport:'in-process'|'attached'` on the engine,
  `vendor`/`capabilities` at the edge, timeout → per-agent capability metadata (kills leak #2). Phasing T1 (type+edge,
  no engine change) · T2 (frozen-engine slice) · T3 (client cutover). **GATE PASSED (PO, 2026-07-18):** all four §8
  questions decided per recommendations, incl. **explicit authorization for the T2 frozen-engine edit** (byte-identical
  timeout + IP-15 proof obligation). See the design doc for the recorded decisions.
  **UPDATE (2026-07-18) — T1 MERGED (`5dfab83`, branch `task-BL-024-T1`, PO-gated).** Plan: `design/bl024-t1-plan.md`
  (gate approved). Additive type+edge, **engine untouched**: `AgentTransport`/`AgentVendor`/`AgentCapabilities` +
  pure `normalizeAgentKind` (contracts); Agent record carries the new axes alongside the still-populated legacy
  `provider`/`providerName`; registry driver selection now keyed on `transport`; `POST /api/agents` accepts the new
  shape. `team-coordinator.ts` (frozen) untouched → gemini timeout byte-identical. tsc clean, suite **389/389** (372
  + 17 new), wire-contract hash unchanged. **Item stays `todo` — T2 next:** move the fact-collection timeout out of
  the frozen engine into the per-agent `capabilities` metadata (authorized; byte-identical + IP-15 proof); then T3
  (client cutover + legacy `provider` drop). Follow-up noted: add `contracts` to the vitest `include`.
  **UPDATE (2026-07-18) — T2 MERGED (`0375ecd` on branch `task-BL-024-T2`, merge `8375387`, PO-gated).** Plan:
  `design/bl024-t2-plan.md` (gate approved with recommendations). The frozen `getFactCollectionTimeoutMs` is now
  **vendor-blind** — reads only `capabilities.factCollectionTimeoutMs` (team + members); no `team.provider`/
  `agent.providerName === 'gemini'` sniff remains in the coordinator. **D1:** `normalizeAgentKind` closes the
  `provider:'mcp'`+`providerName:'gemini'` gap (caps present iff the agent would have triggered the old 720s bump);
  all T1 outputs unchanged. **D2:** `Team.capabilities` added, populated in the `registry.createTeam` wrapper (frozen
  file's diff limited to the one §8-Q1-authorized function). Dead `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS` const
  removed (contracts twin remains). **IP-15 proof:** new fact-collection-timeout test pins exact ms (720s for cases
  a/b/c incl. the `mcp`+`providerName` gap, 480s default) and the discriminator fails if the edge injection is
  reverted (**manually verified** via stash-and-rerun: neutering D1 → case (c) 720→480 fail, then restored). tsc
  clean, suite **398/398** (389 + 9 new, existing tests unmodified), wire-contract hash **v8 unchanged**. **Item
  stays `todo` — T3 next:** client cutover (send `{transport,vendor}`) + drop the legacy `provider` acceptance
  (cross-repo). Not pushed at merge time — awaiting the PO's `push` word.
  **UPDATE (2026-07-18) — T3 SPLIT into T3a/T3b (PO-approved); T3a MERGED + PUSHED.** Plan: `design/bl024-t3-plan.md`
  (§4 flag-day rationale; §7b gate decisions). **T3a** (client `agentalk-mcp-client` @ merge `3612511`, feat `71fb867`):
  `agent-launcher` cuts over to `{transport:'attached', vendor}` for `gemini/claude/codex`; **server needs no change**
  (`activateAgent` re-derives from the stored provider; `/api/agents` already accepts the new shape since T1). Client
  suite **85/85**; **live cross-repo check** — the real orchestrator accepted the new body and derived `provider:'claude'`.
  **`goose` ruling (PO):** goose is a **real vendor** but its axis mapping is **deferred** ("not now") — it is in neither
  `AgentVendor` nor the legacy `AgentProvider` union, so T3a **keeps goose on the legacy `provider` path** (pinned by a
  new test); sending `transport` would force it to opaque `'mcp'`, a behaviour change needing the deferred reverse-map
  design. **Consequence: T3b (legacy-`provider` drop) is BLOCKED on the goose-as-vendor spec** — you cannot remove
  legacy acceptance while goose is the sole remaining user of it. **Item stays `todo` — T3b pending the goose spec**
  (union + reverse-map for goose, then drop legacy acceptance + fixture/recordings sweep).
  **UPDATE (2026-07-18) — goose spec GREENLIT (PO, reversing "not now") + T3b MERGED + PUSHED (cross-repo).** Plan:
  `design/bl024-t3b-plan.md`. **The PO's aim was "a real goose client at the end" — achieved and LIVE-PROVEN.** goose
  was fully broken (start failed at `registry.ts:293`); now it is a first-class vendor. AgentTalk (`92bd383`, merge of
  `d0f7a99`): `AgentVendor`/`AgentProvider` += `'goose'` (serialization label post-T2), symmetric `normalizeAgentKind`
  case (→ `attached`), server validates `vendor:'goose'`; goose gets **no** capability (default fact-collection
  timeout, not the gemini bump). Client (`79b6268`, merge of `9d9bf5d`): goose cuts over to `{transport,vendor,model}`;
  **model is a REQUIRED companion for goose** (a harness over an OpenRouter model) — launcher rejects goose-with-no-model
  (400) and `provider-runtime` drops the silent `openai/gpt-4o-mini` default; claude/gemini/codex keep theirs.
  **Live proof:** real goose CLI 1.41.0 over OpenRouter attached over MCP and returned **computed** products —
  `17×23=391` (direct) and `31×19=589` (through the real launcher's cutover path). AgentTalk **401/401**, client
  **86/86**, tsc clean, no wire-contract hash change.
  **UPDATE (2026-07-18) — T3b-2 (part) MERGED + PUSHED: web UI cut over.** Audit found the legacy `provider` input is
  a real migration, not a cleanup — sent by the **live web UI**, ~12 scripts, and recordings. PO call: **migrate the
  web UI now, defer the hard-drop.** AgentTalk `2d0bdb8` (merge of `c74a8ee`): `App.tsx` create/start POSTs
  (`handleCreateAgent`, `handleAutostartChat`, `handleAutostartTeam`) send `{transport:'attached', vendor}`.
  **Live-proven through the real UI** (Chrome): created a Gemini agent → backend received
  `{transport:'attached', vendor:'gemini'}` → agent READY. Suite 401/401, web tsc clean. Server still accepts legacy
  input (unchanged). **Item stays `todo` — DEFERRED remainder (own future task):** the server **hard-drop** of legacy
  `provider` input (`/api/agents` create+start, `/api/teams`) + migrate the **~12 scripts** (`test-live-*.mjs`, m07/m14/m17
  smokes) + a **read-side recordings shim** (`planning_runs/*.json`); **keep** `agent.provider` as a derived
  serialization field and DON'T delete the `AgentProvider` type; leave `isUsageCaptureProvider` alone (different axis).
  Plan: `design/bl024-t3b-plan.md` §2/§4.

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
status: done
date: 2026-07-13
epic: null
tags: [governance, worktree, parallel-dev, process]
-->
- [done · **DONE 2026-07-18 — all three bites complete** · tooling `scripts/wt-setup.mjs` (master `53d4f56`) · discipline doc `design/worktree-discipline.md` (master `48ac546`, pushed) · stale-branch prune done 2026-07-18 (PO confirm-then-prune)] — **Define a parallel-code-development worktree discipline** —
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
  **UPDATE (2026-07-18) — TOOLING BITE DONE (merged, master `53d4f56`):** `scripts/wt-setup.mjs` (`create`/`remove`)
  automates the AgentTalk per-task worktree node_modules dance and its footguns (skip `@agenttalk` then re-create
  `@agenttalk/*` with RELATIVE targets, `.bin` explicit, `apps/web/node_modules`, `tsc -b`). Pure `buildLinkPlan`
  unit-tested (4); verified by dogfooding (helper-made worktree ran 368 green, `remove --delete-branch` left no
  leak); full suite 372. Plan: `design/bl036-plan.md`. **Item stays `todo` — two bites remain:**
  (1) the **discipline DOC** (merge serialization, id allocation without races); (2) the one-time **stale-branch
  prune** — confirmed present 2026-07-18, needs confirm-then-prune per branch (destructive):
  *AgentTalk* `task-BL-039 · task-BL-063 · task-M18-T3 · task-arbiter-enable · docs-bl045-root-cause ·
  wip/BL-038-provider-timeouts`; *client* `task-BL-045 · task-BL-064 · task-M18-T3 · task-goose-executor ·
  m11-t1-consensus-respond · m12-c-pf1-codex-bridge-fix`. Client worktree tooling deliberately skipped (its
  worktree is a single `node_modules` symlink — no helper warranted).
  **UPDATE (2026-07-18) — DISCIPLINE DOC BITE DONE:** `design/worktree-discipline.md` written — the adopted
  convention covering branch-naming (`task-<id>`), merge serialization / who-owns-`master`, uncommitted-work
  isolation, backlog-id allocation without races (allocate-on-master + count-check; `mintId` vs hand-alloc),
  sync-before-start (`git fetch` both), stale-worktree/branch cleanup, and the `workdir`→worktree assignment for
  autonomous agents — grounded in `scripts/wt-setup.mjs`, the AGENT.md mandate, and the 2026-07-13 near-misses.
  **UPDATE (2026-07-18) — STALE-BRANCH PRUNE DONE (PO confirm-then-prune); BL-036 CLOSED.** Deleted 6 merged
  branches (`-d`, AgentTalk: `docs-bl045-root-cause · task-BL-063 · task-arbiter-enable`; client: `task-BL-045 ·
  task-BL-064 · task-goose-executor`) and 5 refuted/ancient unmerged branches (`-D`, AgentTalk:
  `wip/BL-038-provider-timeouts` [REFUTED gate 2] · `task-M18-T3` [refuted arc]; client: `m11-t1-consensus-respond` ·
  `m12-c-pf1-codex-bridge-fix` [bridge-removal superseded by BL-057] · `task-M18-T3`). **KEPT by PO decision:**
  AgentTalk `task-BL-039` — holds one **unmerged** commit (`313d089`, `providerName` forwarding so `api`-provider
  agents can select a non-`google` ApiProvider) that is **NOT on master**; preserved pending a decision on reviving
  it as its own task. **Loose end (out of this local-prune scope, not actioned):** the *remote* `origin/task-BL-045`
  is ahead of master (has commits not on master) — a separate remote-branch cleanup / possible unmerged work,
  worth a look before deleting on GitHub.

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
id: BL-062
status: done
date: 2026-07-16
epic: null
tags: [prompt, worker-only, launcher, autonomy, false-negative, bl059-adjacent]
-->
- [done · **MERGED 2026-07-16** — `70d88c3` · found by the rung-1 calibration run · **a worker-only team told the worker a planner wrote a plan — then pasted the goal twice**] —
  **`in-process-driver.ts:256` (`handleTeamWorkAssign`) is the only prompt for assigning work to a worker, and it
  hardcodes the two-agent narrative.** Its opening line is *"You are the WORKER in a two-agent team. The planner has
  created a plan for you to review."*, followed by *"Critically evaluate the plan… Is the approach sound? Are there
  risks or missing steps?"* — **but on a worker-only team there is no planner and no plan.** That is the shape the
  launcher builds: `team-coordinator.ts:315`, the `else` branch whose own transcript line reads *"Task assigned
  directly to worker."*, emits `team_work_assign` with **both** `description` **and** `plan:
  buildWorkerPlan(description)`. `buildWorkerPlan` (`team-coordinator.ts:1522`) is a misnomer — it returns
  `` `${plan}\n\n${GIT_WORKTREE_REQUIREMENT}` ``, i.e. the description echoed back with a suffix. **Observed live**
  (rung-1 calibration, 2026-07-16): the worker is told to *critique a plan* for a task it is meant to *execute*; the
  goal text appears **twice** (as `Original task:` and again under `## Final Plan`); the worktree context appears
  **twice** (from `WORKTREE_CONTEXT` at `in-process-driver.ts:266` and again from the `GIT_WORKTREE_REQUIREMENT`
  suffix baked into the synthesized plan).
  **Why it matters — this is a false-negative generator, not a cosmetic defect.** agy did the work anyway (commit
  `db2a464` in its task worktree: the correct one-line fix, ~27s, nothing else touched) — it succeeded *despite* the
  prompt. **A worker that instead COMPLIES returns a plan critique, changes no files, and reports `completed`** —
  which is indistinguishable from *"the model accepted the task and skipped the work."* **That is precisely the
  BL-059 accusation shape**, which cost two sessions, was written into canonical `AGENT.md` and a lessons file, and
  was then retracted as observer error. The next occurrence would be read as a model defect and would again be ours.
  **Fix shape (a decision, not just a patch):** give worker-only assignment its own prompt — *here is your task, do
  it* — instead of reusing the plan-review template, and stop synthesizing a `plan` from the `description` when no
  planner ran (send no plan; have the driver omit the section). Rename/remove `buildWorkerPlan`. ⚠️ **This is a
  behaviour change on a shared engine path** (`team-coordinator.ts` + the driver prompt) → **needs PO confirmation**,
  and the **two-agent planner→worker path must stay byte-for-byte**. Source: rung-1 calibration run (first real agy
  code task), 2026-07-16; transcript captured in the launcher's stdout.

  **CLOSED 2026-07-16 — merged `70d88c3` (branch `task-BL-062`, per-task worktree, PO-gated).** Worker-only
  assignment now carries **no plan** (`plan: ''` — the cross-repo contract declares `plan: string`, and widening it
  would move the hash the client validates against, so the driver treats empty and absent alike) and the driver
  branches on the plan **existing** rather than on a role flag, so the prompt shape follows the data. A worker-only
  team is now told *"You are the WORKER. You have been assigned a task to carry out. Do the work…"*: task once,
  worktree context once.
  **A second, wider defect surfaced mid-fix and the PO widened scope to take it** (it was not in the original item):
  **`.join('\\n')` is a literal backslash-n** — `charCodes 92,110`, proven with `node -e`, **not a newline**. Both
  driver prompts — the work-assign **and the planner's fact-collection** — reached the model as **one line with the
  escape printed through as text**. Fixed at both sites.
  **BL-053's contract MOVED, and did not weaken** (PO-approved). It asserted a *mechanism* — the worktree text
  riding inside the synthesized plan — which this item necessarily deletes. Its *guarantee* is now asserted where it
  lives, in `in-process-driver.test.ts`: WORKTREE_CONTEXT reaches the worker-only prompt **exactly once** (it used to
  arrive twice), plus the negative (no refuse-and-abort branch). Safe because `in-process-driver.ts:266` is the
  **only** consumer of that field — verified, not assumed. The old test's comment carries the full rationale so the
  next reader finds an explanation, not a deleted assertion.
  **Verified live, not just green.** Unit tests prove a *string*; they cannot see this defect — the existing
  outcome-based tests all passed *while it was live*, because agy succeeded despite it. So the bar was a re-run of
  rung 1 against the fixed build, same goal byte-for-byte, reading the prompt out of the real transcript: the
  plan-review framing is gone, the goal appears once, and the prompt arrives as real lines. agy then produced
  `e1fca14` (correct one-line fix, 1 file `+1/−1`) — **two for two on real code tasks**. Control was clean: the
  worktree dist carried the fix, the real repo's dist did not.
  All three new bars **mutation-checked** (break the fix → that bar fails, alone).
  **⚠️ Single pair of eyes:** authored, reviewed and closed by one actor under the resource-scarcity fallback
  (implementer *and* task-end reviewer, which the independence default separates).
  **Left deliberately unfixed (in scope discipline, not oversight):** the **two-agent** path still gets
  WORKTREE_CONTEXT **twice** — once from the driver at `:266`, once appended by `buildWorkerPlan` at `:1340`
  (`GIT_WORKTREE_REQUIREMENT` is the same constant). Same family, outside what the PO approved. Worth its own item.

  **Telemetry (task closure):**
  - task:        BL-062
  - wall-clock:  2026-07-16 22:40 (filed) → 23:02 (merge) (~22 min; defect found 22:33 in the rung-1 run)
  - budget:      weekly 31%→32% (Δ ~1%), session 67%→76% (Δ ~9%)  [per `scripts/usage.mjs`]
  - gate:        tsc 0, suite 328/328 (325 baseline + 3), pollution clean (0 stray procs, real repos untouched)
  - diff:        4 files, +151/-33, commits `a326f82` (file) · `9b615eb` (fix) · `70d88c3` (merge)
  - outcome:     MERGED ✅ (local; **not pushed** — the PO says "push" as a separate act)

<!-- @item
id: BL-061
status: done
date: 2026-07-16
epic: null
tags: [safety, sandbox, autonomy, fail-closed, bl053-followup]
-->
- [done · **MERGED 2026-07-16** — client `508c617` · **opened deliberately by BL-053, by its own author** · **the harness degrades silently where a model used
  to (badly) notice**] — **When the worker cannot provision a task worktree, the turn now runs at the workdir root
  and nothing says so.** BL-053 removed the prompt clause that told the agent *"use a worktree or refuse"*, on the
  grounds that it asked an LLM to police an invariant the harness guarantees — and it demonstrably got that check
  wrong (it refused a working worktree). **That reasoning holds. But it only holds while the harness actually
  guarantees the invariant**, and today it doesn't: `provisionTaskDir` (client `lib/task-worktree.mjs`) returns
  `undefined` when it can't create the worktree — e.g. the `workdir` is not a git repo — and the turn proceeds at
  the workdir root with **no per-task isolation**. It is logged, not enforced.
  **Scope of the harm:** *containment is unaffected* — that comes from the `basename` fence, independently — so this
  is not a safety hole. What is lost is **task isolation**: concurrent tasks in one workdir would share a tree, and
  a run's changes land on the sandbox's checked-out branch instead of a task branch.
  **The honest fix (the completion of BL-053's own argument):** when the orchestrator *asked* for a task dir and the
  worker *cannot* provide it, **fail the turn loudly** rather than degrade. Deterministic enforcement is the whole
  reason the prompt clause was allowed to go. **Precise condition matters:** only when a name was sent and
  provisioning failed — a turn with **no** task dir requested (non-`maintainsSession` completers) is normal and must
  keep running at the workdir root.
  **Why it wasn't folded into BL-053:** it is a behaviour change of its own (a turn that previously ran would now
  fail), and BL-053 was already carrying two PO calls. **Note this is arguably restoring parity, not new
  strictness:** pre-BL-053, a failed provision produced a hard error anyway (the orchestrator handed the executor a
  cwd that didn't exist → spawn ENOENT), so the *silent* degrade is itself the regression BL-053 introduced.
  Source: BL-053 closure, flagged to the PO at merge, 2026-07-16.

  ---
  **CLOSED 2026-07-16 — merged client `508c617` (same session it was filed in).**
  **The contract is the DISTINCTION, not the outcome** — this is the whole item, and the half that is easy to get
  wrong: *no task dir asked for* → `undefined`, run at the workdir root (**normal and load-bearing**: planner-shaped
  turns / non-`maintainsSession` completers carry none and must keep working — tightening the guard until this
  throws too would break every planner turn); *asked for and unavailable* → **throw**, never a silent substitute.
  **Two things the item did not anticipate, both found by writing it:**
  1. **The obvious implementation would have been worse than the bug.** `provisionTaskDir` was called
     **synchronously, outside** the promise chain — a throw there escapes the event handler entirely: the agent
     dies with `busy` stuck `true` and the orchestrator waits on a corpse. **A fail-closed guard that fails as a
     crash is not an improvement on a silent degrade.** Provisioning now runs *inside* the chain, so the failure
     travels the same road as any other turn failure (`submit_exec_result: ERROR…`, `busy` released).
  2. **git's stderr was being swallowed** (`stdio: 'ignore'`). Piped now: the error says *"not a git repository"*
     rather than merely that something went wrong. **A loud failure that cannot name its cause is just a quieter
     one.**
  **Bars (no live run — this is a failure path, provable deterministically, and a mutation-checked test is a
  stronger bar than a live LLM):** 5 unit tests on the contract in **both** directions, plus an integration test
  proving the throw **reaches the orchestrator** *and* the agent **survives it and serves the next turn**.
  **Mutation-verified** — restoring the silent degrade fails the integration bar with
  `expected 'PROVIDER RAN' to match /^ERROR:/`, i.e. it catches the exact defect: a turn quietly running at the
  workdir root and reporting success. Suite **70 → 73**.
  **Incidental finding worth knowing:** gemini's per-turn spawn **discards `baseCmd.args`** (it hardcodes agy's own
  flags), so a `persistentCommandOverride` cannot carry a fake script path on that provider — which is why the
  client's e2e fakes all run through **claude**. Cost one attempt here; not filed, but if someone tries to fake
  gemini again this is why it fails with `agy exec failed with exit code 9`.
  **Independence caveat:** sole agent — filed this item against my own change, then fixed and reviewed it myself.

  **Telemetry (task closure):**
  - task:        BL-061
  - wall-clock:  ~22:10 → 22:31 (~21 min)
  - budget:      weekly 28%→29% (Δ ~1%), session 38%→45% (Δ ~7%)
  - gate:        suite 70→73, lint + verify-contract clean, mutation check passed, pollution clean
                 (worktree removed, branch deleted, real repo clean)
  - diff:        4 files, +187/−59; commit `e19e938`; merge `508c617`
  - outcome:     MERGED ✅

<!-- @item
id: BL-060
status: done
date: 2026-07-16
epic: null
tags: [dx, config, ports, papercut, po-raised]
-->
- [done · **MERGED + PUSHED 2026-07-17** — `PORT` now turns both halves; default moved 3000 → 3100 · PO-witnessed live on 5173 with no env var set · re-found the hard way: an agent handed the PO a 3100 URL the UI could not have served] — **PO-raised 2026-07-16** — *"what is port 3000 used for? if it's internal, that's a pretty stupid choice"*
  · **agreed, and the env knob is worse than the default** — **The orchestrator's internal HTTP+WS backend squats on
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

  **2026-07-17 — CLOSED. MERGED + PUSHED (`ff3a519`). PO-approved the behaviour change; PO witnessed it live.**
  **How it was re-found — worth more than the fix.** Setting up the rung-3 watch, Claude told the PO to watch at
  **3100** — a URL the UI *cannot* serve. The PO challenged it (*"are you sure? it used to be 5173"*), and the
  challenge exposed fault 3 exactly as filed: the UI is vite on **5173**, whose proxy **hardcoded 3000**, so the
  PO would have watched a blank page. **This item was filed 2026-07-16 and read that same morning; the trap still
  landed.** Reading a hazard is not the same as recognising it in the moment — the PO's question was the control
  that caught it, not the doc.
  **Fix (follows this item's own sketch):** `apps/web/vite.config.ts` and `apps/orchestrator/src/index.ts` now read
  the **same `PORT` knob** with the **same default**, moved **3000 → 3100** (3100 was already the de-facto alternate
  in the live-run recipe and every rung config, so it is the least-churn choice; nominally Grafana Loki's default —
  *PO: "couldn't care less"*). `scripts/m16-live-baton-proof.mjs` hardcoded 3000 as the orchestrator and would have
  broken the moment the default moved; it reads the knob now.
  **⚠️ NOT TOUCHED, and the trap in this task:** `localhost:3000` in `scripts/m15-live-arbiter.mjs` and
  `apps/orchestrator/src/diagramtalk-bridge.ts` is **DiagramTalk's** port (`DIAGRAMTALK_URL`), not the
  orchestrator's. A grep-and-replace of "3000" silently repoints the DiagramTalk bridge. **Not every 3000 in this
  repo is ours.**
  **The PO's launchd service was never at risk:** `com.fausto.agenttalk-orchestrator` pins `PORT=3741` explicitly,
  so moving the default cannot reach it (verified before touching code).
  **Bars:** `apps/web/**` is excluded from vitest (LB-93), so the 4 bars live in `scripts/__tests__/`. They cover
  **two different guarantees**, and each was mutation-checked against **the mutation it OWNS**:
  | mutation | bars 1–3 (proxy follows PORT) | bar 4 (defaults agree) |
  |---|---|---|
  | proxy hardcoded back to 3000 | **red** | green — not its job |
  | defaults drifted 3100 → 3200 | green — not their job | **red** |
  **Declared weakness of bar 4:** it reads the orchestrator's source *text* rather than executing it, because the
  default lives inside `main()` and importing it starts a server. It guards against silent drift between the two
  halves; it is not a behavioural bar. Said plainly rather than left to read as stronger than it is.
  **Live bar (LB-93 — PO is the only witness, remote over SSH):** with **no env var set anywhere**, the orchestrator
  bound **3100** on its own, vite came up on **5173**, and `/api/agents` returned `[]` **through the proxy** —
  pre-fix that would have been a connection error against an empty 3000. **3000 stayed free for DiagramTalk.**
  **Independence caveat:** authored AND reviewed by Claude, sole available agent (PO 2026-07-15). The PO's
  challenge was the only outside check — and it is what found the defect.

  **Telemetry (task closure):**
  - task:        BL-060
  - wall-clock:  2026-07-17 09:00 → 09:12 (~12m)
  - budget:      weekly ~39%, session ~52%→57% (Δ ~5%) [per scripts/usage.mjs]
  - gate:        tsc 0, suite 335/335 (58 files; baseline 331 + 4 new bars), pollution clean (4 files, all in
                 scope; node_modules symlink staged around, never committed)
  - diff:        4 files, +101/-5; commits `9fdd9bd` (fix) + `ff3a519` (merge)
  - outcome:     MERGED ✅ + PUSHED ✅ (PO said both words)

<!-- @item
id: BL-059
status: dropped
date: 2026-07-16
epic: null
tags: [agy, gemini, protocol-compliance, false-green, autonomy-risk, RETRACTED, observer-error]
-->
> # ⛔ RETRACTED 2026-07-16 — **THIS ITEM IS FALSE. agy DID THE WORK, EVERY TIME. WE CHECKED THE WRONG DIRECTORY.**
> **Do not cite this item as evidence about agy's honesty or compliance.** It is kept, unedited below, as the
> record of a wrong accusation — and of *how* it was made — not as a finding. **Root cause: [[BL-053]]**, which
> had already documented the mechanism in writing before this item was ever filed.
>
> **The ground truth (verified 2026-07-16, PO-prompted — *"check BL-053 first before we blame agy"*):**
> - **Yesterday's founding run** (`agy-w2`, the PO-witnessed one): worktree **`wt`** exists, branch **`task-answer`**,
>   **`answer.txt` = `391`**, **committed `2e52556 "Add answer"`** — at
>   `/tmp/agentalk-task-task-1784225210801/wt/`.
> - **The claimed 3rd occurrence** (`bl057-agy2`): worktree **`wt057`** exists, branch **`task-bl057`**,
>   **`answer.txt` = `589`** (a *computed* 19×31), **committed `241396a "Answer"`** — at
>   `/tmp/agentalk-task-task-1784228918606/wt057/`.
>
> **Why everyone missed it — the two-sandbox trap, one layer deeper than the one already in AGENT.md:**
> `llm-agent.mjs:107` forwards the `exec_rpc` `cwd` into the sink; **gemini is the ONLY provider that honours it**
> (`lib/executor-runtime.mjs:567`, `cwd: sink.cwd || process.cwd()`) — claude (`:161`) and codex (`:713`) hardcode
> `process.cwd()`. So **agy alone runs in `/tmp/agentalk-task-<id>`**, the orchestrator's task worktree — which is a
> worktree of the **orchestrator's cwd** (`/tmp/att-sandbox`), *not* of the worker's `workdir`
> (`/tmp/att-worker-sandbox`). We checked the worker's `workdir`, found nothing, and concluded it did nothing.
> **The work was on disk the entire time, in the one place the mental model said it couldn't be.** BL-053 says this
> in plain text — *"only line 493 honours a `sink.cwd`"* — and we filed this item anyway.
>
> **What this cost, and the lesson that outlives it:** two sessions of confident, vivid, well-evidenced narrative
> about a model being dishonest — written into this backlog, into `AGENT.md`'s canonical op-notes, and into a
> lessons file — all of it **observer error**. The "check the artifact, not the status" discipline was applied
> **correctly and rigorously, at the wrong coordinates**, which is *worse* than not checking: it produced false
> confidence and a paper trail. **`status: completed` was telling the truth all along; the filesystem check was the
> thing that lied, because it was pointed at the wrong filesystem.** Before concluding an agent didn't do the work,
> **prove where it was standing** — spawn cwd is a fact you can read out of the code in 30 seconds, and it is
> exactly what BL-053 was already telling us.
>
> *(The one residual oddity — BL-045 run 3's "wrote the file and then refused" — is a **reporting** mismatch, not a
> failure to work: the file was written. Not tracked here; if it recurs, file it fresh and on its own evidence.)*

- [dropped · **RETRACTED 2026-07-16 — THIS ITEM IS FALSE; see the banner above** · found 2026-07-16 during the BL-045 UI witness · ~~**`completed` ≠ the work was done**~~] — **agy accepts a
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

  ~~**ADDENDUM — 3rd occurrence, 2026-07-16**~~ — **⛔ WITHDRAWN, same day, by its own author. It was FALSE.**
  I claimed `bl057-agy2` accepted the plan, reported 589, and did nothing: *"no `wt057/answer.txt`, no worktree, no
  `task-bl057` branch, sandbox still at `e0a2b02`"*. **Every one of those checks was run against the wrong
  directory** (`/tmp/att-worker-sandbox`, the worker's `workdir`) while agy was working — correctly, completely — in
  `/tmp/agentalk-task-task-1784228918606/`, the cwd the `exec_rpc` named and the only one it honours. It built the
  worktree, wrote `589`, and committed it (`241396a`). See the retraction banner at the top of this item.
  **Kept visible on purpose.** The addendum was specific, evidenced, internally consistent, and **wrong** — it even
  named BL-053 as the thing to rule out *before blaming the model*, then blamed the model without ruling it out.
  The PO caught it with one sentence: *"check BL-053 first before we blame agy."* **A citation of the right doubt is
  not the same as acting on it.** Source of the correction: PO challenge, 2026-07-16.

<!-- @item
id: BL-057
status: done
date: 2026-07-16
epic: null
tags: [agy, gemini, attach-mode, test-only-path, production-gap, one-line-fix]
-->
- [done · **MERGED 2026-07-16** (`3403bdb`, `agentalk-mcp-client`) · option (b) taken, **widened to all three
  providers** · **found 2026-07-16 while proving BL-045's last mile** · **the BL-045 fix is real but PRODUCTION CANNOT
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

  ---
  **CLOSED 2026-07-16 — option (b), widened. Merged `3403bdb` (branch `task-BL-057`, per-task worktree, PO-gated).**
  **⚠️ This item was WRONG about the scope, and the correction is the main thing to carry forward: the flag was
  never gemini-specific.** It gated **nine sites across all three providers**, and **no fall-through had ever been
  exercised by a live run** — they were not fallbacks, they were three untested paths wearing a fallback's clothes:
  `agy mcp` (could only hang, LB-92) · claude's no-`--mcp-config` session (**cannot call bridge tools at all**) ·
  codex's `codex mcp-server` (**an entire second implementation**). The flag arrived in the client's *initial
  commit* — inherited from the AgentTalk extraction, never a considered design. PO approved deleting all three.
  **Net −140 lines.** One path per provider now: the live-proven one.
  **The same disease was in the tests.** The 4 that broke were driving real contracts (`BasePersistentExecutor`
  hardening; the `exec_rpc` round-trip) through a **gemini-as-stdio vehicle production never used**. Repointed to
  `claude` — the only provider that still holds a stdio session — with **assertions byte-identical**. The hardening
  fakes became script *files*: claude appends `--mcp-config` to the override's args, and `node -e` parses those as
  node options and exits. The task-end sweep then caught **two vestigial flag setters still in tests** (inert, but
  the same rot); removed, so both now run with **no flag at all** = production's real configuration.
  **The bar (live, `AGENTTALK_PERSISTENT_MCP` UNSET, real orchestrator):** agy attached → generated → round-tripped
  `await_turn` → `submit_exec_result` → `submit_work_response` → `submit_work_result` carrying a **computed 589**
  (19×31). On master that same invocation runs `agy mcp` and hangs. **Production reaches the fix.**
  **CORRECTED 2026-07-16 (same day, PO-prompted) — the bar is STRONGER than first written.** I originally recorded
  an "honest red" here: that run 2 reported `completed` but wrote no file, no worktree, no commit — **BL-059, third
  occurrence**. **That was wrong; I checked the wrong directory.** agy honours the `exec_rpc` cwd (uniquely — see
  [[BL-053]]), so it worked in `/tmp/agentalk-task-task-1784228918606/`: worktree `wt057`, branch `task-bl057`,
  **`answer.txt` = `589`** (computed 19×31), **committed `241396a`**. So BL-057's live bar is not merely "the bridge
  round-trips with no env var" — it is **a real autonomous agent doing real, committed work through the fixed path
  with no env var set**, which is the strongest form the bar could have taken. **BL-059 is retracted** (kept as the
  record of the mistake); the status field never lied — the filesystem check did, because it was aimed wrong. Run 1's
  `failed` was **harness, not code**: the goal named an absolute path outside any repo, so the orchestrator's
  hardcoded worktree clause made agy **refuse correctly** (that refusal is itself coherent model output — a hung
  `agy mcp` cannot produce one).
  **Papercut noticed, left alone:** `lib/executor-runtime.mjs` still ends in `//# sourceMappingURL=…js.map` for a
  map that does not exist (pre-existing on master; a vestige of when `lib/` was `tsc` output and became
  hand-edited). Harmless noise in stack traces.
  **Independence caveat:** sole agent — authored, reviewed, and ran its own bars. Not an independent gate; the
  test repoint in particular has had only one pair of eyes.

  **Telemetry (task closure):**
  - task:        BL-057
  - wall-clock:  ~19:35 → 20:17 (~42 min)
  - budget:      weekly 24%→25% (Δ ~1%), session 98%→11% (window reset mid-task; Δ not meaningful)
  - gate:        lint clean, verify-contract clean, suite 63/63 (= pre-change baseline), pollution clean
                 (both real repos untouched; orchestrator + workers killed; worktree removed)
  - diff:        3 files, +160/−300; commits `b07f7d7`, `d6cda30`, merge `3403bdb`
  - outcome:     MERGED ✅

<!-- @item
id: BL-058
status: done
date: 2026-07-16
epic: null
tags: [bite0, config, launcher, broken-artifact, papercut]
-->
- [done · **MERGED 2026-07-17** (client `56269cf`) · config fixed + **a second defect found and fixed** (wrong port) · fail-fast guard deferred] — **a checked-in Bite 0 config could not start an orchestrator as written.**
  **`scripts/bl040-d1d3.config.json` had a broken `startCommand.cwd`.** It said `"cwd": "../../AgentTalk"`, but
  `scripts/launcher.mjs:40` resolves it against **`clientRoot`** (the repo root, `:29`), not against `scripts/` —
  so it lands on **`/Users/fausto/AgentTalk`**, which does not exist, and the run dies with a confusing
  **`Error: spawn node ENOENT`** (the ENOENT is the *cwd*, not `node` — highly misleading). Correct value is
  `"../AgentTalk"`, or better an **absolute path**. Cost real time on 2026-07-16: the value was copied in good
  faith into a new probe config and inherited the bug. **Fix:** correct the config; consider having
  `makeStartInstance` **fail fast with a clear message** when `cwd` does not exist, rather than surfacing ENOENT.
  Source: BL-045 live-orchestrator probe, 2026-07-16.

  **CLOSED — MERGED 2026-07-17 (client `56269cf`).** Two config values, both pointing at a reality that no longer
  exists — so the item's own DoD ("start as written") needed both fixed:
  - **`cwd`** `../../AgentTalk` → **`../AgentTalk`** (verified: resolves to `/Users/fausto/Software/AgentTalk`, the
    real repo; `../../AgentTalk` = the absent `/Users/fausto/AgentTalk` that produced the misleading `spawn node
    ENOENT`).
  - **`orchestratorUrl`** `:3000` → **`:3100`** — **a SECOND defect the filing never saw.** The `startCommand`
    launches the orchestrator with **no `PORT`**, so it binds its default **3100** (BL-060, `index.ts:36`), while
    agents were pointed at 3000. Invisible to the original report because the run died at the `cwd` ENOENT *before*
    reaching the port. Found by looking past the named symptom.

  **Verified (not asserted):** booted `apps/orchestrator/dist/index.js` from the fixed `cwd` → reached `Ready to
  manage agents.` and **bound 3100** (`lsof` confirmed), then killed cleanly. No agy worker needed — that path is
  BL-045's, not this config's.

  **Deferred follow-up (the item's optional second half):** `makeStartInstance` (client `launcher.mjs:40`) still
  surfaces a raw `ENOENT` when `cwd` is missing instead of a clear "configured cwd does not exist: <path>". That is
  a code change in the client launcher (a DX guard, not a broken artifact) — left open. File as its own item if the
  papercut recurs.

  **Telemetry (task closure):**
  - task:        BL-058
  - wall-clock:  2026-07-17 ~15:46 → ~16:10 (~24m)
  - budget:      claude session/weekly — meter `ok:false` (LB-11) at close; codex weekly 55%, antigravity 6% per prior read
  - gate:        JSON valid; live boot reached ready + bound 3100; backlog:check green
  - diff:        client 1 file (+2/-2), commit `56269cf`; AgentTalk backlog doc-only
  - outcome:     MERGED ✅ (client committed; push PO-gated)

<!-- @item
id: BL-056
status: done
date: 2026-07-16
epic: null
tags: [ui, observability, self-hosting, autonomy]
-->
- [done · **MERGED 2026-07-17** (`3e9ff4c`) · **D5/D6 witnessed live by the PO** · surfaced by the BL-051 live run · **the panel is a live window, not a record**] — **A run's output does
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


  **CLOSED — MERGED 2026-07-17 (`3e9ff4c`). Plan: `design/bl056-plan.md`.**

  **★ The filing's premise was WRONG, and the fix turns on it.** This item says the transcript is *lost*. It never
  was: **`tasks` (`team-coordinator.ts:133`) is NEVER pruned** — no `.delete`, no `.clear` anywhere — and
  `TeamTask` already carries `teamId`. Every task from every run was in memory the whole time. **What was lost is
  the POINTER.** `currentTaskId` answers *"what is this team doing NOW"*; the UI used it to answer *"what did this
  team DO"*. Two questions, one pointer — and completion correctly retires the first. **So the five `delete
  team.currentTaskId` sites are RIGHT and are untouched** (D4, proven: the diff against `team-coordinator.ts` /
  `arbiter-coordinator.ts` is **empty**). The fix is additive: one read method, one route, one fetch.

  **What the killed `ui-team-run-in-main` earned.** Master never lied — it renders the panel only when a task
  exists, deliberately (`App.tsx:282`: showing a stale task "is the same lie this task exists to remove"). The
  branch **added** `Team is assembled. No task has been given yet.` over a **15-minute interrupted run** — a lie
  written *by accident*, because **the data model could not distinguish "never given a task" from "task
  unreachable"**. Master only dodged it by saying nothing. **`200 []` vs `404` is that distinction** (D3), and it
  is the durable fix for the class: the next person to improve that panel no longer has to guess.

  **Bars.** D1–D4 automated (the majority of this item was orchestrator-side and never needed the LB-93
  exemption — it sat behind a "needs a PO go" gate as though it were a UI item). D5/D6 **witnessed live, PO
  watching**, per LB-93 (`apps/web/**` is excluded from vitest):
  - **D5** — a real gemini worker computed 17×23; a **fresh page load** rendered the task, `Status: completed`,
    `OUTPUT (4)`, and **`391`**, for a team whose `currentTaskId` is gone. **The tab was not open during the run**,
    so nothing arrived by socket.
  - **D6** — a team created and never given a task renders **"This team has not been given a task."** The same
    sentence `a4d0cbe` guessed; this one the API asserts.

  **★ `completed` is not evidence — the run that proved it.** The first witness run reported
  `status: "completed"` and had done **nothing**: the transcript read `ERROR: could not provision task worktree …
  fatal: not a git repository`, and `391` appeared nowhere. The team status was technically honest and completely
  useless. **The only thing that told the truth was the transcript — which, before this fix, was unreachable the
  moment the run ended.** On master that run reports as a success. That is this item's case, delivered by
  accident, against its own demonstration.

  **Blocked on, and fixed first:** [[BL-066]] / [[BL-067]] — `getTeamTasks` filters by `teamId`, and ids were not
  unique. The fix stood on sand until they landed. Found because a BL-056 bar flaked.

  **SCOPE BOUNDARY — in-memory retention fixes the PAGE RELOAD, not an ORCHESTRATOR RESTART.** The map is process
  memory. **Demonstrated, not argued:** restarting the orchestrator mid-session erased all 8 of that day's teams
  permanently, including the 15-minute run this item was built on. **If "review an agent-driven session after the
  fact" must survive a restart, that is persistence — a separate item, unfiled, PO's call.**

  **Also observed, unfiled:** the `tasks` map grows **unbounded** (never pruned) — it is what makes this fix cheap
  and a real leak on a long-lived orchestrator. And `scripts/launcher.mjs`'s own header documents this defect as a
  known limit of its D4 ("the worker's result TEXT is not reachable") — **this fix unblocks the launcher too.**

  **Telemetry (task closure):**
  - task:        BL-056
  - wall-clock:  2026-07-17 ~12:50 → 14:20 (~90m incl. two blocking id items + live runs)
  - budget:      weekly ~44%→47%, session 0%→~35%
  - gate:        tsc 0, suite 359/359 (355 + 4), leak bar isolation-stable 4/4, D4 empty-diff, sweep clean
                 (witness orchestrator declared)
  - diff:        6 files, +143/-5, commits `b159a01`+`a635bc5` → merge `3e9ff4c`
  - outcome:     MERGED ✅ — D5/D6 PO-witnessed

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
status: done
date: 2026-07-16
epic: null
tags: [safety, sandbox, protocol, autonomy]
-->
- [done · **MERGED 2026-07-16** — AgentTalk `b2f2335`, client `34c87f5` · found while fixing BL-052 · **the sibling defect, one layer down**] — **The `exec_rpc` `cwd` is
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

  **⬆️ 2026-07-16 — this item is no longer only a latent isolation gap. It has already cost us a false accusation
  against a model, and it will do it again.** The **asymmetry** is the trap: gemini **honours** `sink.cwd`
  (`lib/executor-runtime.mjs:567`) while claude (`:161`) and codex (`:713`) discard it. So the three providers run
  **in different directories for the same task**, and the shared mental model — *"the worker works in its
  `workdir`"* (BL-052) — is **true for two of them and false for the third**. Consequence, twice over: agy's work
  landed in `/tmp/agentalk-task-<id>/` (a worktree of the **orchestrator's** cwd), we looked in the worker's
  `workdir`, found nothing, and filed **BL-059** — *"agy accepts a plan then silently skips the work"* — against a
  model that had done the work **correctly and completely, both times** (`391` committed `2e52556`; `589` committed
  `241396a`). BL-059 is now **retracted**; this item is its root cause.
  **Why it deserves priority above "isolation hygiene":** the defect's real damage is **epistemic**, not just
  safety. It makes the artifact check — *the one discipline we trust to catch a lying `completed`* — silently
  point at the wrong filesystem, converting our best verification tool into a **generator of confident false
  negatives**. Any future autonomous run judged by "is the artifact there?" is exposed to exactly this. **Fixing the
  asymmetry (honour `sink.cwd` everywhere, or drop it everywhere and say so) is what makes "check the artifact"
  trustworthy again.** Whichever way it goes, it is a **behaviour change → PO call**, and it touches where *every*
  executor turn runs.

  ---
  **CLOSED 2026-07-16 — PO chose: honour `sink.cwd`, and create the task worktree inside the `workdir`.**
  Merged AgentTalk `b2f2335`, client `34c87f5` (per-task worktrees, PO-gated).
  **The instruction as given was not implementable, and the reason is the design:** the orchestrator has **no
  concept of `workdir`** — the word appears nowhere in this repo. It cannot create a worktree in a directory it has
  never heard of, and in **attach mode** (the operator launches agents out-of-band) it has no path to ever learn
  one. **So the party that knows the workdir does the job:** the orchestrator sends a task-dir **NAME**
  (`agentalk-task-<id>`, deliberately relative — never a path); the worker anchors it under its own workdir and
  provisions the worktree itself. `path.basename` is the **fence**: whatever arrives — relative, absolute, or
  `../..`-traversing — the task dir can only resolve **inside** the workdir. *(That fence proved itself by accident
  mid-testing: a stale orchestrator sent the old absolute `/tmp/agentalk-task-<id>` and the worker still anchored
  it under its workdir.)*
  **What each provider does now:** gemini honoured `sink.cwd` already; **codex now honours it** (it spawns per
  turn, so it can); **claude cannot, and this is structural** — its spawn happens once in `initialize()`, before any
  turn exists, so a long-lived stdio session gets **session** isolation, not **task** isolation. Not a containment
  hole (its cwd is the assigned workdir), but a real limit, left explicit in the code rather than papered over.
  Per-task isolation for claude would mean restarting its session per task — deliberately not done.
  **Second PO call, same session — the prompt clause.** After the worker began provisioning the worktree, the
  hardcoded *"use strictly `git worktree` … if you cannot or will not, refuse and abort"* became a **liability**: it
  asked an LLM to police an invariant the harness now guarantees, and agy promptly inspected a **working**
  worktree, declared *"there is no existing Git repository in the current working directory"* (**false** —
  `git rev-parse --is-inside-work-tree` is `true` there; `.git` is simply a **FILE** in a linked worktree, which is
  what a naive repo-check gets wrong) and took the refuse branch. **The only power that branch had left was to fail
  a correct setup.** Replaced with information — *"Your current working directory IS a git worktree, created for
  this task. Work directly in it."* — and **one shared `WORKTREE_CONTEXT`**: the string had been living as
  **three** copies (two of them byte-identical and independently declared), which is how it drifted at all.
  **Bonus:** the orchestrator no longer shells out to git — `child_process` and `fs` imports are **gone** from
  `in-process-driver`. The hermeticity mocks that exist only because this code created **real** worktrees during
  unit runs ([[LB-9]]) are now redundant.
  **The live bar (real orchestrator, real agy, PO-witnessed record):** agy **accepted**, worked in the provisioned
  worktree, and committed **`667`** (a *computed* 23×29) at `43b47c3` on branch `task-task-1784231884039`
  **inside** `/tmp/att-worker-sandbox`, while the orchestrator's own repo stayed at **10 worktrees / 10 branches —
  untouched**. The delta is the proof: the immediately preceding run, on the old code, grew it **9 → 10**.
  **Left open, deliberately → BL-061:** removing the refuse branch means a failure to provision now degrades
  *silently* to the workdir root. Containment still holds; **task isolation** does not. Not fixed here.
  **Independence caveat:** sole agent — authored, reviewed, and ran its own bars.

  **Telemetry (task closure):**
  - task:        BL-053
  - wall-clock:  ~21:20 → 22:06 (~46 min)
  - budget:      weekly 25%→28% (Δ ~3%), session 11%→38% (Δ ~27%)
  - gate:        AgentTalk suite 325/325 (= baseline), client 63→70 (+7 fence tests), lint + verify-contract clean,
                 pollution clean (both real repos untouched; worktrees removed; orchestrator + workers killed)
  - diff:        10 files across 2 repos; commits `86befde`, `9787430`, `37c1779`; merges `b2f2335`, `34c87f5`
  - outcome:     MERGED ✅

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
