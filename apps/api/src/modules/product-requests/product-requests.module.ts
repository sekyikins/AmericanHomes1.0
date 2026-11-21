import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductRequestsController } from './product-requests.controller';
import { ProductRequestsService } from './product-requests.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductRequestsController],
  providers: [ProductRequestsService],
})
export class ProductRequestsModule {}
