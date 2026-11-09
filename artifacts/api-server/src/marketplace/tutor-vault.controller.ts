import {
  BadRequestException,
  Controller,
  Delete,
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
import { TutorVaultService } from './tutor-vault.service.js';

@Controller('marketplace')
export class TutorVaultController {
  constructor(
    @Inject(TutorVaultService) private readonly vaultService: TutorVaultService,
  ) {}

  @Post('tutor-vault')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024, files: 1 },
    }),
  )
  uploadVaultItem(
    @Req() request: AuthenticatedRequest & Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const body = request.body as any;
    const title = typeof body?.title === 'string' ? body.title : '';
    const description = typeof body?.description === 'string' ? body.description : undefined;
    return this.vaultService.uploadVaultItem(request.juniperUser!.id, {
      title,
      description,
      priceCents: 0,
      file,
    });
  }

  @Get('tutors/:tutorId/vault')
  listTutorVault(@Req() request: AuthenticatedRequest, @Param('tutorId') tutorId: string) {
    const buyerId = request?.juniperUser?.id;
    return this.vaultService.listVaultItems(tutorId, buyerId);
  }

  @Delete('tutor-vault/:itemId')
  @UseGuards(AuthGuard)
  deleteVaultItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.vaultService.deleteVaultItem(request.juniperUser!.id, itemId);
  }

  @Get('tutor-vault/:itemId/download')
  @UseGuards(AuthGuard)
  async downloadVaultFile(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Res() response: Response,
  ) {
    const file = await this.vaultService.downloadVaultFile(itemId, request.juniperUser!.id);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.end(file.bytes);
  }
}
