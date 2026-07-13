import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '../registry.js';
import type { WorkflowBatonMetadata, WorkflowGateEvent } from '@agenttalk/contracts/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('M20 pending relay lifecycle', () => {
  let registry: Registry;
  let testStorePath: string;

  beforeEach(() => {
    testStorePath = path.join(__dirname, 'test-m20-pending-relay-store.json');
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    registry = new Registry({ conversationStorePath: testStorePath });
    vi.spyOn(registry as any, 'requestHealthCheck').mockResolvedValue({ agentId: 'any', message: 'ok' });
  });

  afterEach(async () => {
    await registry.destroy();
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    vi.clearAllMocks();
  });

  async function createReadyAgent(id: string) {
    const agent = await registry.createAgent(id, { provider: 'api' });
    agent.setStatus('starting');
    agent.setStatus('ready');
    return agent;
  }

  it('defaults approval mode off and preserves ordinary send_to_agent delivery', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    const relayEvents: unknown[] = [];
    registry.on('pending_relay_updated', (event) => relayEvents.push(event));

    expect(registry.getRelayApprovalMode()).toBe('off');
    await expect(registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Just a normal message',
    })).resolves.toEqual({ content: [{ type: 'text', text: 'Message sent successfully' }] });

    expect(registry.listPendingRelays()).toEqual([]);
    expect(relayEvents).toEqual([]);
    await expect(target.awaitTurn()).resolves.toMatchObject({
      type: 'message_received',
      from: source.id,
      payload: 'Just a normal message',
    });
  });

  it('preserves baton transcript-on-send when approval mode is off', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    const conversation = await registry.startConversation([source.id, target.id], 'Test Baton Topic', 100);
    const baton: WorkflowBatonMetadata = {
      kind: 'workflow_baton',
      originTag: '[PO]',
      fromRole: 'planner',
      toRole: 'implementer',
      batonId: 'baton-mode-off',
    };

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Hello with baton',
      baton,
    });

    const latest = registry.getConversations().find((item) => item.id === conversation.id)!;
    const last = latest.transcript[latest.transcript.length - 1]!;
    expect(last.payload).toBe('Hello with baton');
    expect(last.baton).toEqual(baton);
  });

  it('holds mode-on send_to_agent as pending without target delivery before approval', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');
    let delivered = false;
    const waitingTurn = target.awaitTurn().then((turn) => {
      delivered = true;
      return turn;
    });

    const result = await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Needs approval',
    });

    expect(result.content[0].text).toMatch(/^Message pending PO approval \(pending-relay-/);
    await delay(20);
    expect(delivered).toBe(false);

    const relay = registry.listPendingRelays()[0]!;
    expect(relay).toMatchObject({
      status: 'pending',
      fromAgentId: source.id,
      toAgentId: target.id,
      payload: 'Needs approval',
    });

    await registry.approvePendingRelay(relay.id);
    await expect(waitingTurn).resolves.toMatchObject({
      type: 'message_received',
      from: source.id,
      payload: 'Needs approval',
    });
  });

  it('delivers an approved relay through the existing queue for the next await_turn', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Queued until next turn',
    });
    const relay = registry.listPendingRelays()[0]!;

    const approved = await registry.approvePendingRelay(relay.id);
    expect(approved.status).toBe('approved_delivered');
    await expect(target.awaitTurn()).resolves.toMatchObject({
      type: 'message_received',
      from: source.id,
      payload: 'Queued until next turn',
    });
  });

  it('records denied relays without delivering to the target', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Denied message',
    });
    const relay = registry.listPendingRelays()[0]!;

    const denied = registry.denyPendingRelay(relay.id);
    expect(denied.status).toBe('denied');

    const outcome = await Promise.race([
      target.awaitTurn().then(() => 'delivered'),
      delay(20).then(() => 'not-delivered'),
    ]);
    expect(outcome).toBe('not-delivered');
  });

  it('stops the active conversation when a conversation relay is denied', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');
    const conversation = await registry.startConversation([source.id, target.id], 'Stop Test Topic', 100);

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Stop here',
    });
    const relay = registry.listPendingRelays()[0]!;

    const denied = registry.denyPendingRelay(relay.id);
    expect(denied.status).toBe('denied');

    const latest = registry.getConversations().find((item) => item.id === conversation.id)!;
    expect(latest.status).toBe('completed');
    expect(latest.transcript.at(-1)).toMatchObject({
      kind: 'system',
      from: 'system',
      payload: `Conversation stopped by operator before delivering ${source.id}'s proposed turn to ${target.id}.`,
    });
  });

  it('leaves user-directed messages outside the approval lifecycle', async () => {
    const source = await createReadyAgent('agent-1');
    registry.setRelayApprovalMode('approve_each');
    const userMessages: any[] = [];
    const relayEvents: unknown[] = [];
    registry.on('user_message', (event) => userMessages.push(event));
    registry.on('pending_relay_updated', (event) => relayEvents.push(event));

    await expect(registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: 'user',
      payload: 'Direct PO update',
    })).resolves.toEqual({ content: [{ type: 'text', text: 'Message sent to user successfully' }] });

    expect(userMessages).toEqual([{ from: source.id, payload: 'Direct PO update' }]);
    expect(registry.listPendingRelays()).toEqual([]);
    expect(relayEvents).toEqual([]);
  });

  it('records delivery_failed when approval can no longer deliver legally', async () => {
    const source = await createReadyAgent('agent-1');
    const target = await createReadyAgent('agent-2');
    registry.setRelayApprovalMode('approve_each');

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Will fail',
    });
    const relay = registry.listPendingRelays()[0]!;
    target.setStatus('terminated');

    const failed = await registry.approvePendingRelay(relay.id);
    expect(failed.status).toBe('delivery_failed');
    expect(failed.deliveryError).toBe(`Target agent ${target.id} is in terminated state`);
  });

  it('keeps workflow_gate_attempt authority separate from pending relay approval', async () => {
    const source = await createReadyAgent('reviewer');
    const target = await createReadyAgent('implementer');
    registry.setRelayApprovalMode('approve_each');
    registry.setWorkflowRole(source.id, 'implementation-reviewer');
    const workflowEvents: any[] = [];
    const relayEvents: any[] = [];
    registry.on('workflow_gate_attempt', (event) => workflowEvents.push(event));
    registry.on('pending_relay_updated', (event) => relayEvents.push(event));
    const workflowEvent: WorkflowGateEvent = {
      kind: 'workflow_gate_event',
      gate: 'gate-2',
      action: 'verdict',
      fromRole: 'implementation-reviewer',
      toRole: 'implementer',
      eventId: 'm20-event-1',
    };

    await registry.handleMcpToolCall(source.id, 'send_to_agent', {
      to: target.id,
      payload: 'Looks good',
      workflowEvent,
    });

    expect(workflowEvents).toHaveLength(1);
    expect(workflowEvents[0]).toMatchObject({
      agentId: source.id,
      result: 'accepted',
      event: workflowEvent,
      payload: 'Looks good',
    });
    expect(relayEvents).toHaveLength(1);
    expect(relayEvents[0].relay).toMatchObject({
      status: 'pending',
      fromAgentId: source.id,
      toAgentId: target.id,
      workflowEvent,
    });
    expect(workflowEvents[0]).not.toHaveProperty('relay');
  });
});
