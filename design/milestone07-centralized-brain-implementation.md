# Milestone 07 — Centralized Agent Brain — Implementation Status

**Status:** **Task M07-T1 COMPLETE — all rows VERIFIED, merged to `master`.** Next: M07-T2 (multi-agent API consensus). M06 closed; R1 spike GREEN.
**Plan:** `design/milestone07-centralized-brain-plan.md` (architect-owned; this doc tracks status only).
**Last verified:** 2026-06-20 (spike/R1) · **Verifier:** Claude

> Convention (workflow §3b): the **implementer** fills the *Claim* column; the **reviewer** fills
> the *Verdict* column **only after running it**, with evidence. A row is done only when its
> verdict is **VERIFIED ✅** — never on the claim alone. Verdict ∈ {VERIFIED ✅ / REFUTED ❌ /
> PARTIAL ⚠️ / not-checked}.

---

## ▶ START HERE (Gemini, fresh context)

You are the **implementer** for M07; the reviewer verifies. Read, in order:
1. `design/collaboration-workflow.md` — the method (esp. §2 verify-don't-assert, §3b the
   claim/verdict ledger + **Tasks & branches**, §4a don't overwrite open points).
2. `design/milestone07-centralized-brain-plan.md` — the epic plan. **§9 is your
   implementation-ready spec for Task M07-T1.** Honour the "DO NOT TOUCH" guardrails there.
3. This ledger — fill the **Implementer claim** column as you go; leave the **Reviewer verdict**
   column for the reviewer.

**How to work (per workflow §3b *Tasks & branches*):**
- **Create** the branch **`m07-t1-api-agent-driver`** off `master` yourself (branch creation is
  the implementer's job), then work there. Do **not** commit to `master`.
- Commit **claim-only**, small commits (ideally one per DoD row). A commit records progress and
  makes the diff reviewable — it must **not self-close**: do **not** tick DoD boxes, do **not**
  edit `CLAUDE.md`/`AGENT.md`, no "milestone complete".
- The reviewer verifies the branch by running it, fills the verdict column, and **merges to
  `master` only when every T1 row is VERIFIED**.

**Scope right now = Task M07-T1 only** (single in-orchestrator API agent; mocked-fetch CI test +
one live Google smoke). T2 (multi-agent API consensus), T3 (CLI-harness inversion), T4 (retire
client logic) are **later tasks — out of scope now.** Use `gemini-2.5-flash` (budget). Key via env
(`GEMINI_API_KEY`); never commit secrets. Reference API call: `spikes/m07-api-structured-probe.mjs`.

---

## Readiness gates (pre-task) — all green

| Gate | Verdict | Evidence |
|---|---|---|
| **Spike** — orchestrator builds prompt → OpenAI-compatible fetch → parse → structured `message_type` (plan §5) | **VERIFIED ✅** | `spikes/m07-api-structured-probe.mjs` — `PROVIDER=google` → **3/3 PASS** with `gemini-2.5-flash`: discussion→`opinion`, proposal→`agreement_proposal`, submit→`submit_plan`. |
| **Q1** structured-output reliability (response_format + retry) | **VERIFIED ✅ (Google)** | Legal `message_type` for every step (3/3), 414in/225out tokens. TODO for Hermes/OpenRouter when those keys arrive. |
| **Q3** provider granularity | **RESOLVED ✅** | Named providers (`google`/`openrouter`/`nous`), one OpenAI-compatible client. |
| **Q4** Nous endpoint + Hermes model id | **deferred** | Google-first; Nous/OpenRouter when keys arrive. Not blocking. |

## Tasks (epic breakdown)

| Task | Goal | Branch | Status |
|---|---|---|---|
| **M07-T1** | API agent in-orchestrator, **single agent** (in-process driver, Google) | `m07-t1-api-agent-driver` | **DONE ✅** (T1.1–T1.6 VERIFIED, merged) |
| **M07-T2** | Multi-agent API **consensus** in-orchestrator (2 planners → submit_plan → worker) | `m07-t2-api-consensus` | not started |
| **M07-T3** | **CLI harness inversion** (exec-RPC) + reconnect/effect-fence + contract bump | `m07-t3-harness-inversion` | not started |
| **M07-T4** | Retire client-side semantic logic; harness = transport + exec only | `m07-t4-retire-client-brain` | not started |

## Task M07-T1 — In-orchestrator API agent driver  *(ACTIVE — branch `m07-t1-api-agent-driver`)*

Spec: plan §9. Implementer fills *claim* (claim-only commits on the branch); reviewer fills
*verdict* by running and merges to `master` only when all rows are VERIFIED.

| T1 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T1.1** OpenAI-compatible API client module (named providers `google`/`openrouter`/`nous`, env keys, `response_format:json_object`), unit-tested with **mocked fetch** | **done** | **VERIFIED ✅** | `packages/runtime-core/src/agents/api-client.ts` + `__tests__/api-client.test.ts`. Ran `npm test`: **5/5** api-client tests pass; full suite **144/144**, `tsc -b` clean. Module: named providers w/ correct base/keyEnv/model, env-key throw, `response_format` passthrough, injectable `fetch` (built-in, no new dep). Test asserts exact endpoint/headers/body. |
| **T1.2** Server-side translation module: build prompt + parse/retry + `message_type→{tool,args}` (ported from client, client copy untouched), unit-tested | **done** | **VERIFIED ✅** | `translation.ts` — faithful port of the client's `dispatchStructuredResponse` + retry; **reuses pre-existing server-side `conversations/runtime.ts` + `response-schema.ts`** (no new port needed). `translation.test.ts` **6/6**. Client repo untouched (no commits/changes). |
| **T1.3** In-process driver: single API agent runs `awaitTurn → callApi → handleMcpToolCall` (graceful-degrade on non-planning turn), **mocked-fetch CI test** | **done** | **VERIFIED ✅ (with gap, see ⚠️)** | `in-process-driver.ts` loop = `awaitTurn → buildPrompt → callApi → parse/retry → translate → handleMcpToolCall`; non-structured turn → plain `buildProtocolRequest` (graceful degrade). `in-process-driver.test.ts` **2/2** (mocked fetch). **⚠️ Driver is a standalone class — not wired into the registry (see gap note below).** |
| **T1.4** Live smoke: one real Google `gemini-2.5-flash` turn end-to-end, **recorded** (log/transcript) | **done** | **VERIFIED ✅** | Ran `scripts/m07-t1-live-smoke.mjs` myself with real `gemini-2.5-flash`: `conversation_start` → real Gemini → driver emits `send_to_agent{to:peer-b}` with a real opinion + `expected_response_types`. Exit 0; transcript `m07-smoke-transcript.log`. |
| **T1.5** No regression: orchestrator suite green; client suite green; existing attach (CLI/stub) path unchanged (driver opt-in/config-gated); `tsc -b` clean | **done** | **VERIFIED ✅** | After the reviewer fixup `fcb4c64` (GAP-2 resolved), the **committed** branch builds: `tsc -b` clean, full suite **152/152**, `registry.ts`+client **untouched** → existing attach path unchanged. |
| **T1.6** Registry start-path: `createAgent({provider:'api', providerName, model})` + on activate the registry **starts `InProcessAgentDriver`** (opt-in; non-API agents unchanged); a configured API agent completes a turn via the normal lifecycle — mocked-fetch CI test + one live Google turn through the registry path | **done** | **VERIFIED ✅** | `registry.ts` (+38): `createAgent` takes `provider/providerName/model`; `activateAgent` starts+`start()`s the driver when `provider==='api'` and returns early (opt-in — other agents unchanged); `removeAgent`/`destroy` `stop()` it. `api-agent-lifecycle.test.ts` **1/1** exercises the **registry path** (createAgent→activate→registry starts driver→callApi mocked), not hand-wired. Ran `scripts/m07-t1.6-live-smoke.mjs` myself: log shows `[Registry] Starting InProcessAgentDriver…` → real `gemini-2.5-flash` turn → `send_to_agent{to:peer-b}`, exit 0. Suite **153/153**, `tsc -b` clean (committed). |

## Refinements / follow-ups (in-scope tweaks discovered during M07)

| Item | Claim | Verdict | Notes |
|---|---|---|---|
| **R-1** `api-client.ts` `nous` provider `keyEnv` should be **`HERMES_API_KEY`** + default model **`deepseek-v4-flash`** (the env var/model Fausto actually provisioned), not `NOUS_API_KEY`/`Hermes-4-405B`. | **done** | **VERIFIED ✅** | `api-client.ts` `nous`: `keyEnv: 'HERMES_API_KEY'`, `defaultModel: 'deepseek-v4-flash'`. (Live Nous call still untested — no key in the orchestrator's inherited env; not blocking T1.) |
| **R-2 (nit)** `api-agent-lifecycle.test.ts` has leftover dead comments (Gemini's thinking-out-loud, lines ~65–68). | — | open | Cosmetic; remove in a later pass. Non-blocking. |
| **GAP-1 (T1 scope §9 item 4)** Registry start-path not done. | — | **RESOLVED → T1.6** | Decision (Fausto, 2026-06-20): add **T1.6** (registry start-path) and **keep T1 open** until it's VERIFIED. Now tracked as the T1.6 DoD row; spec in plan §9.1. |
| **GAP-2 (BLOCKER)** Committed branch failed `tsc` (10 errors); build-fixes were uncommitted. | — | **RESOLVED ✅** | Decision (Fausto): reviewer commits. Done in `fcb4c64`; committed branch now builds + suite 152/152. |

## Log (append-only, dated)
- 2026-06-20 — Doc created as the M07 status ledger. No work started; M07 is parked behind M06
  closure (see `phase6-multi-agent-consensus-plan.md` §12 DoD).
- 2026-06-20 — Spike `spikes/m07-api-structured-probe.mjs` written (isolated, no impact on
  current code) and run. Mechanism validated (reaches an OpenAI-compatible endpoint, forces
  `response_format:json_object`, parses, handles errors). **R1 blocked on a usable API key** —
  OPENROUTER/NOUS unset, OPENAI_API_KEY out of quota (429). Awaiting a key from Fausto to run
  the real R1 probe against a Hermes/OpenRouter model.
- 2026-06-20 — Added `google` provider (Google's OpenAI-compat endpoint,
  `generativelanguage.googleapis.com/v1beta/openai`, `GEMINI_API_KEY`). Ran the spike →
  **R1 GREEN: 3/3 legal message_types** with `gemini-2.5-flash`. M07 epic is **unblocked** —
  Google is the budget-friendly pilot provider; OpenRouter/Nous deferred until those keys arrive.
  **Next:** epic step 1 — extract the translation layer (prompt-build + structured-parse +
  message_type→tool) into a server-side module (move, not rewrite).
- 2026-06-20 — **Increment 1 (M07-I1) sub-design written** (epic §9) + I1 DoD rows added above +
  START HERE block for fresh Gemini + Q3 RESOLVED (named providers) / Q4 deferred. Handed to
  Gemini for implementation; Claude verifies each I1 row by running.
- 2026-06-20 — **Task model adopted** (workflow §3b *Tasks & branches*): epic → tasks T1–T4,
  one branch per task `<epic>-t<N>-<slug>`, claim-only commits, reviewer merges to `master` on
  all-VERIFIED. Relabelled Increment 1 → **Task M07-T1**. The implementer creates the branch
  `m07-t1-api-agent-driver` (their responsibility) and works there. Ready for the implementer.
- 2026-06-20 — **T1.1 VERIFIED** by reviewer (ran it): api-client module + mocked-fetch test,
  5/5 pass, suite 144/144, tsc clean. **NB:** implementer reported "T1 finished" but only **T1.1**
  is claimed/committed on the branch — **T1.2–T1.5 still open**. No merge to `master` yet (merge
  is gated on all-T1-VERIFIED). Back to the implementer for T1.2–T1.5.
- 2026-06-20 — **Full T1 review (ran it):** T1.2 (translation, 6/6), T1.3 (driver, 2/2), T1.4
  (live smoke re-run with real Google `gemini-2.5-flash`, exit 0), T1.5 (suite 152/152, tsc clean,
  registry + client untouched) — **all 5 DoD rows VERIFIED.** Process clean (claim-only commits,
  client untouched). **BUT GAP-1 raised:** registry start-path (plan §9 item 4) not done — the
  driver is a standalone class, never started by the orchestrator's agent lifecycle. **Not merged
  to `master`** pending Fausto's decision: add T1.6 (wire it) vs fold into T2.
- 2026-06-20 — **GAP-2 (blocker) found:** the committed branch does **not** build — `tsc` fails
  with 10 errors; the fixes are **uncommitted working-tree edits** the implementer never committed
  (verified by stashing them → committed version fails tsc). T1.5 downgraded to PARTIAL. My
  152/152 + smoke were on the working tree. **Branch not mergeable until the fixes are committed.**
- 2026-06-20 — Decisions (Fausto): **GAP-2** → reviewer commits the fixes (done `fcb4c64`; branch
  now builds, 152/152) → **T1.1–T1.5 all VERIFIED**. **GAP-1** → add **T1.6** (registry start-path),
  keep T1 open. Spec for T1.6 written in plan §9.1; handed to the implementer (Gemini) on the
  branch. T1 closes (merge to `master`) only when T1.6 is VERIFIED.
- 2026-06-20 — **T1.6 + R-1 VERIFIED (ran it):** registry start-path wired (opt-in, teardown);
  `api-agent-lifecycle.test.ts` exercises the registry path; T1.6 live smoke through the registry
  passed with real Google; suite **153/153**, committed branch builds (no GAP-2 repeat); R-1 done.
  **All of T1 (T1.1–T1.6) VERIFIED → reviewer merging `m07-t1-api-agent-driver` → `master`.**
  Minor nit logged (R-2, dead comments in the test).
- 2026-06-20 — **Session paused.** Resume point: **M07-T2** (multi-agent API consensus) — write the
  T2 spec (à la plan §9), then branch `m07-t2-api-consensus`. Foundations ready: in-process driver
  + registry start-path (T1) + consensus engine (M06). **Keys note:** `GEMINI_API_KEY` works;
  `OPENROUTER_API_KEY` + `HERMES_API_KEY` are in `~/.zshrc` but **Claude Code must be restarted**
  to inherit them (it captured its env at launch, before they were added). OpenRouter = 0 credit →
  `:free` models only; Nous/Hermes model = `deepseek-v4-flash`.
