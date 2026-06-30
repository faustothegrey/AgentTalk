import { describe, expect, it } from 'vitest';
import { parseRequestPayload } from '@agenttalk/contracts/protocol-payloads';

describe('protocol-payloads parseRequestPayload', () => {
  it('parses consensus_respond with agreement_acceptance payload', () => {
    const payload = parseRequestPayload({
      id: 'req-1',
      call: 'consensus_respond',
      args: { action: 'agreement_acceptance', payload: { expected_response_types: ['submit_plan'] } },
    });

    expect(payload).toEqual({
      id: 'req-1',
      call: 'consensus_respond',
      args: { action: 'agreement_acceptance', payload: { expected_response_types: ['submit_plan'] } },
    });
  });

  it('parses consensus_respond with agreement_proposal payload', () => {
    const payload = parseRequestPayload({
      id: 'req-2',
      call: 'consensus_respond',
      args: { action: 'agreement_proposal', payload: { proposal: 'Adopt the tiny-cleanup plan.', expected_response_types: ['agreement_acceptance', 'opinion'] } },
    });

    expect(payload).toEqual({
      id: 'req-2',
      call: 'consensus_respond',
      args: { action: 'agreement_proposal', payload: { proposal: 'Adopt the tiny-cleanup plan.', expected_response_types: ['agreement_acceptance', 'opinion'] } },
    });
  });

  it('parses consensus_respond with submit_plan payload', () => {
    const payload = parseRequestPayload({
      id: 'req-3',
      call: 'consensus_respond',
      args: {
        action: 'submit_plan',
        payload: {
          plan: '1. Do X\n2. Do Y',
          proposal: 'Adopt the tiny-cleanup plan.',
          text: 'Submitting final plan.',
        }
      },
    });

    expect(payload).toEqual({
      id: 'req-3',
      call: 'consensus_respond',
      args: {
        action: 'submit_plan',
        payload: {
          plan: '1. Do X\n2. Do Y',
          proposal: 'Adopt the tiny-cleanup plan.',
          text: 'Submitting final plan.',
        }
      },
    });
  });
});
