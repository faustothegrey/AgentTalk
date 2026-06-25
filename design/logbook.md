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
- **Implication:** moving mcp to native session (no-resend) helps the `!currentConversation` path **only**
  (T3b-1: `buildLatestTurnPrompt` flattens `404→70`); consensus needs no change. The API/T1-T2 path stays
  byte-for-byte (D5: lean on provider caching). mcp planners additionally gain *richer* memory than API ones
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

### LB-6 · 2026-06-21 — [providers] Gemma-4-26b is prone to protocol hallucination under strict multi-turn consensus
- **Finding:** Running `gemma-4-26b-a4b-it` on the live API team test bypassed the HTTP 429 quota limits, but the model failed to follow the rigid multi-agent consensus protocol (discussion → proposal → endorsement → submittal). During the `proposal` phase, `planner-b` sent an `opinion` instead of `agreement_acceptance`, which triggered the orchestrator's built-in fallback to the discussion phase. After re-discussing, `planner-a` successfully submitted an `agreement_proposal`. However, `planner-b` then submitted *another* `agreement_proposal` instead of calling `agreement_acceptance`. Since a proposal was already pending endorsement, this illegal action crashed both planners into the `error` state, triggering a forced shutdown (timeout) and failing the task.
- **Implication:** While the API is technically working for Gemma, the model isn't coherent enough to navigate the strict multi-phase JSON protocol without hallucinating the state transitions. It will likely require explicit fine-tuning or heavily reinforced system prompting to maintain protocol compliance.
- **Tracked (added 2026-06-21):** root cause is broader than this model — the protocol crashes *both* planners on any illegal transition. Promoted to the **M08 failure-modes backlog item** ("consensus protocol fault-tolerance") + a **live-test gate** (no live consensus runs on unfit models until tolerance lands). See [[LB-7]].
- **Source:** `logs/m07-t2-gemma-26b-smoke.log` (live test using `scripts/test-live-api-team.mjs`).

### LB-7 · 2026-06-21 — [providers] Gemini Flash Lite models skip protocol phases
- **Finding:** Running `gemini-3.1-flash-lite` and `gemini-2.5-flash-lite` on the live API team test succeeded in avoiding the HTTP 429 quota limit, confirming these Lite model identifiers are active and have a separate quota pool or aren't restricted by the same limits as the main 2.5 series. However, both models failed protocol compliance identically: they completely skipped the `proposal` phase. Upon receiving an `opinion` suggesting a proposal, `planner-b` immediately replied with an `agreement_acceptance`. Since no `agreement_proposal` was actually pending, this illegal transition crashed the orchestration loop.
- **Implication:** The `flash-lite` models are available for testing without immediate quota exhaustion, but like Gemma, they lack the zero-shot instruction adherence required to navigate the strict multi-phase protocol without hallucinating phase transitions.
- **Tracked (added 2026-06-21):** with [[LB-6]] and [[LB-8]] this establishes that live consensus only works with the (quota-locked) frontier model. Promoted to the **M08 failure-modes backlog item** ("consensus protocol fault-tolerance: brain detects illegal-but-valid transitions → coerce / re-prompt / fail soft, instead of dual force-kill") + the **live-test gate**.
- **Source:** `logs/m07-t2-gemini-3-1-flash-lite-smoke.log` and `logs/m07-t2-gemini-2-5-flash-lite-smoke.log` (live test using `scripts/test-live-api-team.mjs`).

### LB-8 · 2026-06-21 — [providers] Gemini API tier constraints: shared quotas and 404s
- **Finding:** Successive tests on the Google API provider revealed the following constraints:
  1. `gemini-2.5-pro` and `gemini-2.0-flash` hit the exact same `HTTP 429 Quota Exceeded` error as `gemini-2.5-flash`, confirming that the free/tier quota is shared globally across the 2.5 and 2.0 family at the project/key level.
  2. `gemini-3.0-flash` and `gemma-4-31b-a4b-it` return `HTTP 404 NOT_FOUND`, indicating the model identifiers are either incorrect for this endpoint or not whitelisted for the current API key/tier.
- **Implication:** We cannot easily swap to "Pro", "2.0", "3.0", or alternative parameterized Gemma models to overcome the 429 quota on the `google` provider under the current billing tier. To successfully run the multi-agent consensus test (T2.4), we either need a new API key/tier, or we must rely on the limited models outside the 2.5/2.0 umbrella that are accessible (like `gemini-3.1-flash-lite` or `gemma-4-26b-a4b-it`, though those currently fail protocol compliance — see LB-6 and LB-7).
- **Source:** Live tests on `scripts/test-live-api-team.mjs` (see conversation logs).

### LB-9 · 2026-06-21 — [tests] Any test on the real worker/consensus path must mock the worktree `execSync` or it pollutes the repo
- **Finding:** the orchestrator's `handleTeamWorkAssign` (`packages/runtime-core/src/agents/in-process-driver.ts`)
  provisions a per-task worktree via **`execSync('git worktree add <cwd> -b task-<taskId>')`** whenever
  `completer.maintainsSession` (i.e. **mcp**). Any vitest that drives a real mcp worker/consensus turn through
  the real `InProcessAgentDriver` — even one that mocks the *exec transport* — therefore creates **real git worktrees +
  `task-task-*` branches on every run** unless it also stubs the provisioning. This trap has now bitten **twice**: B4
  (T3b-2 round 1, 8 leaked worktrees) and **FIND-T4a-2** (T4a's `team-mcp-consensus.test.ts`, which shipped to
  master in `87ebc52` before the reviewer caught it on a post-merge suite run).
- **Implication:** mocking the exec transport is **not** enough for hermeticity. Mirror the established pattern in
  `packages/runtime-core/src/registry/__tests__/mcp-agent.test.ts`: `vi.mock('child_process', …execSync: vi.fn())`
  **and** `vi.mock('fs', … existsSync → false)`. Check it by asserting `git worktree list` / `git branch` are unchanged
  after the suite. **Reviewer lesson:** verifying a mocked test is *deterministic* ≠ verifying it's *hermetic* — check
  for worktree/branch leaks explicitly. Skim this before adding or reviewing any worker/consensus test (backlog gate).
- **Source:** post-merge suite run on `87ebc52` (3 `task-task-*` branches appeared); fix on `m07-t4a-hotfix-hermetic-test`.

