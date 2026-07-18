import os from 'node:os';
import type { HostEnvironment } from '@agenttalk/contracts/types';

export interface CaptureHostEnvironmentOptions {
  /** Injectable clock for `capturedAt` (testability). Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * BL-071 — capture a small, stable snapshot of the host THIS process runs on.
 *
 * This is ground truth the process observes about itself via node's `os`/`process`;
 * it is not a claim and cannot be spoofed to the caller, so no trust model applies
 * (that is BL-072's concern). Pure aside from reading `os`/`process` and the clock,
 * both of which are injectable where it matters for tests.
 */
export function captureHostEnvironment(
  options: CaptureHostEnvironmentOptions = {},
): HostEnvironment {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  return {
    platform: os.platform(),
    arch: os.arch(),
    osRelease: os.release(),
    nodeVersion: process.version,
    hostname: os.hostname(),
    cpuCount: os.cpus().length,
    totalMemBytes: os.totalmem(),
    capturedAt: new Date(now()).toISOString(),
  };
}
