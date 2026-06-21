import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

describe('Registry CLI-exec agent lifecycle', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('creates a cli-exec agent, sends exec-RPC, and handles exec result', async () => {
    const agent = await registry.createAgent('cli-agent-1', {
      provider: 'cli-exec',
      providerName: 'gemini',
    });

    expect(agent.provider).toBe('cli-exec');
    expect(agent.providerName).toBe('gemini');

    let sendToAgentArgs: any = null;
    registry.on('mcp_tool_call', (call: any) => {
      if (call.name === 'send_to_agent') {
        sendToAgentArgs = call.args;
      }
    });

    await registry.activateAgent(agent.id);

    expect(agent.status).toBe('ready');

    // Simulate queueing a message (like what would happen from TeamCoordinator or user)
    agent.queueTurn({
      type: 'message_received',
      from: 'user',
      payload: 'Say hello'
    });

    // Simulate the harness connecting and pulling the turn
    const turnResult = await registry.handleMcpToolCall('cli-agent-1', 'await_turn', {});
    
    // The turnResult should be the exec_rpc
    const content = JSON.parse(turnResult.content[0].text);
    expect(content.type).toBe('exec_rpc');
    expect(content.prompt).toContain('Say hello');

    // Mock an incoming MCP tool call: submit_exec_result
    await registry.handleMcpToolCall('cli-agent-1', 'submit_exec_result', {
      text: 'hello from mocked cli',
      usage: { prompt_tokens: 5, completion_tokens: 3 }
    });

    // Wait for the driver to finish processing the exec result
    await new Promise(r => setTimeout(r, 50));

    // The driver should have submitted the final result as send_to_agent (graceful degrade)
    expect(sendToAgentArgs).not.toBeNull();
    expect(sendToAgentArgs.payload).toContain('hello from mocked cli');
    
    // Make sure the driver is back to ready
    expect(agent.status).toBe('ready');
  });
});
