# Milestone 07 — Centralized Agent Brain (thin harness) + API-Backed Agents — Plan

**Status:** Parked / planning — **blocked on M06 closure** (Phase 6 consensus). Start clean after.
**Author:** Claude (architect), 2026-06-20 · **Implementer (proposed):** Gemini (bulk) · Claude reviews.
**Related:** `design/phase6-multi-agent-consensus-plan.md` (M06) · `CLAUDE.md` (M05) ·
`design/phase5-client-extraction-proposal.md` · `design/collaboration-workflow.md`

> This epic supersedes the standalone "API-backed agents" proposal — API agents are folded in
> here as the **pilot/spike** of the broader centralization (see §5). Per the workflow:
> *document before implementation, readiness gate precedes code*. Nothing here starts until M06
> is green.

---

## 0. One-sentence vision

Move **all protocol-translation / semantic logic into the orchestrator** ("agent brain") and
reduce the external harness (`agentalk-mcp-client`) to **connection plumbing + a generic
"run this prompt → raw text + usage" remote-exec** — so new providers and behavior changes are
added **server-side, without ever touching the external harness again**.

## 1. Problem (why M07 exists)

Today the *translation* layer lives in the **client harness**: prompt building
(planner/worker/fact-collection), structured-JSON parse + retry, **`message_type` → MCP tool
mapping**, auto-propose, brainstorm, conversation lifecycle. So every new provider or protocol
tweak means editing an **external repo** and re-pinning a contract. The goal is to never touch
the harness again except transport (connect / reconnect / handshake / keepalive).

## 2. Target architecture — the bifurcation

```
                 ┌──────────────────────────────────────────────┐
                 │ ORCHESTRATOR = "agent brain"                  │
                 │ state-machine (today) + build prompt + parse  │
                 │ + message_type→tool + retry + lifecycle       │
                 └───────┬───────────────────────────▲──────────┘
        in-process fetch │                            │ exec(prompt,sessionId?)
                         ▼                            │   → {text, usage}
              ┌────────────────────┐      ┌───────────┴─────────────┐
              │ API providers      │      │ THIN HARNESS (CLI only) │
              │ OpenRouter / Nous  │      │ connect/reconnect/      │
              │ (NO harness)       │      │ handshake/keepalive     │
              └────────────────────┘      │ + spawn CLI, return raw │
                                          │ (claude / codex / agy)  │
                                          └─────────────────────────┘
```

- **API agents (OpenRouter/Nous):** no CLI, no local auth → the orchestrator does the `fetch`
  in-process. **No harness at all.** Full centralization is the natural design.
- **CLI agents (claude/codex/agy):** the subprocess + operator auth must stay local, so the
  harness remains — but becomes a **dumb remote executor**: `exec(prompt, sessionId?) →
  {text, usage}`. Zero semantics.
- **Both share one server-side brain.** Two ways to get a completion (local HTTP vs remote-exec).

## 3. The contract inversion (the heart — and the real cost)

Flip the wire-contract from **semantic events** (`await_turn` → rich planning event; client
decides) to a **remote-exec RPC** (orchestrator sends a fully-rendered prompt; harness returns
raw text + usage). One-time redesign; **afterward the harness is frozen** — exactly the goal.
The M05 wins are preserved/strengthened: harness stays standalone, deps public-npm-only, **less**
logic → less drift; the hash-guard still applies (re-bump on the inversion).

## 4. Hard parts / risks (what a spike must de-risk)

- **R1 — structured-output reliability** from hosted models (Hermes/OpenRouter) for the
  consensus protocol (valid JSON `message_type` each turn). Mitigation: `response_format:
  json_object` where supported + the existing retry/repair as backstop.
- **R2 — mid-turn reconnect / effect-fence with a remote executor.** If the CLI is mid-exec and
  the harness dies, who re-issues? Likely: orchestrator re-issues on reattach; the M05
  fence/requeue logic *centralizes* (cleaner) but must be redefined for exec-RPC.
- **R3 — session state:** stateless-per-turn (orchestrator resends full history → trivial
  harness, more tokens) vs an **opaque `sessionId`** the harness uses to keep a live CLI session
  (token-efficient, harness a touch more stateful but still semantics-free). Lean to `sessionId`.
- **R4 — retry becomes multi-round-trip** (parse-fail → new exec over the wire). Latency cost;
  acceptable on the pull model.

## 5. Recommended start: a SPIKE, not the cold epic

