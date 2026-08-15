# Spike — Goose as a dev-capable executor (OpenRouter-backed)

**Status:** GO — **IMPLEMENTED + VERIFIED end-to-end.** Client-level verification (unit tests + real-code-path dev
turn + full build green + live attach handshake) **plus TL-008**: TL-001 (Continue + Stop supervised pair chat)
run with **two goose agents** — BOTH paths PASS (delivered turns, reply-limit, operator-stop). The last conjunction
is now closed. See `design/testlog.md` TL-008. **Date:** 2026-07-13. **Ran by:** Claude (resource-fallback: planner + implementer + reviewer
for this spike; PO-directed "do or die"). **Merges/decisions:** PO. **Code is UNCOMMITTED in the working tree.**

## What was built + verified this session
**Edits (in `agentalk-mcp-client`, working tree — not committed):**
- `lib/provider-runtime.mjs`: `'goose'` added to `SUPPORTED_PROVIDERS` + `DEFAULT_PROVIDER_LIMITS`; `case 'goose'`
  in `getProviderCommand` (`goose run --no-session --output-format json --provider openrouter --model … --max-turns
  30 -t <prompt>`); a `parseGooseJson` banner-stripping helper wired into `extractResponse`/`extractTokens`/
  `extractTokenDetails`.
- `__tests__/goose-provider.test.mjs`: 6 unit tests (supported-provider, one-shot routing, command builder,
  default model, token parse through banner, unparseable-output fallback).

**Verified (evidence):**
1. **Standalone** — `goose run … --provider openrouter` returns `PONG` (exit 0); a file-create task used goose's
   `write`+`shell` tools and produced the exact content. Goose = real dev agent on OpenRouter.
2. **Real executor code path** — `createExecutor({providerName:'goose'})` → `resolvedExecutionMode one_shot` /
   `OneShotExecutor`; `executeTurn(dev prompt)` created the file with exact content; **my JSON parser extracted the
   response cleanly and `tokenDetails {input:9843, output:113}`**. This is the exact path `llm-agent.mjs` uses.
3. **Full client build green** — `npm run build`: lint clean, wire-contract **v7 unchanged** (provider add doesn't
   touch the contract), **13/13 tests** (7 prior + 6 new goose).
4. **Live attach handshake** — `llm-agent.mjs --provider goose` against a live orchestrator (`PORT=3001`,
   `AGENTTALK_MCP_PORT=3011`): connected over WS, **passed the SHA-256 wire-contract handshake (no 1008)**, and
   blocked correctly on `await_turn` (server logged the tool call). No goose-specific transport issue.

**Not shown (honest):** a *delivered* turn processed by the attached goose worker. A plain `mcp` attach agent goes
`starting → ready` via `InProcessAgentDriver` **without** an auto-healthcheck, so nothing was enqueued. Both halves
(live transport; turn execution) are proven **separately**; their live conjunction needs real work enqueued.

## Why this spike
Codex is ruled out (PO) and agy is broken as a dev client (LB-92). That left **Claude as the only dev-capable
actor** → the multi-agent workflow's independence (implementer ≠ reviewer) collapses for real code work. Bare
**OpenRouter API agents can coordinate but cannot develop** (no filesystem/shell tools — see
`decision-api-agents-for-coordination.md`). The question: can a **CLI harness that wraps an arbitrary API model**
give us a *second dev-capable agent* without a bespoke build? PO's pick: **goose** (MCP-native, Block/OSS).

## Spike question & verdict
> *Can goose run headlessly, driven by an OpenRouter model, and perform real dev work (file/shell tools)?*

**VERDICT: GO — proven standalone.** Two probes, both exit 0:
1. **Provider wiring** — `goose run --no-session -q --provider openrouter --model openai/gpt-4o-mini -t "Reply with
   exactly one word: PONG"` → stdout `PONG`. Clean headless completion, no attach ritual, no PTY.
2. **Dev capability** — asked goose to create `hello.txt` with exact content. Goose used its **`write`** tool then
   **`shell`** (`ls -l`) to verify; file existed with exact content. **This is what a bare API agent cannot do.**

Env: `OPENROUTER_API_KEY` already set. Goose **1.41.0** via `brew install block-goose-cli` (`/usr/local/bin/goose`).

