import { useState } from 'react';
import { Users } from 'lucide-react';
import { theme, Agent, Team, TeamTask, TeamComposition, Provider, TeamMember, TranscriptEntry } from '../../api/types';

interface TeamSidebarProps {
  agents: Agent[];
  activeTeam: Team | null;
  activeTeamTask: TeamTask | null;
  onAutostartTeam: (provider: Provider) => void;
  onDisbandTeam: () => void;
  onCreateTeam: (members: TeamMember[], composition: TeamComposition) => Promise<void>;
  geminiModel: string;
  onGeminiModelChange: (model: string) => void;
  children?: React.ReactNode;
}

const geminiModelOptions = [
  { value: 'gemini-3.1-pro', label: '3.1 Pro' },
  { value: 'gemini-3.1-pro-preview', label: '3.1 Pro (Preview)' },
  { value: 'gemini-2.5-pro', label: '2.5 Pro' },
  { value: 'gemini-3-pro-preview', label: '3 Pro (Preview)' },
  { value: 'gemini-3-flash-preview', label: '3 Flash (Preview)' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash' },
];

// BL-051: the run's OUTPUT, not just its status. The task panel answered "did it finish?" but never
// "what did it do?" — which is the question that decides whether an autonomous run was any good. The
// transcript already arrives on `team_task_updated`; this renders it.
function TaskTranscript({ entries }: { entries: TranscriptEntry[] }) {
  if (!entries.length) {
    return (
      <div style={{ fontSize: '10px', color: theme.textDim, marginTop: '6px', fontStyle: 'italic' }}>
        No output yet — the worker has not replied.
      </div>
    );
  }
  return (
    <div style={{ marginTop: '8px', borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}>
      <div style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
        Output ({entries.length})
      </div>
      <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {entries.map((entry, idx) => (
          <div key={`${entry.timestamp}-${idx}`} style={{ fontSize: '10px' }}>
            <div style={{ color: theme.textDim, display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span>{entry.from} → {entry.to}</span>
              {entry.messageType && <span style={{ color: theme.textMuted }}>· {entry.messageType}</span>}
            </div>
            <div
              style={{
                color: theme.textSecondary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              {entry.payload}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamSidebar({
  agents,
  activeTeam,
  activeTeamTask,
  onAutostartTeam,
  onDisbandTeam,
  onCreateTeam,
  geminiModel,
  onGeminiModelChange,
  children
}: TeamSidebarProps) {
  const [teamComposition, setTeamComposition] = useState<TeamComposition>('worker-only');
  const [teamPlannerAgent, setTeamPlannerAgent] = useState('');
  const [teamPlannerAgentB, setTeamPlannerAgentB] = useState('');
  const [teamWorkerAgent, setTeamWorkerAgent] = useState('');

  const readyAgents = agents.filter(a => a.status === 'ready' || a.status === 'busy');

  const handleCreateTeam = async () => {
    const members: TeamMember[] = [];
    if (teamComposition === 'planner-worker' || teamComposition === 'planner-planner-worker') {
      members.push({ agentId: teamPlannerAgent, role: 'planner' });
    }
    if (teamComposition === 'planner-planner-worker') {
      members.push({ agentId: teamPlannerAgentB, role: 'planner' });
    }
    members.push({ agentId: teamWorkerAgent, role: 'worker' });
    await onCreateTeam(members, teamComposition);
  };

  const isCreateDisabled = !teamWorkerAgent || 
    ((teamComposition === 'planner-worker' || teamComposition === 'planner-planner-worker') && !teamPlannerAgent) ||
    (teamComposition === 'planner-planner-worker' && !teamPlannerAgentB);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {children}
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {!activeTeam ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>Create Team</span>
            <select 
              value={teamComposition} 
              onChange={e => setTeamComposition(e.target.value as TeamComposition)} 
              style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px' }}
            >
              <option value="worker-only">Only Worker</option>
              <option value="planner-worker">Planner + Worker</option>
              <option value="planner-planner-worker">2P + 1W</option>
            </select>

            {(teamComposition === 'planner-worker' || teamComposition === 'planner-planner-worker') && (
              <select 
                value={teamPlannerAgent} 
                onChange={e => setTeamPlannerAgent(e.target.value)} 
                style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px' }}
              >
                <option value="">Select Planner A...</option>
                {readyAgents.map(a => <option key={`pa-${a.id}`} value={a.id}>{a.id}</option>)}
              </select>
            )}

            {teamComposition === 'planner-planner-worker' && (
              <select 
                value={teamPlannerAgentB} 
                onChange={e => setTeamPlannerAgentB(e.target.value)} 
                style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px' }}
              >
                <option value="">Select Planner B...</option>
                {readyAgents.map(a => <option key={`pb-${a.id}`} value={a.id}>{a.id}</option>)}
              </select>
            )}

            <select 
              value={teamWorkerAgent} 
              onChange={e => setTeamWorkerAgent(e.target.value)} 
              style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px' }}
            >
              <option value="">Select Worker...</option>
              {readyAgents.map(a => <option key={`w-${a.id}`} value={a.id}>{a.id}</option>)}
            </select>

            <button 
              onClick={handleCreateTeam}
              disabled={isCreateDisabled}
              style={{ padding: '8px', backgroundColor: isCreateDisabled ? theme.bgSurface : theme.success, color: '#fff', border: 'none', borderRadius: '6px', cursor: isCreateDisabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Create Team
            </button>
            
            <div style={{ height: '1px', backgroundColor: theme.border, margin: '4px 0' }} />
            
            <button 
              onClick={() => onAutostartTeam('codex')} 
              style={{ padding: '10px', backgroundColor: theme.bg, color: theme.textBright, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Users size={14} /> Autostart 2P+1W [Codex]
            </button>

            <button 
              onClick={() => onAutostartTeam('gemini')} 
              style={{ padding: '10px', backgroundColor: theme.bg, color: theme.textBright, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Users size={14} /> Autostart 2P+1W [Gemini]
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: theme.textMuted }}>Gemini Model</span>
              <select 
                value={geminiModel} 
                onChange={e => onGeminiModelChange(e.target.value)} 
                style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px', fontSize: '12px' }}
              >
                {geminiModelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>Active Team</span>
              <span style={{ fontSize: '10px', color: theme.textDim }}>{activeTeam.status}</span>
            </div>
            {activeTeamTask && (
              <div style={{ padding: '10px', backgroundColor: theme.bg, borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>{activeTeamTask.description}</div>
                <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '4px' }}>Status: {activeTeamTask.status}</div>
                {activeTeamTask.workerRefusalReason && (
                  <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '4px' }}>
                    Refused: {activeTeamTask.workerRefusalReason}
                  </div>
                )}
                <TaskTranscript entries={activeTeamTask.transcript ?? []} />
              </div>
            )}
            <button 
              onClick={onDisbandTeam} 
              style={{ padding: '6px', background: 'none', border: `1px solid ${theme.border}`, color: theme.textDim, borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
            >
              Disband Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
