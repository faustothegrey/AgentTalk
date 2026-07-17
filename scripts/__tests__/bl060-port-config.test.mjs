import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// BL-060: `PORT` used to be a knob that turned and did nothing. The orchestrator
// honoured it while apps/web/vite.config.ts hardcoded 3000, so moving the
// backend silently left the UI talking to the old port.
//
// The seam is the vite config itself — the half that was actually broken. It
// reads process.env.PORT at MODULE LOAD, so each case must re-import it with a
// reset module registry; importing once and mutating env afterwards would prove
// nothing. apps/web/** is excluded from vitest (LB-93), hence this lives here.
async function loadViteConfig(port) {
  vi.resetModules();
  const prev = process.env.PORT;
  if (port === undefined) delete process.env.PORT;
  else process.env.PORT = port;
  try {
    const mod = await import('../../apps/web/vite.config.ts');
    const cfg = typeof mod.default === 'function' ? mod.default({}) : mod.default;
    return cfg;
  } finally {
    if (prev === undefined) delete process.env.PORT;
    else process.env.PORT = prev;
  }
}

describe('BL-060 port configuration', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.resetModules());

  it('vite proxies /api and /ws to the port given by PORT', async () => {
    const cfg = await loadViteConfig('9999');
    expect(cfg.server.proxy['/api']).toContain(':9999');
    expect(cfg.server.proxy['/ws'].target).toContain(':9999');
  });

  it('a moved PORT does not leave either half behind on the old port', async () => {
    const cfg = await loadViteConfig('9999');
    // The BL-060 defect exactly: the backend moves, the proxy stays on 3000.
    expect(cfg.server.proxy['/api']).not.toContain(':3000');
    expect(cfg.server.proxy['/ws'].target).not.toContain(':3000');
  });

  it('defaults off 3000 — the most contended port in JS dev, and DiagramTalk\'s here', async () => {
    const cfg = await loadViteConfig(undefined);
    expect(cfg.server.proxy['/api']).not.toContain(':3000');
    expect(cfg.server.proxy['/api']).toContain(':3100');
    expect(cfg.server.proxy['/ws'].target).toContain(':3100');
  });

  it('the orchestrator default and the vite default are the same number', () => {
    // The orchestrator's default lives inside main() and cannot be imported
    // without starting a server, so this reads the source rather than executing
    // it. That is weaker than the bars above and is here for one reason: the two
    // halves silently disagreeing IS the BL-060 defect, so drift between them
    // must not be able to land quietly.
    const orchestratorSrc = fs.readFileSync(
      path.join(repoRoot, 'apps/orchestrator/src/index.ts'),
      'utf-8'
    );
    const viteSrc = fs.readFileSync(
      path.join(repoRoot, 'apps/web/vite.config.ts'),
      'utf-8'
    );

    const orchestratorDefault = orchestratorSrc.match(/Number\(process\.env\.PORT\)\s*\|\|\s*(\d+)/)?.[1];
    const viteDefault = viteSrc.match(/process\.env\.PORT\s*\?\?\s*'(\d+)'/)?.[1];

    expect(orchestratorDefault).toBeDefined();
    expect(viteDefault).toBeDefined();
    expect(orchestratorDefault).toBe(viteDefault);
    expect(orchestratorDefault).not.toBe('3000');
  });
});
