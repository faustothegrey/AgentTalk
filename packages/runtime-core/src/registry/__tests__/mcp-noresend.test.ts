import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { InProcessAgentDriver } from '../../agents/in-process-driver.js';

describe('MCP-exec no-resend and recovery fallback', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('T3b-1.5: sends only the latest turn across multiple turns (no resend)', async () => {
    const agent = await registry.createAgent('mcp-agent-1', {
      provider: 'mcp',
      providerName: 'gemini',
    });
    await registry.activateAgent(agent.id);

    const pullTurn = async (payload: string) => {
      agent.queueTurn({ type: 'message_received', from: 'user', payload });
      const turnResult = await registry.handleMcpToolCall('mcp-agent-1', 'await_turn', {});
      const content = JSON.parse(turnResult.content[0].text);
      expect(content.type).toBe('exec_rpc');
      return content.prompt;
    };

    const submitResult = async (text: string) => {
      const p = new Promise(resolve => {
        const handler = (call: any) => {
          if (call.name === 'send_to_agent' && call.agentId === 'mcp-agent-1') {
            registry.off('mcp_tool_call', handler);
            resolve(null);
          }
        };
        registry.on('mcp_tool_call', handler);
      });

      await registry.handleMcpToolCall('mcp-agent-1', 'submit_exec_result', {
        text,
        usage: { prompt_tokens: 5, completion_tokens: 3 }
      });
      await p;
    };

    const p1 = await pullTurn('Fact 1: apple');
    expect(p1).toContain('Fact 1: apple');
    await submitResult('OK');

    const p2 = await pullTurn('Fact 2: bridge');
    expect(p2).toContain('Fact 2: bridge');
    expect(p2).not.toContain('apple'); // Should not resend previous turn
    await submitResult('OK');

    const p3 = await pullTurn('What are the facts?');
    expect(p3).toContain('What are the facts?');
    expect(p3).not.toContain('bridge');
    expect(p3).not.toContain('apple');
    await submitResult('apple, bridge');

    // Verify runtime still holds full history
    const driver = (registry as any).apiDrivers.get('mcp-agent-1') as InProcessAgentDriver;
    const runtime = (driver as any).runtime;
    const history = (runtime as any)._buildPromptCore({ type: 'message_received', from: 'user', payload: 'dummy' }, true);
    
    expect(history).toContain('apple');
    expect(history).toContain('bridge');
    expect(history).toContain('What are the facts?');
  });

  it('T3b-1.4: Recovery fallback resends history once on reconnect', async () => {
    const agent = await registry.createAgent('mcp-agent-1', {
      provider: 'mcp',
      providerName: 'gemini',
    });
    await registry.activateAgent(agent.id);

    const pullTurn = async (payload: string) => {
      agent.queueTurn({ type: 'message_received', from: 'user', payload });
      const turnResult = await registry.handleMcpToolCall('mcp-agent-1', 'await_turn', {});
      const content = JSON.parse(turnResult.content[0].text);
      expect(content.type).toBe('exec_rpc');
      return content.prompt;
    };

    const submitResult = async (text: string) => {
      const p = new Promise(resolve => {
        const handler = (call: any) => {
          if (call.name === 'send_to_agent' && call.agentId === 'mcp-agent-1') {
            registry.off('mcp_tool_call', handler);
            resolve(null);
          }
        };
        registry.on('mcp_tool_call', handler);
      });

      await registry.handleMcpToolCall('mcp-agent-1', 'submit_exec_result', {
        text,
        usage: { prompt_tokens: 5, completion_tokens: 3 }
      });
      await p;
    };

    const p1 = await pullTurn('Fact 1: cloud');
    expect(p1).toContain('cloud');
    await submitResult('OK');

    // Simulate harness reconnect -> markSessionStale
    agent.status = 'reconnecting';
    registry.handleMcpConnect(agent.id);

    const p2 = await pullTurn('Fact 2: dragon');
    expect(p2).toContain('dragon');
    expect(p2).toContain('cloud'); // Resent history due to stale session

    await submitResult('OK');

    const p3 = await pullTurn('What are the facts?');
    expect(p3).toContain('What are the facts?');
    expect(p3).not.toContain('dragon'); // Reverted to no-resend
    expect(p3).not.toContain('cloud');
  });
});
