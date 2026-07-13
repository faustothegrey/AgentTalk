# Testlog

Durable index of validation runs performed by the Tester role. The testlog is for replayability: it records what was
tested, how evidence was gathered, where artifacts live, and what remains open. It does **not** replace `logbook.md`
for project decisions or reviewer ledgers for merge verification.

## Entry Template

```md
### TL-000 · YYYY-MM-DD · <short name>

- objective:
- role/driver:
- worktree/commit:
- strategy:
- evidence sources:
- real/fake path:
- environment:
- steps:
- artifacts:
- result:
- residuals:
- replay notes:
```

## Runs

### TL-001 · 2026-07-13 · BL-033 autonomous Tester instrumentation rehearsal

- objective: Re-run the BL-033 validation autonomously to validate Tester instrumentation, not to add new project
  evidence beyond the already closed BL-033 result.
- role/driver: Codex as Tester, autonomous validation explicitly requested by the PO.
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` at `c8b259c` plus the existing BL-031/BL-033 commits
  in local history.
- strategy: Browser Use for UI actions and visual checkpoints; real `agentalk-mcp-client` sessions for Codex and
  Claude; backend/client logs plus `/api/agents` and `/api/conversations` as ground truth.
- evidence sources:
  - Browser Use DOM text and screenshots at UI checkpoints.
  - Backend log for `start_pair_chat`, pending relay state changes, `conversation_end`, and disconnect handling.
  - Real client logs showing `Received turn: { type: 'conversation_end' }` and graceful shutdown.
  - API state for final agent statuses and conversation transcripts.
- real/fake path: Real Codex and Claude companion clients; no fake provider or mocked model path used.
- environment:
  - frontend: `http://localhost:5173/`
  - backend: `http://localhost:3000`
  - MCP attach URL: `ws://localhost:57527/`
  - browser harness: local `browser-use-codex` against dedicated Chrome profile/CDP port `9223`
- steps:
  - Browser Use opened the web UI, expanded/collapsed panels, switched to the Chat tab, and created agents through
    the UI.
  - Reply-limit path: created `auto-codex-a` and `auto-claude-a`, launched real clients, started a pair chat, observed
    a main-panel `PROPOSED TURN`, clicked **Continue** through the run, and reached reply-limit completion.
  - Stop path: created `auto-codex-stop` and `auto-claude-stop`, launched real clients, started a pair chat, observed
    a main-panel proposed turn, clicked **Stop**, and reached operator-stop completion.
- artifacts:
  - Browser screenshots: `/Users/fausto/.config/browser-harness/tmp/shot.png` was overwritten at checkpoints during
    the run; this run did not yet preserve per-test screenshot paths.
  - Recording: not available; future work should save passive `.webm` recordings under `design/test-artifacts/<test-id>/`.
  - Logs: terminal session output in the Codex transcript; no separate log bundle was persisted.
- result:
  - Reply-limit conversation `conversation-1783917861663`: completed, reply counts 5/5, both real clients received
    `conversation_end`, both agents ended `terminated`.
  - Stop conversation `conversation-1783918076598`: completed, reply counts 0/0, proposed turn was not delivered,
    both real clients received `conversation_end`, both agents ended `terminated`.
- residuals:
  - Sidebar/history content from older conversations can remain visible while the active main panel behavior is
    correct. This remains BL-031/UI cleanup, not BL-033 lifecycle.
  - Recording and artifact preservation are not yet automated.
- replay notes:
  - Declare the Tester strategy before the run: objective, evidence sources, unverified scope, and real-vs-fake path.
  - Keep `.webm` recordings passive by default: save the path, do not AI-analyze the video unless the PO asks for a
    specific visual review. Extract targeted screenshots/frames only when needed.
  - Keep command wrappers simple. During this run, two helper-script mistakes were harmless but noisy: parsing mixed
    text+JSON as JSON, and calling JavaScript `.slice` on a Python string returned by Browser Use.

### TL-002 · 2026-07-13 · BL-033 cmux autonomous Tester instrumentation rehearsal

- objective: Repeat the BL-033 validation with cmux browser/terminal instrumentation, primarily to validate the
  Tester instrumentation path and durable artifact capture.
- role/driver: Codex as Tester, autonomous validation explicitly requested by the PO.
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` after `6325012`.
- strategy: Use cmux browser for visual checkpoints and Continue/Stop clicks, cmux terminal surfaces for real
  `agentalk-mcp-client` sessions, backend logs and REST state as ground truth. Avoid fake providers.
- evidence sources:
  - cmux browser snapshots and screenshots.
  - cmux terminal `read-screen` output for companion client state.
  - Backend log for MCP attach, healthchecks, pending relay transitions, `conversation_end`, and termination.
  - `/api/agents` and `/api/conversations` snapshots for final state.
- real/fake path: No fake provider path used. Successful validation used two real Codex companion clients. Claude and
  Gemini were attempted first but were not usable from this environment during the run.
- environment:
  - frontend: `http://localhost:5173/`
  - backend: `http://localhost:3000`
  - MCP attach URL: `ws://localhost:63037/`
  - cmux browser surface: `surface:2`
  - cmux client terminal surfaces: `surface:3`, `surface:4`
