import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseWebSocketOptions {
  onMessage: (message: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useWebSocket({ onMessage, onOpen, onClose }: UseWebSocketOptions) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  // Keep refs in sync to avoid effect re-runs
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onMessage, onOpen, onClose]);

  useEffect(() => {
    let cancelled = false;
    let currentSocket: WebSocket | null = null;

    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      currentSocket = socket;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }
        setWs(socket);
        setIsConnected(true);
        onOpenRef.current?.();
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(event.data);
          onMessageRef.current(message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      socket.onclose = () => {
        setWs(null);
        setIsConnected(false);
        onCloseRef.current?.();
        if (!cancelled) {
          setTimeout(connect, 2000);
        }
      };

      socket.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    }

    connect();

    return () => {
      cancelled = true;
      currentSocket?.close();
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [ws]);

  return { ws, isConnected, sendMessage };
}
