import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { GEMINI_FACT_COLLECTION_TIMEOUT_MS } from '@agenttalk/contracts/types';

// BL-024 T1 — the registry edge must populate the split axes (transport/vendor/capabilities)
// while keeping the legacy `provider`/`providerName` set, so the (frozen) engine is unchanged.
// createAgent and activateAgent share normalizeAgentKind; this pins the wiring at both.
describe('BL-024 T1 — registry populates transport/vendor alongside legacy provider', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('createAgent(legacy gemini) sets both axes + capabilities, keeps legacy provider', async () => {
    const agent = await registry.createAgent('a-gemini', { provider: 'gemini' });
    expect(agent.provider).toBe('gemini'); // legacy still populated for the frozen engine
    expect(agent.transport).toBe('attached');
    expect(agent.vendor).toBe('gemini');
    expect(agent.capabilities).toEqual({ factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS });
  });

  it('createAgent(legacy api) → in-process, no vendor, no caps', async () => {
    const agent = await registry.createAgent('a-api', { provider: 'api', providerName: 'openrouter' });
    expect(agent.provider).toBe('api');
    expect(agent.transport).toBe('in-process');
    expect(agent.vendor).toBeUndefined();
    expect(agent.capabilities).toBeUndefined();
    expect(agent.providerName).toBe('openrouter');
  });

  it('createAgent(new shape {transport, vendor}) derives the legacy provider', async () => {
    const agent = await registry.createAgent('a-new', { transport: 'attached', vendor: 'claude' });
    expect(agent.transport).toBe('attached');
    expect(agent.vendor).toBe('claude');
    expect(agent.provider).toBe('claude'); // legacy derived so the engine keeps working
  });

  it('activateAgent derives transport from the resolved provider (the driver-selection path)', async () => {
    // Model after mcp-noresend: create an attached agent, activate it, assert transport is set.
    const agent = await registry.createAgent('a-mcp', { provider: 'mcp', providerName: 'gemini' });
    await registry.activateAgent(agent.id);
    expect(agent.transport).toBe('attached');
    expect(agent.provider).toBe('mcp'); // legacy preserved
  });

  it('provider-less agent still has no transport and still throws on start (unchanged)', async () => {
    const agent = await registry.createAgent('a-none', {});
    expect(agent.transport).toBeUndefined();
    expect(agent.provider).toBeUndefined();
    await expect(registry.activateAgent('a-none')).rejects.toThrow(/no longer supported/);
  });
});
