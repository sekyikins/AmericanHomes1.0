import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StocktakesController } from './stocktakes.controller';
import { StocktakesService } from './stocktakes.service';

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [StocktakesController],
  providers: [StocktakesService],
})
export class StocktakesModule {}
