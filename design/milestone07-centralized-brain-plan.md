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
