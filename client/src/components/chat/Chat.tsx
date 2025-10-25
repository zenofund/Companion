import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
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

  // WebSocket connection
  const { isConnected, sendMessage: sendWsMessage } = useWebSocket({
    userId: currentUserId,
    onMessage: (wsMessage) => {
      if (wsMessage.type === 'message' && wsMessage.data) {
        setMessages((prev) => [...prev, wsMessage.data]);
        // Scroll to bottom
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    },
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
      // Optimistically add to local state
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        bookingId,
        senderId: currentUserId,
        content: trimmedMessage,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
      setInputMessage("");
      
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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
            <p className="text-xs text-muted-foreground">
              {isConnected ? (
                <span className="text-green-600">● Connected</span>
              ) : (
                <span className="text-gray-500">○ Connecting...</span>
              )}
            </p>
          </div>
        </div>
      </div>

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
