import type { Response } from "express";

interface SSEClient {
  response: Response;
  bookingId: string;
  userId: string;
}

class MessageBroadcaster {
  private clients: Map<string, SSEClient[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Register a new SSE client for a specific booking
   */
  registerClient(bookingId: string, userId: string, response: Response): void {
    const client: SSEClient = { response, bookingId, userId };
    
    if (!this.clients.has(bookingId)) {
      this.clients.set(bookingId, []);
    }
    
    this.clients.get(bookingId)!.push(client);
    console.log(`[SSE] Client registered for booking ${bookingId}, user ${userId}. Total clients: ${this.clients.get(bookingId)!.length}`);

    // Remove client when connection ends (handle all termination events)
    const cleanup = () => this.unregisterClient(bookingId, userId, response);
    
    response.on('close', cleanup);
    response.on('finish', cleanup);
    response.on('error', (error) => {
      console.error(`[SSE] Connection error for booking ${bookingId}, user ${userId}:`, error);
      cleanup();
    });
  }

  /**
   * Unregister an SSE client
   */
  private unregisterClient(bookingId: string, userId: string, response: Response): void {
    const clients = this.clients.get(bookingId);
    if (clients) {
      const index = clients.findIndex(c => c.response === response);
      if (index !== -1) {
        clients.splice(index, 1);
        console.log(`[SSE] Client unregistered for booking ${bookingId}, user ${userId}. Remaining: ${clients.length}`);
      }
      
      // Clean up empty booking entries
      if (clients.length === 0) {
        this.clients.delete(bookingId);
      }
    }
  }

  /**
   * Broadcast a message to all clients connected to a specific booking
   */
  broadcastMessage(bookingId: string, message: any): void {
    const clients = this.clients.get(bookingId);
    if (!clients || clients.length === 0) {
      console.log(`[SSE] No clients to broadcast to for booking ${bookingId}`);
      return;
    }

    const messageData = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;

    clients.forEach(client => {
      try {
        if (!client.response.writableEnded) {
          client.response.write(`data: ${messageData}\n\n`);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('[SSE] Error sending message to client:', error);
        failCount++;
      }
    });

    console.log(`[SSE] Broadcast to booking ${bookingId}: ${successCount} successful, ${failCount} failed`);
  }

  /**
   * Send heartbeat to all connected clients to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      let totalClients = 0;
      
      this.clients.forEach((clients, bookingId) => {
        clients.forEach(client => {
          try {
            if (!client.response.writableEnded) {
              client.response.write(': heartbeat\n\n');
              totalClients++;
            }
          } catch (error) {
            console.error('[SSE] Heartbeat error:', error);
          }
        });
      });

      if (totalClients > 0) {
        console.log(`[SSE] Heartbeat sent to ${totalClients} clients across ${this.clients.size} bookings`);
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Clean up and stop heartbeat
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close all connections
    this.clients.forEach((clients) => {
      clients.forEach(client => {
        if (!client.response.writableEnded) {
          client.response.end();
        }
      });
    });
    
    this.clients.clear();
    console.log('[SSE] Broadcaster destroyed');
  }

  /**
   * Get statistics about connected clients
   */
  getStats(): { totalBookings: number; totalClients: number } {
    let totalClients = 0;
    this.clients.forEach(clients => {
      totalClients += clients.length;
    });
    
    return {
      totalBookings: this.clients.size,
      totalClients
    };
  }
}

// Export singleton instance
export const messageBroadcaster = new MessageBroadcaster();
