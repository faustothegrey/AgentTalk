export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export const AGENTTALK_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_agents',
    description: 'Get a list of all active agents in the system.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'send_to_agent',
    description: 'Send a message or response to another agent or to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The target agent ID, or "user" to display to the human user.',
        },
        payload: {
          type: 'string',
          description: 'The content/body of the message.',
        },
        replyToMessageId: {
          type: 'string',
          description: 'Optional ID of the message being replied to.',
        },
        expected_response_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of expected response types.',
        },
        baton: {
          type: 'object',
          description: 'Optional workflow baton metadata.',
          properties: {
            kind: { type: 'string', enum: ['workflow_baton'] },
            originTag: { type: 'string', enum: ['[PO]', '[SM]'] },
            fromRole: { type: 'string' },
            toRole: { type: 'string' },
            batonId: { type: 'string' },
          },
          required: ['kind', 'originTag', 'fromRole', 'toRole', 'batonId'],
        },
        workflowEvent: {
          type: 'object',
          description: 'Optional workflow gate event metadata.',
          properties: {
            kind: { type: 'string', enum: ['workflow_gate_event'] },
            gate: { type: 'string', enum: ['gate-1', 'gate-2', 'gate-3', 'backlog-gate'] },
            action: { type: 'string', enum: ['verdict', 'go', 'no-go', 'baton', 'po-act'] },
            originTag: { type: 'string', enum: ['[Human]', '[PO]', '[SM]'] },
            fromAgentId: { type: 'string' },
            fromRole: { type: 'string' },
            toAgentId: { type: 'string' },
            toRole: { type: 'string' },
            taskId: { type: 'string' },
            eventId: { type: 'string' },
          },
          required: ['kind', 'gate', 'action', 'fromRole', 'eventId'],
        },
      },
      required: ['to', 'payload'],
    },
  },
  {
    name: 'consensus_respond',
    description: 'Submit a planning phase response.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'opinion',
            'agreement_proposal',
            'agreement_acceptance',
            'ack_planning_protocol',
            'fact_collection_end',
            'submit_plan'
          ],
          description: 'The planning action to execute.'
        },
        payload: {
          type: 'object',
          description: 'The phase-specific payload data.'
        }
      },
      required: ['action', 'payload'],
    },
  },
  {
    name: 'submit_work_response',
    description: 'Accept or refuse a plan submitted by a planner.',
    inputSchema: {
      type: 'object',
      properties: {
        accepted: {
          type: 'boolean',
          description: 'Whether the plan is accepted for execution.',
        },
        reason: {
          type: 'string',
          description: 'Reason for refusal (required if accepted is false).',
        },
      },
      required: ['accepted'],
    },
  },
  {
    name: 'submit_work_result',
    description: 'Submit the completed task result/artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: 'Verification proof, generated outputs, or completion status summary.',
        },
      },
      required: ['result'],
    },
  },
  {
    name: 'submit_usage_stats',
    description: 'Submit token usage and session telemetry details.',
    inputSchema: {
      type: 'object',
      properties: {
        stats: {
          type: 'string',
          description: 'Stringified statistics or JSON object dump.',
        },
        timestamp: {
          type: 'string',
          description: 'ISO 8601 timestamp string.',
        },
      },
      required: ['stats', 'timestamp'],
    },
  },
  {
    name: 'submit_exec_result',
    description: 'Submit raw execution output from the model (for exec-RPC).',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The raw text response from the model.',
        },
        usage: {
          type: 'object',
          description: 'Optional usage statistics.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'await_turn',
    description: 'Block and wait until a new message/turn is assigned to this agent.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'healthcheck_ack',
    description: 'Acknowledge a healthcheck event to confirm the agent is responsive.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'The healthcheck token received in the healthcheck event.',
        },
        message: {
          type: 'string',
          description: 'Optional arbitrary message payload.',
        },
      },
      required: ['token'],
    },
  },
  {
    // BL-071 P2 — the agent reports the host IT runs on (self-observed ground truth).
    // A dedicated tool so the change is wire-contract-hash-tracked (piggybacking on an
    // existing tool would change the payload without bumping the hash — silent drift).
    name: 'report_environment',
    description: "Report this agent's own host environment (OS, arch, versions) to the orchestrator.",
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'object',
          description: 'A HostEnvironment snapshot the agent observed about its own host.',
          properties: {
            platform: { type: 'string' },
            arch: { type: 'string' },
            osRelease: { type: 'string' },
            nodeVersion: { type: 'string' },
            hostname: { type: 'string' },
            cpuCount: { type: 'number' },
            totalMemBytes: { type: 'number' },
            capturedAt: { type: 'string' },
          },
          required: ['platform', 'arch', 'osRelease', 'nodeVersion', 'hostname', 'cpuCount', 'totalMemBytes', 'capturedAt'],
        },
      },
      required: ['environment'],
    },
  },
];
