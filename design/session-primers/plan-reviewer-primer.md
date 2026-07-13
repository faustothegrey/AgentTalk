---
role: plan-reviewer
key: 20260713-2130-f8c1a4
written: 2026-07-13 (evening) by Claude — session close after the OpenRouter-for-coordination arc + BL-039 fix
---

This is your session primer.

**Project (1–2 lines).** AgentTalk orchestrates several *real* heterogeneous LLM agents as one software-development
team that plans/builds/reviews/merges code through a deterministic, auditable MCP substrate, under a human Product
Owner (Fausto) who holds scope + merges. Aim: **self-hosting** — the team improves its own codebase; success = the
PO's manual coordination burden falls measurably.

**Roles.** Human = PO (apex; scope/direction/merges/relay). Agents: planner, three reviewer seats (plan / implementation
/ task-end; independence: no self-review), implementer, architect, **Tester** (agent helper to a human driver; default
Codex; validation-not-verification, findings-not-verdicts). Bindings live **only** in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS`. **This primer is for plan-reviewer (gate 1); you [Claude] also hold task-end-reviewer, architect,
delegated SM — and this session served as Tester + temp Implementer heavily.** Do the First Entry Point handshake,
verify this brief against the repo, report, and **STOP** for the PO's go.

**Workflow / source of truth.** `design/collaboration-workflow.md` + the artifacts: `*-plan.md`/`*-implementation.md`,
`design/backlog.md`, `design/logbook.md` (LB-N), **`design/testlog.md` (TL-N — the Tester's record)**,
`design/lessons/claude-lessons.md` (skim at start). Verify-don't-assert; ground every claim in git/code.

**Where we are (REQUIRED — verify against git; `master` at `942d670`, pushed).** Program is BETWEEN EPICS; the day's
work has been **testing + adoption + a strategic pivot**, not a new build epic:
- **BL-031/BL-032/BL-033 all merged** (inline relay approval + supervised Continue/Stop + attach lifecycle).
- **agy/Gemini PARKED as an MCP attach client** (LB-92, BL-038 deferred): it **hangs** on the startup healthcheck
  `exec_rpc` — no ack even at 90s; the provider-timeout fix was **gate-2 REFUTED** (raising the timeout can't fix a
  hang). Refuted code preserved on `wip/BL-038-provider-timeouts` (local). Do NOT route attach tests through agy.
- **DECISION — OpenRouter API agents for the coordination layer, MCP clients for implementation**
  (`design/decision-api-agents-for-coordination.md`): API agents *coordinate* but can't *develop* (no file tools);
  reversible per-agent config. **Validated end-to-end in TL-007** — TL-001 (Continue + Stop) both paths PASS with real
  openrouter `gpt-4o-mini` agents; fast healthcheck acks, no attach fragility.

**⚠️ Open work in flight (don't lose):**
- **BL-039 (`POST /api/agents` forwards `providerName`) — the OpenRouter enabler — is DONE + live-validated but at
  GATE 2.** On branch `task-BL-039` (`313d089`, pushed to origin). **Claude implemented it → routed to Codex for
  gate-2** (independence). Not merged. When VERIFIED, task-end + merge are the PO's call.
- **BL-040 (new)** — API agents aren't reusable across conversations: the `InProcessAgentDriver` stops at
  `conversation_end`, so a reused API agent's healthcheck times out (status shows `ready`, driver is dead). Workaround:
  fresh agents per conversation. Fix: driver lifecycle for `provider === 'api'`.
- **BL-037** — API-driven consensus non-functional via product (arbiter orphaned; google tool-schema 400); `#2`
  promoted to BL-039 (done). Backlog: 40 items, 0 warnings.

**Op notes / gotchas.**
- **Budgets TIGHT at close:** Claude weekly **68%** (resets Jul 15 ~9am Rome), codex **86%**, antigravity **83%**.
  Scope the next session's spend accordingly.
- **Parallel testing is now allowed (LB-90)** — only *code development* stays serial (pending BL-036 worktree
  discipline). Two live instances can't share `:3000/:5173`: run an isolated one via **`PORT=3001 npm run backend`**.
- **Teardown with TARGETED PIDs, never broad `pkill`** (agy's instance went down under a broad pkill this session).
  Do NOT reap `com.fausto.agenttalk-orchestrator` (PO launchd service, ppid 1).
- **Create OpenRouter agents via API** (`{provider:'api', providerName:'openrouter', model:'openai/gpt-4o-mini'}`) — the
  UI form has no `providerName` field yet. `OPENROUTER_API_KEY` is set. Chrome extension (`mcp__claude-in-chrome__*`)
  is Claude's Tester surface; it drops on Chrome auto-update.
