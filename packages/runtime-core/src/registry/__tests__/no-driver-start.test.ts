import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

// M08-T4 (hygiene, absorbed IP-4): pin the no-driver rejection.
// A provider-less agent must fail to start with a clean, CATCHABLE error — never a silent
// success and never a process crash. `activateAgent` is what `POST /api/agents/:id/start`
// calls inside a try/catch; a thrown error there becomes an HTTP error status (500 via
// getErrorStatus), so pinning the throw here pins the route's "not 200, not a crash" contract.
describe('M08-T4 no-driver agent start', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('rejects activating a provider-less agent with a typed error (not a silent success, not a crash)', async () => {
    const agent = await registry.createAgent('no-driver-agent', {}); // no provider
    expect(agent.provider).toBeUndefined();

    // A rejection that resolves here = the error is catchable (the route catches it → HTTP 500),
    // i.e. NOT a silent success and NOT an uncaught crash.
    await expect(registry.activateAgent('no-driver-agent')).rejects.toThrow(/no longer supported/);
  });
});
