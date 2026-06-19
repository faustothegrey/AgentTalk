import { useState } from 'react';
import { theme, Conversation, Agent } from '../../api/types';
import { getAgentColor } from '../../agentColors';

interface ChatSidebarProps {
  agents: Agent[];
  conversationHistory: Conversation[];
  activeConversationId: string | null;
  onStartConversation: (agentIds: string[], topic: string, maxReplies: number) => void;
  onAutostart: () => void;
  onSelectConversation: (id: string) => void;
  wsConnected: boolean;
  children?: React.ReactNode;
}

export function ChatSidebar({
  agents,
  conversationHistory,
  activeConversationId,
  onStartConversation,
  onAutostart,
  onSelectConversation,
  wsConnected,
  children
}: ChatSidebarProps) {
  const [conversationAgentA, setConversationAgentA] = useState('');
  const [conversationAgentB, setConversationAgentB] = useState('');
  const [topic, setTopic] = useState('Discuss the current AgentTalk project.');

  const readyAgents = agents.filter(a => a.status === 'ready' || a.status === 'busy');

  const getSelectStyle = (agentId: string) => {
    const color = agentId ? getAgentColor(agentId) : null;
    return {
      backgroundColor: color ? color.tint : '#1e1e1e',
      color: color ? color.text : '#ddd',
      border: `1px solid ${color ? color.accent : '#3b3b3b'}`,
      borderRadius: '6px',
      padding: '8px 10px',
      fontSize: '13px',
      outline: 'none',
    };
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {children}
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>New Conversation</span>
          <select value={conversationAgentA} onChange={e => setConversationAgentA(e.target.value)} style={getSelectStyle(conversationAgentA)}>
            <option value="">Agent A</option>
            {readyAgents.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <select value={conversationAgentB} onChange={e => setConversationAgentB(e.target.value)} style={getSelectStyle(conversationAgentB)}>
            <option value="">Agent B</option>
            {readyAgents.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="Discussion topic..." style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '12px', minHeight: '60px' }} />
          <button 
            onClick={() => onStartConversation([conversationAgentA, conversationAgentB].filter(Boolean), topic, 5)} 
            disabled={!wsConnected || !conversationAgentA || !conversationAgentB}
            style={{ padding: '10px', backgroundColor: theme.bg, color: theme.textBright, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', cursor: 'pointer', opacity: (!wsConnected || !conversationAgentA || !conversationAgentB) ? 0.5 : 1 }}
          >
            Start Chat
          </button>
          <button onClick={onAutostart} style={{ padding: '10px', backgroundColor: '#2d3748', color: '#ebf8ff', border: '1px solid #4a5568', borderRadius: '6px', cursor: 'pointer' }}>Autostart G+C</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>History</span>
          {conversationHistory.map(c => (
            <div key={c.id} onClick={() => onSelectConversation(c.id)} style={{ padding: '10px', cursor: 'pointer', backgroundColor: c.id === activeConversationId ? theme.bgActive : theme.bgSurface, borderRadius: '6px', border: `1px solid ${c.id === activeConversationId ? theme.textDim : theme.border}` }}>
              <div style={{ fontSize: '12px', color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.topic}</div>
              <div style={{ fontSize: '10px', color: theme.textMuted }}>{new Date(c.createdAt).toLocaleDateString()} · {c.agentIds.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
