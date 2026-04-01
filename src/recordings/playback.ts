import { readFileSync } from 'fs';
import type { Conversation, Team, TeamTask } from '../shared/types.js';
import type { PlaybackAgentState, PlaybackState, SessionRecording, SessionRecordingEvent, SessionRecordingLine, SessionRecordingMeta } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSessionRecordingLine(raw: string, lineNumber: number): SessionRecordingLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid recording JSON on line ${lineNumber}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid recording line ${lineNumber}: expected object`);
  }

  const value = parsed as Record<string, unknown>;
  if (value.kind === 'meta') {
    if (value.version !== 1 || typeof value.createdAt !== 'string' || typeof value.cwd !== 'string') {
      throw new Error(`Invalid recording meta on line ${lineNumber}`);
    }

    return {
      kind: 'meta',
      version: 1,
      createdAt: value.createdAt,
      cwd: value.cwd,
    };
  }

  if (value.kind === 'event') {
    if (typeof value.atMs !== 'number' || typeof value.channel !== 'string' || typeof value.event !== 'string') {
      throw new Error(`Invalid recording event on line ${lineNumber}`);
    }

    return {
      kind: 'event',
      atMs: value.atMs,
      channel: value.channel as SessionRecordingEvent['channel'],
      event: value.event,
      payload: value.payload,
    };
  }

  throw new Error(`Unknown recording line kind on line ${lineNumber}`);
}

export function loadSessionRecording(filePath: string): SessionRecording {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`Recording file is empty: ${filePath}`);
  }

  const parsed = lines.map((line, index) => parseSessionRecordingLine(line, index + 1));
  const meta = parsed[0];
  if (!meta || meta.kind !== 'meta') {
    throw new Error(`Recording file must start with a meta line: ${filePath}`);
  }

  return {
    meta,
    events: parsed.slice(1).filter((line): line is SessionRecordingEvent => line.kind === 'event'),
  };
}

function ensureAgent(map: Map<string, PlaybackAgentState>, id: string): PlaybackAgentState {
  const existing = map.get(id);
  if (existing) {
    return existing;
  }

  const created: PlaybackAgentState = {
    id,
    outputs: [],
    agentMessages: [],
  };
  map.set(id, created);
  return created;
}

function applyEvent(state: {
  agents: Map<string, PlaybackAgentState>;
  conversations: Map<string, Conversation>;
  teams: Map<string, Team>;
  teamTasks: Map<string, TeamTask>;
  processedEvents: number;
}, event: SessionRecordingEvent): void {
  state.processedEvents += 1;
  if (event.channel !== 'runtime' || !event.payload || typeof event.payload !== 'object') {
    return;
  }

  const payload = event.payload as Record<string, unknown>;

  switch (event.event) {
    case 'agent_created': {
      if (typeof payload.id === 'string') {
        ensureAgent(state.agents, payload.id);
      }
      return;
    }
    case 'status': {
      if (typeof payload.id === 'string' && typeof payload.status === 'string') {
        ensureAgent(state.agents, payload.id).status = payload.status;
      }
      return;
    }
    case 'session_status': {
      if (typeof payload.id === 'string' && typeof payload.sessionStatus === 'string') {
        ensureAgent(state.agents, payload.id).sessionStatus = payload.sessionStatus;
      }
      return;
    }
    case 'provider': {
      if (typeof payload.id === 'string' && typeof payload.provider === 'string') {
        ensureAgent(state.agents, payload.id).provider = payload.provider;
      }
      return;
    }
    case 'model': {
      if (typeof payload.id === 'string' && typeof payload.model === 'string') {
        ensureAgent(state.agents, payload.id).model = payload.model;
      }
      return;
    }
    case 'execution_mode': {
      if (typeof payload.id === 'string') {
        const agent = ensureAgent(state.agents, payload.id);
        if (typeof payload.requestedExecutionMode === 'string') {
          agent.requestedExecutionMode = payload.requestedExecutionMode;
        }
        if (typeof payload.resolvedExecutionMode === 'string') {
          agent.resolvedExecutionMode = payload.resolvedExecutionMode;
        }
      }
      return;
    }
    case 'output': {
      if (typeof payload.id === 'string' && typeof payload.text === 'string') {
        ensureAgent(state.agents, payload.id).outputs.push(payload.text);
      }
      return;
    }
    case 'agent_message': {
      if (typeof payload.from === 'string' && typeof payload.payload === 'string') {
        ensureAgent(state.agents, payload.from).agentMessages.push(payload.payload);
      }
      return;
    }
    case 'conversation': {
      const conversation = payload.conversation;
      if (conversation && typeof conversation === 'object' && typeof (conversation as Record<string, unknown>).id === 'string') {
        state.conversations.set((conversation as Record<string, unknown>).id as string, conversation as Conversation);
      }
      return;
    }
    case 'team_updated': {
      const team = payload.team;
      if (team && typeof team === 'object' && typeof (team as Record<string, unknown>).id === 'string') {
        state.teams.set((team as Record<string, unknown>).id as string, team as Team);
      }
      return;
    }
    case 'team_task_updated': {
      const task = payload.task;
      if (task && typeof task === 'object' && typeof (task as Record<string, unknown>).id === 'string') {
        state.teamTasks.set((task as Record<string, unknown>).id as string, task as TeamTask);
      }
      return;
    }
    default:
      return;
  }
}

export async function playSessionRecording(
  recording: SessionRecording,
  options: {
    respectTiming?: boolean;
    onEvent?: (event: SessionRecordingEvent) => void | Promise<void>;
  } = {},
): Promise<PlaybackState> {
  const state = {
    agents: new Map<string, PlaybackAgentState>(),
    conversations: new Map<string, Conversation>(),
    teams: new Map<string, Team>(),
    teamTasks: new Map<string, TeamTask>(),
    processedEvents: 0,
  };

  let previousAtMs = 0;
  for (const event of recording.events) {
    if (options.respectTiming) {
      await sleep(Math.max(0, event.atMs - previousAtMs));
    }
    previousAtMs = event.atMs;

    await options.onEvent?.(event);
    applyEvent(state, event);
  }

  return {
    agents: Array.from(state.agents.values()).sort((a, b) => a.id.localeCompare(b.id)),
    conversations: Array.from(state.conversations.values()).sort((a, b) => a.id.localeCompare(b.id)),
    teams: Array.from(state.teams.values()).sort((a, b) => a.id.localeCompare(b.id)),
    teamTasks: Array.from(state.teamTasks.values()).sort((a, b) => a.id.localeCompare(b.id)),
    processedEvents: state.processedEvents,
  };
}

export async function playSessionRecordingFromFile(
  filePath: string,
  options: Parameters<typeof playSessionRecording>[1] = {},
): Promise<{ recording: SessionRecording; state: PlaybackState }> {
  const recording = loadSessionRecording(filePath);
  const state = await playSessionRecording(recording, options);
  return { recording, state };
}
