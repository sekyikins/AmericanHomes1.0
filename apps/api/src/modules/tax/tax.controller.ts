import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TaxService } from './tax.service';

@Controller('tax')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('config')
  @RequirePermission(PERMISSIONS.TAX.VIEW)
  async getConfig() {
    const rates = await this.tax.getConfiguredRates();
    return { seller: this.tax.getSellerInfo(), rates };
  }

  @Get('invoices')
  @RequirePermission(PERMISSIONS.TAX.VIEW)
  listInvoices(@Query('status') status?: string) {
    return this.tax.listInvoices(status);
  }

  @Get('orders/:orderId')
  getForOrder(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tax.getForOrder(orderId, { id: user.id, role: user.role });
  }

  @Post('orders/:orderId/issue')
  @RequirePermission(PERMISSIONS.TAX.MANAGE)
  issueForOrder(
    @Param('orderId') orderId: string,
    @Body() body: { customerTin?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tax.issueForOrder(orderId, { customerTin: body?.customerTin, actorId: user.id });
  }

  @Post('invoices/:id/retry')
  @RequirePermission(PERMISSIONS.TAX.MANAGE)
  retry(@Param('id') id: string) {
    return this.tax.submitToEvat(id);
  }
}
