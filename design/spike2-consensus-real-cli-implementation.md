# SP2 — Consensus Over Real Attached CLI Sessions — Implementation Ledger

> **Status:** 🟢 **OPEN — Gate 1 approved by Plan Reviewer, 2026-07-10.**
> **Plan:** `design/spike2-consensus-real-cli-plan.md`
> **Base:** `master` at `7500e1a` (2026-07-10).
> **Planner:** Codex. **Plan Reviewer:** Claude. **PO:** Fausto. **SM:** Claude.

This ledger records the SP2 spike. The deliverable is an answer to whether the existing consensus protocol
survives across two real attached CLI sessions. A park recommendation is a successful outcome if that is what the
evidence supports. SP2 is a proof and does **not** discharge M18's C3 reopen condition; M19 must still carry actual
role-to-role coordination and report the BL-027 ratio.

## Startup / Process Log

### 2026-07-10 — Planner cold-start deviation and SM disposition

During the SP2 planner primer verification, Codex ran `npm run backlog:check` inside the no-action window. The
command expands to `tsc -b && node scripts/validate-backlog.mjs`; that is a build plus a script, both outside the
requested read-only verification. It also produced gitignored side effects (`dist/` and `*.tsbuildinfo`) even
though the tracked tree stayed clean.

**SM disposition:** accepted, no rework. Reporting the deviation unprompted was the desired behavior. Lesson to
carry: say precisely "no tracked repo changes" when ignored build outputs may have changed, and prefer direct reads
when the no-action rule says no runs.

## Scope Fence

- Zero production behavior change.
- No edits to `packages/**`, `apps/**`, coordinator/registry/protocol code, MCP tool schemas, or
  `agentalk-mcp-client`.
- No use of `scripts/m17-live-gate-proof.mjs` as evidence.
- Allowed outputs are SP2 docs, evidence files under `design/evidence/**` if needed, and a docs-only attach runbook.
- Any defect discovered in attach, consensus, recording, provider shape, or idle timeout behavior is recorded as a
  finding, not fixed here.
- Scope/pollution checks cover both AgentTalk and `agentalk-mcp-client`, because real CLI attach uses client-repo
  `bridge.mjs`.

## Sequencing

1. **SP2-T0 — Gate 1 approval.** Plan reviewer approves/refutes this plan.
2. **SP2-T1 — Control + attach ritual.** Run the same-day in-process/known-working control, then perform and
   document the current real-CLI attach ritual.
3. **SP2-T2 — Provider observation.** Record attached agents' AgentTalk `provider` values and role/identity mapping.
4. **SP2-T3 — Consensus attempt.** Run the existing consensus protocol and capture fresh artifact evidence.
5. **SP2-T4 — Results + recommendation.** Publish the answer and recommend the M19 agreement path.

## Claim / Verdict Ledger

The implementer records **Claim** entries with exact command/output evidence. The reviewer records **Verdict** only
after independent checking.

| Task | Owner | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|---|
| SP2-T0 | Plan Reviewer | Plan authored by Codex; amended after Gate 1 refute and conditional approval. | **APPROVED ✅** | `design/spike2-consensus-real-cli-plan.md`; this ledger. |
| SP2-T1 | TBD | pending | pending | Same-day control, attach runbook, and fresh setup evidence. |
| SP2-T2 | TBD | pending | pending | Provider values, role/identity records. |
| SP2-T3 | TBD | pending | pending | Fresh recording artifacts for consensus phases, accepted proposal/submission, and terminal state. |
| SP2-T4 | TBD | pending | pending | Promote/park recommendation for M19 planning. |

## SP2-T1 — Control + Attach Ritual

### Intent

Run a same-day in-process/known-working control before interpreting real-CLI failure, then use the existing
real-CLI attach path and write down the ritual from evidence, not memory.

### Approved Work

