import { useState, useEffect, useRef } from 'react';
import { History, Users, Activity, ChevronRight, MessageSquare, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { getAgentColor } from './agentColors';

interface TranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
  messageType?: string;
  model?: string;
  provider?: string;
}

interface TeamMember {
  agentId: string;
  role: 'planner' | 'worker';
  model?: string;
  provider?: string;
}

interface PlanningRun {
  id: string;
  taskId: string;
  teamId: string;
  composition: string;
  description: string;
  status: string;
  plan?: string | null;
  plannerAgentId?: string | null;
  members: TeamMember[];
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
}

interface PlanningViewProps {
  onClose: () => void;
  theme: any;
}

export function PlanningView({ onClose, theme }: PlanningViewProps) {
  const [runs, setRuns] = useState<Partial<PlanningRun>[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PlanningRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/planning-runs');
      if (!res.ok) throw new Error('Failed to fetch planning runs');
      const data = await res.json();
      setRuns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planning-runs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch planning run details');
      const data = await res.json();
      setSelectedRun(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetail(selectedRunId);
    } else {
      setSelectedRun(null);
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (selectedRun) {
      transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedRun]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle2 size={14} color={theme.success} />;
      case 'interrupted': return <ShieldAlert size={14} color={theme.error} />;
      case 'error': return <ShieldAlert size={14} color={theme.error} />;
      default: return <Activity size={14} color="#ffeb3b" />;
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Sidebar: Run List */}
      <div style={{ 
        width: '320px', 
        borderRight: `1px solid ${theme.border}`, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: theme.bgSurface 
      }}>
        <div style={{ 
          padding: '16px', 
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.textBright, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} /> Planning Runs
          </h2>
          <button onClick={fetchRuns} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
            <Activity size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{ 
              margin: '12px', 
              padding: '10px 12px', 
              backgroundColor: '#451a1a', 
              border: '1px solid #912d2d', 
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}>
                <X size={14} />
              </button>
            </div>
          )}
          {runs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: theme.textDim, fontSize: '13px' }}>
              No planning runs found.
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id || null)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  backgroundColor: selectedRunId === run.id ? theme.bgActive : 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 700 }}>{run.id}</span>
                  {run.status && getStatusIcon(run.status)}
                </div>
                <div style={{ fontSize: '13px', color: theme.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {run.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme.textDim }}>
                  <span>{run.composition}</span>
                  <span>{run.createdAt ? new Date(run.createdAt).toLocaleDateString() : ''}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg }}>
        {selectedRun ? (
          <>
            {/* Header */}
            <div style={{ 
              padding: '16px 24px', 
              borderBottom: `1px solid ${theme.border}`, 
              backgroundColor: theme.bgSurface,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  {selectedRun.id} · {selectedRun.status}
                </div>
                <h1 style={{ margin: 0, fontSize: '18px', color: theme.textBright }}>{selectedRun.description}</h1>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Team Info */}
                <section>
                  <h3 style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} /> Team Members
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {selectedRun.members.map((member) => {
                      const color = getAgentColor(member.agentId);
                      return (
                        <div key={member.agentId} style={{ 
                          backgroundColor: theme.bgRaised, 
                          border: `1px solid ${theme.border}`,
                          borderRadius: '8px',
                          padding: '12px',
                          minWidth: '200px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: color.accent }}>{member.agentId}</div>
                          <div style={{ fontSize: '11px', color: theme.textSubtle }}>{member.role.toUpperCase()}</div>
                          <div style={{ fontSize: '11px', color: theme.textDim }}>{member.model} ({member.provider})</div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Plan Result */}
                {selectedRun.plan && (
                  <section>
                    <h3 style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} /> Final Plan
                    </h3>
                    <div style={{ 
                      backgroundColor: '#1e1e1e', 
                      borderLeft: `4px solid ${theme.success}`,
                      padding: '16px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: theme.textSecondary,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6
                    }}>
                      {selectedRun.plan}
                    </div>
                  </section>
                )}

                {/* Transcript */}
                <section>
                  <h3 style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} /> Planning Transcript
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedRun.transcript.map((entry, idx) => {
                      const isSystem = entry.kind === 'system';
                      const color = getAgentColor(entry.from);
                      
                      return (
                        <div key={idx} style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: isSystem ? 'transparent' : theme.bgRaised,
                          border: isSystem ? `1px dashed ${theme.border}` : `1px solid ${theme.border}`,
                          opacity: isSystem ? 0.7 : 1,
                          marginLeft: isSystem ? '0' : (idx % 2 === 0 ? '0' : '24px'),
                          marginRight: isSystem ? '0' : (idx % 2 === 0 ? '24px' : '0'),
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: isSystem ? theme.textMuted : color.accent }}>
                                {entry.from}
                              </span>
                              {entry.to && <span style={{ fontSize: '10px', color: theme.textDim }}><ChevronRight size={10} style={{ display: 'inline' }} /> {entry.to}</span>}
                              {entry.messageType && <span style={{ fontSize: '10px', backgroundColor: theme.bgActive, color: theme.textSubtle, padding: '2px 6px', borderRadius: '4px' }}>{entry.messageType}</span>}
                            </div>
                            <span style={{ fontSize: '10px', color: theme.textDim }}>
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ 
                            fontSize: '13px', 
                            color: isSystem ? theme.textMuted : theme.textPrimary,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            fontStyle: isSystem ? 'italic' : 'normal'
                          }}>
                            {entry.payload}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={transcriptBottomRef} />
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: theme.textDim }}>
            <div style={{ textAlign: 'center' }}>
              <History size={64} style={{ marginBottom: '24px', opacity: 0.2 }} />
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Select a Planning Run</div>
              <div style={{ fontSize: '14px' }}>Explore the collaborative discussion and decision process.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
