import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException, BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { and, authSessions, db, eq, gt, isNull, learnerProfiles, oneTimeTokens, tutorApplications, tutorProfiles, users } from '@workspace/db';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const ISSUER = 'juniper-api';
const AUDIENCE = 'juniper-mobile-and-web';
const DUMMY_PASSWORD_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;

function scrypt(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

type AuthUser = Pick<typeof users.$inferSelect, 'id' | 'email' | 'firstName' | 'lastName' | 'emailVerifiedAt' | 'activeRole' | 'signupRole' | 'isAdmin'>;
type AuthResult = { user: AuthUser; accessToken: string; refreshToken: string; expiresIn: number };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function encode(value: object | string) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isUniqueConstraintViolation(error: unknown) {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; cause?: unknown; originalError?: unknown };
    if (record.code === '23505') return true;
    current = record.cause ?? record.originalError;
  }
  return false;
}

function cleanUser(user: typeof users.$inferSelect): AuthUser {
  const { id, email, firstName, lastName, emailVerifiedAt, activeRole, signupRole, isAdmin } = user;
  return { id, email, firstName, lastName, emailVerifiedAt, activeRole, signupRole, isAdmin: Boolean(isAdmin) };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly signingSecret = process.env.JWT_SECRET;

  constructor() {
    if (!this.signingSecret || this.signingSecret.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
      throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured before production sign-in is enabled.');
    }
  }

  private async passwordHash(password: string) {
    const salt = randomBytes(16);
    const derived = (await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })) as Buffer;
    return `scrypt$32768$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
  }

  private async verifyPassword(password: string, stored: string) {
    const [algorithm, n, r, p, saltText, expectedText] = stored.split('$');
    if (algorithm !== 'scrypt' || !n || !r || !p || !saltText || !expectedText) return false;
    const expected = Buffer.from(expectedText, 'base64url');
    const actual = (await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    })) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private accessToken(userId: string, sessionId: string) {
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      sub: userId, sid: sessionId, iss: ISSUER, aud: AUDIENCE,
      iat: now, exp: now + ACCESS_TTL_SECONDS,
    });
    const unsigned = `${header}.${payload}`;
    const signature = createHmac('sha256', this.signingSecret!).update(unsigned).digest('base64url');
    return `${unsigned}.${signature}`;
  }

  async authenticateAccessToken(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Sign in to continue.');
    const [header, payload, signature] = parts;
    const expected = createHmac('sha256', this.signingSecret!).update(`${header}.${payload}`).digest('base64url');
    if (!safeEqual(signature!, expected)) throw new UnauthorizedException('Sign in to continue.');
    let claims: { sub?: string; sid?: string; iss?: string; aud?: string; exp?: number };
    try {
      claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Sign in to continue.');
    }
    if (claims.iss !== ISSUER || claims.aud !== AUDIENCE || !claims.sub || !claims.sid || !claims.exp || claims.exp <= Date.now() / 1000) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    const [session] = await db.select().from(authSessions).where(and(
      eq(authSessions.id, claims.sid), eq(authSessions.userId, claims.sub),
      isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()),
    )).limit(1);
    if (!session) throw new UnauthorizedException('Your session has ended. Please sign in again.');
    const [user] = await db.select().from(users).where(and(eq(users.id, claims.sub), isNull(users.disabledAt))).limit(1);
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    return { user: cleanUser(user), sessionId: session.id };
  }

  private async issueSession(user: typeof users.$inferSelect): Promise<AuthResult> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const [session] = await db.insert(authSessions).values({
      userId: user.id, refreshTokenHash: hashToken(refreshToken), expiresAt,
    }).returning({ id: authSessions.id });
    return {
      user: cleanUser(user), accessToken: this.accessToken(user.id, session!.id),
      refreshToken, expiresIn: ACCESS_TTL_SECONDS,
    };
  }

  private async createOneTimeToken(userId: string, purpose: 'verify_email' | 'reset_password') {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (purpose === 'verify_email' ? VERIFY_TTL_MS : RESET_TTL_MS));
    await db.insert(oneTimeTokens).values({ userId, tokenHash: hashToken(token), purpose, expiresAt });
    return token;
  }

  private async sendEmail(to: string, subject: string, text: string) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      if (process.env.NODE_ENV === 'production') throw new Error('Configure RESEND_API_KEY and EMAIL_FROM before enabling account email.');
      console.info(`[Juniper dev email] To: ${to}\nSubject: ${subject}\n${text}`);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as {
        name?: unknown; message?: unknown; statusCode?: unknown; code?: unknown;
      } | null;
      const providerReason = {
        status: response.status,
        name: typeof payload?.name === 'string' ? payload.name.slice(0, 120) : undefined,
        message: typeof payload?.message === 'string' ? payload.message.slice(0, 500) : undefined,
        statusCode: typeof payload?.statusCode === 'number' ? payload.statusCode : undefined,
        code: typeof payload?.code === 'string' ? payload.code.slice(0, 120) : undefined,
      };
      this.logger.error(`Resend rejected Juniper email: ${JSON.stringify(providerReason)}`);
      throw new ServiceUnavailableException('Juniper could not send that email right now. Check the API log for the email provider’s reason, then try again.');
    }
  }

  async signUp(input: { email: string; password: string; firstName: string; lastName?: string; role?: 'student' | 'tutor' }) {
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || input.password.length < 10 || input.password.length > 128 || input.firstName.trim().length < 1) {
      throw new BadRequestException('Enter a valid email, first name, and password of at least 10 characters.');
    }
    const passwordHash = await this.passwordHash(input.password);
    let user: typeof users.$inferSelect;
    try {
      [user] = await db.transaction(async (tx) => {
        const [created] = await tx.insert(users).values({
          email, passwordHash, firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() || null, signupRole: input.role ?? 'student',
        }).returning();
        await tx.insert(learnerProfiles).values({ userId: created!.id, displayName: input.firstName.trim() });
        if ((input.role ?? 'student') === 'tutor') {
          await tx.insert(tutorApplications).values({ userId: created!.id, legalName: [input.firstName.trim(), input.lastName?.trim()].filter(Boolean).join(' ') });
        }
        return [created!];
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictException('An account already exists for this email.');
      throw error;
    }
    const token = await this.createOneTimeToken(user.id, 'verify_email');
    const url = `${process.env.APP_PUBLIC_URL ?? 'http://localhost:8081'}/verify-email?token=${encodeURIComponent(token)}`;
    await this.sendEmail(email, 'Verify your Juniper account', `Welcome to Juniper. Open this link to verify your email:\n${url}\n\nThis link expires in 24 hours.`);
    return { accepted: true as const, message: 'Check your inbox for a verification link.' };
  }

  async verifyEmail(token: string) {
    if (!token || token.length > 200) throw new BadRequestException('This verification link is invalid or expired.');
    const tokenHash = hashToken(token);
    const [record] = await db.select().from(oneTimeTokens).where(and(
      eq(oneTimeTokens.tokenHash, tokenHash), eq(oneTimeTokens.purpose, 'verify_email'),
      isNull(oneTimeTokens.usedAt), gt(oneTimeTokens.expiresAt, new Date()),
    )).limit(1);
    if (!record) throw new BadRequestException('This verification link is invalid or expired.');
    await db.transaction(async (tx) => {
      const [consumed] = await tx.update(oneTimeTokens).set({ usedAt: new Date() })
        .where(and(eq(oneTimeTokens.id, record.id), isNull(oneTimeTokens.usedAt), gt(oneTimeTokens.expiresAt, new Date())))
        .returning({ id: oneTimeTokens.id });
      if (!consumed) throw new BadRequestException('This verification link is invalid or expired.');
      await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.userId));
    });
    const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
    if (!user) throw new BadRequestException('This verification link is invalid or expired.');
    return this.issueSession(user);
  }

  async resendVerification(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.disabledAt))).limit(1);
    if (user && !user.emailVerifiedAt) {
      const token = await this.createOneTimeToken(user.id, 'verify_email');
      const url = `${process.env.APP_PUBLIC_URL ?? 'http://localhost:8081'}/verify-email?token=${encodeURIComponent(token)}`;
      await this.sendEmail(user.email, 'Verify your Juniper account', `Open this link to verify your email:\n${url}\n\nThis link expires in 24 hours.`);
    }
    return { accepted: true as const, message: 'If that email needs verification, a fresh link is on its way.' };
  }

  async signIn(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.disabledAt))).limit(1);
    const valid = await this.verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) throw new UnauthorizedException('Email or password is incorrect.');
    if (!user.emailVerifiedAt) throw new UnauthorizedException('Verify your email before signing in.');
    return this.issueSession(user);
  }

  async refresh(refreshToken: string) {
    if (!refreshToken || refreshToken.length > 200) throw new UnauthorizedException('Sign in again to continue.');
    const oldHash = hashToken(refreshToken);
    const [session] = await db.select().from(authSessions).where(and(
      eq(authSessions.refreshTokenHash, oldHash), isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, new Date()),
    )).limit(1);
    if (!session) throw new UnauthorizedException('Sign in again to continue.');
    const nextToken = randomBytes(48).toString('base64url');
    const nextHash = hashToken(nextToken);
    const [rotated] = await db.update(authSessions).set({
      refreshTokenHash: nextHash, lastUsedAt: new Date(),
    }).where(and(eq(authSessions.id, session.id), eq(authSessions.refreshTokenHash, oldHash), isNull(authSessions.revokedAt))).returning({ id: authSessions.id });
    if (!rotated) throw new UnauthorizedException('Sign in again to continue.');
    const [user] = await db.select().from(users).where(and(eq(users.id, session.userId), isNull(users.disabledAt))).limit(1);
    if (!user) throw new UnauthorizedException('Sign in again to continue.');
    return { user: cleanUser(user), accessToken: this.accessToken(user.id, session.id), refreshToken: nextToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.disabledAt))).limit(1);
    if (user) {
      const token = await this.createOneTimeToken(user.id, 'reset_password');
      const url = `${process.env.APP_PUBLIC_URL ?? 'http://localhost:8081'}/reset-password?token=${encodeURIComponent(token)}`;
      await this.sendEmail(user.email, 'Reset your Juniper password', `Use this link to reset your password:\n${url}\n\nThis link expires in one hour.`);
    }
    return { accepted: true as const, message: 'If an account exists for that email, a reset link is on its way.' };
  }

  async resetPassword(token: string, password: string) {
    if (!token || token.length > 200 || password.length < 10 || password.length > 128) {
      throw new BadRequestException('Use a valid reset link and a password of at least 10 characters.');
    }
    const [record] = await db.select().from(oneTimeTokens).where(and(
      eq(oneTimeTokens.tokenHash, hashToken(token)), eq(oneTimeTokens.purpose, 'reset_password'),
      isNull(oneTimeTokens.usedAt), gt(oneTimeTokens.expiresAt, new Date()),
    )).limit(1);
    if (!record) throw new BadRequestException('This reset link is invalid or expired.');
    const nextHash = await this.passwordHash(password);
    await db.transaction(async (tx) => {
      const [consumed] = await tx.update(oneTimeTokens).set({ usedAt: new Date() })
        .where(and(eq(oneTimeTokens.id, record.id), isNull(oneTimeTokens.usedAt), gt(oneTimeTokens.expiresAt, new Date())))
        .returning({ id: oneTimeTokens.id });
      if (!consumed) throw new BadRequestException('This reset link is invalid or expired.');
      await tx.update(users).set({ passwordHash: nextHash, updatedAt: new Date() }).where(eq(users.id, record.userId));
      await tx.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, record.userId), isNull(authSessions.revokedAt)));
    });
    return { accepted: true as const, message: 'Password updated. Please sign in again.' };
  }

  async signOut(userId: string, sessionId: string) {
    await db.update(authSessions).set({ revokedAt: new Date() }).where(and(
      eq(authSessions.id, sessionId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt),
    ));
  }

  async signOutEverywhere(userId: string) {
    await db.update(authSessions).set({ revokedAt: new Date() }).where(and(
      eq(authSessions.userId, userId), isNull(authSessions.revokedAt),
    ));
  }

  async me(userId: string) {
    const [user] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.disabledAt))).limit(1);
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    return cleanUser(user);
  }

  async setActiveRole(userId: string, role: 'student' | 'tutor') {
    if (role === 'tutor') {
      const [profile] = await db.select({ approval: tutorProfiles.approval }).from(tutorProfiles)
        .where(eq(tutorProfiles.userId, userId)).limit(1);
      if (!profile || profile.approval !== 'approved') {
        throw new BadRequestException('Tutor workspace is available after your tutor profile is approved.');
      }
    }
    const [user] = await db.update(users).set({ activeRole: role, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.disabledAt))).returning();
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    return cleanUser(user);
  }
}
