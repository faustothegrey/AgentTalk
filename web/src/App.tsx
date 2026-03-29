import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ErrorBoundary } from './ErrorBoundary';
import { Plus, Terminal as TerminalIcon, Activity, AlertCircle, X, Send, MessagesSquare, Trash2, History, Clock, Copy, Check } from 'lucide-react';
import { getAgentColor } from './agentColors';

const theme = {
  bg:          '#1e1e1e',
  bgRaised:    '#252526',
  bgSurface:   '#2d2d2d',
  bgActive:    '#3a3d49',
  border:      '#333',
  borderLight: '#444',
  borderInput: '#3b3b3b',
  textPrimary: '#ddd',
  textSecondary: '#ccc',
  textMuted:   '#888',
  textDim:     '#666',
  textBright:  '#fff',
  textSubtle:  '#aaa',
  success:     '#4caf50',
  error:       '#ef4444',
} as const;

type Provider = 'claude' | 'gemini' | 'codex';
type SidebarTab = 'new-agent' | 'conversation' | 'history' | 'usage';

interface Agent {
  id: string;
  status: string;
  usage?: { total: number; limit: number };
  provider?: string;
  model?: string;
  externalUsage?: string;
}

interface TranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
}

interface Conversation {
  id: string;
  agentIds: string[];
  topic: string;
  maxRepliesPerAgent: number;
  replyCounts: Record<string, number>;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  transcript: TranscriptEntry[];
}

const providerOptions: { value: Provider; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'codex', label: 'Codex' },
];

