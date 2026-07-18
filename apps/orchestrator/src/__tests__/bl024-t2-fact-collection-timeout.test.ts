import { describe, expect, it, vi } from 'vitest';
import { TeamCoordinator } from '@agenttalk/runtime-core/registry/team-coordinator';
import { Agent } from '@agenttalk/runtime-core/agents/agent';
import { normalizeAgentKind, GEMINI_FACT_COLLECTION_TIMEOUT_MS } from '@agenttalk/contracts/types';
import type { AgentProvider, Team } from '@agenttalk/contracts/types';

/**
 * BL-024 T2 — the frozen-engine slice. `getFactCollectionTimeoutMs` is now vendor-blind: it reads
 * ONLY `capabilities.factCollectionTimeoutMs` (team + members), never a `provider`/`providerName`
 * vendor name. This test pins the exact computed timeout for every configuration that used to bump
 * on master, plus the default — and is the IP-15 discriminator: strip the capability the edge
 * injects and the gemini cases collapse to the default, so a reverted edge FAILS here.
 *
 * The function output is used verbatim as the fact-collection `setTimeout` delay
 * (team-coordinator.ts, handlePlanningProtocolAck), so asserting the function IS asserting the
 * scheduled timeout.
 */

// Mirrors the (non-exported) engine default DEFAULT_FACT_COLLECTION_TIMEOUT_MS.
const DEFAULT_MS = 480_000;

// Build an Agent whose capabilities come from the REAL edge (normalizeAgentKind) — the same path
// registry.createAgent uses to populate the record.
const agentFrom = (id: string, provider?: AgentProvider, providerName?: string): Agent => {
  const agent = new Agent(id);
  if (provider) agent.provider = provider;
  if (providerName) agent.providerName = providerName;
  const caps = normalizeAgentKind({ provider, providerName }).capabilities;
  if (caps) agent.capabilities = caps;
  return agent;
};

// Minimal coordinator wired to a getAgent over a fixed roster; call the private timeout calc directly.
const timeoutFor = (team: Team, agents: Record<string, Agent>): number => {
  const coordinator = new TeamCoordinator({
    getAgent: (id: string) => {
      const a = agents[id];
      if (!a) throw new Error(`Unknown agent: ${id}`);
      return a;
    },
    sendProtocol: vi.fn().mockResolvedValue(undefined),
    emitTeam: vi.fn(),
    emitTeamTask: vi.fn(),
    emitPlanningComplete: vi.fn(),
    logError: vi.fn(),
  } as never, { planningRunsDir: '' });
  return (
    coordinator as unknown as { getFactCollectionTimeoutMs(t: Team): number }
  ).getFactCollectionTimeoutMs(team);
};

// Mirror registry.createTeam's team-capability population (the wrapper line under test).
const teamWith = (members: { agentId: string; role: 'planner' | 'worker' }[], provider?: AgentProvider): Team => {
  const team: Team = {
    id: 'team-t2',
    composition: 'planner-worker',
    provider,
    members,
    status: 'idle',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
  const caps = normalizeAgentKind({ provider }).capabilities;
  if (caps) team.capabilities = caps;
  return team;
};

describe('BL-024 T2 — getFactCollectionTimeoutMs is vendor-blind & byte-identical', () => {
  it('default: no gemini anywhere → 480_000', () => {
    const agents = { worker: agentFrom('worker', 'mcp'), planner: agentFrom('planner', 'claude') };
    const team = teamWith([
      { agentId: 'planner', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);
    expect(timeoutFor(team, agents)).toBe(DEFAULT_MS);
  });

  it("BL-024 T3b: a goose member gets the DEFAULT (goose has no capability, not the gemini bump)", () => {
    const agents = { g: agentFrom('g', 'goose'), worker: agentFrom('worker', 'mcp') };
    const team = teamWith([
      { agentId: 'g', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);
    expect(timeoutFor(team, agents)).toBe(DEFAULT_MS);
  });

  it("case (b): a member with provider:'gemini' → 720_000", () => {
    const agents = { g: agentFrom('g', 'gemini'), worker: agentFrom('worker', 'mcp') };
    const team = teamWith([
      { agentId: 'g', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);
    expect(timeoutFor(team, agents)).toBe(GEMINI_FACT_COLLECTION_TIMEOUT_MS);
  });

  it("case (c): a member with provider:'mcp' + providerName:'gemini' → 720_000 (the closed gap)", () => {
    const agents = { g: agentFrom('g', 'mcp', 'gemini'), worker: agentFrom('worker', 'mcp') };
    const team = teamWith([
      { agentId: 'g', role: 'planner' },
      { agentId: 'worker', role: 'worker' },
    ]);
    expect(timeoutFor(team, agents)).toBe(GEMINI_FACT_COLLECTION_TIMEOUT_MS);
  });

  it("case (a): team.provider:'gemini' with NON-gemini members → 720_000", () => {
    const agents = { worker: agentFrom('worker', 'mcp'), planner: agentFrom('planner', 'claude') };
    const team = teamWith(
      [
        { agentId: 'planner', role: 'planner' },
        { agentId: 'worker', role: 'worker' },
      ],
      'gemini',
    );
    expect(timeoutFor(team, agents)).toBe(GEMINI_FACT_COLLECTION_TIMEOUT_MS);
  });

  // IP-15 discriminator: the 720s must come SOLELY from the edge-injected capability. Strip it and
  // the engine — having no vendor branch left — falls back to the default. If someone re-added a
  // `provider === 'gemini'` sniff to the engine, these would wrongly stay at 720s and fail.
  describe('IP-15 discriminator: reverted edge injection collapses to default', () => {
    it('gemini member WITHOUT the capability → 480_000 (no residual vendor branch)', () => {
      const stripped = new Agent('g');
      stripped.provider = 'gemini';
      stripped.providerName = 'gemini';
      // capabilities intentionally NOT set — simulates the edge injection reverted.
      const agents = { g: stripped, worker: agentFrom('worker', 'mcp') };
      const team: Team = {
        id: 'team-t2',
        composition: 'planner-worker',
        provider: 'gemini', // team.provider also gemini, but with NO team.capabilities set
        members: [
          { agentId: 'g', role: 'planner' },
          { agentId: 'worker', role: 'worker' },
        ],
        status: 'idle',
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
      };
      expect(timeoutFor(team, agents)).toBe(DEFAULT_MS);
    });
  });
});
