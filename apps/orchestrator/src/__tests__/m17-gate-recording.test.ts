import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { startServer } from '../server.js';
import type { SessionRecorder } from '@agenttalk/observability/recordings/session-recorder';

describe('M17 Gate Event Recording', () => {
  let registry: Registry;
  let server: any;
  let mockRecorder: SessionRecorder;
  let recordedEvents: any[] = [];

  beforeEach(async () => {
    registry = new Registry();
    recordedEvents = [];
    mockRecorder = {
      record: (channel: any, event: string, payload: any) => {
        recordedEvents.push({ channel, event, payload });
      },
      close: async () => {},
    } as any;

    server = startServer(registry, 0, { recorder: mockRecorder });

    await registry.createAgent('agent-1', { provider: 'mcp' });
    await registry.createAgent('agent-2', { provider: 'mcp' });
    await registry.activateAgent('agent-1');
    await registry.activateAgent('agent-2');
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    await registry.destroy();
  });

  it('records an accepted workflow gate attempt with the correct NDJSON shape', async () => {
    registry.setWorkflowRole('agent-1', 'implementation-reviewer');
    const workflowEvent = {
      kind: 'workflow_gate_event' as const,
      gate: 'gate-2' as const,
      action: 'verdict' as const,
      fromRole: 'implementation-reviewer' as const,
      eventId: 'evt-1'
    };

    await expect(registry.handleMcpToolCall('agent-1', 'send_to_agent', {
      to: 'agent-2',
      payload: 'Looks good',
      workflowEvent
    })).resolves.not.toThrow();

    const gateEvents = recordedEvents.filter(e => e.event === 'workflow_gate_attempt');
    expect(gateEvents).toHaveLength(1);
    
    // Inspectable shape check (who acted, which role, gate/action, accepted/refused)
    expect(gateEvents[0]).toEqual({
      channel: 'runtime',
      event: 'workflow_gate_attempt',
      payload: {
        agentId: 'agent-1',
        event: workflowEvent,
        result: 'accepted',
        payload: 'Looks good'
      }
    });
  });

  it('records a refused workflow gate attempt with the correct NDJSON shape', async () => {
    registry.setWorkflowRole('agent-1', 'implementer');
    const workflowEvent = {
      kind: 'workflow_gate_event' as const,
      gate: 'gate-1' as const,
      action: 'go' as const, // Implementer cannot do SM 'go'
      fromRole: 'scrum-master' as const,
      eventId: 'evt-2'
    };

    await expect(registry.handleMcpToolCall('agent-1', 'send_to_agent', {
      to: 'agent-2',
      payload: 'We are go',
      workflowEvent
    })).rejects.toThrow();

    const gateEvents = recordedEvents.filter(e => e.event === 'workflow_gate_attempt');
    expect(gateEvents).toHaveLength(1);

    expect(gateEvents[0]).toEqual({
      channel: 'runtime',
      event: 'workflow_gate_attempt',
      payload: {
        agentId: 'agent-1',
        event: workflowEvent,
        result: 'refused',
        reason: 'Unauthorized: Agent agent-1 is assigned role implementer, cannot act as scrum-master',
        payload: 'We are go'
      }
    });
  });
});
