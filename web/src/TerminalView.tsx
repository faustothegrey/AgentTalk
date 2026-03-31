import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { getAgentColor } from './agentColors';

const lastAttachedAgentBySocket = new WeakMap<WebSocket, string>();

interface TerminalViewProps {
  agentId: string;
  ws: WebSocket | null;
}

function normalizeForXterm(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

function formatAgentMessage(agentId: string, accent: string, payload: string): string {
  return `\r\n\x1b[38;2;${parseInt(accent.slice(1, 3), 16)};${parseInt(accent.slice(3, 5), 16)};${parseInt(accent.slice(5, 7), 16)}m[${agentId} → user]\x1b[0m ${normalizeForXterm(payload)}\r\n`;
}

export function TerminalView({ agentId, ws }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const agentColor = getAgentColor(agentId);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
      },
    });

    terminalRef.current.innerHTML = '';
    term.open(terminalRef.current);

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    


    setTimeout(() => { try { fitAddon.fit(); } catch (e) {} }, 50);
    xtermRef.current = term;

    // Handle input
    const disposable = term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', text: data }));
      }
    });

    const handleResize = () => { try { fitAddon.fit() } catch (e) {} };
    window.addEventListener('resize', handleResize);

    return () => {
      disposable.dispose();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [agentId, ws]);

  // Handle output from WebSocket
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (message.type === 'terminal_history' && message.agentId === agentId) {
        xtermRef.current?.clear();
        for (const entry of message.events as Array<{ type: string; text?: string; payload?: string }>) {
          if (entry.type === 'output' && entry.text) {
            xtermRef.current?.write(entry.text);
          } else if (entry.type === 'agent_message' && entry.payload) {
            xtermRef.current?.write(formatAgentMessage(agentId, agentColor.accent, String(entry.payload)));
          }
        }
      } else if (message.type === 'output' && message.id === agentId) {
        xtermRef.current?.write(message.text);
      } else if (message.type === 'agent_message' && message.from === agentId) {
        // Protocol response from agent — display with visual indicator
        xtermRef.current?.write(formatAgentMessage(agentId, agentColor.accent, String(message.payload)));
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [agentId, ws]);

  // Send attach message when agentId changes
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const lastAttachedAgent = lastAttachedAgentBySocket.get(ws);
      if (lastAttachedAgent === agentId) {
        return;
      }

      lastAttachedAgentBySocket.set(ws, agentId);
      ws.send(JSON.stringify({ type: 'attach', agentId }));
    }
  }, [agentId, ws]);

  return (
    <div style={{ width: '100%', height: '100%', padding: '8px', boxSizing: 'border-box' }}>
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
