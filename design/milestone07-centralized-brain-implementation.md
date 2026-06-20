# Milestone 07 — Centralized Agent Brain — Implementation Status

**Status:** **OPEN — Task M07-T1 active** (branch `m07-t1-api-agent-driver`). M06 closed; R1 spike GREEN. (First exemplar of the M07 doc-pair convention.)
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
| **M07-T1** | API agent in-orchestrator, **single agent** (in-process driver, Google) | `m07-t1-api-agent-driver` | **ACTIVE** (DoD below) |
| **M07-T2** | Multi-agent API **consensus** in-orchestrator (2 planners → submit_plan → worker) | `m07-t2-api-consensus` | not started |
| **M07-T3** | **CLI harness inversion** (exec-RPC) + reconnect/effect-fence + contract bump | `m07-t3-harness-inversion` | not started |
| **M07-T4** | Retire client-side semantic logic; harness = transport + exec only | `m07-t4-retire-client-brain` | not started |

## Task M07-T1 — In-orchestrator API agent driver  *(ACTIVE — branch `m07-t1-api-agent-driver`)*

Spec: plan §9. Implementer fills *claim* (claim-only commits on the branch); reviewer fills
*verdict* by running and merges to `master` only when all rows are VERIFIED.

| T1 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T1.1** OpenAI-compatible API client module (named providers `google`/`openrouter`/`nous`, env keys, `response_format:json_object`), unit-tested with **mocked fetch** | **done** | not-checked | — |
| **T1.2** Server-side translation module: build prompt + parse/retry + `message_type→{tool,args}` (ported from client, client copy untouched), unit-tested | — | not-checked | — |
| **T1.3** In-process driver: single API agent runs `awaitTurn → callApi → handleMcpToolCall` (graceful-degrade on non-planning turn), **mocked-fetch CI test** | — | not-checked | — |
| **T1.4** Live smoke: one real Google `gemini-2.5-flash` turn end-to-end, **recorded** (log/transcript) | — | not-checked | — |
| **T1.5** No regression: orchestrator suite green; client suite green; existing attach (CLI/stub) path unchanged (driver opt-in/config-gated); `tsc -b` clean | — | not-checked | — |

## Refinements / follow-ups (in-scope tweaks discovered during M07)

*(none yet — add rows here, same claim/verdict discipline)*

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
