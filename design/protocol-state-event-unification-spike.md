# Spike - Protocol state event unification

**Status:** Reviewer APPROVED - spike complete (Codex, 2026-06-29).
**Author:** Codex (planner-reviewer), 2026-06-29.
**Type:** exploratory spike, no production-code implementation in this plan.
**Related:** `design/backlog.md` item "Unify protocol state-change event emission";
`design/milestone10-diagramtalk-overlay-plan.md`; `design/milestone10-implementation.md` Bridge v3;
`design/logbook.md` LB-22/LB-26.

---

## 1. Why

After the DiagramTalk bridge v3 work, AgentTalk has two protocol-state notification shapes:

- `onPhaseChange`, emitted through `setPlanningPhase`, for forward planning-phase transitions. This path also
  updates the phase truth used by `getPlanningPhase` and validation.
- `onProtocolEvent`, emitted through `emitProtocolEvent`, for off-forward-spine events such as `endorsed`,
  `correction`, and `eject`. This path was deliberately kept observational and outside consensus validation.

Both mechanisms describe "the protocol changed state" to observers, but they do not have the same safety boundary.
The spike decides whether this is harmless duplication, useful separation, or debt worth paying down.

## 2. Goal

Produce a grounded recommendation for whether and how to unify `onPhaseChange` and `onProtocolEvent`.

The recommendation must be based on the current code, tests, and design history, not on intuition. It should leave
Fausto with a clear go/no-go choice for a later implementation task.

## 3. Non-goals

- Do not change production code.
- Do not change consensus validation, `getPlanningPhase`, `setPlanningPhase`, `validateProtocolStep`, ejection logic,
  or DiagramTalk bridge behavior.
- Do not collapse observational events into phase truth unless the spike explicitly proves why that is safe and
  recommends it as a future task.
- Do not update tests to encode a new behavior. Test edits belong to a later implementation task, if approved.
- Do not open a milestone/epic for this debt during the spike. This is an exploratory backlog spike.

## 4. Scope

The implementer may inspect:

- `packages/runtime-core/src/registry/team-coordinator.ts`
- `packages/runtime-core/src/registry/registry.ts`
- `packages/runtime-core/src/registry/__tests__/planning-phase-hook.test.ts`
- `packages/runtime-core/src/registry/__tests__/protocol-event-hook.test.ts`
- `apps/orchestrator/src/diagramtalk-bridge.ts`
- `apps/orchestrator/src/__tests__/diagramtalk-bridge.test.ts`
- Related design records: `design/milestone10-diagramtalk-overlay-plan.md`,
  `design/milestone10-implementation.md`, `design/logbook.md`, and the backlog item.

The implementer may edit only this spike document to record findings, options, and a recommendation.

If the investigation reveals an urgent bug or a behavior-changing opportunity, stop and report it as a finding.
Do not fix it inside this spike.

## 5. Questions To Answer

1. **What emits `onPhaseChange` today, and what state/control-flow responsibilities are coupled to that emission path?**
   It is emitted by `TeamCoordinator.setPlanningPhase()`. This path is tightly coupled to phase truth: it writes to the `this.planningPhases` map, which dictates what protocol steps are legal via `getPlanningPhase()` and `validateProtocolStep()`.
2. **What emits `onProtocolEvent` today, and which guarantees depend on it staying observational?**
   It is emitted by `TeamCoordinator.emitProtocolEvent()` for events like `endorsed`, `correction`, and `eject`. It guarantees zero interference with the consensus validation because it is entirely decoupled from state-mutating functions.
3. **Who consumes the registry-level events `team_planning_phase` and `team_protocol_event`?**
   Currently, the only consumer is the `DiagramTalkBridge` in `apps/orchestrator/src/diagramtalk-bridge.ts` (lines 393 and 396), which translates them into visual `tag` movements and `highlight` pulses.
4. **Are the two mechanisms actually duplicative, or do they encode two different semantic classes?**
   They are not duplicative. They encode two strictly different semantic classes: *phase truth/validation state* (which dictates engine control-flow) and *observation-only telemetry* (which records off-spine moments without altering validation).
5. **What would a unified observer-facing shape look like without merging validation state and observation-only events?**
   It would look like a common envelope (e.g., `ProtocolEvent`) at the `Registry` output level, using a discriminated union (`kind: 'phase_change' | 'endorsed' | 'correction' | 'eject'`), while `TeamCoordinator` internally retains separate hooks (`onPhaseChange` and `onProtocolEvent`) to preserve the safety boundary.
6. **What implementation risks would each unification option introduce?**
   (See Section 7 for the detailed risk table). Option D carries the severe risk of accidentally conflating state-writing with telemetry, while Options B and C introduce moderate abstraction overhead for little immediate gain.
7. **Is the current split preferable until a third emission site appears or drift becomes concrete?**
   Yes. The current split perfectly protects the engine's validation logic from observational side-effects. The "cost" is just two event listeners in the bridge instead of one.

## 6. Options To Evaluate

The spike should evaluate at least these options:

### Option A - Keep Separate

Leave `onPhaseChange` and `onProtocolEvent` as two mechanisms. Document the semantic distinction more clearly if
needed.

Expected benefit: lowest risk; preserves the current safety boundary.
Expected cost: the mild inconsistency remains.

### Option B - Common Observer Envelope Only

Keep phase truth and protocol-event emission separate internally, but normalize what the registry exposes to
observers. For example, both paths could be represented as a common observer event shape while still preserving
separate internal hooks.

