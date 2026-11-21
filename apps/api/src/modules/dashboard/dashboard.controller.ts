import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('staff/dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    if (user.role !== 'STAFF') {
      throw new ForbiddenException('Staff access required');
    }
    return this.dashboard.getSummary(Boolean(user.restrictFinancials && !user.isOwner));
  }
}