### LB-10 · 2026-06-21 — [protocol/architecture] Agent protocol-COMPLIANCE is the root issue; tolerance ≠ compliance; "affordance protocol" is the likely cure
> **Nature:** a preserved **opinion exchange / design direction** (Fausto + Claude), not a settled fact. Parked here on
> purpose — we may want to come back to it as its own epic.
- **The root problem:** across M06–M08 the recurring failure is **agents not reliably following the multi-phase consensus
  protocol** (ack → fact_collection → discussion → proposal → endorsement → submit_plan). [[LB-6]]/[[LB-7]]/[[LB-8]] showed
  weak models hallucinate transitions; the M08 fixes only made the engine **tolerant** of bad moves (don't crash).
  **Tolerance buys *survival*, not *success*** — a tolerant engine + a non-compliant agent just stalls / times out. The
  cure is **compliance**, not more tolerance.
- **The lever — "affordance protocol" vs "prose protocol":** today the brain *describes* the protocol in prose and asks the
  model to **self-track the phase and self-select `message_type`**, then validates/rejects *after the fact*. The robust
  design is to **expose only the tool(s) legal for the current phase** (the brain already knows the phase) — so an illegal
  move isn't even on the menu, like greying out invalid buttons in a state-machine UI. This helps the **weakest** models
  most (they can't pick a move that isn't offered). It is the natural next step of the M07 "centralized brain" thesis: the
  brain should own the **affordances per turn**, not just prompt-build/parse/lifecycle.
- **The hard tension (the deep-dive question Fausto raised re: function calling):** the two execution paths have different
  **compliance ceilings.** **API path** = you control the request → native function-calling with **per-call constrained
  tool sets** + schema-enforced args (affordance protocol fully achievable). **mcp path** (agy/claude/codex MCPs — the
  *production direction* after T4b) = raw prompt → raw text; the MCP runs its own internal tool loop, so you likely **can't**
  constrain its per-turn tool set → stuck with prose + parse + tolerance, the *weakest* substrate. ⇒ **open fork:** is the
  **API path** the better substrate for *robust multi-agent consensus*, with mcp reserved for *single-agent execution*?
- **If revisited, scope as a focused spike** (not an open-ended dive): (1) what each provider's function calling actually
  *guarantees* — can you restrict offered tools per call? enforced arg-schema / constrained decoding? (2) does mcp
  expose **any** per-turn tool-constraint hook, or is it irreducibly freeform-text? (3) the path-substrate fork above.
  Likely becomes its own epic ("protocol compliance via affordance-based tool exposure") — **possibly higher-value than the
  remaining T4 deletion work.**
- **Source:** Fausto ↔ Claude opinion exchange, 2026-06-21 (end of the M08 / T4b-2 session). Not yet a task; parked for a future epic.


### LB-11 · 2026-06-22 — [process] Token-budget calibration — measure the 5h window empirically (no live meter in-context)
- **Finding:** Claude has **no running token meter in its context** — it can't introspect "this turn cost X" or "Y% of
  window used." Signals are *partial*: some tool results self-report (e.g. a `Read` reported *"45109 tokens, cap 25000"*),
  but there's no live tally. The **dominant cost is cumulative context** (every turn reprocesses the whole conversation),
  not any single action; the **prompt cache (5-min TTL)** makes re-reads within 5 min cheap and gaps >5 min re-pay. The
  **exact Claude Pro 5h-window cap is not a stable, quotable token constant** (it flexes by model/demand/policy) — **`/usage`
  is the authoritative live source**, not the model's memory.
- **Implication:** don't chase an exact constant; **calibrate empirically.** Gauge complexity in *relative* terms
  (cheap/medium/expensive) and accumulate a **session → work-done → %-window** table over time → a real *tokens-per-task-type*
  estimate. Verify-don't-assert, applied to our own budget. *(Working-habit half — Claude appends a one-line rough budget read
  at natural checkpoints + flags expensive ops before running — lives as a `feedback` memory, since the content is a judgment
  call, not a deterministic hook.)*
- **Calibration table** (append one row per session from `/usage`):

  | Session (date) | Work done | %-window (per /usage) | Notes |
  |---|---|---|---|
  | 2026-06-22 | M07-T4b-3 review-by-running (multi-suite + **2 live consensus runs**) + 2-repo `--no-ff` merge + `implementer-pitfalls.md` + M08/M09 planning | ~89% by session end (start ~0) | First anchor: **one substantial "review + merge + plan" cycle ≈ ~1 full 5h window.** Live runs + large reads (e.g. 45k-token ledger) were the heavy items. |
  | 2026-06-22 (next session) | M08 backlog-gate + plan + ledger (3 design docs) + **M08-T1 implemented** (3 files, new tests) + `tsc -b` + 2× full vitest (172/172), no live runs | **5h 38% / weekly 73%** (per `/usage`; curl meter wrongly read **0%** — see UPDATE below) | "Open-an-epic + one contained impl task, no live runs" cost a moderate slice. **Weekly 73% is the binding figure** — runway is finite; scope T2/T3 with that in mind. |
  | 2026-06-22 (primer-testing session) | Session-primer stress-test (consumed-key re-read) + **re-prime mechanism** (AGENT.md + LB-13 + proposal) + self re-prime + 2 commits; no code, no live runs | **5h 82% / weekly 78%** (per `/usage` endpoint, Fausto-confirmed correct) | Docs-only session; weekly rose 73→78%. Endpoint now reliable for claude (see UPDATE below). |
  | 2026-06-22 (T3-prep / spike session) | Cold-start primer handshake + workflow Q&A + AGENT.md startup-usage-doc + **Spike A** (read-only, ~8 targeted reads → LB-16) + LB-15-decision recommendations + built `scripts/usage.mjs` parser; **no code, no builds, no live runs** | **session 59% / weekly 84%** (per `/usage`, telemetry-confirmed; matches Fausto's independent ~15%-left read) | A read-heavy, write-light session (spike + docs) cost a moderate slice; weekly 78→84%. **Weekly ~16% left until Jun 24 09:00 — the T3 reset boundary.** Binding constraint = weekly; deferred T3 impl past reset. |
  | 2026-06-24 (T3 impl session) | Cold-start handshake + permissions config (git-push un-gate) + **M08-T3 implemented end-to-end** (6 in-scope files: contracts/types, in-process-driver +test, registry, team-coordinator, new fence test) — full context read (plan + LB-15/16 + all touched code), `tsc -b` + targeted vitest + full suite (182/182), ledger+logbook docs; **no live runs** | **session 10%→24% (~14%) / weekly 2%→4% (~2%)** (per `/usage`) | **First post-reset engine-task anchor: a full "read + implement + delegated-gate + document" engine task ≈ ~2% weekly / ~14% session.** Cheaper than the M07 review+merge anchor (no live runs; surgical additive diff). Reads were the bulk; the impl/test/gate loop was light. |

- **UPDATE (2026-06-22, same session) — a live out-of-band meter EXISTS:** `curl -s http://127.0.0.1:9899`
  returns JSON with per-provider `5h_percent_used` / `weekly_percent_used` + reset times for **claude / codex /
  antigravity(gemini)**. So while there's still **no *in-context* meter**, Claude can **poll real numbers via Bash
  `curl`** at checkpoints — no longer dependent on Fausto's `/usage`. First live reading: claude **5h 93%** (reset
  12:10 Rome), **weekly 69%** (reset Jun 24). *Insight: the **weekly %** is the real cross-session budget; the 5h
  resets every few hours.* Prefer this endpoint over guessing for the LB-11 table going forward.
