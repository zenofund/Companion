import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { messageBroadcaster } from "./message-broadcaster";
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
import { z } from "zod";
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

// Helper function to recalculate companion's average rating
async function recalculateCompanionRating(companionId: string): Promise<void> {
  try {
    // Get all ratings for this companion where clients have rated
    const allRatings = await storage.getCompanionRatings(companionId);
    const clientRatings = allRatings
      .filter((r: any) => r.clientRating !== null)
      .map((r: any) => r.clientRating);

    if (clientRatings.length > 0) {
      const averageRating = clientRatings.reduce((sum: number, rating: number) => sum + rating, 0) / clientRatings.length;
      await storage.updateCompanion(companionId, {
        averageRating: averageRating.toFixed(2),
      });
    }
  } catch (error) {
    console.error("[Rating] Error recalculating companion rating:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time chat (following blueprint:javascript_websocket)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    let authenticatedUserId: string | null = null;
    console.log('[WebSocket] New connection attempt');

    // Parse session cookie from upgrade request
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionCookie = cookies['connect.sid'];
    
    if (!sessionCookie) {
      console.log('[WebSocket] Connection rejected: No session cookie found');
      ws.close(4001, 'No session cookie');
      return;
    }

    console.log('[WebSocket] Session cookie found, verifying signature...');

    // Verify and unsign the session cookie
    let sessionId: string | false;
    if (sessionCookie.startsWith('s:')) {
      // Remove 's:' prefix and unsign
      sessionId = signature.unsign(sessionCookie.slice(2), SESSION_SECRET);
    } else {
      sessionId = signature.unsign(sessionCookie, SESSION_SECRET);
    }

    if (sessionId === false) {
      console.log('[WebSocket] Connection rejected: Invalid session signature');
      ws.close(4001, 'Invalid session signature');
      return;
    }

    console.log('[WebSocket] Session signature valid, checking session store...');

    // Validate session in store
    sessionStore.get(sessionId, (err, session) => {
      if (err) {
        console.error('[WebSocket] Session store error:', err);
        ws.close(4001, 'Session store error');
        return;
      }
      
      if (!session) {
        console.log('[WebSocket] Connection rejected: Session not found in store');
        ws.close(4001, 'Session not found');
        return;
      }
      
      if (!session.user) {
        console.log('[WebSocket] Connection rejected: No user in session');
        ws.close(4001, 'No user in session');
        return;
      }

      authenticatedUserId = session.user.id;
      console.log('[WebSocket] Authentication successful for user:', authenticatedUserId);
      
      // Register client connection
      if (!clients.has(authenticatedUserId)) {
        clients.set(authenticatedUserId, new Set());
      }
      clients.get(authenticatedUserId)!.add(ws);
      
      console.log('[WebSocket] Client registered, total connections for user:', clients.get(authenticatedUserId)!.size);
      
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

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If the email exists, a reset link has been sent" });
      }

      // Generate reset token
      const crypto = await import('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Save token to database
      await storage.updateUser(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      // Send email with reset link
      const { getUncachableResendClient } = await import('./resend-client');
      const { client, fromEmail } = await getUncachableResendClient();
      
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      
      await client.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Password Reset Request - fliQ',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested to reset your password for your fliQ account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
            <p style="color: #999; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      return res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error: any) {
      console.error("[Password Reset] Error:", error);
      return res.status(500).json({ message: "Failed to process password reset" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (!user.passwordResetExpires || new Date() > new Date(user.passwordResetExpires)) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      return res.json({ message: "Password reset successful" });
    } catch (error: any) {
      console.error("[Password Reset] Error:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
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

  app.get("/api/companions/:id/reviews", async (req, res) => {
    try {
      const companionId = req.params.id;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(companionId)) {
        return res.status(404).json({ message: "Invalid companion ID" });
      }

      // Check if companion exists
      const companion = await storage.getCompanion(companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const reviews = await storage.getCompanionReviews(companionId);
      return res.json(reviews);
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
      const data = insertCompanionSchema.omit({ userId: true }).parse(companionData);

      // Moderate avatar if provided
      if (avatar) {
        const avatarModeration = await moderateImage(avatar);
        if (avatarModeration.flagged) {
          return res.status(400).json({ message: "Inappropriate content in profile picture" });
        }
        await storage.updateUser(req.session.user.id, { avatar });
      }

      // Moderate bio
      if (data.bio) {
        const moderation = await moderateText(data.bio);
        if (moderation.flagged) {
          return res.status(400).json({ message: "Inappropriate content in bio" });
        }
      }

      // Moderate gallery images if provided
      if (data.gallery && data.gallery.length > 0) {
        for (const image of data.gallery) {
          const imageModeration = await moderateImage(image);
          if (imageModeration.flagged) {
            return res.status(400).json({ message: "Inappropriate content in gallery images" });
          }
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

      // Moderate avatar if provided
      if (avatar !== undefined) {
        const avatarModeration = await moderateImage(avatar);
        if (avatarModeration.flagged) {
          return res.status(400).json({ message: "Inappropriate content in profile picture" });
        }
        await storage.updateUser(req.session.user.id, { avatar });
      }

      // Moderate bio if provided
      if (data.bio) {
        const moderation = await moderateText(data.bio);
        if (moderation.flagged) {
          return res.status(400).json({ message: "Inappropriate content in bio" });
        }
      }

      // Moderate gallery images if provided
      if (data.gallery && data.gallery.length > 0) {
        for (const image of data.gallery) {
          const imageModeration = await moderateImage(image);
          if (imageModeration.flagged) {
            return res.status(400).json({ message: "Inappropriate content in gallery images" });
          }
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
      // Custom validation schema for request body
      const requestSchema = z.object({
        companionId: z.string(),
        bookingDate: z.string().transform((val) => new Date(val)),
        hours: z.number().min(1).max(24),
        meetingLocation: z.string().min(5),
        specialRequests: z.string().optional(),
        totalAmount: z.string(),
      });

      const data = requestSchema.parse(req.body);

      // Get companion details
      const companion = await storage.getCompanion(data.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      // Create booking request (pending companion acceptance) with 24-hour expiry
      const requestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

      console.log("[Booking] Request created (pending companion acceptance):", {
        bookingId: booking.id,
        companionId: data.companionId,
      });

      return res.json({
        bookingId: booking.id,
        message: "Booking request sent to companion. Payment will be processed after companion accepts.",
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

      // Get client and companion details for payment
      const client = await storage.getUser(booking.clientId);
      const companion = await storage.getCompanion(booking.companionId);
      
      if (!client || !companion) {
        return res.status(404).json({ message: "Client or companion not found" });
      }

      // Calculate split amounts
      const platformFee = parseFloat(await storage.getAdminSetting("platform_fee") || "20");
      const { calculateSplitAmounts } = await import("./paystack");
      const splitAmounts = calculateSplitAmounts(parseFloat(booking.totalAmount), platformFee);

      // Construct callback base URL
      const protocol = req.protocol;
      const host = req.get('host');
      const callbackBaseUrl = `${protocol}://${host}`;

      // Initialize Paystack payment with split payment
      const payment = await initializePayment(
        client.email,
        parseFloat(booking.totalAmount),
        {
          bookingId: booking.id,
          userId: client.id,
          companionId: companion.id,
        },
        callbackBaseUrl,
        companion.paystackSubaccountCode || undefined,
        splitAmounts.platformFee
      );

      console.log("[Booking] Companion accepted - Payment initialized:", {
        bookingId: booking.id,
        reference: payment.reference,
      });

      // Create payment record with split amounts and store payment URL in metadata
      await storage.createPayment({
        bookingId: booking.id,
        amount: booking.totalAmount,
        paystackReference: payment.reference,
        platformFee: splitAmounts.platformFee.toString(),
        companionEarning: splitAmounts.companionEarning.toString(),
        metadata: {
          authorizationUrl: payment.authorization_url,
        },
      });

      // Update booking to accepted status
      const updated = await storage.updateBooking(booking.id, { status: "accepted" });

      return res.json({
        booking: updated,
        paymentUrl: payment.authorization_url,
        reference: payment.reference,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get payment URL for accepted booking
  app.get("/api/bookings/:id/payment-url", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify user owns this booking
      if (booking.clientId !== req.session.user.id) {
        return res.status(403).json({ message: "Not your booking" });
      }

      if (booking.status !== "accepted") {
        return res.status(400).json({ message: "Booking is not pending payment" });
      }

      // Get payment record
      const payment = await storage.getPaymentByBooking(booking.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment information not found" });
      }

      // Check if metadata exists with payment URL
      const metadata = payment.metadata as any;
      if (metadata && metadata.authorizationUrl) {
        return res.json({
          paymentUrl: metadata.authorizationUrl,
          reference: payment.paystackReference,
        });
      }

      // If no metadata, re-initialize payment (for old bookings)
      const client = await storage.getUser(booking.clientId);
      const companion = await storage.getCompanion(booking.companionId);
      
      if (!client || !companion) {
        return res.status(404).json({ message: "Client or companion not found" });
      }

      const protocol = req.protocol;
      const host = req.get('host');
      const callbackBaseUrl = `${protocol}://${host}`;

      const platformFee = parseFloat(await storage.getAdminSetting("platform_fee") || "20");
      const { calculateSplitAmounts } = await import("./paystack");
      const splitAmounts = calculateSplitAmounts(parseFloat(booking.totalAmount), platformFee);

      const newPayment = await initializePayment(
        client.email,
        parseFloat(booking.totalAmount),
        {
          bookingId: booking.id,
          userId: client.id,
          companionId: companion.id,
        },
        callbackBaseUrl,
        companion.paystackSubaccountCode || undefined,
        splitAmounts.platformFee
      );

      // Update payment with new URL
      await storage.updatePayment(payment.id, {
        paystackReference: newPayment.reference,
        metadata: {
          authorizationUrl: newPayment.authorization_url,
        },
      });

      return res.json({
        paymentUrl: newPayment.authorization_url,
        reference: newPayment.reference,
      });
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

  app.post("/api/bookings/:id/complete", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Set to pending_completion and record timestamp
      const updated = await storage.updateBooking(booking.id, { 
        status: "pending_completion",
        completionRequestedAt: new Date()
      });
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Client confirms booking completion
  app.post("/api/bookings/:id/confirm-completion", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify client owns this booking
      if (booking.clientId !== req.session.user.id) {
        return res.status(403).json({ message: "Not your booking" });
      }

      if (booking.status !== "pending_completion") {
        return res.status(400).json({ message: "Booking is not pending completion" });
      }

      const updated = await storage.updateBooking(booking.id, { status: "completed" });
      return res.json(updated);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Client disputes booking completion
  app.post("/api/bookings/:id/dispute", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // Validate request body
      const disputeSchema = z.object({
        reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason must not exceed 500 characters"),
      });

      const { reason } = disputeSchema.parse(req.body);

      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify client owns this booking
      if (booking.clientId !== req.session.user.id) {
        return res.status(403).json({ message: "Not your booking" });
      }

      if (booking.status !== "pending_completion") {
        return res.status(400).json({ message: "Booking is not pending completion" });
      }

      const updated = await storage.updateBooking(booking.id, { 
        status: "disputed",
        disputeReason: reason,
        disputedAt: new Date(),
      });
      
      console.log("[Booking] Dispute opened:", {
        bookingId: booking.id,
        clientId: booking.clientId,
        companionId: booking.companionId,
        reason,
      });

      return res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
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

  app.get("/api/bookings/client/pending-completion", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // Auto-complete any requests older than 48 hours
      await storage.autoCompleteExpiredRequests();
      
      // Fetch remaining pending completion bookings
      const bookings = await storage.getPendingCompletionBookings(req.session.user.id);
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

  app.get("/api/bookings/companion/active", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const bookings = await storage.getActiveBookings(companion.id);
      return res.json(bookings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bookings/companion/completed", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "companion") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const companion = await storage.getCompanionByUserId(req.session.user.id);
      if (!companion) {
        return res.status(404).json({ message: "Companion profile not found" });
      }

      const bookings = await storage.getCompletedBookings(companion.id);
      return res.json(bookings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single booking by ID (must come AFTER specific routes to avoid conflicts)
  app.get("/api/bookings/:id", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const booking = await storage.getBooking(req.params.id);
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

      return res.json(booking);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Submit or update rating for a booking
  app.post("/api/bookings/:id/rate", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const bookingId = req.params.id;
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Only completed bookings can be rated
      if (booking.status !== "completed") {
        return res.status(400).json({ message: "Can only rate completed bookings" });
      }

      // Verify user is part of this booking
      const companion = await storage.getCompanion(booking.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const isClient = req.session.user.id === booking.clientId;
      const isCompanion = req.session.user.id === companion.userId;

      if (!isClient && !isCompanion) {
        return res.status(403).json({ message: "Not authorized to rate this booking" });
      }

      // Validate rating data
      const ratingSchema = z.object({
        rating: z.number().min(1).max(5),
        review: z.string().optional(),
      });

      const data = ratingSchema.parse(req.body);

      // Check if rating already exists
      let existingRating = await storage.getRatingByBooking(bookingId);

      if (existingRating) {
        // Update existing rating with the user's rating
        const updates: any = {};
        if (isClient) {
          if (existingRating.clientRating) {
            return res.status(400).json({ message: "You have already rated this booking" });
          }
          updates.clientRating = data.rating;
          updates.clientReview = data.review || null;
        } else {
          if (existingRating.companionRating) {
            return res.status(400).json({ message: "You have already rated this booking" });
          }
          updates.companionRating = data.rating;
          updates.companionReview = data.review || null;
        }

        const updatedRating = await storage.updateRating(existingRating.id, updates);
        
        // Recalculate companion's average rating if client rated
        if (isClient) {
          await recalculateCompanionRating(booking.companionId);
        }
        
        return res.json(updatedRating);
      } else {
        // Create new rating
        const newRating = await storage.createRating({
          bookingId,
          clientId: booking.clientId,
          companionId: booking.companionId,
          clientRating: isClient ? data.rating : null,
          clientReview: isClient ? (data.review || null) : null,
          companionRating: isCompanion ? data.rating : null,
          companionReview: isCompanion ? (data.review || null) : null,
        });

        // Recalculate companion's average rating if client rated
        if (isClient) {
          await recalculateCompanionRating(booking.companionId);
        }

        return res.json(newRating);
      }
    } catch (error: any) {
      console.error("[Rating] Error submitting rating:", error);
      return res.status(400).json({ message: error.message });
    }
  });

  // Get rating for a booking
  app.get("/api/ratings/:bookingId", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const rating = await storage.getRatingByBooking(req.params.bookingId);
      return res.json(rating || null);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== PAYMENT ROUTES ==========

  // Paystack callback - redirects user back to app after payment
  app.get("/payment/callback", async (req, res) => {
    console.log("[Payment Callback] Received callback from Paystack", {
      reference: req.query.reference,
      allParams: req.query
    });

    const reference = req.query.reference as string;

    if (!reference) {
      console.error("[Payment Callback] No reference provided");
      return res.redirect("/?payment=error");
    }

    try {
      console.log("[Payment Callback] Verifying payment:", reference);
      const verification = await verifyPayment(reference);
      console.log("[Payment Callback] Verification result:", verification);

      if (verification.status === "success") {
        const payment = await storage.getPaymentByBooking(verification.metadata.bookingId);
        if (payment) {
          await storage.updatePayment(payment.id, {
            status: "paid",
          });

          const booking = await storage.getBooking(verification.metadata.bookingId);
          if (booking && booking.status !== "rejected") {
            await storage.updateBooking(verification.metadata.bookingId, {
              status: "active",
            });
          }
          console.log("[Payment Callback] Payment processed successfully, redirecting to dashboard");
        }

        // Redirect to client dashboard with success message
        return res.redirect("/dashboard/client?payment=success");
      } else {
        console.error("[Payment Callback] Payment verification failed:", verification.status);
        return res.redirect("/dashboard/client?payment=failed");
      }
    } catch (error: any) {
      console.error("[Payment Callback] Error processing callback:", error);
      return res.redirect("/dashboard/client?payment=error");
    }
  });

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
              status: "active",
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

  // SSE stream endpoint for real-time messages
  app.get("/api/bookings/:bookingId/messages/stream", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { bookingId } = req.params;
    const userId = req.session.user.id;

    try {
      // Verify booking exists and user is authorized
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const companion = await storage.getCompanion(booking.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const isClient = booking.clientId === userId;
      const isCompanion = companion.userId === userId;

      if (!isClient && !isCompanion) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', bookingId })}\n\n`);

      // Register this client with the broadcaster
      messageBroadcaster.registerClient(bookingId, userId, res);

      console.log(`[SSE] Client connected for booking ${bookingId}, user ${userId}`);
    } catch (error: any) {
      console.error('[SSE] Stream setup error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ message: error.message });
      }
    }
  });

  // POST endpoint for sending messages (replaces WebSocket send)
  app.post("/api/bookings/:bookingId/messages", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { bookingId } = req.params;
    const userId = req.session.user.id;

    try {
      // Validate request body
      const messageSchema = z.object({
        content: z.string().min(1).max(2000),
      });

      const { content } = messageSchema.parse(req.body);

      // Verify booking exists and user is authorized
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const companion = await storage.getCompanion(booking.companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const isClient = booking.clientId === userId;
      const isCompanion = companion.userId === userId;

      if (!isClient && !isCompanion) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Create and save message
      const message = await storage.createMessage({
        bookingId,
        senderId: userId,
        content,
      });

      // Broadcast to all SSE clients connected to this booking
      messageBroadcaster.broadcastMessage(bookingId, {
        type: 'message',
        data: message,
      });

      // Return the created message
      return res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message content" });
      }
      console.error('[POST Message] Error:', error);
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

  app.get("/api/admin/disputed-bookings", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const disputedBookings = await storage.getDisputedBookings();
      return res.json(disputedBookings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/bookings/:id/resolve-dispute", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // Validate request body
      const resolveSchema = z.object({
        resolution: z.enum(["complete", "revoke"], {
          errorMap: () => ({ message: "Resolution must be either 'complete' or 'revoke'" }),
        }),
        notes: z.string().max(500, "Notes must not exceed 500 characters").optional(),
      });

      const { resolution, notes } = resolveSchema.parse(req.body);

      const updatedBooking = await storage.resolveDispute(
        req.params.id,
        resolution,
        req.session.user.id,
        notes
      );

      console.log("[Admin] Dispute resolved:", {
        bookingId: req.params.id,
        resolution,
        adminId: req.session.user.id,
      });

      return res.json(updatedBooking);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
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
      const stats = await storage.getClientStats(req.session.user.id);
      return res.json(stats);
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

  // ========== FAVORITES ROUTES ==========

  // GET routes must come before parameterized routes to avoid conflicts
  app.get("/api/favorites/companions", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can view favorites" });
    }

    try {
      const favoriteCompanions = await storage.getUserFavoriteCompanions(req.session.user.id);
      return res.json(favoriteCompanions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/favorites/:companionId", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can check favorites" });
    }

    try {
      const companionId = req.params.companionId;
      const isFavorite = await storage.isFavorite(req.session.user.id, companionId);
      return res.json({ isFavorite });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/favorites", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can view favorites" });
    }

    try {
      const favoriteIds = await storage.getUserFavorites(req.session.user.id);
      return res.json(favoriteIds);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/favorites/:companionId", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can favorite companions" });
    }

    try {
      const companionId = req.params.companionId;
      
      // Check if companion exists
      const companion = await storage.getCompanion(companionId);
      if (!companion) {
        return res.status(404).json({ message: "Companion not found" });
      }

      const favorite = await storage.addFavorite(req.session.user.id, companionId);
      return res.json(favorite);
    } catch (error: any) {
      // Handle duplicate favorite (unique constraint violation)
      if (error.code === "23505") {
        return res.status(409).json({ message: "Already favorited" });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/favorites/:companionId", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can unfavorite companions" });
    }

    try {
      const companionId = req.params.companionId;
      await storage.removeFavorite(req.session.user.id, companionId);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
