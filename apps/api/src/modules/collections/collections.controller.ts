import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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

  @Post()
  @RequirePermission(PERMISSIONS.COLLECTIONS.MANAGE)
  record(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordCollectionDto) {
    return this.collections.recordCollection(user.id, dto, user.isOwner);
  }
}
