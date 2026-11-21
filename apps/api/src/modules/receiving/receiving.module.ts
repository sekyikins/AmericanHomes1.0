import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ReceivingController } from './receiving.controller';
import { ReceivingService } from './receiving.service';

@Module({
  imports: [AuditModule],
  controllers: [ReceivingController],
  providers: [ReceivingService],
  exports: [ReceivingService],
})
export class ReceivingModule {}
