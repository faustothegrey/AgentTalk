# BL-024 · T3b — goose as a first-class vendor + drop legacy `provider` acceptance — PLAN

> ## ⛔ PARKED 2026-07-27 — READ THIS FIRST
>
> **This plan is NOT live work.** It was written 2026-07-18 and committed 2026-07-27 only to stop it being lost
> (it had survived until then as an **untracked file on the PO's machine alone**, invisible to git, to every
> worktree and to every other agent).
>
> Under the PO directive of **2026-07-27** — *"defer everything that is not instrumental to reach the goal of
> AgentTalk within AgentTalk"* — **[[BL-024]] is `deferred`**, and so are the goose items this plan depends on
> ([[BL-038]] the goose/OpenRouter lane, [[BL-042]] the goose consensus recipe). See the
> `### PO directive — 2026-07-27` block in `design/backlog.md` for the full record and each reopen condition.
>
> **The "PO greenlit the goose spec (2026-07-18)" line below is superseded by that directive** — it was true when
> written and is not a licence to start now. **Reopen condition (BL-024): the brain's client-shape leak actually
> blocks a change**, e.g. adding a provider or transport. When it reopens, re-verify this plan against the code
> before trusting it: T3a landed in the client (`3612511`) and BL-024's own status was **re-scoped at the
> 2026-07-27 gate** — the two-axis split (`AgentTransport`, `normalizeAgentKind`) has **already landed**, so parts
> of §2 may be done or stale. Line citations in §3/§4 predate BL-083 and BL-085 and have almost certainly drifted.
>
> **Status (as written, 2026-07-18):** 🚧 **DRAFT — awaiting plan gate.** Author: Claude (planner hat, resource fallback). **Epic:** BL-024.
> **What changed:** the PO **greenlit the goose spec (2026-07-18), reversing the earlier "not now"** — so T3b is
> unblocked. T3a (`3612511`, client) cut gemini/claude/codex over to `{transport,vendor}` and left **goose on the
> legacy `provider` path** as a placeholder; T3b makes goose first-class and removes the legacy acceptance.
> **Cross-repo** (`AgentTalk` + `agentalk-mcp-client`). **Independence caveat:** sole agent; the load-bearing check
> is a **live cross-repo round-trip** (incl. a goose launch if a goose CLI is available), not a diff re-read.

## 1. Goal / "done" in one line

`goose` is a real vendor that rides the `{transport, vendor}` axis exactly like gemini/claude/codex; the
orchestrator no longer **accepts** the legacy `provider` field as *input*; recordings/scenarios that carry
`provider:` still work — proven live.

## 2. The two moves (recommend a sub-split: T3b-1 additive, T3b-2 the drop)

### T3b-0 — model becomes a first-class companion to vendor (PO, 2026-07-18)
The agent identity is **transport × vendor × model**, and BL-024 only formalized the first two. `model` today is a
free string with client-side per-vendor defaults (`getProviderCommand`: claude→`sonnet`, gemini→`gemini-3.1-pro`,
**goose→`openai/gpt-4o-mini`**), opaque to the orchestrator. goose is a *harness over an OpenRouter model*, so
`vendor:'goose'` alone is nearly meaningless — the **model is the identity**. **PO decision: model stays free-form,
but is a required companion — and goose MUST carry an explicit model** (a claude/gemini/codex default is itself a
meaningful agent; a goose default is not).
- **client `lib/agent-launcher.mjs`:** in `launchAgent`, after resolving the vendor, **reject `goose` with no
  `model`** (`AgentLauncherError('model is required for goose', 400)`), before the orchestrator create — same
  boundary that already validates provider/workdir. **Remove goose's silent `|| 'openai/gpt-4o-mini'` default** in
  `getProviderCommand` (client `provider-runtime.mjs`) so the requirement isn't quietly bypassed. claude/gemini/codex
  **keep** their defaults. *(Behaviour change: a goose launch with no model now fails fast instead of silently
  running gpt-4o-mini — that is the point.)*
- **server (optional, defense-in-depth):** the create handler MAY also reject `vendor:'goose'` with no `model`. Decide
  at the gate; the launcher is the primary boundary.
- **model stays a free string end-to-end** — no per-vendor valid-model registry (that was the deferred "structured"
  option). The orchestrator keeps carrying `agent.model` opaque.

### T3b-1 — goose becomes first-class (additive, low-risk, independently mergeable)
- **contracts `types.ts`:** `AgentVendor` gains `'goose'`. `normalizeAgentKind` gains a legacy `case 'goose'`
  (→ `{transport:'attached', vendor:'goose', legacyProvider:'goose'}`), symmetric with claude/codex.
- **The reverse-map crux:** `legacyProvider = transport==='in-process' ? 'api' : (vendor ?? 'mcp')` currently can't
  yield `'goose'` because `AgentProvider` doesn't include it. **Decision (recommend): add `'goose'` to
  `AgentProvider` too.** The union is **no longer behaviourally load-bearing** (T2 removed the last vendor branch
  from the engine; T1 keyed driver selection on `transport`) — it now survives only as a **serialization label**
  (recordings/usage/DTOs read `agent.provider`). Widening a label union is safe and keeps goose's identity faithful
  in recordings/usage-capture. *(Rejected: map goose→`'mcp'` in the reverse map — loses goose identity in every
  serialized `provider` field and in usage capture, for no benefit.)*
