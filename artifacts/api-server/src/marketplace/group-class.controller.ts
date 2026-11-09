import { Controller, Get, Post, Delete, Req, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { GroupClassService } from './group-class.service.js';

@Controller('marketplace')
export class GroupClassController {
  constructor(private readonly groupClass: GroupClassService) {}

  @Get('group-classes')
  listClasses(@Query('subject') subject?: string) {
    return this.groupClass.listUpcoming(subject);
  }

  @Get('group-classes/:id')
  getClass(@Param('id') id: string) {
    return this.groupClass.getClass(id);
  }

  @Post('group-classes')
  @UseGuards(AuthGuard)
  createClass(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.groupClass.createClass(req.juniperUser!.id, {
      title: String(body?.title ?? ''),
      subject: String(body?.subject ?? ''),
      description: body?.description,
      pricePerStudentCents: body?.pricePerStudentCents ? Number(body.pricePerStudentCents) : undefined,
      maxStudents: body?.maxStudents ? Number(body.maxStudents) : undefined,
      scheduledAt: String(body?.scheduledAt ?? ''),
      durationMinutes: body?.durationMinutes ? Number(body.durationMinutes) : undefined,
    });
  }

  @Post('group-classes/:id/enroll')
  @UseGuards(AuthGuard)
  enroll(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.groupClass.enroll(req.juniperUser!.id, id);
  }

  @Delete('group-classes/:id/enroll')
  @UseGuards(AuthGuard)
  cancelEnrollment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.groupClass.cancelEnrollment(req.juniperUser!.id, id);
  }
}