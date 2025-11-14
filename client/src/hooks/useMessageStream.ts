import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'error';

interface UseMessageStreamOptions {
  bookingId: string;
  onMessage?: (message: any) => void;
}

export function useMessageStream({ bookingId, onMessage }: UseMessageStreamOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  const isActiveRef = useRef(true);

  // Update onMessage ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Don't connect if already connecting or connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN || 
        eventSourceRef.current?.readyState === EventSource.CONNECTING) {
      return;
    }

    setConnectionStatus('connecting');
    setLastError('');

    const url = `/api/bookings/${bookingId}/messages/stream`;
    console.log('[SSE] Connecting to:', url);
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isActiveRef.current) return;
      console.log('[SSE] Connection opened');
      setConnectionStatus('connected');
      setLastError('');
    };

    eventSource.onmessage = (event) => {
      if (!isActiveRef.current) return;
      
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received:', data);
        
        if (onMessageRef.current) {
          onMessageRef.current(data);
        }
      } catch (error) {
        console.error('[SSE] Error parsing message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      if (!isActiveRef.current) return;

      // EventSource will automatically try to reconnect
      // We just update the status
      if (eventSource.readyState === EventSource.CLOSED) {
        setConnectionStatus('error');
        setLastError('Connection lost. Attempting to reconnect...');
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        setConnectionStatus('connecting');
        setLastError('Reconnecting...');
      }
    };
  }, [bookingId]);

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    isActiveRef.current = false;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  const manualRetry = useCallback(() => {
    console.log('[SSE] Manual retry triggered');
    disconnect();
    setTimeout(() => {
      isActiveRef.current = true;
      connect();
    }, 100);
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    isActiveRef.current = true;
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    lastError,
    manualRetry,
    isConnected: connectionStatus === 'connected',
  };
}
