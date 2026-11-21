import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PaginationDto } from '../../common/utils/pagination';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('my')
  getMy(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.notifications.getMyNotifications(user.id, query);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: Partial<{
      productRequests: boolean;
      reservations: boolean;
      ordersPayments: boolean;
      availability: boolean;
      promotions: boolean;
    }>,
  ) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Post('whatsapp-consent')
  recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { granted: boolean; source?: string },
  ) {
    return this.notifications.recordWhatsAppConsent(user.id, Boolean(dto.granted), dto.source);
  }

  @Get('receipt/:orderId')
  getDigitalReceipt(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.getDigitalReceipt(orderId, user);
  }
}
