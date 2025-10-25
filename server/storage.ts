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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  }>;
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

  async getClientBookings(clientId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.clientId, clientId))
      .orderBy(desc(bookings.createdAt));
  }

  async getCompanionBookings(companionId: string): Promise<any[]> {
    const results = await db
      .select({
        booking: bookings,
        payment: payments,
      })
      .from(bookings)
      .leftJoin(payments, eq(bookings.id, payments.bookingId))
      .where(eq(bookings.companionId, companionId))
      .orderBy(desc(bookings.createdAt));
    
    return results.map(r => ({ ...r.booking, payment: r.payment }));
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

    return {
      totalUsers: Number(userCount.count) || 0,
      totalCompanions: Number(companionCount.count) || 0,
      totalBookings: Number(bookingCount.count) || 0,
      totalRevenue: revenueSum.sum || "0",
      pendingModeration: Number(pendingCount.count) || 0,
    };
  }
}

export const storage = new DatabaseStorage();
