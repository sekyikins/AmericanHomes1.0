import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsAppModule } from '../integrations/whatsapp/whatsapp.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { OutboxProcessor } from './outbox/outbox.processor';
import { ReservationExpiryJob } from './scheduled/reservation-expiry.job';

@Module({
  imports: [ScheduleModule.forRoot(), WhatsAppModule, InventoryModule],
  providers: [OutboxProcessor, ReservationExpiryJob],
  exports: [ReservationExpiryJob],
})
export class JobsModule {}