**Recommendation (my call, as asked): do a time-boxed spike first — and the spike *is* the
API-agent vertical slice.** Rationale: the API path has **no subprocess and no
reconnect-mid-exec**, so it is the cheapest probe of **R1** *and* of the centralized-brain
pattern, with **zero risk to the existing CLI path**. We learn the load-bearing unknown (can a
hosted model reliably drive the consensus protocol from a server-built prompt?) before paying
for the hard part (R2/R3 contract inversion of the CLI harness).

**Spike (throwaway, single vertical slice):** orchestrator builds the prompt → `fetch`
OpenRouter `/chat/completions` → parse the structured response → emit **one** structured action,
for a **single** agent, **no CLI touched, no harness changed**. Green ⇒ the centralized brain is
viable; proceed to the epic. Red on R1 ⇒ we learned it cheaply and adjust (tool-calling instead
of JSON, model choice, etc.).

**Epic proper (after the spike):**
1. Extract the translation layer into a server-side module (move, not rewrite — it's tested).
2. Productionize **API agents in-orchestrator** (OpenRouter + Nous/Hermes).
3. **CLI harness inversion** (exec-RPC) + reconnect/effect-fence semantics (R2/R3) + contract bump.
4. Retire the client-side semantic logic; harness = transport + exec only.

## 6. API technical detail (the pilot's concretes — carried from the API proposal)

Both targets are **OpenAI-compatible** `POST /v1/chat/completions`, `Authorization: Bearer`:
- **OpenRouter:** base `https://openrouter.ai/api/v1`, key `OPENROUTER_API_KEY`, optional
  `HTTP-Referer` / `X-Title`.
- **Nous Portal:** base `https://inference-api.nousresearch.com/v1`, key `NOUS_API_KEY`.
  (⚠️ *Not* the separate local "Hermes Agent" server on `localhost:8642/v1` — we want hosted
  Portal inference.)

One executor with configurable `{baseUrl, apiKeyEnv, extraHeaders, model}` covers both. Parse
`choices[0].message.content` + `usage{prompt_tokens, completion_tokens}`. No new dependency
(`fetch` is built into Node ≥18). **Open items to confirm with Fausto:** Q1 structured-output
reliability of the target Hermes model; Q3 two named providers (`openrouter`/`nous`) vs one
generic `api --base-url` (recommend two); Q4 exact Nous endpoint + Hermes **model id** for his
account.

## 7. Explicitly NOT now

Blocked on **M06 closure**. No M07 code (beyond the §5 zero-risk spike, and only once M06 is
green and Fausto greenlights). Start from a clean base.

## 8. Status log
- 2026-06-20 — Epic drafted (Claude). Folds the API-agent proposal in as the centralization
  pilot/spike. Parked pending M06 closure; awaiting Fausto's go + Q1/Q3/Q4 answers.
- 2026-06-20 — **M06 closed; M07 OPEN.** R1 spike GREEN (Gemini 3/3 legal `message_type` via
  Google OpenAI-compat). **Q3 RESOLVED:** named providers (`google`/`openrouter`/`nous`), one
  OpenAI-compatible client. **Q4 deferred** (start with Google; Nous later). Task M07-T1
  sub-design below (§9) is implementation-ready. *Implementer builds on branch
  `m07-t1-api-agent-driver`; reviewer verifies by running and merges on all-VERIFIED.*

---

## 9. Task M07-T1 — In-orchestrator API agent driver  **(implementation-ready · branch `m07-t1-api-agent-driver`)**

**Goal.** The orchestrator drives an **API-backed agent fully in-process** (Google via the
OpenAI-compat endpoint), reusing the existing consensus engine — with **no change to the protocol
engine** and **no CLI-harness inversion yet**. This is the cheapest productionization of the
"centralized brain" (the easy case: API, no harness).

**Key insight (grounded in code).** The external client's loop is
`await_turn → build prompt → run model → emit the matching MCP tool`. The in-orchestrator driver
is the **same loop**, but it calls `agent.awaitTurn()` (registry.ts:277) and
`registry.handleMcpToolCall(agentId, tool, args)` (registry.ts:260) **directly in-process**
instead of over WebSocket. `TeamCoordinator` cannot tell the difference → protocol determinism is
untouched.

**Scope — DO:**
1. **Server-side OpenAI-compatible API client** (new module under `packages/runtime-core` or
   `apps/orchestrator`). `callApi({provider, model, messages, response_format}) → {text, usage}`.
   Named providers (Q3): `google` = `https://generativelanguage.googleapis.com/v1beta/openai`,
   key `GEMINI_API_KEY`, default `gemini-2.5-flash`; `openrouter`/`nous` configured but inert
   until keys arrive. Uses built-in `fetch` (Node ≥18, **no new dependency**). Unit-test with a
   **mocked fetch** (deterministic, CI). Reference shape: `spikes/m07-api-structured-probe.mjs`.
2. **Server-side translation module** — port the minimal consensus pieces from the client:
   `llm-agent.mjs::dispatchStructuredResponse` (message_type→{tool,args}), `response-schema.mjs`
   (parse + repair/retry), and the relevant prompt builders in `conversation-runtime.mjs`. Build
   the prompt from a turn payload; parse the structured JSON; map `message_type → {tool, args}`.
   **Copy as a NEW module — do NOT delete the client's copy** (the CLI harness still uses it until
   I3). Unit-test the mapping + parse/retry.
