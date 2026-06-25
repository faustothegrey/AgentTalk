import { describe, expect, it } from 'vitest';
import { parseRequestPayload } from '@agenttalk/contracts/protocol-payloads';

describe('protocol-payloads parseRequestPayload', () => {
  it('parses agreement_acceptance request payload', () => {
    const payload = parseRequestPayload({
      id: 'req-1',
      call: 'agreement_acceptance',
      args: { expected_response_types: ['submit_plan'] },
    });

    expect(payload).toEqual({
      id: 'req-1',
      call: 'agreement_acceptance',
      args: { expected_response_types: ['submit_plan'] },
    });
  });

  it('parses agreement_proposal with proposal text', () => {
    const payload = parseRequestPayload({
      id: 'req-2',
      call: 'agreement_proposal',
      args: { proposal: 'Adopt the tiny-cleanup plan.', expected_response_types: ['agreement_acceptance', 'opinion'] },
    });

    expect(payload).toEqual({
      id: 'req-2',
      call: 'agreement_proposal',
      args: { proposal: 'Adopt the tiny-cleanup plan.', expected_response_types: ['agreement_acceptance', 'opinion'] },
    });
  });

  it('parses submit_plan with proposal and text', () => {
    const payload = parseRequestPayload({
      id: 'req-3',
      call: 'submit_plan',
      args: {
        plan: '1. Do X\n2. Do Y',
        proposal: 'Adopt the tiny-cleanup plan.',
        text: 'Submitting final plan.',
      },
    });

    expect(payload).toEqual({
      id: 'req-3',
      call: 'submit_plan',
      args: {
        plan: '1. Do X\n2. Do Y',
        proposal: 'Adopt the tiny-cleanup plan.',
        text: 'Submitting final plan.',
      },
    });
  });
});
