import {
  BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req,
  Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { TutorApplicationService } from './tutor-application.service.js';

@Controller('marketplace')
@UseGuards(AuthRateLimitGuard, AuthGuard)
export class TutorApplicationController {
  constructor(@Inject(TutorApplicationService) private readonly applications: TutorApplicationService) {}

  @Get('tutor-application/me')
  getMine(@Req() request: AuthenticatedRequest) { return this.applications.getMine(request.juniperUser!.id); }

  @Put('tutor-application/me')
  saveDraft(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.applications.saveDraft(request.juniperUser!.id, body);
  }

  @Post('tutor-application/me/submit')
  submit(@Req() request: AuthenticatedRequest) { return this.applications.submit(request.juniperUser!.id); }

  @Post('tutor-application/documents')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  }))
  upload(@Req() request: AuthenticatedRequest & Request, @UploadedFile() file?: Express.Multer.File) {
    const category = request.body?.category;
    if (typeof category !== 'string') throw new BadRequestException('Choose a document type.');
    if (!file) throw new BadRequestException('Choose a document to upload.');
    return this.applications.upload(request.juniperUser!.id, category, file);
  }

  @Delete('tutor-application/documents/:documentId')
  deleteDocument(@Req() request: AuthenticatedRequest, @Param('documentId') id: string) {
    return this.applications.deleteDocument(request.juniperUser!.id, id);
  }

  @Get('admin/tutor-applications/complete')
  listForReview(@Req() request: AuthenticatedRequest) { return this.applications.listForReview(request.juniperUser!.id); }

  @Get('admin/tutor-applications/:tutorId/documents/:documentId/file')
  async getDocument(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string,
    @Param('documentId') documentId: string, @Res() response: Response) {
    const document = await this.applications.documentForAdmin(request.juniperUser!.id, tutorId, documentId);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', document.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${document.fileName.replace(/["\\\r\n]/g, '_')}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(document.bytes);
  }

  @Patch('admin/tutor-applications/:tutorId/documents/:documentId/review')
  reviewDocument(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string,
    @Param('documentId') documentId: string, @Body() body: Record<string, unknown>) {
    if (body.status !== 'verified' && body.status !== 'replace_requested') throw new BadRequestException('Choose a document review decision.');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    return this.applications.reviewDocument(request.juniperUser!.id, tutorId, documentId, body.status, note);
  }

  @Patch('admin/tutor-applications/:tutorId/decision')
  decide(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string, @Body() body: Record<string, unknown>) {
    const decision = body.decision;
    if (decision !== 'approved' && decision !== 'needs_info' && decision !== 'rejected' && decision !== 'suspended') {
      throw new BadRequestException('Choose an application review decision.');
    }
    return this.applications.decide(request.juniperUser!.id, tutorId, decision,
      typeof body.applicantMessage === 'string' ? body.applicantMessage.slice(0, 2000) : '',
      typeof body.internalNote === 'string' ? body.internalNote.slice(0, 2000) : '');
  }
}
