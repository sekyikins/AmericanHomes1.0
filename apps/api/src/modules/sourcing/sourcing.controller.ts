import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SourcingService } from './sourcing.service';

@Controller('sourcing')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class SourcingController {
  constructor(private readonly sourcing: SourcingService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_SOURCING)
  findAll() {
    return this.sourcing.findAll();
  }

  @Post('groups')
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_SOURCING)
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { name: string; requestIds: string[] },
  ) {
    return this.sourcing.createGroup(dto.name, dto.requestIds ?? [], user.id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_SOURCING)
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { shipmentId: string; groupId?: string; description: string; quantity: number },
  ) {
    return this.sourcing.createSourcingItem(dto, user.id);
  }

  @Post(':id/confirm-provider')
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_SOURCING)
  confirmProvider(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('providerRef') providerRef?: string,
  ) {
    return this.sourcing.confirmByProvider(id, user.id, providerRef);
  }
}
