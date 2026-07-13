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
  - cmux browser WebSocket behavior was intermittent; backend WebSocket was used for exact `approve_each` and
    `start_pair_chat` setup, while cmux browser was still used for Continue/Stop user actions.
  - cmux browser `fill` changed the textarea DOM value but did not reliably update React state before Start; backend
    WebSocket start was used to preserve the exact test topic.
  - Claude CLI is not available from this environment as a real provider client until the cmux wrapper/PATH issue is
    corrected.
  - Gemini/agy timed out the product healthcheck during this run.
- replay notes:
  - For cmux autonomous tests, launch companion clients inside cmux terminal surfaces and use `cmux read-screen` to
    verify provider CLI startup before starting product flows.
  - Treat cmux browser as a strong low-token visual/action surface, but cross-check every product state transition
    against backend logs and `/api/conversations`.
  - If exact form state matters, verify React-observed state by the resulting backend event, not only by DOM value.
