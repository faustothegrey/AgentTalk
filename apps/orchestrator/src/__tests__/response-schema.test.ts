import { describe, expect, it } from 'vitest';
import {
  parseStructuredResponse,
  buildRetryPrompt,
  STRUCTURED_RESPONSE_INSTRUCTIONS,
  WORKER_RESPONSE_INSTRUCTIONS,
  HEALTHCHECK_RESPONSE_INSTRUCTIONS,
} from '@agenttalk/runtime-core/agents/response-schema';

describe('parseStructuredResponse', () => {
  it('parses a valid opinion response', () => {
    const raw = JSON.stringify({
      message_type: 'opinion',
      message_payload: {
        text: 'I think we should refactor the parser.',
        proposal: null,
        expected_response_types: ['opinion', 'agreement_proposal'],
      },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'opinion',
      message_payload: {
        text: 'I think we should refactor the parser.',
        proposal: null,
        expected_response_types: ['opinion', 'agreement_proposal'],
      },
    });
  });

  it('parses a valid agreement_proposal response', () => {
    const raw = JSON.stringify({
      message_type: 'agreement_proposal',
      message_payload: {
        text: 'Let us formalize the direction.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
        expected_response_types: ['agreement_acceptance', 'opinion'],
      },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'agreement_proposal',
      message_payload: {
        text: 'Let us formalize the direction.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
        expected_response_types: ['agreement_acceptance', 'opinion'],
      },
    });
  });

  it('parses a valid agreement_acceptance response', () => {
    const raw = JSON.stringify({
      message_type: 'agreement_acceptance',
      message_payload: {
        text: 'Confirmed as proposed.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
        expected_response_types: ['submit_plan'],
      },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'agreement_acceptance',
      message_payload: {
        text: 'Confirmed as proposed.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
        expected_response_types: ['submit_plan'],
      },
    });
  });

  it('parses a valid submit_plan response', () => {
    const raw = JSON.stringify({
      message_type: 'submit_plan',
      message_payload: {
        plan: 'Step 1: refactor. Step 2: test.',
        text: 'Submitting final plan for the accepted proposal.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
      },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'submit_plan',
      message_payload: {
        plan: 'Step 1: refactor. Step 2: test.',
        text: 'Submitting final plan for the accepted proposal.',
        proposal: 'We should keep parser behavior and extract validation helpers.',
      },
    });
  });

  it('parses a valid fact_collection_end response', () => {
    const raw = JSON.stringify({
      message_type: 'fact_collection_end',
      message_payload: { summary: 'Found 3 relevant files in src/registry/' },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'fact_collection_end',
      message_payload: { summary: 'Found 3 relevant files in src/registry/' },
    });
  });

  it('returns null when fact_collection_end has empty summary', () => {
    const raw = JSON.stringify({
      message_type: 'fact_collection_end',
      message_payload: { summary: '' },
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('parses a valid work_accept response', () => {
    const raw = JSON.stringify({
      message_type: 'work_accept',
      message_payload: { text: 'Task completed successfully.' },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'work_accept',
      message_payload: { text: 'Task completed successfully.' },
    });
  });

  it('parses a valid work_refuse response', () => {
    const raw = JSON.stringify({
      message_type: 'work_refuse',
      message_payload: { reason: 'Cannot use git worktree in this context.' },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'work_refuse',
      message_payload: { reason: 'Cannot use git worktree in this context.' },
    });
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const raw = '```json\n{"message_type":"opinion","message_payload":{"text":"hello","proposal":null,"expected_response_types":["opinion"]}}\n```';
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'opinion',
      message_payload: { text: 'hello', proposal: null, expected_response_types: ['opinion'] },
    });
  });

  it('parses JSON wrapped in code fences without language tag', () => {
    const raw = '```\n{"message_type":"opinion","message_payload":{"text":"hello","proposal":null,"expected_response_types":["opinion"]}}\n```';
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'opinion',
      message_payload: { text: 'hello', proposal: null, expected_response_types: ['opinion'] },
    });
  });

  it('parses JSON embedded in surrounding prose', () => {
    const raw = 'Here is my response:\n{"message_type":"opinion","message_payload":{"text":"hello","proposal":null,"expected_response_types":["opinion"]}}\nThat is all.';
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'opinion',
      message_payload: { text: 'hello', proposal: null, expected_response_types: ['opinion'] },
    });
  });

  it('returns null for empty input', () => {
    expect(parseStructuredResponse('')).toBeNull();
  });

  it('returns null for plain text with no JSON', () => {
    expect(parseStructuredResponse('Just a regular message with no JSON.')).toBeNull();
  });

  it('returns null for unknown message_type', () => {
    const raw = JSON.stringify({
      message_type: 'unknown_type',
      message_payload: { text: 'hello' },
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('returns null when message_payload is missing required fields', () => {
    const raw = JSON.stringify({
      message_type: 'opinion',
      message_payload: {},
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('returns null when message_payload text is empty for opinion', () => {
    const raw = JSON.stringify({
      message_type: 'opinion',
      message_payload: { text: '', proposal: null },
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('returns null when submit_plan has empty plan', () => {
    const raw = JSON.stringify({
      message_type: 'submit_plan',
      message_payload: { plan: '', text: 'x', proposal: 'p' },
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('returns null when work_refuse has empty reason', () => {
    const raw = JSON.stringify({
      message_type: 'work_refuse',
      message_payload: { reason: '' },
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('allows work_accept with empty text', () => {
    const raw = JSON.stringify({
      message_type: 'work_accept',
      message_payload: { text: '' },
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'work_accept',
      message_payload: { text: '' },
    });
  });

  it('returns null when message_payload is not an object', () => {
    const raw = JSON.stringify({
      message_type: 'opinion',
      message_payload: 'just a string',
    });
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('returns null for an array instead of object', () => {
    const raw = JSON.stringify([{ message_type: 'opinion' }]);
    expect(parseStructuredResponse(raw)).toBeNull();
  });

  it('strips extra fields and returns only message_type and message_payload', () => {
    const raw = JSON.stringify({
      message_type: 'opinion',
      message_payload: { text: 'hello', proposal: null, expected_response_types: ['opinion'] },
      extra_field: 'should be ignored',
    });
    const result = parseStructuredResponse(raw);
    expect(result).toEqual({
      message_type: 'opinion',
      message_payload: { text: 'hello', proposal: null, expected_response_types: ['opinion'] },
    });
    expect(result).not.toHaveProperty('extra_field');
  });
});

describe('buildRetryPrompt', () => {
  it('includes the original response text', () => {
    const prompt = buildRetryPrompt('some invalid text');
    expect(prompt).toContain('some invalid text');
  });

  it('truncates long original responses', () => {
    const longText = 'x'.repeat(1000);
    const prompt = buildRetryPrompt(longText);
    expect(prompt).not.toContain(longText);
    expect(prompt).toContain('x'.repeat(500));
  });

  it('includes instructions about valid message types', () => {
    const prompt = buildRetryPrompt('bad');
    expect(prompt).toContain('message_type');
    expect(prompt).toContain('message_payload');
    expect(prompt).toContain('opinion');
    expect(prompt).toContain('submit_plan');
    expect(prompt).toContain('expected_response_types');
  });
});

describe('instruction constants', () => {
  it('STRUCTURED_RESPONSE_INSTRUCTIONS contains all planning message types', () => {
    expect(STRUCTURED_RESPONSE_INSTRUCTIONS).toContain('opinion');
    expect(STRUCTURED_RESPONSE_INSTRUCTIONS).toContain('agreement_proposal');
    expect(STRUCTURED_RESPONSE_INSTRUCTIONS).toContain('agreement_acceptance');
    expect(STRUCTURED_RESPONSE_INSTRUCTIONS).toContain('submit_plan');
  });

  it('WORKER_RESPONSE_INSTRUCTIONS contains worker message types', () => {
    expect(WORKER_RESPONSE_INSTRUCTIONS).toContain('work_accept');
    expect(WORKER_RESPONSE_INSTRUCTIONS).toContain('work_refuse');
  });

  it('HEALTHCHECK_RESPONSE_INSTRUCTIONS contains healthcheck type', () => {
    expect(HEALTHCHECK_RESPONSE_INSTRUCTIONS).toContain('healthcheck_ack');
  });
});