- Start the existing orchestrator with a fresh recorder path.
- Run the existing in-process/known-working consensus substrate as a control with the same or equivalent prompt.
- Register/start two real CLI agents.
- Capture the bridge/CLI config needed to attach.
- Add or update a docs-only runbook produced from the actual steps.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T1-C1 | Same-day in-process control run is green and records provider values/effective timeout profile; it establishes the protocol is not broken today. |
| T1-C2 | Control records provider values and effective timeout profile, especially whether it used the 720s Gemini path. |
| T1-C3 | Two real CLI sessions attach to AgentTalk, or the exact attach failure is recorded as `ATTACH-BLOCKED`. |
| T1-C4 | Runbook includes registration, start, bridge config, contract hash handling, and the `creating` -> `start` trap. |
| T1-C5 | No production/client/tooling automation is added. |

## SP2-T2 — Provider Observation

### Intent

Record the provider value AgentTalk assigns to each attached real CLI so SP2 can interpret `fact_collection`
timing and provider-shaped behavior.

The primary real-CLI pair is **Codex CLI + Claude Code** unless the SM/PO changes it before execution.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T2-C1 | Each attached agent's id, role, CLI/vendor, and AgentTalk `provider` value are recorded. |
| T2-C2 | The ledger states whether the provider value is transport-shaped (`mcp`) or vendor-shaped (`claude`, `codex`, `gemini`, etc.). |
| T2-C3 | The ledger records whether any member triggers the 720s Gemini fact-collection timeout branch. |
| T2-C4 | Any provider ambiguity is recorded as a finding, not fixed. |

## SP2-T3 — Consensus Attempt

### Intent

Run one minimal consensus task through the existing protocol across the two attached real CLIs.

"Survived" is an artifact bar: fresh recorder evidence of at least one protocol-driven phase transition and an
accepted final proposal/submission event. A transcript in which two agents merely agree is not enough.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T3-C1 | The consensus prompt is recorded and contains no implementation request. |
| T3-C2 | The ledger records which phases were reached: `fact_collection`, `discussion`, `proposal`. |
| T3-C3 | Fresh recorder evidence shows a protocol-driven phase transition, or records exactly where that artifact is absent. |
| T3-C4 | Fresh recorder evidence shows an accepted final proposal/submission event, or records exactly where that artifact is absent. |
| T3-C5 | If the real-CLI run fails on a fact-collection timeout, one conditional 720s-profile re-run is performed by setting `providerName: 'gemini'` on one real-CLI member at registration. The run B mislabel is declared; run A's provider values, not run B's false value, satisfy SP2-C2. If run B passes, the finding is timeout/profile behavior against BL-024, not substrate consensus failure. |
| T3-C6 | Stale committed NDJSON and `scripts/m17-live-gate-proof.mjs` are not used as proof. |
| T3-C7 | Failure or inconclusive behavior is reported honestly without adding support code. |

## SP2-T4 — Results + Recommendation

### Intent

Turn the observed run into a direct planning input for M19.

### DoD Claims

| Claim | Required evidence |
|---|---|
| T4-C1 | Result is one of `PROMOTE consensus path`, `PARK consensus path`, `INCONCLUSIVE -> use plain batons for M19`, or `ATTACH-BLOCKED -> BL-026 only`. |
| T4-C2 | Recommendation explains how M19 should perform the "agents agree on one file" step. |
| T4-C3 | Scope/pollution audit shows zero production/client/protocol diffs in both AgentTalk and `agentalk-mcp-client`. |
| T4-C4 | Any follow-up backlog recommendation is stated plainly with evidence. |

## Closure Telemetry

To be filled at spike closure:

```text
**Telemetry (spike closure):**
- spike:       SP2
- wall-clock:  <start> -> <close> (<delta>)
- budget:      weekly <a%->b%>, session/5h <a%->b%> [or unavailable]
- gate:        <checks run>
- diff:        <N files, +adds/-dels>, commits <hashes if any>
- outcome:     <PROMOTE / PARK / INCONCLUSIVE / ATTACH-BLOCKED>
```
