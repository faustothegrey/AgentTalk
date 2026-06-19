# Planning Protocol Message Types

This document describes every structured message type in the AgentTalk planning protocol and what the orchestration layer does when each type is received, including the interaction between consecutive message types.

## Message Types

### Fact Collection Phase (after protocol acknowledgement)

| Type | Direction | Payload | Who sends it |
|---|---|---|---|
| `fact_collection_begin` | orchestrator → planner | `{ taskId, description, peerIds }` | Orchestrator (after all planners ack) |
| `fact_collection_end` | planner → orchestrator | `{ summary }` | Planner (after investigating codebase) |

### Planning Phase (planner-to-planner)

| Phase | Type | Rank | Payload | Who sends it |
|---|---|---|---|---|
| discussion | `opinion` | 0 | `{ text, proposal: null, expected_response_types }` | Planner |
| proposal | `agreement_proposal` | 1 | `{ text, proposal, expected_response_types }` | Planner |
| endorsement | `agreement_acceptance` | 2 | `{ text, proposal, expected_response_types }` | Planner (peer of proposer) |
| submittal | `submit_plan` | 3 | `{ plan, text, proposal }` | Planner (not the one who issued `agreement_acceptance`) |

### Worker Phase (after plan confirmed by user)

| Type | Rank | Payload | Who sends it |
|---|---|---|---|
| `work_accept` | — | `{ text }` | Worker |
| `work_refuse` | — | `{ reason }` | Worker |

### Utility

| Type | Rank | Payload | Who sends it |
|---|---|---|---|
| `healthcheck_ack` | — | `{ text }` | Any agent |

## Standard Protocol Flow

```
ack_planning_protocol (both planners)
        |
        v
fact_collection_begin (orchestrator → all planners)
        |
        v
  [planners investigate codebase asynchronously]
        |
        v
fact_collection_end (each planner → orchestrator)
        |
        v
  [orchestrator waits for all planners to finish]
        |
        v
conversation_start (discussion phase opens)
        |
        v
    opinion              [discussion phase]
        |
        v
 agreement_proposal      [proposal phase]
        |
        v
  agreement_acceptance   [endorsement phase]
        |
        v
    submit_plan           [submittal phase]
        |
        v
  [user confirms or rejects]
        |
   +----+----+
   v         v
work_accept  work_refuse
   |
   v
submit_work_result
```

## Orchestrator Behavior Per Message Type

### `ack_planning_protocol`

- Removes the sender from the pending-ack set.
- If all planners have acknowledged: clears the pending state and sends `fact_collection_begin` to all planners (with the task description and peer IDs). Arms a fact collection timeout (480s default; 720s for Gemini teams).
- If some planners have not yet acknowledged: waits.
- If a planner sends a `opinion` message before acknowledging: the orchestrator re-sends the ack request and blocks the message.

### `fact_collection_begin` (orchestrator → planners)

- Sent to all planners after all have acknowledged the protocol.
- Contains the task description and peer IDs so planners know the task scope.
- Planners are expected to investigate the codebase asynchronously and then send `fact_collection_end`.

### `fact_collection_end`

- Removes the sender from the pending fact-collection set.
- Records the agent's summary in the task transcript.
- If all planners have completed fact collection: clears the fact collection timer, arms the planning watchdog, and sends `conversation_start` to all planners (with `mode: 'planning'`). The first planner listed is marked as `initiator: true`.
- If some planners have not yet completed: waits.
- If the fact collection timeout fires before all planners complete: planning is interrupted.

### `opinion`

- Validates protocol step (see advancement rules below).
- Checks reply cap; drops message silently if the sender has reached `maxRepliesPerAgent`.
- Increments the sender's reply count.
- Records the message in the task transcript.
- Broadcasts the message to all other planners via `message_received` event.
- Does not emit additional orchestrator reminder messages in this path; protocol enforcement is handled by expected-set checks, regression handling, and interruptions.
- If an `agreementState` exists and the sender is the target agent: triggers agreement non-compliance handling (re-asks or interrupts planning).
- If no `agreementState` exists and the sender is 1 message away from the reply cap (`count == max - 1`): requests `agreement_proposal` from that planner.

### `agreement_proposal`

- Requires non-empty `proposal` text in payload.
- If already in `awaiting_endorsement` phase (a proposal is already in flight): same-proposal duplicates are silently absorbed as a **race condition**; a different proposal is rejected.
- Validates protocol step.
- If the orchestrator pre-armed `awaiting_proposal` for a different agent: throws error.
- Clears any existing agreement timer.
- Stores normalized pending proposal text.
- Records "Agreement proposed: <proposal>" in the transcript.
- Sends `agreement_acceptance` request to the other planner via `custom_event_request`.
- Arms a compliance timer; if the other planner does not respond with `agreement_acceptance` or sends a regular message instead, triggers non-compliance handling.
- Updates expected responses to `['agreement_acceptance', 'opinion']`.

### `agreement_acceptance`

