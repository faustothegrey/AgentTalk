import type { McpToolDefinition } from '@agenttalk/mcp-transport';

/**
 * The exec SUBSET of the wire-contract — the only two tools a chat executor needs:
 * `await_turn` (the client long-polls for its next turn) and `submit_exec_result` (it returns the
 * output). NO consensus tools (`submit_plan`/`send_to_agent`/…). A full agentalk-mcp-client still
 * works against this server because the exec subset is a strict subset of what it speaks.
 */
export const EXEC_TOOLS: McpToolDefinition[] = [
  {
    name: 'await_turn',
    description: 'Block and wait until a new message/turn is assigned to this agent.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'submit_exec_result',
    description: 'Submit raw execution output from the model (for exec-RPC).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The raw text response from the model.' },
        usage: { type: 'object', description: 'Optional usage statistics.' },
      },
      required: ['text'],
    },
  },
];
