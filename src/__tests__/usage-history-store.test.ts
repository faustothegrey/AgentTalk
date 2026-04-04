import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageHistoryStore } from '../usage-history/store.js';

const tempDirs: string[] = [];

function makePath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'agenttalk-usage-history-'));
  tempDirs.push(dir);
  return path.join(dir, 'usage.json');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('UsageHistoryStore', () => {
  it('adds and lists entries per provider in reverse timestamp order', () => {
    const filePath = makePath();
    const store = new UsageHistoryStore(filePath, 10);

    store.add({
      provider: 'gemini',
      timestamp: '2026-01-01T00:00:00.000Z',
      snapshot: { models: [{ model: 'g', usagePercent: '10%', resetInfo: 'soon' }] },
    });
    store.add({
      provider: 'gemini',
      timestamp: '2026-01-02T00:00:00.000Z',
      snapshot: { models: [{ model: 'g', usagePercent: '20%', resetInfo: 'later' }] },
    });
    store.add({
      provider: 'claude',
      timestamp: '2026-01-01T00:00:00.000Z',
      snapshot: {
        currentSession: { usagePercentUsed: '1%', resetInfo: 'x' },
        currentWeek: { usagePercentUsed: '2%', resetInfo: 'y' },
      },
    });

    const history = store.list(10);
    expect(history.gemini).toHaveLength(2);
    expect(history.gemini[0]?.timestamp).toBe('2026-01-02T00:00:00.000Z');
    expect(history.claude).toHaveLength(1);
    expect(history.codex).toHaveLength(0);
  });

  it('enforces max entries per provider', () => {
    const filePath = makePath();
    const store = new UsageHistoryStore(filePath, 2);

    store.add({
      provider: 'codex',
      timestamp: '2026-01-01T00:00:00.000Z',
      snapshot: {
        fiveHour: { usagePercentLeft: '90%', resetInfo: 'a' },
        weekly: { usagePercentLeft: '80%', resetInfo: 'b' },
      },
    });
    store.add({
      provider: 'codex',
      timestamp: '2026-01-02T00:00:00.000Z',
      snapshot: {
        fiveHour: { usagePercentLeft: '70%', resetInfo: 'a' },
        weekly: { usagePercentLeft: '60%', resetInfo: 'b' },
      },
    });
    store.add({
      provider: 'codex',
      timestamp: '2026-01-03T00:00:00.000Z',
      snapshot: {
        fiveHour: { usagePercentLeft: '50%', resetInfo: 'a' },
        weekly: { usagePercentLeft: '40%', resetInfo: 'b' },
      },
    });

    const history = store.list(10);
    expect(history.codex).toHaveLength(2);
    expect(history.codex.map((entry) => entry.timestamp)).toEqual([
      '2026-01-03T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ]);
  });

  it('loads persisted data and ignores malformed rows', () => {
    const filePath = makePath();
    writeFileSync(filePath, JSON.stringify({
      entries: [
        { provider: 'gemini', timestamp: '2026-01-01T00:00:00.000Z', snapshot: { models: [] } },
        { provider: 'bogus', timestamp: '2026-01-01T00:00:00.000Z' },
        { not: 'an-entry' },
      ],
    }), 'utf8');

    const store = new UsageHistoryStore(filePath, 10);
    const history = store.list(10);
    expect(history.gemini).toHaveLength(1);
    expect(history.claude).toHaveLength(0);
    expect(history.codex).toHaveLength(0);
  });

  it('persists entries to disk', () => {
    const filePath = makePath();
    const store = new UsageHistoryStore(filePath, 10);
    store.add({
      provider: 'gemini',
      timestamp: '2026-01-01T00:00:00.000Z',
      snapshot: { models: [{ model: 'g', usagePercent: '10%', resetInfo: 'soon' }] },
    });

    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as { entries: Array<{ provider: string }> };
    expect(raw.entries).toHaveLength(1);
    expect(raw.entries[0]?.provider).toBe('gemini');
  });
});