- **UPDATE (2026-06-22, M08-T1 session) — the curl meter's `claude` block is UNRELIABLE; cross-check `/usage`:**
  the endpoint reported claude **0% / 0%** while `/usage` (authoritative, Fausto-confirmed) was **5h 38% / weekly
  73%** — not noise, a near-zeroed mis-read. **Do NOT trust a low/zero `claude` reading from `127.0.0.1:9899`**;
  treat it as best-effort only and confirm against `/usage` before relying on Claude's own headroom. *(The
  `antigravity` block agreed with Fausto's independent measure earlier this session, so the unreliability is at
  least provider-specific to `claude` here; treat all blocks with suspicion until re-validated.)* Reset times were
  not available at this reading. **Net:** the in-context "no live meter" problem stands, and the out-of-band curl
  meter is **not a dependable substitute for `/usage`** for claude.
- **UPDATE (2026-06-22, primer-testing session) — meter rebuilt as TWO endpoints; bare path now 404; claude block now RELIABLE:**
  the server changed — `curl http://127.0.0.1:9899` (bare) now returns **HTTP 404**. Two new paths:
  (1) **`/usage`** → per-provider percentages, new JSON shape `{<provider>: {ok, parsed: {current_session.used_percent,
  current_week_all_models.used_percent, resets…}}}` (note `claude.parsed.session_tokens` is still all-zeros — the
  *live-session* tally remains unpopulated); (2) **`/tokens`** → cumulative **30-day** token totals
  (`input/output/cache_creation/cache_read`), **claude-only** so far, **not** a per-turn delta. First reading: claude
  **5h 82% / weekly 78%**, and **Fausto confirmed the `/usage` percentages are correct** — so the earlier
  unreliability (curl `claude` block reading 0% vs real 38%/73%) is **resolved for the new `/usage` endpoint**; the
  prior "don't trust a low/zero claude reading" caveat applies to the **old bare endpoint**, now retired. Still
  **exploratory** (Fausto): expect intermittent `ok:false` (antigravity was `ok:false` at this reading) and data
  jitter — best-effort, never blocking, as ever. AGENT.md Resource-Monitoring updated to the two-endpoint form.
- **UPDATE (2026-06-22, T3-prep session) — reusable parser exists; stop hand-parsing the JSON:** added
  **`scripts/usage.mjs`** (`node scripts/usage.mjs`, or `--json` for raw passthrough). It polls both endpoints,
  prints a compact per-provider session/weekly summary with reset times + the claude 30-day token totals, and is
  best-effort/never-blocking (5 s timeout; an `ok:false`/down block prints a one-line notice and exits 0). **Use
  this at checkpoints instead of `curl | eyeball`.** Confirmed working against the live meter this session
  (claude session 59% / weekly 84%).
- **Source:** Fausto ↔ Claude, 2026-06-22 (end of M07-close session, then M08-T1 session, then primer-testing session, then T3-prep session); `scripts/usage.mjs` over `/usage` + `/tokens` on `127.0.0.1:9899`.

### LB-12 · 2026-06-22 — [tooling] Files named `claude.md`/`agents.md` collide with the CLAUDE.md/AGENTS.md auto-load on a case-insensitive FS
- **Finding:** while building the session-primer mailbox, the primer file was first created as
  `design/session-primers/claude.md`. On macOS (**case-insensitive** filesystem) `claude.md` *is* `CLAUDE.md`,
  and Claude Code's recursive `CLAUDE.md` discovery **auto-loaded it as scoped project instructions** — it
  injected itself into context unconditionally, **bypassing the intended key-gated handshake** entirely. (Same
  trap would hit `agents.md` for agy/AGENTS.md.)
- **Implication / rule:** any repo file meant to be *read deliberately* (not auto-loaded as instructions) must
  **not** have a stem that matches an agent MCP's auto-context filename (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`,
  …) **case-insensitively**. The primer files use the `-primer.md` suffix (`claude-primer.md`,
  `gemini-primer.md`) for exactly this reason; the **First Entry Point** section of AGENT.md carries the
  warning inline.
- **Source:** Claude (caught live by the tooling injecting `design/session-primers/CLAUDE.md` into context), 2026-06-22.

### LB-13 · 2026-06-22 — [protocol] Re-priming: replay an older primer through the cold-start gate via fresh-key-on-old-body
- **Finding:** a **consumed** primer key has exactly one downstream behaviour — *benign re-read* (proceed
  normally, no cold-start gate). There was no way to deliberately re-run the **full** cold-start orientation from
  an already-spent primer, so a genuinely cold instance whose only durable brief is a consumed primer got the
  *weakest* treatment instead of the *strongest*.
- **Mechanism (added):** **re-priming** = recover the durable body from git history (`git show
  <commit>:…<agent>-primer.md`), mint a **fresh** key, rewrite the primer file with that key + the recovered body
  + a `reprimed_from: <commit>` audit field, and set the fresh key `active`. The next cold instance matches on the
  existing `== active` branch — no change to the three-branch handshake. **Never recycle a consumed key** (flipping
  `consumed`→`active` erases the spent/replay distinction); always fresh-key-on-old-body.
