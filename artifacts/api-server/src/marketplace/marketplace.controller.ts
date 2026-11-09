import {
  BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { MarketplaceService } from './marketplace.service.js';
import { generateTutorOpenGraphHtml, generateTutorOgSvg } from './opengraph.helper.js';

type BodyRecord = Record<string, unknown>;
function bodyRecord(value: unknown): BodyRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as BodyRecord;
  throw new BadRequestException('Enter the requested information.');
}
function text(body: BodyRecord, key: string, max: number, min = 1) {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new BadRequestException(`Enter a valid ${key}.`);
  }
  return value.trim();
}
function integer(body: BodyRecord, key: string) {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new BadRequestException(`Enter a valid ${key}.`);
  return value;
}

@Controller('marketplace')
@UseGuards(AuthRateLimitGuard)
export class MarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Get('subjects')
  subjects() {
    return this.marketplace.listSubjects();
  }

  @Get('courses')
  courses(@Query('q') query?: string, @Query('university') university?: string) {
    if ((query?.length ?? 0) > 100 || (university?.length ?? 0) > 160) {
      throw new BadRequestException('Enter a valid search query.');
    }
    return this.marketplace.searchUniversityCourses(query, university);
  }

  @Get('tutors')
  tutors(
    @Query('subject') subject?: string,
    @Query('level') level?: string,
    @Query('courseCode') courseCode?: string,
    @Query('university') university?: string,
  ) {
    if ((subject?.length ?? 0) > 100 || (level?.length ?? 0) > 80 || (courseCode?.length ?? 0) > 160 || (university?.length ?? 0) > 160) {
      throw new BadRequestException('Choose a valid filter.');
    }
    return this.marketplace.listTutors({
      ...(subject ? { subject } : {}),
      ...(level ? { level } : {}),
      ...(courseCode ? { courseCode } : {}),
      ...(university ? { university } : {}),
    });
  }

  @Get('tutors/:tutorId')
  async tutorById(
    @Param('tutorId') tutorId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorId)) {
      throw new BadRequestException('Choose a valid tutor profile.');
    }
    const profile = await this.marketplace.getPublicTutorProfile(tutorId);

    // Detect social media unfurling crawlers (WhatsApp, Facebook, Twitter, Telegram, etc.)
    const userAgent = request.headers['user-agent'] || '';
    const isCrawler = /whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|linkedinbot|embedly|quora link preview/i.test(userAgent);
    const acceptsHtml = (request.headers.accept || '').includes('text/html');

    if (isCrawler || (acceptsHtml && !request.headers['x-juniper-client'])) {
      const appOrigin = process.env.APP_PUBLIC_URL || process.env.APP_ORIGIN || 'http://localhost:8081';
      const apiOrigin = `${request.protocol}://${request.get('host') || 'localhost:3001'}/api`;
      const html = generateTutorOpenGraphHtml(profile, appOrigin, apiOrigin);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      return html;
    }

    return profile;
  }

  @Get('tutors/:tutorId/og')
  async tutorOg(
    @Param('tutorId') tutorId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorId)) {
      throw new BadRequestException('Choose a valid tutor profile.');
    }
    const profile = await this.marketplace.getPublicTutorProfile(tutorId);
    const appOrigin = process.env.APP_PUBLIC_URL || process.env.APP_ORIGIN || 'http://localhost:8081';
    const apiOrigin = `${request.protocol}://${request.get('host') || 'localhost:3001'}/api`;
    const html = generateTutorOpenGraphHtml(profile, appOrigin, apiOrigin);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    response.send(html);
  }

  @Get('tutors/:tutorId/og-image.svg')
  async tutorOgImage(
    @Param('tutorId') tutorId: string,
    @Res() response: Response,
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorId)) {
      throw new BadRequestException('Choose a valid tutor profile.');
    }
    const profile = await this.marketplace.getPublicTutorProfile(tutorId);
    const svg = generateTutorOgSvg(profile);
    response.setHeader('Content-Type', 'image/svg+xml');
    response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    response.send(svg);
  }

  @Get('tutor-profile')
  @UseGuards(AuthGuard)
  tutorProfileMe(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getTutorProfile(request.juniperUser!.id);
  }

  @Post('tutor-profile')
  @UseGuards(AuthGuard)
  tutorProfile(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    if (!Array.isArray(body.subjectIds) || body.subjectIds.some((id) => typeof id !== 'string')) {
      throw new BadRequestException('Choose the subjects you teach.');
    }
    if (!Array.isArray(body.availability) || body.availability.some((day) => typeof day !== 'string')) {
      throw new BadRequestException('Choose your teaching availability.');
    }
    if (body.levels !== undefined && (!Array.isArray(body.levels) || body.levels.some((level) => typeof level !== 'string'))) {
      throw new BadRequestException('Choose the learner levels you teach.');
    }
    return this.marketplace.createTutorProfile(request.juniperUser!.id, {
      displayName: text(body, 'displayName', 80),
      ...(typeof body.headline === 'string' ? { headline: body.headline.trim().slice(0, 140) } : {}),
      ...(typeof body.biography === 'string' ? { biography: body.biography.trim().slice(0, 3000) } : {}),
      ...(typeof body.educationSummary === 'string' ? { educationSummary: body.educationSummary.trim().slice(0, 1000) } : {}),
      hourlyRateCents: integer(body, 'hourlyRateCents'),
      subjectIds: body.subjectIds as string[],
      availability: body.availability as string[],
      timezone: typeof body.timezone === 'string' ? body.timezone.trim().slice(0, 100) : 'UTC',
      ...(Array.isArray(body.levels) ? { levels: body.levels as string[] } : {}),
    });
  }

  @Get('tutor-profile/courses')
  @UseGuards(AuthGuard)
  tutorCoursesMe(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getTutorCourses(request.juniperUser!.id);
  }

  @Put('tutor-profile/courses')
  @UseGuards(AuthGuard)
  updateTutorCourses(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    if (!Array.isArray(body.courseIds) || body.courseIds.some((id) => typeof id !== 'string')) {
      throw new BadRequestException('Provide an array of university course IDs.');
    }
    return this.marketplace.updateTutorCourses(request.juniperUser!.id, body.courseIds as string[]);
  }

  @Get('tutors/:tutorId/courses')
  tutorCoursesById(@Param('tutorId') tutorId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorId)) {
      throw new BadRequestException('Choose a valid tutor profile.');
    }
    return this.marketplace.getTutorCourses(tutorId);
  }

  @Get('tutor-profile/availability')
  @UseGuards(AuthGuard)
  tutorAvailabilityMe(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getTutorAvailabilitySlots(request.juniperUser!.id);
  }

  @Put('tutor-profile/availability')
  @UseGuards(AuthGuard)
  updateTutorAvailability(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    if (!Array.isArray(body.slots)) {
      throw new BadRequestException('Provide an array of availability slots.');
    }
    return this.marketplace.updateTutorAvailabilitySlots(request.juniperUser!.id, body.slots as any);
  }

  @Get('tutors/:tutorId/availability')
  tutorAvailabilityById(@Param('tutorId') tutorId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tutorId)) {
      throw new BadRequestException('Choose a valid tutor profile.');
    }
    return this.marketplace.getTutorAvailabilitySlots(tutorId);
  }

  @Post('requests/assist')
  @UseGuards(AuthGuard)
  assistRequest(@Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.assistRequest({
      prompt: text(body, 'prompt', 10000, 3),
      ...(typeof body.subjectName === 'string' ? { subjectName: body.subjectName.trim().slice(0, 100) } : {}),
    });
  }

  @Post('requests')
  @UseGuards(AuthGuard)
  createRequest(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.createRequest(request.juniperUser!.id, {
      subjectId: text(body, 'subjectId', 64),
      ...(typeof body.customSubject === 'string' && body.customSubject.trim() ? { customSubject: body.customSubject.trim().slice(0, 120) } : {}),
      ...(typeof body.customCourse === 'string' && body.customCourse.trim() ? { customCourse: body.customCourse.trim().slice(0, 160) } : {}),
      ...(typeof body.university === 'string' && body.university.trim() ? { university: body.university.trim().slice(0, 160) } : {}),
      ...(typeof body.instructionLanguage === 'string' && body.instructionLanguage.trim() ? { instructionLanguage: body.instructionLanguage.trim().slice(0, 80) } : {}),
      title: text(body, 'title', 120, 5),
      details: text(body, 'details', 5000, 10),
      ...(typeof body.targetTutorId === 'string' && body.targetTutorId.trim() ? { targetTutorId: body.targetTutorId.trim() } : {}),
      ...(typeof body.serviceType === 'string' ? { serviceType: body.serviceType.trim().slice(0, 50) } : {}),
      ...(typeof body.helpType === 'string' ? { helpType: body.helpType.trim().slice(0, 40) } : {}),
      ...(typeof body.level === 'string' ? { level: body.level.trim().slice(0, 80) } : {}),
      deadline: text(body, 'deadline', 80),
      budgetCents: integer(body, 'budgetCents'),
      ...(typeof body.timezone === 'string' ? { timezone: body.timezone.trim().slice(0, 100) } : {}),
      ...(Array.isArray(body.preferredTimes) && body.preferredTimes.every((time) => typeof time === 'string')
        ? { preferredTimes: body.preferredTimes as string[] } : {}),
      ...(typeof body.sessionDurationMinutes === 'number' ? { sessionDurationMinutes: body.sessionDurationMinutes } : {}),
    });
  }

  @Post('requests/:requestId/attachments')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadRequestAttachment(@Req() request: AuthenticatedRequest & Request, @Param('requestId') requestId: string,
    @UploadedFile() file?: Express.Multer.File) {
    return this.marketplace.uploadRequestAttachment(request.juniperUser!.id, requestId, file);
  }

  @Get('requests/:requestId/attachments/:attachmentId')
  @UseGuards(AuthGuard)
  async downloadRequestAttachment(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    const file = await this.marketplace.downloadRequestAttachment(request.juniperUser!.id, requestId, attachmentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, '_')}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.bytes);
  }

  @Get('requests/mine')
  @UseGuards(AuthGuard)
  myRequests(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listMyRequests(request.juniperUser!.id);
  }

  @Get('requests/board')
  @UseGuards(AuthGuard)
  requestBoard(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listRequestBoard(request.juniperUser!.id);
  }

  @Get('tutor/workload')
  @UseGuards(AuthGuard)
  tutorWorkload(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getTutorWorkload(request.juniperUser!.id);
  }

  @Get('requests/:requestId')
  @UseGuards(AuthGuard)
  requestDetail(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string) {
    return this.marketplace.getRequest(request.juniperUser!.id, requestId);
  }

  @Get('requests/:requestId/offers')
  @UseGuards(AuthGuard)
  requestOffers(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string) {
    return this.marketplace.listOffers(request.juniperUser!.id, requestId);
  }

  @Get('requests/:requestId/offers/:offerId/messages')
  @UseGuards(AuthGuard)
  offerMessages(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string, @Param('offerId') offerId: string) {
    return this.marketplace.listOfferMessages(request.juniperUser!.id, requestId, offerId);
  }

  @Post('requests/:requestId/offers/:offerId/messages')
  @UseGuards(AuthGuard)
  sendOfferMessage(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string,
    @Param('offerId') offerId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.sendOfferMessage(request.juniperUser!.id, requestId, offerId, text(body, 'text', 2000));
  }

  @Get('requests/:requestId/offer-guidance')
  @UseGuards(AuthGuard)
  offerGuidance(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string) {
    return this.marketplace.getOfferGuidance(request.juniperUser!.id, requestId);
  }

  @Post('requests/:requestId/offers')
  @UseGuards(AuthGuard)
  createOffer(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    const estimate = body.estimatedMinutes;
    if (estimate !== undefined && typeof estimate !== 'number') throw new BadRequestException('Enter a valid time estimate.');
    if (body.proposedAt !== undefined && typeof body.proposedAt !== 'string') throw new BadRequestException('Choose a valid session time.');
    return this.marketplace.createOffer(request.juniperUser!.id, requestId, {
      amountCents: integer(body, 'amountCents'),
      note: text(body, 'note', 2000, 10),
      ...(typeof estimate === 'number' ? { estimatedMinutes: estimate } : {}),
      ...(typeof body.proposedAt === 'string' ? { proposedAt: body.proposedAt } : {}),
      ...(typeof body.turnaroundHours === 'number' ? { turnaroundHours: body.turnaroundHours } : {}),
      ...(typeof body.includesWalkthrough === 'boolean' ? { includesWalkthrough: body.includesWalkthrough } : {}),
      ...(typeof body.offerType === 'string' ? { offerType: body.offerType.trim().slice(0, 30) } : {}),
      ...(typeof body.packageSessionCount === 'number' ? { packageSessionCount: body.packageSessionCount } : {}),
      ...(typeof body.packageDescription === 'string' ? { packageDescription: body.packageDescription.trim().slice(0, 500) } : {}),
    });
  }

  @Post('offers/:offerId/accept')
  @UseGuards(AuthGuard)
  acceptOffer(@Req() request: AuthenticatedRequest, @Param('offerId') offerId: string) {
    return this.marketplace.acceptOffer(request.juniperUser!.id, offerId);
  }

  @Get('bookings')
  @UseGuards(AuthGuard)
  bookings(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listBookings(request.juniperUser!.id);
  }

  @Get('bookings/:bookingId')
  @UseGuards(AuthGuard)
  bookingDetail(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.marketplace.getBooking(request.juniperUser!.id, bookingId);
  }

  @Post('bookings/:bookingId/deliver-solution')
  @UseGuards(AuthGuard)
  deliverSolution(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.deliverSolution(request.juniperUser!.id, bookingId, {
      solutionSummary: text(body, 'solutionSummary', 5000, 5),
      explanationWalkthrough: text(body, 'explanationWalkthrough', 15000, 20),
      ...(Array.isArray(body.deliverables) ? { deliverables: body.deliverables as Array<{ title: string; url?: string; description?: string }> } : {}),
    });
  }

  @Post('bookings/:bookingId/request-revision')
  @UseGuards(AuthGuard)
  requestRevision(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.requestRevision(request.juniperUser!.id, bookingId, {
      revisionNotes: text(body, 'revisionNotes', 3000, 5),
    });
  }

  @Get('notifications')
  @UseGuards(AuthGuard)
  notifications(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listNotifications(request.juniperUser!.id);
  }

  @Post('push-tokens')
  @UseGuards(AuthGuard)
  registerPushToken(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.registerPushToken(request.juniperUser!.id, text(body, 'token', 180), text(body, 'platform', 12));
  }

  @Delete('push-tokens')
  @UseGuards(AuthGuard)
  removePushToken(@Req() request: AuthenticatedRequest, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.unregisterPushToken(request.juniperUser!.id, text(body, 'token', 180));
  }

  @Patch('notifications/:notificationId/read')
  @UseGuards(AuthGuard)
  markNotificationRead(@Req() request: AuthenticatedRequest, @Param('notificationId') id: string) {
    return this.marketplace.markNotificationRead(request.juniperUser!.id, id);
  }

  @Get('admin/tutor-applications')
  @UseGuards(AuthGuard, AdminGuard)
  tutorApplicationsForReview(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listTutorApplicationsForReview(request.juniperUser!.id);
  }

  @Get('admin/status')
  @UseGuards(AuthGuard)
  async adminStatus(@Req() request: AuthenticatedRequest) {
    return { isAdministrator: await this.marketplace.isAdministrator(request.juniperUser!.id) };
  }

  @Patch('admin/tutors/:tutorId/subscription')
  @UseGuards(AuthGuard, AdminGuard)
  updateTutorSubscription(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    if (typeof body.subscriptionPaid !== 'boolean') throw new BadRequestException('Set subscriptionPaid to true or false.');
    return this.marketplace.setTutorSubscriptionPaid(request.juniperUser!.id, tutorId, body.subscriptionPaid);
  }

  @Patch('admin/tutor-applications/:tutorId/review')
  @UseGuards(AuthGuard, AdminGuard)
  reviewTutorApplication(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    if (body.decision !== 'approved' && body.decision !== 'rejected' && body.decision !== 'suspended') {
      throw new BadRequestException('Choose an application review decision.');
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    return this.marketplace.reviewTutorApplication(
      request.juniperUser!.id, tutorId, body.decision, note, body.qualificationsReviewed === true,
    );
  }

  @Post('bookings/:bookingId/complete')
  @UseGuards(AuthGuard)
  completeBooking(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    return this.marketplace.completeBooking(request.juniperUser!.id, bookingId, {
      learningRecap: text(body, 'learningRecap', 5000, 20),
      nextSteps: text(body, 'nextSteps', 3000, 10),
    });
  }

  @Post('bookings/:bookingId/cancel')
  @UseGuards(AuthGuard)
  cancelBooking(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.marketplace.cancelBooking(request.juniperUser!.id, bookingId);
  }

  @Post('bookings/:bookingId/reviews')
  @UseGuards(AuthGuard)
  reviewBooking(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    const rating = integer(body, 'rating');
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 2000) : '';
    return this.marketplace.createReview(request.juniperUser!.id, bookingId, rating, comment);
  }

  @Get('tutors/:tutorId/tags')
  listTutorTags(@Param('tutorId') tutorId: string) {
    return this.marketplace.listTutorTags(tutorId);
  }

  @Post('tutors/:tutorId/tags/endorse')
  @UseGuards(AuthGuard)
  endorseTutorTag(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    const tag = typeof body.tag === 'string' ? body.tag : '';
    return this.marketplace.endorseTutorTag(request.juniperUser!.id, tutorId, tag);
  }

  @Get('bookings/:bookingId/messages')
  @UseGuards(AuthGuard)
  messages(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.marketplace.getMessages(request.juniperUser!.id, bookingId);
  }

  @Patch('bookings/:bookingId/messages/read')
  @UseGuards(AuthGuard)
  acknowledgeMessages(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.marketplace.acknowledgeMessages(request.juniperUser!.id, bookingId);
  }

  @Post('bookings/:bookingId/messages')
  @UseGuards(AuthGuard)
  sendMessage(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string, @Body() value: unknown) {
    const body = bodyRecord(value);
    const messageText = typeof body.text === 'string' ? body.text : '';
    if (messageText.length > 5000) throw new BadRequestException('Messages can be up to 5,000 characters.');
    if (body.attachmentIds !== undefined && (!Array.isArray(body.attachmentIds) || body.attachmentIds.length > 5 || body.attachmentIds.some((id) => typeof id !== 'string'))) {
      throw new BadRequestException('Choose up to five valid attachments.');
    }
    return this.marketplace.sendMessage(
      request.juniperUser!.id,
      bookingId,
      messageText,
      Array.isArray(body.attachmentIds) ? (body.attachmentIds as string[]) : [],
      {
        ...(typeof body.messageType === 'string' ? { messageType: body.messageType } : {}),
        ...(typeof body.audioUrl === 'string' ? { audioUrl: body.audioUrl } : {}),
        ...(typeof body.audioDurationSeconds === 'number' ? { audioDurationSeconds: body.audioDurationSeconds } : {}),
      },
    );
  }

  @Post('bookings/:bookingId/messages/attachments')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadMessageAttachment(@Req() request: AuthenticatedRequest & Request, @Param('bookingId') bookingId: string,
    @UploadedFile() file?: Express.Multer.File) {
    return this.marketplace.uploadMessageAttachment(request.juniperUser!.id, bookingId, file);
  }

  @Get('bookings/:bookingId/messages/attachments/:attachmentId')
  @UseGuards(AuthGuard)
  async downloadMessageAttachment(@Req() request: AuthenticatedRequest, @Param('bookingId') bookingId: string,
    @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    const file = await this.marketplace.downloadMessageAttachment(request.juniperUser!.id, bookingId, attachmentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, '_')}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.bytes);
  }
}
