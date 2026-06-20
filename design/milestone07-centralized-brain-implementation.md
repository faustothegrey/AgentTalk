# Milestone 07 — Centralized Agent Brain — Implementation Status

**Status:** Not started — **blocked on M06 closure**. (First exemplar of the M07 doc-pair convention.)
**Plan:** `design/milestone07-centralized-brain-epic.md` (architect-owned; this doc tracks status only).
**Last verified:** — (nothing to verify yet) · **Verifier:** Claude

> Convention (workflow §3b): the **implementer** fills the *Claim* column; the **reviewer** fills
> the *Verdict* column **only after running it**, with evidence. A row is done only when its
> verdict is **VERIFIED ✅** — never on the claim alone. Verdict ∈ {VERIFIED ✅ / REFUTED ❌ /
> PARTIAL ⚠️ / not-checked}.

---

## Status ledger (mirrors the plan's phasing / DoD)

| Item (from plan)                                              | Implementer claim | Reviewer verdict | Evidence |
|--------------------------------------------------------------|-------------------|------------------|----------|
| **Spike** — orchestrator builds prompt → OpenAI-compatible fetch → parse → structured `message_type`, single agent, no CLI (plan §5) | done | **VERIFIED ✅** | `spikes/m07-api-structured-probe.mjs` (isolated, zero impact on current code). Ran `PROVIDER=google` → **3/3 PASS** with real `gemini-2.5-flash` via Google's OpenAI-compat endpoint: discussion→`opinion`, proposal→`agreement_proposal`, submit→`submit_plan`. Confirms the centralized-brain round-trip (orchestrator builds prompt → fetch → `response_format:json_object` → parse → legal `message_type`). |
| Q1 structured-output reliability confirmed (response_format + retry) | done          | **VERIFIED ✅ (Google)** | Real Gemini emitted a **legal `message_type` for every protocol step** (3/3), tokens 414in/225out — cheap. Still TODO for the *target* Hermes/OpenRouter models when those keys arrive (`PROVIDER=openrouter\|nous MODEL=<id> node spikes/...`), but R1 is **answered** for the Google provider — enough to start the epic. |
| Q3 provider granularity decided (two named vs generic `api`) | —                 | not-checked      | —        |
| Q4 Nous endpoint + Hermes model id confirmed                 | —                 | not-checked      | —        |
| **Epic 1** — translation layer extracted server-side (move, tested) | —          | not-checked      | —        |
| **Epic 2** — API agents productionized in-orchestrator (OpenRouter + Nous) | —   | not-checked      | —        |
| **Epic 3** — CLI harness inversion (exec-RPC) + reconnect/effect-fence + contract bump | — | not-checked  | —        |
| **Epic 4** — client-side semantic logic retired; harness = transport + exec only | —  | not-checked   | —        |
| Regression gates (tsc clean, suites green, M05 separation holds)            | —     | not-checked      | —        |

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
