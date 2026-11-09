import { Controller, Get, Post, Req, Query, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { MatchingService } from './matching.service.js';

@Controller('marketplace')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get('match-tutors')
  matchTutors(
    @Query('subject') subject?: string,
    @Query('level') level?: string,
    @Query('budget') budget?: string,
    @Query('date') date?: string,
    @Query('time') time?: string,
  ) {
    return this.matching.matchTutors({ subject, level, budget: budget ? Number(budget) : undefined, date, time });
  }

  @Get('tutors/:tutorId/slots')
  getSlots(@Param('tutorId') tutorId: string) {
    return this.matching.getOpenSlots(tutorId);
  }

  @Post('tutors/:tutorId/slots/generate')
  @UseGuards(AuthGuard)
  generateSlots(@Param('tutorId') tutorId: string) {
    return this.matching.generateSlots(tutorId);
  }

  @Post('tutors/:tutorId/waitlist')
  @UseGuards(AuthGuard)
  joinWaitlist(@Req() req: AuthenticatedRequest, @Param('tutorId') tutorId: string, @Query('subject') subject?: string) {
    return this.matching.joinWaitlist(tutorId, req.juniperUser!.id, subject);
  }
}
