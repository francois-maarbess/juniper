import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { db, sql } from '@workspace/db';

const WINDOW_MS = 15 * 60 * 1000;
const ROUTE_LIMITS: Record<string, number> = {
  '/api/auth/sign-in': 10,
  '/api/auth/sign-up': 10,
  '/api/auth/password/forgot': 5,
  '/api/auth/password/reset': 10,
  '/api/auth/verification/resend': 5,
  '/api/auth/verify-email': 10,
};
const MARKETPLACE_LIMITS: Array<[RegExp, number]> = [
  [/^\/api\/marketplace\/requests\/assist$/, 20],
  [/^\/api\/marketplace\/requests$/, 20],
  [/^\/api\/marketplace\/requests\/[^/]+\/offers$/, 30],
  [/^\/api\/marketplace\/offers\/[^/]+\/accept$/, 20],
  [/^\/api\/marketplace\/bookings\/[^/]+\/messages$/, 120],
  [/^\/api\/marketplace\/bookings\/[^/]+\/messages\/attachments$/, 20],
  [/^\/api\/marketplace\/tutor-application\/documents$/, 12],
  [/^\/api\/marketplace\/tutor-application\/me\/submit$/, 10],
];

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const path = request.path;
    const normalizedPath = path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
    const limit = ROUTE_LIMITS[path] ?? MARKETPLACE_LIMITS.find(([pattern]) => pattern.test(path))?.[1] ?? 300;
    const key = createHash('sha256').update(`${ip}:${normalizedPath}`).digest('hex');
    try {
      const result = await db.execute(sql`
        INSERT INTO rate_limit_buckets (key, count, reset_at)
        VALUES (${key}, 1, now() + (${WINDOW_MS} * interval '1 millisecond'))
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN rate_limit_buckets.reset_at <= now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
          reset_at = CASE WHEN rate_limit_buckets.reset_at <= now()
            THEN now() + (${WINDOW_MS} * interval '1 millisecond') ELSE rate_limit_buckets.reset_at END
        RETURNING count, reset_at
      `);
      const bucket = result.rows[0] as { count: number; reset_at: Date } | undefined;
      if (!bucket) throw new Error('Rate limit counter did not return a result.');
      if (Number(bucket.count) > limit) {
        const retrySeconds = Math.max(1, Math.ceil((new Date(bucket.reset_at).getTime() - Date.now()) / 1000));
        request.res?.setHeader('Retry-After', String(retrySeconds));
        throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (Math.random() < 0.01) {
        void db.execute(sql`DELETE FROM rate_limit_buckets WHERE reset_at < now()`).catch(() => undefined);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('We couldn’t complete that just now. Please try again shortly.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