- steps:
  - Opened the web UI in cmux browser and saved initial screenshots.
  - Attempted Codex+Claude with real clients; blocked because cmux `claude` resolved to a wrapper that tried to
    execute `/Users/fausto/Software/scripts/settings-ai/claude`, which is a directory, causing
    `Persistent claude session is not available`.
  - Attempted Codex+Gemini with real clients; blocked because Gemini did not answer the product healthcheck within
    30 seconds.
  - Reply-limit path: created `cmux-codex-d` and `cmux-codex-e`, launched two real Codex clients inside cmux,
    started `conversation-1783920543370`, clicked Continue from the cmux browser through all proposed turns, and
    reached reply-limit completion.
  - Stop path: created `cmux-codex-stop-a` and `cmux-codex-stop-b`, launched two real Codex clients inside cmux,
    started `conversation-1783920754144`, clicked Stop on the first proposed turn from the cmux browser, and reached
    operator-stop completion.
- artifacts:
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/01-initial.png`
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/02-agent-creation-open.png`
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/03-codex-codex-proposed.png`
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/04-codex-codex-completed.png`
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/05-codex-codex-stop-proposed.png`
  - `/Users/fausto/Software/AgentTalk/design/test-artifacts/TL-002-cmux/06-codex-codex-stop-completed.png`
  - Recording: not captured. `cmux browser` exposes screenshots but not native screencast/video recording in the
    current tool surface.
- result:
  - Reply-limit conversation `conversation-1783920543370`: completed, reply counts 5/5, transcript length 14, final
    system payload `All agents reached reply limit`, both agents ended `terminated`.
  - Stop conversation `conversation-1783920754144`: completed, reply counts 0/0, transcript length 4, final system
    payload `Conversation stopped by operator before delivering cmux-codex-stop-a's proposed turn to
    cmux-codex-stop-b.`, both agents ended `terminated`.
- residuals:
  - cmux browser initially failed to expose/render agent-creation controls until a tab switch/reload.
  - cmux browser WebSocket behavior appeared intermittent during the run; TL-003 later narrowed this to a misleading
    dev-console error from React StrictMode remount, not a general cmux WebSocket failure.
  - cmux browser `fill`/`check` shortcuts changed DOM values but did not reliably update React state before Start or
    before approval-mode changes; backend WebSocket start was used to preserve the exact test topic. TL-003 later
    confirmed that real click interactions do update the application state.
  - Claude CLI is not available from this environment as a real provider client until the cmux wrapper/PATH issue is
    corrected.
  - Gemini/agy timed out the product healthcheck during this run.
- replay notes:
  - For cmux autonomous tests, keep the UI surface visible. Launch companion clients as additional tabs/surfaces in
    the same pane when needed, return focus to the UI immediately, and close those extra surfaces during teardown.
  - Treat cmux browser as a strong low-token visual/action surface, but cross-check every product state transition
    against backend logs and `/api/conversations`.
  - If exact form state matters, verify React-observed state by the resulting backend event, not only by DOM value.

### TL-003 · 2026-07-13 · cmux browser WebSocket and React-control diagnostic

- objective: Explain why cmux browser showed `[WS] Error` in the console and why some UI controls appeared to change
  without changing product behavior.
- role/driver: Codex as Tester, diagnostic requested by the PO after TL-002.
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` at `9c40cd0`.
- strategy: Compare WebSocket behavior from Node, manual WebSocket probes inside cmux browser, and the app's own
  WebSocket lifecycle; then test React-controlled checkbox behavior with real click versus shortcut commands.
- evidence sources:
  - Node `ws` probes against `ws://localhost:3000/ws` and `ws://localhost:5173/ws`.
  - cmux browser manual `new WebSocket(...)` probes against the same URLs.
  - Temporary cmux `addinitscript` tracing `window.WebSocket` lifecycle events during page reload.
  - Backend log for `set_relay_approval_mode`.
- real/fake path: No fake provider path; this was instrumentation-only, not provider validation.
- environment:
  - frontend: `http://localhost:5173/`
  - backend: `http://localhost:3000`
  - cmux browser surface: started as `surface:2`, then replaced with clean `surface:6` after removing the temporary
    WebSocket instrumentation.
- steps:
  - Confirmed Node could open both backend and Vite-proxied WebSockets and receive `relay_approval_state`.
  - Confirmed cmux browser manual WebSockets could also open both URLs and receive `relay_approval_state`.
  - Added a temporary WebSocket lifecycle tracer and reloaded the app.
  - Observed Vite HMR socket open, then two app sockets to `/ws`: the first closed with `1006`, while the second
    opened and received `relay_approval_state`.
  - Clicked the approval-mode checkbox with a real browser click and observed backend `set_relay_approval_mode`.
