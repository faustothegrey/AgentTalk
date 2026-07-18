import os from 'node:os';
import { describe, it, expect } from 'vitest';
import { captureHostEnvironment } from './environment.js';

describe('captureHostEnvironment (BL-071)', () => {
  it('returns the full HostEnvironment shape with correct types', () => {
    const env = captureHostEnvironment();

    // A process observing its own host: values must match a fresh os/process read.
    expect(env.platform).toBe(os.platform());
    expect(env.arch).toBe(os.arch());
    expect(env.osRelease).toBe(os.release());
    expect(env.nodeVersion).toBe(process.version);
    expect(env.hostname).toBe(os.hostname());

    expect(typeof env.cpuCount).toBe('number');
    expect(Number.isInteger(env.cpuCount)).toBe(true);
    expect(env.cpuCount).toBeGreaterThan(0);

    expect(typeof env.totalMemBytes).toBe('number');
    expect(env.totalMemBytes).toBeGreaterThan(0);

    // Exactly the agreed keys — guards against an accidental process.env / PATH dump.
    expect(Object.keys(env).sort()).toEqual(
      ['arch', 'capturedAt', 'cpuCount', 'hostname', 'nodeVersion', 'osRelease', 'platform', 'totalMemBytes'].sort(),
    );
  });

  it('stamps capturedAt from the injected clock (deterministic)', () => {
    const fixed = Date.parse('2026-07-18T10:30:00.000Z');
    const env = captureHostEnvironment({ now: () => fixed });
    expect(env.capturedAt).toBe('2026-07-18T10:30:00.000Z');
  });

  it('defaults capturedAt to a valid ISO timestamp near now', () => {
    const before = Date.now();
    const env = captureHostEnvironment();
    const after = Date.now();
    const t = Date.parse(env.capturedAt);
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});
