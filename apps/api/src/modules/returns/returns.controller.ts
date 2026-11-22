import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnsService } from './returns.service';

@Controller('returns')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.RETURNS.REVIEW)
  findAll() {
    return this.returns.findAll();
  }

  @Post()
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReturnDto) {
    return this.returns.submit(user.id, dto, user.role);
  }

  @Post(':id/decision')
  @RequirePermission(PERMISSIONS.RETURNS.APPROVE)
  decide(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      approved: boolean;
      settlementType?: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
      refundAmountCents?: number;
      exchangeVariantId?: string;
      priceDiffCents?: number;
      disposition?: 'RESTOCK' | 'DISPOSE' | 'EXCHANGE';
      variantId?: string;
      quantity?: number;
      notes?: string;
    },
  ) {
    return this.returns.decide(id, user.id, dto, user.isOwner);
  }
}
