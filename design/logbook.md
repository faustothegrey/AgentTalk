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
  path). See `design/reprime-mechanism.md` *(renamed from `…-proposal.md` + actualized to the role-keyed model 2026-06-27)*.

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


### LB-20 · 2026-06-25 — [M10/protocol] Phase-1 spike findings — graded-brain injection map, the dual-kill, and "both paths are prompt-and-parse today"
> **Nature:** read-only design-spike result for M10 (plan: `milestone10-protocol-compliance-plan.md`). No
> production code changed. Answers the plan's DQ1/DQ2/DQ3.

- **DQ1 — Injection map (the affordance data already exists; the loop is half-built).** The brain already
  owns everything the graded design needs, server-side, in `team-coordinator.ts`:
  - **Phase truth** — `planningPhases` map + `getPlanningPhase(taskId)` (`:862`). The legal set per phase is a
    pure function of this (deterministic, scriptable — as argued).
  - **Legal set already computed AND already sent** — `taskExpectedResponses` map; `expected_response_types`
    is attached to the turn payload (`:462`) and echoed through `translation.ts` (`:17`). So "restate the
    current affordance each turn" is **~half-implemented today** — it's sent, but as an advisory field, not an
    enforced constraint.
  - **Validation** — the brain reads the agent's `message_type` (`:441`) and guards it against the phase
    (`throw 'Unexpected agreement_proposal: planning phase is …'`, `:514/:592`). The prose briefing
    (`:335-359`) tells the model the orchestrator enforces on `message_type`, not text.
  - **Partial graded loop already present** — `handleAgreementReachedFallbackToDiscussion` (`:788`) does a
    **bounded** correct-and-retry (back to discussion, capped by `MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS`).
    And `parseWithRetry` (`translation.ts:88`) is a one-shot retry — but **only on malformed JSON**, not on an
    illegal-but-well-formed move.
  - **Single-tool collapse point** = `translateStructuredResponse` (`translation.ts:11-82`): a `switch` mapping
    each `message_type` → a distinct MCP `call`. Collapsing to one `consensus_respond(action,payload)` is a
    change *here* + the `STRUCTURED_MESSAGE_TYPES` enum (`response-schema.ts:16-28`).
- **DQ2 — Peer-safe eject: it does NOT exist today; the dual-kill is real and is a single shared sink.**
  Every protocol-violation / agent-failure-during-planning path funnels into
  **`interruptPlanningForMissingEvents` (`:1702-1747`)**, which sets `task.status='interrupted'` +
  `team.status='interrupted'`, deletes `currentTaskId`, and **shuts down *every* planner** (loop `:1733-1742`).
  Callers: `handleAgentFailure` during planning (`:1482`), agreement non-compliance, fallback exhaustion,
  out-of-set `message_type`, fact-collection timeout. So one planner's bad move tears the whole round down and
  kills the peer — exactly [[LB-7]]/[[LB-8]]. The **only** non-killing path is `pauseTaskForOperator` (`:1529`,
  the M08-T3 fence) and it's worker-exec-crash-only. **Phase 2 must add a new `ejectPlanner(agentId)`** — a
  separate path (mirroring how `pauseTaskForOperator` is separate from `handleAgentFailure`) that removes only
  the offender and keeps the surviving planner alive. **Open product decision:** consensus needs 2 planners, so
  "eject one" forces a choice — degrade to solo-submit, or fail-soft the round — but **either way the peer must
  not be killed as a side effect.** This is where the real engineering risk lives, as predicted.
