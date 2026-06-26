import { describe, it, expect } from 'vitest';
import {
  buildProtocolToolSchema,
  STRUCTURED_MESSAGE_TYPES,
  parseStructuredResponse,
} from '../response-schema.js';

// M10-T4: the protocol tool schema is the *generation-time* enforcement of the structural action
// set. These tests pin the single-source-of-truth invariant (enum == STRUCTURED_MESSAGE_TYPES) so
// the tool can never drift from what the parser accepts, plus the envelope round-trip.

describe('buildProtocolToolSchema (M10-T4)', () => {
  it('exposes a single `respond` function tool requiring message_type + message_payload', () => {
    const tool = buildProtocolToolSchema();
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('respond');
    expect(tool.function.parameters.type).toBe('object');
    expect(tool.function.parameters.required).toEqual(['message_type', 'message_payload']);
    expect(tool.function.parameters.additionalProperties).toBe(false);
    expect(tool.function.parameters.properties.message_payload.type).toBe('object');
  });

  it('emits a message_type enum exactly equal to STRUCTURED_MESSAGE_TYPES (drift guard)', () => {
    const tool = buildProtocolToolSchema();
    const enumValues = tool.function.parameters.properties.message_type.enum;
    // Exact set + order parity with the parser's source of truth — any divergence is a drift bug.
    expect([...enumValues]).toEqual([...STRUCTURED_MESSAGE_TYPES]);
  });

  it('is a fresh object each call (no shared mutable enum array leaking the constant)', () => {
    const a = buildProtocolToolSchema();
    const b = buildProtocolToolSchema();
    expect(a).not.toBe(b);
    expect(a.function.parameters.properties.message_type.enum).not.toBe(
      STRUCTURED_MESSAGE_TYPES,
    );
  });

  it('round-trip: a tool-call envelope for each of the 9 types parses to a valid StructuredResponse', () => {
    // The tool-call `arguments` ARE the existing envelope; a valid payload per type must survive
    // parseStructuredResponse unchanged (proves the tool path reuses the parser verbatim).
    const payloads: Record<string, unknown> = {
      opinion: { text: 'hi', proposal: null, expected_response_types: ['opinion'] },
      agreement_proposal: { text: 'hi', proposal: 'p', expected_response_types: ['agreement_acceptance'] },
      agreement_acceptance: { text: 'hi', proposal: 'p', expected_response_types: ['submit_plan'] },
      submit_plan: { plan: 'do it', text: 'hi', proposal: 'p' },
      fact_collection_end: { summary: 'facts' },
      work_accept: { text: 'done' },
      work_refuse: { reason: 'cannot' },
      healthcheck_ack: { text: 'hello' },
      ack_planning_protocol: {},
    };
    for (const message_type of STRUCTURED_MESSAGE_TYPES) {
      const argumentsJson = JSON.stringify({ message_type, message_payload: payloads[message_type] });
      const parsed = parseStructuredResponse(argumentsJson);
      expect(parsed, `type ${message_type} should parse`).not.toBeNull();
      expect(parsed!.message_type).toBe(message_type);
    }
  });
});
