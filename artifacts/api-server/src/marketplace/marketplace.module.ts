import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { TutorApplicationController } from './tutor-application.controller.js';
import { TutorApplicationService } from './tutor-application.service.js';
import { TutorDocumentStorage } from './tutor-document-storage.js';
import { MarketplaceRealtimeGateway } from './marketplace-realtime.gateway.js';
import { EmailOutboxService } from './email-outbox.service.js';
import { MessageAttachmentCleanupService } from './message-attachment-cleanup.service.js';
import { TutorSubscriptionService } from './tutor-subscription.service.js';
import { VoiceNotesController } from './voice-notes.controller.js';
import { VoiceNotesService } from './voice-notes.service.js';
import { TutorVaultController } from './tutor-vault.controller.js';
import { TutorVaultService } from './tutor-vault.service.js';
import { BountyController } from './bounty.controller.js';
import { BountyService } from './bounty.service.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { WorkroomSignalingGateway } from './workroom-signaling.gateway.js';
import { WorkroomController } from './workroom.controller.js';
import { WorkroomService } from './workroom.service.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';
import { CommunityController } from './community.controller.js';
import { CommunityService } from './community.service.js';
import { GroupClassController } from './group-class.controller.js';
import { GroupClassService } from './group-class.service.js';
import { BusinessController } from './business.controller.js';
import { BusinessService } from './business.service.js';
import { MigrationService } from './migration.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    MarketplaceController,
    TutorApplicationController,
    VoiceNotesController,
    TutorVaultController,
    BountyController,
    AiController,
    WorkroomController,
    MatchingController,
    CommunityController,
    GroupClassController,
    BusinessController,
  ],
  providers: [
    MarketplaceService,
    TutorApplicationService,
    TutorDocumentStorage,
    MarketplaceRealtimeGateway,
    WorkroomSignalingGateway,
    EmailOutboxService,
    MessageAttachmentCleanupService,
    TutorSubscriptionService,
    VoiceNotesService,
    TutorVaultService,
    BountyService,
    AiService,
    WorkroomService,
    MatchingService,
    CommunityService,
    GroupClassService,
    BusinessService,
    MigrationService,
  ],
})
export class MarketplaceModule {}
