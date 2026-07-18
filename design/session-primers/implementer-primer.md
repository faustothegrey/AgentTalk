---
role: implementer
key: 20260718-1627-b8d4e2
written: 2026-07-18 by Claude (session close — BL-036 doc+prune, BL-073, BL-074, BL-024 design+T1 all merged)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**. Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE
ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents*** (PO,
2026-07-15) → you are likely sole agent under the resource-scarcity fallback: wear every hat, declare each, keep
each gate separately. **Standing Conditional Reassignment ACTIVE** (you may implement). **Merges stay PO-gated —
the PO says "merge" and "push" as SEPARATE words and means it** (held all session; stop at every branch, wait for
the literal words). **Say the independence caveat in every delivery:** as sole agent you author AND review — what
actually catches things is *running the code*, never re-reading your own diff.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`). Verify HEAD against `origin/master` —
never trust a primer's hash.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
Plans for a BL live in `design/bl0NN-plan.md`; big items get a `design/bl0NN-*-design.md`. Closed items carry a
closing block + telemetry; read those first. **Resume from the backlog + the design/plan docs, NOT chat.**

## Where we are (2026-07-18 close)

**AgentTalk master ~`bd015ac`** (+ this wrap-up docs commit — verify via fetch). **Client `8f02b02` unchanged.**
Branches: `master` + `task-BL-039` (intentionally KEPT — holds an unmerged `providerName`-forwarding fix not on
master; a revive decision, not a leak — see BL-036 closing note). No worktrees/leaks of ours. PO's `.plist` shows
modified — leave it. PO's launchd svc on 3741/54321 — leave alone.

**Shipped this session (all PO-gated, merged+pushed):**
- **BL-036 CLOSED** — worktree discipline complete: `scripts/wt-setup.mjs` tooling + `design/worktree-discipline.md`
  + the one-time stale-branch prune.
- **BL-073** — `scripts/m16/m17-*-proof.mjs` read the wire-contract hash dynamically (were hardcoding retired v7).
- **BL-074** — `wt-setup create` uses `--no-track` so `remove --delete-branch` can't crash on an unpushed merge.
- **BL-024** — provider-split **design doc** (`design/bl024-provider-split-design.md`, PO gate passed) + **T1 MERGED**
  (`5dfab83`): transport × vendor split, additive/behaviour-preserving, engine untouched, suite **389/389**.

## What's next — BL-024 **T2** (the immediate work; authorized, not started)

T2 = the **frozen-engine slice**. Move the gemini fact-collection timeout OUT of `team-coordinator.ts` (leak #2)
into the per-agent `capabilities.factCollectionTimeoutMs` that **T1 already populates**. Read before you touch:
- **`design/bl024-provider-split-design.md` §4** — the strategy + the **byte-identical-timeout preservation
  contract** + the **IP-15 proof obligation** (a test that FAILS if you revert the edge injection).
- **`design/bl024-t1-plan.md`** — T1 context; write a `design/bl024-t2-plan.md` and take it through the plan gate.
- **`team-coordinator.ts` is a FROZEN guardrail** — the PO has **explicitly AUTHORIZED** this specific edit (recorded
  in the design doc §8 Q1 + BL-024 backlog note). Still: it's an M06 behaviour change → keep the preservation proof
  load-bearing. The current code: `getFactCollectionTimeoutMs()` (~`team-coordinator.ts:1001`) reads
  `team.provider === 'gemini'` / `agent.providerName === 'gemini'`. Target: `max(default, agent.capabilities?.
  factCollectionTimeoutMs ?? 0)` over members — vendor-blind. `GEMINI_FACT_COLLECTION_TIMEOUT_MS` is now exported
  from `@agenttalk/contracts/types` (T1) and equals the engine's local `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`.
  Note: T1 populates `capabilities` from the legacy PROVIDER; a `provider:'mcp'` agent with `providerName:'gemini'`
  currently gets the timeout via the engine's `providerName` check but has NO capability set — handle that case
  (T2 must not silently drop the timeout for that config; extend the edge to set the capability from providerName
  too, or the engine keeps a providerName fallback — decide in the T2 plan and prove byte-identical).
- After T2: **T3** = client cutover (send `{transport,vendor}`) + drop the legacy `provider` acceptance. Cross-repo.

## Op notes / gotchas

- **Worktrees (MANDATED for code):** `node scripts/wt-setup.mjs create <id> --base origin/master [--baseline]` →
  `/private/tmp/att-<id>` on `task-<id>` (now `--no-track`, so `remove <id> --delete-branch` is clean). Stage files
  **explicitly** — never `git add -A`. Docs/backlog/governance may be edited directly on master; **code may not**
  (see `design/worktree-discipline.md`).
- **Tests:** AgentTalk `npx vitest run` (**389** now). The vitest `include` is a SPECIFIC list (orchestrator,
  runtime-core, llm-client, mcp-transport, mcp-exec-server, scripts/__tests__) — it does **NOT** cover
  `packages/contracts` (a T1 follow-up is to add it; that's why the `normalizeAgentKind` unit test lives in
  runtime-core). `npm run backlog:check` gates the backlog (74 items). `tsc -b` uses `exactOptionalPropertyTypes` →
  optional fields are `?: T | undefined`.
- **Ports & live runs (unchanged):** orchestrator **3100** (`PORT`), MCP `AGENTTALK_MCP_PORT`, UI vite **5173**.
  Bare foreground `sleep` is BLOCKED — poll with `perl -e 'select(undef,undef,undef,1)'`.
- **Meter:** `node scripts/usage.mjs` (best-effort). At close: claude weekly **68%**, session **84%** (T1's
  implementation is what moved it — small docs/fixes are near-free).
- **Verify pushes via `fetch` + reading `origin/master`** — never the push output. Push each repo from its own dir.

Verify all the above against ground truth (`git fetch` both; read the BL-024 design/plan docs + backlog closing
blocks) before acting. Report your understanding, then STOP for the PO's go.
