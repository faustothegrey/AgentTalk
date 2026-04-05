/**
 * Structured JSON response schema for LLM agent responses.
 *
 * Instead of relying on free-text [CALL:] markers or ACCEPT/REFUSE prefixes,
 * LLMs are instructed to wrap every response in a typed JSON envelope:
 *
 *   { "message_type": "<type>", "message_payload": { ... } }
 *
 * This module provides:
 * - Type definitions for each message type
 * - A parser that extracts the JSON envelope from raw LLM output
 * - A retry prompt builder for when parsing fails
 * - The system-prompt instructions that describe the contract to the LLM
 */

export const STRUCTURED_MESSAGE_TYPES = [
  'discussion',
  'agreement_proposal',
  'agreement_reached',
  'submit_plan',
  'work_accept',
  'work_refuse',
  'healthcheck_ack',
] as const;

export type StructuredMessageType = (typeof STRUCTURED_MESSAGE_TYPES)[number];

export interface DiscussionPayload {
  text: string;
}

export interface AgreementProposalPayload {
  text: string;
}

export interface AgreementReachedPayload {
  text: string;
}

export interface SubmitPlanPayload {
  plan: string;
}

export interface WorkAcceptPayload {
  text: string;
}

export interface WorkRefusePayload {
  reason: string;
}

export interface HealthcheckAckPayload {
  text: string;
}

export type StructuredResponse =
  | { message_type: 'discussion'; message_payload: DiscussionPayload }
  | { message_type: 'agreement_proposal'; message_payload: AgreementProposalPayload }
  | { message_type: 'agreement_reached'; message_payload: AgreementReachedPayload }
  | { message_type: 'submit_plan'; message_payload: SubmitPlanPayload }
  | { message_type: 'work_accept'; message_payload: WorkAcceptPayload }
  | { message_type: 'work_refuse'; message_payload: WorkRefusePayload }
  | { message_type: 'healthcheck_ack'; message_payload: HealthcheckAckPayload };