Expected benefit: reduces observer/API drift without touching validation.
Expected cost: may add an adapter layer that is not yet justified.

### Option C - Shared Emit Helper, Separate Semantics

Introduce a shared helper/type for best-effort observer notification, but keep `setPlanningPhase` as the only writer
of phase truth and keep off-spine events observational.

Expected benefit: removes duplicated try/catch/swallow and typing shape drift.
Expected cost: small abstraction may obscure the intentional boundary if named poorly.

### Option D - Single Protocol Event Bus

Model both phase transitions and off-spine events as variants of one protocol event bus.

Expected benefit: clearest observer model if designed well.
Expected cost: highest risk; easy to accidentally imply that off-spine events participate in validation or phase
truth. This option likely needs a dedicated implementation plan if recommended.

## 7. Expected Output

**Inventory:**
- `onPhaseChange`: 
  - **Emitter**: `TeamCoordinator.setPlanningPhase` (`packages/runtime-core/src/registry/team-coordinator.ts:906`).
  - **Consumer**: `DiagramTalkBridge.onPhase` (`apps/orchestrator/src/diagramtalk-bridge.ts:393`) via `team_planning_phase`.
- `onProtocolEvent`:
  - **Emitter**: `TeamCoordinator.emitProtocolEvent` (`packages/runtime-core/src/registry/team-coordinator.ts:922`).
  - **Consumer**: `DiagramTalkBridge.onProtocolEvent` (`apps/orchestrator/src/diagramtalk-bridge.ts:396`) via `team_protocol_event`.

**Semantic Classification:**
- **Phase truth / validation-relevant:** `onPhaseChange` (updates `this.planningPhases` dictating control flow).
- **Observation-only:** `onProtocolEvent` (pure telemetry for endorsements, retries, and ejections).
- **Bridge-only or UI-facing:** Both events are currently consumed strictly by `DiagramTalkBridge` for visual overlay and don't feed back into agent logic.

**Risk Table:**
| Option | Risk Level | Implementation Impact & Risks |
|--------|------------|-------------------------------|
| **A (Keep Separate)** | Lowest | Preserves the strict safety boundary. Cost is minimal API duplication for observers. |
| **B (Common Envelope)** | Low-Medium | Requires refactoring `Registry` to merge streams. Internal engine safety is preserved, but adds adapter boilerplate. |
| **C (Shared Emit Helper)** | Medium | Refactors internal engine emission. Naming confusion could blur the lines between state-writing and telemetry. |
| **D (Single Bus)** | High | Merges phase truth writes and off-spine events into one bus. Severe risk of breaking validation state or coupling observations to consensus engine logic. |

**Recommendation:**
- **Defer until a concrete trigger (Option A).** The current separation models the strict architectural difference between modifying consensus state and emitting telemetry. Consolidating them currently introduces unnecessary risk to the validation engine for purely aesthetic API gains.

**Follow-up Reopen Trigger:**
- Reopen this when a new feature requires both phase changes and observational events to be perfectly ordered on a single external stream (e.g., an event-sourced log), or when a third distinct class of protocol events is introduced.

## 8. Definition Of Done

The spike is complete when all rows below can be claimed by the implementer and later verified by the reviewer.

| DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| Current `onPhaseChange` emitters, state effects, and consumers are inventoried with file/line references. | [x] Claimed | VERIFIED | `team-coordinator.ts:906-910` writes `planningPhases` then calls `onPhaseChange`; `registry.ts:124` re-emits `team_planning_phase`; `diagramtalk-bridge.ts:392-393` consumes it. |
| Current `onProtocolEvent` emitters, safety boundary, and consumers are inventoried with file/line references. | [x] Claimed | VERIFIED | `team-coordinator.ts:922-930` calls `onProtocolEvent` without state mutation; current real emit sites are `:686`, `:1653`, `:1941`; `registry.ts:125` re-emits `team_protocol_event`; `diagramtalk-bridge.ts:395-396` consumes it. |
| The document distinguishes validation/phase-truth events from observation-only events. | [x] Claimed | VERIFIED | `team-coordinator.ts:906-910` plus `planning-phase-hook.test.ts:25-56` prove phase truth is recorded; `team-coordinator.ts:47-52`, `:922-930`, and `protocol-event-hook.test.ts:26-49` prove best-effort observation-only behavior. |
| At least Options A, B, C, and D are evaluated with benefits, risks, and implementation impact. | [x] Claimed | VERIFIED | Options A-D are present in §6 and the risk table in §7 covers impact/risk for each. |
| The spike gives a clear recommendation: implement, defer, or keep separate. | [x] Claimed | VERIFIED | §7 recommends Option A: defer/keep separate until a concrete trigger. |
| If implementation is recommended, the follow-up scope and verification commands are listed; if not, the reopen trigger is listed. | [x] Claimed | VERIFIED | §7 lists the reopen trigger: single ordered external stream/event-sourced log need, or a third distinct protocol event class. |
| No production code or behavior contract is changed by the spike. | [x] Claimed | VERIFIED | `git diff --name-only` + untracked list show only `design/backlog.md`, `design/lessons/codex-lessons.md`, and this spike doc; `git diff --name-only -- ':!design/**'` returned empty. |

## 9. Suggested Verification For Reviewer

- Read the cited file/line references and confirm the inventory is accurate.
- Run `git diff --stat` and confirm the spike edited documentation only.
- If the implementer claims no production behavior changed, confirm there are no source or test edits outside this
  document unless Fausto explicitly approved expanding the scope.
