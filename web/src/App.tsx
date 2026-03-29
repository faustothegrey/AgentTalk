import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ErrorBoundary } from './ErrorBoundary';
import { Plus, Terminal as TerminalIcon, Activity, AlertCircle, X, Send, MessagesSquare, Trash2, History } from 'lucide-react';

type Provider = 'claude' | 'gemini' | 'codex';
type SidebarTab = 'new-agent' | 'conversation' | 'usage';

interface Agent {
  id: string;
  status: string;
  usage?: { total: number; limit: number };
  provider?: string;
  model?: string;
  externalUsage?: string;
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
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
  const [maxReplies, setMaxReplies] = useState<number>(5);
  const [topic, setTopic] = useState('Discuss the current NodePTY project and propose concrete next-step implementation ideas or simplifications: architecture quality, risks, and the most useful changes to make next.');
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('new-agent');
  const messageInputRef = useRef<HTMLInputElement>(null);

  const sidebarTabButtonStyle = (tab: SidebarTab) => ({
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    backgroundColor: activeSidebarTab === tab ? '#3a3d49' : 'transparent',
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

  useEffect(() => {
    fetchAgents();
    fetchTopicHistory();
    
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
      } else if (message.type === 'scenario_started') {
        setGlobalError(null);
        console.log(`[App] Started scenario ${message.scenario?.id ?? 'unknown'}`);
        fetchTopicHistory();
      } else if (message.type === 'scenario') {
        console.log(`[App] Scenario update ${message.scenario?.id ?? 'unknown'}: ${message.scenario?.status ?? 'unknown'}`);
      } else if (message.type === 'scenario_error') {
        setGlobalError(`Failed to start two-agent conversation: ${message.error}`);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from NodePTY Backend');
      setWs(null);
    };

    return () => socket.close();
  }, [fetchAgents]);

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

  const startTwoAgentConversation = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setGlobalError('Two-agent conversation requires an open WebSocket connection.');
      return;
    }

    if (!conversationAgentA || !conversationAgentB) {
      setGlobalError('Select two agents before starting the conversation.');
      return;
    }

    if (conversationAgentA === conversationAgentB) {
      setGlobalError('Choose two different agents for the conversation.');
      return;
    }

    setGlobalError(null);
    ws.send(JSON.stringify({
      type: 'start_pair_chat',
      agentAId: conversationAgentA,
      agentBId: conversationAgentB,
      topic: topic.trim(),
      maxReplies: maxReplies,
    }));
  };

  const conversationCandidates = agents.filter(agent => agent.status === 'ready' || agent.status === 'busy');

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
          color: '#fff',
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
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
          backgroundColor: '#252526' 
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Agents</h2>
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid #333' }}>
              <button onClick={() => setActiveSidebarTab('new-agent')} style={sidebarTabButtonStyle('new-agent')}>
                <Plus size={14} /> Agent
              </button>
              <button onClick={() => setActiveSidebarTab('conversation')} style={sidebarTabButtonStyle('conversation')}>
                <MessagesSquare size={14} /> Pair
              </button>
              <button onClick={() => setActiveSidebarTab('usage')} style={sidebarTabButtonStyle('usage')}>
                <Activity size={14} /> Usage
              </button>
            </div>

            {activeSidebarTab === 'usage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
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
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
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
                      backgroundColor: '#1e1e1e',
                      color: '#ddd',
                      border: '1px solid #3b3b3b',
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
                  <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Model
                  </span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={loading}
                    style={{
                      backgroundColor: '#1e1e1e',
                      color: '#ddd',
                      border: '1px solid #3b3b3b',
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
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #3b3b3b',
                    color: '#fff',
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
                <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Two-Agent Scenario
                </span>
                <select
                  value={conversationAgentA}
                  onChange={(e) => setConversationAgentA(e.target.value)}
                  style={{
                    backgroundColor: '#1e1e1e',
                    color: '#ddd',
                    border: '1px solid #3b3b3b',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
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
                  style={{
                    backgroundColor: '#1e1e1e',
                    color: '#ddd',
                    border: '1px solid #3b3b3b',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="">Agent B</option>
                  {conversationCandidates.map((agent) => (
                    <option key={`b-${agent.id}`} value={agent.id}>
                      {agent.id}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Max replies per agent</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxReplies}
                    onChange={(e) => setMaxReplies(parseInt(e.target.value) || 1)}
                    style={{
                      backgroundColor: '#1e1e1e',
                      color: '#ddd',
                      border: '1px solid #3b3b3b',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Discussion Topic</span>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Topic History"
                    >
                      <History size={14} />
                    </button>
                  </div>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{
                      backgroundColor: '#1e1e1e',
                      color: '#ddd',
                      border: '1px solid #3b3b3b',
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
                      backgroundColor: '#2d2d2d',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.5)',
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      marginBottom: '8px',
                    }}>
                      <div style={{ padding: '8px 12px', fontSize: '11px', color: '#888', borderBottom: '1px solid #3d3d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>PAST TOPICS</span>
                        <X size={12} style={{ cursor: 'pointer' }} onClick={() => setShowHistory(false)} />
                      </div>
                      {topicHistory.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '12px', color: '#666', textAlign: 'center' }}>No history yet</div>
                      ) : (
                        topicHistory.map((h, i) => (
                          <div
                            key={i}
                            onClick={() => { setTopic(h); setShowHistory(false); }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              color: '#ccc',
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
                  onClick={startTwoAgentConversation}
                  disabled={!ws || ws.readyState !== WebSocket.OPEN || !conversationAgentA || !conversationAgentB || conversationAgentA === conversationAgentB}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#1e1e1e',
                    color: '#ddd',
                    border: '1px solid #3b3b3b',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: (!ws || ws.readyState !== WebSocket.OPEN || !conversationAgentA || !conversationAgentB || conversationAgentA === conversationAgentB) ? 0.5 : 1,
                  }}
                >
                  <MessagesSquare size={14} />
                  Start Project Discussion
                </button>
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
                  backgroundColor: selectedAgentId === agent.id ? '#37373d' : 'transparent',
                  borderBottom: '1px solid #2d2d2d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <TerminalIcon size={16} />
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '13px' }}>
                    {agent.id}
                    {agent.provider && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: '#666', fontWeight: 'normal' }}>
                        ({agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1)}
                        {agent.model ? `: ${agent.model}` : ''})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {getStatusIcon(agent.status)} {agent.status}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeAgent(agent.id); }}
                  title="Remove Agent"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#888', 
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
          {selectedAgentId ? (
            <>
              <div style={{ padding: '8px 16px', backgroundColor: '#2d2d2d', fontSize: '12px', color: '#ccc', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>Connected to: <strong>{selectedAgentId}</strong></div>
                {selectedAgent?.usage && (
                  <div style={{ color: '#888', fontSize: '11px' }}>
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
                backgroundColor: '#2d2d2d',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Send size={14} color="#888" />
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                  placeholder="Send protocol message to agent..."
                  style={{
                    flex: 1,
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: '#ccc',
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
                    color: messageInput.trim() ? '#4caf50' : '#555',
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
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
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
