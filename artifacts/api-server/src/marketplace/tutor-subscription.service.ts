import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, db, eq, lt, tutorProfiles } from '@workspace/db';

@Injectable()
export class TutorSubscriptionService {
  private readonly logger = new Logger(TutorSubscriptionService.name);

  @Cron(CronExpression.EVERY_HOUR)
  async suspendExpiredFreeProfiles() {
    const result = await db.update(tutorProfiles).set({
      approval: 'suspended_pending_subscription',
      updatedAt: new Date(),
    }).where(and(
      eq(tutorProfiles.approval, 'approved'),
      eq(tutorProfiles.subscriptionPaid, false),
      lt(tutorProfiles.freePeriodEndsAt, new Date()),
    )).returning({ userId: tutorProfiles.userId });

    if (result.length) {
      this.logger.log(`Suspended ${result.length} tutor profile(s) pending subscription payment.`);
    }
  }
}
