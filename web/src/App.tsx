import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ErrorBoundary } from './ErrorBoundary';
import { Plus, Terminal as TerminalIcon, Activity, AlertCircle, X, Send, MessagesSquare, Trash2, History, Copy, Check, Users, Settings } from 'lucide-react';
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
type TopLevelTab = 'agents' | 'config';
type SidebarTab = 'conversation' | 'team';

interface Agent {
  id: string;
  status: string;
  usage?: { total: number; limit: number };
  provider?: string;
  model?: string;
  workingDirectory?: string;
}

interface TranscriptEntry {
  kind: 'system' | 'message';
  timestamp: string;
  from: string;
  to: string;
  payload: string;
}

interface TeamMember {
  agentId: string;
  role: 'planner' | 'worker';
}

type TeamComposition = 'worker-only' | 'planner-worker';

interface Team {
  id: string;
  members: TeamMember[];
  status: string;
  currentTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamTask {
  id: string;
  teamId: string;
  description: string;
  plan?: string;
  plannerAgentId?: string;
  planningComplete?: boolean;
  planSubmittedAt?: string;
  planConfirmed?: boolean;
  workerAccepted?: boolean;
  workerRefusalReason?: string;
  status: string;
  transcript: TranscriptEntry[];
  createdAt: string;
  updatedAt: string;
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

interface SidebarEventEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  label: string;
  detail: string;
}

interface DirectoryBrowserEntry {
  name: string;
  path: string;
}

interface DirectoryBrowserResponse {
  path: string;
  parentPath: string | null;
  directories: DirectoryBrowserEntry[];
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
    { value: 'gemini-2.5-pro', label: '2.5 Pro' },
    { value: 'gemini-3.1-pro-preview', label: '3.1 Pro (Preview)' },
    { value: 'gemini-3-pro-preview', label: '3 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: '3 Flash (Preview)' },
    { value: 'gemini-2.5-flash', label: '2.5 Flash' },
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

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const [sidebarEvents, setSidebarEvents] = useState<SidebarEventEntry[]>([]);
  const [sidebarEventsCollapsed, setSidebarEventsCollapsed] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [selectedModel, setSelectedModel] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('.');
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);
  const [directoryPickerPath, setDirectoryPickerPath] = useState('.');
  const [directoryPickerParentPath, setDirectoryPickerParentPath] = useState<string | null>(null);
  const [directoryPickerEntries, setDirectoryPickerEntries] = useState<DirectoryBrowserEntry[]>([]);
  const [directoryPickerLoading, setDirectoryPickerLoading] = useState(false);
  const [conversationAgentA, setConversationAgentA] = useState<string>('');
  const [conversationAgentB, setConversationAgentB] = useState<string>('');
  const [conversationAgentC, setConversationAgentC] = useState<string>('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [maxReplies, setMaxReplies] = useState<number>(5);
  const [topic, setTopic] = useState('Discuss the current AgentTalk project and propose concrete next-step implementation ideas or simplifications: architecture quality, risks, and the most useful changes to make next.');
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([]);
  const [activeTopTab, setActiveTopTab] = useState<TopLevelTab>('agents');
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('conversation');
  const [_teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeTeamTask, setActiveTeamTask] = useState<TeamTask | null>(null);
  const [teamComposition, setTeamComposition] = useState<TeamComposition>('worker-only');
  const [teamPlannerAgent, setTeamPlannerAgent] = useState('');
  const [teamWorkerAgent, setTeamWorkerAgent] = useState('');
  const [teamTaskInput, setTeamTaskInput] = useState('');
  const [teamMessageInput, setTeamMessageInput] = useState('');
  const [teamMessageRole, setTeamMessageRole] = useState<'planner' | 'worker'>('planner');
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);

