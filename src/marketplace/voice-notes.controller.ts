import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Request,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoiceNotesService } from './voice-notes.service';

// ---------------------------------------------------------------------------
// Helper: multer storage options
// ---------------------------------------------------------------------------
function multerStorage(subDir: string) {
  return diskStorage({
    destination: path.join(process.cwd(), 'uploads', subDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class VoiceNotesController {
  constructor(private readonly voiceNotesService: VoiceNotesService) {}

  // ── Voice Notes ────────────────────────────────────────────────────────────

  /**
   * POST /marketplace/requests/:requestId/voice-note
   * Upload a voice note for a study request (multipart/form-data).
   * Expected fields: file (audio), durationSeconds (number)
   */
  @Post('requests/:requestId/voice-note')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage('voice-notes'),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/webm'];
        if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported audio type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadVoiceNote(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('durationSeconds') durationSecondsRaw: string,
    @Request() req: { user: { id: string } },
  ) {
    const durationSeconds = parseFloat(durationSecondsRaw);
    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      throw new BadRequestException('durationSeconds must be a positive number');
    }
    return this.voiceNotesService.uploadVoiceNote(
      requestId,
      req.user.id,
      file,
      durationSeconds,
    );
  }

  /**
   * GET /marketplace/requests/:requestId/voice-note
   * Retrieve all voice notes for a study request.
   */
  @Get('requests/:requestId/voice-note')
  async getVoiceNotes(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.voiceNotesService.listVoiceNotes(requestId);
  }

  // ── Resource Files ─────────────────────────────────────────────────────────

  /**
   * POST /marketplace/resources
   * Upload a new resource file (multipart/form-data, field name: "file").
   */
  @Post('resources')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage('resources'),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
      fileFilter: (_req, file, cb) => {
        const blocked = ['application/x-msdownload', 'application/x-executable'];
        if (blocked.includes(file.mimetype)) {
          cb(new BadRequestException(`File type not allowed: ${file.mimetype}`), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadResource(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { id: string } },
  ) {
    return this.voiceNotesService.uploadResource(req.user.id, file);
  }

  /**
   * GET /marketplace/resources
   * List resource files. Pass ?ownerId=<uuid> to filter by owner (admins),
   * or omit to return the authenticated user's own resources.
   */
  @Get('resources')
  async listResources(
    @Query('ownerId') ownerId: string | undefined,
    @Request() req: { user: { id: string } },
  ) {
    const effectiveOwner = ownerId ?? req.user.id;
    return this.voiceNotesService.listResources(effectiveOwner);
  }
}
