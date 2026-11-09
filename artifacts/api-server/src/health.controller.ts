import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { db, sql } from '@workspace/db';

@Controller()
export class HealthController {
  @Get('healthz')
  health() {
    return { status: 'ok' as const };
  }

  @Get('readyz')
  async ready() {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ready' as const, database: 'available' as const };
    } catch {
      throw new HttpException({ status: 'not_ready', database: 'unavailable' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
