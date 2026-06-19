import { describe, expect, it, vi, afterEach } from 'vitest';
import { HealthcheckManager } from '@agenttalk/runtime-core/agents/healthcheck-manager';

describe('HealthcheckManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a pending healthcheck for the correct token/agent', async () => {
    const manager = new HealthcheckManager();
    const { token, result } = manager.create('agent-a', 1000);

    expect(manager.resolve(token, 'agent-a', 'ok')).toBe(true);
    await expect(result).resolves.toEqual({ agentId: 'agent-a', message: 'ok' });
  });

  it('rejects resolution for a different agent', async () => {
    vi.useFakeTimers();
    const manager = new HealthcheckManager();
    const { token, result } = manager.create('agent-a', 100);
    result.catch(() => {});

    expect(manager.resolve(token, 'agent-b', 'wrong')).toBe(false);
    await vi.advanceTimersByTimeAsync(110);
    await expect(result).rejects.toThrow('did not respond to healthcheck');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const manager = new HealthcheckManager();
    const { result } = manager.create('agent-a', 100);
    result.catch(() => {});

    await vi.advanceTimersByTimeAsync(101);
    await expect(result).rejects.toThrow('Agent agent-a did not respond to healthcheck within 100ms');
  });

  it('rejects all pending checks when destroyed', async () => {
    const manager = new HealthcheckManager();
    const one = manager.create('agent-a', 1000);
    const two = manager.create('agent-b', 1000);

    manager.destroy('shutdown');
    await expect(one.result).rejects.toThrow('shutdown');
    await expect(two.result).rejects.toThrow('shutdown');
  });
});
