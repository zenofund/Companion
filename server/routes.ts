import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { moderateText, moderateImage } from "./openai-moderation";
import { 
  initializePayment, 
  verifyPayment, 
  createSubaccount, 
  verifyBankAccount, 
  getBanks 
} from "./paystack";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertCompanionSchema, insertBookingSchema } from "@shared/schema";

// Session user interface
interface SessionUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  avatar?: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time chat (following blueprint:javascript_websocket)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth' && data.userId) {
          userId = data.userId;
          if (!clients.has(userId)) {
            clients.set(userId, new Set());
          }
          clients.get(userId)!.add(ws);
        } else if (data.type === 'message' && userId) {
          // Save message to database
          const msg = await storage.createMessage({
            bookingId: data.bookingId,
            senderId: userId,
            content: data.content,
          });

          // Broadcast to participants
          const booking = await storage.getBooking(data.bookingId);
          if (booking) {
            const recipientId = booking.clientId === userId ? booking.companionId : booking.clientId;
            const recipientSockets = clients.get(recipientId);

            if (recipientSockets) {
              recipientSockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    type: 'message',
                    data: msg,
                  }));
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        clients.get(userId)!.delete(ws);
        if (clients.get(userId)!.size === 0) {
          clients.delete(userId);
        }
      }
    });
  });

  // ========== AUTHENTICATION ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Moderate name/bio if provided
      if (data.name) {
        const moderation = await moderateText(data.name);
        if (moderation.flagged) {
          return res.status(400).json({ message: "Inappropriate content detected" });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      // Set session
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
      };

      return res.json({ 
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        }
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.isBanned) {
        return res.status(403).json({ message: "Account has been banned" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
      };

      return res.json({ 
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        }
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      return res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatar: user.avatar,
        isVerified: user.isVerified,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== COMPANION ROUTES ==========

  app.get("/api/companions", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      const companions = await storage.searchCompanions({
        latitude: lat ? parseFloat(lat as string) : undefined,
        longitude: lng ? parseFloat(lng as string) : undefined,
      });

      // Join with user data
      const enrichedCompanions = await Promise.all(
        companions.map(async (c) => {
          const user = await storage.getUser(c.userId);
          return {
            ...c,
            name: user?.name,
            avatar: user?.avatar,
            email: user?.email,
          };
        })
      );

      return res.json(enrichedCompanions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companions/:id", async (req, res) => {
    try {
      const companion = await storage.getCompanion(req.params.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const user = await storage.getUser(companion.userId);

      return res.json({
        ...companion,
        name: user?.name,
        avatar: user?.avatar,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companion/profile", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      return res.json(companion || null);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/companion/profile", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const data = insertCompanionSchema.parse(req.body);

      // Moderate bio
      if (data.bio) {
        const moderation = await moderateText(data.bio);
        if (moderation.flagged) {
          return res.status(400).json({ message: "Inappropriate content in bio" });
        }
      }

      const companion = await storage.createCompanion({
        ...data,
        userId: req.session.user.id,
      });

      return res.json(companion);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/companion/availability", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const updated = await storage.updateCompanion(companion.id, {
        isAvailable: req.body.isAvailable,
      });

      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/companion/verify-bank", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { accountNumber, bankCode } = req.body;

      const verification = await verifyBankAccount(accountNumber, bankCode);

      return res.json(verification);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/companion/create-subaccount", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const { accountNumber, bankCode } = req.body;
      const platformFee = parseFloat(await storage.getAdminSetting("platform_fee") || "20");

      const subaccount = await createSubaccount(
        req.session.user.name || "Companion",
        accountNumber,
        bankCode,
        platformFee
      );

      await storage.updateCompanion(companion.id, {
        paystackSubaccountCode: subaccount.subaccount_code,
        bankAccountNumber: accountNumber,
        bankCode: bankCode,
      });

      return res.json(subaccount);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== BOOKING ROUTES ==========

  app.post("/api/bookings", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const data = insertBookingSchema.parse(req.body);

      // Create booking with 15-minute expiry
      const requestExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const booking = await storage.createBooking({
        clientId: req.session.user.id,
        companionId: data.companionId,
        bookingDate: data.bookingDate,
        hours: data.hours,
        meetingLocation: data.meetingLocation,
        totalAmount: data.totalAmount,
        specialRequests: data.specialRequests,
        requestExpiresAt,
      });

      // Initialize Paystack payment
      const payment = await initializePayment(
        req.session.user.email,
        parseFloat(data.totalAmount),
        {
          bookingId: booking.id,
          userId: req.session.user.id,
        }
      );

      // Create payment record
      await storage.createPayment({
        bookingId: booking.id,
        amount: data.totalAmount,
        paystackReference: payment.reference,
      });

      return res.json({
        bookingId: booking.id,
        paymentUrl: payment.authorization_url,
        reference: payment.reference,
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/accept", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Check if expired
      if (booking.requestExpiresAt && new Date(booking.requestExpiresAt) < new Date()) {
        await storage.updateBooking(booking.id, { status: "expired" });
        return res.status(400).json({ message: "Booking request has expired" });
      }

      const updated = await storage.updateBooking(booking.id, { status: "accepted" });

      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/reject", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const updated = await storage.updateBooking(req.params.id, { status: "rejected" });
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bookings/client", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const bookings = await storage.getClientBookings(req.session.user.id);
      return res.json(bookings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bookings/pending", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const bookings = await storage.getPendingBookings(companion.id);
      return res.json(bookings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== PAYMENT ROUTES ==========

  app.get("/api/payment/verify/:reference", async (req, res) => {
    try {
      const verification = await verifyPayment(req.params.reference);

      if (verification.status === "success") {
        const payment = await storage.getPaymentByBooking(verification.metadata.bookingId);
        if (payment) {
          await storage.updatePayment(payment.id, {
            status: "paid",
          });

          await storage.updateBooking(verification.metadata.bookingId, {
            status: "pending",
          });
        }
      }

      return res.json(verification);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/stats", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // Return mock stats for now
      return res.json({
        totalUsers: 0,
        newUsers: 0,
        activeBookings: 0,
        platformRevenue: "0.00",
        pendingReviews: 0,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/pending-companions", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // Query pending companions
      return res.json([]);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== STATS ROUTES ==========

  app.get("/api/stats/client", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      return res.json({
        activeBookings: 0,
        totalSpent: "0.00",
        favorites: 0,
        averageRating: "0.0",
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stats/companion", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      return res.json({
        activeBookings: 0,
        todayEarnings: "0.00",
        responseRate: "0",
        averageRating: "0.0",
        totalHours: 0,
        acceptanceRate: "0",
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
