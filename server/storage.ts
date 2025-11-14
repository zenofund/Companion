// Database storage implementation following blueprint:javascript_database
import { 
  users, 
  companions, 
  bookings, 
  payments, 
  messages, 
  ratings,
  adminSettings,
  adminLogs,
  userFavorites,
  type User, 
  type InsertUser,
  type Companion,
  type InsertCompanion,
  type Booking,
  type InsertBooking,
  type Payment,
  type InsertPayment,
  type Message,
  type InsertMessage,
  type Rating,
  type InsertRating,
  type UserFavorite,
  type InsertUserFavorite,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, gte, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  // Companions
  getCompanion(id: string): Promise<Companion | undefined>;
  getCompanionByUserId(userId: string): Promise<Companion | undefined>;
  createCompanion(companion: InsertCompanion): Promise<Companion>;
  updateCompanion(id: string, updates: Partial<Companion>): Promise<Companion>;
  searchCompanions(params: { latitude?: number; longitude?: number; limit?: number }): Promise<Companion[]>;

  // Bookings
  getBooking(id: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking & { requestExpiresAt?: Date }): Promise<Booking>;
  updateBooking(id: string, updates: Partial<Booking>): Promise<Booking>;
  getClientBookings(clientId: string): Promise<Booking[]>;
  getCompanionBookings(companionId: string): Promise<Booking[]>;
  getPendingBookings(companionId: string): Promise<Booking[]>;
  getActiveBookings(companionId: string): Promise<any[]>;
  getCompletedBookings(companionId: string): Promise<any[]>;
  getPendingCompletionBookings(clientId: string): Promise<any[]>;
  autoCompleteExpiredRequests(): Promise<number>;
  getCompanionStats(companionId: string): Promise<{
    activeBookings: number;
    todayEarnings: string;
    responseRate: string;
    averageRating: string;
    totalHours: number;
    acceptanceRate: string;
  }>;

  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentByBooking(bookingId: string): Promise<Payment | undefined>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getBookingMessages(bookingId: string): Promise<Message[]>;
  markMessagesAsRead(bookingId: string, userId: string): Promise<void>;

  // Ratings
  createRating(rating: InsertRating): Promise<Rating>;
  getRatingByBooking(bookingId: string): Promise<Rating | undefined>;
  updateRating(id: string, updates: Partial<Rating>): Promise<Rating>;
  getCompanionReviews(companionId: string): Promise<any[]>;

  // Favorites
  addFavorite(userId: string, companionId: string): Promise<UserFavorite>;
  removeFavorite(userId: string, companionId: string): Promise<void>;
  getUserFavorites(userId: string): Promise<string[]>;
  isFavorite(userId: string, companionId: string): Promise<boolean>;

  // Stats
  getClientStats(clientId: string): Promise<{
    activeBookings: number;
    totalSpent: string;
    favorites: number;
    averageRating: string;
  }>;

  // Admin
  getAdminSetting(key: string): Promise<string | undefined>;
  setAdminSetting(key: string, value: string): Promise<void>;
  createAdminLog(log: { adminId: string; action: string; targetType?: string; targetId?: string; details?: any }): Promise<void>;
  getPendingCompanions(): Promise<Companion[]>;
  getAdminLogs(limit?: number): Promise<any[]>;
  getPlatformStats(): Promise<{
    totalUsers: number;
    totalCompanions: number;
    totalBookings: number;
    totalRevenue: string;
    pendingModeration: number;
    disputedBookings: number;
  }>;
  getDisputedBookings(): Promise<any[]>;
  resolveDispute(bookingId: string, resolution: "complete" | "revoke", adminId: string, notes?: string): Promise<Booking>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Companions
  async getCompanion(id: string): Promise<Companion | undefined> {
    const [companion] = await db.select().from(companions).where(eq(companions.id, id));
    return companion || undefined;
  }

  async getCompanionByUserId(userId: string): Promise<Companion | undefined> {
    const [companion] = await db.select().from(companions).where(eq(companions.userId, userId));
    return companion || undefined;
  }

  async createCompanion(insertCompanion: InsertCompanion): Promise<Companion> {
    const [companion] = await db.insert(companions).values(insertCompanion).returning();
    return companion;
  }

  async updateCompanion(id: string, updates: Partial<Companion>): Promise<Companion> {
    const [companion] = await db
      .update(companions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companions.id, id))
      .returning();
    return companion;
  }

  async searchCompanions(params: { latitude?: number; longitude?: number; limit?: number }): Promise<Companion[]> {
    // Get approved, available companions
    const results = await db
      .select()
      .from(companions)
      .where(
        and(
          eq(companions.moderationStatus, "approved"),
          eq(companions.isAvailable, true)
        )
      )
      .limit(params.limit || 50);

    return results;
  }

  // Bookings
  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async createBooking(insertBooking: InsertBooking & { requestExpiresAt?: Date }): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(insertBooking).returning();
    return booking;
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async getClientBookings(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        companion: companions,
        companionUser: users,
      })
      .from(bookings)
      .leftJoin(companions, eq(bookings.companionId, companions.id))
      .leftJoin(users, eq(companions.userId, users.id))
      .where(eq(bookings.clientId, clientId))
      .orderBy(desc(bookings.createdAt));
    
    return results.map(r => ({ 
      ...r.booking, 
      companionName: r.companionUser?.name || "Unknown",
    }));
  }

  async getCompanionBookings(companionId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        payment: payments,
        client: users,
      })
      .from(bookings)
      .leftJoin(payments, eq(bookings.id, payments.bookingId))
      .leftJoin(users, eq(bookings.clientId, users.id))
      .where(eq(bookings.companionId, companionId))
      .orderBy(desc(bookings.createdAt));
    
    return results.map(r => ({ 
      ...r.booking, 
      payment: r.payment,
      clientName: r.client?.name || "Unknown",
    }));
  }

  async getPendingBookings(companionId: string): Promise<any[]> {
    const now = new Date();
    const results = await db
      .select({
        booking: bookings,
        client: users,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.clientId, users.id))
      .where(
        and(
          eq(bookings.companionId, companionId),
          eq(bookings.status, "pending"),
          gte(bookings.requestExpiresAt, now)
        )
      )
      .orderBy(bookings.requestExpiresAt);
    
    return results.map(r => ({
      ...r.booking,
      clientName: r.client?.name || "Unknown",
    }));
  }

  async getActiveBookings(companionId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        client: users,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.clientId, users.id))
      .where(
        and(
          eq(bookings.companionId, companionId),
          sql`${bookings.status} IN ('accepted', 'active')`
        )
      )
      .orderBy(desc(bookings.bookingDate));
    
    return results.map(r => ({
      ...r.booking,
      clientName: r.client?.name || "Unknown",
      clientAvatar: r.client?.avatar || null,
    }));
  }

  async getCompletedBookings(companionId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        client: users,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.clientId, users.id))
      .where(
        and(
          eq(bookings.companionId, companionId),
          eq(bookings.status, "completed")
        )
      )
      .orderBy(desc(bookings.bookingDate));
    
    return results.map(r => ({
      ...r.booking,
      clientName: r.client?.name || "Unknown",
      clientAvatar: r.client?.avatar || null,
    }));
  }

  async getPendingCompletionBookings(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        companion: companions,
        companionUser: users,
      })
      .from(bookings)
      .leftJoin(companions, eq(bookings.companionId, companions.id))
      .leftJoin(users, eq(companions.userId, users.id))
      .where(
        and(
          eq(bookings.clientId, clientId),
          eq(bookings.status, "pending_completion")
        )
      )
      .orderBy(desc(bookings.completionRequestedAt));
    
    return results.map(r => ({
      ...r.booking,
      companionName: r.companionUser?.name || "Unknown",
      companionAvatar: r.companionUser?.avatar || null,
    }));
  }

  async autoCompleteExpiredRequests(): Promise<number> {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    
    const expiredBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "pending_completion"),
          sql`${bookings.completionRequestedAt} < ${fortyEightHoursAgo}`
        )
      );

    for (const booking of expiredBookings) {
      await this.updateBooking(booking.id, { status: "completed" });
    }

    return expiredBookings.length;
  }

  async getCompanionStats(companionId: string): Promise<{
    activeBookings: number;
    todayEarnings: string;
    responseRate: string;
    averageRating: string;
    totalHours: number;
    acceptanceRate: string;
  }> {
    // Get all bookings with payments
    const allBookings = await this.getCompanionBookings(companionId);
    
    // Active bookings (accepted or active status)
    const activeBookings = allBookings.filter(
      (b: any) => b.status === "accepted" || b.status === "active"
    ).length;

    // Today's earnings (completed bookings today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEarnings = allBookings
      .filter((b: any) => 
        b.status === "completed" && 
        b.updatedAt && 
        new Date(b.updatedAt) >= today &&
        b.payment
      )
      .reduce((sum: number, b: any) => {
        return sum + parseFloat(b.payment.companionEarning || "0");
      }, 0);

    // Total hours from completed bookings
    const totalHours = allBookings
      .filter((b: any) => b.status === "completed")
      .reduce((sum: number, b: any) => sum + (b.hours || 0), 0);

    // Response rate (accepted + rejected) / total requests in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRequests = allBookings.filter(
      (b: any) => b.createdAt && new Date(b.createdAt) >= thirtyDaysAgo
    );
    const respondedRequests = recentRequests.filter(
      (b: any) => b.status !== "pending" && b.status !== "expired"
    );
    const responseRate = recentRequests.length > 0
      ? Math.round((respondedRequests.length / recentRequests.length) * 100)
      : 0;

    // Acceptance rate (accepted or completed) / responded requests
    const acceptedRequests = respondedRequests.filter(
      (b: any) => b.status === "accepted" || b.status === "active" || b.status === "completed"
    );
    const acceptanceRate = respondedRequests.length > 0
      ? Math.round((acceptedRequests.length / respondedRequests.length) * 100)
      : 0;

    // Average rating
    const ratingsResult = await db
      .select({ rating: ratings.companionRating })
      .from(ratings)
      .leftJoin(bookings, eq(ratings.bookingId, bookings.id))
      .where(eq(bookings.companionId, companionId));
    
    const avgRating = ratingsResult.length > 0
      ? (ratingsResult.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsResult.length).toFixed(1)
      : "0.0";

    return {
      activeBookings,
      todayEarnings: todayEarnings.toFixed(2),
      responseRate: responseRate.toString(),
      averageRating: avgRating,
      totalHours,
      acceptanceRate: acceptanceRate.toString(),
    };
  }

  // Payments
  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async getPaymentByBooking(bookingId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId));
    return payment || undefined;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const [payment] = await db
      .update(payments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  // Messages
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async getBookingMessages(bookingId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.bookingId, bookingId))
      .orderBy(messages.createdAt);
  }

  async markMessagesAsRead(bookingId: string, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.bookingId, bookingId),
          sql`${messages.senderId} != ${userId}`
        )
      );
  }

  // Ratings
  async createRating(insertRating: InsertRating): Promise<Rating> {
    const [rating] = await db.insert(ratings).values(insertRating).returning();
    return rating;
  }

  async getRatingByBooking(bookingId: string): Promise<Rating | undefined> {
    const [rating] = await db.select().from(ratings).where(eq(ratings.bookingId, bookingId));
    return rating || undefined;
  }

  async updateRating(id: string, updates: Partial<Rating>): Promise<Rating> {
    const [rating] = await db
      .update(ratings)
      .set(updates)
      .where(eq(ratings.id, id))
      .returning();
    return rating;
  }

  async getCompanionRatings(companionId: string): Promise<Rating[]> {
    return await db
      .select()
      .from(ratings)
      .where(eq(ratings.companionId, companionId));
  }

  async getCompanionReviews(companionId: string): Promise<any[]> {
    const results = await db
      .select({
        rating: ratings.clientRating,
        review: ratings.clientReview,
        createdAt: ratings.createdAt,
        clientName: users.name,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.clientId, users.id))
      .where(
        and(
          eq(ratings.companionId, companionId),
          isNotNull(ratings.clientRating),
          isNotNull(ratings.clientReview)
        )
      )
      .orderBy(desc(ratings.createdAt))
      .limit(20);
    
    // Sanitize client names for privacy
    return results.map(r => ({
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      reviewerName: r.clientName 
        ? `${r.clientName.split(' ')[0]} ${r.clientName.split(' ').slice(1).map((n: string) => n[0]).join('')}.`
        : "Verified client",
      verified: true,
    }));
  }

  // Favorites
  async addFavorite(userId: string, companionId: string): Promise<UserFavorite> {
    const [favorite] = await db
      .insert(userFavorites)
      .values({ userId, companionId })
      .returning();
    return favorite;
  }

  async removeFavorite(userId: string, companionId: string): Promise<void> {
    await db
      .delete(userFavorites)
      .where(
        and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.companionId, companionId)
        )
      );
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    const favorites = await db
      .select({ companionId: userFavorites.companionId })
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId));
    return favorites.map(f => f.companionId);
  }

  async getUserFavoriteCompanions(userId: string): Promise<any[]> {
    const favorites = await db
      .select({
        id: companions.id,
        userId: companions.userId,
        name: users.name,
        avatar: users.avatar,
        hourlyRate: companions.hourlyRate,
        bio: companions.bio,
        gallery: companions.gallery,
        city: companions.city,
        latitude: companions.latitude,
        longitude: companions.longitude,
        isAvailable: companions.isAvailable,
        languages: companions.languages,
        services: companions.services,
        interests: companions.interests,
        moderationStatus: companions.moderationStatus,
        averageRating: companions.averageRating,
        totalBookings: companions.totalBookings,
        favoritedAt: userFavorites.createdAt,
      })
      .from(userFavorites)
      .innerJoin(companions, eq(userFavorites.companionId, companions.id))
      .innerJoin(users, eq(companions.userId, users.id))
      .where(eq(userFavorites.userId, userId))
      .orderBy(desc(userFavorites.createdAt));
    
    return favorites;
  }

  async isFavorite(userId: string, companionId: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(userFavorites)
      .where(
        and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.companionId, companionId)
        )
      );
    return !!favorite;
  }

  // Stats
  async getClientStats(clientId: string): Promise<{
    activeBookings: number;
    totalSpent: string;
    favorites: number;
    averageRating: string;
  }> {
    // Count active bookings
    const activeBookingsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.clientId, clientId),
          sql`${bookings.status} IN ('active', 'pending_completion')`
        )
      );
    const activeBookings = activeBookingsResult[0]?.count || 0;

    // Calculate total spent from completed bookings
    const totalSpentResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${bookings.totalAmount}), 0)::text` })
      .from(bookings)
      .where(
        and(
          eq(bookings.clientId, clientId),
          eq(bookings.status, "completed")
        )
      );
    const totalSpent = totalSpentResult[0]?.total || "0.00";

    // Count favorites
    const favoritesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFavorites)
      .where(eq(userFavorites.userId, clientId));
    const favorites = favoritesResult[0]?.count || 0;

    // Calculate average rating given by this client to companions
    const avgRatingResult = await db
      .select({ avg: sql<string>`COALESCE(TO_CHAR(ROUND(AVG(${ratings.clientRating}), 1), 'FM990.0'), '0.0')` })
      .from(ratings)
      .where(
        and(
          eq(ratings.clientId, clientId),
          sql`${ratings.clientRating} IS NOT NULL`
        )
      );
    const averageRating = avgRatingResult[0]?.avg || "0.0";

    return {
      activeBookings,
      totalSpent,
      favorites,
      averageRating,
    };
  }

  // Admin
  async getAdminSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
    return setting?.value;
  }

  async setAdminSetting(key: string, value: string): Promise<void> {
    await db
      .insert(adminSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: adminSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async createAdminLog(log: { 
    adminId: string; 
    action: string; 
    targetType?: string; 
    targetId?: string; 
    details?: any 
  }): Promise<void> {
    await db.insert(adminLogs).values(log);
  }

  async getPendingCompanions(): Promise<Companion[]> {
    const results = await db
      .select()
      .from(companions)
      .where(eq(companions.moderationStatus, "pending"))
      .orderBy(desc(companions.createdAt));
    return results;
  }

  async getAdminLogs(limit: number = 50): Promise<any[]> {
    const logs = await db
      .select({
        id: adminLogs.id,
        adminId: adminLogs.adminId,
        action: adminLogs.action,
        targetType: adminLogs.targetType,
        targetId: adminLogs.targetId,
        details: adminLogs.details,
        createdAt: adminLogs.createdAt,
        adminName: users.name,
        adminEmail: users.email,
      })
      .from(adminLogs)
      .leftJoin(users, eq(adminLogs.adminId, users.id))
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit);
    return logs;
  }

  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalCompanions: number;
    totalBookings: number;
    totalRevenue: string;
    pendingModeration: number;
    disputedBookings: number;
  }> {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [companionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(companions);

    const [bookingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings);

    const [revenueSum] = await db
      .select({ sum: sql<string>`COALESCE(SUM(${payments.platformFee}), 0)` })
      .from(payments)
      .where(eq(payments.status, "paid"));

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(companions)
      .where(eq(companions.moderationStatus, "pending"));

    const [disputedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.status, "disputed"));

    return {
      totalUsers: Number(userCount.count) || 0,
      totalCompanions: Number(companionCount.count) || 0,
      totalBookings: Number(bookingCount.count) || 0,
      totalRevenue: revenueSum.sum || "0",
      pendingModeration: Number(pendingCount.count) || 0,
      disputedBookings: Number(disputedCount.count) || 0,
    };
  }

  async getDisputedBookings(): Promise<any[]> {
    // Use alias for companion's user to avoid conflict
    const companionUser = alias(users, "companionUser");
    
    const results = await db
      .select({
        booking: bookings,
        client: users,
        companion: companions,
        companionUser: companionUser,
        payment: payments,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.clientId, users.id))
      .leftJoin(companions, eq(bookings.companionId, companions.id))
      .leftJoin(companionUser, eq(companions.userId, companionUser.id))
      .leftJoin(payments, eq(bookings.id, payments.bookingId))
      .where(eq(bookings.status, "disputed"))
      .orderBy(desc(bookings.disputedAt));

    return results.map(r => ({
      ...r.booking,
      clientName: r.client?.name || "Unknown",
      clientEmail: r.client?.email,
      companionName: r.companionUser?.name || "Unknown",
      companionEmail: r.companionUser?.email,
      payment: r.payment,
    }));
  }

  async resolveDispute(
    bookingId: string,
    resolution: "complete" | "revoke",
    adminId: string,
    notes?: string
  ): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "disputed") {
      throw new Error("Booking is not in disputed status");
    }

    // Resolve based on resolution type
    if (resolution === "complete") {
      // Admin sides with companion - complete the booking
      const [updatedBooking] = await db
        .update(bookings)
        .set({ 
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      // Mark payment as paid
      await db
        .update(payments)
        .set({ 
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(payments.bookingId, bookingId));

      // Log admin action
      await this.createAdminLog({
        adminId,
        action: "resolve_dispute_complete",
        targetType: "booking",
        targetId: bookingId,
        details: { resolution, notes },
      });

      return updatedBooking;
    } else {
      // Admin sides with client - revoke/cancel the booking
      const [updatedBooking] = await db
        .update(bookings)
        .set({ 
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      // Mark payment for manual refund processing
      await db
        .update(payments)
        .set({ 
          status: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(payments.bookingId, bookingId));

      // Log admin action
      await this.createAdminLog({
        adminId,
        action: "resolve_dispute_revoke",
        targetType: "booking",
        targetId: bookingId,
        details: { resolution, notes },
      });

      return updatedBooking;
    }
  }
}

export const storage = new DatabaseStorage();
