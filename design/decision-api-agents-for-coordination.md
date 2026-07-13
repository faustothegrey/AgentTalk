# Decision — OpenRouter/API agents for the coordination layer; MCP clients for implementation

**Status:** ACCEPTED (PO, 2026-07-13). **Reversible.**

## Decision
Adopt **OpenRouter (API-driven `ApiCompleter`) agents as the default for the orchestrated/automated agents** in
AgentTalk — the *coordination* layer (consensus, pair-chat, relay, gate testing). **Retain MCP-attach CLI clients**
(`McpCompleter`) for the *implementation* layer, where real dev capability (file/command tools) is required. **Mix
freely**; the choice is per-agent config, fully reversible.

## Context
- The MCP-attach path (`agentalk-mcp-client` / `llm-agent.mjs`) is the current friction: an attach ritual per agent,
  PTY/port management, and fragility — culminating in **agy being parked as an MCP client** (hangs on the healthcheck
  `exec_rpc`; LB-92, BL-038 deferred). This is slowing AgentTalk development.
- The orchestrator already **abstracts the completer**: `provider: 'api'` → `ApiCompleter` (direct API); other
  providers → `McpCompleter` (attached CLI). The consensus protocol, relay/approval, and gates are **completer-agnostic**.
  So switching is a per-agent config flip, not a rearchitecture, with **zero lock-in**.

## The crux: coordination vs. implementation
| | OpenRouter (API) agent | MCP client (real CLI agent) |
|---|---|---|
| Debate / plan / reach consensus | ✅ | ✅ |
| Read repo / write code / run tests / commit | ❌ (no tools — a chat completion) | ✅ (full native toolset) |
| Attach / healthcheck / PTY | ✅ none | ⚠️ the fragile part |
| Speed / determinism / parallelism | ✅ high | ⚠️ slow, heavy |

API agents can **coordinate** but not **develop** (they hold only the protocol tool schema — no filesystem/bash). So
this is *deferring the hard part* (real self-hosting dev work), not replacing it. The clean model: **coordination →
OpenRouter; implementation → CLI agents.**

## Verified (2026-07-13)
- **OpenRouter is schema-compatible.** A faithful replica of the consensus request (forced `tool_choice` + `response_format:
  {type:'json_object'}` + tools) returned **HTTP 200 with a valid `opinion` tool call** on `openai/gpt-4o-mini` via
  OpenRouter. The earlier Google `400` ("forced function calling + mime unsupported") was **google-endpoint-specific**,
  not a protocol problem. (Note: OpenAI models require the word "json" in the prompt for `json_object` mode — the real
  consensus prompt already satisfies this.)
- Keys present: `OPENROUTER_API_KEY` set.

## Enabling work (small, concrete)
- **`POST /api/agents` must accept `providerName`** — today it reads only `{id, provider, model}` (`server.ts:593`) and
  drops `providerName`, so `api` agents default to `google` (`registry.ts:250`). This is the **only** real blocker to
  creating OpenRouter agents through the product. **Promoted to → BL-039** (was BL-037 finding #2).
- (Arbiter reachability and the Google tool-schema 400 stay in BL-037; neither blocks the OpenRouter direction.)

## Consequences / caveats
- **Realism:** API completions ≠ the CLI agents the humans use; testing with API agents validates the *substrate*, not
  real-agent behavior. Keep that caveat when interpreting results.
- **Degraded planning:** API planners can't "examine the codebase" (no read tools) — they reason abstractly. Fine for
  testing coordination mechanics; limited for real planning.
- **Budget:** provider quotas/rate-limits apply (OpenRouter), a different cost model than CLI sessions.
- **Reversibility:** the MCP path is retained, unused, ready — flip the provider field per agent to return to CLI
  clients when needed (e.g., for the implementation layer, or when agy is un-parked).

## Scope note
This concerns the **orchestrated/automated agents** inside AgentTalk. The human-run workflow agents (Claude/Codex/agy as
full CLI dev sessions, PO-batoned) are unaffected. Source: this session's TL-005 findings, LB-91/LB-92, BL-037/BL-038,
and the 2026-07-13 OpenRouter compatibility check.
