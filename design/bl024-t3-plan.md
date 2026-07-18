# BL-024 · T3 — client cutover + legacy `provider` drop (cross-repo) — PLAN

> **Status:** 🚧 **DRAFT — awaiting plan gate.** Author: Claude (planner hat, resource fallback). **Epic:** BL-024
> (design: `design/bl024-provider-split-design.md`, PO gate 2026-07-18). **T3 of 3** — the cleanup slice. T1
> (`5dfab83`) added the axis + edge; T2 (`8375387`) made the engine vendor-blind; **T3 cuts the client over to
> `{transport,vendor}` and removes the legacy `provider` acceptance**, so the conflated `AgentProvider` union can
> retire. **Cross-repo** (`AgentTalk` + `agentalk-mcp-client`). **Independence caveat:** sole agent — same actor
> plans/implements/reviews; what catches things is a **live cross-repo round-trip**, not a diff re-read.

## 1. Goal / "done" in one line

The client sends `{transport, vendor}` (not `provider`); the orchestrator's API stops accepting the legacy
`provider` string for the **transport/vendor axis**; the `AgentProvider` union is removed (or reduced to only what
`apiVendor`/usage-capture still legitimately need) — **with no functional change to how any agent actually attaches
or runs**, proven by a live round-trip in both repos.

## 2. Current cross-repo shape (ground truth, 2026-07-18)

**Client (`agentalk-mcp-client` @ `8f02b02`)** — `llm-agent.mjs` takes `--provider <vendor>` (default `gemini`),
and POSTs it as `provider: providerName` (`:60`) / `providerName: provider` (`:99`) when creating/starting its
agent. `agent-launcher.mjs` documents `POST /agents { provider, … }`. All the client's agents are the **attached**
transport (MCP-attach); `provider` here always carries a **vendor** name.

**Orchestrator (`AgentTalk` @ `4ab0e13`)** — `req.body.provider` is read at ~6 sites in `server.ts`:
| site | endpoint | axis | T3 disposition |
|---|---|---|---|
| :604 | (agent create/`:id`) | transport/vendor | migrate |
| :680/:686/:697 | `/api/agents/:id/start` (→ `activateAgent`) | transport/vendor | migrate |
| :796 | `/api/teams` | transport/vendor (team) | migrate |
| **:740** | usage-capture (`isUsageCaptureProvider`) | **DIFFERENT axis (billing provider)** | **LEAVE — out of scope** |

T1's `normalizeAgentKind` already accepts the new `{transport,vendor}` shape and maps legacy→new; T3 flips the
default so the **client emits new** and the server **stops accepting legacy** for the migrated sites.

## 3. The two moves

**Move A — client cutover (`agentalk-mcp-client`).** `llm-agent.mjs` sends `{ transport:'attached', vendor:<name> }`
instead of `provider:<vendor>`. Keep `--provider` as the CLI ergonomic (map it to `vendor`), or add
`--transport`/`--vendor` — decide at the gate (recommend: keep `--provider` CLI flag → translate to
`{transport:'attached', vendor}` in the body; least churn for operators/recordings).

**Move B — legacy drop (`AgentTalk`).** At the migrated ingest sites, accept **only** `{transport,vendor}` (via
`normalizeAgentKind`); remove the legacy `provider` branch. Then remove `AgentProvider` from the codebase where it
only encoded the conflated axis (the engine no longer references it after T2; the record's legacy `provider`/
`providerName` fields drop except where `apiVendor`/`providerName` is still needed for the in-process/api completer).

## 4. The ordering hazard (flag-day avoidance) — the central design question

