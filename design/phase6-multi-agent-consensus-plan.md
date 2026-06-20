# Phase 6 — Multi-Agent Consensus over Attach Mode (Scope & Implementation Plan)

**Status:** Draft for implementation (Claude, 2026-06-20)
**Author:** Claude (architect/reviewer) · **Implementer:** Gemini (bulk) · Claude reviews/refines.
**Related:** `design/mcp-implementation-plan.md` (Phases 1–5) ·
`design/phase5-client-extraction-proposal.md` §6 (parked → this) ·
`design/planning-protocol.md` · `design/agy-revised-protocol-spec.md`

> Division of labor (agreed with Fausto, 2026-06-20): **Claude owns this design + the
> readiness gate + reviews; Gemini does the bulk implementation.** Per the workflow:
> *document before implementation*, and *a readiness gate precedes code* — only isolated,
> zero-risk spikes may start before this is reviewed-green.

---

## 0. Goal (one sentence)

Make two (or more) **attached** agents run the full planning **consensus** protocol
end-to-end — acknowledge → fact-collect → discuss → propose → endorse → **submit_plan** → worker
hand-off — using the consensus engine the orchestrator **already** has.

## 1. Current state — grounded in code (2026-06-20)

**Already done — do NOT rebuild:**
- **Orchestrator consensus engine is complete.** `tools/list` (`AGENTTALK_MCP_TOOLS`,
  `mcp-tools.ts`) advertises every consensus tool: `agreement_proposal`,
  `agreement_acceptance`, `ack_planning_protocol`, `fact_collection_end`, `submit_plan`,
  `submit_work_response`, `submit_work_result`, plus `send_to_agent` / `await_turn`.
  `registry.handleMcpToolCall` routes them all to **`TeamCoordinator`**, which holds the
  planning state machine + watchdogs (`handleAgreementProposal`, `handlePlanSubmitted`,
  `handlePlanningProtocolAck`, `armPlanningWatchdog`, …). This works the same whether the
  action arrives over the attach MCP path or the legacy stdout path.
- **The full structured worker loop already exists in the client** —
  `agentalk-mcp-client/llm-agent.mjs` parses the model's `structured.message_type` and maps
  it to the right MCP action (`agreement_proposal` / `agreement_acceptance` / `submit_plan` /
  `fact_collection_end` / `ack_planning_protocol`), with a `CONTROL_CALLS` set and a
  response-schema. The consensus mapping logic is **not** missing — it's just not the code
  path attach mode runs.

**The actual gaps:**
- **G1 — the attach worker is "dumb".** `attach-harness.mjs` only does
  `await_turn → run CLI → send_to_agent`. It never emits a structured consensus action, so
  attached agents can acknowledge/discuss/propose/submit **nothing** — they can only message
  the user. This is the single reason "multi-agent consensus under attach" has been parked
  since M04.
- **G2 — the wire-contract is out of sync.** `wire-contract.json.data.mcpTools` lists
  `[send_to_agent, submit_plan, await_turn, request_human_intervention, request_file_content]`
  — it is **missing** the consensus tools that `tools/list` actually advertises
  (`agreement_proposal`, `agreement_acceptance`, `ack_planning_protocol`, `fact_collection_end`,
  `submit_work_response`, `submit_work_result`, `list_agents`) and **includes two phantoms**
  (`request_human_intervention`, `request_file_content`) that aren't in `AGENTTALK_MCP_TOOLS`.
  The hash is therefore "aligned" on a contract that doesn't describe reality.
- **G3 — no multi-agent consensus E2E has ever been run under attach.** The acceptance test
  deferred since M04 (two planners reach agreement → `submit_plan` → worker) is still open.

---

## 2. Workstreams (severity: **[BLOCK]** gates Phase 6 / **[RESOLVE]** lands in Phase 6 / **[NOTE]** track)

