import {
  parseStructuredResponse,
  buildRetryPrompt,
  type StructuredResponse,
} from './response-schema.js';
import type { ConversationEvent, ProtocolRequest } from '../conversations/runtime.js';

/**
 * Translates a valid structured response payload into an MCP tool call (ProtocolRequest).
 */
export function translateStructuredResponse(
  evt: ConversationEvent,
  structured: StructuredResponse,
  buildProtocolRequest: (evt: ConversationEvent, reply: string) => ProtocolRequest
): ProtocolRequest {
  const commonArgs = {
    expected_response_types: (structured.message_payload as any).expected_response_types,
  };

  switch (structured.message_type) {
    case 'opinion': {
      const request = buildProtocolRequest(evt, structured.message_payload.text);
      request.args = { ...request.args, ...commonArgs };
      return request;
    }
    case 'agreement_proposal': {
      return {
        id: '', // typically assigned by caller
        call: 'agreement_proposal',
        args: {
          ...commonArgs,
          proposal: structured.message_payload.proposal,
          ...(structured.message_payload.text ? { text: structured.message_payload.text } : {}),
        },
      };
    }
    case 'agreement_acceptance': {
      return {
        id: '',
        call: 'agreement_acceptance',
        args: {
          ...commonArgs,
          proposal: structured.message_payload.proposal,
          ...(structured.message_payload.text ? { text: structured.message_payload.text } : {}),
        },
      };
    }
    case 'submit_plan': {
      return {
        id: '',
        call: 'submit_plan',
        args: {
          plan: structured.message_payload.plan,
          proposal: structured.message_payload.proposal,
          text: structured.message_payload.text,
        },
      };
    }
    case 'fact_collection_end': {
      return {
        id: '',
        call: 'fact_collection_end',
        args: { summary: structured.message_payload.summary },
      };
    }
    case 'healthcheck_ack': {
      return buildProtocolRequest(evt, structured.message_payload.text);
    }
    default: {
      // work_accept / work_refuse etc.
      const text = (structured.message_payload as any).text || (structured.message_payload as any).reason || '';
      return buildProtocolRequest(evt, text);
    }
  }
}

/**
 * Handles parsing a raw LLM response, with one retry attempt if parsing fails.
 * If the retry also fails, returns an error message.
 */
export async function parseWithRetry(
  rawResponse: string,
  executePrompt: (prompt: string) => Promise<string | null>
): Promise<{ structured?: StructuredResponse; error?: string }> {
  let structured = parseStructuredResponse(rawResponse);
  
  if (!structured) {
    const retryPrompt = buildRetryPrompt(rawResponse);
    const retryResponse = await executePrompt(retryPrompt);
    if (retryResponse) {
      structured = parseStructuredResponse(retryResponse) || null;
    }
  }

  if (structured) {
    return { structured };
  }

  return { error: 'Your response was rejected because it was not a valid structured JSON message. Do not retry now. Wait for the next planning request from the system before responding.' };
}
