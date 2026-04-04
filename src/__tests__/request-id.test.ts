import { describe, expect, it } from 'vitest';
import { createRequestIdGenerator } from '../../scripts/lib/request-id.mjs';

describe('request-id generator', () => {
  it('generates unique IDs even when time source is constant', () => {
    const nextId = createRequestIdGenerator({ now: () => 1775331015040 });

    const first = nextId();
    const second = nextId();
    const third = nextId();

    expect(first).toBe('req-1775331015040-1');
    expect(second).toBe('req-1775331015040-2');
    expect(third).toBe('req-1775331015040-3');
    expect(new Set([first, second, third]).size).toBe(3);
  });
});
