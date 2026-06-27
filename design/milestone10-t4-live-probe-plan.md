# M10-T4 follow-up — live API structured-tools probe

**Status:** DRAFT for human review. Do not implement until Fausto approves this scope.
**Parent:** `design/milestone10-t4-api-enforcement-plan.md` + backlog item "M10-T4 live-verification probe".
**Type:** script-only live verification / provider capability classifier.

## 1. Why

M10-T4 shipped the API-path structured-output optimization using OpenAI-compatible
`tools` + `tool_choice:'required'` + `response_format:{type:'json_object'}`. The runtime path is unit-tested with
mocked `fetch`, but no real provider endpoint has been hit with that exact parameter combination. LB-25 records the
honesty gap: if google/openrouter/nous reject the combo, v1 declares that provider unfit, but this is currently an
assumption rather than a measured fact.

This task measures that transport fact without changing production behavior.

## 2. Scope

**IN:**
- Add one script, proposed path `scripts/probe-t4-api-tools.mjs`.
- Optionally add one npm convenience script, proposed name `probe:t4-api-tools`, that builds first and then runs the
  probe.
- The probe sends one cheap `/chat/completions` request per selected provider using the exact T4 combo:
  `tools:[respond(...)]`, `tool_choice:'required'`, and `response_format:{type:'json_object'}`.
- It classifies each provider as:
  - `fit` — HTTP 2xx and the response contains `message.tool_calls[0].function.arguments` that parse as the existing
    structured envelope.
  - `http_reject` — endpoint rejects the request shape, usually 4xx.
  - `no_tool_call` — HTTP 2xx but no tool call came back.
  - `invalid_arguments` — tool call came back, but arguments do not parse as a valid structured envelope.
  - `skipped` — required API key is absent.

**OUT:**
- No changes to `packages/llm-client/src/api-client.ts`.
- No changes to `packages/runtime-core/src/agents/response-schema.ts`.
- No provider gating, caching, fallback machinery, or runtime behavior change.
- No changes to `team-coordinator.ts`, registry consensus, MCP path, or wire contract.

## 3. Implementation approach

The script should import the built protocol helpers from `dist` after `tsc -b`, matching existing live scripts that
depend on compiled packages. It should use `buildProtocolToolSchema()` and `parseStructuredResponse()` from
`@agenttalk/runtime-core`'s built output so the probed tool schema and validation are the same as production.

For response inspection the script should perform the HTTP request directly instead of calling `callApi()`, because
`callApi()` intentionally normalizes the response to text and hides whether it came from `tool_calls` or
`message.content`. That raw distinction is the point of the probe. Keep the provider table local to the script and
aligned with `packages/llm-client/src/api-client.ts` at implementation time.

Default behavior should be conservative:
- If no provider flags are passed, probe providers whose API keys are present and skip the rest.
- Allow `--provider <name>` and `--model <model>` overrides so the Nous default-model issue can be tested without
  changing production defaults.
- Print a compact table plus raw HTTP status/error snippets for rejects.
- Exit non-zero only for script bugs or malformed CLI args. Provider unfitness is a measured result, not a script
  failure.

Suggested prompt: ask the model to call `respond` with
`{ "message_type":"ack_planning_protocol", "message_payload":{} }`, which is the smallest valid structured envelope.

## 4. Definition of Done

- Probe script added and documented by its `--help` output.
- `npm run build` passes.
- Existing full suite stays green unless Fausto explicitly scopes a narrower gate.
- Running the probe with no relevant API keys reports `skipped` providers without failing.
- If a provider key is present, one live request is attempted and the result is honestly classified.
- Results are recorded back into `design/logbook.md` or the M10 implementation ledger if the probe is run live.

## 5. Risk / stop conditions

- If implementing the probe appears to require changing runtime provider behavior, STOP and re-scope.
- If a live provider rejects the T4 combo, do not add fallback machinery in this task; record the result and ask
  whether D-T4-2 should be reopened.
- Do not spend repeated live calls debugging provider output. Retry budget for each provider live check: max 1
  request by default, max 2 only if the first failure is clearly a transient transport error.
