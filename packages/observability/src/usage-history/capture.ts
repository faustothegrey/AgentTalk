



// From packages/observability/src/usage-history/ (or dist/usage-history/), repo root is 4 levels up

import type {
  UsageHistoryEntry,
  UsageHistoryProvider,
} from './store.js';

export function isUsageCaptureProvider(value: unknown): value is UsageHistoryProvider {
  return value === 'gemini' || value === 'claude' || value === 'codex';
}


export function normalizeCapturedStatsText(provider: UsageHistoryProvider, raw: string): string {
  const ansiStripped = raw.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
  const normalized = ansiStripped
    .replace(/\u0007/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  if (provider === 'gemini') {
    const boxed = normalized.match(/Session Stats[\s\S]*?╰[^\n]*╯/m);
    if (boxed?.[0]) {
      return boxed[0].trim();
    }

    const fromHeading = normalized.match(/Session Stats[\s\S]*$/m);
    if (fromHeading?.[0]) {
      return fromHeading[0].trim();
    }
  }

  if (provider === 'claude') {
    const section = normalized.match(/Current session[\s\S]*?(?:Esc to cancel|Bypassing Permissions|$)/i);
    if (section?.[0]) {
      return section[0].trim();
    }
  }

  if (provider === 'codex') {
    const boxed = normalized.match(/╭[\s\S]*?OpenAI Codex[\s\S]*?╰[^\n]*╯/m);
    if (boxed?.[0]) {
      return boxed[0].trim();
    }

    const core = normalized.match(/OpenAI Codex[\s\S]*?(?:Weekly limit:[^\n]*|$)/m);
    if (core?.[0]) {
      return core[0].trim();
    }
  }

  return normalized.trim();
}

export function buildUsageHistoryEntry(
  provider: UsageHistoryProvider,
  stats: string,
  timestamp: string,
): UsageHistoryEntry {
  if (provider === 'gemini') {
    const lines = stats
      .replace(/[│╭╮╰╯─]/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const models = lines.flatMap((line) => {
      const modelMatch = line.match(/^([a-z0-9][a-z0-9._-]+)\s+[-–]\s+.*?(\d{1,3}(?:\.\d+)?%)\s*(.*)$/i);
      if (!modelMatch) {
        return [];
      }

      const [, model, usagePercent, resetInfoRaw] = modelMatch;
      if (!model || !usagePercent || !/[-.]/.test(model)) {
        return [];
      }

      return [{
        model,
        usagePercent,
        resetInfo: (resetInfoRaw ?? '').trim(),
      }];
    });

    return {
      provider,
      timestamp,
      snapshot: {
        models,
      },
    } as UsageHistoryEntry;
  }

  if (provider === 'claude') {
    const cleaned = stats
      .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/[│╭╮╰╯─]/g, '')
      .replace(/\r/g, '\n');
    const extractSection = (label: 'Current session' | 'Current week') => {
      const nextLabel = label === 'Current session' ? 'Current week' : '(?:$)';
      const sectionMatch = cleaned.match(new RegExp(`${label}[\\s\\S]*?(?=${nextLabel})`, 'i'));
      const sectionText = sectionMatch?.[0] ?? '';
      const percentMatch = sectionText.match(/(\d{1,3}(?:\.\d+)?%)\s*(?:used)?/i);
      const resetMatch = sectionText.match(/(Resets?[^\n]+)/i);
      return {
        usagePercentUsed: percentMatch?.[1] ?? 'N/A',
        resetInfo: resetMatch?.[1]?.trim() ?? 'N/A',
      };
    };

    return {
      provider,
      timestamp,
      snapshot: {
        currentSession: extractSection('Current session'),
        currentWeek: extractSection('Current week'),
      },
    } as UsageHistoryEntry;
  }

  const cleaned = stats.replace(/[│╭╮╰╯─]/g, '').replace(/\r/g, '\n');
  const extractLimit = (label: '5h limit' | 'Weekly limit') => {
    const match = cleaned.match(new RegExp(`${label}:\\s*\\[[^\\]]*\\]\\s*(\\d{1,3}(?:\\.\\d+)?%)\\s*left\\s*\\(([^\\)]+)\\)`, 'i'));
    return {
      usagePercentLeft: match?.[1] ?? 'N/A',
      resetInfo: match?.[2]?.trim() ?? 'N/A',
    };
  };

  return {
    provider,
    timestamp,
    snapshot: {
      fiveHour: extractLimit('5h limit'),
      weekly: extractLimit('Weekly limit'),
    },
  } as UsageHistoryEntry;
}

