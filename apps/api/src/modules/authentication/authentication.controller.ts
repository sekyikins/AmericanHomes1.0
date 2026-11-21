import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthenticationService } from './authentication.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly auth: AuthenticationService) {}

  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('staff-login')
  staffLogin(@Body() dto: StaffLoginDto) {
    return this.auth.staffLogin(dto);
  }

  @Post('staff-mfa/setup')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupMfa(user.id);
  }

  @Post('staff-mfa/enable')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body('code') code: string) {
    return this.auth.enableMfa(user.id, code);
  }

  @Post('staff-change-password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.auth.changeStaffPassword(user.id, currentPassword, newPassword);
  }

  @Post('revoke-other-sessions')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.revokeOtherSessions(user.id, user.role ?? 'CUSTOMER');
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
