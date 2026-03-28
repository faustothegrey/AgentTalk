import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ErrorBoundary } from './ErrorBoundary';
import { Plus, Terminal as TerminalIcon, Activity, AlertCircle, X, Send } from 'lucide-react';

interface Agent {
  id: string;
  status: string;
  surface: any;
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

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const messageInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetchAgents();
    
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
      } else if (message.type === 'agent_message') {
        console.log(`[App] Agent reply from ${message.from}: ${message.payload}`);
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
        body: JSON.stringify({ splitDirection: 'right' }),
      }, 15000);

      const data = await res.json();
      setSelectedAgentId(data.id);

      // Auto-start with test agent
      await fetchWithTimeout(`/api/agents/${data.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'node scripts/llm-agent.mjs' }),
      }, 10000);

      await fetchAgents();
    } catch (err) {
      handleError('Failed to create agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'message', text: messageInput.trim() }));
    setMessageInput('');
    messageInputRef.current?.focus();
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
          width: '260px', 
          borderRight: '1px solid #333', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#252526' 
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Agents</h2>
            <button 
              onClick={createAgent} 
              disabled={loading}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#fff', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: loading ? 0.5 : 1
              }}
            >
              <Plus size={18} />
            </button>
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
                  <div style={{ fontSize: '13px' }}>{agent.id}</div>
                  <div style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {getStatusIcon(agent.status)} {agent.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}>
          {selectedAgentId ? (
            <>
              <div style={{ padding: '8px 16px', backgroundColor: '#2d2d2d', fontSize: '12px', color: '#ccc', borderBottom: '1px solid #333' }}>
                Connected to: <strong>{selectedAgentId}</strong>
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
