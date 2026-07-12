import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '../registry.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((filePath: string) => {
      if (typeof filePath === 'string' && filePath.endsWith('.json')) {
        return actual.existsSync(filePath);
      }
      return false;
    }),
  };
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = fn();
    if (value !== undefined) return value;
    await delay(5);
  }
  throw new Error('Timed out waiting for condition');
}

describe('BL-032 attach pair-chat healthcheck delivery', () => {
  let registry: Registry;
  let testStorePath: string;

  beforeEach(() => {
    testStorePath = path.join(__dirname, 'test-bl032-conversations.json');
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    registry = new Registry({ conversationStorePath: testStorePath, healthcheckTimeoutMs: 25 });
  });

  afterEach(async () => {
    await registry.destroy();
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    vi.clearAllMocks();
  });

  async function createReadyMcpAgent(id: string) {
    const agent = await registry.createAgent(id, { provider: 'mcp', providerName: 'codex' });
    await registry.activateAgent(agent.id);
    return agent;
  }

  async function pullExecTurn(agentId: string): Promise<Record<string, any>> {
    const result = await registry.handleMcpToolCall(agentId, 'await_turn', {});
    return JSON.parse(result.content[0].text);
  }

  async function pullExecTurnWithin(agentId: string, timeoutMs = 100): Promise<Record<string, any>> {
    return Promise.race([
      pullExecTurn(agentId),
      delay(timeoutMs).then(() => {
        throw new Error(`Timed out waiting for exec turn for ${agentId}`);
      }),
    ]);
  }

  async function submitHealthcheckAck(agentId: string, text = 'ok'): Promise<void> {
    await registry.handleMcpToolCall(agentId, 'submit_exec_result', {
      text: JSON.stringify({
        message_type: 'healthcheck_ack',
        message_payload: { text },
      }),
    });
  }

  it('recovers the provider-attached startup bridge after one agent misses a healthcheck exec result', async () => {
    const source = await createReadyMcpAgent('source');
    const target = await createReadyMcpAgent('target');

    const firstStart = registry.startConversation([source.id, target.id], 'BL-032 startup', 2);
    const [sourceHealthcheck, targetHealthcheck] = await Promise.all([
      pullExecTurn(source.id),
      pullExecTurn(target.id),
    ]);

    expect(sourceHealthcheck).toMatchObject({ type: 'exec_rpc', timeoutMs: 25 });
    expect(targetHealthcheck).toMatchObject({ type: 'exec_rpc', timeoutMs: 25 });
    expect(sourceHealthcheck.prompt).toContain('healthcheck_ack');
    expect(targetHealthcheck.prompt).toContain('healthcheck_ack');

    await submitHealthcheckAck(source.id, 'source responsive');
    await expect(firstStart).rejects.toThrow('Agent target did not respond to healthcheck within 25ms');

    await waitFor(() => target.status === 'ready' ? target.status : undefined);

    const secondStart = registry.startConversation([source.id, target.id], 'BL-032 retry', 2);
    const [secondSourceHealthcheck, secondTargetHealthcheck] = await Promise.all([
      pullExecTurnWithin(source.id),
      pullExecTurnWithin(target.id),
    ]);

    expect(secondSourceHealthcheck).toMatchObject({ type: 'exec_rpc', timeoutMs: 25 });
    expect(secondTargetHealthcheck).toMatchObject({ type: 'exec_rpc', timeoutMs: 25 });

    await submitHealthcheckAck(source.id, 'source still responsive');
    await submitHealthcheckAck(target.id, 'target recovered');

    await expect(secondStart).resolves.toMatchObject({
      status: 'active',
      agentIds: [source.id, target.id],
      topic: 'BL-032 retry',
    });
  });

  it('preserves approved M20 relay delivery through the provider-attached event-to-exec bridge', async () => {
    const source = await createReadyMcpAgent('relay-source');
    const target = await createReadyMcpAgent('relay-target');
    registry.setRelayApprovalMode('approve_each');

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Approved relay payload',
    });
    const relay = registry.listPendingRelays()[0]!;

    const approved = await registry.approvePendingRelay(relay.id);
    expect(approved.status).toBe('approved_delivered');

    const targetExec = await pullExecTurnWithin(target.id);
    expect(targetExec.type).toBe('exec_rpc');
    expect(targetExec.prompt).toContain('Approved relay payload');

    await registry.handleMcpToolCall(target.id, 'submit_exec_result', {
      text: 'Relay reply processed',
    });
  });
});
