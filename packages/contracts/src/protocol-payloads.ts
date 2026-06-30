import type {
  AgentExecutionMode,
  AgentSessionStatus,
  ResolvedExecutionMode,
} from './types.js';

export interface ReadyPayload {
  session: string;
  requestedExecutionMode?: AgentExecutionMode;
  resolvedExecutionMode?: ResolvedExecutionMode;
  sessionStatus?: AgentSessionStatus;
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
    replyToMessageId?: string;
    expected_response_types?: string[];
  };
}

export interface AckHealthcheckRequestPayload {
  id: string;
  call: 'ack_healthcheck';
  args: {
    token: string;
    message: unknown;
  };
}

export interface ConsensusRespondRequestPayload {
  id: string;
  call: 'consensus_respond';
  args: {
    action: 'opinion' | 'agreement_proposal' | 'agreement_acceptance' | 'ack_planning_protocol' | 'fact_collection_end' | 'submit_plan';
    payload: Record<string, unknown>;
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

export interface SubmitUsageStatsRequestPayload {
  id: string;
  call: 'submit_usage_stats';
  args: {
    stats: string;
    timestamp: string;
  };
}

export type RequestPayload =
  | ListAgentsRequestPayload
  | SendToAgentRequestPayload
  | AckHealthcheckRequestPayload
  | ConsensusRespondRequestPayload
  | SubmitWorkResponseRequestPayload
  | SubmitWorkResultRequestPayload
  | SubmitUsageStatsRequestPayload;

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

export interface SessionUpdateEventPayload {
  type: 'session_update';
  sessionStatus: AgentSessionStatus;
  requestedExecutionMode?: AgentExecutionMode;
  resolvedExecutionMode?: ResolvedExecutionMode;
}

export interface MessageReceivedEventPayload {
  type: 'message_received';
  from: string;
  payload: unknown;
  messageId?: string;
  replyToMessageId?: string;
  expected_response_types?: string[];
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
  mode?: 'planning';
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
  cwd?: string;
  timeoutMs?: number;
}



export interface FactCollectionBeginEventPayload {
  type: 'fact_collection_begin';
  taskId: string;
  description: string;
  peerIds: string[];
}

export interface CustomEventRequestEventPayload {
  type: 'custom_event_request';
  event: string;
  args?: Record<string, unknown>;
  prompt?: string;
}

export type EventPayload =
  | BusyStateEventPayload
  | SessionUpdateEventPayload
  | MessageReceivedEventPayload
  | HealthcheckEventPayload
  | ConversationStartEventPayload
  | ConversationEndEventPayload
  | TeamTaskAssignEventPayload
  | TeamWorkAssignEventPayload
  | FactCollectionBeginEventPayload
  | CustomEventRequestEventPayload;

export function parseReadyPayload(value: unknown): ReadyPayload | null {
  if (!isRecord(value) || typeof value.session !== 'string' || value.session.length === 0) {
    return null;
  }

  const payload: ReadyPayload = { session: value.session };

  if (isAgentExecutionMode(value.requestedExecutionMode)) {
    payload.requestedExecutionMode = value.requestedExecutionMode;
  }

  if (isResolvedExecutionMode(value.resolvedExecutionMode)) {
    payload.resolvedExecutionMode = value.resolvedExecutionMode;
  }

  if (isAgentSessionStatus(value.sessionStatus)) {
    payload.sessionStatus = value.sessionStatus;
  }

  return payload;
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

      {
        const payload: SendToAgentRequestPayload = {
        id: value.id,
        call: 'send_to_agent',
        args: {
          to: value.args.to,
          payload: value.args.payload,
        },
        };
        if (typeof value.args.replyToMessageId === 'string') {
          payload.args.replyToMessageId = value.args.replyToMessageId;
        }
        if (
          Array.isArray(value.args.expected_response_types) &&
          value.args.expected_response_types.every((entry) => typeof entry === 'string')
        ) {
          payload.args.expected_response_types = value.args.expected_response_types;
        }
        return payload;
      }

    case 'ack_healthcheck':
      if (!isRecord(value.args) || typeof value.args.token !== 'string' || !('message' in value.args)) {
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

    case 'consensus_respond':
      if (
        !isRecord(value.args) ||
        typeof value.args.action !== 'string' ||
        !['opinion', 'agreement_proposal', 'agreement_acceptance', 'ack_planning_protocol', 'fact_collection_end', 'submit_plan'].includes(value.args.action) ||
        !isRecord(value.args.payload)
      ) {
        return null;
      }
      return {
        id: value.id,
        call: 'consensus_respond',
        args: {
          action: value.args.action as ConsensusRespondRequestPayload['args']['action'],
          payload: value.args.payload,
        },
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

    case 'submit_usage_stats':
      if (!isRecord(value.args) || typeof value.args.stats !== 'string' || typeof value.args.timestamp !== 'string') {
        return null;
      }

      return {
        id: value.id,
        call: 'submit_usage_stats',
        args: {
          stats: value.args.stats,
          timestamp: value.args.timestamp,
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

    case 'session_update': {
      if (!isAgentSessionStatus(value.sessionStatus)) {
        return null;
      }

      const payload: SessionUpdateEventPayload = {
        type: 'session_update',
        sessionStatus: value.sessionStatus,
      };

      if (isAgentExecutionMode(value.requestedExecutionMode)) {
        payload.requestedExecutionMode = value.requestedExecutionMode;
      }

      if (isResolvedExecutionMode(value.resolvedExecutionMode)) {
        payload.resolvedExecutionMode = value.resolvedExecutionMode;
      }

      return payload;
    }

    case 'message_received':
      if (typeof value.from !== 'string' || !('payload' in value)) {
        return null;
      }
      {
        const payload: MessageReceivedEventPayload = {
            type: 'message_received',
            from: value.from,
            payload: value.payload,
        };
        if (typeof value.messageId === 'string') {
          payload.messageId = value.messageId;
        }
        if (typeof value.replyToMessageId === 'string') {
          payload.replyToMessageId = value.replyToMessageId;
        }
        return payload;
      }

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
            ...(value.mode === 'planning' ? { mode: 'planning' as const } : {}),
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


    case 'fact_collection_begin':
      return typeof value.taskId === 'string' &&
        typeof value.description === 'string' &&
        Array.isArray(value.peerIds) &&
        value.peerIds.every((entry) => typeof entry === 'string')
        ? {
            type: 'fact_collection_begin',
            taskId: value.taskId,
            description: value.description,
            peerIds: value.peerIds,
          }
        : null;

    case 'custom_event_request':
      return typeof value.event === 'string' && value.event.trim().length > 0
        ? {
            type: 'custom_event_request',
            event: value.event.trim(),
            ...(isRecord(value.args) ? { args: value.args } : {}),
            ...(typeof value.prompt === 'string' ? { prompt: value.prompt } : {}),
          }
        : null;

    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAgentExecutionMode(value: unknown): value is AgentExecutionMode {
  // 'interactive' accepted as a deprecated alias for 'persistent'.
  return value === 'persistent' || value === 'interactive' || value === 'one_shot' || value === 'auto';
}

function isResolvedExecutionMode(value: unknown): value is ResolvedExecutionMode {
  // 'interactive' accepted as a deprecated alias for 'persistent'.
  return value === 'persistent' || value === 'interactive' || value === 'one_shot';
}

function isAgentSessionStatus(value: unknown): value is AgentSessionStatus {
  return value === 'starting' || value === 'ready' || value === 'busy' || value === 'restarting' || value === 'error';
}
