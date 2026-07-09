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
