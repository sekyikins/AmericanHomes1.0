import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [AllocationsController],
  providers: [AllocationsService],
})
export class AllocationsModule {}
