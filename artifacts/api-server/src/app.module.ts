import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health.controller.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, MarketplaceModule],
  controllers: [HealthController],
  providers: process.env.SENTRY_DSN ? [{ provide: APP_FILTER, useClass: SentryGlobalFilter }] : [],
})
export class AppModule {}
