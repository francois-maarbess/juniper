import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { VoiceNotesService } from './voice-notes.service.js';

@Controller('marketplace')
export class VoiceNotesController {
  constructor(
    @Inject(VoiceNotesService) private readonly voiceNotesService: VoiceNotesService,
  ) {}

  // ── Voice Notes Endpoints ────────────────────────────────────────────────

  @Post('requests/:requestId/voice-note')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  uploadRequestVoiceNote(
    @Req() request: AuthenticatedRequest & Request,
    @Param('requestId') requestId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const duration = parseFloat((request.body as any)?.durationSeconds ?? '0');
    return this.voiceNotesService.uploadVoiceNote(request.juniperUser!.id, {
      requestId,
      file,
      durationSeconds: duration,
    });
  }

  @Post('bookings/:bookingId/voice-note')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  uploadBookingVoiceNote(
    @Req() request: AuthenticatedRequest & Request,
    @Param('bookingId') bookingId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const duration = parseFloat((request.body as any)?.durationSeconds ?? '0');
    return this.voiceNotesService.uploadVoiceNote(request.juniperUser!.id, {
      bookingId,
      file,
      durationSeconds: duration,
    });
  }

  @Get('requests/:requestId/voice-note')
  @UseGuards(AuthGuard)
  listRequestVoiceNotes(@Param('requestId') requestId: string) {
    return this.voiceNotesService.listVoiceNotesForRequest(requestId);
  }

  @Get('bookings/:bookingId/voice-note')
  @UseGuards(AuthGuard)
  listBookingVoiceNotes(@Param('bookingId') bookingId: string) {
    return this.voiceNotesService.listVoiceNotesForBooking(bookingId);
  }

  @Get('voice-notes/:noteId/audio')
  async streamVoiceNoteAudio(
    @Param('noteId') noteId: string,
    @Res() response: Response,
  ) {
    const audio = await this.voiceNotesService.getVoiceNoteAudio(noteId);
    response.setHeader('Content-Type', audio.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${audio.fileName}"`);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.end(audio.bytes);
  }

  // ── Shared Resources Endpoints ───────────────────────────────────────────

  @Post('resources')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    }),
  )
  uploadResource(
    @Req() request: AuthenticatedRequest & Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const bookingId = typeof (request.body as any)?.bookingId === 'string' ? (request.body as any).bookingId : undefined;
    return this.voiceNotesService.uploadResource(request.juniperUser!.id, {
      bookingId,
      file,
    });
  }

  @Get('resources')
  @UseGuards(AuthGuard)
  listResources(
    @Req() request: AuthenticatedRequest,
    @Query('bookingId') bookingId?: string,
  ) {
    return this.voiceNotesService.listResources(request.juniperUser!.id, bookingId);
  }

  @Get('resources/:resourceId/download')
  @UseGuards(AuthGuard)
  async downloadResource(
    @Req() request: AuthenticatedRequest,
    @Param('resourceId') resourceId: string,
    @Res() response: Response,
  ) {
    const file = await this.voiceNotesService.downloadResource(request.juniperUser!.id, resourceId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, '_')}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.bytes);
  }
}
