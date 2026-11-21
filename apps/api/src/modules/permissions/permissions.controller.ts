import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('groups')
  @RequirePermission(PERMISSIONS.PERMISSIONS.VIEW)
  findAll() {
    return this.permissions.findAllGroups();
  }

  @Get('groups/:id')
  @RequirePermission(PERMISSIONS.PERMISSIONS.VIEW)
  findOne(@Param('id') id: string) {
    return this.permissions.findGroupById(id);
  }

  @Post('groups')
  @RequirePermission(PERMISSIONS.PERMISSIONS.MANAGE)
  create(@Body() dto: CreatePermissionGroupDto) {
    return this.permissions.createGroup(dto);
  }

  @Patch('groups/:id')
  @RequirePermission(PERMISSIONS.PERMISSIONS.MANAGE)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePermissionGroupDto>) {
    return this.permissions.updateGroup(id, dto);
  }
}
