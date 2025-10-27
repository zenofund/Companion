import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
  bookingId?: string;
  content?: string;
}

interface UseWebSocketOptions {
  userId: string;
  onMessage?: (message: any) => void;
}

export function useWebSocket({ userId, onMessage }: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('[Chat WebSocket] Attempting connection to:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('[Chat WebSocket] Connected successfully');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[Chat WebSocket] Received message:', message);
        
        // Handle auth success
        if (message.type === 'auth' && message.success) {
          console.log('[Chat WebSocket] Authentication successful');
          setIsConnected(true);
        }
        
        if (onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error("[Chat WebSocket] Error parsing message:", error);
      }
    };

    ws.current.onclose = (event) => {
      console.log('[Chat WebSocket] Connection closed. Code:', event.code, 'Reason:', event.reason);
      setIsConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[Chat WebSocket] Attempting reconnect...');
        connect();
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error("[Chat WebSocket] Connection error:", error);
    };
  }, [onMessage]);

  const sendMessage = useCallback((bookingId: string, content: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'message',
        bookingId,
        content,
      }));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
