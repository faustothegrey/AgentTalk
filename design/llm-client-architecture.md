# `@agenttalk/llm-client` — Architecture

**Status:** reference doc, 2026-06-26. Describes the package extracted by the
`llm-client-extraction-spike.md` (Phase 1 + Phase 2-core). Audience: anyone building a third-party app on
AgentTalk's LLM layer, or maintaining the extraction.

> **TL;DR.** `@agenttalk/llm-client` is a small, zero-dependency package that lets any app **chat with an LLM**
> without pulling in AgentTalk's consensus/orchestration stack. It exposes **one interface — `Completer` — with
> two backings**: `ApiCompleter` (direct provider HTTPS) and `McpChatCompleter` (delegates a turn to an external
> executor via an injected transport). **There is no WebSocket, no MCP server, and no consensus code inside this
> package.**

---

## 1. Why this exists

Most apps that want an LLM only need *chat* — send text, get text. AgentTalk already had all the LLM-calling
machinery, but it lived **inside** `@agenttalk/runtime-core`, tangled (by package, not by logic) with the
multi-agent consensus brain. So a third party couldn't reuse "just chat" without importing the whole engine.

`llm-client` is that core, lifted out into a leaf package. The consensus brain now *depends on* it; nothing in
the package depends on the brain.

## 2. The core idea: one plug, swappable backings

Everything hangs off a single interface, the **`Completer`** — "give me a turn, I'll give you text":

```ts
interface Completer {
  maintainsSession?: boolean;
  complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult>; // -> { text, usage? }
}
```

```
   your app:  const chat = new ChatSession(completer);
              await chat.send("hello");
                         │
                         ▼
        ┌────────────────────────────────────────────┐
        │            Completer   (THE PLUG)           │   complete(prompt) ─▶ { text }
        └────────────────────────────────────────────┘
              ▲                    ▲                    ▲
   implements │         implements │         implements │
       ApiCompleter        McpChatCompleter      (your own, if ever)
          │                      │
     callApi(HTTPS)         ExecTransport  ◀── injected interface (dispatch / onResult / onDisconnect)
          │                      │
          ▼                      ▼
   provider HTTP API      whatever you plug in:
   google / openrouter      • a fake (unit tests)
   / nous                   • an in-process executor
                            • LATER: a WebSocket adapter to agentalk-mcp-client  (NOT yet built)
```

A caller programs against `complete()` and does not care which backing runs the turn. `ChatSession` wraps any
`Completer` to add multi-turn history.

### `maintainsSession` — the one behavioural knob
- `ApiCompleter` → `false`: stateless. The provider remembers nothing, so a multi-turn wrapper **replays the
  full history** each turn.
- `McpChatCompleter` → `true`: the external executor (e.g. a `claude`/`codex` CLI) keeps its **own** conversation,
  so the wrapper sends **only the latest turn**.

`ChatSession` branches on exactly this flag.

## 3. Package layering — and where the WebSocket actually is

```
 your third-party app
   │  import { ChatSession, ApiCompleter } from '@agenttalk/llm-client'
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ @agenttalk/llm-client        ZERO deps · NO WebSocket · NO consensus   │   ◀── leaf, depends on nothing
│   api-client (callApi) · Completer · ApiCompleter · ChatSession        │
│   McpChatCompleter · ExecTransport · McpExecError                      │
└──────────────────────────────────────────────────────────────────────┘
   ▲ depends on
┌──────────────────────────────────────────────────────────────────────┐
│ @agenttalk/runtime-core      the consensus brain                       │
│   team-coordinator (brain) · registry · Agent (turn-queue) · mcp-tools │
│   McpCompleter  ◀── Registry-coupled orchestration adapter (stays here)│
│   response-schema (STRUCTURED_MESSAGE_TYPES, buildProtocolToolSchema)   │
└──────────────────────────────────────────────────────────────────────┘
   ▲ depends on
┌──────────────────────────────────────────────────────────────────────┐
│ apps/orchestrator                                                      │
│   mcp-server.ts   ◀──────────────── 🔌 THE WEBSOCKET LIVES HERE (M05)  │
│   (hosts await_turn / submit_exec_result for attached MCP agents)      │
└──────────────────────────────────────────────────────────────────────┘
                         ▲
                         │  WebSocket (MCP "attach mode")
                  agentalk-mcp-client    (external executor: a claude/codex/gemini CLI in a PTY)
```

**Two rules this encodes:**
1. **Arrows point up only.** `llm-client` is the bottom leaf and imports nothing from AgentTalk — verified: its
   source has *only* relative intra-package imports. That's why a consumer's dependency tree stays clean.
2. **The WebSocket is at the top, in `apps/orchestrator`** — three layers *above* `llm-client` and entirely
   outside it. It predates this work (built in Milestone 05 for MCP attach mode). `llm-client` never imports it.

## 4. The three completers, compared

| Completer | Lives in | `maintainsSession` | Backing | Consensus-aware? |
|---|---|---|---|---|
| **`ApiCompleter`** | `llm-client` | `false` | `callApi` → provider HTTPS | No (tool injected) |
| **`McpChatCompleter`** | `llm-client` | `true` | injected `ExecTransport` | No |
| **`McpCompleter`** | `runtime-core` | `true` | `Agent` turn-queue + `Registry` events | Yes (engine-coupled) |

`McpChatCompleter` and `McpCompleter` do the *same job* (delegate a turn to an external executor and race
result/timeout/disconnect) — but `McpCompleter` is welded to the Registry (it's the consensus orchestration
adapter), while `McpChatCompleter` is decoupled via `ExecTransport`. They are intentionally separate; a future
cleanup could re-express `McpCompleter` over `ExecTransport` (see the tech-debt note in `backlog.md`).

