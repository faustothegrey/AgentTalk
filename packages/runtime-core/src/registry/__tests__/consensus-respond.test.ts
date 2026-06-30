import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

describe('consensus_respond rejection tests', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('rejects old tool names directly', async () => {
    const agent = await registry.createAgent('test-agent', { provider: 'mcp', providerName: 'gemini', model: 'test' });
    await registry.activateAgent(agent.id);

    // Any call to old tools should throw an error since they don't exist in the switch-case in registry.ts
    await expect(registry.handleMcpToolCall(agent.id, 'submit_plan', { plan: 'plan' }))
      .rejects.toThrow('Unknown MCP tool call: submit_plan');
  });

  it('soft-rejects illegal actions inside consensus_respond', async () => {
    const agent = await registry.createAgent('test-agent', { provider: 'mcp', providerName: 'gemini', model: 'test' });
    await registry.activateAgent(agent.id);

    const result = await registry.handleMcpToolCall(agent.id, 'consensus_respond', {
      action: 'illegal_action',
      payload: {}
    });
    
    // According to softProtocolReject, it returns isError: true but without throwing an exception
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Protocol violation');
    expect(result.content[0].text).toContain('Illegal action: illegal_action');
  });
});
