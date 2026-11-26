import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CollectionsService } from './collections.service';
import { RecordCollectionDto } from './dto/record-collection.dto';

@Controller('collections')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  findAll() {
    return this.collections.findAll();
  }

  @Get('eligible-orders')
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  findEligibleOrders() {
    return this.collections.findEligibleOrders();
  }

  @Post('orders/:orderId/send-release-pin')
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  sendReleasePin(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collections.sendReleasePin(orderId, user.id);
  }

  @Post('orders/:orderId/verify-release-pin')
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  verifyReleasePin(
    @Param('orderId') orderId: string,
    @Body() dto: { pin: string },
  ) {
    return this.collections.verifyReleasePin(orderId, dto.pin);
  }

  @Post()
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  record(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordCollectionDto) {
    return this.collections.recordCollection(user.id, dto, user.isOwner);
  }
}
