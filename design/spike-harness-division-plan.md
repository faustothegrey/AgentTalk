# Spike — Harness/AgentTalk division (pre-M10) — Plan

> **Spike, not a milestone.** Goal: make the ancillary `agentalk-mcp-client` harness a **pure
> transport/relay** with **zero consensus-protocol logic**, and trim the boundary contract to
> transport-only — so all protocol evolution stays confined to AgentTalk. Performed immediately,
> before the M10 epic. Implementer = Claude under LB-14 (Gemini out of budget); merge/closure
> HUMAN-GATED (Fausto).

## 1. Goal & rationale

The client harness exists **only in the context of AgentTalk** (decision: Fausto, 2026-06-25 — it is
ancillary; agent memory `client-harness-is-ancillary`). All consensus semantics (phases, message
types, planner decision-making) belong in AgentTalk. This spike removes the one place the client still
encodes protocol semantics and tightens the boundary contract, so the division is real and can't
silently re-couple as M10 evolves the protocol.

## 2. Findings that set the scope (grounded, verified this session)

1. **The consensus leak is one orphaned file + its wiring.** Consensus vocabulary
   (`agreement_proposal`, `submit_plan`, `fact_collection`, `opinion`, …) lives in the client in
   **exactly one place**: `lib/stub-bridge.js` — a hand-coded mock-planner state machine — plus the
   `provider=stub` wiring that launches it. **Nothing selects `provider=stub`** on either side (no
   test, script, or live gate). The client's own test (`__tests__/exec-rpc.test.ts`) uses
   `provider=gemini` with a **mocked MCP server**. Only a doc line references stub:
   `design/phase6-multi-agent-consensus-plan.md:304`. ⇒ The stub is **dead code** → **delete**, not
   relocate (no offline self-test is wanted; the client relies on AgentTalk's live gates).

2. **The relay core is already message-type-agnostic.** `lib/protocol.mjs` is pure wire framing
   (`READY/REQ/RES/EVT`); `mcp-client.mjs` is the WebSocket transport. Neither reads `messageTypes`.

3. **`messageTypes` in the contract is doubly orphaned.** The relay never reads it, and — unlike
   `mcpTools`, which a drift-guard test pins to the runtime registry
   (`packages/runtime-core/src/registry/__tests__/mcp-tools.test.ts`) — **nothing** guards
   `messageTypes` against AgentTalk's `protocol-payloads.ts`. Grep for `messageTypes` in
   AgentTalk `packages/`+`apps/` `.ts` ⇒ **zero consumers**. ⇒ **strip it** from the boundary
   contract.

4. **The cross-repo contract check ALREADY EXISTS (fail-closed).** Client sends
   `clientInfo.contractHash` in the `initialize` handshake (`mcp-client.mjs:36`); server compares it to
   `expectedContractHash` and on mismatch errors + closes the socket
   (`apps/orchestrator/src/mcp-server.ts:149-154`, `1008 'Contract hash mismatch'`). ⇒ **No new
   cross-repo check needed.** The handshake gate also **enforces lockstep**: both contract copies must
   carry an identical hash or every client is rejected.

## 3. Settled decisions (Fausto)

- Client harness is **ancillary** → pure relay; **no offline self-test** retained.
- `messageTypes` → **stripped** from the boundary contract (both copies).
- Stub → **deleted** from the client (consequence of the above + finding #1).
- Cross-repo check → **already done**; do not rebuild.

## 4. Scope — exact sites

**Client repo (`/Users/fausto/Software/agentalk-mcp-client`):**
- `lib/stub-bridge.js` — **delete file**.
- `lib/executor-runtime.mjs` — remove the `stub` validation clause (~`:26`), the `stub` branch in
  `getPersistentProviderCommand` (~`:74-81`), the `StubPersistentExecutor` class (~`:819-857`), and the
  `createExecutor` stub branch (~`:873-874`).
- `lib/provider-runtime.mjs:2` — remove `'stub'` from `SUPPORTED_PROVIDERS`.
- `wire-contract.json` — remove `data.messageTypes`; bump `version` 4→5; recompute `hash`.

**AgentTalk repo (this repo):**
- `packages/contracts/wire-contract.json` — remove `data.messageTypes`; bump `version` 4→5; recompute
  `hash` (**must equal the client's exactly**).
- `design/phase6-multi-agent-consensus-plan.md:304` — annotate/remove the stale `--provider stub`
  reference (stub no longer exists).
- Ledger `design/spike-harness-division-implementation.md` — created at kickoff.

**Explicitly OUT of scope (do NOT touch):** `mcp-server.ts` handshake gate (already correct); any
protocol semantics / `protocol-payloads.ts`; the real provider paths (`claude/codex/gemini`);
rebuilding any offline mock inside AgentTalk (deferred — not wanted now).

## 5. Task breakdown & sequencing

- **S1 — Delete the stub from the client.** Remove `stub-bridge.js` + all `stub` wiring (4 sites).
  Verify nothing else references `stub`. Gate: client `npm run build` (lint + vitest) green.
- **S2 — Strip `messageTypes`, in lockstep, both repos.** Edit AgentTalk's `wire-contract.json`
  (remove `messageTypes`, bump v5), recompute the hash via the same algorithm `verify-contract.js`
  uses, embed it; copy the **byte-identical** `data` block + hash + version into the client's
  `wire-contract.json`. Run **both** `verify-contract.js`.
- **S3 — Verify the boundary end-to-end.** Run an AgentTalk live gate (`scripts/test-mcp-gate.mjs` or
  `test-live-gate.mjs`) so a real client connects with the new v5 hash and the handshake **accepts** —
  proving the lockstep update is correct and the existing cross-repo gate still works.
- **S4 — Docs.** Update `phase6-…-plan.md:304`; write the implementation ledger; telemetry block.

Sequencing: S1 and S2 are independent; do S1 first (isolated to the client). S3 gates the merge. The
two `wire-contract.json` edits in S2 **must land together** (hash lockstep).

## 6. Risks & mitigations

- **Hash lockstep (highest risk).** Any divergence — even whitespace in `data` — makes the handshake
  reject every client and live gates fail. *Mitigation:* compute the hash once, copy the `data`
  block byte-identical; assert both `verify-contract.js` pass and the two hashes are equal before S3.
- **Hidden `messageTypes` consumer.** Grep shows none in `packages/`+`apps/`, but web/observability
  unscanned. *Mitigation:* re-grep the whole AgentTalk repo for `messageTypes` before removal; `tsc -b`
  catches any TS consumer.
- **Client is a separate git repo.** Changes commit separately; confirm its branch/remote state at
  kickoff (the earlier `git remote -v` was empty — verify before committing).
- **Behaviour-change rule (M06).** Trimming the contract is a deliberate, approved change; the version
  bump + hash recompute make it explicit and the handshake gate makes drift fail loudly.

## 7. Definition of Done

1. **Client is consensus-clean:** grep of the client repo for `agreement_proposal|submit_plan|fact_collection|opinion|messageTypes`
   returns **zero** (transport vocabulary only); `stub-bridge.js` gone; no `provider=stub` path remains.
2. **Client gate green:** `npm run build` (lint + vitest) passes.
3. **Contract trimmed in lockstep:** `messageTypes` removed from **both** copies; `version` = 5; the two
   `hash` values are **identical**; both `verify-contract.js` pass.
4. **AgentTalk gate green:** `tsc -b` 0 + full suite passes (the `mcpTools` drift-guard still passes —
   unaffected).
5. **End-to-end proof:** a live gate shows a real client connecting with the v5 hash and the handshake
   **accepting** (cross-repo gate exercised, not just asserted).
6. **Docs:** `phase6-…-plan.md:304` corrected; implementation ledger written; task-closure telemetry
   block recorded.

## 8. Open items (confirm at review)

- **a.** `version` bump 4→5 OK? (Mechanical; flagging since it's a public contract version.)
- **b.** Add an *optional* commit-time CI assertion mirroring the handshake hash check (so drift fails
  before a live run), or rely on the existing runtime gate + live gates? *Recommendation: rely on the
  existing gate; skip the extra CI check unless you want belt-and-suspenders.*
- **c.** Client repo git/remote strategy (separate repo) — branch + commit message convention for it.