### P6-A — Structured consensus emission in the attach worker  **[BLOCK]**
The attached worker must, per turn, take the model's output, derive a **`message_type`**, and
call the **matching MCP tool** (not always `send_to_agent`). Two implementation options —
**Gemini to choose and justify in a 1-page sub-design before coding:**
- **A-opt-1 (reuse):** route the attach path through the existing `llm-agent.mjs` structured
  loop (it already maps `message_type` → tool and speaks MCP). Preferred if the loop can be
  driven per-turn off `await_turn`. Least new code; the consensus mapping is already tested-ish.
- **A-opt-2 (extend):** add the structured-action mapping to `attach-harness.mjs` (port the
  `message_type → tool` switch + response-schema from `llm-agent.mjs`). More duplication.

Hard requirements either way:
- The worker emits exactly **one terminal action per turn** (the pull model: `await_turn` →
  produce structured action → emit the matching tool → loop). Consistent with the M05
  turn loop and the effect-fence.
- **§13 rule preserved:** the protocol guarantee lives in the **orchestrator** (TeamCoordinator
  state machine + watchdogs + `expected_response_types` enforcement). The client only
  *translates* the model's `message_type` into the tool call; it must **not** be trusted to
  enforce protocol order. A malformed/illegal `message_type` is handled by the orchestrator's
  existing regression/interrupt logic, not by the client.
- **Response robustness:** structured output is parsed with a **repair/retry** path (the model
  re-prompted on unparsable/illegal output), reusing the client's existing response-schema —
  not a new bespoke parser.
- **[BLOCK] Graceful degrade on non-planning turns (single-agent chat must not regress).** A
  plain `message_received` with **no** `expected_response_types` (a standalone agent asked a
  simple question — no team, no planning) must yield a **plain answer via
  `send_to_agent{to:"user"}`**. The pull-mode worker must **not** demand structured-JSON /
  consensus output when there is no planning context. Simple Q&A on a single agent stays
  available without ever creating a team (acceptance criterion §6).

### P6-B — Reconcile + version-bump the wire-contract  **[BLOCK]**
- Make `wire-contract.json.data.mcpTools` the **single source of truth equal to the advertised
  tool set** (`AGENTTALK_MCP_TOOLS` names). Decide the two phantoms: either implement
  `request_human_intervention` / `request_file_content` as real tools (Phase 6 scope?) or
  **remove them** from the contract. Default: remove unless we commit to them now.
- Bump `version` 1 → 2 and **recompute the hash on BOTH repos** (byte-identical file, per the
  M05 contract guard). The connect-time handshake then rejects any worker still on v1 — which
  is exactly what we want during the cutover.
- A worker built for P6-A ships with the v2 contract; the orchestrator expects v2. Land them
  together (the hash forces it).

### P6-C — Planning-turn delivery & context in attach  **[RESOLVE]**
Confirm (and fix if needed) that the orchestrator's planning prompts reach the attached worker
through `await_turn`, and that the worker has enough context to answer with the right
`message_type`:
- The briefing / `ack_planning_protocol` request, `fact_collection_begin`, peer opinions,
  endorsement requests, and the `expected_response_types` for the current step must arrive in
  the `await_turn` payload (today they are emitted as `EVT`/`message_received` by
  `TeamCoordinator`). Verify the pull path surfaces them; wire any that don't.
- The worker passes the protocol briefing to the model so the model can pick a legal
  `message_type` (the briefing already explains the protocol — see `planning-protocol.md`).

### P6-D — Multi-agent consensus E2E (the acceptance gate)  **[BLOCK]**
- Extend the in-process smoke (`scripts/test-attach-mode.mjs`) and/or add a new harnessed E2E:
  **two planner agents attach, run a real planning task, and reach `submit_plan`**, with the
  worker hand-off (`team_work_assign` → `submit_work_result`). Start with a **stub/dummy
  provider** that emits scripted `message_type`s (deterministic, fast, CI-able), then a
  **live 2×real-CLI** run (codex/claude/`agy`) for the manual gate.
- This is what declares Phase 6 done — **not** unit tests alone.

### P6-E — Notes / deferred  **[NOTE]**
- **Native-loop/skill path** for claude/gemini (long-lived in-CLI loop vs per-turn harness):
  remains parked unless P6-A-opt-1 makes it free.
