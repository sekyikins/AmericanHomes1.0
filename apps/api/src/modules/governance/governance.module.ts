import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

@Module({
  imports: [StorageModule, AuditModule],
  controllers: [GovernanceController],
  providers: [GovernanceService],
})
export class GovernanceModule {}
