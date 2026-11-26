import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EvatClient } from './evat.client';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [TaxController],
  providers: [EvatClient, TaxService],
  exports: [TaxService, EvatClient],
})
export class TaxModule {}