Dropping legacy acceptance (Move B) and cutting the client over (Move A) in one shot is a **two-repo flag-day**: an
old client hitting a new server (or vice-versa) breaks. The design (§8 Q3) chose **deprecate-then-drop** precisely
to avoid this. So the safe sequencing is:
1. **T3a — client cutover only.** Client sends new shape; server still accepts BOTH (T1's compat map stays). Ship
   + verify live. Now the client no longer depends on legacy acceptance.
2. **T3b — legacy drop.** Only after T3a is live and verified, remove the legacy acceptance + retire the union.

**Recommendation for the gate: split T3 into T3a (client cutover) and T3b (legacy drop)**, merged separately, with
a live round-trip between them. This keeps each side independently revertible and never has a new server rejecting
an un-migrated client. *(If the PO prefers a single coordinated change because both repos are operator-launched
together, that's viable too — but it forfeits the safety margin.)*

## 5. Recordings / fixtures compat

Saved recordings and test fixtures carry `provider:'gemini'|'mcp'|…`. Removing legacy acceptance risks breaking
recording replay. Options (decide at gate): (a) keep a **read-side** legacy→new shim for *recordings only* while
rejecting legacy on the *live* API; (b) migrate the fixtures. Recommend (a) minimal shim + fixture sweep, scoped
in T3b.

## 6. Scope (proposed — refine per the T3a/T3b split decision)

**MAY touch:** client `llm-agent.mjs`, `agent-launcher.mjs` (+ any provider-runtime send site); AgentTalk
`apps/orchestrator/src/server.ts` (migrated ingest sites only), `packages/contracts/src/types.ts`
(retire/reduce `AgentProvider`), `packages/runtime-core/src/agents/agent.ts` + `registry.ts` (drop legacy fields
where dead), fixtures/recordings-compat, tests in both repos.
**MAY NOT touch:** `team-coordinator.ts` timeout logic (T2, done — must stay vendor-blind), the usage-capture
provider axis (`:740`, `isUsageCaptureProvider`), the `ApiProvider`/`apiVendor` axis, `wire-contract.json`
(`provider` isn't hashed — confirm no hash change), the law (authority/routing).

## 7. Definition of Done

1. Client emits `{transport,vendor}`; a **live** create→attach→turn round-trip succeeds (both repos on their new HEAD).
2. Server rejects/ignores legacy `provider` for the migrated axis (T3b); usage-capture provider untouched.
3. `AgentProvider` union removed or reduced to its non-conflated remainder; engine still references no vendor (T2 holds).
4. Recordings/fixtures still replay (shim or migrated).
5. Full suite green in **both** repos; `tsc -b` clean; **no wire-contract hash change**; cross-repo contract check green.

## 7b. Gate decisions (PO, 2026-07-18)

- **Split T3a/T3b:** ✅ approved ("proceed").
- **`goose` (found mid-implementation):** the client's `SUPPORTED_PROVIDERS` includes `goose`, which is in **neither**
  `AgentVendor` nor the legacy `AgentProvider` union, and AgentTalk has no `goose` handling. **PO ruling:** *goose is a
  real vendor; its full meaning will be specified later — not now, and it is not needed to proceed.* **T3a therefore
  cuts over only the three enumerated vendors (`gemini`/`claude`/`codex`); `goose` stays on the legacy `provider:'goose'`
  path** (which T3a's server still accepts). Sending `transport` for goose would force `normalizeAgentKind` to map it to
  opaque `'mcp'` (goose isn't a legacy provider) — a behaviour change requiring the deferred reverse-map design, so it is
  explicitly avoided here. Goose-as-vendor (union + reverse-map) is folded into **T3b / the deferred goose spec.**
- **T3a is client-only:** `activateAgent` re-derives transport/vendor from the stored `agent.provider`, and the create
  handler already accepts `{transport,vendor}` (T1). So T3a touches **only** `agentalk-mcp-client` — no AgentTalk change.

## 8. Open questions for the plan gate

1. **Split T3 into T3a (client cutover) + T3b (legacy drop)?** *(Recommend yes — avoids the two-repo flag-day; each
   independently revertible with a live round-trip between.)*
2. **CLI ergonomics** — keep `--provider` mapped to `vendor`, or introduce `--transport`/`--vendor`? *(Recommend keep
   `--provider` → map; least operator/recording churn.)*
3. **Recordings compat** — read-side shim vs. fixture migration? *(Recommend minimal read-side shim + targeted sweep.)*
4. **How far to retire `AgentProvider`** — fully remove, or leave a reduced alias? *(Recommend remove from the
   transport/vendor axis; keep whatever `apiVendor`/usage-capture legitimately still needs, under a different name if
   it clarifies.)*
5. **Live-verification plan** — a real cross-repo attach round-trip is the load-bearing bar (per the sole-agent
   caveat). Confirm the harness/launcher to use (`scripts/`), and that agy/claude/codex availability allows it.

---
*Plan gate + PO `go` approve §7 DoD, §8, and the T3a/T3b split before any code. Cross-repo ⇒ each side in its own
worktree/branch; merges PO-gated per repo.*