- artifacts:
  - No durable screenshot/video artifact; evidence is textual command output in the session transcript.
- result:
  - The console `[WS] Error` is not sufficient evidence of a broken cmux WebSocket path. In dev, React StrictMode can
    create a first app socket that closes during remount while the second app socket opens and works.
  - Real browser clicks update React/application state. Direct shortcut commands such as `fill`/`check` can leave a
    misleading DOM value unless followed by proof that app state changed.
  - cmux autonomous test layout should use tabs/surfaces in the same pane for companion clients and keep the product
    UI as the visible surface; extra surfaces must be closed at teardown.
- residuals:
  - The app still logs the first StrictMode socket error to console in dev, which can mislead testers.
  - The optional Agent ID and textarea/topic shortcut behavior from TL-002 still need product-level UI cleanup if they
    reproduce under real clicks.
- replay notes:
  - Do not treat a dev-console WebSocket error as a blocker until a manual WebSocket probe and app-state event check
    both fail.
  - Prefer `click`/`type` for React controls in cmux browser. Use shortcut commands only for low-risk text inspection
    or after validating the resulting app event.
  - `cmux tab-action --action select` did not work for returning focus to the UI surface. Use
    `cmux move-surface --surface <ui-surface> --pane <pane> --focus true`, then verify with `cmux tree --all`.
  - After temporary browser instrumentation such as `addinitscript`, replace or reset the browser surface before the
    next validation run.

### TL-004 · 2026-07-13 · Claude autonomous Tester rehearsal (first Claude-in-Chrome run)

- objective: Re-run the existing testlog validations (Continue/reply-limit + Stop, i.e. BL-031 supervised control +
  BL-033 lifecycle) autonomously as **Claude**, to validate Claude's Tester instrumentation via the Claude-in-Chrome
  toolkit. Nothing new — BL-031/033 are closed; no new project evidence claimed.
