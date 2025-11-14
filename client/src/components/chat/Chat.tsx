import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Loader2, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ChatProps {
  bookingId: string;
  currentUserId: string;
  otherUserName?: string;
}

interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export function Chat({ bookingId, currentUserId, otherUserName }: ChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch message history
  const { data: messageHistory, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/bookings", bookingId, "messages"],
    refetchInterval: false,
  });

  useEffect(() => {
    if (messageHistory) {
      setMessages(messageHistory);
    }
  }, [messageHistory]);

  // Memoized WebSocket message handler to prevent unnecessary reconnections
  const handleWebSocketMessage = useCallback((wsMessage: any) => {
    if (wsMessage.type === 'message' && wsMessage.data) {
      setMessages((prev) => {
        // Check if message already exists (by id)
        const exists = prev.some(m => m.id === wsMessage.data.id);
        if (exists) {
          return prev;
        }
        return [...prev, wsMessage.data];
      });
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else if (wsMessage.type === 'error') {
      console.error('WebSocket error:', wsMessage.message);
    }
  }, []); // Empty deps - uses setMessages callback form, scrollRef is stable

  // WebSocket connection
  const { 
    isConnected, 
    connectionStatus, 
    lastError, 
    sendMessage: sendWsMessage,
    manualRetry 
  } = useWebSocket({
    userId: currentUserId,
    onMessage: handleWebSocketMessage,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || !isConnected) return;

    const success = sendWsMessage(bookingId, trimmedMessage);
    
    if (success) {
      setInputMessage("");
      // Server will echo the message back, no need for optimistic update
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {otherUserName || "Chat"}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {connectionStatus === 'connected' && (
                <span className="text-green-600">● Connected</span>
              )}
              {connectionStatus === 'connecting' && (
                <span className="text-yellow-600">○ Connecting...</span>
              )}
              {connectionStatus === 'disconnected' && (
                <span className="text-gray-500">○ Disconnected</span>
              )}
              {connectionStatus === 'failed' && (
                <span className="text-red-600 flex items-center gap-1">
                  <WifiOff className="h-3 w-3" /> Connection Failed
                </span>
              )}
              {connectionStatus === 'max_retries_reached' && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Connection Error
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Connection Error Alert */}
      {(connectionStatus === 'failed' || connectionStatus === 'max_retries_reached') && lastError && (
        <div className="p-4 border-b bg-destructive/10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{lastError}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={manualRetry}
                className="ml-2"
                data-testid="button-retry-connection"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isSender = message.senderId === currentUserId;
              return (
                <div
                  key={message.id}
                  className={`flex ${isSender ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isSender
                        ? "bg-[#6B9080] text-white rounded-br-sm"
                        : "bg-[#E9B44C] text-white rounded-bl-sm"
                    }`}
                    data-testid={`message-bubble-${message.id}`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {format(new Date(message.createdAt), "h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Write down your message..."
            disabled={!isConnected}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!inputMessage.trim() || !isConnected}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-destructive mt-2">
            Reconnecting to chat...
          </p>
        )}
      </div>
    </Card>
  );
}