- **Gate:** **soft / human-approved** — the human decides and approves first; the agent mints only after. The
  private key store is agent-writable, so the gate is behavioural, not enforced (hard-gate alt: human supplies the
  key value so possession proves authorisation — considered, not adopted).
- **Source:** Fausto ↔ Claude design exchange, 2026-06-22 (surfaced by a stress-test of the consumed-key re-read
  path). See `design/reprime-mechanism-proposal.md`.

### LB-14 · 2026-06-22 — [process] The human gate's purpose is *independence*, not *determinism* — so a deterministic check can be delegated, a judgment check cannot
- **Finding:** with Gemini out of budget there is **no independent agent verifier**, so plan §8 made Fausto the
  human gate for all M08 tasks. The temptation (raised by Fausto) is to gate **only** live/external-resource tests
  and let deterministic git/`tsc`/`vitest` checks pass unattended — *"they're deterministic anyway."* But the
  circuit breaker the gate protects is **independence** (the implementer must not self-certify a green it didn't
  honestly run — Honesty-over-Results), **not** non-determinism. Determinism doesn't remove that risk; it only
  makes the independent check **cheap** (a 30-second paste) and **cheaply auditable** (anyone can re-run and get
  the same answer).
- **Decomposition (3 checks, not 2):** (1) **test execution** (tsc/vitest) — deterministic, so it can be
  delegated to the implementer who reports actual output, backstopped by the human's right to re-run/audit; (2)
  **diff / scope / behaviour-preservation review** — *pure judgment, determinism irrelevant*; this is where the
  real risk lives for shared-engine tasks (T2/T3) and ideally stays with an independent reviewer; (3) **live /
  external-resource tests** — non-deterministic + real quota/state, need human judgment (real failure vs
  environmental). M08 already treats live runs as *recorded observations, never a flaky gate* (plan §6).
- **Decision (Fausto, 2026-06-22):** **degraded-workflow relaxation, explicitly authorised.** Because one party
  (Gemini) cannot function, Fausto **delegates the full deterministic gate (incl. self-review of the diff) to
  Claude** for M08 deterministic tasks. Claude runs it, reports **actual** command output, and merges on green;
  Fausto retains cheap re-run audit. This **knowingly relaxes** the §8 circuit breaker (implementer self-certifies
  + self-reviews), justified only by the degraded state; it **reverts** to an independent runner/reviewer the
  moment agy's weekly window refills. Live bars (e.g. T2.4) remain deferred/human-gated.
- **Source:** Fausto ↔ Claude exchange during the M08-T2 gate, 2026-06-22. Amends plan §8.

### LB-15 · 2026-06-22 — [M08-T3] Worker effect-fence scope pass — findings + 2 scope amendments + 4 open decisions (paused before code)
- **Status:** **T3 SCOPED, NOT implemented.** Paused at Fausto's call to resume fresher / with more budget. This
  is the durable record to restart from (not chat). T1 + T2 are merged (`a67d1a5`); T3 is the last engine task
  (T4 is hygiene). Full scope proposal is in this entry; plan §3/§4/§5-D3 hold the spec.
- **Goal:** worker exec rejects/crashes mid-exec → divert the task to a **new `awaiting_operator` status**
  (stop-and-ask): record + surface it, **terminate nobody**; plus an operator **abort** path. M03 Shared-Fate
  kill path (`team-coordinator.ts:1458` `handleAgentFailure`) stays **byte-for-byte** for every other failure.
- **🚩 Load-bearing finding (T1↔T3 collision):** T1 made `executeApiPrompt` swallow a rejected exec to `null`
  (no rethrow, to avoid the M03 trip). But the worker path is `handleTeamWorkAssign` (`in-process-driver.ts:234`)
  → `const text = await executeApiPrompt(...); if (!text) return;` (line 267-268) — a **silent return** that is
  G3 (task hangs). And `null` is **overloaded**: it means *both* "exec crashed" *and* "legitimately empty
  response" (the existing contract, also used by planner paths). So the fence must fire on a **genuine
  `McpError` only**, without touching the planner null-swallow. **Recommended mechanism:** the worker path
  catches `McpError` specifically via a small rethrowing helper (or a `{throwOnExecError:true}` opt) used
  *only* by `handleTeamWorkAssign`; planner `executeApiPrompt` stays as-is.
- **Approach:** `handleTeamWorkAssign` catches `McpError` → `registry.pauseTaskForOperator(agentId, reason)`
  → new `coordinator.pauseTaskForOperator()`: sets `task.status='awaiting_operator'`, `recordTaskTranscript`
  ("worker exec failed; effects may be partial"), `emitTeamTask` — **no `requestAgentShutdown`, no
  `team.status='error'`, no `delete currentTaskId`** (a NEW sibling of `handleAgentFailure`, which is untouched).
  Operator abort → `registry.abortAwaitingOperator(taskId)` → clean teardown. The "freeze" is implicit (a
  non-active task gets no scheduled turns — D3 "kill no one").
- **Files (in plan §2 scope unless flagged):** `in-process-driver.ts` (worker catch), `team-coordinator.ts`
  (new pause + abort; `handleAgentFailure` byte-for-byte — HIGH-sensitivity), `registry.ts` (thin entry points),
  `__tests__` (deterministic, **mock `execSync`/`existsSync` — LB-9**). **⚠️ scope amendment:** also
  `packages/contracts/src/types.ts` — add `'awaiting_operator'` to `TeamTaskStatus` (line 31-38) — **NOT in plan
  §2**; needs approval (like `agent.ts` for T2).
- **4 OPEN DECISIONS (must settle before code):**
  1. **Approve `packages/contracts/src/types.ts` into scope?** (new status is a contract type; additive union
     member — check for any exhaustive `switch` TS would flag, and UI/harness tolerance of the new value.)
  2. **T1↔T3 mechanism:** OK with worker-only `McpError` rethrow helper, leaving planner null-swallow intact?
  3. **Driver→coordinator signaling:** direct `registry` method (rec — avoids pulling `mcp-tools.ts` + MCP-tool
     surface into scope) vs a new MCP tool?
  4. **Operator abort end-state:** exact target (task→`interrupted`? team→`idle`/`interrupted`? members shut down
     or left alive?) — D3.4 only says "clean teardown so it can't get stuck."
