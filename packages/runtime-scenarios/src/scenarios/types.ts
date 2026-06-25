import type { AgentExecutionMode, AgentProvider, TeamRole } from '@agenttalk/contracts/types';

export interface ScenarioAgentDefinition {
  id: string;
  provider: AgentProvider;
  model: string;
  executionMode?: AgentExecutionMode;
}

export interface ScenarioConversation {
  agentIds: string[];
  topic: string;
  maxRepliesPerAgent: number;
}

export interface ScenarioTeamMember {
  agentId: string;
  role: TeamRole;
}

export interface ScenarioTaskDefinition {
  description: string;
}

export interface ScenarioTeamDefinition {
  members: ScenarioTeamMember[];
  tasks: ScenarioTaskDefinition[];
}

export interface ScenarioDefinition {
  name: string;
  description?: string;
  agents: ScenarioAgentDefinition[];
  conversations?: ScenarioConversation[];
  teams?: ScenarioTeamDefinition[];
}

export type ScenarioStatus =
  | 'creating_agents'
  | 'starting_agents'
  | 'waiting_ready'
  | 'executing'
  | 'completed'
  | 'partially_completed'
  | 'error';

export interface ScenarioResult {
  scenarioName: string;
  status: ScenarioStatus;
  error?: string;
  agentIds: string[];
  conversationIds: string[];
  teamIds: string[];
}
