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


  switch (structured.message_type) {
    case 'opinion':
    case 'agreement_proposal':
    case 'agreement_acceptance':
    case 'submit_plan':
    case 'fact_collection_end':
    case 'ack_planning_protocol': {
      return {
        id: '',
        call: 'consensus_respond',
        args: {
          action: structured.message_type,
          payload: structured.message_payload,
        },
      };
    }
    case 'healthcheck_ack': {
      return buildProtocolRequest(evt, (structured.message_payload as any).text);
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