- **Note:** T3 is materially bigger than T1/T2 (2 scope amendments + 4 decisions, touches the consensus engine) —
  do a `/usage` check first; the diff-review risk (M03 byte-for-byte) is the real hazard, not the test green.
- **Source:** Fausto ↔ Claude T3 scoping exchange, 2026-06-22. Resume here.

### LB-16 · 2026-06-22 — [M08-T3 / spike] "Does `awaiting_operator` actually freeze?" — read-only spike: the implicit freeze HOLDS, protected three ways over
- **Status:** **SPIKE (exploratory, read-only — no code, nothing changed).** Run while T3 is paused + budget thin, to de-risk LB-15 decisions ① and ④ *before* Fausto decides (day-after-tomorrow). The core D3 assumption was unproven: pause sets `awaiting_operator` but **deliberately keeps `team.currentTaskId`** (unlike the failure/planning teardowns, which `delete` it) — so does the orchestrator keep firing turns at a paused task? **Answer: no. The freeze holds, and for robust reasons.**
- **🟢 Finding 1 — turn-scheduling is event-driven + status-guarded, NOT a polling loop, so a retained `currentTaskId` does not re-schedule.** There is **no proactive scheduler** that pushes worker turns by polling `currentTaskId`. The worker is driven **once, reactively**, by the work-assign event → `handleTeamWorkAssign` (`in-process-driver.ts:234`). Every coordinator message-handler early-returns unless `task.status` is the expected value (the pervasive `if (task.status !== 'planning') return` / `!== 'in_progress'` etc. — ~20 sites). With `status='awaiting_operator'`, **no handler advances it**. So keeping `currentTaskId` set is safe: scheduling keys off *events + status*, not off currentTaskId presence.
- **🟢 Finding 2 — all coordinator timers are PLANNING-phase only and already cleared before the worker phase.** `planningWatchdogs` + `submitPlanUrgencyWatchdogs` are the only coordinator timers; every callback is `status==='planning'`-guarded, and both are cleared on the transition into work (`team-coordinator.ts:1135-1136`). **During the worker phase (where pause fires) there is no live coordinator timer** to re-fire a paused task.
- **🟠 Finding 3 — the ONE real hazard is the registry idle-timeout, and it's already neutralized THREE ways.** `registry.ts:126` runs `checkIdleAgents()` every 30 s; an idle agent → `setAgentStatus('error')` → `handleAgentFailure` (the M03 kill). For a *paused-but-alive* worker that could be a problem. It is not, because:
  1. **`hasAgentTimedOut` only fires for `status==='busy'` agents** (`registry.ts:595`). After a failed worker exec the agent is no longer running a turn, so it isn't `busy` → idle check skips it.
  2. **Even if it did fire**, `handleAgentFailure` (`team-coordinator.ts:1458`) has **exactly two branches and no `else`/`default`**: `planning` → interrupt; `['delegated','in_progress','awaiting_confirmation']` → kill. **`awaiting_operator` matches neither → the function no-ops.** The task survives; the M03 kill does NOT trigger. *(Happy alignment: this is also why LB-15 ④'s "`handleAgentFailure` untouched" is compatible with the freeze — adding the union member changes nothing for existing statuses AND naturally does the right thing for the new one.)*
  3. **If we want belt-and-suspenders** (truly "terminate nobody" per D3, no errored worker left behind), there is a **drop-in exemption precedent**: `hasAgentTimedOut` already exempts fact-checking agents via `this.teamCoordinator.isAgentFactCollecting(agent.id)` (`registry.ts:599`). A sibling `isTaskAwaitingOperator(agentId)` guard would exempt the paused worker identically — tiny, mirrors existing code.
- **🟢 Finding 4 — no exhaustiveness/TS breakage; UI tolerates an unknown status (cosmetic-only).** No `assertNever`/exhaustive `switch` on `TeamTaskStatus` anywhere (grep = comments only) → adding `awaiting_operator` to the union **cannot break `tsc`**. The web status switches are either on **agent** status (`AgentsView.tsx:13`, `AgentList.tsx:13` — unrelated) or have a **`default` arm** (`PlanningView.tsx:98` → `default: <Activity/>`). Worst case for the new task status = a generic yellow icon. **No crash; cosmetic follow-up only.**
- **Bottom line for the deferred decisions:** ① (approve the new status) and ④ (abort end-state, `handleAgentFailure` untouched) are **lower-risk than LB-15 feared** — the freeze is structural, not something the impl must build. The only *active* impl choice the spike surfaces: **decide whether pause also exempts the worker from the idle-timeout** (Finding 3.3) so D3's "kill no one" is literally true, vs. relying on the 3.1/3.2 no-op safety net. Recommend the exemption (cheap, mirrors `isAgentFactCollecting`). **This is a new sub-decision to fold into the LB-15 set.**
- **Scope touched by spike:** NONE (read-only). Files *read*: `team-coordinator.ts`, `registry.ts`, `in-process-driver.ts`, `contracts/src/types.ts`, `apps/web/{AgentsView,PlanningView,components/agents/AgentList}.tsx`. No branch, no build, no test run.
- **Source:** Spike A, Claude, 2026-06-22 (T3 paused, ~15% weekly budget). Feeds LB-15 ①/④.
- **ADDENDUM (Spike A.2, same session) — the REMAINING decisions ②/③/⑤ are now read-only-grounded too; all five are low-risk + in-pattern.**
  - **② worker-only `McpError` rethrow (LB-15 ②):** `executeApiPrompt` (`in-process-driver.ts:176`) *already* takes an `opts` bag (`cwd`/`timeoutMs`); its catch (183-190) always `return null`. Adding `throwOnExecError?: boolean` is a one-field additive change — planner calls (130/219/225) never pass it → **byte-for-byte null-swallow preserved**; worker calls (267 + retry 270) use `execOpts` → both covered. Only `McpError` would rethrow, so any error reaching a `handleTeamWorkAssign` try/catch *is* the exec crash (no ambiguity). The silent `if (!text) return` at line 268 — the **G3 hang** — is precisely what gets bypassed. Verdict: clean, minimal, planner path untouched.
  - **③ direct registry method vs MCP tool (LB-15 ③):** the driver already holds `this.registry` and calls `this.registry.handleMcpToolCall(...)` throughout (221/228/276); registry→coordinator delegation is an **established pattern** (`handleAgentFailure` @ `registry.ts:173`, `isAgentFactCollecting` @ `registry.ts:599` are both `this.teamCoordinator.*` called from registry). So `registry.pauseTaskForOperator(agentId, reason) → teamCoordinator.pauseTaskForOperator(...)` is a pure mirror — **no MCP tool, no protocol/`wire-contract.json` surface.** Verdict: direct method confirmed, smallest blast radius.
  - **⑤ idle-timeout exemption (the new sub-decision from Finding 3.3):** `hasAgentTimedOut` (`registry.ts:595`) already exempts fact-checkers via `this.teamCoordinator.isAgentFactCollecting(agent.id)` (599). A sibling `isTaskAwaitingOperator(agentId)` + one guard line is a one-line mirror. Verdict: trivial; recommend doing it so D3 "kill no one" is literally true.
  - **Parser graceful-degradation proven (not asserted):** `AGENTTALK_METER=http://127.0.0.1:1 node scripts/usage.mjs` → prints `/usage unavailable: fetch failed (best-effort — carry on)` and **exits 0**; `--json` passthrough works. The "never-blocking" claim is verified, not just stated.
  - **Net:** T3 is now fully decision-grounded read-only. The only *judgment* calls left for rested-Fausto are go/no-go ratifications (approve the 2 scope amendments; OK the rethrow-opt + direct-method + idle-exemption shapes) — the implementation shapes themselves are all confirmed additive/in-pattern with `handleAgentFailure` untouched. **Still no code written.**

- **DECISIONS RATIFIED — 2026-06-23 (Fausto, walk-through one-by-one):** the five T3 decisions are settled.
  - **① contract type** — **APPROVED.** Add `'awaiting_operator'` to `TeamTaskStatus` (`packages/contracts/src/types.ts`).
  - **② crash-vs-empty** — **APPROVED.** Worker-only `throwOnExecError?: boolean` opt on `executeApiPrompt`; planner null-swallow byte-for-byte.
  - **③ signaling path** — **APPROVED: direct registry method** (`registry.pauseTaskForOperator → coordinator.pauseTaskForOperator`); **no MCP tool**, no `wire-contract.json` surface.
  - **⑤ idle-timeout exemption** — **APPROVED.** Add `isTaskAwaitingOperator(agentId)` guard in `hasAgentTimedOut` (mirror of `isAgentFactCollecting`) so D3 "kill nobody" is literally true (3rd safety layer).
  - **④ operator abort / recovery** — **DEFERRED → its own future milestone** (Fausto: "deserves its own milestone… let experience dictate the cure"). Reason: "stop ASAP" is bounded but **"clean up" is unbounded** (partial worker effects — no generic undo). **T3 scope is now FENCE ONLY** (no `abortAwaitingOperator`, no teardown end-state). Recorded in `backlog.md` (2026-06-23). v1 recovery = manual cleanup + restart; the fence keeps the partial state frozen + surfaced, harmless (per Findings 1–4). **Caveat for the fence impl:** UI/transcript wording must not promise an abort that doesn't exist yet.
  - **Implementation impact:** clean amputation — ①②③⑤ stand unchanged; only ④'s abort method + teardown drop out. **Still budget-gated** (implement post Jun-24 weekly reset). **Still no code written.**

#### Plain-English summary (the "scary assumptions", for the human) — Fausto asked this be recorded verbatim

T3's whole idea is: **when a worker agent crashes in the middle of a job, don't blow everything up — freeze that job, leave everyone alive, and ask the human what to do.** Simple to say. The "scary assumptions" were the things we were *counting on being true* for that to work safely — but hadn't actually checked. If any were wrong, T3 would be dangerous or a much bigger job. The spike checked them by reading the code, before writing any. In order of scariness:

1. **"If we mark a job as paused, will the system actually leave it alone — or keep poking it?"** The pause deliberately keeps the job *attached* to the team (the normal crash-handling detaches it). The fear: the orchestrator might keep handing that job its next turn anyway, so "paused" wouldn't actually pause anything — it'd just keep running into the same crash. → **Proven false fear.** The system only ever acts on a job when (a) a message comes in *and* (b) the job is in a state it recognizes. A paused job sits in a brand-new state nobody reacts to. So it genuinely sits still. Nothing pokes it.

2. **"Will some background timer wake up and mess with the paused job?"** → **Proven safe.** The only background timers belong to the early "planning" phase, and they're already switched off by the time a worker is doing the actual work. During the worker phase — exactly when a crash/pause happens — there are no live timers to interfere.

3. **The scary one: "Will pausing accidentally kill the entire team?"** There's an existing safety rule from Milestone 3: *if any agent goes into an error state, tear down the whole team* (so nobody deadlocks). The fear: we pause, leave the crashed-but-alive worker sitting there idle, a watchdog notices it's idle, flags it as "errored," and that trips the kill-everything wire — the precise *opposite* of "hurt no one." → **Proven safe, three times over:** (a) the idle watchdog only watches agents that are actively *busy*, and a worker that just failed isn't busy, so it's never flagged; (b) *even if* it were flagged, the kill-everything code only fires for the *old* job states — our new "paused" state isn't on its list, so it quietly does nothing; (c) and there's an existing, clean way to explicitly exempt the paused worker from the idle check if we want a belt *and* suspenders.

The other three were less "is it safe" and more "is this a small clean change or an invasive one":

4. **"Can we tell a real crash apart from a normal empty answer?"** The code uses the same blank value (`null`) for both — a trap. → We can add one tiny flag so *only the worker* treats a crash specially; everything else stays exactly as it is.

5. **"Can the worker signal 'pause' without touching the fragile messaging/protocol layer?"** → Yes — the worker already talks to the engine directly, so it's one new method, no protocol surgery.

6. **"Can we avoid editing the dangerous shared kill-code?"** → Yes — it stays literally untouched and still behaves correctly for the new case.

**The headline:** the genuinely frightening one was #3 — that "pause and ask" could secretly become "kill the whole team." Proving it *can't* (and that the M3 kill-code doesn't even need to be touched) is what turned T3 from "scary engine surgery" into "a small, additive change."

### LB-17 · 2026-06-24 — [M08-T3] Implemented (fence only); the implementation finding that makes the fence race-free
- **Status:** **IMPLEMENTED, delegated-gate green, NOT merged (closure human-gated this session).** Branch
  `m08-t3-worker-effect-fence` off `master` `66e2bfe`. Five ratified changes (①②③⑤ + tests); `handleAgentFailure`
  byte-for-byte (zero-line diff). `tsc -b` 0; full suite **182/182** (+6 new, none changed); 0 repo pollution.
  Details in the ledger T3 section + claim/verdict rows.
- **🔑 New finding (folds into LB-16, confirms decision ⑤ is belt-and-suspenders, not load-bearing):**
  `setAgentStatus` calls `handleAgentFailure` **only** on the transition *to* `error` (`registry.ts:172`), and
  **never** on `terminated`. The realistic worker-exec-crash signal is the completer **timeout** reject (the
  harness hangs / stops returning `submit_exec_result`) — which leaves the agent `busy` with **no status change at
  all** — or a clean `terminated`. **Neither triggers `handleAgentFailure`,** so the fence (`pauseTaskForOperator`
  via the driver catch) runs with **no race** against the M03 kill. The only `error`-status path is the
  *idle-timeout* (`checkIdleAgents` → `setAgentStatus('error')`), which is a *different* failure that **correctly
  still kills** (T3.2) — and ⑤'s `isTaskAwaitingOperator` idle-exemption guards the window where a paused worker
  might otherwise be flagged. So the three LB-16 safety layers hold, and the design needs **zero** change to the
  kill path.
- **Test shape note:** the deterministic tests reach the fence via an **injected rejecting completer**
  (`maintainsSession=false`), so the `execSync('git worktree…')` provisioning path is never entered — **no
  `execSync`/`existsSync` mock was even required** (cleaner than the LB-9 mock-pattern; the coordinator test seeds
  the task map directly). Post-run worktree/branch/`/tmp` all clean.
- **Deferred (unchanged):** T3.4 operator abort/recovery → its own milestone (LB-16 ratification). v1 recovery =
  manual cleanup + restart; the fence keeps the partial state frozen + surfaced.
- **Source:** Claude (impl role, delegated gate LB-14), 2026-06-24. Next: human merge-gate, then T4 (hygiene).

### LB-18 · 2026-06-24 — [tooling/method] DiagramTalk as a visual channel — "UML-like, not UML"; the layout engine's grain
- **Why this exists (rationale).** AgentTalk's hard parts — the consensus protocol, the failure-mode
  milestones — are *state machines and message dances*, and Fausto's stated way of grasping them is
  **visual**: *"when complexity arises this is the only way; going through long text spotting little
  problems is not how the human mind works, at least not mine."* So we wired in **DiagramTalk** (a
  separate Next.js/tldraw whiteboard at `localhost:3000`, repo `faustothegrey/DiagramTalk`, with a
  `diagramtalk` skill) as a **shared, bidirectional channel**: the agent reads what the human *selects*
  (`selectedShapes`/`selectedConnections` ground "this box/arrow") and *draws* diagrams onto the canvas
  via declarative **layout specs**. Treat this as **core infrastructure for reasoning about AgentTalk**,
  not a toy — Fausto explicitly paused M09 to get the consensus diagram to actually read well.
