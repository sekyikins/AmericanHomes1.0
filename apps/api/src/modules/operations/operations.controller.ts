import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { OperationsService } from './operations.service';

@Controller('operations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  // --- Phase 3: Quotations ---
  @Get('quotes')
  @RequirePermission(PERMISSIONS.OPERATIONS.VIEW_QUOTES)
  listQuotes(@Query('status') status?: string) {
    return this.ops.listQuotes(status);
  }

  @Post('quotes')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_QUOTES)
  createQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      customerId?: string;
      customerName: string;
      customerPhone?: string;
      items: Array<{ variantId: string; quantity: number; unitPriceCents?: number }>;
      validDays?: number;
      depositPercent?: number;
      notes?: string;
    },
  ) {
    return this.ops.createQuote(user.id, dto);
  }

  @Post('quotes/:id/convert')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_QUOTES)
  convertQuote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ops.convertQuoteToOrder(id, user.id);
  }

  @Post('quotes/:id/cancel')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_QUOTES)
  cancelQuote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ops.cancelQuote(id, user.id);
  }

  // --- Phase 4: Proof of Delivery (POD) & After-Sales Service Tickets ---
  @Post('collections/:id/pod')
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  recordPod(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { podSignedBy: string; podPhotoUrl?: string; notes?: string },
  ) {
    return this.ops.recordProofOfDelivery(id, user.id, dto);
  }

  @Get('service-tickets')
  @RequirePermission(PERMISSIONS.OPERATIONS.VIEW_SERVICE_TICKETS)
  listServiceTickets(@Query('status') status?: string) {
    return this.ops.listServiceTickets(status);
  }

  @Post('service-tickets')
  createServiceTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      orderId: string;
      trackedUnitId?: string;
      issueType?: string;
      description: string;
      photoUrl?: string;
    },
  ) {
    return this.ops.createServiceTicket(user.id, dto);
  }

  @Patch('service-tickets/:id')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_SERVICE_TICKETS)
  updateServiceTicket(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { status?: string; assignedTo?: string; resolutionNotes?: string },
  ) {
    return this.ops.updateServiceTicket(id, user.id, dto);
  }

  // --- Phase 5: Cashier Till Shifts (Blind Close) ---
  @Get('shifts')
  @RequirePermission(PERMISSIONS.OPERATIONS.VIEW_SHIFTS)
  listShifts() {
    return this.ops.listShifts();
  }

  @Post('shifts/open')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_SHIFTS)
  openShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { openingFloatCents: number; notes?: string },
  ) {
    return this.ops.openShift(user.id, dto.openingFloatCents, dto.notes);
  }

  @Post('shifts/:id/close')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_SHIFTS)
  closeShift(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      countedCashCents: number;
      reconciledMomoCents?: number;
      reconciledBankCents?: number;
      notes?: string;
    },
  ) {
    return this.ops.closeShift(id, user.id, dto);
  }

  // --- Phase 6: Suppliers & Frozen Landed Cost ---
  @Get('suppliers')
  @RequirePermission(PERMISSIONS.OPERATIONS.VIEW_SUPPLIERS)
  listSuppliers() {
    return this.ops.listSuppliers();
  }

  @Post('suppliers')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_SUPPLIERS)
  createSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      name: string;
      country?: string;
      contactName?: string;
      phone?: string;
      email?: string;
      currency?: string;
      notes?: string;
    },
  ) {
    return this.ops.createSupplier(user.id, dto);
  }

  @Post('shipments/:id/freeze-landed-costs')
  @RequirePermission(PERMISSIONS.OPERATIONS.MANAGE_SUPPLIERS)
  freezeLandedCosts(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ops.freezeShipmentLandedCosts(id, user.id);
  }

  // --- Phase 7: Warehouse Bin Location & ABC Class ---
  @Patch('lots/:lotId/location')
  @RequirePermission(PERMISSIONS.INVENTORY.ADJUST_STOCK)
  updateLotLocation(
    @Param('lotId') lotId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { binLocation?: string; abcClass?: string },
  ) {
    return this.ops.updateLotLocation(lotId, user.id, dto);
  }
}
