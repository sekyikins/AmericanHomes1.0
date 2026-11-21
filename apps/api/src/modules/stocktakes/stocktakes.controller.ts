import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { StocktakesService } from './stocktakes.service';

@Controller('stocktakes')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class StocktakesController {
  constructor(private readonly stocktakes: StocktakesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.STOCKTAKES.MANAGE)
  findAll() {
    return this.stocktakes.findAll();
  }

  @Post()
  @RequirePermission(PERMISSIONS.STOCKTAKES.MANAGE)
  create(@Body() dto: CreateStocktakeDto) {
    return this.stocktakes.create(dto);
  }

  @Post(':id/lines')
  @RequirePermission(PERMISSIONS.STOCKTAKES.MANAGE)
  recordLines(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('lines') lines: Array<{ variantId: string; countedQty: number; notes?: string }>,
  ) {
    return this.stocktakes.recordLines(id, user.id, lines ?? []);
  }

  @Post('adjustments')
  @RequirePermission(PERMISSIONS.INVENTORY.ADJUST_STOCK)
  proposeAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { stocktakeId?: string; variantId: string; quantity: number; reason: string },
  ) {
    return this.stocktakes.proposeAdjustment(user.id, dto);
  }

  @Post('adjustments/:id/approve')
  @RequirePermission(PERMISSIONS.INVENTORY.APPROVE_ADJUSTMENT)
  approveAdjustment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.stocktakes.approveAdjustment(id, user.id, user.isOwner);
  }

  @Post('adjustments/:id/reject')
  @RequirePermission(PERMISSIONS.INVENTORY.APPROVE_ADJUSTMENT)
  rejectAdjustment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.stocktakes.rejectAdjustment(id, user.id, reason || 'Rejected by manager');
  }
}
