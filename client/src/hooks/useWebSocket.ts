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

export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'failed' 
  | 'max_retries_reached';

export function useWebSocket({ userId, onMessage }: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const isActiveRef = useRef(true); // Track if component is still mounted
  const maxRetries = 5;

  const connect = useCallback(() => {
    // Re-activate component when connection attempt starts
    isActiveRef.current = true;
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Check if max retries reached
    if (retryCountRef.current >= maxRetries) {
      console.log('[Chat WebSocket] Max retry attempts reached. Stopping reconnection.');
      setConnectionStatus('max_retries_reached');
      setLastError('Connection failed after multiple attempts. Please try again later.');
      return;
    }

    setConnectionStatus('connecting');
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[Chat WebSocket] Connection attempt ${retryCountRef.current + 1}/${maxRetries} to:`, wsUrl);
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
          setConnectionStatus('connected');
          setLastError('');
          retryCountRef.current = 0; // Reset retry count on successful connection
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
      
      // Don't process if component is unmounted
      if (!isActiveRef.current) {
        console.log('[Chat WebSocket] Component unmounted, skipping reconnect logic');
        return;
      }
      
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Set specific error messages based on close code
      if (event.code === 4001) {
        setLastError(event.reason || 'Authentication failed');
        setConnectionStatus('failed');
      }
      
      // Increment retry count
      retryCountRef.current += 1;
      
      // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s
      const baseDelay = 1000;
      const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current - 1), 16000);
      
      console.log(`[Chat WebSocket] Retry ${retryCountRef.current}/${maxRetries} in ${delay}ms...`);
      
      // Only reconnect if under max retries and component is still active
      if (retryCountRef.current < maxRetries && isActiveRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            console.log('[Chat WebSocket] Attempting reconnect...');
            connect();
          }
        }, delay);
      } else if (retryCountRef.current >= maxRetries) {
        setConnectionStatus('max_retries_reached');
        setLastError('Connection failed after multiple attempts. Please try again later.');
      }
    };

    ws.current.onerror = (error) => {
      console.error("[Chat WebSocket] Connection error:", error);
      setLastError('Connection error occurred');
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
    console.log('[Chat WebSocket] Disconnecting...');
    isActiveRef.current = false; // Mark component as inactive
    retryCountRef.current = 0; // Reset retry count
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const manualRetry = useCallback(() => {
    console.log('[Chat WebSocket] Manual retry triggered');
    retryCountRef.current = 0; // Reset retry count for manual retry
    setLastError('');
    setConnectionStatus('disconnected');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect(); // This will set isActiveRef.current = true
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    lastError,
    sendMessage,
    disconnect,
    manualRetry,
  };
}
