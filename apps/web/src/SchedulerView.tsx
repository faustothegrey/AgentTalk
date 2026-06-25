import { useState } from 'react';
import { RotateCcw, Plus, Trash2 } from 'lucide-react';

interface SchedulerJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  intervalSeconds: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

interface SchedulerViewProps {
  schedulerJobs: SchedulerJob[];
  globalSchedulerEnabled: boolean;
  schedulerLoading: boolean;
  onRefresh: () => void;
  onToggleGlobal: (enabled: boolean) => void;
  onCreateJob: (name: string, agentId: string, prompt: string, interval: number) => Promise<void>;
  onUpdateJob: (id: string, patch: Partial<Pick<SchedulerJob, 'enabled'>>) => Promise<void>;
  onRunNow: (id: string) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  agents: { id: string; status: string }[];
  theme: any;
}

export function SchedulerView({
  schedulerJobs,
  globalSchedulerEnabled,
  schedulerLoading,
  onRefresh,
  onToggleGlobal,
  onCreateJob,
  onUpdateJob,
  onRunNow,
  onDeleteJob,
  agents,
  theme
}: SchedulerViewProps) {
  const [jobName, setJobName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(300);

  const availableAgents = agents.filter(a => a.status === 'ready' || a.status === 'busy');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted, letterSpacing: '0.8px' }}>Scheduler Configuration</h3>
        <button onClick={onRefresh} disabled={schedulerLoading} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}><RotateCcw size={12} className={schedulerLoading ? 'animate-spin' : ''} /> Reload</button>
      </div>

      <div style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: theme.textBright }}>Global Scheduler</div>
          <div style={{ fontSize: '11px', color: theme.textMuted }}>Toggle all scheduled jobs</div>
        </div>
        <button onClick={() => onToggleGlobal(!globalSchedulerEnabled)} disabled={schedulerLoading} style={{ padding: '8px 16px', backgroundColor: globalSchedulerEnabled ? theme.success : theme.error, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>{globalSchedulerEnabled ? 'ENABLED' : 'DISABLED'}</button>
      </div>

      <div style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Create Job</div>
        <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Job name" style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }} />
        <select value={agentId} onChange={e => setAgentId(e.target.value)} style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px' }}>
          <option value="">Select Agent...</option>
          {availableAgents.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
        </select>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Prompt to send..." rows={2} style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>Interval (sec)</span>
          <input type="number" value={intervalSeconds} onChange={e => setIntervalSeconds(Number(e.target.value))} style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px' }} />
        </div>
        <button onClick={() => { onCreateJob(jobName, agentId, prompt, intervalSeconds); setJobName(''); setPrompt(''); }} disabled={schedulerLoading || !jobName.trim() || !agentId || !prompt.trim()} style={{ backgroundColor: theme.bg, color: theme.textBright, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={16} /> Create Job</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {schedulerJobs.map(job => (
          <div key={job.id} style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '14px', opacity: job.enabled ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, color: theme.textBright }}>{job.name}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => onRunNow(job.id)} style={{ padding: '4px 8px', backgroundColor: theme.bg, color: theme.textSecondary, border: `1px solid ${theme.borderInput}`, borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Run Now</button>
                <button onClick={() => onUpdateJob(job.id, { enabled: !job.enabled })} style={{ padding: '4px 8px', backgroundColor: job.enabled ? theme.error : theme.success, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>{job.enabled ? 'Disable' : 'Enable'}</button>
                <button onClick={() => onDeleteJob(job.id)} style={{ padding: '4px 8px', backgroundColor: 'transparent', color: theme.textMuted, border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px 10px', fontSize: '12px' }}>
              <span style={{ color: theme.textMuted }}>Status</span>
              <span style={{ color: (job.enabled && globalSchedulerEnabled) ? theme.success : theme.error }}>
                {job.enabled ? (globalSchedulerEnabled ? 'Enabled' : 'Paused (Global Off)') : 'Disabled'}
              </span>
              <span style={{ color: theme.textMuted }}>Agent</span>
              <span style={{ color: theme.textSubtle }}>{job.agentId}</span>
              <span style={{ color: theme.textMuted }}>Interval</span>
              <span style={{ color: theme.textSubtle }}>Every {job.intervalSeconds}s</span>
              <span style={{ color: theme.textMuted }}>Last run</span>
              <span style={{ color: theme.textSubtle }}>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Never'}</span>
              <span style={{ color: theme.textMuted }}>Last error</span>
              <span style={{ color: job.lastError ? theme.error : theme.textSubtle }}>{job.lastError ?? 'None'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
