# Spike — Harness/AgentTalk division (pre-M10) — Implementation Status

Plan: `design/spike-harness-division-plan.md`. Implementer = Claude under LB-14 (Gemini out of budget;
gate delegated, **merge/commit HUMAN-GATED — Fausto's call**).

**Status:** **CLOSED — committed & merged to `master` in both repos (Fausto approved, 2026-06-25).**
AgentTalk pushed to origin; client is local-only. All gates green; boundary live-proven on codex +
claude. Only residual: the 🟡 gemini provider-parity live run, deferred until budget returns.

## Task log

| Task | What | Status |
|---|---|---|
| **S1** | Delete the orphaned stub from the client (`stub-bridge.js` + 4 wiring sites) | **DONE** — file deleted; `SUPPORTED_PROVIDERS`, `supportsPersistentExecution`, the `getPersistentProviderCommand` stub branch, `StubPersistentExecutor`, and the `createExecutor` stub branch all removed. Client repo grep-clean of `stub` + consensus vocab. Client gate (`npm run build` = lint + vitest) **green: lint clean, 1/1** (the `gemini`+mocked-MCP exec-RPC test unaffected). |
| **S2** | Strip `messageTypes` from both contract copies, in lockstep | **DONE** — confirmed zero code consumers (only design-doc prose references `messageTypes`). Removed `data.messageTypes`; `version` 4→5; hash recomputed via the exact `verify-contract.js` algorithm (`sha256(JSON.stringify(data,null,2))`) → `1236003f…`. Both copies **byte-identical**; both `verify-contract.js` pass at v5. |
| **S3** | Prove the boundary handshake accepts the v5 client | **DONE — two ways.** (a) Deterministic focused proof against **both real contract files**: server (v5 hash) accepts the **real client v5 hash → ACCEPTED ✅**; negative control (wrong hash) → **REJECTED -32000 ✅**. (b) **Full live gate, PASSED on codex** (`node scripts/test-mcp-gate.mjs codex`): the real client harness attached with the v5 contract, codex ran an actual planning turn (`submit_exec_result` → `send_to_agent`), `TEST PASSED`. Ran on codex because gemini is out of weekly budget; the parameterized gate (see below) unlocked it. No pollution. |
| **S4** | Docs | **DONE** — `phase6-…-plan.md:304` annotated (stub removed, historical note preserved, not falsified); this ledger written. |

## Gate summary

- **Client** (`agentalk-mcp-client`): `npm run build` → lint clean, **1/1** test. Repo grep-clean of
  `stub` / `agreement_proposal` / `submit_plan` / `fact_collection` / `message_type` → **transport only**.
- **AgentTalk**: `tsc -b` **0**; full suite **183/183 (32 files)** — incl. the `mcpTools` drift-guard
  (unaffected) and `mcp-server.test.ts` handshake-gate tests. No pollution (`/tmp/agentalk-*` none;
  single worktree; no stray `task-*` branches).
- **Contract lockstep**: both copies v5, hash `1236003f…`, byte-identical, both `verify-contract` pass.

## 🟡 Open follow-up — run the live gate on gemini when budget returns

The live `test-mcp-gate.mjs` has **PASSED on codex and claude**. **Gemini was NOT run live** — it is out
of weekly budget (antigravity 95% used). **As soon as gemini budget is available again, run
`node scripts/test-mcp-gate.mjs gemini`** to confirm the v5 boundary on the third provider and close
this out. (Provider parity check only — the boundary is already proven; gemini is the one provider not
yet exercised live since the v5 contract change.)

## Definition of Done — status

1. Client consensus-clean ✅  2. Client gate green ✅  3. Contract trimmed in lockstep (v5, identical
hashes) ✅  4. AgentTalk gate green (tsc 0, 183/183) ✅  5. Handshake accept exercised end-to-end
(positive + negative) ✅  6. Docs + ledger ✅. **Open: merge/commit (human gate).**

## Scope / sites touched (matches plan §4)

- **Client:** `lib/stub-bridge.js` (deleted), `lib/executor-runtime.mjs`, `lib/provider-runtime.mjs`,
  `wire-contract.json`.
- **AgentTalk:** `packages/contracts/wire-contract.json`, `design/phase6-multi-agent-consensus-plan.md`,
  + new `design/spike-harness-division-plan.md` and this ledger.
- **Untouched (as planned):** `mcp-server.ts` handshake gate, `protocol-payloads.ts`, real provider
  paths, no offline mock rebuilt in AgentTalk (deferred).
- **Add-on (Fausto request, 2026-06-25):** `scripts/test-mcp-gate.mjs` parameterized to select the
  provider (`[gemini|codex|claude]` arg or `MCP_GATE_PROVIDER` env; default `gemini` — behavior
  preserved). Additive only; unlocked the live codex run above since gemini is out of budget.

**Telemetry (task closure):**
- task:        Spike — harness/AgentTalk division (pre-M10)
- wall-clock:  2026-06-25 ~13:00 → 13:29 CEST (impl ~S1–S4)
- budget:      weekly ~40%→42% (Δ ~2%), session ~41%→63% (Δ ~22%) [per /usage]
- gate:        client lint+1/1; AgentTalk tsc 0, suite 183/183; contract v5 lockstep; handshake pos+neg
- diff:        AgentTalk 2 files +5/-12 (+2 new docs); client 3 modified, 1 deleted
- outcome:     IMPLEMENTED ✅ — gates green — AWAITING HUMAN MERGE GATE (LB-14)