- **`request_human_intervention` / `request_file_content`**: only if §P6-B decides to keep them.
- **Cross-repo release**: client (`agentalk-mcp-client`) + orchestrator land together, pinned by
  the v2 hash; re-pin the client SHA in any consumer that still references it (the orchestrator
  no longer does, per M05 — verify nothing reintroduced it).

---

## 3. Robustness invariants (carry-forward, must hold)

1. **Protocol determinism lives server-side.** TeamCoordinator's state machine +
   `expected_response_types` gating + watchdogs decide validity; the client only maps the
   model's `message_type` to a tool. (§13.)
2. **One terminal action per turn**, pull-model, effect-fenced (M05 A2). A reconnect mid-planning
   requeues the turn; the agent re-pulls and re-answers.
3. **Contract drift is impossible silently** — v2 hash handshake; byte-identical contract file
   in both repos; commit guard.
4. **Flag-off / legacy** no longer exists (attach is the only mode, M05) — so no coexist path to
   preserve; but the **non-consensus single-agent attach** (chat to user) must keep working.

## 4. Readiness gate / open questions (close before bulk coding)

- **Q1 (P6-A):** reuse `llm-agent.mjs` loop vs extend `attach-harness.mjs`? Gemini's 1-page
  sub-design + recommendation. *(Gates P6-A.)*
- **Q2 (P6-B):** keep or drop `request_human_intervention` / `request_file_content`? *(Gates the
  contract content + hash.)*
- **Q3 (P6-C):** does `await_turn` already carry the full planning context
  (`expected_response_types`, peer state), or must the turn payload be enriched? *(Verify in
  code; small fix if not.)*

## 5. Phasing (riskiest-first, each with a smoke checkpoint)

1. **P6-B contract reconcile + bump** (small, unblocks everything; hash guard proves it).
2. **P6-A worker structured emission** behind the v2 contract — checkpoint: a *single* attached
   agent, driven by scripted `message_type`s, emits `submit_plan` and the orchestrator's
   TeamCoordinator accepts it (no real consensus yet).
3. **P6-C** turn-context wiring — checkpoint: the worker receives `expected_response_types` and
   answers a legal `message_type` for each step.
4. **P6-D** two-planner E2E — checkpoint: stub-provider consensus reaches `submit_plan`; then
   live 2×CLI manual run.

## 6. Acceptance criteria (Phase 6 = done when)

- `tsc -b` clean; full suite green; contract v2 byte-identical + hash-verified both repos.
- **Two attached planners reach `submit_plan` and a worker completes `submit_work_result`**,
  verified **live** with real CLIs (the M04-deferred E2E), and as a deterministic stub E2E in CI.
- Single-agent attach (chat-to-user) still works (no regression).
- No reintroduced coupling: orchestrator has zero `agentalk-mcp-client` references (M05 holds).

---

## 7. Status log
- 2026-06-20 — Draft created (Claude). Awaiting Fausto's read; then Gemini answers Q1–Q3
  (sub-designs) and starts P6-B → P6-A → P6-C → P6-D. Claude reviews each checkpoint.

## 8. Gemini's Answers to Q1-Q3 (Sub-design)

**Q1 (P6-A): Reuse `llm-agent.mjs` loop vs extend `attach-harness.mjs`?**
**Answer:** **A-opt-1 (reuse `llm-agent.mjs`)**. `llm-agent.mjs` already contains the robust, tested implementation of the `TeamCoordinator` protocol (JSON structured response parsing, retry handling, prompt injection for planner/worker roles, and mapping `message_type` to consensus tools). `attach-harness.mjs` was a basic one-shot wrapper that only knew how to call `send_to_agent`. Instead of duplicating the entire `conversation-runtime.mjs` parsing and prompting logic into the harness, we will adapt `llm-agent.mjs` to operate in "pull mode" (listening to MCP `await_turn` over WebSocket instead of stdin). `attach-harness.mjs` will be superseded by the new MCP-aware `llm-agent.mjs`.

