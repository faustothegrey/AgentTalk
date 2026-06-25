import { Terminal as TerminalIcon, Activity, AlertCircle, Trash2 } from 'lucide-react';
import { Agent, theme } from '../../api/types';
import { getAgentColor } from '../../agentColors';

interface AgentListProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ready': return <Activity size={14} color="#4caf50" />;
    case 'starting': return <Activity size={14} color="#ffeb3b" className="animate-pulse" />;
    case 'error': return <AlertCircle size={14} color="#f44336" />;
    default: return <Activity size={14} color="#9e9e9e" />;
  }
};

export function AgentList({ agents, selectedAgentId, onSelect, onRemove }: AgentListProps) {
  return (
    <div style={{ maxHeight: '260px', overflowY: 'auto', borderBottom: `1px solid ${theme.border}` }}>
      {agents.map(agent => (
        <div 
          key={agent.id} 
          onClick={() => onSelect(agent.id)} 
          style={{ 
            padding: '12px 16px', 
            cursor: 'pointer', 
            backgroundColor: selectedAgentId === agent.id ? getAgentColor(agent.id).tint : 'transparent', 
            borderBottom: '1px solid #2d2d2d', 
            borderLeft: `3px solid ${selectedAgentId === agent.id ? getAgentColor(agent.id).accent : 'transparent'}`, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}
        >
          <div style={{ 
            width: '24px', 
            height: '24px', 
            borderRadius: '999px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: getAgentColor(agent.id).tint, 
            color: getAgentColor(agent.id).accent, 
            boxShadow: `inset 0 0 0 1px ${getAgentColor(agent.id).glow}`, 
            flexShrink: 0 
          }}>
            <TerminalIcon size={14} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: '13px', color: selectedAgentId === agent.id ? getAgentColor(agent.id).text : '#ddd' }}>
              {agent.id} <span style={{ fontSize: '11px', color: theme.textSubtle }}>({agent.provider})</span>
            </div>
            <div style={{ fontSize: '11px', color: theme.textSubtle, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {getStatusIcon(agent.status)} {agent.status}
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }} 
            style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
