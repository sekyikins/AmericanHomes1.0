import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OwnerOnly, OwnerOnlyGuard } from '../../common/guards/owner-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { GovernanceService } from './governance.service';

@Controller('governance')
export class GovernanceController {
  constructor(private readonly gov: GovernanceService) {}

  @Get('announcements/public')
  listPublicAnnouncements() {
    return this.gov.listAnnouncements(true);
  }

  @Get('announcements')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.VIEW)
  listAllAnnouncements() {
    return this.gov.listAnnouncements(false);
  }

  @Post('announcements')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.PUBLISH)
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { title: string; body: string },
  ) {
    return this.gov.createAnnouncement(user.id, dto);
  }

  @Post('announcements/:id/publish')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.PUBLISH)
  publishAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('publish') publish = true,
  ) {
    return this.gov.publishAnnouncement(id, user.id, Boolean(publish));
  }

  @Get('incidents')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.INVENTORY.VIEW_STOCK)
  listIncidents() {
    return this.gov.listIncidents();
  }

  @Post('incidents')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.INVENTORY.VIEW_STOCK)
  createIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { title: string; severity?: string; notes?: string },
  ) {
    return this.gov.createIncident(user.id, dto);
  }

  @Post('incidents/:id/resolve')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.INVENTORY.APPROVE_ADJUSTMENT)
  resolveIncident(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('notes') notes?: string,
  ) {
    return this.gov.resolveIncident(id, user.id, notes);
  }

  @Get('polls')
  listPolls() {
    return this.gov.listPolls();
  }

  @Get('polls/customer')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listCustomerPolls(@CurrentUser() user: AuthenticatedUser) {
    return this.gov.listPolls(user.id, true);
  }

  @Post('polls')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.REQUESTS.REVIEW)
  createPoll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { title: string; description?: string; closesAt?: string },
  ) {
    return this.gov.createPoll(user.id, dto);
  }

  @Post('polls/:id/close')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.REQUESTS.REVIEW)
  closePoll(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gov.closePoll(id, user.id);
  }

  @Post('polls/:id/vote')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  votePoll(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('choice') choice = 'YES',
  ) {
    return this.gov.votePoll(id, user.id, choice);
  }

  @Get('payment-accounts')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.RECORD_MANUAL)
  getPaymentAccounts() {
    return this.gov.getPaymentAccounts();
  }

  @Get('settings')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, OwnerOnlyGuard)
  @OwnerOnly()
  listSettings() {
    return this.gov.listSettings();
  }

  @Patch('settings/:key')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, OwnerOnlyGuard)
  @OwnerOnly()
  updateSetting(
    @Param('key') key: string,
    @Body('value') value: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gov.updateSetting(key, value, user.id);
  }

  @Post('uploads')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  upload(@Body() dto: UploadEvidenceDto) {
    return this.gov.uploadEvidenceBase64(dto);
  }

  @Get('staff-reports')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.STAFF_REPORTS.VIEW)
  listStaffReports() {
    return this.gov.listStaffReports();
  }

  @Post('staff-reports')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  createStaffReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      title: string;
      category?: string;
      description: string;
      isAnonymous?: boolean;
      requestedChanges?: { name?: string; email?: string; phone?: string };
    },
  ) {
    return this.gov.createStaffReport(user.id, user.role, dto);
  }

  @Post('staff-reports/:id/act')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  actOnStaffReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { action: 'ADDRESSED' | 'DECLINED'; resolution?: string },
  ) {
    return this.gov.actOnStaffReport(id, user, dto);
  }
}