function isValidMessageType(value: unknown): value is StructuredMessageType {
  return typeof value === 'string' && (STRUCTURED_MESSAGE_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePayload(messageType: StructuredMessageType, payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  switch (messageType) {
    case 'discussion':
    case 'agreement_proposal':
    case 'agreement_reached':
    case 'healthcheck_ack':
      return typeof payload.text === 'string' && payload.text.length > 0;
    case 'submit_plan':
      return typeof payload.plan === 'string' && payload.plan.length > 0;
    case 'work_accept':
      return typeof payload.text === 'string';
    case 'work_refuse':
      return typeof payload.reason === 'string' && payload.reason.length > 0;
    default:
      return false;
  }
}

/**
 * Attempts to extract a JSON object from raw text, handling common LLM quirks:
 * - Bare JSON object
 * - JSON wrapped in markdown code fences (```json ... ``` or ``` ... ```)
 * - Leading/trailing prose around the JSON block
 */
function extractJsonFromText(rawText: string): unknown | null {
  const trimmed = rawText.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to heuristics
  }

  // Try extracting from markdown code fences
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeFenceMatch?.[1]) {
    try {
      return JSON.parse(codeFenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding a JSON object in the text (first { to last })
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // give up
    }
  }

  return null;
}

/**
 * Parses a structured response from raw LLM output text.
 * Returns null if the text cannot be parsed into a valid structured response.
 */
export function parseStructuredResponse(rawText: string): StructuredResponse | null {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const parsed = extractJsonFromText(rawText);
  if (!isRecord(parsed)) {
    return null;
  }

  if (!isValidMessageType(parsed.message_type)) {
    return null;
  }

  if (!validatePayload(parsed.message_type, parsed.message_payload)) {
    return null;
  }

  return {
    message_type: parsed.message_type,
    message_payload: parsed.message_payload,
  } as StructuredResponse;
}

/**
 * Builds a correction prompt to send back to the LLM when parsing fails.
 */
export function buildRetryPrompt(rawText: string): string {
  return [
    'Your previous response could not be parsed as a valid structured JSON message.',
    'You MUST respond with a JSON object in this exact format:',
    '',
    '```json',
    '{',
    '  "message_type": "<type>",',
    '  "message_payload": { ... }',
    '}',
    '```',
    '',
    'Valid message_type values: discussion, agreement_proposal, agreement_reached, submit_plan, work_accept, work_refuse, healthcheck_ack.',
    '',
    '- For "discussion", "agreement_proposal", "agreement_reached", "healthcheck_ack": message_payload must have { "text": "..." }',
    '- For "submit_plan": message_payload must have { "plan": "..." }',
    '- For "work_accept": message_payload must have { "text": "..." }',
    '- For "work_refuse": message_payload must have { "reason": "..." }',
    '',
    'Respond ONLY with the JSON object. No other text before or after it.',
    '',
    'Your previous response was:',
    rawText.slice(0, 500),
    '',
    'Please resubmit your intended response as valid JSON.',
  ].join('\n');
}

/**
 * System prompt fragment that instructs the LLM about the structured response contract.
 * Append this to any prompt where you expect a structured response.
 */
export const STRUCTURED_RESPONSE_INSTRUCTIONS = [
  '',
  '## Response format',
  '',
  'You MUST respond with a single JSON object. No prose before or after it.',
  'The JSON object must have exactly two fields:',
  '',
  '```json',
  '{',
  '  "message_type": "<type>",',
  '  "message_payload": { ... }',
  '}',
  '```',
  '',
  'Available message types:',
  '',
  '- **"discussion"** — a normal conversational reply.',
  '  Payload: `{ "text": "your message here" }`',
  '',
  '- **"agreement_proposal"** — propose that the discussion has converged and you are ready to finalize.',
  '  Payload: `{ "text": "summary of what you agree on" }`',
  '  Rules: only use after substantive discussion, not on your first reply. Do not repeat if already proposed.',
  '',
  '- **"agreement_reached"** — confirm that you agree with a peer\'s agreement proposal.',
  '  Payload: `{ "text": "confirmation message" }`',
  '  Rules: only use after the system tells you a peer proposed agreement. If you disagree, use "discussion" instead.',
  '',
  '- **"submit_plan"** — submit the final implementation plan after agreement is reached.',
  '  Payload: `{ "plan": "the complete implementation plan" }`',
  '  Rules: only use after both agreement_proposal and agreement_reached have occurred. The plan must be concrete and implementation-ready.',
  '',
  'Critical rules:',
  '- Every response must be exactly one JSON object with message_type and message_payload.',
  '- Most of your replies should use "discussion". Only use other types at the appropriate protocol step.',
  '- Follow the strict order: discussion -> agreement_proposal -> agreement_reached -> submit_plan.',
  '- If unsure which type to use, use "discussion".',
].join('\n');

/**
 * System prompt fragment for worker agents describing accept/refuse message types.
 */
export const WORKER_RESPONSE_INSTRUCTIONS = [
  '',
  '## Response format',
  '',
  'You MUST respond with a single JSON object. No prose before or after it.',
  'The JSON object must have exactly two fields:',
  '',
  '```json',
  '{',
  '  "message_type": "<type>",',
  '  "message_payload": { ... }',
  '}',
  '```',
  '',
  'Available message types:',
  '',
  '- **"work_accept"** — you accept the plan and will execute it.',
  '  Payload: `{ "text": "your work output / execution result" }`',
  '',
  '- **"work_refuse"** — you refuse the plan because it is not feasible.',
  '  Payload: `{ "reason": "why you cannot execute the plan" }`',
  '',
  'Respond with exactly one JSON object. No other text.',
].join('\n');

/**
 * System prompt fragment for healthcheck responses.
 */
export const HEALTHCHECK_RESPONSE_INSTRUCTIONS = [
  '',
  '## Response format',
  '',
  'You MUST respond with a single JSON object:',
  '',
  '```json',
  '{',
  '  "message_type": "healthcheck_ack",',
  '  "message_payload": { "text": "your greeting here" }',
  '}',
  '```',
].join('\n');
