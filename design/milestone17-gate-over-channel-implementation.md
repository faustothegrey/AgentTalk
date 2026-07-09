# Milestone 17 Implementation Ledger

**Epic:** The gate over the channel
**Current Task:** M17-T1

## §3c M17-T1 Implementer Claims Table

| Claim | Result | Verdict | Evidence |
|---|---|---|---|
| An assigned Implementation Reviewer can emit a reviewer verdict event. | pass | CLAIMED | `m17-gate-channel.test.ts` line 22 |
| The assigned SM can emit a go/no-go event. | pass | CLAIMED | `m17-gate-channel.test.ts` line 39 |
| A non-SM attached agent cannot emit an `[SM]` workflow event. | pass | CLAIMED | `m17-gate-channel.test.ts` line 57 |
| A non-human attached agent cannot emit a PO-level or `[Human]` workflow event. | pass | CLAIMED | `m17-gate-channel.test.ts` line 79 |
| Ordinary non-workflow `send_to_agent` behavior is unchanged. | pass | CLAIMED | `m17-gate-channel.test.ts` line 101 |

## Implementation Review: M17-T1 Round 1 (Codex, 2026-07-09)

**Verdict: REFUTED.** The targeted M17 tests pass, but the delivery violates the approved Gate 1 amendments and
regresses preserved M16 baton behavior.

**Verification run:**
- `npx vitest run packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts`
  -> **2 files / 7 tests passed**.
- `npx tsc -b` -> exit 0.
- `git diff --check && git diff --cached --check` -> exit 0.
- Direct M16 baton-shape probe against `send_to_agent` with payload `[SM] This is the baton payload` and
  `baton: { kind: "workflow_baton", originTag: "[SM]", fromRole: "planner", toRole: "worker", batonId: "baton-123" }`
  -> **rejected** with `Unauthorized: Agent sender-9 is not assigned the scrum-master workflow role`.

**Findings:**
1. **C4 regression / preserved M16 behavior broken.** `registry.ts` now rejects any payload starting with `[SM]`
   unless the sender has `workflowRole === "scrum-master"` (`registry.ts:391-401`). M16's accepted baton shape uses
   `[SM]` text plus `workflow_baton` metadata from a planner-role sender; the direct probe above is rejected before
   delivery. This violates the M17 plan's C4 preservation bar and the explicit "M16 baton behavior" guard.
2. **Gate-event recording path is not the approved path.** Gate 1 required accepted and refused gate events to ride
   the registry event -> `SessionRecorder` runtime channel. This delivery emits no workflow-gate runtime event and
   instead attaches accepted `workflowEvent` metadata to the conversation transcript path (`registry.ts:453-462`).
   Refused attempts throw before delivery and have no corresponding recorder/runtime event, so the required refusal
   evidence path is absent.
3. **Origin tag vocabulary drift.** The plan's applied Gate 1 ruling is `[PO]` canonical, `[Human]` legacy alias,
   and `[SM]`; the delivery adds `[Reviewer]`, `[Implementer]`, and `[Planner]` origin tags in
   `packages/contracts/src/types.ts` and the MCP schema without Gate 1 approval.

**Required return scope:**
- Preserve existing non-workflow and M16 baton `send_to_agent` behavior. Do not reject bracketed text unless it is
  attached to a workflow gate event that claims authority, or otherwise prove the narrowed rule does not affect M16.
- Emit a registry workflow-gate attempt event for accepted and refused workflow events, and wire that event to the
  orchestrator `SessionRecorder` runtime channel in the relevant M17 task. Refusals must be observable without
  relying on conversation transcripts.
- Remove unapproved origin tags or obtain a Gate 1/PO scope ruling before keeping them.

## Implementation Review: M17-T1 Round 2 (Codex, 2026-07-09)

**Verdict: VERIFIED.** The Round 1 findings are addressed and M17-T1 is verified for Gate 2. The broader live proof
and final workflow-doc updates remain later M17 tasks.

**Verification run:**
- `npx vitest run packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts`
  -> **2 files / 7 tests passed**.
- `npx tsc -b` -> exit 0.
- Direct M16 baton-shape probe against `send_to_agent` with payload `[SM] This is the baton payload` and
  `workflow_baton` metadata -> **accepted** and delivered to the receiver EVT path.
- Direct workflow gate-attempt event probe -> one accepted `[SM]` event and one refused `[PO]` event emitted through
  `workflow_gate_attempt`, with refusal reason
  `Unauthorized: PO-level workflow events can only originate from trusted human/API paths`.
- `npm test` -> **50 files / 287 tests passed**.
- `npm run backlog:check` -> backlog structure OK, **19 items, 0 warnings**.
- `git diff --check && git diff --cached --check` -> exit 0.
- Frozen/out-of-fence checks: zero `team-coordinator.ts` diff, zero `packages/contracts/wire-contract.json` diff,
  and no diff in `/Users/fausto/Software/agentalk-mcp-client`.
- Pollution check: `git worktree list` shows only `/Users/fausto/Software/AgentTalk`; `git branch --list 'task-*'`
  shows only the active `task-M17-T1` branch.

**Disposition of Round 1 findings:**
1. **M16 baton preservation:** fixed. The aggressive bracket-text guard was removed; structured `workflowEvent`
   metadata is now the authority-checked path, so M16 baton text is no longer rejected.