- **The skill's load-bearing discipline.** *"Coordinates are claims; geometry is truth."* A layout isn't
  "done" until `layout … --dry-run` reports **empty `overlaps`** and every `arrowCrossing` is gone or
  consciously accepted, **and** a render has been eyeballed. The engine runs two *physical* checks
  (box-vs-box footprints; **segment-vs-rect over the whole arrow path**, not just endpoints), so it
  catches mid-path crossings that reading `(x,y)` never would. We honored this and it paid off.
- **Finding — "UML-like, not UML" is the right altitude here.** Full UML *notation* (hollow-triangle
  inheritance, lifelines, guards-in-brackets as first-class, composite-state borders) is a **poor fit**:
  tldraw is a freeform canvas with no UML renderer, so formal UML would be *faked* — ceremony without the
  tool that makes it unambiguous (and PlantUML was already deferred, see memory `prefers-visuals-with-prose`).
  What *does* pay off is UML **as discipline**: pick the diagram *type* the content actually is, and borrow
  its vocabulary. The consensus protocol **is a finite state machine**, so we model it as one — explicit
  **initial/final pseudostates**, **states = protocol phases** (the actors User/Orchestrator/Planner-A/B/
  Worker are **not states** → moved to a legend, the key correction), transition labels written as
  **guards** (`[both acked]`, `[timeout 480s]`), and a **terminal error state** (`Interrupted`) as the
  error fan-in. Result reads far better than the original freeform "boxes and arrows" *without* leaving
  DiagramTalk. **Implication:** default to UML-*discipline*/lightweight; reserve formal UML/PlantUML for
  docs that need an unambiguous spec read by many.
