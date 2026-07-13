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