const modelOptions: Record<Provider, { value: string; label: string }[]> = {
  claude: [
    { value: 'sonnet', label: 'Sonnet 3.7' },
    { value: 'sonnet-3-5', label: 'Sonnet 3.5' },
    { value: 'opus', label: 'Opus' },
    { value: 'haiku', label: 'Haiku' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: '2.5 Flash' },
    { value: 'gemini-2.5-pro', label: '2.5 Pro' },
    { value: 'gemini-2.0-flash', label: '2.0 Flash' },
  ],
  codex: [
    { value: '', label: 'Default' },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{ background: 'none', border: 'none', color: copied ? '#4caf50' : '#666', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
      onMouseOver={(e) => { if (!copied) e.currentTarget.style.color = '#aaa'; }}
      onMouseOut={(e) => { if (!copied) e.currentTarget.style.color = '#666'; }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function ConversationTranscript({ conversation }: { conversation: Conversation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const messages = conversation.transcript.filter((entry) => entry.kind === 'message');

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      onScroll={() => {
        const el = containerRef.current;
        if (!el) return;
        shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {messages.length === 0 ? (
        <div style={{
          margin: 'auto',
          color: theme.textDim,
          textAlign: 'center',
          fontSize: '14px',
        }}>
          Waiting for agent replies...
        </div>
      ) : (
        messages.map((entry, index) => {
          const color = getAgentColor(entry.from);
          return (
            <div
              key={`${entry.timestamp}-${entry.from}-${index}`}
              style={{
                alignSelf: 'stretch',
                backgroundColor: color.tint,
                borderLeft: `3px solid ${color.accent}`,
                border: `1px solid ${color.glow}`,
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}>
                <span style={{ color: color.accent, fontWeight: 'bold' }}>{entry.from}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: theme.textMuted }}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <CopyButton text={entry.payload} />
                </div>
              </div>
              <div style={{
                color: color.text,
                fontSize: '14px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {entry.payload}
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function getAgentCommand(provider: Provider, model: string): string {
  if (model) {
    return `node scripts/llm-agent.mjs ${provider} --model ${model}`;
  }
  return `node scripts/llm-agent.mjs ${provider}`;
}

// Helper to add timeout to our fetch commands
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after ' + (timeoutMs / 1000) + 's');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

const ExternalUsageDisplay = ({ output, provider, isGreyed }: { output?: string, provider: string, isGreyed: boolean }) => {
  const parsePercent = (line?: string) => {
    if (!line) return null;
    const match = line.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
  };

  const lines = (output || '').split('\n').map(l => l.trim()).filter(Boolean);
  
  const usageSections = lines.reduce<Array<{ title: string; percent: number; reset?: string }>>((sections, line, index) => {
    const percent = parsePercent(line);
    if (percent === null) return sections;

    let title = '';
    let reset = '';

    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = lines[cursor];
      if (!title && !candidate.includes('%')) {
        title = candidate;
        continue;
      }
      if (title && !candidate.includes('%')) {
        reset = candidate;
        break;
      }
    }

    sections.push({ title, percent, reset });
    return sections;
  }, []);

  const visibleSections = usageSections.filter(s => s.title);

  const getBarColor = (percent: number) => {
    if (percent >= 90) return '#ef4444';
    if (percent >= 75) return '#f59e0b';
    return '#a8acf0';
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px', 
      padding: '12px',
      backgroundColor: isGreyed ? 'transparent' : '#2b2d36',
      borderRadius: '8px',
      border: isGreyed ? '1px dashed #333' : '1px solid #3a3d49',
      opacity: isGreyed ? 0.3 : 1,
      filter: isGreyed ? 'grayscale(1)' : 'none',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: isGreyed ? '#555' : '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {provider}
        </div>
        {isGreyed && <div style={{ fontSize: '9px', color: '#444' }}>OFFLINE</div>}
      </div>
      
      {visibleSections.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleSections.map((section, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: theme.textMuted }}>
                <span>{section.title}</span>
                <span>{section.percent}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#1a1b23', borderRadius: '0', overflow: 'hidden' }}>
                <div style={{ width: `${section.percent}%`, height: '100%', backgroundColor: getBarColor(section.percent) }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '10px', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
          {isGreyed ? 'No data' : (output?.trim().slice(0, 50) || 'Active...')}
        </div>
      )}
    </div>
  );
};

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [globalUsage, setGlobalUsage] = useState<Record<string, string>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [selectedModel, setSelectedModel] = useState('');
  const [conversationAgentA, setConversationAgentA] = useState<string>('');
  const [conversationAgentB, setConversationAgentB] = useState<string>('');
  const [conversationAgentC, setConversationAgentC] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [maxReplies, setMaxReplies] = useState<number>(5);
  const [topic, setTopic] = useState('Discuss the current NodePTY project and propose concrete next-step implementation ideas or simplifications: architecture quality, risks, and the most useful changes to make next.');
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('new-agent');
  const messageInputRef = useRef<HTMLInputElement>(null);

  const sidebarTabButtonStyle = (tab: SidebarTab) => ({
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    backgroundColor: activeSidebarTab === tab ? theme.bgActive : 'transparent',
    color: activeSidebarTab === tab ? '#fff' : '#888',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    flex: 1,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleError = (msg: string, err: any) => {
    console.error(msg, err);
    setGlobalError(`${msg} ${err?.message || ''}`);
  };

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/agents');
      const data = await res.json();
      setAgents(data);
    } catch (err) {
      handleError('Failed to fetch agents:', err);
    }
  }, []);

  const fetchTopicHistory = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/topics');
      const data = await res.json();
      setTopicHistory(data);
    } catch (err) {
      console.warn('Failed to fetch topic history:', err);
    }
  }, []);

  const fetchConversationHistory = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/conversations');
      const data = await res.json();
      setConversationHistory(data);
    } catch (err) {
      console.warn('Failed to fetch conversation history:', err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchTopicHistory();
    fetchConversationHistory();
    
    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to NodePTY Backend');
      setWs(socket);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error', err);
      // We don't set global error here to avoid spamming the UI on reconnects,
      // but it will be logged.
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'status') {
        setAgents(prev => prev.map(a =>
          a.id === message.id ? { ...a, status: message.status } : a
        ));
      } else if (message.type === 'usage') {
        setAgents(prev => prev.map(a =>
          a.id === message.id ? { ...a, usage: message.usage } : a
        ));
      } else if (message.type === 'provider') {
        setAgents(prev => prev.map(a =>
          a.id === message.id ? { ...a, provider: message.provider } : a
        ));
      } else if (message.type === 'model') {
        setAgents(prev => prev.map(a =>
          a.id === message.id ? { ...a, model: message.model } : a
        ));
      } else if (message.type === 'external_usage') {
        setAgents(prev => prev.map(a =>
          a.id === message.id ? { ...a, externalUsage: message.externalUsage } : a
        ));
        // Update global usage tracker
        setAgents(prev => {
          const agent = prev.find(a => a.id === message.id);
          if (agent?.provider) {
            setGlobalUsage(g => ({ ...g, [agent.provider!]: message.externalUsage }));
          }
          return prev;
        });
      } else if (message.type === 'agent_message') {
        console.log(`[App] Agent reply from ${message.from}: ${message.payload}`);
      } else if (message.type === 'conversation_started') {
        setGlobalError(null);
        setActiveConversationId(message.conversation?.id || null);
        setActiveConversation(message.conversation || null);
        console.log(`[App] Started conversation ${message.conversation?.id ?? 'unknown'}`);
        fetchTopicHistory();
      } else if (message.type === 'conversation') {
        console.log(`[App] Conversation update ${message.conversation?.id ?? 'unknown'}: ${message.conversation?.status ?? 'unknown'}`);
        if (message.conversation?.id === activeConversationId) {
          setActiveConversation(message.conversation);
        }
        if (message.conversation?.status === 'completed') {
          fetchConversationHistory();
        }
      } else if (message.type === 'conversation_error') {
        setGlobalError(`Failed to start conversation: ${message.error}`);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from NodePTY Backend');
      setWs(null);
    };

    return () => socket.close();
  }, [fetchAgents, activeConversationId, fetchTopicHistory, fetchConversationHistory]);

  const createAgent = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const res = await fetchWithTimeout('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, 15000);

      const data = await res.json();
      setSelectedAgentId(data.id);

      // Auto-start with the selected provider-backed agent
      await fetchWithTimeout(`/api/agents/${data.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: getAgentCommand(provider, selectedModel || modelOptions[provider][0].value) }),
      }, 10000);

      await fetchAgents();
    } catch (err) {
      handleError('Failed to create agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeAgent = async (id: string) => {
    setGlobalError(null);
    try {
      await fetchWithTimeout(`/api/agents/${id}`, {
        method: 'DELETE',
      });
      setAgents(prev => prev.filter(a => a.id !== id));
      if (selectedAgentId === id) {
        setSelectedAgentId(null);
      }
    } catch (err) {
      handleError('Failed to remove agent:', err);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'message', text: messageInput.trim() }));
    setMessageInput('');
    messageInputRef.current?.focus();
  };

  const startConversation = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setGlobalError('Conversation requires an open WebSocket connection.');
      return;
    }

    const agentIds = [conversationAgentA, conversationAgentB, conversationAgentC].filter(Boolean);
    const uniqueAgentIds = [...new Set(agentIds)];

    if (uniqueAgentIds.length < 2) {
      setGlobalError('Select at least two different agents before starting the conversation.');
      return;
    }

    setGlobalError(null);
    ws.send(JSON.stringify({
      type: 'start_pair_chat', // keeping the name for protocol compatibility
      agentIds: uniqueAgentIds,
      topic: topic.trim(),
      maxReplies: maxReplies,
    }));
  };

  const conversationCandidates = agents.filter(agent => agent.status === 'ready' || agent.status === 'busy');
  const selectedAgentColor = selectedAgentId ? getAgentColor(selectedAgentId) : null;
  const getConversationSelectStyle = (agentId: string) => {
    const color = agentId ? getAgentColor(agentId) : null;
    return {
      backgroundColor: color ? color.tint : '#1e1e1e',
      color: color ? color.text : '#ddd',
      border: `1px solid ${color ? color.accent : '#3b3b3b'}`,
      boxShadow: color ? `inset 0 0 0 1px ${color.glow}` : 'none',
      borderRadius: '6px',
      padding: '8px 10px',
      fontSize: '13px',
      outline: 'none',
      transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    } as const;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <Activity size={14} color="#4caf50" />;
      case 'starting': return <Activity size={14} color="#ffeb3b" className="animate-pulse" />;
      case 'error': return <AlertCircle size={14} color="#f44336" />;
      default: return <Activity size={14} color="#9e9e9e" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* Global Error Notification */}
      {globalError && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ef4444',
          color: theme.textBright,
          padding: '12px 24px',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '80%'
        }}>
          <AlertCircle size={20} />
          <div style={{ flex: 1, fontSize: '14px', wordBreak: 'break-word' }}>
            {globalError}
          </div>
          <button 
            onClick={() => setGlobalError(null)}
            style={{ background: 'none', border: 'none', color: theme.textBright, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '390px', 
          borderRight: '1px solid #333', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: theme.bgRaised 
        }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Agents</h2>
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', borderBottom: `1px solid ${theme.border}` }}>
              <button onClick={() => setActiveSidebarTab('new-agent')} style={sidebarTabButtonStyle('new-agent')}>
                <Plus size={14} /> Agent
              </button>
              <button onClick={() => setActiveSidebarTab('conversation')} style={sidebarTabButtonStyle('conversation')}>
                <MessagesSquare size={14} /> Conv
              </button>
              <button onClick={() => { setActiveSidebarTab('history'); fetchConversationHistory(); }} style={sidebarTabButtonStyle('history')}>
                <Clock size={14} /> History
              </button>
              <button onClick={() => setActiveSidebarTab('usage')} style={sidebarTabButtonStyle('usage')}>
                <Activity size={14} /> Usage
              </button>
            </div>

            {activeSidebarTab === 'usage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Subscription Quotas
                </span>
                <ExternalUsageDisplay 
                  provider="Claude" 
                  output={globalUsage['claude']} 
                  isGreyed={!globalUsage['claude']} 
                />
                <ExternalUsageDisplay 
                  provider="Gemini" 
                  output={globalUsage['gemini']} 
                  isGreyed={!globalUsage['gemini']} 
                />
                <ExternalUsageDisplay 
                  provider="Codex" 
                  output={globalUsage['codex']} 
                  isGreyed={!globalUsage['codex']} 
                />
              </div>
            )}

            {activeSidebarTab === 'new-agent' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    New Agent Provider
                  </span>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as Provider;
                      setProvider(newProvider);
                      setSelectedModel(modelOptions[newProvider][0].value);
                    }}
                    disabled={loading}
                    style={{
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      border: `1px solid ${theme.borderInput}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Model
                  </span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={loading}
                    style={{
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      border: `1px solid ${theme.borderInput}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    {modelOptions[provider].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button 
                  onClick={createAgent} 
                  disabled={loading}
                  title={`Create ${provider} agent`}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.borderInput}`,
                    color: theme.textBright,
                    borderRadius: '6px',
                    padding: '9px 10px',
                    cursor: 'pointer',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  <Plus size={16} />
                  Create Agent
                </button>
              </>
            )}

            {activeSidebarTab === 'conversation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Multi-Agent Conversation
                </span>
                <select
                  value={conversationAgentA}
                  onChange={(e) => setConversationAgentA(e.target.value)}
                  style={getConversationSelectStyle(conversationAgentA)}
                >
                  <option value="">Agent A</option>
                  {conversationCandidates.map((agent) => (
                    <option key={`a-${agent.id}`} value={agent.id}>
                      {agent.id}
                    </option>
                  ))}
                </select>
                <select
                  value={conversationAgentB}
                  onChange={(e) => setConversationAgentB(e.target.value)}
                  style={getConversationSelectStyle(conversationAgentB)}
                >
                  <option value="">Agent B</option>
                  {conversationCandidates.map((agent) => (
                    <option key={`b-${agent.id}`} value={agent.id}>
                      {agent.id}
                    </option>
                  ))}
                </select>
                <select
                  value={conversationAgentC}
                  onChange={(e) => setConversationAgentC(e.target.value)}
                  style={getConversationSelectStyle(conversationAgentC)}
                >
                  <option value="">Agent C (Optional)</option>
                  {conversationCandidates.map((agent) => (
                    <option key={`c-${agent.id}`} value={agent.id}>
                      {agent.id}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: theme.textDim, textTransform: 'uppercase' }}>Max replies per agent</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxReplies}
                    onChange={(e) => setMaxReplies(parseInt(e.target.value) || 1)}
                    style={{
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      border: `1px solid ${theme.borderInput}`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: theme.textDim, textTransform: 'uppercase' }}>Discussion Topic</span>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Topic History"
                    >
                      <History size={14} />
                    </button>
                  </div>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      border: `1px solid ${theme.borderInput}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      outline: 'none',
                      minHeight: '80px',
                      maxHeight: '150px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.4',
                    }}
                  />
                  
                  {showHistory && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: theme.bgSurface,
                      border: `1px solid ${theme.borderLight}`,
                      borderRadius: '6px',
                      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.5)',
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      marginBottom: '8px',
                    }}>
                      <div style={{ padding: '8px 12px', fontSize: '11px', color: theme.textMuted, borderBottom: '1px solid #3d3d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>PAST TOPICS</span>
                        <X size={12} style={{ cursor: 'pointer' }} onClick={() => setShowHistory(false)} />
                      </div>
                      {topicHistory.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '12px', color: theme.textDim, textAlign: 'center' }}>No history yet</div>
                      ) : (
                        topicHistory.map((h, i) => (
                          <div
                            key={i}
                            onClick={() => { setTopic(h); setShowHistory(false); }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              color: theme.textSecondary,
                              cursor: 'pointer',
                              borderBottom: i === topicHistory.length - 1 ? 'none' : '1px solid #3d3d3d',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#3d3d3d'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            title={h}
                          >
                            {h}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={startConversation}
                  disabled={!ws || ws.readyState !== WebSocket.OPEN || [...new Set([conversationAgentA, conversationAgentB, conversationAgentC].filter(Boolean))].length < 2}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                    border: `1px solid ${theme.borderInput}`,
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: (!ws || ws.readyState !== WebSocket.OPEN || [...new Set([conversationAgentA, conversationAgentB, conversationAgentC].filter(Boolean))].length < 2) ? 0.5 : 1,
                  }}
                >
                  <MessagesSquare size={14} />
                  Start Conversation
                </button>
              </div>
            )}

            {activeSidebarTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  Past Conversations
                </span>
                {conversationHistory.length === 0 ? (
                  <div style={{ fontSize: '12px', color: theme.textDim, textAlign: 'center', padding: '20px 0' }}>No conversations yet</div>
                ) : (
                  conversationHistory.map((conv) => {
                    const msgCount = conv.transcript.filter(e => e.kind === 'message').length;
                    const isActive = conv.id === activeConversationId;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => { setActiveConversationId(conv.id); setActiveConversation(conv); setSelectedAgentId(null); }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          backgroundColor: isActive ? '#3a3d49' : '#252526',
                          border: isActive ? '1px solid #555' : '1px solid #333',
                          borderRadius: '6px',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseOver={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#2d2d2d'; }}
                        onMouseOut={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#252526'; }}
                      >
                        <div style={{ fontSize: '11px', color: theme.textSubtle, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{new Date(conv.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            backgroundColor: conv.status === 'completed' ? '#2d4a2d' : '#4a3d2d',
                            color: conv.status === 'completed' ? '#4caf50' : '#e0a030',
                          }}>
                            {conv.status}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: theme.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.3',
                          marginBottom: '6px',
                        }}>
                          {conv.topic}
                        </div>
                        <div style={{ fontSize: '10px', color: theme.textDim, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{conv.agentIds.join(', ')} · {msgCount} messages</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch(`/api/conversations/${conv.id}`, { method: 'DELETE' }).then(() => {
                                if (activeConversationId === conv.id) {
                                  setActiveConversationId(null);
                                  setActiveConversation(null);
                                }
                                fetchConversationHistory();
                              });
                            }}
                            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            onMouseOver={(e) => { e.currentTarget.style.color = '#e06c75'; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = '#666'; }}
                            title="Remove conversation"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {agents.map(agent => (
              <div 
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
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
                  flexShrink: 0,
                }}>
                  <TerminalIcon size={14} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '13px', color: selectedAgentId === agent.id ? getAgentColor(agent.id).text : '#ddd' }}>
                    {agent.id}
                    {agent.provider && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: theme.textDim, fontWeight: 'normal' }}>
                        ({agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1)}
                        {agent.model ? `: ${agent.model}` : ''})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {getStatusIcon(agent.status)} {agent.status}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeAgent(agent.id); }}
                  title="Remove Agent"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: theme.textMuted, 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s, background-color 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg }}>
          {activeConversationId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '8px 16px', backgroundColor: theme.bgSurface, fontSize: '12px', color: theme.textSecondary, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div>Conversation: <strong>{activeConversationId}</strong></div>
                  {activeConversation?.agentIds?.length ? (
                    <div style={{ color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {activeConversation.agentIds.map((agentId) => {
                        const color = getAgentColor(agentId);
                        return (
                          <span
                            key={agentId}
                            style={{
                              color: color.accent,
                              backgroundColor: color.tint,
                              border: `1px solid ${color.glow}`,
                              borderRadius: '999px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {agentId}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {activeConversation?.status === 'completed' && (
                    <span style={{ fontSize: '10px', backgroundColor: theme.success, color: theme.textBright, padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      Conversation Finished
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => { setActiveConversationId(null); setActiveConversation(null); }}
                  style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  Close Conversation View
                </button>
              </div>
              {activeConversation && <ConversationTranscript conversation={activeConversation} />}
            </div>
          ) : selectedAgentId ? (
            <>
              <div style={{ padding: '8px 16px', backgroundColor: theme.bgSurface, fontSize: '12px', color: theme.textSecondary, borderBottom: `1px solid ${theme.border}`, borderTop: selectedAgentColor ? `2px solid ${selectedAgentColor.accent}` : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedAgentColor && (
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '999px',
                      backgroundColor: selectedAgentColor.accent,
                      boxShadow: `0 0 0 3px ${selectedAgentColor.tint}`,
                      flexShrink: 0,
                    }} />
                  )}
                  <div>Connected to: <strong style={{ color: selectedAgentColor?.accent }}>{selectedAgentId}</strong></div>
                </div>
                {selectedAgent?.usage && (
                  <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                    Usage: <strong>{selectedAgent.usage.total.toLocaleString()}</strong> / {selectedAgent.usage.limit.toLocaleString()} ({((selectedAgent.usage.total / selectedAgent.usage.limit) * 100).toFixed(2)}%)
                  </div>
                )}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <ErrorBoundary>
                  <TerminalView key={selectedAgentId} agentId={selectedAgentId} ws={ws} />
                </ErrorBoundary>
              </div>
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid #333',
                backgroundColor: theme.bgSurface,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>

                {topic.trim() && (
                  <button
                    onClick={() => setMessageInput(topic.trim())}
                    style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    onMouseOver={(e) => { e.currentTarget.style.color = selectedAgentColor?.accent || '#aaa'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#666'; }}
                    title="Use conversation topic"
                  >
                    <MessagesSquare size={14} />
                  </button>
                )}
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                  placeholder="Send protocol message to agent..."
                  style={{
                    flex: 1,
                    backgroundColor: theme.bg,
                    border: `1px solid ${theme.borderLight}`,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: theme.textSecondary,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || !ws || ws.readyState !== WebSocket.OPEN}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: messageInput.trim() ? (selectedAgentColor?.accent || '#4caf50') : '#555',
                    cursor: messageInput.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: theme.textDim }}>
              <div style={{ textAlign: 'center' }}>
                <TerminalIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <div>Select an agent from the sidebar or spawn a new one.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
