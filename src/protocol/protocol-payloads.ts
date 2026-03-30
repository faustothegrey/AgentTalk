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

export interface SubmitPlanRequestPayload {
  id: string;
  call: 'submit_plan';
  args: {
    plan: string;
  };
}

export interface SubmitWorkResponseRequestPayload {
  id: string;
  call: 'submit_work_response';
  args: {
    accepted: boolean;
    reason?: string;
  };
}

export interface SubmitWorkResultRequestPayload {
  id: string;
  call: 'submit_work_result';
  args: {
    result: string;
  };
}

export type RequestPayload =
  | ListAgentsRequestPayload
  | SendToAgentRequestPayload
  | AckHealthcheckRequestPayload
  | SubmitPlanRequestPayload
  | SubmitWorkResponseRequestPayload
  | SubmitWorkResultRequestPayload;

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

export interface TeamTaskAssignEventPayload {
  type: 'team_task_assign';
  teamId: string;
  taskId: string;
  role: 'planner';
  description: string;
}

export interface TeamWorkAssignEventPayload {
  type: 'team_work_assign';
  teamId: string;
  taskId: string;
  role: 'worker';
  plan: string;
  description: string;
}

export type EventPayload =
  | BusyStateEventPayload
  | ExternalUsageEventPayload
  | MessageReceivedEventPayload
  | UserInputEventPayload
  | HealthcheckEventPayload
  | ConversationStartEventPayload
  | ConversationEndEventPayload
  | TeamTaskAssignEventPayload
  | TeamWorkAssignEventPayload;

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

    case 'submit_plan':
      if (!isRecord(value.args) || typeof value.args.plan !== 'string') {
        return null;
      }

      return {
        id: value.id,
        call: 'submit_plan',
        args: { plan: value.args.plan },
      };

    case 'submit_work_response':
      if (!isRecord(value.args) || typeof value.args.accepted !== 'boolean') {
        return null;
      }

      {
        const result: SubmitWorkResponseRequestPayload = {
          id: value.id,
          call: 'submit_work_response',
          args: { accepted: value.args.accepted },
        };
        if (typeof value.args.reason === 'string') {
          result.args.reason = value.args.reason;
        }
        return result;
      }

    case 'submit_work_result':
      if (!isRecord(value.args) || typeof value.args.result !== 'string') {
        return null;
      }

      return {
        id: value.id,
        call: 'submit_work_result',
        args: { result: value.args.result },
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

    case 'team_task_assign':
      return typeof value.teamId === 'string' &&
        typeof value.taskId === 'string' &&
        value.role === 'planner' &&
        typeof value.description === 'string'
        ? {
            type: 'team_task_assign',
            teamId: value.teamId,
            taskId: value.taskId,
            role: value.role,
            description: value.description,
          }
        : null;

    case 'team_work_assign':
      return typeof value.teamId === 'string' &&
        typeof value.taskId === 'string' &&
        value.role === 'worker' &&
        typeof value.plan === 'string' &&
        typeof value.description === 'string'
        ? {
            type: 'team_work_assign',
            teamId: value.teamId,
            taskId: value.taskId,
            role: value.role,
            plan: value.plan,
            description: value.description,
          }
        : null;

    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
