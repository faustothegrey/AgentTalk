import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import * as apiClient from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

describe('Team API Consensus (mocked)', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('runs a full planner-planner-worker flow to completion', async () => {
    const callApiMock = vi.mocked(apiClient.callApi);

    // Mock API responses per phase/agent.
    callApiMock.mockImplementation(async (args: any) => {
      const messages = args.messages;
      const lastMsg = messages[messages.length - 1].content as string;

      if (lastMsg.includes('ack_planning_protocol')) {
        return { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
      }
      if (lastMsg.includes('fact_collection_begin') || lastMsg.includes('PLANNER')) {
        // First check if it's fact collection
        if (lastMsg.includes('collect facts') || lastMsg.includes('fact_collection_begin')) {
          return { text: '{"message_type":"fact_collection_end","message_payload":{"summary":"facts"}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
        }
      }
      if (lastMsg.includes('WORKER_RESPONSE_INSTRUCTIONS') || lastMsg.includes('WORKER')) {
        return { text: '{"message_type":"work_accept","message_payload":{"text":"work completed"}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
      }

      // Planning Protocol phases:
      if (lastMsg.includes('One planner must call submit_plan') || lastMsg.includes('must call submit_plan')) {
        return { text: '{"message_type":"submit_plan","message_payload":{"plan":"I will implement a change in src/app.ts","proposal":"prop","text":"done"}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
      }

      if (args.model === 'planner-a') {
        return { text: '{"message_type":"agreement_proposal","message_payload":{"proposal":"prop","text":"I propose this","expected_response_types":["agreement_acceptance", "opinion"]}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
      }
      
      if (args.model === 'planner-b') {
        if (lastMsg.includes('agreement_proposal') || lastMsg.includes('proposes')) {
          return { text: '{"message_type":"agreement_acceptance","message_payload":{"proposal":"prop","text":"I accept","expected_response_types":["submit_plan"]}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
        }
        return { text: '{"message_type":"opinion","message_payload":{"text":"I think yes","proposal":null,"expected_response_types":["agreement_proposal"]}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
      }

      // Default catch-all
      return { text: '{"message_type":"opinion","message_payload":{"text":"catch-all","proposal":null,"expected_response_types":["agreement_proposal"]}}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
    });

    const plannerA = await registry.createAgent('planner-a', { provider: 'api', providerName: 'google', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'api', providerName: 'google', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'api', providerName: 'google', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ]);

    let planSubmitted = false;
    let workCompleted = false;
    let capturedTaskId: string | undefined;

    registry.on('team_task', (task) => {
      if (task.status === 'awaiting_confirmation') {
        planSubmitted = true;
        capturedTaskId = task.id;
      } else if (task.status === 'completed') {
        workCompleted = true;
      }
    });

    await registry.assignTeamTask(team.id, 'Make a plan');

    // Wait for plan
    for (let i = 0; i < 20 && !planSubmitted; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    expect(planSubmitted).toBe(true);

    // Confirm plan
    await registry.confirmTeamPlan(capturedTaskId!);

    // Wait for worker
    for (let i = 0; i < 20 && !workCompleted; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    expect(workCompleted).toBe(true);
  });
});
