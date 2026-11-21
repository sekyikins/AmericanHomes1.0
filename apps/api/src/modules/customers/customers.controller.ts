import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CustomersService } from './customers.service';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Controller('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CUSTOMERS.VIEW)
  findAll(@Query() query: CustomerQueryDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CUSTOMERS.VIEW)
  findOne(@Param('id') id: string) {
    return this.customers.findById(id);
  }

  @Get(':id/history')
  @RequirePermission(PERMISSIONS.CUSTOMERS.VIEW)
  getHistory(@Param('id') id: string) {
    return this.customers.getHistory(id);
  }
}
