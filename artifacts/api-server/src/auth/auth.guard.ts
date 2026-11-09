import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

export type AuthenticatedRequest = Request & {
  juniperUser?: Awaited<ReturnType<AuthService['authenticateAccessToken']>>['user'];
  juniperSessionId?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const value = request.headers.authorization;
    const token = value?.startsWith('Bearer ') ? value.slice(7) : '';
    if (!token) throw new UnauthorizedException('Sign in to continue.');
    const authenticated = await this.auth.authenticateAccessToken(token);
    request.juniperUser = authenticated.user;
    request.juniperSessionId = authenticated.sessionId;
    return true;
  }
}
