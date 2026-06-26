# Milestone 10 · T4 — API-path protocol enforcement (plan / for review)

> **Status:** DRAFT for review (architect: Claude, 2026-06-26). **No code yet.**
> Parent: `design/milestone10-phase2-plan.md` (T4 stub, §T4). Decisions D1/D2/D3 already
> settled; T4 was deferred per **D3** (v1 = T1+T2). This plan proposes promoting T4 to an
> implementable unit. **Brain stays untouched** — see §Scope.

## 1. Why (the gap T4 closes)

On the **API path**, a planner's action is constrained only *after* generation:

- `ApiCompleter.complete()` sets `response_format: { type: 'json_object' }` when
  `expectsStructured` is true (`packages/runtime-core/src/agents/completer.ts:58`). That forces
  *a* JSON object — **not** its schema and **not** the action set.
- The action is then **parsed + structurally graded** by `parseStructuredResponse`
  (`response-schema.ts`), and **sequence-graded** by the brain's T2 loop
  (`team-coordinator.ts` `validateProtocolStep`: valid→ack+advance · invalid→correct+retry(N=2)
  · repeated→eject).

So an API-path model can emit any `message_type` (or malformed JSON), and we discover it only by
parsing — paying a correction round-trip (`buildRetryPrompt`) each time. **T4 makes the structural
action set impossible to violate at generation time** by using OpenAI-compatible **tool/function
calling** with a forced call (`tool_choice`) and a strict **`enum`** on the action — so the model
*cannot* return an off-list action. The after-the-fact grading stays as the universal safety net.

**Benefit:** fewer parse-failure retries on the API path (cheaper/faster/more reliable runs);
off-protocol *structural* actions become unrepresentable. **It is an optimization, not a new
behavior** — the brain remains the authority on sequence legality.

## 2. Scope

**IN (emission layer only — API path):**
- `packages/runtime-core/src/agents/api-client.ts` — extend `ApiCallArgs` + request `body` to carry
  `tools` and `tool_choice`; pass through to `/chat/completions`.
- `packages/runtime-core/src/agents/completer.ts` — `ApiCompleter.complete()`: when structured,
  send the protocol tool + `tool_choice`, and read the returned `tool_call` arguments back into the
  same `{ message_type, message_payload }` text the parser already expects (so downstream is
  unchanged).
- `packages/runtime-core/src/agents/response-schema.ts` — **derive** the tool/function JSON-schema
  (the `enum` of `STRUCTURED_MESSAGE_TYPES` + per-type payload shape) from the *existing* constants,
  so the enum has one source of truth. Add an exported `buildProtocolToolSchema()`; **do not change**
  `parseStructuredResponse` / `validatePayload` semantics.

**OUT (do NOT touch — show-stoppers per AGENT.md Rule 2 / M06):**
- `team-coordinator.ts` and the **grading/sequence** logic (`validateProtocolStep`, eject, retry).
  T4 changes *how an action is emitted*, never *how it is judged*.
- The **MCP path** (`McpCompleter`) and the `registry.ts` consensus mapping.
- The wire contract version (that is **T3**, deferred, cross-repo). T4 is single-repo, no `v5→v6`.

## 3. Approach (proposed — open decisions flagged for Fausto)

1. **One function, enum arg (not one-function-per-type).** Expose a single tool, e.g.
   `respond(message_type: enum, message_payload: object)`, mirroring today's single-envelope shape →
   minimal churn, parser reused verbatim. `message_type` carries the strict `enum`.
2. **`tool_choice: "required"`** (force *a* tool call) for the v1 — structural enforcement of the
   action set. Returned arguments are serialized to the existing JSON envelope string and handed to
   `parseStructuredResponse` unchanged.
3. **Parser stays the universal fallback (belt-and-suspenders).** MCP-path agents, and any provider
   that ignores `tool_choice`, still emit envelope JSON; `parseStructuredResponse` + `buildRetryPrompt`
   remain the catch-all. T4 is *additive*.

### Decisions needed (Fausto)
- **D-T4-1 — enum granularity.** v1 = **static** enum of the 9 `STRUCTURED_MESSAGE_TYPES`
  (structural). A *phase-narrowed* enum (offer only actions legal at the current phase) would push
  enforcement toward sequence-legality too — **but couples the transport/api-client to protocol
  phase**, which is brain-adjacent. **Recommend: static for v1; phase-narrowing is a separate v2.**
- **D-T4-2 — provider capability matrix (RISK).** All three API providers route through OpenAI-compat
  `/chat/completions` (`google` via generativelanguage openai-compat, `openrouter`, `nous`). Need to
  confirm each honors `tools` + `tool_choice: "required"`. **If any does not, gate T4 per-provider**
  and fall back to today's `response_format: json_object` path for that provider (feature-detect, no
  hard failure).
- **D-T4-3 — keep `response_format: json_object` alongside tools?** Some OpenAI-compat servers reject
  both together. **Recommend: when tools are sent, drop `response_format`** (the tool schema already
  constrains output); verify per provider.

## 4. Definition of Done

- API-path structured turns send a `tools` array + `tool_choice` and read the tool-call arguments
  back into the existing envelope; **off-list `message_type` is unrepresentable** on a compliant
  provider.
- **Zero behavior change** when tools are unsupported/disabled: falls back to the current
  `json_object` + parse path (proven by a provider-gated test).
- Brain, MCP path, grading loop, and wire contract **unchanged** (diff confined to the 3 files in §2).
- `tsc -b` clean; full suite green; **new tests** (see §5) added; existing response-schema tests
  untouched and passing.
- No live-provider call required to merge (unit-tested with an injected `fetchFn`, the existing
  pattern in `ApiCompleter`/`callApi`).

## 5. Test plan (additive)

- `buildProtocolToolSchema()` emits an `enum` exactly equal to `STRUCTURED_MESSAGE_TYPES` (guards
  drift) and a payload schema per type.
- `ApiCompleter` with a mock `fetchFn`: when `expectsStructured`, the request body carries
  `tools` + `tool_choice`; a mocked `tool_call` response is decoded into the same envelope text
  `parseStructuredResponse` accepts.
- Fallback: provider flagged unsupported → body carries **no** tools, uses `json_object`
  (behavior-preservation test).
- Round-trip: a tool-call for each of the 9 types decodes to a valid `StructuredResponse`.

## 6. Risk / honesty notes

- **Highest risk = provider capability (D-T4-2).** This is the one thing that can't be fully settled
  from code alone; the plan de-risks it by gating + fallback, but a short live check per provider is
  advisable before calling T4 closed (parked while budgets are tight).
- **Temptation to over-reach into sequence enforcement (D-T4-1).** That is brain territory — phase
  narrowing must NOT leak protocol state into `api-client.ts` in v1. If it looks necessary,
  **STOP and re-scope** (Rule 2).
- T4 yields **no behavior change** by design; if implementation forces one, that is a show-stopper to
  report, not absorb.

## 7. Telemetry (to fill at closure)

```
**Telemetry (task closure):**
- task:        M10-T4
- wall-clock:  <start> → <close> (<Δ>)
- budget:      weekly <a%→b%>, session <a%→b%>
- gate:        tsc <0|n>, suite <p/p>, pollution <clean|…>
- diff:        <N files, +adds/-dels>, commits <hashes>
- outcome:     <MERGED ✅ / BLOCKED ⛔ / …>
```
