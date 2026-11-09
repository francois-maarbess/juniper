import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { db, eq, users } from '@workspace/db';
import type { AuthenticatedRequest } from './auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.juniperUser;

    if (!user) {
      throw new UnauthorizedException('Sign in as an administrator to continue.');
    }

    if (user.isAdmin) {
      return true;
    }

    // Refresh from database in case admin privileges were granted after session creation
    const [dbUser] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (dbUser?.isAdmin) {
      user.isAdmin = true;
      return true;
    }

    throw new ForbiddenException('Administrator access is required to access this resource.');
  }
}
