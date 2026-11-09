import { Controller, Get, Post, Req, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { WorkroomService } from './workroom.service.js';

@Controller('marketplace')
export class WorkroomController {
  constructor(private readonly workroom: WorkroomService) {}

  @Get('workroom/:bookingId/ice-servers')
  @UseGuards(AuthGuard)
  getIceServers(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.workroom.getIceServers(bookingId, req.juniperUser!.id);
  }

  @Get('workroom/:bookingId/whiteboard')
  @UseGuards(AuthGuard)
  getWhiteboard(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.workroom.getWhiteboard(bookingId, req.juniperUser!.id);
  }

  @Post('workroom/:bookingId/whiteboard')
  @UseGuards(AuthGuard)
  updateWhiteboard(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() body: any) {
    return this.workroom.updateWhiteboard(bookingId, req.juniperUser!.id, body?.elements ?? [], body?.version ?? 0);
  }

  @Post('workroom/:bookingId/whiteboard/clear')
  @UseGuards(AuthGuard)
  clearWhiteboard(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.workroom.clearWhiteboard(bookingId, req.juniperUser!.id);
  }

  @Post('workroom/:bookingId/recording/start')
  @UseGuards(AuthGuard)
  startRecording(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.workroom.startRecording(bookingId, req.juniperUser!.id);
  }

  @Post('workroom/recordings/:recordingId/end')
  @UseGuards(AuthGuard)
  endRecording(@Param('recordingId') recordingId: string, @Body() body: any) {
    return this.workroom.endRecording(recordingId, body?.url ?? '', body?.durationSeconds ?? 0);
  }

  @Get('workroom/:bookingId/recordings')
  @UseGuards(AuthGuard)
  listRecordings(@Param('bookingId') bookingId: string) {
    return this.workroom.listRecordings(bookingId);
  }
}
