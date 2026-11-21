import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AllocationsService } from './allocations.service';

@Controller('allocations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class AllocationsController {
  constructor(private readonly allocations: AllocationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_ALLOCATIONS)
  findAll() {
    return this.allocations.findAll();
  }

  @Post()
  @RequirePermission(PERMISSIONS.REQUESTS.MANAGE_ALLOCATIONS)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { requestId: string; variantId: string; quantity?: number; notes?: string },
  ) {
    return this.allocations.createOffer(user.id, dto);
  }

  @Post(':id/respond')
  respond(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('accept') accept: boolean,
  ) {
    return this.allocations.respondToOffer(id, user.id, Boolean(accept));
  }
}
