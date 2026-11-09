import { Controller, Get, Post, Req, Query, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { CommunityService } from './community.service.js';

@Controller('marketplace')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('community/questions')
  listQuestions(@Query('subject') subject?: string) {
    return this.community.listQuestions(subject);
  }

  @Post('community/questions')
  @UseGuards(AuthGuard)
  createQuestion(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.community.createQuestion(req.juniperUser!.id, {
      subject: String(body?.subject ?? ''),
      title: String(body?.title ?? ''),
      body: String(body?.body ?? ''),
      imageUrl: body?.imageUrl,
    });
  }

  @Get('community/questions/:id')
  getQuestion(@Param('id') id: string) {
    return this.community.getQuestion(id);
  }

  @Post('community/questions/:id/answers')
  @UseGuards(AuthGuard)
  createAnswer(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.community.createAnswer(req.juniperUser!.id, id, String(body?.body ?? ''));
  }

  @Post('community/answers/:id/upvote')
  @UseGuards(AuthGuard)
  upvoteAnswer(@Param('id') id: string) {
    return this.community.upvoteAnswer(id);
  }

  @Post('community/answers/:id/accept')
  @UseGuards(AuthGuard)
  acceptAnswer(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.community.acceptAnswer(id, req.juniperUser!.id);
  }
}