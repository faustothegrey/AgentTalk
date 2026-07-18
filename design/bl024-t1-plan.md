# BL-024 · T1 — transport × vendor: type + edge (no engine change) — PLAN

> **Status:** DRAFT for the plan-review gate. **Planner:** Claude (resource fallback). **Epic:** BL-024
> (design: `design/bl024-provider-split-design.md`, PO gate passed 2026-07-18).
> **This is T1 of 3.** T1 = introduce the new axis + a driver factory, **behaviour-preserving, engine untouched**;
> T2 = the frozen-engine timeout slice (authorized, separate task); T3 = client cutover + legacy drop.

## 1. Goal / "done" in one line

Introduce `transport` (`in-process` | `attached`), `vendor`, and per-agent `capabilities` **additively**, route
driver/completer selection through a **factory keyed on transport**, and normalize every caller (legacy or new) —
**without touching `team-coordinator.ts` (frozen) and without changing any observable behaviour.**

## 2. Why T1 is safe (the invariant it must hold)

The engine (`team-coordinator.ts`) is **not touched** and keeps reading the legacy `provider`/`providerName`
(incl. the leak-#2 gemini timeout). Therefore T1 **must keep `provider`/`providerName` populated** for every agent.
The new fields are added *alongside*; nothing yet *removes* the legacy union. Net observable behaviour: **identical**.
This is what lets T1 merge with no frozen-engine authorization (that's T2's).

## 3. Deliverables

### 3a. Types (`packages/contracts/src/types.ts`)
- `export type AgentTransport = 'in-process' | 'attached';`
- `export type AgentVendor = 'gemini' | 'claude' | 'codex';`
- A **pure** mapping helper — single source of truth for the axis translation, no deps:
  ```
  normalizeAgentKind(input: { provider?: AgentProvider; providerName?: string;
                              transport?: AgentTransport; vendor?: AgentVendor })
    → { transport: AgentTransport; vendor?: AgentVendor; apiVendor?: ApiProvider;
        capabilities?: { factCollectionTimeoutMs?: number };
        legacyProvider: AgentProvider; providerName?: string }
  ```
  Mapping (from design §5), bidirectional so the engine's legacy field is always derivable:
  | legacy `provider` | → transport | vendor | capabilities | (reverse: transport+vendor → legacy) |
  |---|---|---|---|---|
  | `api` | `in-process` | — | — | `in-process` → `api` |
  | `mcp` | `attached` | undefined | — | `attached` + no vendor → `mcp` |
  | `gemini` | `attached` | `gemini` | `{factCollectionTimeoutMs: 720_000}` | `attached`+`gemini` → `gemini` |
  | `claude` | `attached` | `claude` | — | `attached`+`claude` → `claude` |
  | `codex` | `attached` | `codex` | — | `attached`+`codex` → `codex` |
  - `apiVendor` continues to come from `providerName` for the `in-process`/`api` path (unchanged semantics).
  - `AgentProvider` (legacy union) **stays** in T1 — deprecated in comment, removed in T3.

### 3b. Agent record (`packages/runtime-core/src/agents/agent.ts`)
- Add `transport?: AgentTransport;`, `vendor?: AgentVendor;`,
  `capabilities?: { factCollectionTimeoutMs?: number };` alongside the existing `provider`/`providerName`.

### 3c. Ingest / compat (`apps/orchestrator/src/server.ts` `POST /api/agents`, and `registry.createAgent` options)
- Accept **either** the legacy `provider` **or** the new `{ transport, vendor }`.
- Run `normalizeAgentKind` on ingest and populate **both** the new fields **and** the legacy
  `provider`/`providerName` on the Agent — so the untouched engine keeps working unchanged.
- `createAgent` options gain `transport?`/`vendor?`/`capabilities?` (keeps `provider`/`providerName`).

### 3d. Registry driver factory (`packages/runtime-core/src/registry/registry.ts`)
Replace the four vendor-listing sniff sites with transport-keyed helpers (behaviour identical — the sites already
treat the four attached values the same):
- `isAttached(agent): boolean` → `agent.transport === 'attached'` (replaces the `∈{mcp,gemini,claude,codex}`
  predicate at `:360`, `:597`, and the always-true guard at `:246`).
- `makeDriver(agent)` → switches on `transport`: `in-process` builds `ApiCompleter(apiVendor…)`; `attached` builds
  `McpCompleter` (replaces the `provider === 'api'` split at `:249`). Same objects as today.

### 3e. Tests
- **`normalizeAgentKind`** pure unit tests: all 5 legacy values → correct `{transport,vendor,capabilities,legacyProvider}`;
  both new-shape inputs → correct + correct reverse `legacyProvider`; gemini carries the 720_000 capability.
- **Factory preservation** (IP-15-style): for each legacy provider value, `makeDriver` picks the *same* completer
  and `isAttached` gives the *same* turn-mode as `master` — a test that FAILS if the factory mis-routes.
- **Compat**: `POST /api/agents` with legacy `provider` still populates `provider`/`providerName` (engine
  unaffected); with new `{transport,vendor}` populates both new + legacy.
- Full suite green; `tsc -b` clean; no wire-contract hash change.

## 4. Scope

**MAY touch:** `contracts/src/types.ts` (+ its dist via build), `runtime-core/src/agents/agent.ts`,
`runtime-core/src/registry/registry.ts`, `apps/orchestrator/src/server.ts`,
`runtime-scenarios/src/scenarios/types.ts` **only if** it fails `tsc` on the union, new test files.
**MAY NOT touch:** `team-coordinator.ts` (**frozen — T2 owns it**), the client repo (`agentalk-mcp-client` — T3),
`wire-contract.json`, the law (authority/routing), the `ApiProvider` axis.

## 5. Definition of Done

1. New `transport`/`vendor`/`capabilities` fields exist and are populated for **every** agent, whether the caller
   sent legacy `provider` or new `{transport,vendor}`.
2. Driver/completer selection goes through `makeDriver`/`isAttached` keyed on `transport`; **behaviour identical**
   (existing registry tests pass + the new factory-preservation test).
3. Legacy `provider`/`providerName` still accepted **and still populated** ⇒ the untouched engine (incl. the
   leak-#2 gemini timeout) behaves **byte-identically** — proven by the existing team/timeout tests staying green
   unmodified.
4. No wire-contract hash change; full suite green in AgentTalk; `tsc -b` clean.
5. Client untouched and still interoperates (its legacy `provider` POST is accepted).

## 6. Approach & risks

- **One pure mapping helper** (`normalizeAgentKind`) is the single source of the axis translation — both server and
  registry consume it, so the mapping can't drift (the lesson from the wire-contract-hash dedup).
- **Additive-only**: no legacy field removed in T1 → nothing downstream (engine, client, recordings) can break.
- **IP-15 discipline** on the factory test: it must be able to fail (mis-route → wrong completer) or it proves
  nothing.
- **Blast-radius risk**: the `AgentProvider` union is referenced in ~7 files; T1 keeps the union, so most references
  are untouched — only the registry sniff sites and the server ingest change. Confirm `tsc` across the workspace
  after the type additions.

## 7. Open questions for the plan gate

1. **Field names** — `transport` / `vendor` / `capabilities`. Confirm (esp. `capabilities` vs `caps`/`limits`).
2. **Helper location** — `normalizeAgentKind` in `contracts` (pure, shared, no deps) so server + registry share one
   source. *(Recommend contracts.)*
3. **Team record** — T1 adds **Agent-level** fields only; `Team.provider` stays legacy until **T2** (which owns the
   coordinator that reads it). *(Recommend defer Team to T2 — keeps T1 off the engine.)*
4. **Implementer** — sole-agent fallback: same actor plans/implements/reviews; declare hats, keep gates. A second
   pair of eyes on the factory-preservation test is the highest-value independent check if one becomes available.

---
*Plan-review gate (Plan Reviewer ≠ Planner) approves §5 DoD + §7 before implementation. Implementation runs in a
per-task worktree (`task-BL-024-T1`).*