- role/driver: Claude as Tester, autonomous, explicitly requested by the PO ("testing your capability of testing").
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` at `1fbac5e` (the merged BL-031 supervised-control +
  BL-033 lifecycle code).
- strategy: **Claude-in-Chrome** (`mcp__claude-in-chrome__*`) for UI observation, real clicks, and screenshots; two
  real `agentalk-mcp-client` **codex** clients per run; backend log + `/api/agents` + `/api/conversations` as ground
  truth. Agents created via API and pair chat started via the browser WS `start_pair_chat` (documented topic-control
  technique, TL-002 precedent) so the browser-driving focused on the Continue/Stop supervised flow.
- evidence sources: Claude-in-Chrome screenshots at state transitions; backend log (healthcheck acks, pending-relay
  `pending`/`approved_delivered`/`denied`, `conversation_end`, `-> terminated`); REST `/api/*` for final state.
- real/fake path: **Real codex companion clients (×2 per run); no fake provider or mocked model.**
- environment: frontend `http://localhost:5173`, backend `http://localhost:3000`, MCP `ws://localhost:55434/`,
  Claude-in-Chrome tab `869995326`.
- steps:
  - Verified the Chrome extension was connected (`tabs_context_mcp`); stood up backend + UI; created agents via API.
  - Toggled **Conversation control → Approve each** with a real click; **verified via backend**
    (`set_relay_approval_mode approve_each`) — LB-89 real-click-updates-state discipline held.
  - Continue path (`conversation-1783924052564`, `tl004-a`/`tl004-b`, maxReplies 2): started via WS, then clicked
    **Continue** on each of the 4 proposed turns in the UI, confirming each `pending -> approved_delivered` in backend.
  - Stop path (`conversation-1783924396706`, `tl004-stop-a`/`tl004-stop-b`): started via WS, clicked **Stop** on the
    first proposed turn.
- artifacts: 3 screenshots saved to disk at transitions (proposed turn, growing timeline, stop-proposed) — default
  path, not yet per-test (same gap as TL-001); backend log in the session scratchpad.
- result:
  - **Continue** `conversation-1783924052564`: completed, replies **2/2**, 4 turns delivered via UI Continue, real
    codex agents converged on "coverage (= behavior coverage) + one golden end-to-end test"; `conversation_end` sent
    to both, both agents `terminated` (`/api/agents`), no stale `busy` — **BL-033 lifecycle confirmed**.
  - **Stop** `conversation-1783924396706`: completed, replies **0/0**; the proposed turn was **denied and NOT
    delivered** (`approved_delivered` count = 0), `conversation_end` reason *"stopped by operator before delivering …
    proposed turn"* sent to both, both agents `terminated` — **BL-031 Stop semantics + BL-033 lifecycle confirmed**.
- residuals:
  - When the first (reply-limit) conversation ended, the *new* Stop-path proposed turn surfaced in the **sidebar**
    Conversation-control panel while the main window stayed on the ended conversation (did not auto-switch). This is
    the known BL-031 sidebar/history residual (TL-002), reproduced with the Claude toolkit — still BL-031/UI cleanup.
  - Agent creation was via API for determinism, not the UI form; a future run should exercise the UI creation form.
  - Screenshot artifacts still land at a default path (not `design/test-artifacts/TL-004/`) — BL-035 covers this.
- replay notes:
  - **Claude's tester surface is Claude-in-Chrome, not cmux/browser-use.** Load the deferred tools first
    (`ToolSearch select:...tabs_context_mcp,navigate,computer,read_page,...`); create a new tab; check
    `tabs_context_mcp` before acting; the extension can drop on Chrome auto-update.
  - `ws://localhost:3000/ws` `start_pair_chat` is the reliable topic-controlled start when native `<select>`
    automation is unreliable (TL-002 precedent held for Claude too).
  - The inline Continue/Stop card auto-scrolls to the viewport bottom; the button y shifts as the timeline grows —
    screenshot before each click. Real clicks were confirmed against the resulting backend event every time (LB-89).

### TL-005 · 2026-07-13 · Arbiter/scrum-master consensus scenario — feasibility-blocked (findings, no run)

- objective: PO scenario — two agents look at AgentTalk and agree on one file to refactor, with a third **arbiter**
  that (1) assesses each reply's soundness and (2) declares agreement. Assess against the running product; run if
  feasible.
- role/driver: Claude as Tester, autonomous, PO-requested.
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` at `44e3f8d`.
- strategy: declare-first, then **ground-truth feasibility before running** (the discipline paid off). Attempted the
  reachable `'protocol'` planner-planner-worker consensus via API-driven agents (`Autostart G+C` shape, replicated over
  the API).
- evidence sources: source trace (`registry.ts`, `arbiter-coordinator.ts`, `server.ts`, `api-client.ts`); backend log
  (agent exec errors); `/api/agents`, `/api/teams`.
- real/fake path: **real** API keys (OPENROUTER/GEMINI/OPENAI set); API-driven `ApiCompleter` agents, no fakes.
- environment: backend `http://localhost:3000`, MCP `ws://localhost:56747/`; API-only (no browser needed).
- steps:
  - Traced the arbiter path → found `consensusMode` hardcoded to `'protocol'` by the product (arbiter orphaned).
  - Created 3 `api` agents + a planner-planner-worker team (protocol mode) and assigned a "agree on one file to
    refactor" task with a real file list (API agents have no file tools).
  - Round 1 (`openai/gpt-4o-mini`): **404** — `providerName` ignored → defaulted to `google`, which can't serve an
    OpenAI model.
  - Round 2 (`gemini-2.5-flash`): **400** — *"Forced function calling (ANY mode) with response mime type
    application/json is unsupported"* — the consensus tool schema is incompatible with Google's endpoint.
- artifacts: backend log in scratchpad; no UI/screenshots (API-only run).
- result: **BLOCKED (no successful consensus run).** Three product walls (full detail in **LB-91**): (1) arbiter
  unreachable; (2) `POST /api/agents` ignores `providerName` → API agents locked to `google`; (3) `google` 400s on the
  protocol tool schema. **API-driven multi-agent consensus is non-functional via the product.** The PO chose to log
  and stop rather than run the CLI-attached alternative.
- residuals:
  - The **CLI-attached** planner-planner-worker path (`McpCompleter`, M06-verified) was **not tested** — it's the only
    working path and is more faithful (CLI agents can actually read the code). Candidate for a future run (A″).
  - Work items → **BL-037**; the per-reply-soundness arbiter is the "Conductor/SM agent" (architect).
- replay notes:
  - **Ground-truth feasibility before spending provider budget.** Two doomed runs (404, 400) were still cheap because
    the task failed on the first exec; but the source trace *predicted* the arbiter wall before any spend — that's the
    highest-value tester move here.
  - To create a non-google API agent you currently must bypass `POST /api/agents` (it drops `providerName`) — so the
    API-driven path is effectively google-only until BL-037.

### TL-006 · 2026-07-13 · TL-001 with real agy/Gemini agents — healthcheck still times out (TL-002 residual NOT resolved)

- objective: re-run TL-001 (Continue + Stop) with **real agy/Gemini clients** to verify the TL-002 Gemini
  healthcheck-timeout residual is resolved (PO reported it "should have been resolved by codex").
- role/driver: Claude as Tester, autonomous, PO-requested.
- worktree/commit: `/Users/fausto/Software/AgentTalk`, `master` at `aa315ac`.
- strategy: **isolated backend on `PORT=3001`** (agy already occupied the default `:3000/:5173` with 6 agents + an
  active conversation — two live test instances can't share fixed ports). Real agy clients attached to the isolated
  MCP port; pair chat started via WS; **no browser** (the objective is the healthcheck, which is backend-log-observable).
- evidence sources: isolated backend log; agy client log; `/api`.
- real/fake path: **real agy/gemini clients ×2** (`--provider gemini`), no fakes.
- environment: backend `http://localhost:3001`, MCP `ws://localhost:64501/`.
- steps: created 2 gemini agents, launched 2 real agy clients (both attached fine), set `approve_each`, started a pair
  chat → the startup healthcheck ran.
- result: **FAILED at the healthcheck.** `Agent tl006-a did not respond to healthcheck within 30000ms`. **TL-002
  residual is NOT resolved.**
- diagnosis (grounded):
  - The backend sends `EVT {type:'healthcheck', token, prompt}` (backend log line 76), but the **client receives it as
    `{type:'exec_rpc', prompt:'…respond with a healthcheck_ack JSON…', timeoutMs:30000}`** (agy client log). So agy's
    original observation — *the healthcheck is transformed into an `exec_rpc`* — is **factually correct** (the BL-032
    bridge: `InProcessAgentDriver` + `McpCompleter` deliver it via the exec queue, the only channel an attached client
    drains). It is **by design, not an McpCompleter bug** (verified working with codex in TL-004).
  - The gemini client **received the exec_rpc but never produced the `healthcheck_ack`** — its process stayed **alive
    and still generating well past 30s**. So the failure is the **agy/gemini CLI not completing a full generation turn
    within (or near) the 30s window** (cold-start + first-turn latency, or a hang) — not the transform. Codex, being
    faster, acks fine.
  - Note: even the client's dedicated `handleHealthcheck` path (`llm-agent.mjs:138`) runs a **full executor turn**, so
    the timeout would persist there too — the root cause is that a healthcheck requires a full provider-CLI generation,
    which agy is too slow for.
- residuals:
  - **agy's `:3000/:5173` instance went down during my teardown.** I used broad `pkill` patterns (`PORT=3001` etc.);
    per identify-before-reap I **cannot fully rule out that I contributed** (or agy yielded). launchd (4034) intact.
    **Lesson re-applied: teardown with targeted PIDs, never broad `pkill`.**
  - **Parallel-testing port collision:** two testers can't share the fixed `:3000/:5173`. Running an isolated backend
    on `PORT=3001` is the clean workaround (backend honors `PORT`); the frontend proxy would also need repointing for a
    second UI. Relates to BL-036 (extend to test-infra isolation).
  - The gemini healthcheck timeout → **BL-038**.
- replay notes:
  - **Isolate parallel test instances via `PORT=<n>`** (backend) — no port collision.
  - The healthcheck delivered to an attached agent is an `exec_rpc` requiring a full CLI generation; slow CLIs (agy)
    blow the 30s budget. To validate a gemini run you must first get past this.

### TL-007 · 2026-07-13 · TL-001 on a real instance with two OpenRouter API agents — BOTH paths PASS

- objective: run TL-001 (Continue/reply-limit + Stop) on a **real AgentTalk instance** with **two OpenRouter
  (`gpt-4o-mini`) API agents** — validating the coordination direction (decision-api-agents-for-coordination.md) now
  that BL-039 unblocks non-google API agents.
- role/driver: Claude as Tester, autonomous, PO-requested.
- worktree/commit: instance run from branch `task-BL-039` (`313d089`, the providerName fix); default ports `:3000/:5173`.
- strategy: create the 2 API agents via the **API** (the UI has no `providerName` field — BL-039 is API-level);
  browser-driven Continue/Stop via Claude-in-Chrome; WS `start_pair_chat`; backend log + `/api` as ground truth.
- real/fake path: **real OpenRouter `gpt-4o-mini` API agents ×2**, no fakes. No MCP clients / no attach.
- environment: backend `http://localhost:3000`, frontend `http://localhost:5173`, Claude-in-Chrome tab.
- steps: created 2 openrouter agents (create response echoed `providerName: openrouter` — BL-039 working); toggled
  Conversation control → Approve each (backend-confirmed); started a pair chat; drove Continue (UI click) + auto-approved
  the remainder to reply-limit; then a **fresh** pair chat + **Stop** (UI click).
- result: **BOTH paths PASS.**
  - **Healthcheck via OpenRouter acks fast** ("Hello! I am responsive.") — no agy-style hang, no attach ritual.
  - **Continue/reply-limit:** completed **2/2**, `conversation_end` "All agents reached reply limit."
  - **Stop:** the proposed turn was **denied, delivered-count 0** (not delivered), `conversation_end` "stopped by
    operator…", conversation completed **0/0**.
- findings:
  - **OpenRouter API agents are excellent for the coordination layer** — reliable, fast, zero attach fragility. The
    decision is validated end-to-end.
  - **⚠️ API agents are NOT cleanly reusable across conversations → BL-040.** The `InProcessAgentDriver` calls
    `this.stop()` at `conversation_end` (the BL-033 lifecycle). For a CLI client that's fine (the client terminates
    too); for an **API agent there's no client**, so the agent shows `ready` but its **driver is stopped** — a second
    conversation's healthcheck is never processed → 30s timeout. **Fresh agents each conversation work; reuse doesn't.**
    (My in-run "stay ready/reusable" note was wrong — the *status* is ready, the *driver* is dead.)
  - **API-agent lifecycle at conversation_end:** `busy → ready` (NOT `terminated` like CLI clients).
  - **Residual reproduced:** BL-031 sidebar/history — the main window stayed on the completed conversation, so the
    Stop-path proposed turn surfaced in the sidebar (same as TL-004/TL-006).
  - **Cosmetic:** API agents' proposed turns render as raw protocol JSON (they emit the structured protocol payload).
- replay notes:
  - Create openrouter API agents via the API with `providerName: 'openrouter'` (BL-039); the UI form can't yet.
  - **Use fresh agents per conversation** until BL-040 (API-agent driver reuse) is fixed.
  - WS `start_pair_chat` + UI Continue/Stop is the reliable pattern (same as TL-004); Chrome extension was up.

### TL-008 · 2026-07-13 · TL-001 (Continue + Stop) with TWO goose agents (OpenRouter) — BOTH paths PASS

- objective: run TL-001 (supervised pair chat: Continue/reply-limit + Stop) with **two goose agents** — the first
  end-to-end exercise of the new goose executor (branch `task-goose-executor` in `agentalk-mcp-client`) through the
  full attach + supervised-relay stack. Proves the "delivered turn" conjunction left open by the goose spike.
- role/driver: Claude, autonomous (resource fallback: planner+implementer+reviewer+tester; PO "do or die"). Fully
  **scripted** via the runtime WS `/ws` + MCP attach — no human UI driver, no Chrome.
- worktree/commit: `/Users/fausto/Software/AgentTalk` `master` at `63e7f86`; orchestrator **rebuilt** (`tsc -b`,
  `dist/server.js` current with `src/server.ts`) so the test ran against live code, not a stale artifact.
- strategy: isolated instance (`PORT=3001`, `AGENTTALK_MCP_PORT=3011`) — no clash with any PO instance (none on
  :3000). Two `provider:'mcp'` agents per path + two `llm-agent.mjs --provider goose --model openai/gpt-4o-mini`
  workers. A runtime `/ws` client set `approve_each`, drove `start_pair_chat` (maxReplies 3), auto-approved every
  `pending_relay_updated` (Continue) or denied the first (Stop). Harness:
  `scratchpad/tl008-goose-pairchat.mjs`.
- evidence sources: backend server log (relay lifecycle, `send_to_agent`, `conversation_end`), `/api/conversations`
  status, `/api/agents` final states, worker stdout (`Received turn` / `Waiting for turn`).
- real/fake path: **real goose executors** driven by real OpenRouter `gpt-4o-mini`; no mocks. Model is a weak coder
  by design (validates the substrate + relay mechanism, not agent-reply quality).
- result: **BOTH paths PASS.**
  - **Continue/reply-limit** (`conversation-1783953449973`): **completed**; 6 relays alternating a↔b all approved,
    reached the reply limit; both agents ended `terminated` on `conversation_end` (correct BL-033 lifecycle).
  - **Stop** (`conversation-1783953473349`): goose-a proposed a turn (`submit_exec_result` → `send_to_agent` →
    pending relay); operator **`deny_pending_relay`** → conversation **completed/stopped**, `conversation_end`
    reason "stopped by operator before delivering tl008-stop-a's proposed turn" — **turn NOT delivered**. Matches
    TL-001/TL-007 exactly.
- findings:
  - **Goose is a viable coordination agent through the full supervised-relay protocol**, not just a dev executor:
    it attached, passed the healthcheck (no agy-style timeout — one-shot executor, fresh `goose run` per turn),
    conversed turn-by-turn, and honored reply-limit + operator-stop. **TL-006 failed here with agy; goose passes.**
  - Turn latency was low (~2–3s/turn) — gpt-4o-mini + short prompts; no persistent-PTY fragility.
  - Parity: goose now matches the TL-007 OpenRouter-API result for TL-001, but as a **dev-capable** attach worker
    (API agents can't develop; goose can). This is the second dev-capable, vendor-neutral agent path working live.
- residuals:
  - **Transcript content not captured** this run (only the relay/lifecycle flow). The mechanism is what TL-001
    validates, but next run should persist each agent's reply text for content review.
  - Stop-path agents read `ready` in the final snapshot (taken ~0.5s post-stop) rather than `terminated`; the
    `conversation_end` was sent to both (log) — cosmetic timing of the snapshot vs the worker's 5s shutdown, not a
    lifecycle miss.
- replay notes:
  - Rebuild the orchestrator (`npm run build --workspace @agenttalk/orchestrator`) before an isolated-instance run;
    `dist/index.js` mtime can lag while `server.js` is current (incremental `tsc -b`).
  - Node 24 global `WebSocket` (WHATWG: `addEventListener`/`ev.data`) works for the `/ws` driver — no `ws` dep.
  - Goose workers self-terminate on `conversation_end`, so use **fresh agents+workers per path** (as TL-001 does).
  - Teardown via tracked child PIDs (SIGTERM) + targeted port-PID sweep; never broad `pkill`.

### TL-009 · 2026-07-13 · planner-planner-worker CONSENSUS with THREE goose agents on gpt-4o — PARTIAL (protocol engaged, stalled at phase advancement)

- objective: run the **consensus/arbiter scenario (TL-005 shape)** — the M06 planner-planner-worker `'protocol'`
  consensus — with **goose agents on a stronger model (`openai/gpt-4o`)**, capturing transcripts to also answer the
  TL-008 reply-quality question. Goose uses the **CLI-attach path** that TL-005 flagged as "the only working path,
  untested" (its three walls were all API-path-specific: providerName-drop [now BL-039-fixed], google 400, arbiter
  orphaned).
- role/driver: Claude, autonomous (resource fallback; PO "do both"). Scripted via REST teams API + runtime `/ws`;
  full event recording via `AGENTTALK_RECORDING_PATH`. Harness: `scratchpad/tl009-goose-consensus.mjs`.
- worktree/commit: `/Users/fausto/Software/AgentTalk` `master` at `508f405`; orchestrator rebuilt from current src.
- feasibility-first (TL-005 lesson): probed models before spend — `anthropic/claude-3.5-sonnet(-*)` and
  `google/gemini-2.0-flash-001` both **404 on this OpenRouter account**; **`openai/gpt-4o` works** (used it).
- environment: isolated `PORT=3001` / MCP `3011`; 3 `provider:'mcp'` agents (2 planners + 1 worker) each with an
  attached `llm-agent.mjs --provider goose --model openai/gpt-4o` worker; team `maxRepliesPerAgent=2`.
- real/fake path: **real goose executors on real gpt-4o**; no mocks. Task: agree on one concrete improvement to a
  generic multi-agent system (conceptual, to isolate the protocol state-machine from file-tool availability).
- result: **PARTIAL — NO_CONSENSUS; planning interrupted at phase advancement.** But goose got **further than any
  prior consensus attempt** in this log:
  - **Goose DID speak the protocol:** planners emitted real `submit_exec_result` → `consensus_respond` tool calls
    with structured payloads (`proposal`, `expected_response_types:['opinion','agreement_proposal']`) — the worker
    maps goose output onto the consensus tools correctly. **Reply content (gpt-4o) was coherent and on-topic** (e.g.
    planner-b: "Improving resource allocation dynamically based on agent performance metrics is a promising
    direction… let's discuss potential methods for implementing adaptive resource management.").
  - **Where it stalled:** planners stayed in the **`opinion`** phase and never emitted **`agreement_proposal`**
    despite orchestrator reminders ("Reminder (2/2): please call agreement_proposal now"). → "Planning interrupted
    because required event(s) were not received: agreement_proposal." Worker received **0 turns** (correct — no
    plan). Both planners force-terminated.
- findings:
  - **Two structural mismatches, NOT a plumbing bug** (both survive the stronger model, so they're not just
    capability):
    1. **Phase-advancement discipline.** Goose reliably produces an *opinion* but doesn't switch `message_type` to
       `agreement_proposal`/`agreement_acceptance`/`submit_plan` on demand. Goose's agentic wrapper (tool-use,
       todos) dilutes the "emit exactly this next protocol message" instruction. gpt-4o improved *content*, not
       *transition compliance*.
    2. **Turn-latency budget.** `[TeamCoordinator] Forced shutdown for agent … after 60000ms` — goose's per-turn
       wall-clock (its multi-step loop, `--max-turns 30`, + gpt-4o latency) can exceed the orchestrator's **60s
       planning-turn budget**. A coordination turn shouldn't need goose's tool loop at all.
  - **Capability map is now clear:** goose ✅ dev/implementation turns (spike) · ✅ simple supervised relay / pair
    chat (TL-008) · ⚠️ strict multi-phase consensus state-machine (TL-009). This *confirms* the coordination-vs-dev
    split in `decision-api-agents-for-coordination.md` and extends it: goose planners *can* engage (unlike the
    API-blocked TL-005) but don't *complete* the protocol.
- residuals / follow-ups (candidate backlog):
  - For goose-as-planner: (a) a goose **coordination profile** — `--max-turns 3`, no dev tools, a `--system` prompt
    that forces a single structured protocol message; (b) raise/relax the 60s planning-turn budget for slower
    attach workers; (c) accept goose for *implementation* turns and keep strict consensus on a different agent type.
  - Transcript capture worked (server log + recording); the `/ws` phase-event filter caught little — read the
    backend log for protocol detail.
- replay notes:
  - Probe every non-default OpenRouter model id with a one-word `goose run` before a full run — this account 404s on
    several anthropic/google ids.
  - Consensus team = exactly **2 planners + 1 worker**, `POST /api/teams {members:[{agentId,role}]}` then
    `POST /api/teams/:id/task {description, maxRepliesPerAgent}`; a completed plan needs `.../tasks/:id/confirm`.
  - The 60s force-shutdown is the ceiling to watch for any slow attach worker in planning.

### TL-010 · 2026-07-13 · goose consensus with a COORDINATION PROFILE (--max-turns 3 + --no-profile + --system) — latency fixed, consensus still fails (schema + runaway loop)

- objective: retest TL-009 consensus with a goose **coordination profile** targeting TL-009's two failures —
  `--max-turns 3` + `--no-profile` (drop dev tools) + a `--system` prompt forcing a single structured protocol
  message AND phase advancement. Does taming goose's wrapper let it complete consensus?
- role/driver: Claude, autonomous (PO-directed hypothesis). Same harness as TL-009 with the coordination env set:
  `scratchpad/tl010-goose-consensus-coord.mjs`. Model `openai/gpt-4o`, 3 goose agents (2 planner + 1 worker).
- enabling change (committed, branch `task-goose-executor`): `getProviderCommand('goose')` now reads
  `AGENTTALK_GOOSE_MAX_TURNS` / `AGENTTALK_GOOSE_NO_PROFILE` / `AGENTTALK_GOOSE_SYSTEM` (defaults unchanged → TL-008
  behavior preserved). Client build green: lint + contract v7 + **16/16 tests** (+3 profile tests). Pre-run probe
  confirmed the profile emits a clean single JSON message: `{"message_type":"opinion","text":"…"}`.
- result: **NO_CONSENSUS — but a different, more precise failure than TL-009.**
  - **The profile FIXED what it targeted (latency):** no `Forced shutdown … after 60000ms` this run — turns are fast
    (no tool loop). That half of the hypothesis worked.
  - **Consensus still fails on a DEEPER blocker: protocol-schema conformance + an ack handshake.** The orchestrator
    repeatedly returned `ack_planning_protocol` ("Acknowledge planning protocol before discussing task content") and
    **"Please resubmit your intended response as valid JSON."** Goose emitted `{"message_type":"opinion","text":…}`
    but the protocol wants a richer envelope — a **`message_payload`** with per-type fields (e.g. `fact_collection_end`
    → `{summary}`, `work_accept` → `{text}`). Goose never cleared the acknowledgment gate, so it never really
    entered opinion→agreement.
  - **New risk exposed — unbounded resubmit loop:** because turns are now fast, instead of a 60s shutdown goose span
    a tight reject→resubmit loop — **planner-a took 120 turns** (planner-b 12) on gpt-4o. `maxRepliesPerAgent=2` did
    NOT cap it (an ack/resubmit isn't counted as a reply). A malformed agent can spin the planning loop and rack up
    provider cost.
- findings:
  - **Two targeted rounds (TL-009 stronger model, TL-010 coordination profile) both fail to reach consensus.** The
    capability boundary is now firm: goose ✅ dev turns · ✅ simple supervised relay/pair chat (TL-008) · ❌ strict
    multi-phase consensus protocol. The profile shifted the failure from *latency/phase-stall* to
    *schema-conformance/runaway-loop* — progress in understanding, not a pass.
  - **Root cause:** the consensus protocol expects an exact JSON contract (`message_payload` schemas per
    message_type + an `ack_planning_protocol` handshake) delivered in the turn briefing. A general agentic wrapper
    (goose) doesn't reproduce it reliably even when guided; making it work would require embedding the **full**
    protocol schema in the `--system` prompt (≈ replicating the contract) — the protocol is built for agents that
    follow the in-turn briefing precisely (the M06 CLI agents).
- residuals / follow-ups (candidate backlog):
  - **BL (new): cap the planning reject/resubmit loop** — an agent emitting malformed protocol JSON should hit a
    bounded retry, not spin (120 gpt-4o calls here). Product robustness + provider-cost safety.
  - If goose-as-planner is still wanted: author a **full protocol recipe** (`--system` embedding every
    `message_type`'s `message_payload` schema + the ack handshake), or a goose `--recipe`. Otherwise the clean call:
    **goose for implementation + pair chat; keep strict consensus on the M06 CLI-agent path.**
  - The env-driven coordination profile itself is a keeper — it fixed latency and is the right knob for future
    coordination-turn tuning.
- replay notes:
  - Watch worker "turns received": a healthy planner is single digits; **120 = runaway** (schema-reject loop).
  - The coordination profile lives in `provider-runtime.mjs` via 3 env vars; set them per-agent, not globally, so
    dev agents keep tools + `--max-turns 30`.
