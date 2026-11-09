import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db, groupClasses, groupEnrollments, tutorProfiles, users } from '@workspace/db';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

@Injectable()
export class GroupClassService {
  async listUpcoming(subject?: string) {
    const now = new Date();
    const conditions = [
      eq(groupClasses.status, 'scheduled'),
      gte(groupClasses.scheduledAt, now),
      ...(subject ? [eq(groupClasses.subject, subject)] : []),
    ];
    return db.select({
      id: groupClasses.id,
      tutorId: groupClasses.tutorId,
      title: groupClasses.title,
      subject: groupClasses.subject,
      description: groupClasses.description,
      pricePerStudentCents: groupClasses.pricePerStudentCents,
      maxStudents: groupClasses.maxStudents,
      scheduledAt: groupClasses.scheduledAt,
      durationMinutes: groupClasses.durationMinutes,
      status: groupClasses.status,
      tutorName: tutorProfiles.displayName,
      enrollmentCount: sql<number>`(SELECT count(*) FROM group_enrollments WHERE class_id = ${groupClasses.id})`,
    }).from(groupClasses)
      .innerJoin(tutorProfiles, eq(tutorProfiles.userId, groupClasses.tutorId))
      .where(and(...conditions))
      .orderBy(groupClasses.scheduledAt);
  }

  async createClass(tutorId: string, params: { title: string; subject: string; description?: string; pricePerStudentCents?: number; maxStudents?: number; scheduledAt: string; durationMinutes?: number }) {
    if (!params.title || !params.subject || !params.scheduledAt) throw new BadRequestException('Title, subject, and scheduled time are required.');
    const [cls] = await db.insert(groupClasses).values({
      id: randomUUID(),
      tutorId,
      title: params.title.trim().slice(0, 200),
      subject: params.subject.trim(),
      description: params.description?.trim().slice(0, 2000) || null,
      pricePerStudentCents: params.pricePerStudentCents ?? 0,
      maxStudents: params.maxStudents ?? 10,
      scheduledAt: new Date(params.scheduledAt),
      durationMinutes: params.durationMinutes ?? 60,
    }).returning();
    return cls;
  }

  async getClass(classId: string) {
    const [cls] = await db.select({
      id: groupClasses.id,
      tutorId: groupClasses.tutorId,
      title: groupClasses.title,
      subject: groupClasses.subject,
      description: groupClasses.description,
      pricePerStudentCents: groupClasses.pricePerStudentCents,
      maxStudents: groupClasses.maxStudents,
      scheduledAt: groupClasses.scheduledAt,
      durationMinutes: groupClasses.durationMinutes,
      status: groupClasses.status,
      recordingUrl: groupClasses.recordingUrl,
      tutorName: tutorProfiles.displayName,
    }).from(groupClasses).innerJoin(tutorProfiles, eq(tutorProfiles.userId, groupClasses.tutorId))
      .where(eq(groupClasses.id, classId)).limit(1);
    if (!cls) throw new NotFoundException('Class not found.');
    const enrollments = await db.select({
      id: groupEnrollments.id,
      studentId: groupEnrollments.studentId,
      status: groupEnrollments.status,
      paidCents: groupEnrollments.paidCents,
      createdAt: groupEnrollments.createdAt,
      studentName: users.firstName,
    }).from(groupEnrollments).innerJoin(users, eq(users.id, groupEnrollments.studentId))
      .where(eq(groupEnrollments.classId, classId));
    return { ...cls, enrollments, enrollmentCount: enrollments.length };
  }

  async enroll(studentId: string, classId: string) {
    const [cls] = await db.select().from(groupClasses).where(eq(groupClasses.id, classId)).limit(1);
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.status !== 'scheduled') throw new BadRequestException('Class is not open for enrollment.');
    const enrollments = await db.select().from(groupEnrollments).where(eq(groupEnrollments.classId, classId));
    if (enrollments.length >= cls.maxStudents) throw new BadRequestException('Class is full.');
    const existing = enrollments.find((e) => e.studentId === studentId);
    if (existing) return existing;
    const [enrollment] = await db.insert(groupEnrollments).values({
      id: randomUUID(), classId, studentId, status: 'enrolled', paidCents: cls.pricePerStudentCents,
    }).returning();
    return enrollment;
  }

  async cancelEnrollment(studentId: string, classId: string) {
    await db.delete(groupEnrollments).where(and(eq(groupEnrollments.classId, classId), eq(groupEnrollments.studentId, studentId)));
    return { success: true };
  }
}