**Q2 (P6-B): Keep or drop `request_human_intervention` / `request_file_content`?**
**Answer:** **Dropped**. They were phantom placeholders not backed by any real tool implementation in `AGENTTALK_MCP_TOOLS` or `TeamCoordinator`. The `wire-contract.json.data.mcpTools` has been strictly aligned to the 11 real tools (including `agreement_proposal`, `submit_plan`, etc.). The contract version was bumped to `v2`, the hash recomputed (`bce925ec...`), and both repos have been updated and verified green. P6-B is complete.

**Q3 (P6-C): Does `await_turn` already carry the full planning context?**
**Answer:** **No, it must be enriched.** Currently, the orchestrator's `registry.ts` specifically filters `EVT` packets and only enqueues `message_received` into the `await_turn` queue (via `agent.queueTurn`), dropping critical events like `team_task_assign`, `team_work_assign`, `conversation_start`, and `fact_collection_begin`. Furthermore, the enqueued turn lacks the `expected_response_types` property. We must update the orchestrator so that `queueTurn` receives the full `EVT` payload (or a superset), ensuring the attached client receives the necessary protocol directives to trigger the right prompts and schema validation.

---

## 9. Review — checkpoint after P6-B + sub-design (Claude, 2026-06-20)

Verified independently (not on gemini's say-so). **Verdict: P6-B is genuinely done and
correct; Q1–Q3 are sound. But Phase 6 overall is ~25% — P6-A, P6-C, P6-D (the substance) are
not started.**

### ✅ P6-B (wire-contract v2) — accepted
- Both `wire-contract.json` **byte-identical**, `version: 2`.
- Stored hash `bce925ec…` **matches** recomputed `sha256(data, 2-space)`.
- `mcpTools` == exactly the **11 real `AGENTTALK_MCP_TOOLS`** names; the two phantoms removed.
- `tsc -b` clean, suite **139/139**, contract guard prints `verified successfully (v2)`.

### ✅ Q1–Q3 sub-design — sound
- Q1 reuse `llm-agent.mjs` in pull-mode (avoids duplication); Q2 phantoms dropped; Q3 correctly
  found that `await_turn` does **not** carry the planning context (= P6-C).

### ❌ Not done (the hard 75%)
- **P6-A** — `llm-agent.mjs` has **0** `await_turn` refs (still stdin-mode); attach bin is still
  the dumb `attach-harness` (only `send_to_agent`). No attached agent can emit a consensus action.
- **P6-C** — `registry.sendProtocol` (`registry.ts:456-463`) still enqueues only
  `message_received`, **without** `expected_response_types` and dropping
  `team_task_assign`/`conversation_start`/`fact_collection_begin`. Analyzed, not implemented.
- **P6-D** — multi-agent E2E: not started (the acceptance gate).

### Minor
- **`messageTypes` in the contract was NOT reconciled** like `mcpTools`: it still lists
  `plan_submission/planning_phase_complete/turn_complete/turn_error`, which don't match the real
  protocol message_types (`opinion/agreement_proposal/agreement_acceptance/submit_plan/
  fact_collection_end/work_*`). Hash-consistent so non-blocking, but it's a half-reconciliation —
  fix in a contract pass (would bump to v3).
- One-off helper scripts `fix_contracts.py` / `fix_hash.py` were left untracked in the repo root
  (removed by Claude, 2026-06-20).

### Guidance for the next round (→ Gemini)
**Do P6-A and P6-C together — they're coupled.** The pull-mode worker (P6-A) needs the enriched
turn (P6-C: full EVT + `expected_response_types`) to know *which* `message_type` to produce.
Sequence: P6-C (enrich `queueTurn`/`await_turn` payload) → P6-A (adapt `llm-agent.mjs` to pull
the turn over MCP and emit the matching tool) → **P6-D** the two-planner consensus E2E as the gate
(stub provider in CI, then live 2×CLI). Keep single-agent attach working (no regression).

### Status log
- 2026-06-20 — P6-B + sub-design reviewed → **green for P6-B only**. P6-A/P6-C/P6-D remain;
  next checkpoint is P6-A+P6-C (coupled), then P6-D. *Back to Gemini.*
