import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db, communityQuestions, communityAnswers, users, tutorProfiles } from '@workspace/db';
import { eq, desc, and, sql } from 'drizzle-orm';

@Injectable()
export class CommunityService {
  async listQuestions(subject?: string) {
    const base = db.select({
      id: communityQuestions.id,
      authorId: communityQuestions.authorId,
      subject: communityQuestions.subject,
      title: communityQuestions.title,
      body: communityQuestions.body,
      imageUrl: communityQuestions.imageUrl,
      status: communityQuestions.status,
      createdAt: communityQuestions.createdAt,
      authorName: users.firstName,
      answerCount: sql<number>`(SELECT count(*) FROM community_answers WHERE question_id = ${communityQuestions.id})`,
    }).from(communityQuestions).innerJoin(users, eq(users.id, communityQuestions.authorId));
    if (subject) {
      return base.where(eq(communityQuestions.subject, subject)).orderBy(desc(communityQuestions.createdAt));
    }
    return base.orderBy(desc(communityQuestions.createdAt));
  }

  async createQuestion(authorId: string, params: { subject: string; title: string; body: string; imageUrl?: string }) {
    if (!params.subject || !params.title || !params.body) throw new BadRequestException('Subject, title, and body are required.');
    const [q] = await db.insert(communityQuestions).values({
      id: randomUUID(),
      authorId,
      subject: params.subject.trim(),
      title: params.title.trim().slice(0, 200),
      body: params.body.trim().slice(0, 5000),
      imageUrl: params.imageUrl || null,
    }).returning();
    return q;
  }

  async getQuestion(questionId: string) {
    const [q] = await db.select().from(communityQuestions).where(eq(communityQuestions.id, questionId)).limit(1);
    if (!q) throw new NotFoundException('Question not found.');
    const answers = await db.select({
      id: communityAnswers.id,
      questionId: communityAnswers.questionId,
      tutorId: communityAnswers.tutorId,
      body: communityAnswers.body,
      upvotes: communityAnswers.upvotes,
      accepted: communityAnswers.accepted,
      createdAt: communityAnswers.createdAt,
      tutorName: tutorProfiles.displayName,
    }).from(communityAnswers).innerJoin(tutorProfiles, eq(tutorProfiles.userId, communityAnswers.tutorId))
      .where(eq(communityAnswers.questionId, questionId)).orderBy(desc(communityAnswers.upvotes), communityAnswers.createdAt);
    return { ...q, answers };
  }

  async createAnswer(tutorId: string, questionId: string, body: string) {
    if (!body || body.trim().length < 5) throw new BadRequestException('Answer must be at least 5 characters.');
    const [a] = await db.insert(communityAnswers).values({
      id: randomUUID(),
      questionId,
      tutorId,
      body: body.trim().slice(0, 5000),
    }).returning();
    // Mark question as answered
    await db.update(communityQuestions).set({ status: 'answered' }).where(eq(communityQuestions.id, questionId));
    return a;
  }

  async upvoteAnswer(answerId: string) {
    const [updated] = await db.update(communityAnswers).set({ upvotes: sql`${communityAnswers.upvotes} + 1` })
      .where(eq(communityAnswers.id, answerId)).returning();
    return updated;
  }

  async acceptAnswer(answerId: string, questionAuthorId: string) {
    const [answer] = await db.select().from(communityAnswers).where(eq(communityAnswers.id, answerId)).limit(1);
    if (!answer) throw new NotFoundException('Answer not found.');
    const [question] = await db.select().from(communityQuestions).where(eq(communityQuestions.id, answer.questionId)).limit(1);
    if (!question || question.authorId !== questionAuthorId) throw new BadRequestException('Only the question author can accept an answer.');
    await db.update(communityAnswers).set({ accepted: false }).where(eq(communityAnswers.questionId, answer.questionId));
    await db.update(communityAnswers).set({ accepted: true }).where(eq(communityAnswers.id, answerId));
    await db.update(communityQuestions).set({ status: 'closed' }).where(eq(communityQuestions.id, answer.questionId));
    return { success: true };
  }
}