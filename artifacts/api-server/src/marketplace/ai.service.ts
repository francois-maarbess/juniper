import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db, aiConversations, aiMessages, bookings, studyRequests, subjects, tutorProfiles } from '@workspace/db';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class AiService {
  private readonly apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  private readonly model = process.env.AI_MODEL || 'gpt-4o-mini';
  private readonly provider = process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'mock';

  async chat(userId: string, params: { conversationId?: string; bookingId?: string; message: string }) {
    if (!params.message || params.message.trim().length === 0) throw new BadRequestException('Message is required.');
    if (params.message.length > 4000) throw new BadRequestException('Message too long.');

    // Get or create conversation
    let conversationId = params.conversationId;
    if (!conversationId) {
      const title = params.message.slice(0, 60);
      const [conv] = await db.insert(aiConversations).values({
        id: randomUUID(),
        userId,
        bookingId: params.bookingId || null,
        title,
      }).returning();
      conversationId = conv.id;
    }

    // Save user message
    await db.insert(aiMessages).values({
      id: randomUUID(),
      conversationId,
      role: 'user',
      content: params.message.trim(),
    });

    // Build context
    let context = '';
    if (params.bookingId) {
      const [booking] = await db.select({
        subject: subjects.name,
        title: studyRequests.title,
        tutorName: tutorProfiles.displayName,
      }).from(bookings)
        .innerJoin(studyRequests, eq(studyRequests.id, bookings.requestId))
        .innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
        .innerJoin(tutorProfiles, eq(tutorProfiles.userId, bookings.tutorId))
        .where(eq(bookings.id, params.bookingId)).limit(1);
      if (booking) {
        context = `\nContext: The student is in a session about "${booking.subject}" titled "${booking.title}" with tutor ${booking.tutorName}.`;
      }
    }

    // Fetch conversation history
    const history = await db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);

    const systemPrompt = `You are Juniper AI, a patient Socratic tutor. Never give the final answer directly. Instead, guide the student with hints, questions, and step-by-step scaffolding. Break problems into smaller steps. Encourage the student to try each step before moving on. If they're stuck, give a smaller hint. Be warm and encouraging.${context}`;

    // Call LLM
    let assistantContent = '';
    let tokens = 0;
    let model = this.model;

    if (this.provider === 'openai' && this.apiKey) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ];
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model: this.model, messages, max_tokens: 1024, temperature: 0.7 }),
        });
        const data = (await res.json()) as any;
        assistantContent = data?.choices?.[0]?.message?.content || 'I could not generate a response.';
        tokens = data?.usage?.total_tokens || 0;
        model = data?.model || this.model;
      } catch (e) {
        assistantContent = 'I encountered an error reaching the AI service. Please try again.';
      }
    } else if (this.provider === 'anthropic' && this.apiKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: this.model === 'gpt-4o-mini' ? 'claude-sonnet-4-20250514' : this.model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          }),
        });
        const data = (await res.json()) as any;
        assistantContent = data?.content?.[0]?.text || 'I could not generate a response.';
        tokens = (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0);
        model = data?.model || this.model;
      } catch (e) {
        assistantContent = 'I encountered an error reaching the AI service. Please try again.';
      }
    } else {
      // Mock mode — Socratic fallback
      assistantContent = `That's a great question! Let me help you think through this step by step.\n\n**Step 1:** What do you already know about this topic?\n\n**Step 2:** Can you identify the key variables or given information?\n\n**Step 3:** What formula or concept might apply here?\n\nTry working through these steps, and share where you get stuck. I'm here to guide you! 🌱`;
      model = 'mock-socratic';
    }

    // Save assistant message
    const [assistantMsg] = await db.insert(aiMessages).values({
      id: randomUUID(),
      conversationId,
      role: 'assistant',
      content: assistantContent,
      model,
      tokens,
    }).returning();

    // Update conversation timestamp
    await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));

    return {
      conversationId,
      message: assistantMsg,
    };
  }

  async explain(userId: string, params: { imageBase64?: string; text?: string; subject?: string }) {
    // OCR + explain — for now, text-based explanation
    const prompt = params.text
      ? `The student is stuck on this problem: "${params.text}". Subject: ${params.subject || 'general'}. Guide them Socratically.`
      : `The student uploaded an image of a problem. Subject: ${params.subject || 'general'}. Guide them Socratically.`;

    return this.chat(userId, { message: prompt });
  }

  async generateStudyGuide(userId: string, params: { bookingId: string; transcript: string }) {
    const prompt = `Based on this tutoring session transcript, generate a structured study guide with:
1. Key concepts covered (bullet list)
2. Step-by-step problem-solving methods discussed
3. 3 practice problems (with hints, not answers)
4. Flashcard Q&A pairs (5-8 cards)
5. Next steps for the student

Transcript:
${params.transcript.slice(0, 8000)}`;

    return this.chat(userId, { message: prompt, bookingId: params.bookingId });
  }

  async listConversations(userId: string) {
    return db.select().from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt));
  }

  async getConversation(userId: string, conversationId: string) {
    const [conv] = await db.select().from(aiConversations).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId))).limit(1);
    if (!conv) return null;
    const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(aiMessages.createdAt);
    return { ...conv, messages };
  }
}