## The correct integration seam (KEY architectural finding)
The AgentTalk attach path is **NOT vanilla MCP**, so "goose as an MCP client" is the **wrong** seam: `llm-agent.mjs`
does a bespoke WebSocket + **SHA-256 wire-contract handshake** (v7; mismatch → `1008` reject) + a custom pull-loop
(`await_turn` → event envelope → run turn → `submit_exec_result`). Goose can't speak that.

**Right seam: goose as a new *executor* behind the existing worker** — the exact slot `claude`/`codex`/`gemini(agy)`
fill in `agentalk-mcp-client`. All transport/handshake/loop code is **reused untouched**; only "what runs the turn"
changes. Use the **one-shot** executor path (`OneShotExecutor` + `getProviderCommand`), **not** the persistent/PTY
path — **agy's `exec_rpc` hang lived in the persistent PTY dance; one-shot sidesteps that whole failure class.**

## Implementation spec (for the next session — ~3 small edits, all in `agentalk-mcp-client`)
1. **`lib/provider-runtime.mjs:2`** — add `'goose'` to `SUPPORTED_PROVIDERS`.
2. **`lib/provider-runtime.mjs` `getProviderCommand` (switch ~line 77)** — add:
   ```js
   case 'goose': {
     const args = ['run', '--no-session', '-q', '--output-format', 'json',
                   '--provider', 'openrouter',
                   '--model', selectedModel || 'openai/gpt-4o-mini',
                   '--max-turns', '30',
                   '-t', userMessage];
     return { command: 'goose', args, stdin: null };
   }
   ```
   (`goose` inherits `OPENROUTER_API_KEY` from env, like the other providers inherit their creds.)
3. **Output parsing** — use `--output-format json` and parse the final response field (do NOT scrape `-q` text:
   even in quiet mode goose prints tool-call chrome to stdout). Wire token counts through `extractTokenDetails`
   like the other providers. Confirm `resolveExecutionMode('goose')` defaults to **oneshot** (goose is absent from
   the persistent-provider list, so it should — verify `supportsPersistentExecution`).
4. **Wire contract** — adding a provider does **not** change the wire contract (tools/packets unchanged), so **no
   hash bump** needed. Confirm no test asserts the provider set byte-for-byte.

## Remaining work
- **Commit the working-tree changes** (PO call): `agentalk-mcp-client` `lib/provider-runtime.mjs` +
  `__tests__/goose-provider.test.mjs`. Suggest a `task-goose-executor` branch; do NOT merge to mainline unmerged.
- **Live delivered-turn** (the one unproven conjunction): enqueue real work so the attached goose worker processes
  a turn end-to-end. Cheapest paths: (a) a **team task** (`POST /api/teams/:id/task`) with goose as a participant,
  or (b) **two goose agents in a pair chat** (uses only goose — Codex/agy not needed). Reuse the
  `scratchpad/live-goose-attach.mjs` scaffold (starts orchestrator on 3001/3011, attaches the worker, tears down
  its own PIDs).
- **Do the delivered-turn gate with a STRONGER OpenRouter model**, not `gpt-4o-mini`: the consensus/coordination
  protocol needs precise JSON tool-call discipline; gpt-4o-mini is a weak coder/planner (validates plumbing, not
  quality). Running it through the full protocol now tests the model, not the integration.

## Caveats / open risks
- **Model quality:** `openai/gpt-4o-mini` proved the *plumbing*; it is a weak coder. Real AgentTalk dev work needs a
  strong OpenRouter coding model (higher cost — watch budget). The spike validates the *harness*, not code quality.
- **Independence restored:** once goose is a live dev actor, implementer ≠ reviewer holds again (goose implements,
  Claude reviews-by-running, or vice versa). This is the whole point.
- **Governance:** goose needs its own agent identity if it takes a workflow seat (key store / lessons / meter),
  same as any agent — a PO call, not part of this spike.

## Telemetry (spike closure)
- task: spike-goose-executor
- budget: claude weekly 68%→69% (Δ~1%), session window at 90% (near cap; 5h resets ~15:59 Rome) — stopped to bank.
- gate: standalone probes PASS (exit 0, evidence above); full-integration PoC NOT attempted (budget).
- outcome: **GO verdict banked; integration spec written for next session.**
