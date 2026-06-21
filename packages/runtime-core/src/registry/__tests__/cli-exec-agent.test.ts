import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

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
    
    expect(agent.status).toBe('ready');
  });

  it('handles team_work_assign by sending exec-RPC with cwd and parsing result to submit_work_result', async () => {
    const agent = await registry.createAgent('cli-worker-1', {
      provider: 'cli-exec',
      providerName: 'gemini',
    });
    
    await registry.activateAgent(agent.id);

    // Track MCP calls sent to orchestrator
    const mcpCalls: Array<{name: string, args: any}> = [];
    registry.on('mcp_tool_call', (call: any) => {
      mcpCalls.push({ name: call.name, args: call.args });
    });

    // Mock TeamCoordinator to prevent crash when it tries to find the agent's team
    vi.spyOn((registry as any).teamCoordinator, 'handleWorkResponse').mockImplementation(() => {});
    vi.spyOn((registry as any).teamCoordinator, 'handleWorkResult').mockImplementation(() => {});

    // Simulate team_work_assign
    agent.queueTurn({
      type: 'team_work_assign',
      teamId: 'team-1',
      taskId: 'task-1',
      role: 'worker',
      plan: 'My plan',
      description: 'Do work',
      cwd: '/tmp/worktree',
      timeoutMs: 600000,
    });

    // 1. Pull the exec_rpc
    const turnResult = await registry.handleMcpToolCall('cli-worker-1', 'await_turn', {});
    const content = JSON.parse(turnResult.content[0].text);
    
    expect(content.type).toBe('exec_rpc');
    expect(content.prompt).toContain('You are the WORKER');
    expect(content.prompt).toContain('My plan');
    expect(content.cwd).toBe('/tmp/agentalk-task-task-1');
    expect(content.timeoutMs).toBe(600000);

    // 2. Submit exec_result representing the worker's JSON response
    await registry.handleMcpToolCall('cli-worker-1', 'submit_exec_result', {
      text: '```json\n' + JSON.stringify({
        message_type: 'work_accept',
        message_payload: { text: 'Done work in worktree' }
      }) + '\n```',
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    });

    await new Promise(r => setTimeout(r, 50));

    // The driver should have parsed it and sent submit_work_response + submit_work_result
    console.log("MCP CALLS", mcpCalls);
    const responseCall = mcpCalls.find(c => c.name === 'submit_work_response');
    const resultCall = mcpCalls.find(c => c.name === 'submit_work_result');

    expect(responseCall).toBeDefined();
    expect(responseCall?.args.accepted).toBe(true);
    
    expect(resultCall).toBeDefined();
    expect(resultCall?.args.result).toBe('Done work in worktree');
  });
});
