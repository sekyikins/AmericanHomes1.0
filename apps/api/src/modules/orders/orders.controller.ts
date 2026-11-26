import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationDto } from '../../common/utils/pagination';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { WalkInOrderDto } from './dto/walk-in-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ORDERS.VIEW)
  findAll(@Query() query: PaginationDto) {
    return this.orders.findAll(query);
  }

  @Get('my')
  getMy(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.findByCustomer(user.id);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ORDERS.VIEW)
  findOne(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Post('checkout')
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.orders.createCheckout(user.id, dto);
  }

  @Post('walk-in')
  @RequirePermission(PERMISSIONS.ORDERS.CREATE_WALK_IN)
  createWalkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalkInOrderDto) {
    return this.orders.createWalkIn(user.id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.ORDERS.CANCEL)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.cancelOrder(id, user.id, dto.reason || 'Staff cancellation', {
      refundMethod: dto.refundMethod,
      restockingFeeBps: dto.restockingFeeBps,
    });
  }
}
