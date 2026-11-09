import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db, tutorCalendarEvents, tutorInvoices, tutorVaultItems, bookings, users, tutorProfiles } from '@workspace/db';
import { eq, and, desc, sql } from 'drizzle-orm';

@Injectable()
export class BusinessService {
  // --- Calendar ---
  async listEvents(tutorId: string, from?: string, to?: string) {
    const conditions = [eq(tutorCalendarEvents.tutorId, tutorId)];
    if (from) conditions.push(sql`${tutorCalendarEvents.startAt} >= ${from}::timestamptz`);
    if (to) conditions.push(sql`${tutorCalendarEvents.startAt} <= ${to}::timestamptz`);
    return db.select().from(tutorCalendarEvents).where(and(...conditions)).orderBy(tutorCalendarEvents.startAt);
  }

  async createEvent(tutorId: string, params: { title: string; type?: string; startAt: string; endAt: string; studentId?: string; notes?: string }) {
    if (!params.title || !params.startAt || !params.endAt) throw new BadRequestException('Title, start, and end are required.');
    const [ev] = await db.insert(tutorCalendarEvents).values({
      id: randomUUID(),
      tutorId,
      title: params.title.trim().slice(0, 200),
      type: (params.type as any) || 'session',
      startAt: new Date(params.startAt),
      endAt: new Date(params.endAt),
      studentId: params.studentId || null,
      notes: params.notes?.trim() || null,
    }).returning();
    return ev;
  }

  async deleteEvent(tutorId: string, eventId: string) {
    const [ev] = await db.select().from(tutorCalendarEvents).where(and(eq(tutorCalendarEvents.id, eventId), eq(tutorCalendarEvents.tutorId, tutorId))).limit(1);
    if (!ev) throw new NotFoundException('Event not found.');
    await db.delete(tutorCalendarEvents).where(eq(tutorCalendarEvents.id, eventId));
    return { success: true };
  }

  // --- Invoices ---
  async listInvoices(tutorId: string) {
    return db.select({
      id: tutorInvoices.id,
      tutorId: tutorInvoices.tutorId,
      studentId: tutorInvoices.studentId,
      amountCents: tutorInvoices.amountCents,
      description: tutorInvoices.description,
      status: tutorInvoices.status,
      dueDate: tutorInvoices.dueDate,
      sentAt: tutorInvoices.sentAt,
      paidAt: tutorInvoices.paidAt,
      createdAt: tutorInvoices.createdAt,
      studentName: users.firstName,
    }).from(tutorInvoices).innerJoin(users, eq(users.id, tutorInvoices.studentId))
      .where(eq(tutorInvoices.tutorId, tutorId)).orderBy(desc(tutorInvoices.createdAt));
  }

  async createInvoice(tutorId: string, params: { studentId: string; amountCents: number; description: string; dueDate?: string }) {
    if (!params.studentId || !params.amountCents || !params.description) throw new BadRequestException('Student, amount, and description are required.');
    const [inv] = await db.insert(tutorInvoices).values({
      id: randomUUID(),
      tutorId,
      studentId: params.studentId,
      amountCents: params.amountCents,
      description: params.description.trim().slice(0, 500),
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
    }).returning();
    return inv;
  }

  async sendInvoice(tutorId: string, invoiceId: string) {
    const [inv] = await db.select().from(tutorInvoices).where(and(eq(tutorInvoices.id, invoiceId), eq(tutorInvoices.tutorId, tutorId))).limit(1);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const [updated] = await db.update(tutorInvoices).set({ status: 'sent', sentAt: new Date() }).where(eq(tutorInvoices.id, invoiceId)).returning();
    return updated;
  }

  async markInvoicePaid(tutorId: string, invoiceId: string) {
    const [inv] = await db.select().from(tutorInvoices).where(and(eq(tutorInvoices.id, invoiceId), eq(tutorInvoices.tutorId, tutorId))).limit(1);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const [updated] = await db.update(tutorInvoices).set({ status: 'paid', paidAt: new Date() }).where(eq(tutorInvoices.id, invoiceId)).returning();
    return updated;
  }

  // --- Earnings overview ---
  async getEarnings(tutorId: string) {
    const sessions = await db.select().from(bookings).where(eq(bookings.tutorId, tutorId));
    const completed = sessions.filter((s) => s.status === 'completed');
    const totalEarned = completed.reduce((sum, s) => sum + s.amountCents, 0);
    const pending = sessions.filter((s) => s.status === 'scheduled' || s.status === 'in_progress');
    const pendingAmount = pending.reduce((sum, s) => sum + s.amountCents, 0);
    const vaultItems = await db.select().from(tutorVaultItems).where(eq(tutorVaultItems.tutorUserId, tutorId));
    const vaultRevenue = vaultItems.reduce((sum, v) => sum + (v.priceCents * v.purchaseCount), 0);
    const vaultDownloads = vaultItems.reduce((sum, v) => sum + v.downloadCount, 0);
    return {
      totalEarnedCents: totalEarned,
      pendingAmountCents: pendingAmount,
      completedSessions: completed.length,
      upcomingSessions: pending.length,
      vaultRevenueCents: vaultRevenue,
      vaultSales: vaultItems.reduce((sum, v) => sum + v.purchaseCount, 0),
      vaultDownloads,
      vaultItems: vaultItems.length,
    };
  }

  // --- Student CRM ---
  async getStudents(tutorId: string) {
    const sessionRows = await db.select({
      studentId: bookings.learnerId,
      studentName: users.firstName,
      sessionCount: sql<number>`count(*)`,
      lastSession: sql<string>`max(${bookings.createdAt})`,
      totalEarned: sql<number>`sum(${bookings.amountCents})`,
    }).from(bookings).innerJoin(users, eq(users.id, bookings.learnerId))
      .where(eq(bookings.tutorId, tutorId)).groupBy(bookings.learnerId, users.firstName);
    return sessionRows;
  }
}