- **DQ3 — Enforcement reach: BOTH paths are prompt-and-parse *today*; the hard levers are greenfield, not a
  retrofit.** The API path (`api-client.ts`) is OpenAI-compatible `/chat/completions` over providers
  openai/deepseek/gemini, and sends at most `response_format:{type:'json_object'}` (`:7/:65`) — loose "valid
  JSON", **no** `tools`/`tool_choice`/`strict`/`enum`. The reply is free-text JSON run through
  `parseStructuredResponse`. So the model-distrust intuition is **correct about the system as it stands** — we
  parse text and hope, on every path. The optimization (per-call tool set + `tool_choice` + strict `enum`) is
  *available* on the API path via the OpenAI-compatible tool API (per-provider: OpenAI strict yes; deepseek /
  gemini-via-OpenRouter **verify**, don't assume) but is **not used yet**. MCP path: narrowing the
  `consensus_respond` `action` enum per `await_turn` = update the tool's `inputSchema` + `tools/list_changed`;
  whether each harness (`agy`/`claude`/`codex`) re-reads it and *binds* the model vs *suggests* is unmeasured
  (live per-harness probe deferred — needs the harnesses + budget). **Verdict unchanged: enforcement is an
  optimization, the graded loop is the floor on every path.**

- **Phase-2 task breakdown (proposed; Phase-2 is its own plan, written after this):**
  1. **Single tool.** Collapse `translateStructuredResponse` + the `message_type` set into one
     `consensus_respond(action, payload)`; brain reads `action`, validates vs `taskExpectedResponses`.
  2. **Generalised graded loop.** Promote the existing agreement-only bounded fallback into a *general*
     per-turn ladder: out-of-set `action` → correct + retry (restate the current legal set), bounded N, then →
     eject. Reuse `parseWithRetry`'s shape; extend from "malformed" to "illegal move".
  3. **🔴 Peer-safe `ejectPlanner`.** New non-killing path; the load-bearing risk. Decide degrade-vs-fail-soft
     for the 1-planner state. Regression-test that ejecting A leaves B alive and the round resolves.
  4. **(Optional, separate) API-path enforcement optimization.** Add `tools`+`tool_choice`+strict `enum` on the
     `api-client.ts` request so the API path skips the retry round-trip; per-provider verified. Not a gate.
- **Source:** Claude, Phase-1 design spike, 2026-06-25 (read-only; weekly 46% / session 23% at run). Grounds
  [[LB-10]]; feeds the M10 plan. No files changed except this entry + the plan.


### LB-21 · 2026-06-25 — [DiagramTalk/M10] Recording + state-tags facility → live protocol-flow visualization
> **Nature:** capability finding + forward design intent (Fausto). Not yet built on the AgentTalk side.

- **New DiagramTalk version** (`6020867`/`2682688`/`eaf2128`) adds two primitives that enable watching the
  consensus protocol flow **live** on a diagram:
  - **`tag` / `setStateTag`** — a **movable, view-only current-state badge** on **box shapes only**; reuse the
    same `--tag-id` to move it (`tag shape:<box> "<label>" --tag-id <id> --color …`; `--clear` to remove).
  - **`record start|end|list|show`** — a **timed run log** of bridge-applied `highlight`/`tag` events
    (`occurredAt`/`elapsedMs`), persisted to `.diagramtalk/recordings/`, in visible-apply order. No
    playback/replay endpoint yet.
- **By design, not limitations (Fausto, 2026-06-25):** a recording **freezes base-diagram persistence** (a
  fixed "stage" so the timeline has a stable coordinate system); the **open tab is the viewing surface**; and
  **tags being box-only** enforces the right grammar — **`tag` = states (boxes), `highlight` = transitions
  (arrows)**. Only genuine residual = replay not built (secondary when watching live).
- **Intended use (feeds M10 Phase-2):** draw the agent **state-machine** (the M10 "Graded Protocol Brain"
  phase boxes already are the states), then an **orchestrator→DiagramTalk bridge** fires `tag`/`highlight` as
  `team-coordinator` advances phases — two badges (`planner-a`/`planner-b`) slide across the spine, transitions
  pulse, the whole round wrapped in a `record`. **Missing piece = that bridge** (lives where the phase
  transitions already are). Discipline: draw → `record start` → drive overlays → `record end` → re-edit.
- **Status:** sketchy / to-be-designed; Fausto will shape it. Full how-to + the grammar in agent memory
  `diagramtalk-channel`. Continues [[LB-19]].
- **Source:** Claude, 2026-06-25, after reading the new DiagramTalk version (read-only on that repo).

### LB-22 · 2026-06-25 — [M10/DiagramTalk] The orchestrator→DiagramTalk bridge — built + live-verified (delivers LB-21's "missing piece")

- **What shipped.** The bridge LB-21 named as the missing piece now exists, v1 = **forward spine only**. The
  protocol brain stays **pure**: `team-coordinator.ts` gained one private `setPlanningPhase()` funnel (the 6
  `planningPhases.set` sites route through it) firing an **optional** `onPhaseChange` dep; `registry.ts`
  re-emits it as a `team_planning_phase` event (mirrors `emitTeamTask`); a new
  `apps/orchestrator/src/diagramtalk-bridge.ts` maps each phase → box+edge and POSTs `setStateTag`/`highlight`
  to `${DIAGRAMTALK_URL}/api/diagram/commands`. **Best-effort, never blocking, OFF unless
  `AGENTTALK_DIAGRAM_BRIDGE` is set** (same discipline as the usage meter); a throwing hook / unreachable
  diagram / closed tab never perturbs a run.
- **Spine map:** `protocol_ack_pending`→`ack` · `fact_collection`→`facts`/`e1` · `discussion`→`disc`/`e2` ·
  `proposal_pending_endorsement`→`prop`/`e3` · `submittal_pending`→`submit`/`e5`. The `endorse` box + `e4` and
  the eject/correction overlay (`o1–o6`) are intentionally **v2**.
- **🔑 Finding — live shape ids carry a `shape:` prefix.** DiagramTalk addresses shapes by their tldraw id =
  the layout's logical id prefixed (`ack` → `shape:ack`, `e1` → `shape:e1`). The bridge emitted bare ids → a
  **silent no-op** (best-effort = no error). Caught by reading the live `context` *before* driving; fixed with
  a documented `shapeRef()` transport prefix (idempotent). **Lesson: a best-effort bridge fails *silently* —
  verify ids against the live canvas, the green gate won't catch a wrong id.**
- **Live proof (no LLM budget):** drove the real bridge (`attachDiagramTalkBridge` → registry event →
  `bridge.onPhase` → HTTP) through all 5 phases against Fausto's loaded M10 diagram; command log shows all
  `applied` in spine order (`ack → facts/e1 → disc/e2 → prop/e3 → submit/e5`), badge walked, edges pulsed.
- **Telemetry (closure):**
  - task:        M10 DiagramTalk-bridge v1 (LB-21 follow-up)
  - wall-clock:  2026-06-25 ~21:18 → ~21:46 CEST (~28 min)
  - budget:      weekly 51%→53% (Δ ~2%), session 16%→… [per /usage, updated 21:44]
  - gate:        tsc 0, suite 198/198 (185 + 13 new), pollution clean
  - diff:        7 files (3 src +3 test +this note), +421/-6; commits `988b721` (v1 spine) + `0a2f7cc` (clear-on-start)
  - outcome:     MERGED ✅ to master (ff at `0a2f7cc`) — LIVE-VERIFIED twice; gate 198/198 post-merge
- **Source:** Claude, 2026-06-25. Continues [[LB-21]]; pairs with memory `diagramtalk-channel`.

### LB-23 · 2026-06-26 — [M10/DiagramTalk] Bridge v2 — record-for-replay via recording commands (cross-repo)

- **What shipped.** Optional **record-for-replay** on the live bridge: when `AGENTTALK_DIAGRAM_RECORD`
  is set (default **OFF** → default run unchanged), the bridge opens a DiagramTalk recording as a run
  enters the root phase and closes it at submittal. A recording **auto-captures** exactly the
  `highlight` + `setStateTag` events the bridge already emits, so there is **no extra per-phase
  wiring** — the bridge only opens/closes. It only ever closes a recording **it opened** (captures the
  returned id; no id → no-op), so it never ends one it didn't start. Best-effort/never-blocking as ever.
- **🔑 Decision — start/stop are first-class COMMANDS, not a separate REST resource.** v1 of this work
  (earlier same session) drove recording via DiagramTalk's standalone `POST /api/diagram/recordings` +
  `PATCH /recordings/{id}` REST endpoints. To keep the bridge on **one** endpoint, Fausto had the
  DiagramTalk agent add `startRecording`/`endRecording` as lifecycle **commands** on the shared
  `/api/diagram/commands` stream (DiagramTalk commit `a698b43`). The bridge was then rewired onto them:
  everything (tag/highlight/start/stop) now rides `post()` → `/api/diagram/commands`. `startRecording`
  returns the new id at **`command.result.recordingId`**; `endRecording` closes it via **`input.id`**
  (server 409s if a mismatched `diagramId` is also sent — we only send the id we own, so it matches).
- **Cross-repo flow (worth noting as a pattern).** Claude (AgentTalk) **specced** the command contract →
  the DiagramTalk agent **implemented** it server-side (additive; the REST endpoints still exist) →
  Claude **verified the shipped contract by reading their code** (not the spec) and rewired the bridge to
  it. The "don't trust, verify" rule applied across repos: confirmed `command.result.recordingId` /
  `input.id` / the 409 guard from `app/api/diagram/commands/route.ts` before touching the bridge.
- **⚠️ Live smoke RUN 2026-06-26 → exposed a real defect; see [[LB-24]].** Emission is correct (the live
  badge-walk works, same as v1), **but record-for-replay capture is lossy/non-deterministic** (4–8 of ~11
  events; submit frame always lost). The earlier claim here that "the replay ends on the same frame the
  live run does" is **RETRACTED** — disproven twice. Fix belongs DiagramTalk-side (capture-timing race).
- **Still pending (the original LB-22 "v2" basket, minus record):** the `endorse` box + edge `e4` and
  the eject/correction overlay (`o1–o6`) — both need **new brain-emitted phases**, a separate scope
  decision (out of "changes on the bridge alone").
- **Telemetry (closure):**
  - task:        M10 DiagramTalk-bridge v2 (record-for-replay)
  - wall-clock:  2026-06-26 ~06:10 → ~06:55 CEST (~45 min, incl. the REST→command rewire)
  - budget:      weekly 54%→57% (Δ ~3%), session 0%→27% [per /usage, updated 06:57]
  - gate:        tsc 0, suite 204/204 (198 + 6 new), pollution clean
  - diff:        2 files, +182/-11; commit `d3db0d0`
  - outcome:     COMMITTED ✅ to master (`d3db0d0`, unpushed); emission OK but replay-capture defective → [[LB-24]]
- **Source:** Claude, 2026-06-26. Continues [[LB-22]]; pairs with memory `diagramtalk-channel`. T4 plan
  (`design/milestone10-t4-api-enforcement-plan.md`, commit `bf36d62`) drafted same session, awaiting go.

### LB-24 · 2026-06-26 — [M10/DiagramTalk] Live smoke of bridge-v2 record-for-replay → capture-timing race (real defect)

- **Method (non-polluting).** Drove the REAL bridge (`dist/diagramtalk-bridge.js`, `record` on) against a
  **disposable scratch diagram cloned from M10's snapshot** (exact `shape:*` ids), paced so the badge-walk
  is watchable; deleted the scratch + reactivated M10 after. **M10 itself was never targeted.** Two runs:
  (1) my curl standing in for the browser's apply step (synchronous), (2) the real browser as sole renderer.
- **Result — emission ✅, capture ✗.** The bridge emits the right commands in the right order; the live
  badge-walk renders correctly (Fausto watched it on the cloned stage). **But the recording is lossy:**
  - run 1 (synchronous apply): `eventCount=8` — `ack…prop`, **submit frame dropped**.
  - run 2 (real async browser): `eventCount=4` — `[setStateTag:ack, highlight:e1, e2, e3]` only; most
    `setStateTag` frames + `e5` dropped. **Same feature, different capture purely by apply timing.**
- **🔑 Root cause — async-apply vs sync-close race.** DiagramTalk captures a command into a recording ONLY
  when the browser posts its `applied` result *while the recording is open*
  (`recordAppliedCommand`, `app/api/diagram/commands/[id]/result/route.ts`). `startRecording`/`endRecording`
  apply **server-side synchronously**; tag/highlight apply **asynchronously** (browser poll). The bridge
  emits then closes on its own clock, so anything the browser hasn't applied by close-time is silently lost
  — **not just the terminal frame; lossy and non-deterministic throughout.**
- **Consequence.** **Record-for-replay is NOT reliable as wired.** Unit tests pass only because they mock a
  synchronous `fetch`; the real async browser breaks it. Bridge *emission* is sound and unaffected.
- **Fix belongs DiagramTalk-side** (the bridge can't fix it without a forbidden sleep-hack): capture should
  be tied to the command being enqueued-for-an-open-recording, OR `endRecording` should drain/await pending
  commands for the diagram before closing. Written up as a finding for the DiagramTalk agent (relayed via
  Fausto), same cross-repo pattern as the `startRecording`/`endRecording` command work.
- **Corrections made (honesty).** Retracted the false "replay mirrors the live run" claim in the bridge
  header + `onPhase` comment and in [[LB-23]]; both now point here.
- **Resolution (Fausto, 2026-06-26).** (1) Recording stays **OPT-IN** — `AGENTTALK_DIAGRAM_RECORD` /
  the `record` option are **kept** (a brief decision to delete the flag, commit `25ab372`, was reversed —
  see commit reverting it). (2) DiagramTalk fixed the capture race **internally**: capture is now server-side
  **AT ENQUEUE** (`recordEnqueuedCommand`, DiagramTalk `cd27775`), independent of the browser's async apply.
  **Re-verified live 2026-06-26: `eventCount=10` — full spine incl. the submit frame** (was 4–8 with frames
  dropped). The "lossy/not-guaranteed" caveats in the bridge header + `onPhase` are updated to match. **Closed.**
- **Source:** Claude, 2026-06-26. Continues [[LB-23]]; pairs with memory `diagramtalk-channel`.

### LB-25 · 2026-06-26 — [M10/protocol] T4 API-path enforcement — tools+tool_choice+strict enum (declare-unfit, no probe)

- **What.** Promoted M10-**T4** from deferred to implemented. On the **API path**, a structured planner turn now
  sends an OpenAI-compatible function tool `respond(message_type, message_payload)` with `tool_choice:'required'`,
  where `message_type` carries a strict `enum` **derived from `STRUCTURED_MESSAGE_TYPES`** (one source of truth).
  Off-list structural actions become **unrepresentable at generation time** instead of being caught post-parse.
  The tool-call `arguments` ARE the existing envelope, so `parseStructuredResponse` + the T2 grading loop are
  reused verbatim — **it's an emission-layer optimization, not a behavior/authority change** (the brain stays the
  sequence authority).
- **Scope.** 3 source files only (`response-schema.ts` +`buildProtocolToolSchema`, `api-client.ts`, `completer.ts`)
  + 3 test files. Brain / MCP path / registry / wire-contract **untouched**. Gate: `tsc -b` 0, suite **213/213**
  (204 baseline +9), pollution clean.
- **Decisions (Fausto).** **D-T4-1** static enum · **D-T4-2** declare-unfit — **no** `json_object` fallback
  machinery (a provider that 400s on the combo is "unfit for now," revisit if too restrictive) · **D-T4-3** keep
  `response_format` alongside the tool (accepting some strict servers may reject the combo → unfit).
- **Capability-handshake — considered, declined (the interesting bit).** Idea: ask the agent "what do you support?"
  before relying on tools. Rejected as the **wrong layer**: tool/`response_format` support is a property of the
  **serving HTTP endpoint**, not the model — a text generator can't introspect its server's param handling and will
  hallucinate "yes." The *correct* form is a **transport capability-probe** (one real request, classify by the HTTP
  response, cache) which would also **double as the live-verification we currently lack** — but that reopens D-T4-2
  and adds machinery, so it's **deferred**, not bolted on. Shipped v1 as ship-and-watch.
- **Deliberate deviation.** `message_payload` = generic `object`, not per-type schema (plan §5). The enum is the
  structural guarantee; `validatePayload` stays the payload net. Avoids `oneOf` provider-compat surface.
- **Honesty — owed.** No live-provider call; the combo is **assumed** and unit-tested via injected `fetchFn` only.
  The "unfit on 400" path is untested against a real endpoint (parked; gemini API out of budget).
- **Source:** Claude, 2026-06-26. Implements `design/milestone10-t4-api-enforcement-plan.md`; ledger §T4 in
  `design/milestone10-implementation.md`. Pairs with [[LB-14]] (human-gated closure).

### LB-26 · 2026-06-26 — [M10/DiagramTalk] Bridge v3 — endorse stop + eject/correction overlay (observation-only hook)

- **What shipped.** The two diagram features v1 left dark are now lit, driven by a SECOND brain hook
  `onProtocolEvent` (Registry re-emits `team_protocol_event`), kept SEPARATE from the `onPhaseChange` phase
  funnel so off-spine signals never touch consensus validation (`getPlanningPhase`/`validateProtocolStep`):
  - **`endorsed`** — emitted at the agreement-acceptance site *before* `submittal_pending` → badge stops on the
    `endorse` box + pulses `e4`. Closes the v1 gap where the badge jumped `prop ▶ submit` (v1 mapped
    `submittal_pending→submit/e5`, but `e5` is `endorse→submit`, so `endorse`/`e4` were skipped).
  - **`correction`** (validateProtocolStep retry branch) / **`eject`** (ejectPlanner) → pulse the phase's
    eject/correction lane (`oN` edge + `l-*` node) in violet / red. Phase→lane: ack→o1/l-ack, facts→o2/l-facts,
    disc→o3/l-disc, prop→o4/l-prop, submit→o6/l-submit (transient `endorse` has no funnel phase → o5 unused).
- **Brain stays pure.** 3 **additive emit-only** sites + an `emitProtocolEvent` helper (same try/catch-swallow
  discipline as the phase funnel). With the hook unset (all non-bridge wiring) behaviour is byte-identical —
  pure observability, decides nothing, feeds nothing back. Pre-authorised by Fausto's scope decision; the
  approach choice (observation-only hook vs extending the PlanningPhase machinery) was **his** (Rule-2 safety).
- **Ordering fix (app layer).** `endorsed` and `submittal_pending` fire back-to-back in ONE synchronous handler;
  the Registry dispatches both fire-and-forget, so their HTTP posts could interleave and flip the badge. The
  bridge now serialises ALL commands through a single non-rejecting tail-promise queue → post order == emission
  order. Unit-proven (a deliberately-slow `endorse` tag is shown to block the following `submit` tag).
- **🔑 Live finding — the badge-walk caught a real defect the unit tests structurally couldn't.** The v3 default
  `correctionColor:'orange'` is **not** in DiagramTalk's `HIGHLIGHT_COLORS {yellow,blue,green,red,violet}`
  (`app/api/diagram/commands/route.ts`) → **HTTP 400, dropped best-effort** on the first live run. Unit tests
  passed because they inject a mock `fetch` that doesn't validate the palette — **same class of gap as LB-24**
  (mocked sync fetch hides a real server contract). Fixed: default → **violet**; the bridge test now drops the
  explicit colour so it **pins a valid in-palette default**. Verified against the shipped contract by READING
  DiagramTalk's route (cross-repo "don't trust, verify" — same pattern as LB-23). Re-walk clean (8/8 accepted),
  Fausto visually confirmed the `endorse` stop + both lanes.
- **Tech-debt noted (Fausto's prompt).** Two emission shapes now coexist (`onPhaseChange` funnel vs
  `onProtocolEvent`); logged in `design/backlog.md` as "Unify protocol state-change event emission" (low
  priority). Explicitly NOT the same thing as the `AGENTTALK_DIAGRAM_RECORD` flag (that's opt-in record gating).
- **Telemetry (closure):**
  - task:        M10 Bridge-v3 (DiagramTalk overlay)
  - wall-clock:  2026-06-26 ~12:30 → ~13:15 CEST (~45 min, incl. live badge-walk + orange→violet fix)
  - budget:      weekly 62%→65% (Δ ~3%), session reset mid-task (79%→new window, 28% at close)
  - gate:        tsc 0, suite **225/225** (213 baseline +12 new), pollution clean
  - diff:        6 mod + 2 new (plan + `protocol-event-hook.test.ts`); commit `53593a4`
  - outcome:     MERGED ✅ — ff to `master` at `53593a4` + pushed
- **Source:** Claude, 2026-06-26. Implements `design/milestone10-diagramtalk-overlay-plan.md`; ledger §Bridge-v3
  in `design/milestone10-implementation.md`. Continues [[LB-22]]/[[LB-23]]/[[LB-24]]; pairs with memory
  `diagramtalk-channel`.

### LB-27 · 2026-06-26 — [llm-client] Standalone exec-only MCP attach server (`@agenttalk/mcp-exec-server`)

- **What shipped.** The consensus-free "third-party app chats via an MCP CLI executor" path — Option B of the
  Phase-2 fork. Two new packages: **`@agenttalk/mcp-transport`** (the generic `McpServer`, `git mv`'d out of
  `apps/orchestrator`; a pure `ws` leaf — sockets/JSON-RPC/ping/hijack, zero domain knowledge) and
  **`@agenttalk/mcp-exec-server`** (deps: `mcp-transport` + `llm-client` types only) which injects the EXEC
  SUBSET (`await_turn` + `submit_exec_result`) into `McpServer`, backed by one `ExecTurnQueue` per agentId, and
  exposes `McpExecServer.transport(agentId): ExecTransport` for an `McpChatCompleter` to complete turns over.
- **🔑 The finding that shrank it.** `McpServer` was ALREADY generic and consensus-free — parameterised by
  injected `tools` + `handler`; ALL consensus lived in the orchestrator's injected `AGENTTALK_MCP_TOOLS` +
  `registry.handleMcpToolCall`. So Option B was NOT "write a WS server" — it was reuse `McpServer` + inject a
  lean exec tool-set + a minimal queue. The orchestrator's consensus server is untouched (only its `McpServer`
  *import path* moved: 1 line).
- **Decisions (Fausto).** D1 extract `McpServer` → shared `mcp-transport` (vs duplicate). D2 names. D3 v1 queue
  = minimal single-flight, NO M08 reconnect/re-delivery (a chat turn is short; `McpServer`'s ping layer already
  reaps dead sockets). D4 contract-hash UNSET for v1 (the exec subset is a strict subset → a full
  agentalk-mcp-client still attaches).
- **Verification.** Unit tests for `ExecTurnQueue` (both dispatch/await orders, result fan-out, disconnect) + an
  **end-to-end test over a REAL WebSocket**: an in-test echo executor (real MCP wire protocol) connects,
  long-polls `await_turn`, returns `submit_exec_result`; `McpChatCompleter` resolves the echoed text. Plus the
  no-executor → typed timeout case. Gate: tsc 0, suite **245/245** (239 +6).
- **Bug caught (honesty).** My first integration-test client sent tool calls as bare `method:'await_turn'`
  instead of the MCP `tools/call` envelope (`params.name`) — server correctly returned `-32601 Method not found`.
  Fixed the TEST harness (added a `callTool` wrapper); the server code was right. Real agentalk-mcp-client uses
  `callTool()`, which does the correct envelope.
- **⚠️ OWED → ✅ CLOSED (2026-06-26).** The owed live smoke against a **real `agentalk-mcp-client` CLI** is done:
  `scripts/smoke-mcp-exec-server.mjs` spawns the actual `llm-agent.mjs` (real `McpClient` + `executor-runtime` +
  node-pty, persistent mode) pointed at a real `McpExecServer` over a real socket; the CLI long-polls `await_turn`,
  receives the `{type:'exec_rpc', prompt}` turn, and returns `submit_exec_result`; `McpChatCompleter` resolves the
  text + mapped usage. The LLM provider is replaced by a fake persistent bridge via `AGENTTALK_PERSISTENT_COMMAND_JSON`
  (same hook the client's own `exec-rpc.test.ts` uses) so **no provider CLI runs and no budget is spent** — everything
  else (socket, JSON-RPC framing, contract handshake with hash-gate UNSET per D4, await_turn/exec_rpc/submit round-trip,
  the executor-runtime bridge protocol) is real. PASS ×2 (deterministic); suite still 245/245. Stand-alone like the
  other live gates (NOT in the vitest suite — it spawns an external CLI from a separate repo). The only thing still
  unexercised is a **real LLM provider** end of the bridge (gated on provider budget) — the transport/protocol path
  itself is now proven against the real client.
- **Telemetry (closure):**
  - task:        llm-client Phase 2 — mcp-exec-server (Option B)
  - wall-clock:  2026-06-26 ~14:40 → ~14:55 CEST (~55 min incl. McpServer extraction + e2e test debug)
  - budget:      weekly 67%→70% (Δ ~3%), session 51%→84% (Δ ~33%, multi-package + e2e heavy)
  - gate:        tsc 0, suite 245/245 (239 +6), pollution clean
  - diff:        6 mod + 2 new packages (mcp-transport, mcp-exec-server) + 2 git-mv renames; commit `b67a6ce`
  - outcome:     MERGED ✅ — `b67a6ce` on `master` + pushed; live CLI smoke closed by `e3f85c4`/`4fb2a69`
- **Source:** Claude, 2026-06-26. Implements `design/mcp-exec-server-plan.md`. Continues the llm-client
  extraction ([[LB-14]] gating); pairs with `design/llm-client-architecture.md`.

---

### LB-28 · 2026-06-26 — [attach] Live 1:1 chat verified end-to-end: web UI ⇄ real `agentalk-mcp-client` → `claude` CLI

- **What was tested (and why now).** A plain **single-agent chat** in the web UI, with the agent's turn
  executed by the **real external** `agentalk-mcp-client` CLI driving the real `claude` CLI — the M05/M06
  attach path, re-exercised for the **first time on the current (post-M10) codebase**. Prompted by the
  mcp-exec-server work: before doing more on the *consensus-free* chat path, confirm the *real product's*
  1:1 attach chat still works hands-on. **It does.** No UI development was needed — the UI already has agent
  creation, selection, a `Send message…` composer (`App.tsx`), and the receive/display (`MessagesView.tsx`);
  the backend already has the `message → message_received → exec_rpc → submit_exec_result → agent_message`
  round-trip.
- **Setup.** `npm run backend` (Express+browser-WS :3000 + the **dedicated-port** MCP server) + `npm run
  frontend` (vite :5173). Agent `chat-1` created in the UI (form default provider label = gemini). Client:
  `AGENTTALK_PERSISTENT_MCP_URL=ws://localhost:56020/ node llm-agent.mjs --provider claude --agentId chat-1`.
- **Evidence (backend log, abridged).**
  ```
  [McpServer] Connection established for agentId=chat-1
  [Registry] MCP tool call from chat-1: await_turn {}
  [Server] Sending message to agent chat-1: ciao agent chat-1
  [Registry] Sending EVT ... {"type":"message_received","from":"user","payload":"ciao agent chat-1"}
  [Agent chat-1] ready -> busy
  [Registry] MCP tool call from chat-1: submit_exec_result { text: "...Ciao! ... I'm here and ready ..." }
  [Server] Agent message from chat-1: "...Ciao! ..." → 1 client(s)
  [Agent chat-1] busy -> ready
  [Registry] MCP tool call from chat-1: await_turn {}
  ```
  A real `claude` reply rendered in the browser (Fausto confirmed visually).
- **Findings (durable).**
  1. **`ready` is immediate and correct, before any client attaches.** For a `claude`/`codex`/`gemini`-labelled
     agent, `activateAgent` starts an `InProcessAgentDriver` with an **`McpCompleter`** (`registry.ts` ~213-230)
     — the driver marks the agent `ready` (loop up), but every turn is **delegated** to the external client
     (`McpCompleter.complete` queues `{type:'exec_rpc'}` and waits for `submit_exec_result`, default **120s**
     timeout). `ready` ≠ "answers on its own"; only a `provider:'api'` agent uses an in-process `ApiCompleter`.
  2. **The MCP attach endpoint is a DEDICATED random port with path `/`, never `:3000/mcp`.** The client's
     default URL is `ws://localhost:3000/mcp`; against this orchestrator that hits the Express server →
     `Unexpected server response: 400` + reconnect loop. **You must pass `AGENTTALK_PERSISTENT_MCP_URL` =
     the dedicated port from the backend log** (`[Server] ... MCP server listening on ws://localhost:<port>/`).
     This was the one real stumble in the live run. (Root cause = the documented WS-collision fix.)
  3. **Provider label vs real model.** Orchestrator-side provider only selects `McpCompleter`; the `exec_rpc`
     carries only `{prompt}`. The client's `--provider` decides the actual CLI. A "gemini"-labelled agent
     answered by a `--provider claude` client is normal — they only share the **agentId**.
  4. **Cosmetic artifact (client-side, NOT AgentTalk).** The reply was prefixed with claude CLI meta text
     (*"Let me check my memory for context on this project and user."*). That's the **client's** provider
     output-parser leaking thinking into the response — a `agentalk-mcp-client` concern (separate repo;
     relay-only). Worth a follow-up there; AgentTalk just relayed what the client submitted.
- **Reproduction.** Full operator steps + troubleshooting captured in **`design/attach-chat-runbook.md`**
  (the old `attach-harness.mjs` is gone, so that runbook is now canonical).
- **Telemetry (task closure):**
  - task:        live 1:1 attach-chat verification (web UI ⇄ real mcp-client → claude)
  - wall-clock:  2026-06-26 ~17:30 → ~18:10 CEST (~40 min, mostly exploration + the env-var stumble)
  - budget:      claude session ~0%→27% (Δ ~27%, heavy read/explore), weekly 72%→74% (Δ ~2%)
  - gate:        no code change to app/engine; build green; live round-trip ✅ (real claude reply in UI)
  - diff:        docs only — `design/attach-chat-runbook.md` (new) + this LB-28 entry
  - outcome:     VERIFIED ✅ — 1:1 attach chat works on the current codebase
- **Source:** Claude, 2026-06-26. Pairs with `design/attach-chat-runbook.md`; relates to [[LB-27]]
  (mcp-exec-server, the consensus-free sibling path) and the M05 attach mode.

---

### LB-29 · 2026-06-26 — [process] Session primers re-keyed by ROLE, not by agent (key lives in the shared header)

- **Trigger.** Adding **Codex as a planner-reviewer** (alongside Claude) broke the implicit 1:1 agent↔role
  mapping the primer system relied on. Fausto's insight: *"the primer is the brief for the next planner-reviewer,
  whoever that is — two different primers for two different roles is fine; two different primers for the **same**
  role is wrong."* Correct — the primer **body is the role's context**, but it was filed under the **agent's** name.
- **The design smell.** Primers were keyed by agent (`claude-primer.md`, `gemini-primer.md`) with the routing key
  copied as `active` into each agent's **private** store. The moment two agents share a role, "share the key" meant
  seeding the same `active` into two private stores — but **no agent can write another's store**, so every handoff
  needed the human as a relay. The key was in the wrong place.
- **The fix (approved by Fausto).** Key the primer by **role**, and put the key's authority in the **shared primer
  header** (in the repo), not in private stores:
  - Files: `claude-primer.md → planner-reviewer-primer.md`, `gemini-primer.md → implementer-primer.md` (git-mv'd;
    history preserved).
  - **Eligibility map in AGENT.md:** planner-reviewer → **Claude *or* Codex**; implementer → **Gemini**.
  - The key sits in the **shared** header, so every eligible reader sees the *same* key — "the right key ⇒ the
    right primer." Private store is now just `{ consumed: [] }` — a per-agent "have I already stopped on this key?"
    marker (so a restart doesn't re-stop). **No more `active`, no cross-store seeding, no relay.**
  - Handoff = overwrite the role-primer body + mint a fresh header key. Whoever is launched (of the eligible set)
    finds the key ∉ their `consumed` → fresh → report+STOP+consume in *their* store.
  - **Collision guard unchanged & now load-bearing:** the key does NOT route to one actor; if two eligible agents
    cold-start the same fresh primer, each independently reports-and-STOPs and **the human picks who proceeds**.
- **Trade-off (honest).** We lose the old `== active` "addressed specifically to me" cryptographic feel; the new
  guarantee is "fresh key + I'm role-eligible" + the human-go gate. Acceptable for our context (key in a
  git-tracked file, human in the loop).
- **Migration done.** AGENT.md First Entry Point + Writing/Bootstrap/Receiving/Re-priming sections rewritten;
  both primers renamed with `role:`/`key: none` headers (bodies kept as historical); Claude's private store
  migrated to `{consumed:[]}`. **Codex and Gemini stores are pending their first run** (bootstrap = create
  `{consumed:[]}` at their stable private dir — Codex e.g. `~/.codex/agenttalk-session-primer-key.json`).
- **Note on [[LB-12]]:** its illustrative filenames (`claude-primer.md`/`gemini-primer.md`) are now
  `planner-reviewer-primer.md`/`implementer-primer.md`; the finding (the `-primer.md` suffix avoids
  case-insensitive auto-load) is unchanged.
- **Source:** Claude, 2026-06-26, at Fausto's direction. Canonical change to `AGENT.md` (the primer protocol).

---

### LB-30 · 2026-06-26 — [process] Role-keyed primer review — two planner-reviewers edge cases tightened

- **What was reviewed.** Codex, acting as the newly bootstrapped **planner-reviewer** co-eligible with Claude, reviewed
  the LB-29 role-keyed primer mechanism against `AGENT.md`, the role-primer files, and the actual repo state. Repo
  ground truth at review time was `master`/`origin/master` at `063ff0c`; the onboarding brief's `b409b97` pointer was
  stale but explicitly allowed "or newer."
- **Findings.**
  1. The old "primer pasted at the top of chat" language conflicted with the new shared-header authority: a pasted
     brief has no role-primer header key and no private-store consume target.
  2. First-time bootstrap text overgeneralized: a missing store would cold-start-stop on a real fresh key, but
     `key: none` still short-circuits to "no fresh primer."
  3. The inactive role-primer bodies were correctly marked historical in their headers, but still contained old
     `active`-key wording that could mislead a cold reader who skimmed past the header.
  4. LB-29's "Codex store pending" line is now historical: Codex's store has been seeded at
     `~/.codex/agenttalk-session-primer-key.json`; Gemini remains pending.
- **Resolution.** `AGENT.md` now states that the cold-start Session Primer lives in the keyed role-primer file. A
  pasted human brief while `key: none` is just a normal brief to verify; it does not trigger private-store consumption
  and is not a substitute for a fresh keyed handoff. Bootstrap wording now distinguishes real fresh keys from
  `key: none`. Both inactive role-primer bodies now carry an explicit warning that stale body text is historical and
  the current handshake is the shared-header/`consumed` protocol.
- **Verification.** Docs-only patch; checked with `rg`, `git diff --check`, and `git status`. No build/test run needed
  because no code, scripts, package config, or test contracts changed.

---

### LB-31 · 2026-06-27 — [process] Re-prime validation findings: header key is authority; status docs were stale

- **Trigger.** Fausto re-primed Codex as planner-reviewer after the role-keyed primer work. Codex consumed the fresh
  shared header key `20260627-0613-56824e` in its private store and performed the required read-only verification.
- **Findings.**
  1. The primer body still mentioned the older key `20260626-1951-e6d338`, but the authoritative YAML header carried
     `key: 20260627-0613-56824e`. Per AGENT.md, the header key is the handshake authority; Codex used the header.
  2. Local `master` and `origin/master` were both at `b72fa9b`, so the primer body's "local master ahead of origin"
     warning was stale by the time Codex verified it.
  3. Bridge v3 records in the M10 ledger/plan still said "uncommitted" / "pending Fausto's call", but git showed
     `53593a4` (`feat(M10): DiagramTalk bridge v3 — endorse stop + eject/correction overlay`) as an ancestor of
     current `master`. The status text has been corrected to MERGED.
  4. The mcp-exec-server plan/logbook similarly still said "uncommitted" / "live CLI smoke owed", but git showed
     `b67a6ce` as the merged implementation and `e3f85c4`/`4fb2a69` as the smoke-script/live-smoke closure commits
     on current `master`. Those status lines have been corrected to MERGED / smoke closed.
- **Verification.** Docs-only status correction; checked with `git status`, `git log`, `git merge-base --is-ancestor`
  for `53593a4` / `b67a6ce` / `e3f85c4` / `4fb2a69`, and targeted `rg`. No build/test run needed because no code,
  scripts, package config, or test contracts changed.

---

### LB-32 · 2026-06-27 — [process] Role-boundary escalation: Scrum Master owns ambiguous assignments

- **Trigger.** During Codex's planner-reviewer turn, Fausto intentionally used wording that could invite the
  planner-reviewer to start implementation. Codex planned the next implementable task instead of implementing it,
  then Fausto clarified the desired rule.
- **Rule added.** Startup/fresh-primer reports must end by clearly declaring the agent's current role. If a requested
  action falls outside that role, the agent must stop, report the mismatch, may propose alternatives, and must ask the
  Development Orchestrator / Scrum Master for an authoritative course-of-action decision. The agent then does what
  the Scrum Master decides.
- **Role definition.** `design/collaboration-workflow.md` defines the Scrum Master function generically as the
  authority for task-assignment ambiguity. `AGENT.md` records the current project-specific holders/delegates: Fausto
  by default, with Hermes Agent allowed when Fausto explicitly assigns it that function.
- **Verification.** Docs-only process amendment; checked with `rg` and `git diff --check`. No build/test run needed
  because no code, scripts, package config, or test contracts changed.

---

### LB-33 · 2026-06-27 — [review] Claude (planner-reviewer) review of Codex's `36cbf81` work

- **Trigger.** Fausto's session objective: review Codex's planner-reviewer output — commit `36cbf81`
  (`docs(process): record role-boundary workflow and T4 probe plan`; Fausto-committed, Codex-authored) plus the
  refreshed `planner-reviewer-primer.md`. Read-only verification against git ground truth, no deference.
- **Verdict.** Strong planner-reviewer work; two completeness gaps worth learning from. Nothing is a correctness
  defect.
- **What held up (verified).**
  1. **Status-correction discipline (LB-31)** is the standout: Codex distrusted the docs, found Bridge-v3 /
     mcp-exec-server records claiming "uncommitted/pending/owed" while git showed them merged, and verified with
     `git merge-base --is-ancestor` before rewriting. Re-checked all five commits (`53593a4`, `b67a6ce`, `e3f85c4`,
     `4fb2a69`, `d0462b6`) — every corrected status line is accurate.
  2. **Role-boundary docs are well-layered:** generic Scrum Master *function* in `collaboration-workflow.md`
     (agent-neutral), concrete *holder* (Fausto default, Hermes when delegated) in `AGENT.md`. LB-32 records the
     provenance honestly.
  3. **The primer Codex wrote** is action-oriented, enumerates the commit's contents, and correctly flags the T4
     probe as DRAFT-not-approved.
- **Gap 1 — the LB-31 stale-status sweep was scoped, not exhaustive.** The same status vocabulary survived in a
  sibling doc Codex didn't sweep: `design/llm-client-extraction-spike.md` still said *"Phase 2 core ✅ done
  (uncommitted)"* though `McpChatCompleter` was committed at `877577c` (on `master`, verified). **Corrected here**
  (see that file's status line). *Lesson:* a status-correction pass should declare its scope and `rg` the whole
  `design/` for the status vocabulary (`uncommitted`, `pending Fausto`, `HUMAN-GATED`, `owed`) — fix all instances
  or explicitly note "scoped to X; siblings unchecked". A half-swept correction is itself new drift.
- **Gap 2 — T4 probe plan import inaccuracy (assigned back to Codex).** `design/milestone10-t4-live-probe-plan.md`
  §3 tells the implementer to import `buildProtocolToolSchema()` / `parseStructuredResponse()` "from
  `@agenttalk/runtime-core`'s built output", but runtime-core has **no package-root barrel** — its `exports` map
  only exposes subpaths (`./agents/*`, `./registry/*`, …), so the package-root import won't resolve. Correct
  specifier: `@agenttalk/runtime-core/agents/response-schema.js`. No existing script imports these helpers, so the
  probe is the first — the exact specifier should be pinned in the plan so Gemini (who STOPs on surprises) doesn't
  bounce it back as a blocker. Otherwise the plan is approve-worthy (explicit IN/OUT scope, honest classification
  taxonomy, per-provider retry budget, unfitness-is-data exit-code discipline). **Decision (Fausto): pass this fix
  back to Codex as author** — reviewer flags, author revises; better learning loop than a silent patch. See baton
  below.
- **Minor.** The role-boundary rule appears 3× in `collaboration-workflow.md` (roles-list bullet + standalone
  paragraph + principle #9); correct across files, mildly repetitive within the one file. Not actioned.
- **Verification.** Docs-only review + one status correction (`llm-client-extraction-spike.md`). Checked with
  `git merge-base --is-ancestor` (`53593a4`/`b67a6ce`/`e3f85c4`/`4fb2a69`/`d0462b6`/`877577c` all on `master`),
  package `exports`-map inspection (`packages/runtime-core/package.json` — no root barrel), and `rg` for the
  status vocabulary. No build/test run needed: no code, scripts, package config, or test contracts changed.

---

### Baton — Claude (reviewer) → Codex (author), 2026-06-27

Codex: one actionable from the LB-33 review, scoped to a doc you own. **Fix the import specifier in
`design/milestone10-t4-live-probe-plan.md` §3 "Implementation approach".** It currently says to import the protocol
helpers from `@agenttalk/runtime-core`'s built output; that package has **no root barrel** (its `package.json`
`exports` only exposes subpaths like `./agents/*`), so a package-root import won't resolve. Pin the exact specifier
the implementer should use: `@agenttalk/runtime-core/agents/response-schema.js` for both `buildProtocolToolSchema()`
and `parseStructuredResponse()` (or a direct `dist/agents/response-schema.js` path, matching the precedent of other
live scripts — note there is currently **no** script importing these, so you're setting the precedent). Docs-only;
no scope change to the probe plan otherwise. The plan stays DRAFT-for-review after the fix.

---

### LB-34 · 2026-06-27 — [process] Scrum Master owns role reassignment and go/no-go gates

- **Trigger.** Fausto clarified the workflow after the T4 probe-plan import correction: role reassignment authority
  and go/no-go decisions should not be inferred by agents.
- **Rule added.** The Scrum Master, and only the Scrum Master, may make go/no-go decisions and reassign or de-assign
  roles on the fly as necessity arises. If the Scrum Master is not human, it must document the reason for each
  assignment or de-assignment in a durable project artifact.
- **Agent turn check.** `AGENT.md` now requires each agent, before acting on a turn assignment, to check whether the
  assignment complies with `design/collaboration-workflow.md`, its current role, and current Scrum Master authority;
  on mismatch or ambiguity, the agent reports, stops, and waits for the Scrum Master's go/no-go.
- **Verification.** Docs-only process amendment; checked with targeted `rg` and `git diff --check`. No build/test run
  needed because no code, scripts, package config, or test contracts changed.

---

### LB-35 · 2026-06-27 — [process] Corrected over-documentation of a planning pass

- **Request.** Fausto asked the planner-reviewer to plan the M10-T4 live probe task before deciding go/no-go.
- **What happened.** Codex updated `design/milestone10-t4-live-probe-plan.md` with an implementer task plan, but also
  added a logbook entry that merely restated the planning update.
- **Why that was wrong.** The plan file is the source artifact for this task. Recording the planning pass itself in
  `design/logbook.md` was redundant logbook noise; the logbook should capture durable findings, decisions, corrections,
  operational results, or process lessons, not every ordinary plan edit.
- **Amendment.** Removed the redundant planning-entry content and replaced it with this correction record at Fausto's
  request. The implementer task plan remains in `design/milestone10-t4-live-probe-plan.md`; no implementation approval,
  live provider call, or runtime behavior change has occurred.

---

### LB-36 · 2026-06-27 — [review] Claude review of T4 live-probe plan (post-LB-33 fix) — two nuances for the implementer hand-off

- **Trigger.** Fausto asked Claude for an independent opinion on the T4 live-probe planning state (Codex `900a79b` →
  `fa1bd13`) before a Scrum Master go/no-go. Read-only verification against git ground truth.
- **Verdict.** Plan is implementer-ready; the LB-33 import fix is correct; the LB-35 over-doc correction is the right
  discipline. No correctness defects. Two nuances worth recording so the eventual implementer (Gemini, who STOPs on
  surprises) doesn't bounce them back as blockers.
- **Verified.** Import specifier `@agenttalk/runtime-core/agents/response-schema.js` resolves (exports map exposes
  `./agents/*.js` → `./dist/agents/*.js`; dist file present; `buildProtocolToolSchema`/`parseStructuredResponse`
  exported). Provider table in the plan matches `packages/llm-client/src/api-client.ts` exactly. Suggested probe
  envelope `ack_planning_protocol` + `{}` is an accepted type (`response-schema.ts:283`), so a real success classifies
  as `fit`, not a false `invalid_arguments`. Probe script absent (review-only). 7 commits ahead of origin, docs-only.
- **Nuance 1 — import style diverges from script precedent; flag it as intentional.** *Every* existing live script
  imports compiled helpers by **relative dist path** (`../packages/runtime-core/dist/...`), not the bare
  `@agenttalk/...` specifier. The bare specifier *does* resolve here (workspace symlink `node_modules/@agenttalk/runtime-core`
  + subpath exports — both verified), so it is **not wrong**, just stylistically new. Recommend one line in the plan:
  "bare specifier is intentional; resolves via the workspace symlink + `exports` subpaths." Otherwise the implementer
  may STOP on it as an unexplained deviation from the precedent set by `test-live-gate.mjs` et al.
- **Nuance 2 — full-suite gate vs a script-only change.** §4 DoD + §6 list the full suite as a gate, but this task adds
  one standalone `.mjs` that touches no package source. Running the whole suite is harmless but arguably more than the
  change warrants; §4 already hedges "unless Fausto explicitly scopes a narrower gate." A Scrum Master note on whether
  the full-suite gate is required for a script-only addition would remove the ambiguity at go/no-go.
- **Verification.** Docs+repo read-only: `exports`-map inspection, `rg` of script import styles, `node_modules`
  symlink check, message-type enum check, `git diff --stat origin/master..master`. No build/test run (nothing in code,
  scripts, package config, or test contracts changed).

---

### LB-37 · 2026-06-27 — [process] Added the missing Reviewer Rules of Engagement (governance-doc audit, item 5)

- **Trigger.** A governance-doc consistency audit (Claude, planner-reviewer) found that `codex-onboarding-brief.md`
  referenced "AGENT.md → ⛔ IMPLEMENTER/**REVIEWER** RULES OF ENGAGEMENT", but AGENT.md only had the *Implementer*
  RoE. The reviewer's duties existed but were **scattered** across `collaboration-workflow.md` §1 (Reviewer role),
  principle 2 (verify-don't-assert), §3b (verify-by-running, verdict column, merge-only-when-VERIFIED, never create
  the branch) and §3c (the symmetry rule) — no single imperative contract for half the team.
- **Decision (Fausto).** Consolidate into a new **`⛔ REVIEWER RULES OF ENGAGEMENT`** sibling section in `AGENT.md`
  (the "law" for both roles lives in AGENT.md), pointing into `collaboration-workflow.md` §3b/§3c for method detail —
  chosen over putting it in the workflow doc, to keep both RoE contracts symmetric and in one place.
- **What landed.** Seven imperative rules (verify-by-running; no-deference/steelman; verdict needs a recorded run +
  evidence; merge is the reviewer's only branch action + verified-only mainline; distrust docs/primer; record
  behavioural misses in `implementer-pitfalls.md` don't fix silently; symmetry — dispose of every implementer
  signal), a gold-standard example, and a back-pointer added in workflow §3b. The previously-dangling onboarding-brief
  reference now resolves.
- **Verification.** Docs-only; `rg` confirmed the new section exists and the inbound reference resolves; `git diff
  --check` clean. No build/test run (no code, scripts, package config, or test contracts changed).
- **Context.** Part of a multi-item governance audit; staleness/polish items (1–4, 7, 9–12) already applied; the two
  remaining substantive items are role-boundary exception documentation (item 6) and consolidating the ~7×-stated
  Scrum-Master authority rule (item 8).

---

### LB-38 · 2026-06-27 — [process] Scrum Master decision: standing conditional reassignment for implementer-unavailable (audit item 6)

- **Trigger.** The governance audit (item 6) found that the only place the "Gemini out of budget → planner-reviewers
  are effectively the implementer" idea lived was a casual aside in the now-archived `codex-onboarding-brief.md` —
  implying a *silent blanket* exception, which contradicted both the strict role map (`implementer → Gemini`) and the
  per-occurrence-documentation rule for reassignments. The reassignment *mechanism* was already documented; a
  *standing dated policy* for the recurring case was not.
- **Ground truth at decision time.** Reassignment precedent exists (`backlog.md:181`, "Claude as implementer,
  reassigned", 2026-06-21). Meter showed `antigravity 0% used` (unreliable per the known-limits note). Fausto
  confirmed **Gemini is AVAILABLE now**.
- **Decision (Scrum Master: Fausto, 2026-06-27).** Recorded a **STANDING CONDITIONAL REASSIGNMENT** in `AGENT.md`
  (under Workflow Rules → Respect role boundaries): *while Gemini (designated implementer) is unavailable, a
  planner-reviewer (Claude or Codex) MAY also implement code/tests* — merge stays **human-gated**, the ⛔ Implementer
  Rules of Engagement + M06 behaviour-change/show-stopper rules + scope discipline all apply unchanged, and the actor
  declares its dual role. It **lapses automatically when Gemini returns**. This is the *one* pre-authorized exception
  to "STOP before implementing"; every other out-of-role request still follows STOP-and-ask. It satisfies LB-34
  (Scrum Master owns reassignment; reason documented in a durable artifact).
- **Current status: DORMANT.** Because Gemini is available now, `implementer → Gemini` is the live default and this
  grant is **not** in effect; it activates only while the trigger (Gemini unavailable) holds.
- **Verification.** Docs-only; the AGENT.md note carries the trigger/grant/limits/revoke/reason/status fields. No
  build/test run (no code, scripts, package config, or test contracts changed).
- **Adjacent (not actioned here).** Gemini being back is the reopen condition for the parked TODO "run the Gemini
  live gate when budget returns" (`node scripts/test-mcp-gate.mjs gemini`, provider-parity for the v5 contract) —
  flagged to Fausto, out of scope for item 6.

---

### LB-39 · 2026-06-27 — [process] De-duplicated the Scrum-Master authority / role-boundary rule (audit item 8) + audit closeout

- **Trigger.** The governance audit (item 8) found the Scrum-Master-authority + per-turn-role-boundary rule restated
  **~7×** across `AGENT.md` (two overlapping Workflow-Rules bullets) and `collaboration-workflow.md` (§1 Scrum Master
  bullet, §1 "Roles are functions" para, §1 "Role-boundary before action" para, §2 principle 7 tail, §2 principle 9).
  Each restatement was a drift risk and the wordings had already diverged slightly.
- **Decision (Fausto).** Reduce to **one canonical statement + pointers**, meaning-preserving (de-dup only, no rule
  change):
  - **Canonical full rule** = the Scrum Master bullet in `collaboration-workflow.md` §1 (where the role is defined);
    augmented to also carry the per-turn compliance-check sentence so it fully subsumes the others.
  - **Operational restatement** = one merged bullet in `AGENT.md` (kept deliberately, since AGENT.md is the
    always-loaded turn-1 file — an agent shouldn't have to jump docs for the basic rule); points to §1 as canonical
    and retains the project-specific facts (Fausto holds SM; Hermes delegate) + the LB-38 standing-reassignment block.
  - **Pointers** (no longer full copies): §1 "Roles are functions" (authority/reason clause → pointer, keeps its
    unique "stated explicitly in relay+ledger" point), §1 "Role-boundary before action" para, and §2 principle 9.
- **Invariants checked preserved** (via `rg`): non-human-SM "document the reason" duty, "stated explicitly in relay
  and ledger", the per-turn compliance check, and "only the Scrum Master may reassign/de-assign or decide go/no-go".
- **Verification.** Docs-only; `git diff --check` clean; meaning-preservation confirmed by grepping each invariant
  still has a home. No build/test run (no code, scripts, package config, or test contracts changed).
- **Audit closeout.** This completes the governance-doc consistency audit (items 1–12). Done this session: staleness
  fixes 1–4 + 10–11, polish 7 + 9 + 12, and the three substantive items — 5 (Reviewer RoE, LB-37), 6 (standing
  conditional reassignment, LB-38), 8 (this entry). **One sub-task remains open:** bootstrapping Gemini's private
  key store (spun out of item 6) — blocked on agy reporting its stable, non-repo, non-ephemeral private path; AGENT.md
  line ~353 still reads "agy/Gemini is pending its first run" until then.

---

### LB-40 · 2026-06-27 — [process] Bootstrapped Gemini/agy's private key store (closes the item-6 sub-task)

- **Trigger.** Item-6 readiness gap: agy was the live implementer default but its private key store had never been
  created (AGENT.md read "pending its first run"). agy's self-report had asserted it "checks a private store" without
  confirming the store existed — an over-confident claim that `key: none` had masked. Per AGENT.md bootstrap step 1,
  the stable path was obtained from agy via Fausto (relay), not guessed.
- **What agy reported.** Stable path `/Users/fausto/.config/AgentTalk_Gemini` — chosen because agy's own
  `~/.gemini/antigravity-cli` tree is a **write-protected/ephemeral per-session sandbox** (a hardcoded security
  boundary blocks writes there). agy verified persistence by writing + re-reading throwaway files.
- **Reviewer verification (Claude).** Confirmed the dir exists, is **outside the repo**, is a standard persistent
  `~/.config` (XDG) dir (not `/tmp`, `/var/folders`, or the `.gemini` sandbox), and is writable from the machine
  where the store is seeded. Removed agy's throwaway `test.json`/`test2.json`.
- **Action.** Seeded `~/.config/AgentTalk_Gemini/session-primer-key.json` = `{ "consumed": [] }` (with the standard
  `_comment` explaining the role-keyed model, mirroring Claude's/Codex's stores). Flipped AGENT.md from "pending its
  first run" → "bootstrapped 2026-06-27 at `~/.config/AgentTalk_Gemini/session-primer-key.json`".
- **Effect.** All three agents now have durable private stores (Claude `~/.claude/projects/…`; Codex `~/.codex/…`;
  Gemini `~/.config/AgentTalk_Gemini/…`). The next time a fresh-keyed `implementer-primer.md` is handed to Gemini,
  its cold-start consume will persist correctly. **This closes the last open thread from the governance audit.**
- **Verification.** Store file present + valid JSON; AGENT.md line updated; `git diff --check` clean. The store lives
  outside the repo, so it does not appear in the repo diff (by design).

---

### LB-41 · 2026-06-27 — [process] The priming loop, end-to-end (who writes the brief, who verifies what)

- **Why this is here.** A recurring confusion is conflating *writing* a primer with *receiving* one, and treating
  the primer as the source of truth. This diagram pins the full loop so a cold reader gets it in one look. *(The
  canonical rules are `AGENT.md → Session Primer` + `First Entry Point`; this is the picture behind them.)*

```
  Fausto assigns task (Scrum Master go)
        │
        ▼
  planner-reviewer WRITES implementer-primer   ← the "previous session did this" brief
   (task + state pointers + FRESH key)            (first time: planner-reviewer; later: prior agy session)
        │
        ▼
  fresh agy launches → READS it → key is fresh →
   gather context, VERIFY vs ledger, report, STOP, consume key   ← the cold-start (receiving) half
        │
        ▼
  Fausto gives explicit go → agy implements
        │
        ▼
  at close, agy WRITES the next implementer-primer (+ fresh key)
        └──────────────► loops back for the next agy session
```

- **Two load-bearing clarifications the diagram encodes:**
  1. **Someone has to *write* the brief, and for the *first* implementer task that is NOT the implementer.** The
     current `implementer-primer.md` is `key: none` (historical) — no implementer session has ever closed and left
     one. So the first brief is authored by the **planner-reviewer** (carrying Fausto's task assignment); from agy's
     *second* session onward, each agy turn writes the primer for the next at close. An agent does **not** author its
     own cold-start primer (self-priming crosses no context boundary and would have the implementer assign itself
     work — against the §1 Scrum-Master-owns-assignment rule).
  2. **The ledger is the source of truth; the primer is the pointer — verify, don't trust.** A primer is a *claim
     about state*, possibly stale/over-optimistic. The receiver reads it to orient, then **grounds every load-bearing
     claim against the ledger/git**; if they disagree, the ledger wins and the primer is the bug. "Determine what's
     next" means **confirm** the assigned task and where it stands — the implementer doesn't self-pick work; the task
     traces to Fausto's go + the plan's DoD.
- **Origin.** Fausto ↔ Claude exchange clarifying the priming model right after agy's key-store bootstrap (LB-40).

---

### LB-42 · 2026-06-27 — [finding] OpenRouter confirmed as a live-test API gateway (+ verified free-model shortlist)

- **Finding.** `OPENROUTER_API_KEY` is present in the env and the OpenRouter gateway works end-to-end from this
  machine. `GET https://openrouter.ai/api/v1/models` returns **339 models** (2026-06-27); a `/chat/completions` ping
  to `meta-llama/llama-3.3-70b-instruct` returned `pong` (20 prompt + 2 completion tokens). OpenRouter is already in
  the `api-client.ts` provider table (`openrouter` / `OPENROUTER_API_KEY` / `openrouter.ai`), so it's a usable live
  gateway with no code change — one key fronts a large multi-vendor pool behind an OpenAI-compatible surface.
- **Free-tier caveat (verify, don't assert).** The `:free` tier is **rate-limited / intermittent** —
  `google/gemma-4-31b-it:free` returned *"Provider returned error"* on one attempt then succeeded on another. Many
  free "reasoning"/"thinking" models (nvidia `nemotron-*:free`, `liquid/lfm-2.5-1.2b-thinking:free`,
  `poolside/laguna-*:free`) respond but spend the token budget on a `reasoning` field and return null `content` at
  low `max_tokens`. The cleanest free instruct picks were `google/gemma-4-26b-a4b-it:free` and
  `google/gemma-4-31b-it:free` (both gave a terse `pong`). **Don't gate a required check on a `:free` model**; use a
  cheap-paid fallback (`meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4o-mini`) when reliability matters.
- **Where the maintained list lives.** Curated, growing reference: **`design/live-test-models.md`** (gateways +
  verified free models + cheap fallbacks + how to add more). The logbook records the finding; the doc holds the
  living list (logbook is append-only and can't maintain it).
- **Verification.** Live `curl` to `/models` and `/chat/completions` with the env key; pass/fail probed across ~10
  free models. Raw pings only (not yet routed through `packages/llm-client`); a through-the-client live ping is the
  natural next step if we want to exercise the real `callApi()` path.

---

### LB-43 · 2026-06-27 — [process] Refined the Scrum Master role: three standing duties + allowances

- **Trigger.** Fausto wanted the Scrum Master elevated from a mostly-reactive authority (resolve ambiguity, decide
  go/no-go, reassign roles) to a role with **proactive standing duties**. Three goals given: bring forth the backlog,
  check workflow adherence, monitor resource consumption.
- **Decision (Fausto, all three confirmed).**
  - **(A) Backlog:** the SM **convenes the backlog gate** (§3b) and sets work priority/sequencing; the
    architect/reviewer still does each item's technical disposition.
  - **(B) Resource:** the SM owns the **aggregate** cross-actor budget view (warn/scope/halt to fit budget);
    per-actor self-monitoring (`AGENT.md` → Resource Expenditure Monitoring) is **unchanged** — oversight on top.
  - **(C)** Applies to **both** a human SM and an agent SM (Hermes), with the record-the-reason duty falling on the
    non-human one.
- **What landed.** Canonical text added to `collaboration-workflow.md` §1 (the SM's home per LB-39): three standing
  duties, an **Allowances** line (assign/reassign + go/no-go + convene the backlog gate + halt/rescope work), and a
  **Boundaries** line (go/no-go ≠ doing the work; SM routes code to the implementer, doesn't implement silently).
  `AGENT.md` carries pointers only (no duplication, per LB-39): the role-boundary bullet now names the three duties +
  points to §1, and the Resource-Expenditure section notes the SM's aggregate oversight on top of per-actor
  self-monitoring.
- **Verification.** Docs-only; `git diff --check` clean. No build/test run (no code, scripts, package config, or test
  contracts changed).

---

### LB-44 · 2026-06-27 — [process] Scrum Master as communication channel + baton facilitator (SM duty 4)

- **Trigger.** Fausto extended the SM refinement (LB-43): the SM becomes the **communication channel** between
  agents/roles and is to **proactively favor effective communication** and **drive agents to align on a course of
  action**. Specific RoE deferred; the above is the guiding principle. Primarily instructs an **AI-SM**; a no-op when
  the human is SM.
- **Guardrails agreed (Claude proposed, Fausto confirmed all).**
  1. The SM channel **complements the durable-artifact bus, never replaces it** — substance still gets written down;
     not a verbal side-channel that bypasses the ledger.
  2. "Align on a course of action" = converge on a **decision / unblocking**, **never** on accepting an unverified
     claim — **adversarial verification (principles 1–2) is preserved**.
  3. Encouraged proactive reporting is **additive to, not a softening of**, the mandatory STOP gates (out-of-role,
     show-stopper, blocker remain mandatory).
  4. Channel **implementation is out of scope** (an implementation detail); but with no channel in place an AI-SM
     cannot operate. Don't overstate plumbing that may not exist.
- **Baton stance (Fausto).** Baton stays **role→role**; the SM **ensures it lands** and points at the right
  artifacts but does **not** rewrite it (pre-chewed-summary anti-pattern); the SM **may override** a baton, but that
  is **not** the standard flow.
- **What landed.** `collaboration-workflow.md` §1: new **SM duty 4** (communication channel & baton facilitator)
  with the four guardrails + baton stance baked in; the "Human relays" bullet and the "Defining constraint"
  paragraph generalized so the relay is the SM's channel function (human when human-SM, delegated AI-SM when a
  channel exists). `AGENT.md`: a new Workflow-Rules bullet — *report to the SM freely (encouraged), additive to the
  mandatory gates* — and a baton-section note (SM ensures-it-lands, override is non-standard). Pointers only in
  AGENT.md; canonical text in §1 (per LB-39).
- **Verification.** Docs-only; `git diff --check` clean. No build/test run (no code, scripts, package config, or test
  contracts changed).

---

### LB-45 · 2026-06-27 — [process] Per-agent lessons-learned files (self-authored, session-close, read-back at start)

- **Trigger.** Fausto: at session close each agent should record a brief lessons-learned entry so it sharpens its
  effectiveness over time — **agent-declined** (Claude its own, Codex its own, Gemini its own, Hermes when it joins).
- **Why it's the *good* kind of process.** It's *earned by real experience* and compounds — the opposite of the
  pre-written-for-hypotheticals bloat flagged earlier this session. Kept deliberately minimal.
- **Design (Fausto confirmed: per-agent files, in-repo).** New `design/lessons/<agent>-lessons.md` (claude, codex,
  gemini, hermes), append-only, dated, **1–3 bullets** each (what worked / what didn't / do differently).
  **Self-authored — each agent writes only its own.** Chosen over (i) the shared logbook (would mix private
  reflection into cross-cutting facts — the LB-35 noise concern; no clean "each its own") and (ii) out-of-repo
  private files (loses transparency + cross-agent learning). In-repo keeps it durable, visible, auditable.
- **The loop (so it doesn't rot).** **Write** at session close (with the Session Primer); **skim your own at session
  start** (a turn-1 read). Write-only is worthless — the read-back is the point ("teeth or it rots", cf. logbook).
- **Distinctness.** vs `logbook.md` = shared cross-cutting *facts*; vs `implementer-pitfalls.md` = *reviewer*-authored
  case law about the *implementer*; lessons = *self*-authored reflection by *each* agent on *how it works*.
- **What landed.** Four files created (claude seeded with a real first entry; codex/gemini/hermes are header +
  "no entries yet" — each authors its own). `AGENT.md`: write-rule under Session Primer + read-back line in First
  Entry Point. `collaboration-workflow.md` §3: artifact-table row. No-op when a human is in the loop; guidance for
  the agents.
- **Verification.** Docs-only; `git diff --check` clean. No build/test run (no code, scripts, package config, or test
  contracts changed).

### LB-46 · 2026-06-27 — [M10/protocol] Live probe results for API structured-tools (M10-T4)
- **Finding:** The live probe `scripts/probe-t4-api-tools.mjs` was run against OpenRouter, Nous, and Google.
  1. `openrouter` (with `openai/gpt-4o-mini`): **FIT**. The endpoint correctly accepts `tools` + `tool_choice:'required'` + `response_format: {type: 'json_object'}` and returns the envelope via `tool_calls`. Note: It requires the prompt to contain the word "json" (standard OpenAI requirement), otherwise it 400s. The probe script was adjusted to include "Respond in JSON." to correctly test the structure.
  2. `google` (with `gemini-2.5-flash`): **HTTP_REJECT**. Returns `HTTP 400: Forced function calling (ANY mode) with a response mime type: 'application/json' is unsupported`. Google explicitly rejects this combination.
  3. `nous` (with `deepseek-v4-flash`): **HTTP_REJECT (404)**. The default model `deepseek-v4-flash` is missing from their catalog.
- **Implication:** The M10-T4 hypothesis holds: `openai/gpt-4o-mini` via OpenRouter supports the strict structured tools combo seamlessly. However, `google` explicitly rejects it. Thus, the D-T4-2 "declare-unfit" decision correctly flags `google` as unfit for this protocol variant until they support the combination, or fallback machinery is built. The `nous` provider needs its default model updated (see LB-1).
- **Source:** Live run of `scripts/probe-t4-api-tools.mjs` (M10-T4-live-probe task implementation).

### LB-47 · 2026-06-27 — [llm-client] Spike VERIFIED DONE; three-layer doc staleness corrected
- **Trigger:** asked to prime a planner to "tackle the `@agenttalk/llm-client` extraction spike" as the next backlog
  item. Cold-start ground-truth check (Reviewer Rule 5 / the verify-don't-assert discipline) found the **premise
  false** — the work was already merged to `master`.
- **Three-layer staleness found:** (1) backlog line said `[open · SPIKE/proposed]` (read as not-started);
  (2) the spike doc status said Phase 1+2-core done but "the concrete WebSocket/MCP adapter is the **remaining owed
  piece**"; (3) **git reality** = Phase 1 (`eae6321`) + Phase 2 core (`877577c`) + Phase 2 Option B standalone
  `@agenttalk/mcp-exec-server` (`b67a6ce`) + owed-gap live smoke (`4fb2a69`) + operator runbook (`e1524ba`), all on
  `master`. Lineage of LB-31/LB-33 (sibling-doc drift the earlier sweeps missed).
- **Reviewer verification (run, not asserted):** `tsc -b` 0; full suite **245/245**; `@agenttalk/llm-client` is a
  zero-dep leaf with no runtime-core/registry/consensus imports (grep-clean) exporting
  `ChatSession`/`ApiCompleter`/`McpChatCompleter`; **`npm run smoke:exec` PASSED** — the real `agentalk-mcp-client`
  CLI completed a turn through `McpExecServer` over a real socket (text + usage round-tripped; fake bridge ⇒ no LLM,
  no budget). → marked **VERIFIED DONE** in the spike doc + backlog.
- **Lesson:** picking "the next backlog item" must pass the §3b gate — verify each candidate against git *before*
  priming, or you hand a planner a phantom task. The verify step here turned an assumed implementation task into a
  doc-reconciliation + verification closure.

### LB-48 · 2026-07-01 — [process] Split the fused "Product Owner / Architect" into two distinct roles
- **Trigger:** Fausto (PO) asked to better define the **Architect** as a role *distinct from* the Product Owner —
  the Architect defines the **epic goal, resources, and feasibility together with the PO**, and another scrum-team
  member (usually the **Planner**) is asked for a point of view.
- **Resolved model (Fausto's four decisions):** (1) **PO stays apex** — the Architect owns technical shape/
  feasibility and advises, but the PO holds the final word and may overrule any architecture call. (2) The
  **Architect is a designated *agent* role — default Claude** — assigned by the PO per epic, and **must differ from
  that epic's Planner** so the Planner's POV stays an independent second opinion. (3) **Standing tech-arch owner** —
  the Architect owns architecture across the whole lifecycle (incl. mid-flight architecture calls), not only at
  inception. (4) The **Planner's point of view is advisory/non-binding**.
- **What landed:** `collaboration-workflow.md` §1 — the fused "Product Owner / Architect (PO)" bullet split into a
  tightened **PO** bullet (apex, product direction, proposes epics, assigns roles incl. the Architect seat,
  subsumes the SM) + a new **Architect** bullet (agent/default-Claude, standing tech-arch owner, PO-overrulable,
  orthogonal to the SM). Added the **Epic-inception step** to §3b's backlog-gate area (PO+Architect define goal/
  resources/feasibility → Planner advisory POV → PO final word → then `plan.md` is drafted). `plan.md` ownership
  reconciled: **Planner-authored, Architect-owned design** (was ambiguously "architect-owned"). Every apex/
  role-reassignment "Product Owner/Architect" reference across §1/§5 collapsed to **PO**; every architecture/
  feasibility one routed to the **Architect**. `AGENT.md` mirrored: split bullet, Architect added to the standing
  role map (**no cold-start primer** — it's a PO-assigned epic-inception seat, so it's absent from the role→primer
  map by design), `[Human]` origin tag now "PO" hat (the human is PO, not Architect).
- **Note:** the Architect deliberately has **no session-primer/handshake** — it is not a primer-keyed role. If we
  later want cold-start Architect priming, that's a separate mechanism change.

### LB-49 · 2026-07-02 — [infra] Hermes⇄agent tmux channel: why Hermes cannot read Claude's replies (3 defects, measured)
- **Trigger:** PO reported the SM flow "devastatingly blocked" — Hermes sends fine but cannot see what Claude
  streams back through tmux. Full-depth investigation (Claude, reviewer+architect session, PO-directed; the
  earlier file-report workaround was explicitly rejected in favour of root-causing).
- **Transport anatomy:** Hermes → `~/.hermes/scripts/tmux-metrics.sh` (char counters in `~/.hermes/heartbeat/`)
  → `~/.local/bin/agentctl` → tmux. Sessions: `agent-{claude,codex,agy}-<pid>`, 201×48, history-limit 2000.
- **Defect 1 — FATAL for claude, unfixable by capture flags: alternate screen.** Claude Code's TUI runs in
  tmux's alternate screen (`alternate_on=1`; codex/agy = 0). Alt-screen apps never push lines into tmux
  history (`history_size=0` for claude vs 855/706 for codex/agy), so the visible viewport is ALL tmux can ever
  see. **Measured:** `capture-pane -p` = 1,385 chars; `capture-pane -p -S -` = byte-identical 1,385. Long
  replies scroll inside the TUI and are unrecoverable from tmux.
- **Defect 2 — capture is viewport-only for everyone:** `agentctl` `cmd_capture` (line ~714) runs
  `capture-pane -p` with no `-S`. For codex/agy the full reply IS in tmux history but gets discarded;
  `-S - -J` would fix those two (not claude, per defect 1).
- **Defect 3 — Escape-before-send is destructive:** `cmd_send` (line ~674) fires `send-keys Escape` before
  every message "to close TUI modals". In Claude Code (and codex), Esc **interrupts the in-flight turn** — a
  Hermes send racing a generation aborts the reply at the source.
- **Design-intent note:** `agentctl`'s own docstring says tmux sessions are *the user's workspaces* and
  "Hermes orchestra via delegate_task" — screen-scraping agent replies via `agentctl capture` was never the
  designed return channel.
- **Lossless alternative (verified to exist, not yet adopted):** Claude Code writes the full structured
  transcript to `~/.claude/projects/<project-slug>/<session>.jsonl` live (1.1 MB for the current session) —
  every assistant message, machine-readable, zero tmux. Codex/agy have equivalents to verify.
- **Status:** diagnosis only — remediation is a PO decision (options: fix `-S`/Escape in agentctl for
  codex/agy; transcript-tail channel for claude; or return to the designed delegate_task/bus path).
- **Remediation applied (PO go, 2026-07-02, options 1+2):** `agentctl` fixed in `agent-bus` repo
  (`09a2501`; backup `~/.local/bin/agentctl.bak-lb49`): capture for claude now reads the Claude Code session
  transcript (falls back to tmux if absent); capture for codex/agy uses `-S - -J` (measured: codex 43,917
  chars vs ~1.4k viewport); the blind pre-send Escape is removed (accepted cost: an open modal may swallow a
  paste). Hermes call sites unchanged — the fix is entirely inside `agentctl capture`/`send`. Verified live:
  claude capture returned in-progress turn text that never appeared in any tmux screenful.

### LB-50 · 2026-07-02 — [process] Hermes retired from the workflow; Codex = Scrum Master + Planner; PO batons manually until M15
- **Trigger:** PO decision after the LB-49 transport failures compounded: Hermes's agent loop wedged
  (last-response frozen ~15:50 while `awaiting_agent`), batons and reports were dying in the tmux channel,
  and the M14-T2 baton went out while its prerequisite ordering (T1b) was bypassed. "Hermes alone can't do
  the arbiter via agentctl."
- **Decisions (PO, Fausto, 2026-07-02):** (1) **Hermes is out of the process entirely** — `[Hermes]` tag
  retired, no authority; its heartbeat endpoints and git record remain as history. (2) **Codex holds Scrum
  Master + Planner** (declared dual role; seats' disciplines separate; reviewer stays Claude — no
  self-review). (3) **Interim until M15 closes: the PO batons manually via the terminal**, tagging relayed
  SM instructions `[Codex]`. (4) The M15 target picture makes AgentTalk itself the coordination substrate
  (agents attach over MCP; the arbiter holds the threads) — the structural replacement for tmux scraping.
- **Records updated:** `AGENT.md` (SM-status bullet, Origin Tag Protocol rewritten),
  `design/collaboration-workflow.md` §1 (canonical SM standing), planner primer re-minted for the dual role
  (key `20260702-1654-2bd94e`).

### LB-51 · 2026-07-02 — [process] SM next-step call for BL-012 / M15
- **Finding / call:** `npm run backlog:check` reports **BL-012 M15 — Arbiter Consensus, Direct Path** as the
  single `doing` item; BL-010/BL-005/BL-007 remain `deferred`, and there is no `todo` queue item ahead of M15.
- **Operational decision (Codex as SM):** proceed inside M15, not to any deferred backlog item. The immediate
  next action is **Codex planner advisory POV** in `design/milestone15-arbiter-consensus-plan.md`; breakdown and
  implementer baton wait until the PO weighs that POV, per the M15 plan status.
- **Resource read at call:** Codex weekly 71%, 5h 17%; Claude weekly 27%, session 83%; antigravity 39% (best-effort
  `node scripts/usage.mjs`, 2026-07-02 17:03 Europe/Rome).

### LB-52 · 2026-07-02 — [process] SM go for M15 breakdown after PO accepts advisory POV
- **Finding / call:** The M15 planner advisory POV was advisory only; PO accepted proceeding to breakdown in
  session. This satisfies the M15 plan's "PO weighs POV before breakdown" gate.
- **Operational decision (Codex as SM):** Codex proceeds in the planner seat to create
  `design/milestone15-arbiter-consensus-implementation.md` and update the M15 plan status. Implementation remains
  blocked until Claude's Reviewer Gate 1 approves the breakdown.
- **Resource read at call:** Codex weekly 71%, 5h 18%; Claude weekly 27%, session 86%; antigravity 39% (best-effort
  `node scripts/usage.mjs`, 2026-07-02 17:15 Europe/Rome).

### LB-53 · 2026-07-02 — [process] M15 Gate 1 approved; implementer baton authorized for T1
- **Finding / call:** Claude approved the M15 breakdown at Gate 1 with three non-blocking notes; two required
  planner disposition before the implementer baton. Codex dispositioned all three in the M15 ledger.
- **Operational decision (Codex as SM):** mint the implementer primer for **M15-T1 - ArbiterCoordinator skeleton
  + routing** only. T2/T3 stay blocked until T1 is implemented and reviewer-verified.
- **Resource read at call:** Codex weekly 72%, 5h 25%; Claude weekly 28%, session 92%; antigravity 39% (best-effort
  `node scripts/usage.mjs`, 2026-07-02 17:27 Europe/Rome).

### LB-54 · 2026-07-02 — [process] PO appoints Codex as implementation reviewer for this session
- **Finding / call:** PO appointed Codex as implementer's reviewer for this session because Claude's 5h window is
  too tight. Claude has already completed the independent Gate 1 review of Codex's M15 breakdown.
- **Operational effect:** Codex now holds planner + SM + implementation reviewer for this session, with each
  discipline kept separate. This is an explicit PO appointment; merge remains human-gated. Future implementation
  review gates remain a PO call unless the appointment is extended.
- **Resource read at call:** Codex weekly 72%, 5h 25%; Claude weekly 28%, session 92%; antigravity 39% (best-effort
  `node scripts/usage.mjs`, 2026-07-02 17:27 Europe/Rome).

### LB-55 · 2026-07-02 — [process] PO overrules M15-T1 refutation; T1 accepted
- **Finding / call:** Reviewer-run M15-T1 functional/freeze evidence was green (targeted arbiter test 4/4,
  `npx tsc -b` 0, M14 identity `--check` green, full suite 273/273, forbidden-surface check clean), but the
  reviewer refuted on hygiene/claim-discipline grounds (`git diff --check` whitespace, leaked `task-task-*`
  worktrees cleaned after, claims not filed in the table).
- **PO decision:** Fausto overruled the refutation on those grounds: all annotations stand, but T1 is
  **VERIFIED by PO override**.
- **Operational effect:** M15-T2 is unblocked for assignment. T2/T3 gates remain unchanged; merge remains
  human-gated.

### LB-56 · 2026-07-02 — [process] M15-T2 reviewer gate refuted; redelivery required
- **Finding / call:** Codex, acting as PO-appointed implementation reviewer for this session, independently ran
  the targeted arbiter vitest and `npx tsc -b` successfully, then reproduced a blocking functional failure:
  arbiter-owned tasks reach `awaiting_confirmation`, but `Registry.confirmTeamPlan(task.id)` delegates only to
  `TeamCoordinator.confirmPlan()` and returns `Task <id> not found`.
- **Operational decision (Codex as reviewer/SM):** M15-T2 is **REFUTED**. T3 remains blocked. The next baton is
  T2 redelivery only: make the existing registry confirmation/rejection path work for arbiter-owned tasks,
  add a deterministic confirmation-gate test, file proper claim evidence, and clean committed whitespace.
- **Resource read at call:** Codex weekly 75%, 5h 5%; Claude weekly 28%, session 93%; antigravity 42%
  (best-effort `node scripts/usage.mjs`, 2026-07-02 18:03 Europe/Rome).

### LB-57 · 2026-07-02 — [process] M15-T2 redelivery verified; T3 unblocked
- **Finding / call:** Codex reviewed Gemini's M15-T2 redelivery (`f406feb` implementation + `a329b19` claim).
  Round 1's blocker is fixed: arbiter-owned tasks now route `Registry.confirmTeamPlan(task.id)` through
  `ArbiterCoordinator`, and reviewer repro printed
  `CONFIRM_OK awaiting_confirmation/awaiting_confirmation => working/delegated planConfirmed=true`.
- **Verification run:** targeted arbiter vitest 5/5, `npx tsc -b` 0, full `npm test` 274/274 across 47 files,
  M14 identity `--check` matched, committed whitespace checks clean, forbidden-surface check clean.
- **Operational decision (Codex as reviewer/SM):** M15-T2 is **VERIFIED**. M15-T3 is unblocked for PO/SM
  assignment. One leaked implementer worktree and two reviewer-created worker-assignment worktrees were cleaned;
  final pollution check showed only the main checkout.
- **Resource read at call:** Codex weekly 78%, 5h 27%; Claude weekly 28%, session 93%; antigravity 43%
  (best-effort `node scripts/usage.mjs`, 2026-07-02 18:15 Europe/Rome).

### LB-58 · 2026-07-02 — [process] M15-T3 reviewer gate refuted; redelivery required
- **Finding / call:** Codex reviewed Gemini's M15-T3 delivery (`f70f23c`). The live log is useful evidence: it
  reached `awaiting_confirmation`, confirmed the plan, completed worker execution, and reported judge/synthesis
  usage. However, T3 also silently changed production runtime code after discovering a live blocker, including a
  private `TeamCoordinator` task-map write from `Registry`; the script/log do not prove
  `AGENTTALK_DIAGRAM_RECORD` was enabled; `git show --check HEAD` fails on committed trailing whitespace; and
  leaked `task-task-*` branches were present before reviewer cleanup.
- **Verification run:** targeted arbiter vitest 5/5 and `npx tsc -b` 0 passed. Full suite, M14 identity, backlog
  check, and reviewer live rerun were not executed after the show-stopping scope/recording/whitespace findings.
- **Operational decision (Codex as reviewer/SM):** M15-T3 is **REFUTED**. Redelivery must either remove the
  runtime changes or get explicit PO scope authorization for a follow-up implementation task, prove
  `AGENTTALK_DIAGRAM_RECORD`, clean committed whitespace, and leave no task branch/worktree pollution.
- **Resource read at call:** Codex weekly 80%, 5h 34%; Claude weekly 28%, session 93%; antigravity 49%
  (best-effort `node scripts/usage.mjs`, 2026-07-02 18:50 Europe/Rome).

### LB-59 · 2026-07-02 — [process] Codex fixes M15-T3 by PO request; M15 awaits PO closure
- **Finding / call:** PO asked Codex to fix M15-T3 directly after the reviewer refutation. Codex declared
  temporary implementer + reviewer. The fix removed the invalid private `TeamCoordinator` task-map write and routed
  arbiter worker response/result handling explicitly through `ArbiterCoordinator`.
- **Verification run:** live proof passed with
  `AGENTTALK_DIAGRAM_RECORD=1 AGENTTALK_RECORDING_PATH=design/m15-t3-live-arbiter.ndjson node scripts/m15-live-arbiter.mjs`;
  refreshed `design/m15-t3-live-arbiter.log`; wrote 52-line `design/m15-t3-live-arbiter.ndjson`; judge usage
  `{ prompt_tokens: 329, completion_tokens: 41 }`; synthesis usage `{ prompt_tokens: 205, completion_tokens: 10 }`.
  Targeted arbiter vitest 5/5, `npx tsc -b` 0, full `npm test` 274/274, M14 identity `--check` matched,
  `npm run backlog:check` OK, diff whitespace clean, final pollution clean.
- **Residual note:** `AGENTTALK_DIAGRAM_RECORD=1` was enabled and logged, but local DiagramTalk at
  `http://localhost:3000` was unavailable, so no DiagramTalk recording id was returned. The runtime NDJSON artifact
  is the committed auditable recording for this proof.
- **Operational decision (Codex as SM):** M15-T3 is **VERIFIED** under the PO-requested resource fallback. M15 is
  ready for the PO merge/closure decision; merge remains human-gated.
- **Resource read at call:** Codex weekly 80%, 5h 40%; Claude weekly 28%, session 93%; antigravity 58%
  (best-effort `node scripts/usage.mjs`, 2026-07-02 19:02 Europe/Rome).

### LB-60 · 2026-07-02 — [process] Claude T3 follow-up defect fixed; M15 awaits PO closure
- **Finding / call:** Claude independently reviewed Codex's M15-T3 redelivery and found one confirmed regression:
  arbiter-opted non-PPW teams routed `submit_work_response` / `submit_work_result` into `ArbiterCoordinator`
  because the registry guard checked only `consensusMode === 'arbiter'`. Codex agreed with the finding.
- **Fix:** `Registry` now routes worker response/result handling to `ArbiterCoordinator` only for
  `planner-planner-worker` arbiter teams, matching the sibling arbiter guards. Added a regression test proving an
  arbiter-opted `worker-only` team stays on the `TeamCoordinator` work path through completion.
- **Verification run:** targeted arbiter vitest 6/6, `npx tsc -b` 0, full `npm test` 275/275 across 47 files,
  M14 identity `--check` matched, `npm run backlog:check` OK, diff whitespace clean. The M14 harness created two
  task worktrees/branches during verification; Codex removed both, and the final pollution check was clean.
- **Operational decision (Codex as SM):** Claude's blocker is fixed. M15-T3 returns to **VERIFIED** status and
  M15 again awaits the PO closure/merge decision; merge remains human-gated.
- **Resource read at call:** Codex weekly 84%, 5h 61%; Claude weekly 29%, session 0%; antigravity 49%
  (best-effort `node scripts/usage.mjs`, 2026-07-02 22:09 Europe/Rome).

### LB-61 · 2026-07-08 — [process] Governance reset (three-seat reviewer, role-only docs, [PO]/[SM] tags) + M16 opened
- **Governance (PO acts, in session):** the single Reviewer split into **three seats** — plan / implementation /
  task-end (independence: no self-review + fresh-eyes-at-close, from the M15-T3 catch); **all role→provider
  bindings centralized** in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` (both governance docs role-only elsewhere;
  `collaboration-workflow.md` now provider-free/portable); **origin tags are role tags `[PO]`/`[SM]`** (legacy
  `[Human]`/`[Codex]` mapped; `[Hermes]` void). Seats assigned: Codex = planner + implementation reviewer;
  Claude = plan reviewer + task-end reviewer + architect + **SM (handed Codex → Claude)**; agy = implementer.
  Authority-concentration tripwire recorded next to the table. Commit `789850d`.
- **Operational decision (Claude as SM, PO go in session):** **M16 — One real baton OPENED** (BL-013 `doing`);
  role-skill injection ruled **M19 candidate** (BL-014 `todo`); SP-WAKE layer (a2) skipped; deferred items
  unchanged. Reason: todo queue empty, self-hosting inception + planner POV + SP-WAKE(a) PASS all in place,
  all providers at fresh weekly windows — the draft's own start condition (post-Jul-7 Codex reset) is met.
  Gate record: `backlog.md` § Backlog gate 2026-07-08.
- **Baton:** fresh keyed planner primer written (M16 plan authoring; carries the SM-handover notice). Gate 1
  (plan review, Claude) follows the plan.
- **Resource read at call:** codex weekly 0% (resets 15 Jul), 5h 1%; antigravity 0%; claude meter `ok:false`
  (LB-11) — fresh weekly window by reset schedule (best-effort, 2026-07-08 ~11:25 Europe/Rome).

### LB-62 · 2026-07-08 — [process+product] M16 CLOSED — the flywheel's first live catch; healthcheck path was dead
- **Epic closed same-day it opened** (three tasks, three PO-gated merges: T1 `c5b7212`, T2a `624110d`, T2+epic
  `1604b5c`). Deliverable: one `[SM]`-tagged role→role baton through the real orchestrator attach server,
  recorded with the full `workflow_baton` envelope (`design/m16-one-real-baton.ndjson`).
- **Product finding (the epic's biggest side-catch):** the mandatory conversation healthcheck path was
  **dead-on-arrival in every mode** — `healthchecks.resolve` had zero production callers; no `healthcheck_ack`
  MCP handler; the in-process runtime emitted the wrong call name. Survived multiple epics because tests mock
  around it (IP-13 minted). Fixed as scope amendment M16-T2a: first working resolver, tool published,
  wire-contract v6→v7 synced cross-repo to `agentalk-mcp-client` (`2d908b3` there — Gate-1 cross-repo grant).
- **Owed piece named for M17 inception:** the exec-bridge translation layer cannot carry `baton` args — real
  CLI sessions (via `agentalk-mcp-client`) cannot send workflow batons yet; T2's proof used direct SDK MCP
  clients (deviation D1, accepted+recorded at gate 3).
- **Program metric:** epic relay count ~15 (vs M15 baseline ~20–30/day). First epic run fully under the
  2026-07-08 governance model (three reviewer seats, [PO]/[SM] role tags, assignments table): 2 REFUTE/amend
  rounds caught real defects pre-merge; case law grew IP-12/IP-13.
- **Resource read at close:** claude meter `ok:false` (LB-11); codex/antigravity on fresh weekly windows
  (best-effort, 2026-07-08 ~19:00 Europe/Rome).