- **server `server.ts:~611`:** vendor-validation gains `'goose'`.
- **client `agentalk-mcp-client`:** remove T3a's goose exception in `lib/agent-launcher.mjs` — goose now takes the
  `{transport:'attached', vendor}` branch like the others. Update the goose test to assert the new shape.

### T3b-2 — drop the legacy `provider` **input** acceptance (the riskier half)
- **client:** with goose cut over, the client no longer sends `provider` anywhere → the legacy path is dead client-side.
- **server ingest** (`/api/agents` create `:602`, `/api/agents/:id/start` `:697`, `/api/teams` `:796`): stop reading
  `req.body.provider` for the transport/vendor axis; require `{transport,vendor}` (or `{transport}` for in-process).
  **Leave untouched:** `isUsageCaptureProvider` (`:740`) — a *different* axis (billing), not transport/vendor.
- **Keep `agent.provider` as an internal DERIVED field** (set from `normalizeAgentKind().legacyProvider`) so
  serialization/recordings/scenarios/usage keep working. **Do NOT delete the `AgentProvider` type** in T3b —
  that's a separate, larger cleanup (blast radius §4) and isn't required for "no legacy *acceptance*."

## 3. Why keep `agent.provider` (the recordings/scenarios reality)

Audit (2026-07-18): after T1/T2, `agent.provider` is still **read** for serialization at `team-coordinator.ts:1495`
& `:1543`, `conversation-coordinator.ts:156`, the startAgent guard `registry.ts:293`, `scenario-runner.ts:38/192`,
and server DTOs (`:195/:635/:653/:664`). Saved **recordings** and **scenario fixtures** carry `provider:`. So the
*type* and the *derived field* must persist for now; only the **input acceptance** is dropped. Fully retiring the
union is a follow-up cleanup, not T3b.

## 4. Legacy-drop blast radius & recordings compat (the risk to manage in T3b-2)

Removing `provider` as *input* can break: (a) the **web UI** if it POSTs `provider`; (b) **recording replay**; (c)
**scenario fixtures**; (d) any **test** POSTing `provider`. Options for the gate:
- **Recordings/replay:** a read-side legacy→`{transport,vendor}` shim at the replay boundary (design §5 rec.), so
  old recordings map forward without re-recording. *(Recommend.)*
- **Web UI / fixtures:** audit + migrate the POST bodies to the new shape (sweep in T3b-2).
- Sizing (fixtures/recordings/UI POST sites) is done at T3b-2 implementation, in its worktree.

## 5. Scope

**T3b-1 MAY touch:** `packages/contracts/src/types.ts`, `apps/orchestrator/src/server.ts` (vendor validation only),
client `lib/agent-launcher.mjs` + its test, unit tests.
**T3b-2 MAY touch:** server ingest sites (create/start/teams), recording-replay shim, web-UI POST sites,
scenario/fixture sweep, tests — both repos.
**MAY NOT (either):** `team-coordinator.ts` timeout logic (T2 — must stay vendor-blind), `isUsageCaptureProvider`,
the `ApiProvider`/`apiVendor` axis, `wire-contract.json` (confirm no hash change), the law (authority/routing),
and — in T3b — the `AgentProvider` **type deletion** (deferred cleanup).

## 6. Definition of Done

**T3b-0 (model):** a goose launch with **no model is rejected** at the launcher (and optionally the server); the
silent goose default is removed; claude/gemini/codex defaults unchanged; `agent.model` still flows opaque. Tests
cover reject-goose-no-model and accept-goose-with-model.
**T3b-1:** goose launches as `{transport:'attached', vendor:'goose', model:<explicit>}`; `normalizeAgentKind` maps
goose both ways; server accepts `vendor:'goose'`; a goose agent gets `transport:'attached'`, `vendor:'goose'`,
`provider:'goose'` (derived), no capability (default timeout — verified byte-identical to a non-gemini today). Both
suites green.
**T3b-2:** server rejects/ignores legacy `provider` for the transport/vendor axis; recordings replay via the shim;
web-UI/fixtures migrated; usage-capture untouched. Live cross-repo round-trip (incl. goose if a CLI is available).
No wire-contract hash change; full suite green in both repos; `tsc -b` clean.

## 7. Open questions for the plan gate

1. **Sub-split T3b-1 / T3b-2?** *(Recommend yes — bank "goose is real" quickly; tackle the legacy-drop risk
   separately, mirroring the T3a/T3b split.)*
2. **Add `'goose'` to `AgentProvider` (the serialization-label union)?** *(Recommend yes — safe now the union is
   behaviourally dead; keeps goose identity in recordings/usage. Alternative maps goose→`mcp`, losing identity.)*
3. **Keep `agent.provider` as a derived field / don't delete the `AgentProvider` type in T3b?** *(Recommend yes —
   full type retirement is a separate cleanup; deleting it now blasts recordings/scenarios/DTOs.)*
4. **Recordings compat** — read-side shim vs. re-record fixtures? *(Recommend shim.)*
5. **Live goose verification** — is a `goose` CLI available to do a real launch round-trip, or do we verify goose via
   the unit/contract path + a live gemini/claude round-trip and treat goose-live as best-effort?

---
*Plan gate + PO `go` approve §6 DoD, §7, and the T3b-1/T3b-2 split before any code. Each sub-slice in its own
worktree/branch; merges PO-gated per repo.*
