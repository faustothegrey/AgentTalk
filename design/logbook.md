# Logbook — cross-cutting findings

**Purpose (workflow §3d):** an **append-only, dated** log of durable **findings / gotchas** that are
**not tied to a single task** — facts about the environment, providers, or the system's *actual*
behaviour that future work needs to know.

**What goes here vs elsewhere (one finding, one home):**
- **Here:** an orphan, cross-cutting *fact* we discovered (true regardless of any task).
- **An epic's `implementation.md` log:** a finding tied to that open task → stays there.
- **`backlog.md`:** *work to do* (not facts).
- **`plan.md`:** *decisions + rationale* (not findings).

**Discipline:** append-only — never rewrite; mark an entry **SUPERSEDED** (with a pointer) instead of
deleting (git is the backstop). **Teeth:** skim the relevant entries *before* starting related work,
and as part of the **backlog gate** (workflow §3b).

**Entry format:** `### LB-N · YYYY-MM-DD — [area] title` then *finding · implication · source*. Each
entry carries a **stable `LB-N` id** — cite it from ledgers/backlog (titles may be reworded; ids don't).

---

### LB-1 · 2026-06-20 — [providers] The "Nous" endpoint is a multi-vendor aggregator
- **Finding:** `inference-api.nousresearch.com/v1` (key `HERMES_API_KEY`) exposes an **aggregator
  catalog** (e.g. `anthropic/claude-*`, `google/gemini-*`, `qwen/*`, `x-ai/grok-*`), not a single
  Hermes model. `deepseek-v4-flash` **does not exist there → HTTP 404**. Structured-output is **GREEN
  3/3** with a valid id like `google/gemini-3.1-flash-lite`.
- **Implication:** pick a real catalog id; **`api-client.ts` `nous` `defaultModel: 'deepseek-v4-flash'`
  is a latent bug** (the M07 R-1 id was wrong). Fix when promoting the cross-provider backlog item.
- **Source:** `spikes/m07-api-structured-probe.mjs`; commit `dde52ba`.

### LB-2 · 2026-06-20 — [providers] OpenRouter `:free` tier is not viable for multi-turn protocols
- **Finding:** `gpt-oss-120b:free` returned an **empty turn** (2/3); `qwen3-next-80b:free` hit an
  **immediate 429 "rate-limited upstream"** (3/3 error). Free models are throttled/flaky per request.
- **Implication:** the cross-provider pilot should pair **Google + Nous**, not OpenRouter-free;
  OpenRouter needs **paid credit** to be usable in a consensus loop.
- **Source:** `spikes/m07-api-structured-probe.mjs`; commit `dde52ba`.

### LB-3 · 2026-06-20 — [orchestrator] Terminal-action dedup is keyed on `currentTurnId` (WS-only)
- **Finding:** `registry.ts` `isDuplicateTerminalAction` keys on `agent.currentTurnId`, which is set
  **only** by the WebSocket `await_turn` MCP handler. The **in-process driver calls `agent.awaitTurn()`
  directly and never sets it**, so in-process agents are **never deduped**.
- **Implication:** (a) explains why **R-T2b was a non-issue** — the worker's two terminal calls
  (`submit_work_response` + `submit_work_result`) both land in one turn; (b) **latent gotcha** — the
  in-process path has *no* dedup protection if a turn ever double-fires. Revisit if T3/T4 add retries.
- **Source:** review of `registry.ts` + `in-process-driver.ts` during T2 (commit `f249d9c`).
