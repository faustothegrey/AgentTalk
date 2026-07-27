import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORKER_TURN_TIMEOUT_MS,
  resolveWorkerTurnTimeoutMs,
} from '../in-process-driver.js';

/**
 * Rung-6 prep. The worker's per-turn deadline was a hardcoded 600s. Rung 5 finished at ~10
 * minutes — i.e. AT the cap — so a larger autonomous task would be killed mid-turn and read as a
 * stalled worker. Made configurable, with the default deliberately unchanged.
 *
 * The bad-value cases are the point: a malformed override must NOT remove the deadline. An
 * unbounded worker turn would defeat the only anti-hang rail that exists while BL-028 is dead.
 */
describe('resolveWorkerTurnTimeoutMs', () => {
  it('defaults to 600s when the env var is absent — behaviour unchanged', () => {
    expect(resolveWorkerTurnTimeoutMs({})).toBe(600_000);
    expect(DEFAULT_WORKER_TURN_TIMEOUT_MS).toBe(600_000);
  });

  it('honours a valid override', () => {
    expect(resolveWorkerTurnTimeoutMs({ AGENTTALK_WORKER_TURN_TIMEOUT_MS: '1800000' })).toBe(1_800_000);
  });

  it('floors a fractional override', () => {
    expect(resolveWorkerTurnTimeoutMs({ AGENTTALK_WORKER_TURN_TIMEOUT_MS: '1500.9' })).toBe(1500);
  });

  it('falls back to the default for every malformed value — never unbounded', () => {
    for (const bad of ['', '0', '-1', 'abc', 'Infinity', 'NaN']) {
      expect(resolveWorkerTurnTimeoutMs({ AGENTTALK_WORKER_TURN_TIMEOUT_MS: bad })).toBe(
        DEFAULT_WORKER_TURN_TIMEOUT_MS,
      );
    }
  });
});
