import { useState, useEffect, useCallback, useRef } from 'react';
import { MessagesView } from './MessagesView';
import { ErrorBoundary } from './ErrorBoundary';
import { GlobalNotifications } from './GlobalNotifications';
import { SidebarEvents } from './SidebarEvents';
import { PlanningView } from './PlanningView';
import { AgentsView } from './AgentsView';
import { UsageView } from './UsageView';
import { GoogleDriveView } from './GoogleDriveView';
import { SchedulerView } from './SchedulerView';
import { RelayApprovalPanel } from './RelayApprovalPanel';

import { theme, TopLevelTab, Conversation, SidebarEventEntry, Team, TeamTask, Provider, ExecutionMode, TeamMember, TeamComposition, Agent, PendingRelay, RelayApprovalMode, TranscriptEntry } from './api/types';
import { api } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import { useAgents } from './hooks/useAgents';

import { Railbar } from './components/layout/Railbar';
import { AgentList } from './components/agents/AgentList';
import { AgentCreation } from './components/agents/AgentCreation';
import { ChatSidebar } from './components/chat/ChatSidebar';
import { TeamSidebar } from './components/team/TeamSidebar';

import { Send, Terminal as TerminalIcon, Check, X, Clock3 } from 'lucide-react';
import { getAgentColor } from './agentColors';

function relayPayloadText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function relayBelongsToConversation(relay: PendingRelay, conversation: Conversation): boolean {
  return conversation.agentIds.includes(relay.fromAgentId) && conversation.agentIds.includes(relay.toAgentId);
}

function pendingRelaysForConversation(conversation: Conversation, pendingRelays: PendingRelay[]): PendingRelay[] {
  return pendingRelays.filter((relay) => relay.status === 'pending' && relayBelongsToConversation(relay, conversation));
}

function conversationOutcome(conversation: Conversation, currentPendingCount: number): string {
  if (currentPendingCount > 0) {
    return 'Waiting for your decision';
  }
  if (conversation.status === 'active') {
    return 'In progress';
  }

  const lastSystem = [...conversation.transcript].reverse().find((entry) => entry.kind === 'system');
  const reason = lastSystem?.payload || 'Conversation completed';
  if (reason.includes('reply limit')) {
    return 'Ended: reply limit reached, agreement not recorded';
  }
  if (reason.includes('stopped by operator')) {
    return 'Stopped by operator';
  }
  return `Ended: ${reason}`;
}

type ConversationTimelineItem =
  | { kind: 'transcript'; id: string; timestamp: string; entry: TranscriptEntry }
  | { kind: 'pendingRelay'; id: string; timestamp: string; relay: PendingRelay };

