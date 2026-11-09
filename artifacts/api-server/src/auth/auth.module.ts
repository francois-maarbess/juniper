import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard, AuthRateLimitGuard],
  exports: [AuthService, AuthGuard, AdminGuard, AuthRateLimitGuard],
})
export class AuthModule {}
