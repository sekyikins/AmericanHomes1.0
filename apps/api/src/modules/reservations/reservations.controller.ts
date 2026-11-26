import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationDto } from '../../common/utils/pagination';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { DeclineReservationDto } from './dto/decline-reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReservationDto) {
    return this.reservations.requestReservation(user.id, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.RESERVATIONS.VIEW)
  findAll(@Query() query: PaginationDto) {
    return this.reservations.findAll(query);
  }

  @Get('my')
  getMy(@CurrentUser() user: AuthenticatedUser) {
    return this.reservations.findByCustomer(user.id);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.RESERVATIONS.APPROVE)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservations.approveReservation(id, user.id);
  }

  @Post(':id/decline')
  @RequirePermission(PERMISSIONS.RESERVATIONS.APPROVE)
  decline(
    @Param('id') id: string,
    @Body() dto: DeclineReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservations.declineReservation(id, dto.reason ?? 'Declined by staff', user.id);
  }

  @Post(':id/cancel')
  cancelOwn(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservations.cancelOwnReservation(id, user.id);
  }

  @Post(':id/convert')
  convertToOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { notes?: string },
  ) {
    return this.reservations.convertToOrder(id, user, dto?.notes);
  }
}
