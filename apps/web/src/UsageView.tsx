import React from 'react';
import { RotateCcw } from 'lucide-react';

interface StandaloneUsageCapture {
  provider: string;
  model: string;
  usageStats: { stats: string; timestamp: string };
}

interface UsageViewProps {
  geminiUsageCapture: StandaloneUsageCapture | null;
  claudeUsageCapture: StandaloneUsageCapture | null;
  codexUsageCapture: StandaloneUsageCapture | null;
  usageLoading: boolean;
  onCapture: () => void;
  theme: any;
}

export function AgentUsageStats({ stats, timestamp }: { stats: string; timestamp: string }) {
  const lastUpdate = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lines = stats
    .replace(/[│╭╮╰╯─]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const percentageRows = lines.flatMap((line) => {
    const modelMatch = line.match(/^([a-z0-9][a-z0-9._-]+)\s+[-–]\s+.*?(\d{1,3}(?:\.\d+)?%)\s*(.*)$/i);
    if (modelMatch && /[-.]/.test(modelMatch[1])) {
      return [{
        label: modelMatch[1],
        percent: modelMatch[2],
        detail: modelMatch[3].trim(),
      }];
    }

    return [];
  });

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#ddd',
      padding: '16px',
      fontSize: '12px',
      lineHeight: 1.45,
      borderRadius: '8px',
      border: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '10px' }}>
        Usage Percentages · Updated {lastUpdate}
      </div>

      {percentageRows.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1fr) 80px minmax(160px, 1fr)',
          border: '1px solid #2b2b2b',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', backgroundColor: '#111', color: '#8be9fd', borderBottom: '1px solid #2b2b2b', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
            Model
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: '#111', color: '#8be9fd', borderBottom: '1px solid #2b2b2b', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
            Model Usage
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: '#111', color: '#8be9fd', borderBottom: '1px solid #2b2b2b', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
            Model resets
          </div>
          {percentageRows.map((row, index) => (
            <div key={`${row.label}-${index}`} style={{ display: 'contents' }}>
              <div style={{ padding: '8px 10px', backgroundColor: index % 2 === 0 ? '#171717' : '#1b1b1b', color: '#8be9fd', borderBottom: '1px solid #2b2b2b' }}>
                {row.label}
              </div>
              <div style={{ padding: '8px 10px', backgroundColor: index % 2 === 0 ? '#171717' : '#1b1b1b', color: '#50fa7b', borderBottom: '1px solid #2b2b2b', fontWeight: 700 }}>
                {row.percent}
              </div>
              <div style={{ padding: '8px 10px', backgroundColor: index % 2 === 0 ? '#171717' : '#1b1b1b', color: '#bbb', borderBottom: '1px solid #2b2b2b', wordBreak: 'break-word' }}>
                {row.detail}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#aaa' }}>No model usage rows found.</div>
      )}
    </div>
  );
}

export function ClaudeUsageStats({ stats, timestamp }: { stats: string; timestamp: string }) {
  const lastUpdate = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ansiStripped = stats.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
  const cleaned = ansiStripped.replace(/[│╭╮╰╯─]/g, '').replace(/\r/g, '\n');

  const extractSection = (label: 'Current session' | 'Current week') => {
    const nextLabel = label === 'Current session' ? 'Current week' : '(?:$)';
    const sectionMatch = cleaned.match(new RegExp(`${label}[\\s\\S]*?(?=${nextLabel})`, 'i'));
    const sectionText = sectionMatch?.[0] ?? '';
    const percentMatch = sectionText.match(/(\d{1,3}(?:\.\d+)?%)\s*(?:used)?/i);
    const resetMatch = sectionText.match(/(Resets?[^\n]+)/i);
    return {
      usage: percentMatch?.[1] ?? 'N/A',
      reset: resetMatch?.[1]?.trim() ?? 'N/A',
    };
  };

  const session = extractSection('Current session');
  const week = extractSection('Current week');

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#171717',
    border: '1px solid #2b2b2b',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#8be9fd',
    fontWeight: 700,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '17px',
    color: '#50fa7b',
    fontWeight: 700,
    lineHeight: 1.1,
  };

  const resetStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#b8b8b8',
  };

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#ddd',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '10px' }}>
        Claude Plan Usage · Updated {lastUpdate}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Current Session</div>
          <div style={valueStyle}>{session.usage} used</div>
          <div style={resetStyle}>{session.reset}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Current Week</div>
          <div style={valueStyle}>{week.usage} used</div>
          <div style={resetStyle}>{week.reset}</div>
        </div>
      </div>
    </div>
  );
}

export function CodexUsageStats({ stats, timestamp }: { stats: string; timestamp: string }) {
  const lastUpdate = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cleaned = stats.replace(/[│╭╮╰╯─]/g, '').replace(/\r/g, '\n');

  const extractLimit = (label: '5h limit' | 'Weekly limit') => {
    const match = cleaned.match(new RegExp(`${label}:\\s*\\[[^\\]]*\\]\\s*(\\d{1,3}(?:\\.\\d+)?%)\\s*left\\s*\\(([^\\)]+)\\)`, 'i'));
    return {
      usageLeft: match?.[1] ?? 'N/A',
      reset: match?.[2]?.trim() ?? 'N/A',
    };
  };

  const fiveHour = extractLimit('5h limit');
  const weekly = extractLimit('Weekly limit');

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#171717',
    border: '1px solid #2b2b2b',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#8be9fd',
    fontWeight: 700,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '17px',
    color: '#50fa7b',
    fontWeight: 700,
    lineHeight: 1.1,
  };

  const resetStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#b8b8b8',
  };

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#ddd',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '10px' }}>
        Codex Limits · Updated {lastUpdate}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>5h limit</div>
          <div style={valueStyle}>{fiveHour.usageLeft} left</div>
          <div style={resetStyle}>{fiveHour.reset}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Weekly limit</div>
          <div style={valueStyle}>{weekly.usageLeft} left</div>
          <div style={resetStyle}>{weekly.reset}</div>
        </div>
      </div>
    </div>
  );
}

export function UsageView({
  geminiUsageCapture,
  claudeUsageCapture,
  codexUsageCapture,
  usageLoading,
  onCapture,
  theme
}: UsageViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted, letterSpacing: '0.8px' }}>Agent Usage</h3>
        <button onClick={onCapture} disabled={usageLoading} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}><RotateCcw size={12} className={usageLoading ? 'animate-spin' : ''} /> Reload</button>
      </div>
      {geminiUsageCapture && <AgentUsageStats stats={geminiUsageCapture.usageStats.stats} timestamp={geminiUsageCapture.usageStats.timestamp} />}
      {claudeUsageCapture && <ClaudeUsageStats stats={claudeUsageCapture.usageStats.stats} timestamp={claudeUsageCapture.usageStats.timestamp} />}
      {codexUsageCapture && <CodexUsageStats stats={codexUsageCapture.usageStats.stats} timestamp={codexUsageCapture.usageStats.timestamp} />}
    </div>
  );
}
