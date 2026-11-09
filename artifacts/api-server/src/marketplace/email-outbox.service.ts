import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { pool } from '@workspace/db';

type QueuedEmail = { id: string; recipient: string; subject: string; text_body: string; attempts: number };

@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  onModuleInit() {
    this.timer = setInterval(() => void this.drain(), 15_000);
    void this.drain();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async claimBatch() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = await client.query<QueuedEmail>(`
        SELECT id, recipient, subject, text_body, attempts
        FROM email_outbox
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 10
      `);
      if (rows.rows.length) {
        const ids = rows.rows.map((row) => row.id);
        await client.query(`UPDATE email_outbox SET attempts = attempts + 1,
          next_attempt_at = now() + interval '2 minutes' WHERE id = ANY($1::uuid[])`, [ids]);
      }
      await client.query('COMMIT');
      return rows.rows.map((row) => ({ ...row, attempts: Number(row.attempts) + 1 }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async drain() {
    if (this.running || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
    this.running = true;
    try {
      const emails = await this.claimBatch();
      for (const email of emails) await this.deliver(email);
    } catch (error) {
      this.logger.error(`Could not process the email outbox: ${error instanceof Error ? error.message : 'database error'}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(email: QueuedEmail) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email.recipient], subject: email.subject, text: email.text_body }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: unknown; name?: unknown; code?: unknown } | null;
        const detail = `${response.status} ${typeof payload?.name === 'string' ? payload.name.slice(0, 80) : 'provider error'}${typeof payload?.code === 'string' ? ` (${payload.code.slice(0, 80)})` : ''}`;
        throw new Error(detail);
      }
      await pool.query("UPDATE email_outbox SET status = 'sent', sent_at = now(), last_error = null WHERE id = $1", [email.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 240) : 'Email provider error';
      const terminal = email.attempts >= 5;
      const retryMinutes = [1, 3, 10, 30][Math.min(email.attempts - 1, 3)] ?? 30;
      await pool.query(`UPDATE email_outbox SET status = $2, last_error = $3,
        next_attempt_at = now() + ($4 * interval '1 minute') WHERE id = $1`,
      [email.id, terminal ? 'failed' : 'pending', message, retryMinutes]);
      this.logger.warn(`Tutor application email ${email.id} was ${terminal ? 'marked failed' : 'scheduled for retry'}: ${message}`);
    }
  }
}
