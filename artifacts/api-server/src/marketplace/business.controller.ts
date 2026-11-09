import { Controller, Get, Post, Delete, Req, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { BusinessService } from './business.service.js';

@Controller('marketplace')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  // Calendar
  @Get('business/calendar')
  @UseGuards(AuthGuard)
  listEvents(@Req() req: AuthenticatedRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return this.business.listEvents(req.juniperUser!.id, from, to);
  }

  @Post('business/calendar')
  @UseGuards(AuthGuard)
  createEvent(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.business.createEvent(req.juniperUser!.id, {
      title: String(body?.title ?? ''),
      type: body?.type,
      startAt: String(body?.startAt ?? ''),
      endAt: String(body?.endAt ?? ''),
      studentId: body?.studentId,
      notes: body?.notes,
    });
  }

  @Delete('business/calendar/:id')
  @UseGuards(AuthGuard)
  deleteEvent(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.business.deleteEvent(req.juniperUser!.id, id);
  }

  // Invoices
  @Get('business/invoices')
  @UseGuards(AuthGuard)
  listInvoices(@Req() req: AuthenticatedRequest) {
    return this.business.listInvoices(req.juniperUser!.id);
  }

  @Post('business/invoices')
  @UseGuards(AuthGuard)
  createInvoice(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.business.createInvoice(req.juniperUser!.id, {
      studentId: String(body?.studentId ?? ''),
      amountCents: Number(body?.amountCents ?? 0),
      description: String(body?.description ?? ''),
      dueDate: body?.dueDate,
    });
  }

  @Post('business/invoices/:id/send')
  @UseGuards(AuthGuard)
  sendInvoice(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.business.sendInvoice(req.juniperUser!.id, id);
  }

  @Post('business/invoices/:id/paid')
  @UseGuards(AuthGuard)
  markPaid(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.business.markInvoicePaid(req.juniperUser!.id, id);
  }

  // Earnings
  @Get('business/earnings')
  @UseGuards(AuthGuard)
  getEarnings(@Req() req: AuthenticatedRequest) {
    return this.business.getEarnings(req.juniperUser!.id);
  }

  // Students
  @Get('business/students')
  @UseGuards(AuthGuard)
  getStudents(@Req() req: AuthenticatedRequest) {
    return this.business.getStudents(req.juniperUser!.id);
  }
}