- **Finding — the layout engine has a grain; cut with it.** Two non-obvious properties of
  `compute_layout` (`diagramtalk/scripts/diagramtalk.py`) decide what's clean: **(1)** all nodes in a lane
  share the **same top edge** (`_y = lane_y`) and the crossing check shrinks boxes by 1px (`pad=-1`) —
  so routing back-edges with `fromAnchor/toAnchor = top→top` (or `left→left` for a vertical spine) runs
  them **along the shared edge**, grazing but never penetrating → **zero crossings**. This beat the shipped
  example (which ships 5 crossings). **(2)** Lanes flow **strictly left-to-right with a monotonic cursor**:
  `col` can only push a node *further right*, never left of the cursor. So a **"snake"/boustrophedon wrap is
  impossible**, and folding a linear flow into two horizontal phase-rows does **not** compact it — the
  second row just extends rightward (measured: 11-state spine 2031px wide → "two-phase" attempt *2141px*,
  *wider*). For a long linear protocol the genuinely compact, crossing-free form in this engine is
  **vertical** (one node per lane): same spine went **400×1490px, 0 crossings** vs **2031×750**. **Implication:**
  horizontal lanes for short/branchy diagrams; **vertical for long linear ones**; don't promise a folded
  layout the monotonic cursor can't build.
