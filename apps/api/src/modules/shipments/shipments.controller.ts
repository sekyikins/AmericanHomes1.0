import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationDto } from '../../common/utils/pagination';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ManifestRevisionDto } from './dto/manifest-revision.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SHIPMENTS.VIEW)
  findAll(@Query() q: PaginationDto) {
    return this.shipments.findAll(q);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SHIPMENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.shipments.findById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SHIPMENTS.CREATE)
  create(@Body() dto: CreateShipmentDto) {
    return this.shipments.create(dto);
  }

  @Post(':id/manifest')
  @RequirePermission(PERMISSIONS.SHIPMENTS.UPDATE)
  addManifest(@Param('id') id: string, @Body() dto: ManifestRevisionDto) {
    return this.shipments.addManifestRevision(id, dto);
  }

  @Post(':id/tracking')
  @RequirePermission(PERMISSIONS.SHIPMENTS.UPDATE)
  addTracking(
    @Param('id') id: string,
    @Body() dto: { event: string; location?: string; occurredAt?: string; notes?: string },
  ) {
    return this.shipments.addTrackingEvent(id, dto);
  }

  @Post(':id/expenses')
  @RequirePermission(PERMISSIONS.EXPENSES.CREATE)
  addExpense(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { category: string; description: string; amountCents: number; date?: string },
  ) {
    return this.shipments.addExpense(id, user.id, dto);
  }

  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.SHIPMENTS.UPDATE)
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('status') status: string,
  ) {
    return this.shipments.updateStatus(id, status, user.id);
  }

  @Post(':id/close')
  @RequirePermission(PERMISSIONS.SHIPMENTS.CLOSE)
  close(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('overrideReason') overrideReason?: string,
  ) {
    return this.shipments.close(id, user.id, overrideReason);
  }
}
