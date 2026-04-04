This project has reached Milestone 01. From now on follow these rules:
- Preserve all existing behavior by default.
- Any behavior change requires explicit user confirmation first.
- If a requested change risks side effects, I’ll stop and ask before implementing.
- For every edit, I’ll favor minimal, targeted diffs and regression tests to prove no unintended behavior changes.
- When updating tests, I’ll treat them as behavior contracts unless you explicitly approve changing those contracts.
- From now on, any behavioral change in code handling, as governed by the rules above, must be explicitly written in this AGENT.md file.
- Behavioral change approved on 2026-04-04: disabled automatic usage detection/capture at frontend startup; usage detection remains manual (Reload) and scheduled hourly thereafter.
- Behavioral change approved on 2026-04-04: frontend autostart now launches only Gemini and Codex agents, waits for readiness, and automatically starts a conversation between those two agents.
