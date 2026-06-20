import { describe, it, expect, vi } from 'vitest';
import { translateStructuredResponse, parseWithRetry } from '../translation.js';
import type { StructuredResponse } from '../response-schema.js';
import type { ConversationEvent } from '../../conversations/runtime.js';

describe('translation module', () => {
  describe('translateStructuredResponse', () => {
    const mockEvt = { type: 'message_received' } as ConversationEvent;
    const mockBuildProtocolRequest = vi.fn().mockImplementation((_evt, reply) => ({
      id: 'mock-id',
      call: 'send_to_agent',
      args: { payload: reply }
    }));

    it('translates opinion', () => {
      const structured: StructuredResponse = {
        message_type: 'opinion',
        message_payload: { text: 'my opinion', proposal: null, expected_response_types: ['agreement_proposal'] }
      };

      const result = translateStructuredResponse(mockEvt, structured, mockBuildProtocolRequest);
      expect(result.call).toBe('send_to_agent');
      expect(result.args.payload).toBe('my opinion');
      expect((result.args as any).expected_response_types).toEqual(['agreement_proposal']);
    });

    it('translates agreement_proposal', () => {
      const structured: StructuredResponse = {
        message_type: 'agreement_proposal',
        message_payload: { text: 'I propose X', proposal: 'X', expected_response_types: ['agreement_acceptance'] }
      };

      const result = translateStructuredResponse(mockEvt, structured, mockBuildProtocolRequest);
      expect(result.call).toBe('agreement_proposal');
      expect(result.args.proposal).toBe('X');
      expect(result.args.text).toBe('I propose X');
      expect((result.args as any).expected_response_types).toEqual(['agreement_acceptance']);
    });

    it('translates submit_plan', () => {
      const structured: StructuredResponse = {
        message_type: 'submit_plan',
        message_payload: { text: 'Here is the plan', proposal: 'X', plan: '1. Do X' }
      };

      const result = translateStructuredResponse(mockEvt, structured, mockBuildProtocolRequest);
      expect(result.call).toBe('submit_plan');
      expect(result.args.plan).toBe('1. Do X');
      expect(result.args.proposal).toBe('X');
    });
  });

  describe('parseWithRetry', () => {
    it('parses valid json immediately without retry', async () => {
      const raw = '{"message_type":"healthcheck_ack","message_payload":{"text":"hello"}}';
      const executePrompt = vi.fn();

      const result = await parseWithRetry(raw, executePrompt);
      expect(result.structured).toBeDefined();
      expect(result.structured?.message_type).toBe('healthcheck_ack');
      expect(executePrompt).not.toHaveBeenCalled();
    });

    it('retries on invalid json and succeeds', async () => {
      const raw = 'invalid json';
      const executePrompt = vi.fn().mockResolvedValue('{"message_type":"healthcheck_ack","message_payload":{"text":"hello"}}');

      const result = await parseWithRetry(raw, executePrompt);
      expect(executePrompt).toHaveBeenCalledOnce();
      expect(result.structured).toBeDefined();
      expect(result.structured?.message_type).toBe('healthcheck_ack');
    });

    it('returns error if retry fails', async () => {
      const raw = 'invalid json';
      const executePrompt = vi.fn().mockResolvedValue('still invalid');

      const result = await parseWithRetry(raw, executePrompt);
      expect(executePrompt).toHaveBeenCalledOnce();
      expect(result.structured).toBeUndefined();
      expect(result.error).toContain('rejected');
    });
  });
});
