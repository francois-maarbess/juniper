import {
  Controller, Get, Post, Req, Body, Param, UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('chat')
  @UseGuards(AuthGuard)
  chat(@Req() request: AuthenticatedRequest, @Body() body: any) {
    return this.ai.chat(request.juniperUser!.id, {
      conversationId: body?.conversationId,
      bookingId: body?.bookingId,
      message: String(body?.message ?? ''),
    });
  }

  @Post('explain')
  @UseGuards(AuthGuard)
  explain(@Req() request: AuthenticatedRequest, @Body() body: any) {
    return this.ai.explain(request.juniperUser!.id, {
      text: body?.text,
      subject: body?.subject,
    });
  }

  @Post('study-guide')
  @UseGuards(AuthGuard)
  studyGuide(@Req() request: AuthenticatedRequest, @Body() body: any) {
    return this.ai.generateStudyGuide(request.juniperUser!.id, {
      bookingId: body?.bookingId,
      transcript: String(body?.transcript ?? ''),
    });
  }

  @Get('conversations')
  @UseGuards(AuthGuard)
  listConversations(@Req() request: AuthenticatedRequest) {
    return this.ai.listConversations(request.juniperUser!.id);
  }

  @Get('conversations/:id')
  @UseGuards(AuthGuard)
  getConversation(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ai.getConversation(request.juniperUser!.id, id);
  }
}