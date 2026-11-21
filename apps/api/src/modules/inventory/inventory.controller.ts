import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CommitStockDto } from './dto/commit-stock.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY.VIEW_STOCK)
  listInventory() {
    return this.inventory.listInventorySummary();
  }

  @Get('balance/:variantId')
  @RequirePermission(PERMISSIONS.INVENTORY.VIEW_STOCK)
  getBalance(@Param('variantId') variantId: string) {
    return this.inventory.getBalance(variantId);
  }

  @Get('movements/:variantId')
  @RequirePermission(PERMISSIONS.INVENTORY.VIEW_STOCK)
  getMovements(@Param('variantId') variantId: string) {
    return this.inventory.getMovements(variantId);
  }

  @Post('commit')
  @RequirePermission(PERMISSIONS.INVENTORY.ADJUST_STOCK)
  commit(@Body() dto: CommitStockDto) {
    return this.inventory.commitStock(dto);
  }

  @Delete('holds/:id')
  @RequirePermission(PERMISSIONS.INVENTORY.ADJUST_STOCK)
  releaseHold(@Param('id') id: string) {
    return this.inventory.releaseHold(id);
  }
}