3. **In-process driver** — for an agent configured as API-backed, run:
   `const turn = await agent.awaitTurn()` → build prompt → `callApi` → parse (retry once on
   unparsable) → `registry.handleMcpToolCall(agentId, tool, args)` → loop. **Graceful-degrade
   preserved:** a non-planning turn (no `expected_response_types`) yields `send_to_agent{to:"user"}`
   (the M06 §P6-A no-regression rule).
4. **Agent config + start path** — mark an agent as API-backed (e.g.
   `createAgent(id, {provider:'api', providerName:'google', model})`) and have the registry start
   the in-process driver for it **instead of** waiting for an external WebSocket attach.

**Scope — DO NOT TOUCH (guardrails):**
- `agentalk-mcp-client` / the CLI harness — no inversion, no edits (that is **I3**).
- The client's translation logic — not retired yet (**I4**).
- Multi-agent API **consensus** — that is **I2**; I1 is a **single** API agent.
- `TeamCoordinator` / protocol determinism — unchanged; the driver only feeds it tool calls.
- The existing **attach (CLI/stub) path** — must keep working unchanged; the driver is
  **opt-in / config-gated** so default behavior is byte-for-byte preserved (M05/M06 invariants).

**Smoke checkpoint.** One in-orchestrator API agent completes a turn: (a) deterministic test with
**mocked fetch** (CI); (b) one **live Google call** (`gemini-2.5-flash`) recorded (manual).

**Invariants (carry-forward).** Protocol determinism stays in `TeamCoordinator`; one terminal
action per turn; **budget — use `gemini-2.5-flash`**; **no secrets committed** (key via env).

**DoD** — the claim/verdict rows live in `milestone07-centralized-brain-implementation.md`; a row
is done only when Claude's verdict is **VERIFIED** (ran it), per workflow §3b.

### 9.1 T1.6 — Registry start-path (the wiring) *(remaining T1 item)*

**Why.** T1.1–T1.5 delivered a verified `InProcessAgentDriver`, but it's only ever started by the
smoke harness — `registry.ts` is untouched, so no *configured* agent in the running orchestrator is
ever API-backed. T1.6 closes that gap so T1 actually delivers its goal: *the orchestrator drives an
API agent through the normal agent lifecycle.* (Was GAP-1; reviewer review 2026-06-20.)

**Scope — DO:**
1. **Agent config.** Let an agent be created/marked as API-backed, e.g.
   `registry.createAgent(id, { provider: 'api', providerName: 'google', model })` (shape your call;
   keep it minimal and typed). Non-API agents keep their exact current shape.
2. **Start path.** When an API-backed agent is **activated**, the registry instantiates and
   `start()`s an `InProcessAgentDriver` for it **instead of** waiting for an external WebSocket
   attach. When it's stopped/disconnected, `stop()` the driver and clean up.
3. **Opt-in / no-regression.** Only agents explicitly marked `provider:'api'` take this path;
   every existing attach (CLI/stub) agent path is **byte-for-byte unchanged**. This is the
   load-bearing guardrail — prove it with the existing suite staying green.

