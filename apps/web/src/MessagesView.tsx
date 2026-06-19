import { useEffect, useRef, useState } from 'react';
import { getAgentColor } from './agentColors';

const lastAttachedAgentBySocket = new WeakMap<WebSocket, string>();

interface MessagesViewProps {
  agentId: string;
  ws: WebSocket | null;
}

export function MessagesView({ agentId, ws }: MessagesViewProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentColor = getAgentColor(agentId);

  // Reset when switching agents.
  useEffect(() => {
    setMessages([]);
  }, [agentId]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (message.type === 'message_history' && message.agentId === agentId) {
        const history = (message.events as Array<{ type: string; payload?: string }>)
          .filter((e) => e.type === 'agent_message' && e.payload)
          .map((e) => String(e.payload));
        setMessages(history);
      } else if (message.type === 'agent_message' && message.from === agentId) {
        setMessages((prev) => [...prev, String(message.payload)]);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [agentId, ws]);

  // Attach to the agent when it changes.
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (lastAttachedAgentBySocket.get(ws) === agentId) return;
      lastAttachedAgentBySocket.set(ws, agentId);
      ws.send(JSON.stringify({ type: 'attach', agentId }));
    }
  }, [agentId, ws]);

  // Keep the latest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {messages.map((text, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: agentColor.accent }}>
            {agentId} → user
          </span>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
            {text}
          </div>
        </div>
      ))}
    </div>
  );
}
