# Resolution of Turn-Loop & Feedback Loop Semantics (R1/R2)

**Status:** Resolved (2026-06-18)  
**Author:** Antigravity (with Fausto)  
**Related:** `design/mcp-implementation-plan.md`, `design/mcp-implementation-caveats.md`

This document details the resolution of the **R1 (Turn-termination mechanics)** and **R2 (Plan-rejection feedback loop)** design gates as required by Phase 3 of the MCP transport migration plan.

---

## 1. Turn-Termination Mechanics (R1)

### Decision
An orchestration tool call (such as `send_to_agent`, `submit_plan`, or `agreement_proposal`) acts as the **terminal action** of the agent's turn. 

### Behavior
1. **Immediate Success Return:** The MCP server tool handler immediately returns a success string to the calling client (e.g. `{"content": [{"type": "text", "text": "Action sent successfully"}]}`).
2. **No Further Orchestration:** The model may continue writing prose or completing its output stream, but any subsequent orchestration tool calls in the same execution turn will be rejected with an error.
3. **Turn Completion:** Once the model completes generation, the CLI process (or executor session) transitions back to `ready` (or exits, if in one-shot mode), which resolves the `executeTurn` promise inside the wrapper.
4. **No Arbitrary Interruption:** Because the orchestrator does not interrupt the model in the middle of a generation, the turn boundary is defined cleanly at the point when the model finishes its output block.

---

## 2. Plan-Rejection Feedback Loop (R2)

### Decision
Plan rejection feedback is re-injected as a **new turn** using standard async protocol events, rather than attempting to return rejection errors inside the tool result of a blocked `submit_plan` call.

### Rationale
- Rejection of a plan is an asynchronous event. It may involve waiting for a peer agent to reject the plan (`submit_work_response` returning `accepted: false`) or waiting for a human user to reject the plan via the Web UI.
- Trying to block the `submit_plan` tool call until validation/rejection is complete is prone to client-side tool timeouts (e.g., Codex's 120s timeout) and holds the connection hostage.
- Moving to an asynchronous new-turn model keeps MCP tool calls fast, non-blocking, and simple.

### Control Flow
1. **Plan Submission:** The planner calls the `submit_plan` tool. The MCP server records the plan and immediately responds with a success status. The planner's turn ends.
2. **Asynchronous Verification/Rejection:** The orchestrator runs validations (or prompts the user/worker).
3. **New Turn Trigger:** If the plan is rejected, `TeamCoordinator` calls `rejectPlan()`. This updates the task status back to `planning`, clears the submitted plan, and sends a new turn message via the protocol:
   ```json
   [AgentTalk]:EVT:{"type":"message_received","from":"user","payload":"Your plan was rejected. Feedback: <feedback>\n\nPlease revise your plan and submit it again using submit_plan."}
   ```
4. **Queue Processing:** The planner wrapper (`llm-agent.mjs`) receives this inbound `EVT`, enqueues it, and spawns/triggers a brand-new turn prompt to the model.
5. **Turn-Loop Compatibility:** This is fully unified with the legacy stdout protocol path, ensuring zero behavioral differences for the consensus state machines under both execution flags.
