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
import cookie from "cookie";
import signature from "cookie-signature";
import { insertUserSchema, insertCompanionSchema, insertBookingSchema } from "@shared/schema";
import { SESSION_SECRET, sessionStore } from "./index";

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
    let authenticatedUserId: string | null = null;

    // Parse session cookie from upgrade request
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionCookie = cookies['connect.sid'];
    
    if (!sessionCookie) {
      ws.close(4001, 'No session cookie');
      return;
    }

    // Verify and unsign the session cookie
    let sessionId: string | false;
    if (sessionCookie.startsWith('s:')) {
      // Remove 's:' prefix and unsign
      sessionId = signature.unsign(sessionCookie.slice(2), SESSION_SECRET);
    } else {
      sessionId = signature.unsign(sessionCookie, SESSION_SECRET);
    }

    if (sessionId === false) {
      ws.close(4001, 'Invalid session signature');
      return;
    }

    // Validate session in store
    sessionStore.get(sessionId, (err, session) => {
      if (err || !session || !session.user) {
        ws.close(4001, 'Invalid or expired session');
        return;
      }

      authenticatedUserId = session.user.id;
      
      // Register client connection
      if (!clients.has(authenticatedUserId)) {
        clients.set(authenticatedUserId, new Set());
      }
      clients.get(authenticatedUserId)!.add(ws);
      
      // Send auth success
      ws.send(JSON.stringify({ type: 'auth', success: true, userId: authenticatedUserId }));
    });

    ws.on('message', async (message) => {
      try {
        // Ensure user is authenticated
        if (!authenticatedUserId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Not authenticated' 
          }));
          return;
        }

        const data = JSON.parse(message.toString());

        if (data.type === 'message') {
          // Verify booking exists and user is a participant
          const booking = await storage.getBooking(data.bookingId);
          if (!booking) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Booking not found' 
            }));
            return;
          }

          // Get companion to check userId
          const companion = await storage.getCompanion(booking.companionId);
          if (!companion) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Companion not found' 
            }));
            return;
          }

          // Verify user is part of this booking
          const isClient = booking.clientId === authenticatedUserId;
          const isCompanion = companion.userId === authenticatedUserId;
          
          if (!isClient && !isCompanion) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Not authorized for this booking' 
            }));
            return;
          }

          // Save message to database
          const msg = await storage.createMessage({
            bookingId: data.bookingId,
            senderId: authenticatedUserId,
            content: data.content,
          });

          // Broadcast to all participants (including sender for echo)
          const participantIds = [booking.clientId, companion.userId];
          
          participantIds.forEach(participantId => {
            const sockets = clients.get(participantId);
            if (sockets) {
              sockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    type: 'message',
                    data: msg,
                  }));
                }
              });
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Internal server error' 
        }));
      }
    });

    ws.on('close', () => {
      if (authenticatedUserId && clients.has(authenticatedUserId)) {
        clients.get(authenticatedUserId)!.delete(ws);
        if (clients.get(authenticatedUserId)!.size === 0) {
          clients.delete(authenticatedUserId);
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

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        return res.json({ 
          message: "Account created successfully",
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          }
        });
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

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        return res.json({ 
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          }
        });
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
      // Validate UUID format to prevent matching non-ID routes
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(req.params.id)) {
        return res.status(404).json({ message: "Invalid companion ID" });
      }

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
      if (!companion) {
        return res.json(null);
      }
      
      const user = await storage.getUser(req.session.user.id);
      return res.json({
        ...companion,
        avatar: user?.avatar,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/companion/profile", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { avatar, ...companionData } = req.body;
      const data = insertCompanionSchema.parse(companionData);

      // Update user avatar if provided
      if (avatar) {
        await storage.updateUser(req.session.user.id, { avatar });
      }

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

  app.put("/api/companion/profile", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const { avatar, ...companionData } = req.body;
      const data = insertCompanionSchema.omit({ userId: true }).partial().parse(companionData);

      // Update user avatar if provided
      if (avatar !== undefined) {
        await storage.updateUser(req.session.user.id, { avatar });
      }

      // Moderate bio if provided
      if (data.bio) {
        const moderation = await moderateText(data.bio);
        if (moderation.flagged) {
          return res.status(400).json({ message: "Inappropriate content in bio" });
        }
      }

      const updated = await storage.updateCompanion(companion.id, data);

      return res.json(updated);
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

      // Persist verified bank data immediately
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (companion) {
        await storage.updateCompanion(companion.id, {
          bankAccountNumber: accountNumber,
          bankAccountName: verification.account_name,
          bankCode: bankCode,
        });
      }

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

      const { accountNumber, bankCode, accountName } = req.body;
      const platformFee = parseFloat(await storage.getAdminSetting("platform_fee") || "20");

      const subaccount = await createSubaccount(
        accountName || req.session.user.name || "Companion",
        accountNumber,
        bankCode,
        platformFee
      );

      await storage.updateCompanion(companion.id, {
        paystackSubaccountCode: subaccount.subaccount_code,
        bankAccountNumber: accountNumber,
        bankAccountName: accountName,
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

      // Get companion details
      const companion = await storage.getCompanion(data.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      // Calculate split amounts
      const platformFee = parseFloat(await storage.getAdminSetting("platform_fee") || "20");
      const { calculateSplitAmounts } = await import("./paystack");
      const splitAmounts = calculateSplitAmounts(parseFloat(data.totalAmount), platformFee);

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

      // Initialize Paystack payment with split payment
      const payment = await initializePayment(
        req.session.user.email,
        parseFloat(data.totalAmount),
        {
          bookingId: booking.id,
          userId: req.session.user.id,
          companionId: data.companionId,
        },
        companion.paystackSubaccountCode || undefined,
        splitAmounts.platformFee
      );

      // Create payment record with split amounts
      await storage.createPayment({
        bookingId: booking.id,
        amount: data.totalAmount,
        paystackReference: payment.reference,
        platformFee: splitAmounts.platformFee.toString(),
        companionEarning: splitAmounts.companionEarning.toString(),
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

          const booking = await storage.getBooking(verification.metadata.bookingId);
          if (booking && booking.status !== "rejected") {
            await storage.updateBooking(verification.metadata.bookingId, {
              status: "accepted",
            });
          }
        }
      }

      return res.json(verification);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/payment/banks", async (req, res) => {
    try {
      const banks = await getBanks();
      return res.json(banks);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== MESSAGE ROUTES ==========

  app.get("/api/bookings/:bookingId/messages", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const booking = await storage.getBooking(req.params.bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify user is part of this booking
      const companion = await storage.getCompanion(booking.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      if (booking.clientId !== req.session.user.id && companion.userId !== req.session.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const messages = await storage.getBookingMessages(req.params.bookingId);
      return res.json(messages);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:bookingId/messages/read", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      await storage.markMessagesAsRead(req.params.bookingId, req.session.user.id);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/stats", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const stats = await storage.getPlatformStats();
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/pending-companions", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const pendingCompanions = await storage.getPendingCompanions();
      
      // Get user details for each companion
      const companionsWithUsers = await Promise.all(
        pendingCompanions.map(async (companion) => {
          const user = await storage.getUser(companion.userId);
          return {
            ...companion,
            user: {
              id: user?.id,
              name: user?.name,
              email: user?.email,
              avatar: user?.avatar,
            },
          };
        })
      );

      return res.json(companionsWithUsers);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/companions/:id/approve", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.updateCompanion(req.params.id, {
        moderationStatus: "approved",
      });

      // Log admin action
      await storage.createAdminLog({
        adminId: req.session.user.id,
        action: "approve_companion",
        targetType: "companion",
        targetId: req.params.id,
      });

      return res.json(companion);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/companions/:id/reject", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { reason } = req.body;

      const companion = await storage.updateCompanion(req.params.id, {
        moderationStatus: "rejected",
      });

      // Log admin action
      await storage.createAdminLog({
        adminId: req.session.user.id,
        action: "reject_companion",
        targetType: "companion",
        targetId: req.params.id,
        details: { reason },
      });

      return res.json(companion);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/settings", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const platformFee = await storage.getAdminSetting("platform_fee_percentage") || "20";
      
      return res.json({
        platformFeePercentage: platformFee,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/settings", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { platformFeePercentage } = req.body;

      if (platformFeePercentage !== undefined) {
        await storage.setAdminSetting("platform_fee_percentage", platformFeePercentage.toString());

        // Log admin action
        await storage.createAdminLog({
          adminId: req.session.user.id,
          action: "update_platform_fee",
          details: { platformFeePercentage },
        });
      }

      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/logs", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAdminLogs(limit);
      return res.json(logs);
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
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.json({
          activeBookings: 0,
          todayEarnings: "0.00",
          responseRate: "0",
          averageRating: "0.0",
          totalHours: 0,
          acceptanceRate: "0",
        });
      }

      const stats = await storage.getCompanionStats(companion.id);

      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
