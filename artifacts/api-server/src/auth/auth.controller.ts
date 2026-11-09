import {
  BadRequestException, Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthService } from './auth.service.js';

type BodyRecord = Record<string, unknown>;
function asBody(value: unknown): BodyRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as BodyRecord;
  throw new BadRequestException('Enter the requested information.');
}
function requiredText(body: BodyRecord, key: string, max = 500) {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new BadRequestException(`Enter a valid ${key}.`);
  }
  return value.trim();
}
function requiredSecret(body: BodyRecord, key: string, max = 128) {
  const value = body[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new BadRequestException(`Enter a valid ${key}.`);
  }
  return value;
}
function isWeb(request: Request) {
  return request.headers['x-juniper-client'] === 'web';
}
function setWebRefreshCookie(response: Response, token: string) {
  response.cookie('juniper_refresh', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
function sessionResponse(request: Request, response: Response, result: Awaited<ReturnType<AuthService['signIn']>>) {
  if (isWeb(request)) setWebRefreshCookie(response, result.refreshToken);
  return {
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    ...(!isWeb(request) ? { refreshToken: result.refreshToken } : {}),
  };
}

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('sign-up')
  @HttpCode(202)
  signUp(@Body() bodyValue: unknown) {
    const body = asBody(bodyValue);
    if (body.role !== undefined && body.role !== 'student' && body.role !== 'tutor') {
      throw new BadRequestException('Choose whether you’re joining Juniper to learn or teach.');
    }
    return this.auth.signUp({
      email: requiredText(body, 'email', 254),
      password: requiredSecret(body, 'password'),
      firstName: requiredText(body, 'firstName', 80),
      role: body.role === 'tutor' ? 'tutor' : 'student',
      ...(typeof body.lastName === 'string' && body.lastName.trim() ? { lastName: body.lastName.trim().slice(0, 80) } : {}),
    });
  }

  @Post('verification/resend')
  @HttpCode(202)
  resendVerification(@Body() bodyValue: unknown) {
    return this.auth.resendVerification(requiredText(asBody(bodyValue), 'email', 254));
  }

  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() bodyValue: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = asBody(bodyValue);
    const result = await this.auth.signIn(
      requiredText(body, 'email', 254), requiredSecret(body, 'password'),
    );
    return sessionResponse(request, response, result);
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body() bodyValue: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.verifyEmail(requiredText(asBody(bodyValue), 'token', 200));
    return sessionResponse(request, response, result);
  }

  @Post('password/forgot')
  @HttpCode(202)
  forgotPassword(@Body() bodyValue: unknown) {
    return this.auth.requestPasswordReset(requiredText(asBody(bodyValue), 'email', 254));
  }

  @Post('password/reset')
  @HttpCode(200)
  resetPassword(@Body() bodyValue: unknown) {
    const body = asBody(bodyValue);
    return this.auth.resetPassword(
      requiredText(body, 'token', 200), requiredSecret(body, 'password'),
    );
  }

  @Post('token/refresh')
  @HttpCode(200)
  async refresh(
    @Body() bodyValue: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = asBody(bodyValue);
    const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.juniper_refresh;
    const token = typeof body.refreshToken === 'string' ? body.refreshToken : cookieToken;
    if (!token) throw new BadRequestException('Sign in again to continue.');
    const result = await this.auth.refresh(token);
    if (isWeb(request)) setWebRefreshCookie(response, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      ...(!isWeb(request) ? { refreshToken: result.refreshToken } : {}),
    };
  }

  @Post('sign-out')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async signOut(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.signOut(request.juniperUser!.id, request.juniperSessionId!);
    response.clearCookie('juniper_refresh', { path: '/api/auth', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' });
  }

  @Post('sign-out-everywhere')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async signOutEverywhere(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.signOutEverywhere(request.juniperUser!.id);
    response.clearCookie('juniper_refresh', { path: '/api/auth', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.juniperUser!.id);
  }

  @Patch('active-role')
  @UseGuards(AuthGuard)
  setActiveRole(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = asBody(value);
    if (body.role !== 'student' && body.role !== 'tutor') throw new BadRequestException('Choose a valid workspace.');
    return this.auth.setActiveRole(request.juniperUser!.id, body.role);
  }
}