  const topTabButtonStyle = (tab: TopLevelTab) => ({
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    backgroundColor: activeTopTab === tab ? theme.bgActive : 'transparent',
    color: activeTopTab === tab ? '#fff' : '#888',
    border: 'none',
    borderBottom: activeTopTab === tab ? '2px solid #fff' : '2px solid transparent',
    cursor: 'pointer',
    flex: 1,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  });

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
  const activePlanner = activeTeam?.members.find(m => m.role === 'planner');
  const activeWorker = activeTeam?.members.find(m => m.role === 'worker');
  const availableTeamMessageRoles = activeTeam?.members.map(m => m.role) ?? [];

  const handleError = (msg: string, err: any) => {
    console.error(msg, err);
    setGlobalError(`${msg} ${err?.message || ''}`);
  };

  const pushSidebarEvent = useCallback((direction: SidebarEventEntry['direction'], label: string, detail: string) => {
    const normalized = detail.trim();
    setSidebarEvents(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        direction,
        label,
        detail: normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized,
      },
      ...prev,
    ].slice(0, 40));
  }, []);

  useEffect(() => {
    if (!globalNotice) return;
    const timer = setTimeout(() => setGlobalNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [globalNotice]);

  useEffect(() => {
    if (availableTeamMessageRoles.length === 0) return;
    if (!availableTeamMessageRoles.includes(teamMessageRole)) {
      setTeamMessageRole(availableTeamMessageRoles[0]);
    }
  }, [availableTeamMessageRoles, teamMessageRole]);

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

  const loadDirectoryEntries = useCallback(async (targetPath: string) => {
    setDirectoryPickerLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/fs/directories?path=${encodeURIComponent(targetPath)}`);
      const data = await res.json() as DirectoryBrowserResponse;
      setDirectoryPickerPath(data.path);
      setDirectoryPickerParentPath(data.parentPath);
      setDirectoryPickerEntries(data.directories);
    } catch (err) {
      handleError('Failed to browse directories:', err);
    } finally {
      setDirectoryPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    fetchAgents();
    fetchTopicHistory();
    fetchConversationHistory();

    let cancelled = false;
    let currentSocket: WebSocket | null = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      currentSocket = socket;

      socket.onopen = () => {
        console.log('Connected to AgentTalk Backend');
        setWs(socket);
        pushSidebarEvent('system', 'WS Open', 'Connected to backend WebSocket');
        fetchAgents();
      };

      socket.onerror = (err) => {
        console.error('WebSocket Error', err);
        pushSidebarEvent('system', 'WS Error', 'WebSocket error');
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'status') {
          pushSidebarEvent('in', `Status:${message.id}`, String(message.status));
          setAgents(prev => prev.map(a =>
            a.id === message.id ? { ...a, status: message.status } : a
          ));
        } else if (message.type === 'usage') {
          pushSidebarEvent('in', `Usage:${message.id}`, JSON.stringify(message.usage));
          setAgents(prev => prev.map(a =>
            a.id === message.id ? { ...a, usage: message.usage } : a
          ));
        } else if (message.type === 'provider') {
          pushSidebarEvent('in', `Provider:${message.id}`, String(message.provider));
          setAgents(prev => prev.map(a =>
            a.id === message.id ? { ...a, provider: message.provider } : a
          ));
        } else if (message.type === 'model') {
          pushSidebarEvent('in', `Model:${message.id}`, String(message.model));
          setAgents(prev => prev.map(a =>
            a.id === message.id ? { ...a, model: message.model } : a
          ));
        } else if (message.type === 'agent_message') {
          pushSidebarEvent('in', `Agent:${message.from}`, String(message.payload));
          console.log(`[App] Agent reply from ${message.from}: ${message.payload}`);
        } else if (message.type === 'conversation_started') {
          pushSidebarEvent('in', 'Conversation', `Started ${message.conversation?.id ?? 'unknown'}`);
          setGlobalError(null);
          setActiveConversationId(message.conversation?.id || null);
          setActiveConversation(message.conversation || null);
          console.log(`[App] Started conversation ${message.conversation?.id ?? 'unknown'}`);
          fetchTopicHistory();
        } else if (message.type === 'conversation') {
          pushSidebarEvent('in', 'Conversation Update', `${message.conversation?.id ?? 'unknown'} → ${message.conversation?.status ?? 'unknown'}`);
          console.log(`[App] Conversation update ${message.conversation?.id ?? 'unknown'}: ${message.conversation?.status ?? 'unknown'}`);
          if (message.conversation?.id === activeConversationIdRef.current) {
            setActiveConversation(message.conversation);
          }
          if (message.conversation?.status === 'completed') {
            fetchConversationHistory();
          }
        } else if (message.type === 'conversation_error') {
          pushSidebarEvent('system', 'Conversation Error', String(message.error));
          setGlobalError(`Failed to start conversation: ${message.error}`);
        } else if (message.type === 'team_updated') {
          pushSidebarEvent('in', `Team:${message.team.id}`, `status=${message.team.status}`);
          setTeams(prev => {
            const idx = prev.findIndex(t => t.id === message.team.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = message.team;
              return updated;
            }
            return [...prev, message.team];
          });
          setActiveTeam(prev => prev?.id === message.team.id ? message.team : prev);
        } else if (message.type === 'team_task_updated') {
          pushSidebarEvent('in', `Task:${message.task.id}`, `status=${message.task.status}`);
          setActiveTeamTask(prev =>
            prev?.id === message.task.id || prev === null ? message.task : prev
          );
        } else if (message.type === 'team_planning_complete') {
          pushSidebarEvent('in', `Plan:${message.taskId}`, `completed by ${message.plannerAgentId}`);
          const submittedAt = typeof message.planSubmittedAt === 'string'
            ? new Date(message.planSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : null;
          setGlobalNotice(
            `Planner ${message.plannerAgentId} finished the plan${submittedAt ? ` at ${submittedAt}` : ''}.`
          );
        }
      };

      socket.onclose = () => {
        console.log('Disconnected from AgentTalk Backend');
        setWs(null);
        pushSidebarEvent('system', 'WS Closed', 'Disconnected from backend WebSocket');
        if (!cancelled) {
          setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      currentSocket?.close();
    };
  }, [fetchAgents, fetchTopicHistory, fetchConversationHistory, pushSidebarEvent]);

  const createAgent = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const command = getAgentCommand(provider, selectedModel || modelOptions[provider][0].value);
      const res = await fetchWithTimeout('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      }, 15000);

      const data = await res.json();
      setSelectedAgentId(data.id);
      pushSidebarEvent('out', 'Create Agent', `${data.id} via ${provider}${selectedModel ? ` (${selectedModel})` : ''}`);

      // Auto-start with the selected provider-backed agent
      await fetchWithTimeout(`/api/agents/${data.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, workingDirectory }),
      }, 10000);
      pushSidebarEvent(
        'out',
        'Start Agent',
        `${data.id} with ${command}${workingDirectory.trim() ? ` @ ${workingDirectory.trim()}` : ''}`,
      );

      await fetchAgents();
    } catch (err) {
      handleError('Failed to create agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDirectoryPicker = async () => {
    setGlobalError(null);
    setDirectoryPickerOpen(true);
    await loadDirectoryEntries(workingDirectory.trim() || '.');
  };

  const closeDirectoryPicker = () => {
    setDirectoryPickerOpen(false);
    setDirectoryPickerLoading(false);
  };

  const removeAgent = async (id: string) => {
    setGlobalError(null);
    try {
      await fetchWithTimeout(`/api/agents/${id}`, {
        method: 'DELETE',
      });
      pushSidebarEvent('out', 'Remove Agent', id);
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
    const text = messageInput.trim();
    ws.send(JSON.stringify({ type: 'message', text }));
    pushSidebarEvent('out', `Message:${selectedAgentId ?? 'agent'}`, text);
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
    pushSidebarEvent('out', 'Conversation Request', `${uniqueAgentIds.join(', ')} | ${topic.trim() || 'default topic'}`);
    ws.send(JSON.stringify({
      type: 'start_pair_chat', // keeping the name for protocol compatibility
      agentIds: uniqueAgentIds,
      topic: topic.trim(),
      maxReplies: maxReplies,
    }));
  };

  const conversationCandidates = agents.filter(agent => agent.status === 'ready' || agent.status === 'busy');
  const selectedAgentColor = selectedAgentId ? getAgentColor(selectedAgentId) : null;
  const sendTeamMessage = () => {
    if (!teamMessageInput.trim() || !ws || ws.readyState !== WebSocket.OPEN || !activeTeamTask) return;
    const text = teamMessageInput.trim();
    ws.send(JSON.stringify({ type: 'team_message', taskId: activeTeamTask.id, role: teamMessageRole, text }));
    pushSidebarEvent('out', `Team Msg:${teamMessageRole}`, text);
    setTeamMessageInput('');
  };
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

      {globalNotice && (
        <div style={{
          position: 'absolute',
          top: globalError ? '76px' : '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f5f3a',
          color: theme.textBright,
          padding: '10px 18px',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
          zIndex: 9998,
          maxWidth: '80%',
          fontSize: '13px',
          wordBreak: 'break-word',
        }}>
          {globalNotice}
        </div>
      )}

      {directoryPickerOpen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          zIndex: 9997,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            width: 'min(760px, 100%)',
            maxHeight: '80vh',
            backgroundColor: theme.bgRaised,
            border: `1px solid ${theme.borderLight}`,
            borderRadius: '10px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '14px 16px',
              borderBottom: `1px solid ${theme.border}`,
            }}>
              <div>
                <div style={{ fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Choose Directory
                </div>
                <div style={{ fontSize: '13px', color: theme.textPrimary, wordBreak: 'break-all', marginTop: '4px' }}>
                  {directoryPickerPath}
                </div>
              </div>
              <button
                onClick={closeDirectoryPicker}
                style={{ background: 'none', border: 'none', color: theme.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '12px 16px',
              borderBottom: `1px solid ${theme.border}`,
            }}>
              <button
                onClick={() => directoryPickerParentPath && loadDirectoryEntries(directoryPickerParentPath)}
                disabled={!directoryPickerParentPath || directoryPickerLoading}
                style={{
                  padding: '8px 10px',
                  backgroundColor: theme.bg,
                  color: theme.textPrimary,
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '6px',
                  cursor: !directoryPickerParentPath || directoryPickerLoading ? 'not-allowed' : 'pointer',
                  opacity: !directoryPickerParentPath || directoryPickerLoading ? 0.55 : 1,
                }}
              >
                Up
              </button>
              <button
                onClick={() => loadDirectoryEntries(directoryPickerPath)}
                disabled={directoryPickerLoading}
                style={{
                  padding: '8px 10px',
                  backgroundColor: theme.bg,
                  color: theme.textPrimary,
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '6px',
                  cursor: directoryPickerLoading ? 'not-allowed' : 'pointer',
                  opacity: directoryPickerLoading ? 0.55 : 1,
                }}
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  setWorkingDirectory(directoryPickerPath);
                  closeDirectoryPicker();
                }}
                disabled={directoryPickerLoading}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  backgroundColor: theme.success,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: directoryPickerLoading ? 'not-allowed' : 'pointer',
                  opacity: directoryPickerLoading ? 0.55 : 1,
                }}
              >
                Use This Folder
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 0',
              minHeight: '240px',
            }}>
              {directoryPickerLoading ? (
                <div style={{ padding: '24px 16px', color: theme.textMuted, textAlign: 'center', fontSize: '13px' }}>
                  Loading directories...
                </div>
              ) : directoryPickerEntries.length === 0 ? (
                <div style={{ padding: '24px 16px', color: theme.textMuted, textAlign: 'center', fontSize: '13px' }}>
                  No subdirectories found here.
                </div>
              ) : (
                directoryPickerEntries.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => loadDirectoryEntries(entry.path)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
                      cursor: 'pointer',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{entry.name}</span>
                    <span style={{ fontSize: '11px', color: theme.textDim, wordBreak: 'break-all' }}>{entry.path}</span>
                  </button>
                ))
              )}
            </div>
          </div>
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
          {/* Top-level tab bar */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}` }}>
            <button onClick={() => setActiveTopTab('agents')} style={topTabButtonStyle('agents')}>
              <TerminalIcon size={14} /> Agents
            </button>
            <button onClick={() => setActiveTopTab('config')} style={topTabButtonStyle('config')}>
              <Settings size={14} /> Workflow
            </button>
          </div>

          {/* Agents tab content */}
          {activeTopTab === 'agents' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {agents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => { setSelectedAgentId(agent.id); setActiveConversationId(null); setActiveConversation(null); }}
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
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: theme.textSubtle, fontWeight: 'normal' }}>
                          ({agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1)}
                          {agent.model ? `: ${agent.model}` : ''})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textSubtle, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {getStatusIcon(agent.status)} {agent.status}
                      {agent.workingDirectory && agent.workingDirectory !== '.' && (
                        <span style={{ marginLeft: '4px', color: theme.textSubtle }}>
                          · {agent.workingDirectory.split('/').filter(Boolean).pop()}
                        </span>
                      )}
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

              {/* Agent creation section */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: agents.length > 0 ? `1px solid ${theme.border}` : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Working Directory
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={workingDirectory}
                      onChange={(e) => setWorkingDirectory(e.target.value)}
                      disabled={loading}
                      placeholder="."
                      spellCheck={false}
                      style={{
                        flex: 1,
                        backgroundColor: theme.bg,
                        color: theme.textPrimary,
                        border: `1px solid ${theme.borderInput}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={openDirectoryPicker}
                      disabled={loading}
                      style={{
                        backgroundColor: theme.bg,
                        color: theme.textPrimary,
                        border: `1px solid ${theme.borderInput}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '13px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.55 : 1,
                      }}
                    >
                      Browse
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Provider
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
              </div>
            </div>
          )}

          {/* Config tab content */}
          {activeTopTab === 'config' && (
            <>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setActiveSidebarTab('conversation'); fetchConversationHistory(); }} style={sidebarTabButtonStyle('conversation')}>
                <MessagesSquare size={14} /> Chat
              </button>
              <button onClick={() => setActiveSidebarTab('team')} style={sidebarTabButtonStyle('team')}>
                <Users size={14} /> Team
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>

            {activeSidebarTab === 'team' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {/* Team creation */}
                {!activeTeam && (
                  <>
                    <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      Create Team
                    </span>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: theme.textMuted }}>Composition</span>
                      <select
                        value={teamComposition}
                        onChange={e => {
                          const nextComposition = e.target.value as TeamComposition;
                          setTeamComposition(nextComposition);
                          if (nextComposition === 'worker-only') {
                            setTeamPlannerAgent('');
                            setTeamMessageRole('worker');
                          } else if (teamMessageRole === 'worker') {
                            setTeamMessageRole('planner');
                          }
                        }}
                        style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      >
                        <option value="worker-only">Only Worker</option>
                        <option value="planner-worker">Planner + Worker</option>
                      </select>
                    </label>
                    {teamComposition === 'planner-worker' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: theme.textMuted }}>Planner Agent</span>
                      <select
                        value={teamPlannerAgent}
                        onChange={e => setTeamPlannerAgent(e.target.value)}
                        style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      >
                        <option value="">Select...</option>
                        {agents.filter(a => a.status === 'ready' || a.status === 'busy').map(a => (
                          <option key={a.id} value={a.id} disabled={a.id === teamWorkerAgent}>{a.id}</option>
                        ))}
                      </select>
                    </label>
                    )}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: theme.textMuted }}>Worker Agent</span>
                      <select
                        value={teamWorkerAgent}
                        onChange={e => setTeamWorkerAgent(e.target.value)}
                        style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
                      >
                        <option value="">Select...</option>
                        {agents.filter(a => a.status === 'ready' || a.status === 'busy').map(a => (
                          <option key={a.id} value={a.id} disabled={a.id === teamPlannerAgent}>{a.id}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={!teamWorkerAgent || (teamComposition === 'planner-worker' && !teamPlannerAgent)}
                      onClick={async () => {
                        try {
                          const members = teamComposition === 'planner-worker'
                            ? [
                                { agentId: teamPlannerAgent, role: 'planner' as const },
                                { agentId: teamWorkerAgent, role: 'worker' as const },
                              ]
                            : [
                                { agentId: teamWorkerAgent, role: 'worker' as const },
                              ];
                          const res = await fetch('/api/teams', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ members }),
                          });
                          const team = await res.json();
                          if (res.ok) {
                            pushSidebarEvent(
                              'out',
                              'Create Team',
                              teamComposition === 'planner-worker'
                                ? `${teamPlannerAgent} + ${teamWorkerAgent}`
                                : teamWorkerAgent
                            );
                            setActiveTeam(team);
                            setTeams(prev => [...prev, team]);
                          } else {
                            setGlobalError(team.error || 'Failed to create team');
                          }
                        } catch (err: any) {
                          setGlobalError(err.message);
                        }
                      }}
                      style={{
                        padding: '8px',
                        backgroundColor: teamWorkerAgent && (teamComposition === 'worker-only' || teamPlannerAgent) ? theme.success : theme.bgSurface,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: teamWorkerAgent && (teamComposition === 'worker-only' || teamPlannerAgent) ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Create Team
                    </button>
                  </>
                )}

                {/* Active team */}
                {activeTeam && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        Team
                      </span>
                      <span style={{ fontSize: '10px', color: theme.textDim, padding: '2px 6px', backgroundColor: theme.bgSurface, borderRadius: '4px' }}>
                        {activeTeam.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activePlanner && <span>Planner: <strong>{activePlanner.agentId}</strong></span>}
                      {activeWorker && <span>Worker: <strong>{activeWorker.agentId}</strong></span>}
                    </div>

                    {/* Task input */}
                    {(activeTeam.status === 'idle' || activeTeam.status === 'completed') && !activeTeamTask && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        <span style={{ fontSize: '10px', color: theme.textMuted }}>Assign Task</span>
                        <textarea
                          value={teamTaskInput}
                          onChange={e => setTeamTaskInput(e.target.value)}
                          placeholder="Describe the task..."
                          rows={3}
                          style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '12px', resize: 'vertical' }}
                        />
                        <button
                          disabled={!teamTaskInput.trim()}
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/teams/${activeTeam.id}/task`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ description: teamTaskInput }),
                              });
                              const task = await res.json();
                              if (res.ok) {
                                pushSidebarEvent('out', 'Assign Task', teamTaskInput);
                                setActiveTeamTask(task);
                                setTeamTaskInput('');
                              } else {
                                setGlobalError(task.error || 'Failed to assign task');
                              }
                            } catch (err: any) {
                              setGlobalError(err.message);
                            }
                          }}
                          style={{
                            padding: '8px',
                            backgroundColor: teamTaskInput.trim() ? theme.success : theme.bgSurface,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: teamTaskInput.trim() ? 'pointer' : 'not-allowed',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          <Send size={12} /> Submit Task
                        </button>
                      </div>
                    )}

                    {/* Task status */}
                    {activeTeamTask && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: '8px', backgroundColor: theme.bg, borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>Task</span>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: activeTeamTask.status === 'completed' ? '#1a3a1a' : activeTeamTask.status === 'refused' ? '#3a1a1a' : theme.bgSurface, color: activeTeamTask.status === 'completed' ? theme.success : activeTeamTask.status === 'refused' ? theme.error : theme.textMuted }}>
                            {activeTeamTask.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: theme.textSecondary, wordBreak: 'break-word' }}>
                          {activeTeamTask.description}
                        </div>

                        {/* Planning state */}
                        {activeTeamTask.status === 'planning' && (
                          <div style={{ fontSize: '11px', color: theme.textMuted, fontStyle: 'italic' }}>
                            Planner is working on a strategy. Planning completes only when `submit_plan` arrives.
                          </div>
                        )}

                        {activeTeamTask.planningComplete && (
                          <div style={{ fontSize: '11px', color: theme.success }}>
                            Final plan submitted by {activeTeamTask.plannerAgentId || 'planner'}{activeTeamTask.planSubmittedAt ? ` at ${new Date(activeTeamTask.planSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}.
                          </div>
                        )}

                        {/* Plan review */}
                        {activeTeamTask.status === 'awaiting_confirmation' && activeTeamTask.plan && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: theme.success, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Planner finished{activeTeamTask.planSubmittedAt ? ` at ${new Date(activeTeamTask.planSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                            </span>
                            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>Plan</span>
                            <div style={{ fontSize: '11px', color: theme.textPrimary, whiteSpace: 'pre-wrap', padding: '8px', backgroundColor: theme.bgSurface, borderRadius: '4px', maxHeight: '200px', overflow: 'auto', wordBreak: 'break-word' }}>
                              {activeTeamTask.plan}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch(`/api/teams/${activeTeam.id}/tasks/${activeTeamTask.id}/confirm`, { method: 'POST' });
                                    pushSidebarEvent('out', 'Confirm Plan', activeTeamTask.id);
                                  } catch (err: any) {
                                    setGlobalError(err.message);
                                  }
                                }}
                                style={{ flex: 1, padding: '6px', backgroundColor: theme.success, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setShowRejectInput(!showRejectInput)}
                                style={{ flex: 1, padding: '6px', backgroundColor: theme.error, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                              >
                                Reject
                              </button>
                            </div>
                            {showRejectInput && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                  value={rejectFeedback}
                                  onChange={e => setRejectFeedback(e.target.value)}
                                  placeholder="Feedback..."
                                  style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '4px', padding: '4px 6px', fontSize: '11px' }}
                                />
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch(`/api/teams/${activeTeam.id}/tasks/${activeTeamTask.id}/reject`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ feedback: rejectFeedback }),
                                      });
                                      pushSidebarEvent('out', 'Reject Plan', rejectFeedback || activeTeamTask.id);
                                      setRejectFeedback('');
                                      setShowRejectInput(false);
                                    } catch (err: any) {
                                      setGlobalError(err.message);
                                    }
                                  }}
                                  style={{ padding: '4px 8px', backgroundColor: theme.error, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  Send
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delegated / in progress */}
                        {activeTeamTask.status === 'delegated' && (
                          <div style={{ fontSize: '11px', color: theme.textMuted, fontStyle: 'italic' }}>
                            Worker is reviewing the assignment...
                          </div>
                        )}
                        {activeTeamTask.status === 'in_progress' && (
                          <div style={{ fontSize: '11px', color: theme.success }}>
                            Worker accepted and is executing...
                          </div>
                        )}

                        {/* Refused */}
                        {activeTeamTask.status === 'refused' && (
                          <div style={{ fontSize: '11px', color: theme.error }}>
                            Worker refused: {activeTeamTask.workerRefusalReason || 'No reason given'}
                          </div>
                        )}

                        {/* Completed */}
                        {activeTeamTask.status === 'completed' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: theme.success, fontWeight: 600 }}>Completed</span>
                            {activeTeamTask.transcript.length > 0 && (
                              <div style={{ fontSize: '11px', color: theme.textSecondary, whiteSpace: 'pre-wrap', padding: '6px', backgroundColor: theme.bgSurface, borderRadius: '4px', maxHeight: '150px', overflow: 'auto', wordBreak: 'break-word' }}>
                                {activeTeamTask.transcript[activeTeamTask.transcript.length - 1].payload}
                              </div>
                            )}
                            <button
                              onClick={() => { setActiveTeamTask(null); }}
                              style={{ padding: '6px', backgroundColor: theme.bgSurface, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            >
                              New Task
                            </button>
                          </div>
                        )}

                        {/* Direct message to team member */}
                        {activeTeamTask.status !== 'completed' && activeTeamTask.status !== 'planning' && activeTeamTask.status !== 'delegated' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', borderTop: `1px solid ${theme.border}`, paddingTop: '8px' }}>
                            <span style={{ fontSize: '10px', color: theme.textMuted }}>Message team member</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select
                                value={teamMessageRole}
                                onChange={e => setTeamMessageRole(e.target.value as 'planner' | 'worker')}
                                style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '4px', padding: '4px', fontSize: '10px', width: '70px' }}
                              >
                                {availableTeamMessageRoles.includes('planner') && <option value="planner">Planner</option>}
                                {availableTeamMessageRoles.includes('worker') && <option value="worker">Worker</option>}
                              </select>
                              <input
                                value={teamMessageInput}
                                onChange={e => setTeamMessageInput(e.target.value)}
                                placeholder="Type message..."
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && teamMessageInput.trim() && ws) {
                                    sendTeamMessage();
                                  }
                                }}
                                style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '4px', padding: '4px 6px', fontSize: '11px' }}
                              />
                              <button
                                onClick={sendTeamMessage}
                                style={{ padding: '4px 8px', backgroundColor: theme.bgSurface, color: theme.textPrimary, border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer' }}
                              >
                                <Send size={10} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Disband team */}
                    <button
                      onClick={() => { setActiveTeam(null); setActiveTeamTask(null); }}
                      style={{ padding: '6px', backgroundColor: 'transparent', color: theme.textDim, border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '10px', marginTop: '4px' }}
                    >
                      Disband Team
                    </button>
                  </>
                )}
              </div>
            )}

            {activeSidebarTab === 'conversation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              </div>
            )}
          </div>
            </>
          )}
          <div style={{ borderTop: `1px solid ${theme.border}`, backgroundColor: theme.bgSurface, display: 'flex', flexDirection: 'column', minHeight: 0, ...(sidebarEventsCollapsed ? {} : { height: '128px' }) }}>
            <div
              onClick={() => setSidebarEventsCollapsed(c => !c)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
            >
              <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>{sidebarEventsCollapsed ? '▶' : '▼'}</span>
                Agent Events
              </span>
              {!sidebarEventsCollapsed && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSidebarEvents([]); }}
                  style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '10px', padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
            {!sidebarEventsCollapsed && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 10px 8px' }}>
                {sidebarEvents.length === 0 ? (
                  <div style={{ margin: 'auto 0', fontSize: '11px', color: theme.textDim }}>
                    No agent events yet.
                  </div>
                ) : (
                  sidebarEvents.slice(0, 2).map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '6px',
                        backgroundColor: entry.direction === 'in' ? '#203145' : entry.direction === 'out' ? '#2f2a1f' : '#262b31',
                        border: `1px solid ${entry.direction === 'in' ? '#31567d' : entry.direction === 'out' ? '#6a5830' : '#3a424c'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '10px', color: theme.textBright }}>{entry.label}</span>
                        <span style={{ fontSize: '10px', color: theme.textDim }}>
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: theme.textSecondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {entry.detail}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
