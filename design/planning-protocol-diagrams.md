# Planning / Consensus Protocol — Visual Flow

**Status:** Reference (Claude, 2026-06-20). Grounded in `design/planning-protocol.md` +
`TeamCoordinator` + `mcp-tools.ts`. Diagrams are **PlantUML** in fenced ` ```plantuml ` blocks
— view in a Markdown reader with PlantUML support (e.g. VS Code "Markdown Preview Enhanced",
Obsidian + PlantUML plugin) or paste a block into any PlantUML renderer.

> Three views: **(1)** the end-to-end consensus sequence, **(2)** the protocol state machine
> (the rules), **(3)** how a single consensus step rides the attach turn-loop (the Phase-6
> integration point).

---

## 1. End-to-end consensus sequence (2 planners → plan → worker)

Two attached planners run the protocol; the orchestrator (`TeamCoordinator`) is the referee.
The proposer submits the plan; the peer only endorses (`planning-protocol.md` §submittal).

![Planning consensus sequence](./diagrams/planning-consensus-sequence.svg)

```plantuml
@startuml planning-consensus-sequence
title Planning Consensus — happy path (2 planners + worker)
autonumber
skinparam shadowing false
skinparam sequenceMessageAlign center

actor "User / UI" as U
participant "Orchestrator\n(TeamCoordinator)" as O
participant "Planner A" as A
participant "Planner B" as B
participant "Worker" as W

U -> O : create team task (planners: A, B)

== Phase 0 — acknowledgement ==
O -> A : EVT ack_planning_protocol (briefing)
O -> B : EVT ack_planning_protocol (briefing)
A -> O : ack_planning_protocol
B -> O : ack_planning_protocol

== Phase 0.5 — fact collection ==
O -> A : EVT fact_collection_begin {taskId, description, peerIds}
O -> B : EVT fact_collection_begin
A -> O : fact_collection_end {summary}
B -> O : fact_collection_end

== Phase 1 — discussion (rank 0) ==
O -> A : EVT conversation_start (discussion opens)
O -> B : EVT conversation_start
A -> O : send_to_agent (opinion) -> routed to B
B -> O : send_to_agent (opinion) -> routed to A
note over A, B : loop until aligned

== Phase 2 — proposal (rank 1) ==
A -> O : agreement_proposal {proposal}
O -> B : EVT request endorsement (expected: agreement_acceptance | opinion)

== Phase 3 — endorsement (rank 2) ==
B -> O : agreement_acceptance {proposal}

== Phase 4 — submittal (rank 3) ==
note over O : submitter = the planner who did NOT accept (A)
O -> A : EVT request submit_plan
A -> O : submit_plan {plan, text, proposal}
O -> U : planning_phase_complete {plan}

== Worker hand-off ==
U -> O : confirm plan
O -> W : EVT team_work_assign {plan, description}
W -> O : submit_work_response {accepted: true}
W -> O : submit_work_result {result}
O -> U : task complete
@enduml
```

---

## 2. Protocol state machine (the rules)

The orchestrator advances **forward-only** by `message_type` **rank**; an out-of-step type is
interrupted, a regression triggers a confirm-or-terminate. Watchdog timers guard each wait.

![Planning protocol state machine](./diagrams/planning-state-machine.svg)

```plantuml
@startuml planning-state-machine
title Planning Protocol — server-side state (TeamCoordinator)
skinparam shadowing false
hide empty description

[*] --> ACK_PENDING : team task created

ACK_PENDING --> FACT_COLLECTION : all planners ack_planning_protocol
note right of ACK_PENDING
  opinion before ack -> re-send ack, block
  watchdog: ack timeout
end note

FACT_COLLECTION --> DISCUSSION : all fact_collection_end
note right of FACT_COLLECTION
  watchdog: 480s (720s gemini)
end note

DISCUSSION --> DISCUSSION : opinion (rank 0)
DISCUSSION --> PROPOSAL : agreement_proposal (rank 1)

PROPOSAL --> ENDORSEMENT : orchestrator requests endorsement
ENDORSEMENT --> DISCUSSION : opinion (reject -> keep debating)
ENDORSEMENT --> SUBMITTAL : agreement_acceptance (rank 2)

SUBMITTAL --> COMPLETE : submit_plan (rank 3)\n(by the non-accepting planner)
COMPLETE --> [*]

state "INTERRUPTED / TERMINATED" as ERR
ACK_PENDING --> ERR : illegal type / agent error / watchdog expiry
FACT_COLLECTION --> ERR
DISCUSSION --> ERR
PROPOSAL --> ERR
ENDORSEMENT --> ERR : confirmed regression
SUBMITTAL --> ERR
ERR --> [*]
@enduml
```

**Rank rule:** `opinion`(0) → `agreement_proposal`(1) → `agreement_acceptance`(2) →
`submit_plan`(3). The orchestrator only accepts a type whose rank advances the current step;
the **client never decides validity** — it just emits the tool for the model's `message_type`
(§13). Enforcement, regression handling and watchdogs are all server-side.

---

## 3. One consensus step over the attach turn-loop (Phase-6 integration point)

This is the pull loop. **Today** the attach worker always emits `send_to_agent`; **Phase 6
(P6-A)** is the single highlighted step: emit the MCP tool that matches the model's
`message_type`. Everything else already exists.

![Attach turn-loop consensus mapping](./diagrams/attach-consensus-turn.svg)

```plantuml
@startuml attach-consensus-turn
title Attach turn-loop — mapping a structured action (P6-A)
autonumber
skinparam shadowing false

participant "Attach Worker\n(harness + CLI)" as H
participant "MCP Server" as M
participant "TeamCoordinator" as T

H -> M : await_turn()  (blocks)
T -> M : enqueue turn (briefing + expected_response_types)
M --> H : turn { message, turnId, expected_response_types }

H -> H : run provider CLI ->\nstructured { message_type, payload }

group P6-A : map message_type -> matching MCP tool  <<NEW>>
  alt message_type = agreement_proposal
    H -> M : agreement_proposal { proposal }
  else agreement_acceptance
    H -> M : agreement_acceptance { proposal }
  else submit_plan
    H -> M : submit_plan { plan }
  else fact_collection_end / ack_planning_protocol / opinion(send_to_agent)
    H -> M : <matching tool>
  end
end

M -> T : route action (turnId)
T -> T : validate vs expected_response_types,\nadvance state / interrupt
T --> M : ack
M --> H : success
H -> M : await_turn()  (loop)

note over T
  Protocol determinism is server-side (§13).
  Client only translates message_type -> tool.
end note
@enduml
```

---

## Rendering notes
- Each diagram is committed as a rendered **SVG** in `./diagrams/` (shown inline above) **and**
  kept as editable PlantUML source in the fenced block — so it displays in any Markdown viewer,
  while PlantUML-aware viewers can also render the source.
- `plantuml` is installed (Homebrew). To re-render after an edit:
  `plantuml -tsvg -o diagrams design/planning-protocol-diagrams.md` (extracts every
  `@startuml`/`@enduml` block, names each SVG after its diagram id).
- Kept deliberately close to `design/planning-protocol.md` (the prose source of truth); if the
  protocol changes, update the source block **and** re-render.