2. **Runtime recorder path:** fixed for T1. `Registry` emits `workflow_gate_attempt` for accepted/refused workflow
   gate attempts, and `apps/orchestrator/src/server.ts` records it through the `SessionRecorder` runtime channel and
   broadcasts it.
3. **Origin tag vocabulary:** fixed. `WorkflowOrigin` and MCP schema are back to `[Human] | [PO] | [SM]`.

**Reviewer note for later M17 tasks:** accepted `workflow_gate_attempt` currently means the authority check accepted
the event; it is emitted before target delivery checks. The live proof and UI/recording task should keep this
semantics explicit when using the event as evidence.

## Task-end Review: M17-T1 Round 1 (Claude, 2026-07-09)

**Verdict: REFUTED ⛔ — merge declined; back to the implementer via Gate 2.** Fresh-eyes sweep found a
substantive authority hole the five T1 tests do not cover; reproduced by running before ruling.

**Finding G3-1 — a tag-less `po-act` is ACCEPTED from an attached session (T1 bar 4 violated).** The guard
refuses the *tag* (`originTag: '[PO]'|'[Human]'`), not the *act*. Two repro tests (2/2 PASSED — archived in
the task-end reviewer's scratchpad, shapes reproduced below in return scope):
- **Repro A:** agent assigned `scrum-master` sends `action: 'po-act'`, `fromRole: 'scrum-master'`, **no
  `originTag`** → `workflow_gate_attempt` emitted `accepted`, message **delivered** (EVT to target observed).
- **Repro B:** `setWorkflowRole('agent-1', 'product-owner')` is permitted for an attached session; a tag-less
  `po-act` with `fromRole: 'product-owner'` → **accepted + delivered**. An attached non-human session can be
  made the PO and act as it.
Plan bar violated: T1 bar 4 — "a non-human attached agent cannot emit a **PO-level** or `[Human]` workflow
event" — the *act* (`action: 'po-act'`) is PO-level regardless of tag spelling; C2/C3's substance is that
attached sessions can never carry PO authority. The existing test (line 75) only exercises the
`originTag: '[PO]'` shape, so the suite stayed green over the hole.

**Required return scope (in-fence, small):**
1. Refuse `action: 'po-act'` from the attached `send_to_agent` path **unconditionally** (PO-level acts
   originate only from the trusted human/API path — no tag or role combination reachable by an attached
   session may pass).
2. Close the `product-owner` assignment hole: `setWorkflowRole` must refuse assigning `product-owner` to an
   attached agent (or the guard must make the role inert on this path) — pick one, state it in the ledger.
3. Add both negative tests (repro A and B shapes) to `m17-gate-channel.test.ts`.

**Not re-run this round (deliberate):** full suite / tsc / harness — pointless before the fix lands; the
full task-end sweep (all bars, 1 attempt each) runs on redelivery.

## Implementer Response: M17-T1 Round 3

Fixed Finding G3-1. Both `m17-gate-channel.test.ts` negatives are added.

- **`action: 'po-act'`:** Blocked unconditionally in `registry.ts`'s `send_to_agent` validation. Any attempt from an attached session is rejected regardless of origin tag or role.
- **`setWorkflowRole` product-owner assignment:** Chose to block the assignment directly. `setWorkflowRole` throws if attempting to assign `product-owner` to an attached non-human session (`provider !== 'api'`).
- Both Repro A and B were added to `m17-gate-channel.test.ts` as negative tests.

## Implementation Review: M17-T1 Round 3 / G3-1 Recheck (Codex, 2026-07-09)

**Verdict: VERIFIED.** The task-end G3-1 authority hole is closed and M17-T1 is again verified for Gate 2 hand-back
to Task-end Review.

**Verification run:**
- `npx vitest run packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts`
  -> **2 files / 9 tests passed**. This includes the two new G3-1 negatives.
- `npx tsc -b` -> exit 0.
- Rebuilt direct Repro A probe: tag-less `workflowEvent.action: "po-act"` from an attached `scrum-master` session
  -> **rejected** with `Unauthorized: PO-level workflow events can only originate from trusted human/API paths`;
  `workflow_gate_attempt` emitted `result: "refused"` and no delivery occurred.
- Rebuilt direct Repro B probe: `setWorkflowRole("agent-1", "product-owner")` for an MCP attached agent ->
  **rejected** with `Cannot assign product-owner role to an attached non-human agent`.
- `npm test` -> **50 files / 289 tests passed**.
- `npm run backlog:check` -> backlog structure OK, **19 items, 0 warnings**.
- `git diff --check && git diff --cached --check` -> exit 0.
- Out-of-fence checks: zero `team-coordinator.ts` diff, zero `packages/contracts/wire-contract.json` diff, and no
  diff in `/Users/fausto/Software/agentalk-mcp-client`.
- Pollution check: `git worktree list` shows only `/Users/fausto/Software/AgentTalk`; `git branch --list 'task-*'`
  shows only the active `task-M17-T1` branch.

**Disposition of G3-1:** verified fixed. `po-act` is blocked by act type, not only by origin tag spelling, and
attached non-human sessions cannot be assigned `product-owner`.
