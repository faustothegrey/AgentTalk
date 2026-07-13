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
