import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '../registry.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HERMETICITY: same mocks as other tests to prevent real fs/network
vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

describe('Baton metadata (M16-T1)', () => {
  let registry: Registry;
  let testStorePath: string;

  beforeEach(() => {
    testStorePath = path.join(__dirname, 'test-baton-store.json');
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

    registry = new Registry({ conversationStorePath: testStorePath });

    // Mock requestHealthCheck so startConversation doesn't block waiting for agents
    vi.spyOn(registry as any, 'requestHealthCheck').mockResolvedValue({ agentId: 'any', message: 'ok' });
  });

  afterEach(async () => {
    const agents = registry.getAgents();
    for (const a of agents) {
      await registry.removeAgent(a.id);
    }
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    vi.clearAllMocks();
  });

  it('persists optional baton metadata in the conversation transcript via send_to_agent', async () => {
    const agent1 = await registry.createAgent('agent-1', { provider: 'mcp' });
    const agent2 = await registry.createAgent('agent-2', { provider: 'mcp' });

    // Force status to bypass lifecycle
    agent1.setStatus('starting');
    agent1.setStatus('ready');
    agent2.setStatus('starting');
    agent2.setStatus('ready');

    // Start an active pair conversation with high reply limit
    const conversation = await registry.startConversation(['agent-1', 'agent-2'], 'Test Baton Topic', 100);
    expect(conversation.status).toBe('active');

    // Send a normal non-baton message
    await registry.handleMcpToolCall('agent-1', 'send_to_agent', {
      to: 'agent-2',
      payload: 'Hello without baton',
    });

    // Verify ordinary message was recorded without baton
    let latestTranscript = registry.getConversations()[0]!.transcript;
    let lastMsg = latestTranscript[latestTranscript.length - 1]!;
    expect(lastMsg.payload).toBe('Hello without baton');
    expect(lastMsg).not.toHaveProperty('baton');

    // Send a message with baton metadata
    const batonMeta = {
      kind: 'workflow_baton',
      originTag: '[PO]',
      fromRole: 'planner',
      toRole: 'worker',
      batonId: 'baton-123'
    };

    await registry.handleMcpToolCall('agent-2', 'send_to_agent', {
      to: 'agent-1',
      payload: 'Hello with baton',
      baton: batonMeta,
    });

    // Verify baton was recorded in transcript
    latestTranscript = registry.getConversations()[0]!.transcript;
    lastMsg = latestTranscript[latestTranscript.length - 1]!;
    expect(lastMsg.payload).toBe('Hello with baton');
    expect(lastMsg.baton).toEqual(batonMeta);
  });
});