**Scope — DO NOT TOUCH:** the consensus engine / `TeamCoordinator`; the CLI harness
(`agentalk-mcp-client`); multi-agent consensus (that's T2). Single API agent only.

**DoD / checkpoints (T1.6 row):**
- A **configured** API agent (`provider:'api'`) created via the registry **completes one turn
  through the normal lifecycle** — deterministic **mocked-fetch CI test** (no smoke harness
  hand-wiring; the registry starts the driver).
- One **live Google** turn through the registry path (`gemini-2.5-flash`), recorded.
- Full suite green; existing attach path unchanged; `tsc -b` clean (commit the build — don't leave
  fixes uncommitted, cf. GAP-2).

**On green:** all of T1 (T1.1–T1.6) is VERIFIED → reviewer merges the branch to `master`.

---

## 10. Task M07-T2 — Multi-agent API consensus (in-orchestrator)  **(implementation-ready · branch `m07-t2-api-consensus`)**

**Goal.** Two API-backed **planners** + one API-backed **worker**, all driven **fully in-process**
(Google `gemini-2.5-flash`), complete the **whole `planner-planner-worker` consensus protocol
end-to-end** — fact-collection → discussion → proposal → endorsement → `submit_plan` → (user)
plan-confirm → worker accept → `submit_work_result` — with **no external harness** and **no change
to `TeamCoordinator`**. This proves the centralized brain drives *multi-agent consensus*, not just a
single agent (T1).

**Key insight (grounded in code).** T1 already delivered (a) a per-agent `InProcessAgentDriver`
(`packages/runtime-core/src/agents/in-process-driver.ts`) that runs
`awaitTurn → buildPrompt → callApi → parse/retry → translate → handleMcpToolCall`, and (b) the
registry start-path (`registry.ts` `activateAgent`: `provider:'api'` → starts a driver per agent).
The `TeamCoordinator` already pilots the full multi-planner flow **unchanged** — it sends
`fact_collection_begin` → `conversation_start{mode:'planning'}` → (`team_work_assign`) and consumes
`fact_collection_end` / `opinion` / `agreement_proposal` / `agreement_acceptance` / `submit_plan` /
`submit_work_response` / `submit_work_result`. So T2 is **not** new protocol — it is: (1) run three
T1 drivers concurrently in one team, and (2) teach the driver/runtime the **two team-phase events it
does not yet handle.** The driver already handles `conversation_start` + planning `message_received`
(the discussion/proposal/submit_plan phases — verified in T1's single-planner smoke).

**The two gaps to close (the only new driver/runtime work):**
- **G1 — fact-collection (planner).** The driver does not handle `fact_collection_begin`. Port the
  client's `handleFactCollectionBegin` (`agentalk-mcp-client/llm-agent.mjs`) into the server-side
  runtime: build the fact-collection prompt → `callApi` (structured) → emit
  `fact_collection_end{summary}`.
- **G2 — worker (`team_work_assign`).** The driver does not handle `team_work_assign`. Port the
  client's `handleTeamWorkAssign` + `WORKER_RESPONSE_INSTRUCTIONS`: build the worker prompt →
  `callApi` (structured `json_object`) → parse `work_accept`/`work_refuse` → emit
  `submit_work_response{accepted[,reason]}` and, on accept, **also** `submit_work_result{result}`.
  This requires the driver to **emit more than one terminal tool call in a single turn** (today it
  emits exactly one) — see R-T2b.

**Scope — DO:**
1. **G1 fact-collection handling** in the runtime + driver (planner path), as above. Port (move, not
   rewrite) from the client; **client copy untouched.**
2. **G2 worker handling** in the runtime + driver (worker path), as above; support the
   two-terminal-calls-in-one-turn worker turn. Port from the client; client copy untouched.
3. **Multi-driver concurrency** — three API agents in a `planner-planner-worker` team each get their
   own driver via the **existing T1 registry start-path** (no new wiring expected; if the start-path
   needs a tweak to support a team of API agents, keep it minimal and opt-in). Each driver keeps its
   **own isolated `runtime`** state; verify the dedup / one-terminal-action-per-turn invariants still
   hold across concurrent drivers.
4. **Tests.** (a) **Deterministic mocked-fetch CI test** driving the full team flow — three drivers,
   canned per-phase API responses scripted (fact_collection → discussion → proposal → acceptance →
   submit_plan → confirm → worker accept) — asserting `team_task` reaches `awaiting_confirmation`
   then `completed`. (b) **One live Google smoke** (`gemini-2.5-flash`), **all in-process**: 2
   planners reach `submit_plan`, plan confirmed, worker completes — **recorded** (transcript/log).
   Model the smoke on `scripts/test-live-gate.mjs` but with **API agents (no spawned subprocess)**.

**Scope — DO NOT TOUCH (guardrails):**
- `TeamCoordinator` / protocol determinism — **unchanged**; the driver only feeds it tool calls and
  consumes its events. If a change there seems necessary, **stop and raise it** — do not edit it.
- `agentalk-mcp-client` / the CLI harness — no edits; the client's translation/worker/fact copies
  stay (retiring them is **T4**).
- The existing **attach (CLI/stub) path** and the **single-agent** T1 path — byte-for-byte
  preserved; the team-of-API-agents path is opt-in (all three marked `provider:'api'`).
- **brainstorm** and single-planner **`planner-worker`** compositions — out of scope; T2 is
  **`planner-planner-worker` only.** (The `team_task_assign` event is the single-planner path — not
  needed for T2.)

**Risks to de-risk (call out in the ledger as you hit them):**
- **R-T2a — live consensus may loop / not converge** with `gemini-2.5-flash`. Mitigation: the
  existing auto-propose + stale-discussion watchdog + `maxReplies`; the live smoke uses a **directive
  task** (à la M06 `test-live-gate.mjs`: "immediately agree on adding `plan.md` … and submit the
  plan"). The **mocked-fetch test is the deterministic gate**; the live smoke is the existence proof.
- **R-T2b (load-bearing) — two terminal calls in one worker turn vs registry dedup.** The worker turn
  emits `submit_work_response` *then* `submit_work_result`. Verify the registry's
  `markTerminalActionComplete` / `isDuplicateTerminalAction` (keyed on `currentTurnId`) does **not**
  swallow the second call. If it does, the driver must sequence them correctly (e.g. distinct turn
  accounting) **without** changing `TeamCoordinator`. This is the correctness crux of T2.
- **R-T2c — graceful-degrade / non-planning invariant** (M06 §P6-A) preserved for all three agents.

**Smoke checkpoint.** (a) deterministic mocked-fetch full-team CI test (green in suite); (b) one live
Google end-to-end recorded run reaching worker completion.

**Invariants (carry-forward).** Protocol determinism stays in `TeamCoordinator`; budget =
`gemini-2.5-flash`; **no secrets committed** (keys via env); existing paths unchanged.

**DoD** — claim/verdict rows live in `milestone07-centralized-brain-implementation.md` (T2.1–T2.5);
a row is done only when the reviewer's verdict is **VERIFIED** (ran it), per workflow §3b. Implementer
creates branch `m07-t2-api-consensus` off `master`, claim-only commits; reviewer merges on
all-VERIFIED.

---

## 11. Task M07-T3 — CLI harness inversion (exec-RPC)  **(T3a implementation-ready; T3b/T3c outlined)**

**Goal.** Turn the CLI harness (`agentalk-mcp-client`) from a *semantic* client (it builds prompts,
parses, maps `message_type`→tool — the M05/M06 model) into a **dumb remote executor**:
`exec(prompt[, sessionId]) → {text, usage}`. The **brain** (prompt-build, parse/retry, translation,
protocol) moves server-side — **reusing the exact loop T1/T2 already built**. Afterward the harness is
frozen; new behaviour is added server-side only.

**Key insight (grounded in code).** T1/T2's `InProcessAgentDriver` loop is
`awaitTurn → buildPrompt → [GET COMPLETION] → parse/retry → translate → handleMcpToolCall`. For API
agents `[GET COMPLETION]` = `callApi`. **T3 generalizes that one step** into a pluggable **Completer**
(`complete(prompt, opts) → {text, usage}`): `ApiCompleter` (wraps T1/T2's `callApi`, unchanged) and a
new **`CliExecCompleter`** that sends an **exec-RPC** to the harness and awaits raw text. Loop,
prompt-build, translation, runtime: **all shared**. (Pre-spec reasoning: `milestone07-t3-prep.md`.)

**Decisions baked in (Fausto, 2026-06-21):**
- **D1 — Coexistence behind a flag**, not cutover. The exec-RPC path is added **alongside** the M05/M06
  semantic path (config-gated); T4 retires the old path. (This *is* a contract/behaviour change →
  authorised here per CLAUDE.md; it ships **off by default** until proven.)
- **D2 — Session: `sessionId` / native CLI session direction** ("brain ≠ memory" — semantics
  server-side, raw history in the CLI's `--continue` session). **R3 gets its own spike** (T3-S1) to
  settle determinism/recovery; T3a may use stateless single-shot exec as scaffolding.
- **D3 — Pilot on `gemini`/`agy`** (its persistent executor is proven in M06).
- **D4 — Effect-fence (worker crash mid-exec): STOP and ask the human** — **no auto-reissue** to start.
  The orchestrator surfaces the interrupted exec and waits; auto-reissue+dedup is a later, separate add.

**The guardrail flip (read carefully).** Unlike T1/T2, **T3 MAY and MUST touch the harness**
(`../agentalk-mcp-client`) — the inversion is the task. But constrained:
- The harness's new exec path stays **semantics-free** (no prompt-building, no `message_type` parsing —
  it runs the CLI and returns raw text+usage). All semantics live server-side.
- **The existing M05/M06 semantic path keeps working** (D1 coexistence) — the inversion is additive and
  flag-gated; default behaviour byte-for-byte preserved. **Still DO NOT TOUCH:** `TeamCoordinator` /
  protocol determinism; the API path (T1/T2).
- Contract change is real → **hash-guard re-bump happens in T3c**, not piecemeal.

**Risks (see §4 R2/R3/R4, refined in the prep doc).**
- **R2 effect-fence** (worst — a CLI exec mutates a worktree → not idempotent). Resolved *for now* by D4
  (stop-and-ask). Owned by **T3b**.
- **R3 session state** — D2; settled by spike **T3-S1**.
- **Exec granularity** — planner turn = single completion; **worker = run-to-completion agentic exec**.
  Two RPC shapes; the worker shape is **T3b**.

### 11a. T3a — exec-RPC for a planner turn  *(implementation-ready · branch `m07-t3a-cli-exec`)*

The cheapest slice that proves the inversion: a **read-only planner turn** driven server-side, the CLI
reached only as `exec(prompt) → text`. No consensus complexity beyond one turn, no worker, no reconnect.

**Scope — DO:**
1. **Completer abstraction** in `runtime-core`: `interface Completer { complete(prompt, opts) →
   {text, usage} }`. Refactor `InProcessAgentDriver` to call an **injected** completer instead of
   `callApi` directly. `ApiCompleter` wraps `callApi` — **T1/T2 behaviour must stay byte-for-byte**
   (prove via the existing suite staying green).
2. **`CliExecCompleter`** (orchestrator side): sends an **exec-RPC** to the harness over the existing
   WS/MCP transport and awaits `{text, usage}`. Stateless single-shot for T3a (R3 scaffolding, D2).
3. **Harness exec handler** (`agentalk-mcp-client`): on an exec-RPC, run the **agy** CLI once on the
   given prompt and return raw text+usage. **Semantics-free.** The existing semantic path is untouched
   and still selectable.
4. **Flag/config** (D1): an agent marked e.g. `provider:'cli-exec', providerName:'gemini'` takes the
   exec-RPC path via the driver; everything else unchanged / off by default.

**Scope — DO NOT TOUCH:** `TeamCoordinator`; the API path (T1/T2) behaviour; the M05/M06 semantic
harness path (must keep working).

**Smoke checkpoint:** (a) deterministic **mocked exec-RPC** unit test (driver + CliExecCompleter,
mocked transport) → a planner turn yields the right tool call; (b) **one live agy planner turn via
exec-RPC**, recorded.

### 11b. T3-S1 — session-model spike (R3)  ·  11c. T3b — worker agentic-exec + effect-fence  ·  11d. T3c — contract bump
Outlined now, detailed when T3a closes:
- **T3-S1 (spike):** prove `sessionId`/`--continue` native-session round-trips through exec-RPC (no
  resend); measure determinism + on-disk `--resume` recovery. Settles D2 concretely.
- **T3b:** the **worker** run-to-completion agentic exec + **effect-fence = stop-and-ask** (D4) +
  reconnect handling. The heavy, side-effecting half (worktree). **Fausto in the loop.**
- **T3c:** wire-contract bump for exec-RPC + **hash-guard re-bump**; flip nothing on by default yet.

**DoD** — claim/verdict rows in `milestone07-centralized-brain-implementation.md` (T3a.x first). A row
is done only when the reviewer's verdict is **VERIFIED** (ran it), per §3b. Implementer creates branch
`m07-t3a-cli-exec` off `master`, claim-only commits; reviewer merges on all-VERIFIED-or-DEFERRED.
