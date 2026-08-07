// BL-084 T2 — the bars from `design/bl084-t2-plan.md` §5 that no existing test covered.
//
// B1 (a fault-class driver error propagates) and B2 (parity for every non-fault reason) are
// already carried by the rewritten pinning tests and by bl084-error-reason's table. What was
// missing is the decision this task actually turns on:
//
//   B3 — an error carrying NO reason of its own must NOT propagate.
//
// The in-process error site is a catch-all, so it cannot know its cause. Before T2 that path
// propagated nothing at all; defaulting its surprises to `fault` would have turned every
// unanticipated throw into a team-wide kill. So an unlabelled throw is classified explicitly as
// `driver-error-unclassified` (non-fault), which makes T2 strictly additive: propagation switches
// on only where a fault was positively identified.
//
// ⚠️ The two "unknowns" point OPPOSITE WAYS on purpose, and this file pins both:
//   · isFaultClass(undefined)             -> TRUE   (guards call sites not yet migrated)
//   · 'driver-error-unclassified'         -> FALSE  (a migrated site that cannot know its cause)
// Both rules say the same thing from different directions: a surprise never changes what happens.

import { describe, it, expect } from 'vitest';
import { isFaultClass } from '../registry.js';
import { AgentReasonedError, reasonOf } from '@agenttalk/contracts/types';

describe('BL-084 T2 — B3: an unlabelled error is non-fault', () => {
  it('reasonOf() yields the explicit unclassified reason for a bare Error', () => {
    expect(reasonOf(new Error('anything at all'))).toBe('driver-error-unclassified');
  });

  it('…and for a non-Error throw, which a catch-all can also receive', () => {
    expect(reasonOf('a string')).toBe('driver-error-unclassified');
    expect(reasonOf(undefined)).toBe('driver-error-unclassified');
    expect(reasonOf(null)).toBe('driver-error-unclassified');
  });

  // THE BAR. Flip this row to `true` in FAULT_CLASS_BY_REASON and every unanticipated throw on
  // the in-process path starts killing teams.
  it('driver-error-unclassified does NOT propagate', () => {
    expect(isFaultClass('driver-error-unclassified')).toBe(false);
  });

  // The other unknown, pointing the other way — T1's guard, which T2 must not disturb.
  it('an ABSENT reason still propagates — un-migrated call sites keep today\'s behaviour', () => {
    expect(isFaultClass(undefined)).toBe(true);
  });

  it('a carried reason survives the round trip and is what gets classified', () => {
    const err = new AgentReasonedError('conversation-start-failed', 'runtime refused');
    expect(reasonOf(err)).toBe('conversation-start-failed');
    expect(isFaultClass(reasonOf(err))).toBe(true);
    expect(err).toBeInstanceOf(Error);       // still catchable as an ordinary Error
    expect(err.message).toBe('runtime refused');
  });
});

describe('BL-084 T2 — B5: the attached path is untouched', () => {
  // T2's whole claim is that it changes the IN-PROCESS path only. The attached transport's
  // propagating set must be identical before and after, so it is pinned here by name rather
  // than left to a general regression.
  it('every attached-transport fault reason still propagates', () => {
    for (const reason of ['mcp-internal-error', 'reconnect-timeout-inflight-turn'] as const) {
      expect(isFaultClass(reason)).toBe(true);
    }
  });

  it('every non-fault reason still does not — B2 restated as a guard against a careless table edit', () => {
    for (const reason of [
      'unknown-mcp-tool',
      'conversation-reply-cap',
      'relay-budget-exhausted',
      'target-agent-unavailable',
      'workflow-gate-refusal',
      'planning-task-inactive',
      'healthcheck-token-invalid',
      'driver-error-unclassified',
    ] as const) {
      expect(isFaultClass(reason)).toBe(false);
    }
  });

  // BL-028/T3 territory. types.ts says in terms: "Do NOT flip it here."
  it('idle-timeout is STILL fault-class — T2 must not touch BL-028\'s row', () => {
    expect(isFaultClass('idle-timeout')).toBe(true);
  });
});
