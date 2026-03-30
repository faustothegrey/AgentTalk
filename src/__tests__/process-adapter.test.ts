import { afterEach, describe, expect, it } from 'vitest';
import { ProcessAdapterImpl } from '../process-adapter.js';

describe('ProcessAdapterImpl', () => {
  const adapter = new ProcessAdapterImpl();

  afterEach(() => {
    adapter.destroyAll();
  });

  it('should allow restarting the same id after the process exits', async () => {
    const waitForExit = () =>
      new Promise<number | null>((resolve) => {
        const handler = (id: string, code: number | null) => {
          if (id !== 'agent-1') return;
          adapter.off('exit', handler);
          resolve(code);
        };
        adapter.on('exit', handler);
      });

    adapter.spawn('agent-1', `node -e "setTimeout(() => process.exit(0), 10)"`);
    await expect(waitForExit()).resolves.toBe(0);

    expect(() => adapter.spawn('agent-1', `node -e "process.exit(0)"`)).not.toThrow();
  });
});
