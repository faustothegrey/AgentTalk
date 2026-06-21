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

### LB-4 · 2026-06-21 — [orchestrator] Full-transcript resend is on the `!currentConversation` path ONLY (not consensus)
> **CORRECTED 2026-06-21 (T3b-1 review, FIND-T3b1-1).** The original claim ("resends every turn for **all**
> in-process agents incl. consensus") was **overstated** — see the strikethrough + correction below.
- **Original (overstated):** ~~for **all** in-process driver agents the per-turn prompt is rebuilt to contain the
  entire conversation; consensus grows O(n).~~ Captured verbatim (T3-S1 probe 1, exec-RPC prompt for **turn 2**, on
  the **no-conversation** path):
  ```
  [user]: Remember this codeword for later: BELIER-7731. Reply with only the word OK.
  [assistant]: OK

  Now respond to the latest message:
  [user]: What was the codeword I told you earlier? Reply with ONLY the codeword.
  ```
- **Corrected finding (measured, T3b-1):** the O(n) full-transcript resend happens **only on the
  `!currentConversation` path** (non-planning / direct 1:1 messages): `buildPrompt` = `27→404 B` over 6 turns. The
  **planning / consensus path** (`conversation_start mode:planning`, team-coordinator ~L1082) only ever sends the
  **last message + instructions** — it is **flat at ~2881 B**, already bounded, and was **never** an O(n) problem.
- **Implication:** moving cli-exec to native session (no-resend) helps the `!currentConversation` path **only**
  (T3b-1: `buildLatestTurnPrompt` flattens `404→70`); consensus needs no change. The API/T1-T2 path stays
  byte-for-byte (D5: lean on provider caching). cli-exec planners additionally gain *richer* memory than API ones
  (full discussion in native `--continue`) even though each planning prompt is last-message-only — a quality, not
  cost, effect. See [[LB-5]].
- **Source:** `spikes/m07-t3-s1-session-probe.mjs` (probe 1, no-conversation path) + T3b-1 prompt-size measurement
  (FIND-T3b1-1, ledger); commits `5aedcaa`, `1ad16f1`.

### LB-5 · 2026-06-21 — [harness/agy] Native `--continue` persists across exec-RPC, but the home is ephemeral; no usage surfaced
- **Finding:** (a) **native session works** — a *minimal* 2nd exec-RPC prompt (no transcript) recalled a
  codeword planted on the 1st (`NIMBUS-4209`), so `agy --continue` in the persistent harness maintains
  native session across separate exec-RPC calls. (b) **No restart recovery** — the harness home is
  `mkdtemp` + **rm-on-exit** (`agentalk-mcp-client/lib/executor-runtime.mjs` ~L395/451), so a harness
  relaunch gets a **fresh home → wiped session** (codeword lost after SIGKILL+restart). (c) **No token
  usage** — `submit_exec_result.usage` is `{prompt_tokens:0, completion_tokens:0}` on every turn; agy
  doesn't report tokens over this path.
- **Implication:** native session (option 2) is **viable but fragile to restart** → durable native recovery
  needs a **stable, sessionId-keyed home** + `--resume <id>` (stop rm-ing it); otherwise pair native
  steady-state with a **resend recovery fallback** (the brain already holds history, see [[LB-4]]). Cost
  can't be measured quantitatively over agy — reason structurally (O(1) native vs O(n) resend).
- **Source:** `spikes/m07-t3-s1-native-session-probe.mjs` (probe 2) + probe-1 restart leg; commit `5aedcaa`.
