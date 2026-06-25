import { Terminal as TerminalIcon, Activity, AlertCircle, Trash2, X, Clock, Zap } from 'lucide-react';
import { Agent, theme } from './api/types';
import { getAgentColor } from './agentColors';

interface AgentsViewProps {
  agents: Agent[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ready': return <Zap size={14} color="#4caf50" />;
    case 'starting': return <Clock size={14} color="#ffeb3b" className="animate-pulse" />;
    case 'error': return <AlertCircle size={14} color="#f44336" />;
    default: return <Activity size={14} color="#9e9e9e" />;
  }
};

export function AgentsView({ agents, onSelect, onRemove, onClose }: AgentsViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: theme.bg }}>
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
          <h1 style={{ margin: 0, fontSize: '18px', color: theme.textBright, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TerminalIcon size={20} /> Active Agents
          </h1>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
            {agents.length} agent{agents.length !== 1 ? 's' : ''} currently registered
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Grid Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {agents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.textDim }}>
            <TerminalIcon size={64} style={{ marginBottom: '16px', opacity: 0.2 }} />
            <div style={{ fontSize: '18px', fontWeight: 600 }}>No Agents</div>
            <div style={{ fontSize: '14px' }}>Create a new agent from the sidebar to get started.</div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '20px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            {agents.map((agent) => {
              const color = getAgentColor(agent.id);
              return (
                <div 
                  key={agent.id}
                  onClick={() => onSelect(agent.id)}
                  style={{ 
                    backgroundColor: theme.bgRaised, 
                    border: `1px solid ${theme.border}`,
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = color.accent;
                    e.currentTarget.style.boxShadow = `0 4px 20px ${color.tint}`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Status Strip */}
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    height: '3px', 
                    backgroundColor: agent.status === 'ready' ? theme.success : agent.status === 'error' ? theme.error : '#ffeb3b' 
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '8px', 
                        backgroundColor: color.tint, 
                        color: color.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${color.glow}`
                      }}>
                        <TerminalIcon size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: color.accent }}>{agent.id}</div>
                        <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {agent.provider} · {agent.model || 'default'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
                      style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: '4px' }}
                      onMouseOver={(e) => e.currentTarget.style.color = theme.error}
                      onMouseOut={(e) => e.currentTarget.style.color = theme.textDim}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.textSecondary }}>
                    {getStatusIcon(agent.status)}
                    <span style={{ fontWeight: 600 }}>{agent.status.toUpperCase()}</span>
                  </div>


                  {agent.usage && (
                    <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: theme.textMuted }}>Token Usage</span>
                        <span style={{ color: theme.textSubtle }}>{agent.usage.total.toLocaleString()} / {agent.usage.limit.toLocaleString()}</span>
                      </div>
                      <div style={{ height: '4px', backgroundColor: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          backgroundColor: color.accent, 
                          width: `${Math.min(100, (agent.usage.total / agent.usage.limit) * 100)}%`,
                          transition: 'width 0.5s ease-out'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
