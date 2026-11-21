import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermission(PERMISSIONS.STAFF.VIEW)
  findAll() {
    return this.staff.findAll();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.STAFF.VIEW)
  findOne(@Param('id') id: string) {
    return this.staff.findById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.STAFF.CREATE)
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.create(dto, user.id, Boolean(user.isOwner));
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.STAFF.UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.update(id, dto, user.id, Boolean(user.isOwner));
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.STAFF.DEACTIVATE)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.deactivate(id, user.id, Boolean(user.isOwner));
  }
}
