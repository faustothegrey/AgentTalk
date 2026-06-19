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
      },
      required: ['to', 'payload'],
    },
  },
  {
    name: 'agreement_proposal',
    description: 'Propose a consensus agreement direction to peer agents.',
    inputSchema: {
      type: 'object',
      properties: {
        proposal: {
          type: 'string',
          description: 'The proposed consensus text statement.',
        },
        expected_response_types: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
  {
    name: 'agreement_acceptance',
    description: 'Accept a consensus proposal submitted by a peer.',
    inputSchema: {
      type: 'object',
      properties: {
        proposal: {
          type: 'string',
          description: 'The accepted consensus text statement.',
        },
        expected_response_types: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
  {
    name: 'ack_planning_protocol',
    description: 'Acknowledge planning phase transitions and readiness.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fact_collection_end',
    description: 'Submit gathered codebase facts to end the fact collection phase.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A detailed summary of files, symbols, and details collected.',
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'submit_plan',
    description: 'Submit a finished planning strategy to the team worker.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          description: 'The complete, detailed step-by-step implementation plan.',
        },
        proposal: {
          type: 'string',
          description: 'The agreement direction this plan fulfills.',
        },
        text: {
          type: 'string',
          description: 'Brief accompanying context.',
        },
      },
      required: ['plan'],
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
    name: 'await_turn',
    description: 'Block and wait until a new message/turn is assigned to this agent.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
