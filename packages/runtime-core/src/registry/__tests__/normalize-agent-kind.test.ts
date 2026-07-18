import { describe, it, expect } from 'vitest';
import { normalizeAgentKind, GEMINI_FACT_COLLECTION_TIMEOUT_MS } from '@agenttalk/contracts/types';

// BL-024 T1 — the pure transport↔vendor↔legacy mapping is the single source of truth for the
// split, consumed by both the API/registry ingest and (later) the client. This is the IP-15
// discriminating test: if the mapping is wrong, it fails; a mis-map cannot pass silently.
//
// NOTE: normalizeAgentKind lives in @agenttalk/contracts, but the vitest `include` does not cover
// the contracts package — so this unit test lives in runtime-core (which is included) and imports
// the function across the package boundary. (Follow-up: add contracts to the vitest include.)
describe('normalizeAgentKind (BL-024 T1)', () => {
  describe('legacy `provider` → split axes', () => {
    it("'api' → in-process, no vendor, no caps", () => {
      expect(normalizeAgentKind({ provider: 'api' })).toEqual({
        transport: 'in-process',
        legacyProvider: 'api',
        providerName: undefined,
      });
    });

    it("'mcp' → attached, no vendor (opaque attach)", () => {
      expect(normalizeAgentKind({ provider: 'mcp' })).toEqual({
        transport: 'attached',
        legacyProvider: 'mcp',
        providerName: undefined,
      });
    });

    it("'gemini' → attached + vendor gemini + the fact-collection capability", () => {
      expect(normalizeAgentKind({ provider: 'gemini' })).toEqual({
        transport: 'attached',
        vendor: 'gemini',
        capabilities: { factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS },
        legacyProvider: 'gemini',
        providerName: undefined,
      });
    });

    it("'claude' → attached + vendor claude, NO caps", () => {
      expect(normalizeAgentKind({ provider: 'claude' })).toEqual({
        transport: 'attached',
        vendor: 'claude',
        legacyProvider: 'claude',
        providerName: undefined,
      });
    });

    it("'codex' → attached + vendor codex, NO caps", () => {
      expect(normalizeAgentKind({ provider: 'codex' })).toEqual({
        transport: 'attached',
        vendor: 'codex',
        legacyProvider: 'codex',
        providerName: undefined,
      });
    });
  });

  describe('new `{transport, vendor}` → legacy derived (reverse map)', () => {
    it('in-process → legacyProvider api', () => {
      expect(normalizeAgentKind({ transport: 'in-process' })).toMatchObject({
        transport: 'in-process',
        legacyProvider: 'api',
      });
    });

    it('attached + vendor gemini → legacyProvider gemini + caps', () => {
      expect(normalizeAgentKind({ transport: 'attached', vendor: 'gemini' })).toMatchObject({
        transport: 'attached',
        vendor: 'gemini',
        capabilities: { factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS },
        legacyProvider: 'gemini',
      });
    });

    it('attached, no vendor → legacyProvider mcp (opaque attach)', () => {
      const k = normalizeAgentKind({ transport: 'attached' });
      expect(k).toMatchObject({ transport: 'attached', legacyProvider: 'mcp' });
      expect(k.vendor).toBeUndefined();
    });

    it('attached + vendor claude → legacyProvider claude, no caps', () => {
      const k = normalizeAgentKind({ transport: 'attached', vendor: 'claude' });
      expect(k).toMatchObject({ transport: 'attached', vendor: 'claude', legacyProvider: 'claude' });
      expect(k.capabilities).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('empty input → passthrough (provider-less preserved; no transport forced)', () => {
      expect(normalizeAgentKind({})).toEqual({ providerName: undefined });
    });

    it('carries providerName through', () => {
      expect(normalizeAgentKind({ provider: 'api', providerName: 'openrouter' })).toMatchObject({
        transport: 'in-process',
        legacyProvider: 'api',
        providerName: 'openrouter',
      });
    });

    it('a given transport wins over a given legacy provider', () => {
      expect(normalizeAgentKind({ provider: 'api', transport: 'attached', vendor: 'codex' })).toMatchObject({
        transport: 'attached',
        vendor: 'codex',
        legacyProvider: 'codex',
      });
    });
  });

  // BL-024 T2 — the gap the frozen engine used to cover with `agent.providerName === 'gemini'`:
  // a `provider:'mcp'` agent whose providerName is gemini must still carry the fact-collection
  // capability, or T2 would silently drop its 720s timeout. The capability is present iff the agent
  // would have triggered the old bump — i.e. vendor gemini OR providerName gemini.
  describe("providerName:'gemini' gap (T2 byte-identical closure)", () => {
    it("provider:'mcp' + providerName:'gemini' → caps set, vendor/legacyProvider UNCHANGED", () => {
      const k = normalizeAgentKind({ provider: 'mcp', providerName: 'gemini' });
      expect(k).toEqual({
        transport: 'attached',
        legacyProvider: 'mcp',
        providerName: 'gemini',
        capabilities: { factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS },
      });
      expect(k.vendor).toBeUndefined();
    });

    it("attached transport + providerName:'gemini' (no vendor) → caps set", () => {
      expect(normalizeAgentKind({ transport: 'attached', providerName: 'gemini' })).toMatchObject({
        transport: 'attached',
        legacyProvider: 'mcp',
        capabilities: { factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS },
      });
    });

    it("provider:'mcp' WITHOUT gemini providerName → NO caps (discriminator)", () => {
      expect(normalizeAgentKind({ provider: 'mcp', providerName: 'claude' }).capabilities).toBeUndefined();
      expect(normalizeAgentKind({ provider: 'mcp' }).capabilities).toBeUndefined();
    });

    it("provider:'gemini' still carries caps once (post-step does not duplicate/override)", () => {
      expect(normalizeAgentKind({ provider: 'gemini', providerName: 'gemini' }).capabilities).toEqual({
        factCollectionTimeoutMs: GEMINI_FACT_COLLECTION_TIMEOUT_MS,
      });
    });
  });
});
