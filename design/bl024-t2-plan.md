# BL-024 · T2 — the frozen-engine slice: move the gemini timeout to capability metadata — PLAN

> **Status:** 🚧 **DRAFT — awaiting plan gate.** Author: Claude (planner hat, resource fallback). Reviewed by:
> Claude (plan-reviewer hat — same actor; independence caveat below). **Epic:** BL-024
> (design: `design/bl024-provider-split-design.md`, PO gate passed 2026-07-18; **T2 frozen-engine edit explicitly
> AUTHORIZED** at §8 Q1). **This is T2 of 3.** T1 (`5dfab83`) shipped the new axis + edge, engine untouched;
> **T2 makes the frozen engine vendor-blind**; T3 = client cutover + legacy drop.
> **Independence caveat:** sole agent — the same actor plans, implements, and reviews. What actually catches a
> regression here is the **IP-15 discriminating test running**, never a re-read of the diff.

## 1. Goal / "done" in one line

Make `team-coordinator.ts` compute the fact-collection timeout with **no vendor name** — reading only
`capabilities.factCollectionTimeoutMs` (per-agent, and per-team) — while the computed timeout stays
**byte-identical to `master` for every current configuration**, proven by a test that FAILS if the edge
injection is reverted.

## 2. What the engine does today (the behaviour to preserve exactly)

`getFactCollectionTimeoutMs(team)` (`team-coordinator.ts:1001-1020`) bumps the base `480_000` default to
`720_000` (`DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`) when **any** of three vendor sniffs hit:

| # | Sniff (current line) | When it fires |
|---|---|---|
| a | `team.provider === 'gemini'` (:1004) | `POST /api/teams {provider:'gemini'}` — a free string, **reachable** (`server.ts:796`) |
| b | `agent.provider === 'gemini'` (:1011) | a member created with legacy `provider:'gemini'` |
| c | `agent.providerName === 'gemini'` (:1011) | a member with `providerName:'gemini'` **regardless of `provider`** (e.g. `provider:'mcp'`) |

The 720s is `max()`-combined, so any hit wins; no hit ⇒ the 480s default. **These three cases are the entire
contract T2 must preserve.**

## 3. Where each case is (or isn't) covered by T1's edge — the gap

T1's `normalizeAgentKind` (`contracts/src/types.ts:72`) sets `capabilities.factCollectionTimeoutMs = 720_000`
**only when the resolved vendor is gemini** — i.e. from legacy `provider:'gemini'` or new `vendor:'gemini'`.
Registry then copies it onto the Agent record (`registry.ts:204`). So:

- **Case (b)** `provider:'gemini'` → caps set by T1 ✅ (engine can read `agent.capabilities`).
- **Case (c)** `provider:'mcp'` **+** `providerName:'gemini'` → `normalizeAgentKind` case `'mcp'` returns **no
  caps** ❌ — **the gap the primer flags.** T2 must close it or it silently drops the timeout.
- **Case (a)** `team.provider:'gemini'` → T1 deferred all Team-level work to T2 (T1 plan §7 Q3); **no team-level
  capability exists yet** ❌.

## 4. Decisions (recommendations for the gate)

**D1 — close the `providerName:'gemini'` gap at the edge (keep the engine vendor-blind).**
Extend `normalizeAgentKind` so the gemini capability is also set when `providerName === 'gemini'`, **without
altering `vendor` or `legacyProvider`** (so every existing T1 output is unchanged — only the previously-absent
capability is added for the `mcp`+`providerName:'gemini'` case). Rule, stated once: *the capability is present iff
the agent would have triggered the old 720s bump* — i.e. `provider==='gemini' || providerName==='gemini'`.
Rejected alternative: keep a `providerName` fallback **in the engine** — that re-introduces a vendor name into the
frozen coordinator, defeating the item's whole point.

**D2 — carry the team-level bump as a Team capability (mirror of the agent path).**
Add `capabilities?: AgentCapabilities` to `Team` (contracts). In `createTeam`, derive it from the team's
`provider` via `normalizeAgentKind` (`provider:'gemini'` ⇒ `{factCollectionTimeoutMs:720_000}`). The engine reads
`team.capabilities?.factCollectionTimeoutMs`. This is provably byte-identical **and** vendor-blind, and it mirrors
exactly how agents already work — no bespoke team logic.
Rejected alternative: just delete the `team.provider==='gemini'` branch and assume a gemini team always has a
gemini member — **not provable** (a request can POST `provider:'gemini'` with non-gemini members), so it would
break the byte-identical contract.

## 5. Deliverables

### 5a. Edge — close the gap (`packages/contracts/src/types.ts`, `normalizeAgentKind`)
- After the existing switch, ensure gemini caps are present when `providerName === 'gemini'` and not already set.
  Do **not** change `vendor`/`legacyProvider`/`transport` for any input (preserves all T1 outputs).

### 5b. Team record + edge (`packages/contracts/src/types.ts`, `registry/team-coordinator.ts createTeam`)
- `Team.capabilities?: AgentCapabilities` (contracts).
- `createTeam(members, provider)` populates `team.capabilities` from `normalizeAgentKind({provider}).capabilities`.
  *(createTeam is in the coordinator file but is not the frozen timeout logic; this addition is additive and
  behaviour-preserving. Called out for the gate since the file is a guardrail.)*

