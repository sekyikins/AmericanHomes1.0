import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SourcingController } from './sourcing.controller';
import { SourcingService } from './sourcing.service';

@Module({
  imports: [AuditModule],
  controllers: [SourcingController],
  providers: [SourcingService],
})
export class SourcingModule {}