- If no `agreementState` exists and the protocol has been **reset to discussion phase** (after a fallback-to-discussion): silently absorbs the stale event — the agent was still processing the original "please call agreement_acceptance" notification from a previous cycle.
- Requires non-empty `proposal` text in payload.
- Validates protocol step.
- Requires that an `agreementState` exists with `phase === 'awaiting_endorsement'` and the sender matches `targetAgentId`. Otherwise throws.
- Requires payload `proposal` to match the currently pending proposal (normalized exact match). Otherwise throws.
- Clears the agreement timer and state.
- Moves proposal from pending to accepted state.
- Records "Agreement reached for proposal: <proposal>" in the transcript.
- Records which agent confirmed, so that the **same agent cannot submit the plan**.
- Updates expected responses to `['submit_plan']`.
- Arms the submit-plan urgency watchdog — planners have `submitPlanUrgencyTimeoutMs` (default 120s) to call `submit_plan`.

### `submit_plan`

- Validates protocol step.
- Rejects if the sender is the same agent that issued `agreement_acceptance` — the other planner must submit.
- In multi-planner flow, requires non-empty `proposal` and `text` in payload.
- In multi-planner flow, requires payload `proposal` to match the accepted proposal (normalized exact match). Otherwise throws.
- Validates plan content (must be non-empty, must contain implementation-ready steps — checked by `assertPlanIsImplementationReady`).
- Clears all watchdogs (planning, urgency, agreement state).
- Stores the plan on the task, marks `planningComplete = true`, sets task status to `awaiting_confirmation`.
- Updates team status to `awaiting_confirmation`.
- Sends `conversation_end` to all planners with reason "Plan submitted — planning complete."
- Requests graceful shutdown for all planners (with forced removal after `agentShutdownTimeoutMs`).
- Persists the planning run to disk.
- Emits `team_planning_complete` event for the UI.

### `work_accept` (via `submit_work_response` with `accepted: true`)

- Requires task status `delegated`.
- Sets `workerAccepted = true`, task status `in_progress`, team status `working`.
- Records "Worker accepted the task." in transcript.

### `work_refuse` (via `submit_work_response` with `accepted: false`)

- Requires task status `delegated`.
- Sets `workerAccepted = false`, task status `refused`, team status `error`.
- Records refusal reason in transcript.

### `submit_work_result`

- Requires task status `in_progress`.
- Sets task status `completed`, team status `completed`.
- Clears `currentTaskId` from the team.
- Records the result in transcript.

### `healthcheck_ack` (via `ack_healthcheck`)

- Resolves the pending healthcheck promise keyed by the provided token.
- If the token is unknown: returns error response.

## Protocol Advancement and Regression Rules

The orchestrator tracks a `taskMaxAdvancement` rank per task. The rank values are:

| Phase | Type | Rank |
|---|---|---|
| discussion | `opinion` | 0 |
| proposal | `agreement_proposal` | 1 |
| endorsement | `agreement_acceptance` | 2 |
| submittal | `submit_plan` | 3 |

### Forward advancement

When a message's rank exceeds the current max, the max is updated and any pending regression retry counters are cleared.

### Regression (rank < current max)

When an agent sends a message with a rank lower than the current max:

1. **First/second attempt**: the orchestrator asks the agent to confirm the regression ("Did you really intend to go back to X?"). The message is **rejected** (not forwarded). Up to `MAX_REGRESSION_RETRIES` (2) confirmation attempts. The agent is warned that confirming will end the planning session.
2. **After exhausting retries** (agent confirmed the regression): planning is **interrupted**. All planners are notified and requested to shut down.

If the agent corrects course and advances past the contested rank before exhausting retries, the retry count is cleared.

### Violation (unexpected type, not a regression)

When an agent sends a type that is not in the expected set and is not a regression (rank >= current max), planning is **interrupted** immediately.

### Fallback-to-discussion reset

When the target agent sends a regular message instead of `agreement_acceptance`, the orchestrator falls back to the discussion phase (up to `MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS` times). On fallback:

- `taskExpectedResponses` is reset to `['opinion', 'agreement_proposal']`.
- `taskMaxAdvancement` is **cleared** so agents can re-advance through the protocol.
- Regression retry counters are cleared.
- Agreement state is deleted.

This means late-arriving events from the previous cycle (e.g. an `agreement_acceptance` REQ still in flight) are silently absorbed rather than treated as protocol violations. The orchestrator detects a stale event by checking that no agreement state exists and the protocol expects the discussion phase.

## Transition Matrix

This matrix is phase-based. Each row describes what happens when an incoming message arrives in a given current phase.

### Planning phase transitions