## 5. Data flows

### 5a. A plain API chat turn (the common case — no WebSocket, no MCP)

```
app ─ chat.send("hi") ─▶ ChatSession ─ complete("hi", {messages:[…]}) ─▶ ApiCompleter
                                                                            │
                                                          callApi(HTTPS POST /chat/completions)
                                                                            │
                                                            google / openrouter / nous
                                                                            │
                                              { text } ◀───────────────────┘
   "reply" ◀── appended to history ◀── ChatSession ◀── { text }
```

Infrastructure pulled in: **none beyond an HTTPS call.**

### 5b. An MCP-backed exec turn (optional; the executor runs the turn)

```
app ─ complete("hi") ─▶ McpChatCompleter
                           │  subscribe onResult/onDisconnect, arm timeout
                           │  transport.dispatch({ prompt:"hi" })
                           ▼
                    ┌──────────────────┐   ← ExecTransport boundary (INJECTED)
                    │   ExecTransport   │     llm-client stops here; everything below is the adapter
                    └──────────────────┘
                           │  (a concrete adapter — NOT in llm-client — bridges to:)
                           ▼
              await_turn / submit_exec_result   (over WebSocket, in the orchestrator's mcp-server)
                           │
                  agentalk-mcp-client runs the prompt in a CLI, returns { text }
                           │
   { text } ◀── McpChatCompleter resolves (first of: result | timeout | disconnect) ◀──┘
```

`McpChatCompleter`'s whole job is the **race + lifecycle** (resolve on result, reject on timeout/disconnect, no
listener leak). It knows nothing about WebSockets or MCP — only the `ExecTransport` contract.

## 6. Keeping consensus OUT: the structured-output injection seam

The one place the API path *could* have leaked consensus is structured output (the protocol tool schema from
M10-T4). It's kept out by **dependency injection**:

```
runtime-core (knows the protocol)                 llm-client (knows nothing about it)
─────────────────────────────────                 ───────────────────────────────────
new ApiCompleter(provider, model, fetch,
                 buildProtocolToolSchema)  ───────▶  ApiCompleter stores it as an opaque
                 └── the StructuredToolBuilder       `structuredToolBuilder: () => unknown`

   on a structured turn:  args.tools = [ this.structuredToolBuilder() ]   // forwarded verbatim
```

So `llm-client` ships the generic machinery (`tool_choice:'required'`, `response_format`), and the *meaning* of
"structured" (the actual `respond`/`submit_plan` schema) is injected by `runtime-core`. The T4 wire contract is
byte-identical to before the extraction; its test still asserts the real schema (now with the builder injected).

## 7. Public API (what a consumer imports)

```ts
import {
  // direct API chat
  callApi, ApiCompleter, ChatSession,
  // the plug + types
  type Completer, type CompleterOptions, type CompleterResult, type ChatMessage,
  // MCP-backed chat (bring your own ExecTransport)
  McpChatCompleter, McpExecError, type ExecTransport, type ExecTurn, type ExecResult,
} from '@agenttalk/llm-client';
```

**Example — plain chat (zero infrastructure):**
```ts
const chat = new ChatSession(new ApiCompleter('google'), { system: 'Be terse.' });
const reply = await chat.send('Summarise this in one line: …');
```

**Example — MCP-backed chat (you supply the transport):**
```ts
const completer = new McpChatCompleter(myExecTransport, { defaultTimeoutMs: 60_000 });
const { text } = await completer.complete('do the thing');
```

## 8. What's built vs. what's owed

| Piece | State |
|---|---|
| `callApi`, `ApiCompleter`, `ChatSession`, `Completer` plug | ✅ Phase 1 (committed `eae6321`) |
| `McpChatCompleter` + `ExecTransport` + `McpExecError` + tests | ✅ Phase 2-core |
| **Concrete WebSocket/MCP `ExecTransport` adapter** (real agentalk-mcp-client) | ⛔ **owed** — separate, larger task |
| Multi-turn `ChatSession`, role-aware `messages[]` | ✅ Phase 1 |
| Tool-calling exposed *through* llm-client | ❌ out of scope for now (stays in runtime-core) |

**The owed adapter** is what would let a third-party app actually drive `agentalk-mcp-client` end-to-end. It's
not in `llm-client` because the attach transport (the `Agent` turn-queue + `mcp-tools` + the WebSocket server)
is large and Registry-coupled. A first adapter could wrap an `Agent` + emitter (~a handful of lines) since it
already exposes `queueExecTurn` and emits `exec_result`. Until then, `McpChatCompleter` is fully usable against
any `ExecTransport` you provide (a fake, or an in-process executor).

## 9. Invariants to preserve (for maintainers)

- **`llm-client/src` imports nothing from AgentTalk.** Only relative intra-package imports. If a change adds a
  `@agenttalk/runtime-core`/`/contracts` import here, the extraction is broken — stop.
- **No WebSocket / no consensus / no Registry in this package.** The MCP backing stays behind `ExecTransport`.
- **Structured output stays injected**, never imported here — that's what keeps the package domain-agnostic.
- **Tests run against `src`** via the vitest alias `@agenttalk/llm-client → packages/llm-client/src`, and the
  package is in the test `include` glob. (Both were added during extraction; a missing glob silently drops the
  package's tests from the run.)

## 10. Related docs
- `design/llm-client-extraction-spike.md` — the plan + decisions (Q1–Q4) + phasing.
- `design/backlog.md` — "Unify protocol state-change event emission" (the `McpCompleter`↔`ExecTransport` dedup hint).
- `agentalk-mcp-client/wire-contract.json` — the wire shapes; exec subset = `await_turn` + `submit_exec_result`.
