import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { HostEnvironment } from '@agenttalk/contracts/types';

describe('BL-071 P2 — report_environment tool', () => {
  let registry: Registry;

  const sampleEnv: HostEnvironment = {
    platform: 'linux',
    arch: 'arm64',
    osRelease: '6.1.0',
    nodeVersion: 'v22.3.0',
    hostname: 'worker-box',
    cpuCount: 4,
    totalMemBytes: 8_589_934_592,
    capturedAt: '2026-07-18T10:00:00.000Z',
  };

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('stores the reported host on the agent record and returns success', async () => {
    const agent = await registry.createAgent('agent-1', { provider: 'mcp' });
    await registry.activateAgent(agent.id);
    expect(agent.host).toBeUndefined();

    const response = await registry.handleMcpToolCall('agent-1', 'report_environment', {
      environment: sampleEnv,
    });

    expect(response.content[0].text).toBe('Environment reported successfully');
    expect(registry.getAgent('agent-1').host).toEqual(sampleEnv);
  });

  it('emits agent_environment when an agent reports', async () => {
    const agent = await registry.createAgent('agent-1', { provider: 'mcp' });
    await registry.activateAgent(agent.id);

    const seen: Array<{ id: string; host: HostEnvironment }> = [];
    registry.on('agent_environment', (e: { id: string; host: HostEnvironment }) => seen.push(e));

    await registry.handleMcpToolCall('agent-1', 'report_environment', { environment: sampleEnv });

    expect(seen).toEqual([{ id: 'agent-1', host: sampleEnv }]);
  });
});