| Current phase | Incoming message | Sender constraint | Next phase | Orchestrator action |
|---|---|---|---|---|
| `fact_collection` | `fact_collection_end` | Any pending planner | `fact_collection` (until all complete), then `discussion` | Marks planner complete; when all planners complete, emits `conversation_start` and opens discussion. |
| `fact_collection` | `opinion` / `agreement_proposal` / `agreement_acceptance` / `submit_plan` | Any planner | unchanged | Message is blocked while fact collection is active. |
| `discussion` | `opinion` | Any planner | `discussion` | Forwards to peers; tracks reply counts; may request `agreement_proposal` near reply cap. |
| `discussion` | `agreement_proposal` | Any planner | `proposal_pending_endorsement` | Records proposer, targets the other planner for endorsement, requests `agreement_acceptance`, arms agreement-compliance timer. |
| `discussion` | `agreement_acceptance` | Any planner | unchanged | Error: no pending proposal to confirm. |
| `discussion` | `submit_plan` | Any planner | `planning_interrupted` | Unexpected type for this phase. |
| `proposal_pending_endorsement` | `agreement_acceptance` | Must be targeted endorser (not proposer); payload proposal must match pending proposal | `submittal_pending` | Confirms agreement, stores accepted proposal, clears agreement state, arms submit-plan urgency watchdog, expected becomes `['submit_plan']`. |
| `proposal_pending_endorsement` | `opinion` | If from targeted endorser, treated as non-compliance/fallback path | `discussion` (fallback) or `planning_interrupted` | Falls back to discussion up to `MAX_AGREEMENT_ENDORSEMENT_DISCUSSION_FALLBACKS`; interrupts on excess misses. |
| `proposal_pending_endorsement` | `agreement_proposal` | Any planner | unchanged | Duplicate proposal is absorbed as race/no-op while endorsement is pending. |
| `proposal_pending_endorsement` | `submit_plan` | Any planner | `planning_interrupted` | Unexpected type while endorsement is pending. |
| `submittal_pending` | `submit_plan` | Must be planner who did **not** send `agreement_acceptance`; payload proposal must match accepted proposal | `awaiting_confirmation` | Validates and stores plan; emits planning complete events; requests planner shutdown. |
| `submittal_pending` | `submit_plan` | Sender is the planner who sent `agreement_acceptance` | unchanged | Error: wrong submitter. |
| `submittal_pending` | `opinion` / `agreement_proposal` | Any planner | unchanged or `planning_interrupted` | Treated as regression (confirmation/retry path); interrupted if confirmed/repeated. |
| `submittal_pending` | `agreement_acceptance` | Any planner | `planning_interrupted` | Unexpected repeated acceptance while `submit_plan` is expected. |

### Global rules across planning phases

| Condition | Behavior |
|---|---|
| Incoming type not in expected set and not classified as regression | Planning is interrupted immediately. |
| Incoming type is a regression (lower advancement rank than task max) | Orchestrator asks for confirmation (up to retry limit), then interrupts on confirmed/repeated regression. |
| Stale `agreement_acceptance` arrives after fallback reset with no active agreement state | Silently absorbed as stale in-flight event. |
| Any planner message after plan submission (`awaiting_confirmation`) | Blocked by task-status guard (planning no longer active). |

### User confirmation phase

| Action | Orchestrator behavior |
|---|---|
| User confirms plan | Task status `delegated`, team status `working`. Worker receives `team_work_assign` with plan + description. |
| User rejects plan | Task status back to `planning`, `planningComplete = false`, plan cleared. Rejection feedback sent to planner. Watchdog re-armed. Expected responses reset. |

### Worker phase

| Previous state (A) | Incoming (B) | Orchestrator action |
|---|---|---|
| `delegated` | `work_accept` | Task status `in_progress`, team status `working`. |
| `delegated` | `work_refuse` | Task status `refused`, team status `error`. |
| `in_progress` | `submit_work_result` | Task status `completed`, team status `completed`. |
| `in_progress` | `work_accept` | **Error** — task status is not `delegated`. |
| `in_progress` | `work_refuse` | **Error** — task status is not `delegated`. |
| `delegated` | `submit_work_result` | **Error** — task status is not `in_progress`. |

## Timeout and Compliance Mechanisms

| Mechanism | Timeout | Behavior |
|---|---|---|
| Fact collection | 480s (8 min); 720s (12 min) for Gemini teams | If not all planners send `fact_collection_end` within timeout, planning is interrupted. Gemini teams use the longer timeout since Gemini agents take more time to investigate the codebase. |
| Planning watchdog | 900s (15 min) | If no `submit_plan` received within timeout, interrupts planning for missing events. |
| Submit-plan urgency | 120s | After `agreement_acceptance`, reminds planners to call `submit_plan`. Re-issued up to `MAX_URGENCY_IGNORES` (2) times, then interrupts. |
| Agreement compliance | 60s | After requesting `agreement_proposal` or `agreement_acceptance`, if the target agent does not comply, re-asks up to `MAX_AGREEMENT_ASKS` (2) times, then interrupts planning. |
| Agent shutdown | 60s | After `submit_plan` or planning interruption, planners are asked to shut down. Force-removed after timeout. |
| Readiness timeout | (configured in Registry) | If an agent does not send `READY` after spawning, marked as error. |
