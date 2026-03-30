export interface ReadyPayload {
  session: string;
}

export interface ListAgentsRequestPayload {
  id: string;
  call: 'list_agents';
  args?: Record<string, unknown>;
}

export interface SendToAgentRequestPayload {
  id: string;
  call: 'send_to_agent';
  args: {
    to: string;
    payload: unknown;
  };
}

export interface AckHealthcheckRequestPayload {
  id: string;
  call: 'ack_healthcheck';
  args: {
    token: string;
    message: string;
  };
}

export type RequestPayload =
  | ListAgentsRequestPayload
  | SendToAgentRequestPayload
  | AckHealthcheckRequestPayload;

export interface ResponsePayload {
  id: string;
  status: 'success' | 'error';
  data?: Record<string, unknown>;
  error?: string;
}

export interface BusyStateEventPayload {
  type: 'busy_state';
  busy: boolean;
}

export interface UsageUpdatedEventPayload {
  type: 'usage_updated';
  total: number;
  limit: number;
}

export interface ExternalUsageEventPayload {
  type: 'external_usage';
  provider?: string;
  output: string;
}

export interface MessageReceivedEventPayload {
  type: 'message_received';
  from: string;
  payload: unknown;
}

export interface UserInputEventPayload {
  type: 'user_input';
  text: string;
}

export interface HealthcheckEventPayload {
  type: 'healthcheck';
  token: string;
  prompt: string;
}

export interface ConversationStartEventPayload {
  type: 'conversation_start';
  conversationId: string;
  peerIds: string[];
  peerId: string;
  topic: string;
  maxReplies: number;
  initiator: boolean;
}

export interface ConversationEndEventPayload {
  type: 'conversation_end';
  conversationId: string;
  reason: string;
}

export type EventPayload =
  | BusyStateEventPayload
  | UsageUpdatedEventPayload
  | ExternalUsageEventPayload
  | MessageReceivedEventPayload
  | UserInputEventPayload
  | HealthcheckEventPayload
  | ConversationStartEventPayload
  | ConversationEndEventPayload;

export function parseReadyPayload(value: unknown): ReadyPayload | null {
  if (!isRecord(value) || typeof value.session !== 'string' || value.session.length === 0) {
    return null;
  }

  return { session: value.session };
}

export function parseRequestPayload(value: unknown): RequestPayload | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.call !== 'string') {
    return null;
  }

  switch (value.call) {
    case 'list_agents':
      if (isRecord(value.args)) {
        return {
          id: value.id,
          call: 'list_agents',
          args: value.args,
        };
      }

      return {
        id: value.id,
        call: 'list_agents',
      };

    case 'send_to_agent':
      if (!isRecord(value.args) || typeof value.args.to !== 'string' || !('payload' in value.args)) {
        return null;
      }

      return {
        id: value.id,
        call: 'send_to_agent',
        args: {
          to: value.args.to,
          payload: value.args.payload,
        },
      };

    case 'ack_healthcheck':
      if (!isRecord(value.args) || typeof value.args.token !== 'string' || typeof value.args.message !== 'string') {
        return null;
      }

      return {
        id: value.id,
        call: 'ack_healthcheck',
        args: {
          token: value.args.token,
          message: value.args.message,
        },
      };

    default:
      return null;
  }
}

export function parseResponsePayload(value: unknown): ResponsePayload | null {
  if (!isRecord(value) || typeof value.id !== 'string' || (value.status !== 'success' && value.status !== 'error')) {
    return null;
  }

  const payload: ResponsePayload = {
    id: value.id,
    status: value.status,
  };

  if (isRecord(value.data)) {
    payload.data = value.data;
  }

  if (typeof value.error === 'string') {
    payload.error = value.error;
  }

  return payload;
}

export function parseEventPayload(value: unknown): EventPayload | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  switch (value.type) {
    case 'busy_state':
      return typeof value.busy === 'boolean'
        ? { type: 'busy_state', busy: value.busy }
        : null;

    case 'usage_updated':
      return typeof value.total === 'number' && typeof value.limit === 'number'
        ? { type: 'usage_updated', total: value.total, limit: value.limit }
        : null;

    case 'external_usage':
      if (typeof value.output !== 'string') {
        return null;
      }

      if (typeof value.provider === 'string') {
        return {
          type: 'external_usage',
          provider: value.provider,
          output: value.output,
        };
      }

      return {
        type: 'external_usage',
        output: value.output,
      };

    case 'message_received':
      return typeof value.from === 'string' && 'payload' in value
        ? {
            type: 'message_received',
            from: value.from,
            payload: value.payload,
          }
        : null;

    case 'user_input':
      return typeof value.text === 'string'
        ? { type: 'user_input', text: value.text }
        : null;

    case 'healthcheck':
      return typeof value.token === 'string' && typeof value.prompt === 'string'
        ? { type: 'healthcheck', token: value.token, prompt: value.prompt }
        : null;

    case 'conversation_start':
      return typeof value.conversationId === 'string' &&
        Array.isArray(value.peerIds) &&
        value.peerIds.every((entry) => typeof entry === 'string') &&
        typeof value.peerId === 'string' &&
        typeof value.topic === 'string' &&
        typeof value.maxReplies === 'number' &&
        typeof value.initiator === 'boolean'
        ? {
            type: 'conversation_start',
            conversationId: value.conversationId,
            peerIds: value.peerIds,
            peerId: value.peerId,
            topic: value.topic,
            maxReplies: value.maxReplies,
            initiator: value.initiator,
          }
        : null;

    case 'conversation_end':
      return typeof value.conversationId === 'string' && typeof value.reason === 'string'
        ? {
            type: 'conversation_end',
            conversationId: value.conversationId,
            reason: value.reason,
          }
        : null;

    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