- **Gotcha — switching the active diagram is a browser-side race.** `new`/`use` only moves the server's
  *active pointer*; the open tab does **not** auto-switch instantly. `new` then `--post` back-to-back made
  the bridge apply commands to the **still-loaded old canvas** (drew the new state machine on top of the
  freeform → 78 merged shapes), and when the human then switched in the UI the app **saved the polluted
  in-memory canvas to the old diagram's file**. **Correct sequence:** `new`/`use` → **wait for the browser
  to actually switch** (poll `context` until it shows the target/empty diagram, or have the human confirm)
  → **then** `--post` → `wait` → verify. The bridge also lags: `wait` can return with `pending>0`; re-poll
  until `pending:0` before trusting `context`.
- **Root limitation + tooling requests (sent to the DiagramTalk dev agent, 2026-06-24).** Nearly every
  readability problem traces to **straight-line arrows** (anchor-to-anchor segments): any non-adjacent edge
  slices intermediate boxes, which is why the "shared-edge" anchor trick is needed at all. Requested,
  prioritized: **(1)** a `clearDiagram` command + `layout --replace` (kills the manual `Ctrl+A`/delete and
  the merge race); **(2)** a **render/screenshot endpoint** (`GET /api/diagram/render`) so the agent can
  *see* and self-verify — today it's blind, leaning on the human's eyes + numeric `context`, which
  undercuts the skill's own "confirm with your eyes" rule; **(3)** **orthogonal/elbow arrow routing** (the
  deep fix — needs the engine's `find_arrow_crossings` to check the *routed* path too); **(4, engine-side,
  agent-ownable)** non-monotonic / snake 2D placement + self-loop edges.
- **Source:** Claude, 2026-06-24, working session integrating DiagramTalk and redrawing the AgentTalk
  consensus protocol as a state machine. Channel + gotchas also recorded in agent memory
  (`diagramtalk-channel`, `prefers-visuals-with-prose`). Specs in the DiagramTalk clone's scratchpad
  (`consensus-statemachine.json`, `consensus-sm-vertical.json`).

### LB-19 · 2026-06-24 — [tooling/method] DiagramTalk tooling delivered; the see→fix→see loop and its findings (continues LB-18)
- **What happened.** Fausto's DiagramTalk dev agent shipped every capability LB-18 requested, in three
  rounds, and we drove the AgentTalk consensus state machine to a **banked vertical layout** (`v3`) through a
  real *see→fix→see* loop. This entry records the engineering findings; LB-18 holds the rationale/stance.
- **Tooling now available (DiagramTalk @ `2261d83`):** **(1)** `clear` + `layout --replace` (clear-then-post,
  kills the manual delete + merge race); **(2)** `render --out file.png|svg` (browser-bridge exports the
  tldraw canvas to an image — the agent can finally *see*); **(3)** `--diagram <id>` on shape/connect/clear/
  layout/render (targets any diagram and **auto-switches** the open tab to it — removes the LB-18 switch
  race); **(4)** `routing: "orthogonal"` per edge (tldraw **elbow** arrows; the engine's `find_arrow_crossings`
  follows the routed path so checker and renderer agree); **(5)** `setCamera` view command + `camera` MCP
  (`--fit` / `--top-left [--margin]` / absolute `--x --y --zoom`).
- **Finding — the render endpoint immediately earned its keep; geometry is blind to text.** Dry-run said
  `ok: True, 0 crossings` and was *right about boxes* — but the first render exposed problems the physical
  check **cannot** see because it ignores labels entirely: **mid-word wrapping** inside boxes ("Discussio n",
  "Work Complete d") and **arrow-label/box collisions**. This is the concrete proof of the skill's "confirm
  with your eyes" rule: the collision checker validates *rectangles*, not *legibility*. **Always render and
  look — a clean dry-run is necessary, not sufficient.**
- **Finding — box auto-size under-estimates the real font → set explicit `w`.** `estimate_label_size` uses
  `CHAR_WIDTH = 8.5px`, which is narrower than tldraw's actual render font, so a single word the engine
  thinks fits 140px (e.g. "Discussion") overflows and breaks mid-word. Lane nodes now accept an explicit
  **`"w"`** (`node.get("w") or auto_w`); setting a uniform generous width (we used `w:190`) both **kills the
  wrap** and **aligns the column**. Keep pseudostates narrow (`w:110`).
- **Finding — elbow routing needs somewhere to bend; in a vertical spine that means a gutter.** `routing:
  "orthogonal"` alone *keeps the same lane* — an elbow between two `left` anchors at the **same x** degenerates
  to a straight vertical line (no bow). To make back-edges bow **out**, the spine needs a **side gutter** to
  bend into (set `originX` to leave room): we put the consensus **back-loops in a left gutter** and the
  **error transitions in a right rail** to `Interrupted`. With that, elbow routing turned the error fan into a
  clean axis-aligned rail and the loops into real back-transitions.
- **Gotcha — published `context` lags an apply; re-poll before trusting coords.** After `--replace`, a coord
  read returned the *previous* layout's `min x/y` (stale browser publish); a second poll showed the correct
  values. `wait` (`pending:0`) confirms commands *applied*, not that the browser has *re-published* context —
  re-read until stable.
- **Gotcha — shape coords ≠ viewport; "top-left" is a camera op.** Pinning shapes to `(40,40)` does **not**
  put the diagram top-left *on screen* — tldraw auto-fits/centers the camera. There was no camera command at
  all until `setCamera`; framing the view is a **separate** action from placing shapes (`camera --top-left`).
- **Residual limitation (banked, acceptable).** tldraw anchors an **elbow arrow's label** to the segment near
  the box exit (and, on a *long* multi-bend arrow, to a bend rather than the visual middle) — so the two loop
  labels still **overlap the spine boxes** and "user reject" floats toward the top of its arrow. There is **no
  label-position control** exposed in the API to fix this from the spec; it's a tldraw/bridge concern. Fausto
  judged it *"more than bearable"* and we **banked `v3`** as the canonical vertical state machine. Future
  request if it matters: expose per-edge arrow-label placement.
- **Source:** Claude, 2026-06-24, continued DiagramTalk session. Final banked spec:
  `consensus-sm-v3.json` (scratchpad); rendered to `sm-v3.png`. Continues [[LB-18]].