### 5c. The frozen edit (`registry/team-coordinator.ts`, `getFactCollectionTimeoutMs`) — **AUTHORIZED (§8 Q1)**
Replace the three vendor sniffs with capability reads — vendor name gone entirely:
```ts
private getFactCollectionTimeoutMs(team: Team): number {
  let maxTimeout = this.factCollectionTimeoutMs;
  maxTimeout = Math.max(maxTimeout, team.capabilities?.factCollectionTimeoutMs ?? 0);
  for (const member of team.members) {
    try {
      const agent = this.deps.getAgent(member.agentId);
      maxTimeout = Math.max(maxTimeout, agent.capabilities?.factCollectionTimeoutMs ?? 0);
    } catch (err) {
      this.deps.logError(`[TeamCoordinator] Failed to resolve agent ${member.agentId} for timeout calc`, err);
    }
  }
  return maxTimeout;
}
```
The `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS` local const becomes unused in the timeout path — remove it only if
`tsc`/lint flags it; otherwise leave untouched to minimize the diff. (It already has a contracts twin,
`GEMINI_FACT_COLLECTION_TIMEOUT_MS`.)

### 5d. IP-15 proof test (new) — the load-bearing bar
No existing test pins the 720s number (`getFactCollectionTimeoutMs` is private and unasserted today), so this test
is the **only** regression guard. Observe the scheduled delay via fake timers rather than exposing the private
method:
- Drive `handleAckPlanningProtocol → fact-collection start` (the one caller, `:1068`) under `vi.useFakeTimers()`
  with a spy on `setTimeout`; assert the scheduled delay is **720_000** for each of the three cases (a/b/c) and
  **480_000** for a plain non-gemini team. Cover case (c) explicitly: `provider:'mcp'` + `providerName:'gemini'`.
- **IP-15 discriminator (must be able to fail):** a variant asserting that with the edge injection reverted (an
  agent/team carrying **no** capability) the gemini cases would compute **480_000**, not 720_000 — encoded as a
  direct-construction assertion so a future mis-edit of the edge is caught. Document the manual stash-and-rerun in
  the ledger per §4 of the design.

### 5e. Regression
- The existing 29 `team-coordinator.test.ts` cases stay green **unmodified**.
- `npx vitest run` → **389 → 390+** (only additions); `tsc -b` clean; `npm run backlog:check` green; **no
  wire-contract hash change** (`provider` isn't hashed; no packet/tool change).

## 6. Scope

**MAY touch:** `packages/contracts/src/types.ts` (edge + `Team.capabilities`), `registry/team-coordinator.ts`
(the authorized `getFactCollectionTimeoutMs` edit + `createTeam` team-capability population), new test file(s),
`design/bl024-t2-plan.md` + backlog/ledger (docs, on master).
**MAY NOT touch:** the client repo (`agentalk-mcp-client` — T3), `wire-contract.json`, the law
(authority/routing), `ApiProvider`, `registry.ts` driver factory (T1's, done), any other engine behaviour. The
legacy `provider`/`providerName` fields **stay** (dropped in T3).

## 7. Definition of Done

1. `getFactCollectionTimeoutMs` references **no** vendor name — only `capabilities.factCollectionTimeoutMs`
   (team + members).
2. Byte-identical timeout for all three current bump cases (a/b/c) **and** the default — proven by the new fake-timer
   test asserting exact ms.
3. The `provider:'mcp'`+`providerName:'gemini'` case (c) still yields 720s (the gap is closed at the edge).
4. IP-15 discriminating assertion present: reverting the edge injection ⇒ gemini cases drop to 480s ⇒ test fails.
5. Existing suite green unmodified; `tsc -b` clean; backlog:check green; no wire-contract hash change.
6. Client untouched; still interoperates (legacy `provider` POST still accepted and still bumps via the edge).

## 8. Risks & open questions for the plan gate

1. **Team.capabilities in contracts (D2)** — adds a field to the `Team` type. Confirm this is in-scope for T2
   (T1 explicitly deferred Team-level work here). *(Recommend yes — it's the only byte-identical way to preserve
   case (a).)*
2. **`createTeam` lives in `team-coordinator.ts`** (the frozen file) — the team-capability population is additive
   and off the timeout path, but it *is* an edit to the guardrail file beyond the one §8-Q1-authorized function.
   Confirm the authorization covers additive plumbing in the same file, or relocate the population to the registry
   wrapper (`registry.createTeam`, `registry.ts:918`) to keep the frozen file's diff limited to
   `getFactCollectionTimeoutMs`. *(Recommend relocating to `registry.ts:918` — smaller frozen-file diff, same
   effect.)*
3. **Edge fix shape (D1)** — extending `normalizeAgentKind` vs. populating caps in the registry when
   `providerName==='gemini'`. *(Recommend `normalizeAgentKind` — single source of truth, per T1's design; verify
   no existing T1 test asserts "mcp ⇒ no capabilities" for a `providerName:'gemini'` input.)*
4. **Sole-agent independence** — same actor plans/implements/reviews; the IP-15 test *running* is the real check.

---
*Plan-review gate (Plan Reviewer ≠ Planner, waived under resource fallback with the caveat above) + the PO's
go approve §7 DoD + §8 before code. Implementation runs in a `task-BL-024-T2` worktree.*
