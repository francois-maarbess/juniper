import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
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
import { BountyService } from './bounty.service.js';

@Controller('marketplace')
export class BountyController {
  constructor(@Inject(BountyService) private readonly bountyService: BountyService) {}

  @Post('bounties')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  createBounty(
    @Req() request: AuthenticatedRequest & Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const body = request.body as any;
    const amount = Number(body?.bountyAmountCents ?? body?.bountyAmountUsd * 100);
    return this.bountyService.createBounty(request.juniperUser!.id, {
      courseTag: String(body?.courseTag ?? ''),
      description: String(body?.description ?? ''),
      bountyAmountCents: amount,
      file,
    });
  }

  @Get('bounties')
  listOpenBounties() {
    return this.bountyService.listOpenBounties();
  }

  @Post('bounties/:id/claim')
  @UseGuards(AuthGuard)
  claimBounty(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bountyService.claimBounty(request.juniperUser!.id, id);
  }

  @Post('bounties/:id/solutions')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  submitSolution(
    @Req() request: AuthenticatedRequest & Request,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const body = request.body as any;
    return this.bountyService.submitSolution(request.juniperUser!.id, id, {
      description: String(body?.description ?? ''),
      file,
      voiceNoteUrl: typeof body?.voiceNoteUrl === 'string' ? body.voiceNoteUrl : undefined,
    });
  }

  @Get('bounties/:id/solutions')
  listSolutions(@Param('id') id: string) {
    return this.bountyService.listSolutions(id);
  }

  @Get('bounties/:id/image')
  async getBountyImage(@Param('id') id: string, @Res() response: Response) {
    const file = await this.bountyService.getBountyImage(id);
    response.setHeader('Content-Type', file.mimeType);
    response.end(file.bytes);
  }

  @Get('bounties/solution-image/:id')
  async getSolutionImage(@Param('id') id: string, @Res() response: Response) {
    const file = await this.bountyService.getBountyImage(`solution-${id}`);
    response.setHeader('Content-Type', file.mimeType);
    response.end(file.bytes);
  }
}