function buildConversationTimeline(conversation: Conversation, pendingRelays: PendingRelay[]): ConversationTimelineItem[] {
  const transcriptItems = conversation.transcript.map((entry, index) => ({
    kind: 'transcript' as const,
    id: `transcript-${index}-${entry.timestamp}`,
    timestamp: entry.timestamp,
    entry,
  }));

  const relayItems = pendingRelays
    .filter((relay) => relay.status === 'pending' && relayBelongsToConversation(relay, conversation))
    .map((relay) => ({
      kind: 'pendingRelay' as const,
      id: relay.id,
      timestamp: relay.createdAt,
      relay,
    }));

  return [...transcriptItems, ...relayItems].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function ConversationTranscript({ conversation, pendingRelays, onContinue, onStop, connected }: {
  conversation: Conversation;
  pendingRelays: PendingRelay[];
  onContinue: (relayId: string) => void;
  onStop: (relayId: string) => void;
  connected: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const timeline = buildConversationTimeline(conversation, pendingRelays);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {timeline.length === 0 ? (
        <div style={{ margin: 'auto', color: theme.textDim, textAlign: 'center', fontSize: '14px' }}>Waiting for conversation events...</div>
      ) : (
        timeline.map((item) => {
          if (item.kind === 'pendingRelay') {
            const relay = item.relay;
            const color = getAgentColor(relay.fromAgentId);
            return (
              <div key={item.id} style={{ alignSelf: 'stretch', backgroundColor: color.tint, borderLeft: `3px solid ${color.accent}`, borderTop: `1px solid ${color.glow}`, borderRight: `1px solid ${color.glow}`, borderBottom: `1px solid ${color.glow}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>
                  <span style={{ color: color.accent, fontWeight: 'bold' }}>Proposed turn · {relay.fromAgentId} {'→'} {relay.toAgentId}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#e5c07b', fontWeight: 'bold' }}><Clock3 size={13} /> Waiting</span>
                </div>
                <div style={{ color: color.text, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{relayPayloadText(relay.payload)}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    title="Continue conversation"
                    disabled={!connected}
                    onClick={() => onContinue(relay.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: theme.bg, color: theme.success, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', cursor: connected ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 700 }}
                  >
                    <Check size={15} /> Continue
                  </button>
                  <button
                    type="button"
                    title="Stop conversation"
                    disabled={!connected}
                    onClick={() => onStop(relay.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: theme.bg, color: theme.error, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', cursor: connected ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 700 }}
                  >
                    <X size={15} /> Stop
                  </button>
                </div>
              </div>
            );
          }

          const entry = item.entry;
          const isSystem = entry.kind === 'system';
          const color = isSystem ? null : getAgentColor(entry.from);
          return (
            <div key={item.id} style={{ alignSelf: 'stretch', backgroundColor: isSystem ? theme.bgSurface : color!.tint, borderLeft: `3px solid ${isSystem ? theme.textMuted : color!.accent}`, border: `1px solid ${isSystem ? theme.borderLight : color!.glow}`, borderRadius: '8px', padding: isSystem ? '8px 12px' : '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>
                <span style={{ color: isSystem ? theme.textSubtle : color!.accent, fontWeight: 'bold' }}>{isSystem ? entry.from : 'Delivered turn'} {'→'} {entry.to}</span>
                <span style={{ color: theme.textMuted }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ color: isSystem ? theme.textMuted : color!.text, fontSize: isSystem ? '12px' : '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.payload}</div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function App() {
  const { agents, fetchAgents, addAgent, hasAgent, removeAgent, updateAgentStatus, updateAgentUsage } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const [leftNavCollapsed, setLeftNavCollapsed] = useState(true);
  const [sidebarEvents, setSidebarEvents] = useState<SidebarEventEntry[]>([]);
  const [sidebarEventsCollapsed, setSidebarEventsCollapsed] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([]);
  const [activeTopTab, setActiveTopTab] = useState<TopLevelTab>('agents');
  const [sidebarWidth, setSidebarWidth] = useState(390);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeTeamTask, setActiveTeamTask] = useState<TeamTask | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [geminiUsageCapture, setGeminiUsageCapture] = useState<any>(null);
  const [claudeUsageCapture, setClaudeUsageCapture] = useState<any>(null);
  const [codexUsageCapture, setCodexUsageCapture] = useState<any>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [driveResources, setDriveResources] = useState<any[]>([]);
  const [schedulerJobs, setSchedulerJobs] = useState<any[]>([]);
  const [globalSchedulerEnabled, setGlobalSchedulerEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [geminiModelForTeam, setGeminiModelForTeam] = useState('gemini-3.1-pro');
  const [relayApprovalMode, setRelayApprovalMode] = useState<RelayApprovalMode>('off');
  const [pendingRelays, setPendingRelays] = useState<PendingRelay[]>([]);

  const messageInputRef = useRef<HTMLInputElement>(null);
  const selectedAgentColor = selectedAgentId ? getAgentColor(selectedAgentId) : null;

  const pushSidebarEvent = useCallback((direction: SidebarEventEntry['direction'], label: string, detail: string) => {
    setSidebarEvents(prev => [{ id: String(Date.now()), timestamp: new Date().toISOString(), direction, label, detail }, ...prev].slice(0, 40));
  }, []);

  const handleWsMessage = useCallback((message: any) => {
    switch (message.type) {
      // BL-048: an agent created outside the UI (API / launcher) announces itself here.
      case 'agent_added': if (message.agent) addAgent(message.agent); break;
      case 'status':
        // Defensive: a 'status' for an id we have never seen means we missed its
        // 'agent_added' (created in the window between the initial list fetch and the
        // WebSocket connecting). Without this the event has no row to attach to and the
        // agent stays invisible, which is the exact BL-048 symptom.
        if (!hasAgent(message.id)) void fetchAgents();
        updateAgentStatus(message.id, message.status);
        break;
      case 'usage': updateAgentUsage(message.id, message.usage); break;
      case 'agent_message': pushSidebarEvent('in', `Agent:${message.from}`, String(message.payload)); break;
      case 'conversation_started':
      case 'conversation':
        if (message.conversation) {
          setConversationHistory(prev => [message.conversation, ...prev.filter(conversation => conversation.id !== message.conversation.id)]);
          setActiveConversation(message.conversation);
          if (message.type === 'conversation_started') {
            setActiveConversationId(message.conversation.id);
            setSelectedAgentId(null);
            setActiveTopTab('chat');
          }
        }
        break;
      case 'team_updated': setActiveTeam(message.team); break;
      case 'team_task_updated': setActiveTeamTask(message.task); break;
      case 'team_planning_complete':
        setGlobalNotice(`Planner ${message.plannerAgentId} finished the plan.`);
        break;
      case 'workflow_gate_attempt': {
        const { agentId, event, result } = message;
        const gate = event?.gate || 'unknown-gate';
        const action = event?.action || 'unknown-action';
        const role = event?.fromRole || 'unknown-role';
        const displayResult = result === 'accepted' ? 'accepted (pre-delivery)' : 'refused';
        pushSidebarEvent('in', `Gate:${gate}`, `[${displayResult}] ${agentId} (${role}) action: ${action}`);
        break;
      }
      case 'relay_approval_state':
        setRelayApprovalMode(message.mode || 'off');
        setPendingRelays(Array.isArray(message.pendingRelays) ? message.pendingRelays : []);
        break;
      case 'relay_approval_mode':
        setRelayApprovalMode(message.mode || 'off');
        break;
      case 'pending_relay_updated':
        if (message.relay) {
          setPendingRelays(prev => {
            const next = prev.filter(relay => relay.id !== message.relay.id);
            return [message.relay, ...next].slice(0, 30);
          });
        }
        break;
      case 'relay_approval_error':
        setGlobalError(message.error || 'Relay approval command failed');
        break;
    }
  }, [updateAgentStatus, updateAgentUsage, pushSidebarEvent, addAgent, hasAgent, fetchAgents]);

  const { ws, isConnected, sendMessage: sendWsMessage } = useWebSocket({ onMessage: handleWsMessage });

  const fetchConversationHistory = useCallback(async () => {
    try {
      const data = await api.conversations.list();
      setConversationHistory(data);
    } catch (err) { console.warn('Failed to fetch conversations', err); }
  }, []);

  const fetchDriveData = useCallback(async () => {
    try {
      const status = await api.drive.getStatus();
      setDriveStatus(status);
      if (status.configured) setDriveResources(await api.drive.getResources());
    } catch (err) { console.warn('Failed to fetch drive data', err); }
  }, []);

  const fetchSchedulerData = useCallback(async () => {
    try {
      setSchedulerJobs(await api.scheduler.list());
      const status = await api.scheduler.getStatus();
      setGlobalSchedulerEnabled(status.globalEnabled);
    } catch (err) { console.warn('Failed to fetch scheduler data', err); }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchConversationHistory();
  }, [fetchAgents, fetchConversationHistory]);

  useEffect(() => {
    if (conversationHistory.length === 0) return;

    if (activeConversationId) {
      const selected = conversationHistory.find(conversation => conversation.id === activeConversationId);
      if (selected && (
        activeConversation?.id !== selected.id ||
        activeConversation.updatedAt !== selected.updatedAt ||
        activeConversation.transcript.length !== selected.transcript.length
      )) {
        setActiveConversation(selected);
      }
      return;
    }

    const conversationWithPendingRelay = conversationHistory.find(conversation =>
      conversation.status === 'active' &&
      pendingRelays.some(relay => relay.status === 'pending' && relayBelongsToConversation(relay, conversation))
    );

    if (conversationWithPendingRelay) {
      setActiveConversationId(conversationWithPendingRelay.id);
      setActiveConversation(conversationWithPendingRelay);
      setSelectedAgentId(null);
      setActiveTopTab('chat');
    }
  }, [activeConversation, activeConversationId, conversationHistory, pendingRelays]);

  useEffect(() => {
    if (activeTopTab === 'drive') fetchDriveData();
    if (activeTopTab === 'scheduler') fetchSchedulerData();
  }, [activeTopTab, fetchDriveData, fetchSchedulerData]);

  const waitForAgentsReady = async (agentIds: string[], timeoutMs: number = 90000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await api.agents.list();
      const snapshot = res as Agent[];
      const byId = new Map(snapshot.map((agent) => [agent.id, agent]));
      let allReady = true;
      for (const agentId of agentIds) {
        const status = byId.get(agentId)?.status;
        if (status === 'error' || status === 'terminated') { throw new Error(`Autostart failed: agent ${agentId} is in ${status} state`); }
        if (status !== 'ready' && status !== 'busy') { allReady = false; break; }
      }
      if (allReady) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for autostarted agents to become ready');
  };

  const handleCreateAgent = async (provider: Provider, model: string, mode: ExecutionMode, id?: string) => {
    setLoading(true);
    try {
      const agent = await api.agents.create({ provider, model, executionMode: mode, id });
      await api.agents.start(agent.id, { provider, model, executionMode: mode });
      await fetchAgents();
      setSelectedAgentId(agent.id);
    } catch (err: any) { setGlobalError(err.message); }
    finally { setLoading(false); }
  };

  const handleStartConversation = (agentIds: string[], topic: string, maxReplies: number) => {
    sendWsMessage({ type: 'start_pair_chat', agentIds, topic, maxReplies });
  };

  const handleSelectConversation = useCallback((id: string) => {
    const conversation = conversationHistory.find((item) => item.id === id) || null;
    setActiveConversationId(id);
    setActiveConversation(conversation);
    setSelectedAgentId(null);
    setActiveTopTab('chat');
  }, [conversationHistory]);

  const handleAutostartChat = async () => {
    setLoading(true);
    try {
      const createdIds: string[] = [];
      const providers: Provider[] = ['gemini', 'codex'];
      for (const p of providers) {
        const model = p === 'gemini' ? 'gemini-3.1-pro' : '';
        const agent = await api.agents.create({ provider: p, model, executionMode: 'auto' });
        createdIds.push(agent.id);
        await api.agents.start(agent.id, { provider: p, model, executionMode: 'auto' });
      }
      await waitForAgentsReady(createdIds);
      await fetchAgents();
      sendWsMessage({ type: 'start_pair_chat', agentIds: createdIds, topic: 'Discuss AgentTalk architecture.', maxReplies: 5 });
    } catch (err: any) { setGlobalError(err.message); }
    finally { setLoading(false); }
  };

  const handleCreateTeam = async (members: TeamMember[], composition: TeamComposition) => {
    setLoading(true);
    try {
      const team = await api.teams.create({ teamComposition: composition, members });
      setActiveTeam(team);
    } catch (err: any) { setGlobalError(err.message); }
    finally { setLoading(false); }
  };

  const handleAutostartTeam = async (teamProvider: Provider) => {
    setLoading(true);
    try {
      const createdIds: string[] = [];
      const model = teamProvider === 'gemini' ? geminiModelForTeam : '';
      for (let i = 0; i < 3; i++) {
        const agent = await api.agents.create({ provider: teamProvider, model, executionMode: 'persistent' });
        createdIds.push(agent.id);
        await api.agents.start(agent.id, { provider: teamProvider, model, executionMode: 'persistent' });
      }
      await waitForAgentsReady(createdIds);
      await fetchAgents();
      const team = await api.teams.create({
        teamComposition: 'planner-planner-worker',
        members: [
          { agentId: createdIds[0], role: 'planner' },
          { agentId: createdIds[1], role: 'planner' },
          { agentId: createdIds[2], role: 'worker' }
        ]
      });
      setActiveTeam(team);
      await api.teams.assignTask(team.id, { description: 'Find a small refactoring or code cleanup and implement it.' });
    } catch (err: any) { setGlobalError(err.message); }
    finally { setLoading(false); }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    if (sendWsMessage({ type: 'message', text: messageInput.trim() })) {
      setMessageInput('');
    }
  };

  const handleRelayModeChange = (mode: RelayApprovalMode) => {
    if (!sendWsMessage({ type: 'set_relay_approval_mode', mode })) {
      setGlobalError('Relay approval mode update failed: websocket is not connected');
    }
  };

  const handleApproveRelay = (relayId: string) => {
    if (!sendWsMessage({ type: 'approve_pending_relay', relayId })) {
      setGlobalError('Relay approval failed: websocket is not connected');
    }
  };

  const handleDenyRelay = (relayId: string) => {
    if (!sendWsMessage({ type: 'deny_pending_relay', relayId })) {
      setGlobalError('Relay denial failed: websocket is not connected');
    }
  };

  const captureUsage = async () => {
    setUsageLoading(true);
    try {
      const results = await Promise.allSettled([
        api.usage.capture({ provider: 'gemini', model: 'gemini-3.1-pro' }),
        api.usage.capture({ provider: 'claude', model: 'sonnet' }),
        api.usage.capture({ provider: 'codex', model: '' })
      ]);
      if (results[0].status === 'fulfilled') setGeminiUsageCapture(results[0].value);
      if (results[1].status === 'fulfilled') setClaudeUsageCapture(results[1].value);
      if (results[2].status === 'fulfilled') setCodexUsageCapture(results[2].value);
    } finally { setUsageLoading(false); }
  };

  const startResizing = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.min(Math.max(e.clientX, 250), 800));
    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isResizing]);

  const activeConversationAgentIds = activeConversation ? new Set(activeConversation.agentIds) : null;
  const currentConversationPendingRelays = activeConversation ? pendingRelaysForConversation(activeConversation, pendingRelays) : [];
  const currentConversationOutcome = activeConversation ? conversationOutcome(activeConversation, currentConversationPendingRelays.length) : null;
  const sidebarRelays = activeConversationAgentIds
    ? pendingRelays.filter((relay) => !(
      activeConversationAgentIds.has(relay.fromAgentId)
      && activeConversationAgentIds.has(relay.toAgentId)
    ))
    : pendingRelays;
  const inlineRelayCount = pendingRelays.length - sidebarRelays.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', position: 'relative' }}>
      <GlobalNotifications globalError={globalError} globalNotice={globalNotice} onClearError={() => setGlobalError(null)} theme={theme} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Railbar activeTopTab={activeTopTab} onTabChange={(tab) => { setActiveTopTab(tab); }} collapsed={leftNavCollapsed} onToggleCollapse={() => setLeftNavCollapsed(!leftNavCollapsed)} />

        <div style={{ width: `${sidebarWidth}px`, display: 'flex', flexDirection: 'column', backgroundColor: theme.bgRaised, borderRight: `1px solid ${theme.border}` }}>
          {activeTopTab === 'chat' && (
            <ChatSidebar agents={agents} conversationHistory={conversationHistory} activeConversationId={activeConversationId} onStartConversation={handleStartConversation} onAutostart={handleAutostartChat} onSelectConversation={handleSelectConversation} wsConnected={isConnected}>
              <AgentList agents={agents} selectedAgentId={selectedAgentId} onSelect={(id) => { setSelectedAgentId(id); setActiveConversationId(null); }} onRemove={removeAgent} />
              <AgentCreation loading={loading} onCreate={handleCreateAgent} />
            </ChatSidebar>
          )}
          {activeTopTab === 'team' && (
            <TeamSidebar agents={agents} activeTeam={activeTeam} activeTeamTask={activeTeamTask} onAutostartTeam={handleAutostartTeam} onDisbandTeam={() => { setActiveTeam(null); setActiveTeamTask(null); }} onCreateTeam={handleCreateTeam} geminiModel={geminiModelForTeam} onGeminiModelChange={setGeminiModelForTeam}>
              <AgentList agents={agents} selectedAgentId={selectedAgentId} onSelect={(id) => { setSelectedAgentId(id); setActiveConversationId(null); }} onRemove={removeAgent} />
              <AgentCreation loading={loading} onCreate={handleCreateAgent} />
            </TeamSidebar>
          )}
          {activeTopTab === 'agents' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <AgentList agents={agents} selectedAgentId={selectedAgentId} onSelect={(id) => { setSelectedAgentId(id); setActiveConversationId(null); }} onRemove={removeAgent} />
              <AgentCreation loading={loading} onCreate={handleCreateAgent} />
            </div>
          )}
          {(activeTopTab === 'usage' || activeTopTab === 'drive' || activeTopTab === 'scheduler') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTopTab === 'usage' && <UsageView geminiUsageCapture={geminiUsageCapture} claudeUsageCapture={claudeUsageCapture} codexUsageCapture={codexUsageCapture} usageLoading={usageLoading} onCapture={captureUsage} theme={theme} />}
                {activeTopTab === 'drive' && <GoogleDriveView driveStatus={driveStatus} driveResources={driveResources} driveAgentResources={[]} driveFiles={[]} driveReadResult={null} driveLoading={false} onRefreshStatus={fetchDriveData} onAddResource={async () => {}} onRemoveResource={async () => {}} onGrantAccess={async () => {}} onRevokeAccess={async () => {}} onListFiles={async () => {}} onReadFile={async () => {}} agents={agents} theme={theme} />}
                {activeTopTab === 'scheduler' && <SchedulerView schedulerJobs={schedulerJobs} globalSchedulerEnabled={globalSchedulerEnabled} schedulerLoading={false} onRefresh={fetchSchedulerData} onToggleGlobal={(e) => api.scheduler.toggle(e).then(fetchSchedulerData)} onCreateJob={(n, a, p, i) => api.scheduler.createJob({ name: n, agentId: a, prompt: p, intervalSeconds: i, enabled: true }).then(fetchSchedulerData)} onUpdateJob={(id, patch) => api.scheduler.updateJob(id, patch).then(fetchSchedulerData)} onRunNow={(id) => api.scheduler.runNow(id).then(fetchSchedulerData)} onDeleteJob={(id) => api.scheduler.deleteJob(id).then(fetchSchedulerData)} agents={agents} theme={theme} />}
              </div>
            </div>
          )}
          <RelayApprovalPanel
            mode={relayApprovalMode}
            pendingRelays={sidebarRelays}
            inlineRelayCount={inlineRelayCount}
            connected={isConnected}
            theme={theme}
            onModeChange={handleRelayModeChange}
            onApprove={handleApproveRelay}
            onDeny={handleDenyRelay}
          />
          <SidebarEvents sidebarEvents={sidebarEvents} sidebarEventsCollapsed={sidebarEventsCollapsed} setSidebarEventsCollapsed={setSidebarEventsCollapsed} setSidebarEvents={setSidebarEvents} theme={theme} />
        </div>

        <div onMouseDown={startResizing} style={{ width: '4px', cursor: 'col-resize', backgroundColor: isResizing ? theme.bgActive : 'transparent', borderLeft: `1px solid ${theme.border}`, zIndex: 10 }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg }}>
          {activeTopTab === 'planning' ? (
            <PlanningView onClose={() => setActiveTopTab('chat')} theme={theme} />
          ) : activeTopTab === 'agents' ? (
            <AgentsView 
              agents={agents} 
              onSelect={(id) => { setSelectedAgentId(id); setActiveTopTab('chat'); }} 
              onRemove={removeAgent} 
              onClose={() => setActiveTopTab('chat')} 
            />
          ) : activeConversationId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '12px 16px', backgroundColor: theme.bgSurface, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: theme.textBright, fontSize: '15px', fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{activeConversation?.topic || 'Conversation'}</div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '4px', overflowWrap: 'anywhere' }}>
                    {(activeConversation?.agentIds || []).join(' ↔ ') || activeConversationId} · {activeConversationId}
                  </div>
                  {currentConversationOutcome && (
                    <div style={{ color: currentConversationPendingRelays.length > 0 ? '#e5c07b' : theme.textSubtle, fontSize: '12px', marginTop: '6px', fontWeight: 700 }}>
                      {currentConversationOutcome}
                    </div>
                  )}
                </div>
                <button onClick={() => { setActiveConversationId(null); setActiveConversation(null); }} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '11px' }}>Close View</button>
              </div>
              {activeConversation && <ConversationTranscript conversation={activeConversation} pendingRelays={pendingRelays} onContinue={handleApproveRelay} onStop={handleDenyRelay} connected={isConnected} />}
            </div>
          ) : selectedAgentId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px', backgroundColor: theme.bgSurface, fontSize: '12px', color: theme.textSecondary, borderBottom: `1px solid ${theme.border}`, borderTop: selectedAgentColor ? `2px solid ${selectedAgentColor.accent}` : undefined }}>
                Connected to: <strong style={{ color: selectedAgentColor?.accent }}>{selectedAgentId}</strong>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <ErrorBoundary><MessagesView key={selectedAgentId} agentId={selectedAgentId} ws={ws || null} /></ErrorBoundary>
              </div>
              <div style={{ padding: '8px 12px', borderTop: '1px solid #333', backgroundColor: theme.bgSurface, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input ref={messageInputRef} type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }} placeholder="Send message..." style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '4px', padding: '6px 10px', fontSize: '13px', outline: 'none' }} />
                <button onClick={handleSendMessage} disabled={!messageInput.trim() || !isConnected} style={{ background: 'none', border: 'none', color: messageInput.trim() ? '#4caf50' : '#555', cursor: 'pointer' }}><Send size={16} /></button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: theme.textDim }}>
              <div style={{ textAlign: 'center' }}>
                <TerminalIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <div>Select an agent or conversation to begin.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
