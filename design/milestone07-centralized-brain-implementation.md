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
| **Spike** — orchestrator builds prompt → OpenRouter fetch → parse → 1 structured action, single agent, no CLI (plan §5) | —                 | not-checked      | —        |
| Q1 structured-output reliability confirmed (response_format + retry) | —          | not-checked      | —        |
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
