import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export type UsageHistoryProvider = 'gemini' | 'claude' | 'codex';

export interface GeminiUsageModelSnapshot {
  model: string;
  usagePercent: string;
  resetInfo: string;
}

export interface ClaudeUsageSnapshot {
  currentSession: {
    usagePercentUsed: string;
    resetInfo: string;
  };
  currentWeek: {
    usagePercentUsed: string;
    resetInfo: string;
  };
}

export interface CodexUsageSnapshot {
  fiveHour: {
    usagePercentLeft: string;
    resetInfo: string;
  };
  weekly: {
    usagePercentLeft: string;
    resetInfo: string;
  };
}

export type UsageHistoryEntry =
  | {
      provider: 'gemini';
      timestamp: string;
      snapshot: {
        models: GeminiUsageModelSnapshot[];
      };
    }
  | {
      provider: 'claude';
      timestamp: string;
      snapshot: ClaudeUsageSnapshot;
    }
  | {
      provider: 'codex';
      timestamp: string;
      snapshot: CodexUsageSnapshot;
    };

interface PersistedUsageHistoryStore {
  entries: UsageHistoryEntry[];
}

const defaultHistoryByProvider: Record<UsageHistoryProvider, UsageHistoryEntry[]> = {
  gemini: [],
  claude: [],
  codex: [],
};

export class UsageHistoryStore {
  private readonly entriesByProvider: Record<UsageHistoryProvider, UsageHistoryEntry[]> = {
    gemini: [],
    claude: [],
    codex: [],
  };

  constructor(
    private readonly filePath: string,
    private readonly maxEntriesPerProvider: number = 200,
  ) {
    this.load();
  }

  add(entry: UsageHistoryEntry): UsageHistoryEntry {
    const entries = this.entriesByProvider[entry.provider];
    entries.push(entry);
    if (entries.length > this.maxEntriesPerProvider) {
      entries.splice(0, entries.length - this.maxEntriesPerProvider);
    }
    this.persist();
    return entry;
  }

  list(limit: number = 50): Record<UsageHistoryProvider, UsageHistoryEntry[]> {
    const resolvedLimit = Math.max(1, Math.floor(limit));
    return {
      gemini: [...this.entriesByProvider.gemini].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, resolvedLimit),
      claude: [...this.entriesByProvider.claude].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, resolvedLimit),
      codex: [...this.entriesByProvider.codex].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, resolvedLimit),
    };
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedUsageHistoryStore;
      const next = parsed?.entries ?? [];
      for (const entry of next) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const provider = (entry as { provider?: unknown }).provider;
        const timestamp = (entry as { timestamp?: unknown }).timestamp;
        if (
          (provider === 'gemini' || provider === 'claude' || provider === 'codex')
          && typeof timestamp === 'string'
        ) {
          this.entriesByProvider[provider].push(entry as UsageHistoryEntry);
        }
      }

      for (const provider of Object.keys(this.entriesByProvider) as UsageHistoryProvider[]) {
        const entries = this.entriesByProvider[provider];
        entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        if (entries.length > this.maxEntriesPerProvider) {
          this.entriesByProvider[provider] = entries.slice(entries.length - this.maxEntriesPerProvider);
        }
      }
    } catch (err) {
      console.error('[UsageHistoryStore] Failed to load persisted state:', err);
      for (const provider of Object.keys(defaultHistoryByProvider) as UsageHistoryProvider[]) {
        this.entriesByProvider[provider] = [];
      }
    }
  }

  private persist(): void {
    const directory = path.dirname(this.filePath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    const payload: PersistedUsageHistoryStore = {
      entries: [
        ...this.entriesByProvider.gemini,
        ...this.entriesByProvider.claude,
        ...this.entriesByProvider.codex,
      ].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    };

    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
