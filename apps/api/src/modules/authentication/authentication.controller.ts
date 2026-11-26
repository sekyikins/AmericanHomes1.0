import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthenticationService } from './authentication.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  EnableMfaDto,
  RequestPasswordResetDto,
} from './dto/security-auth.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

function setSessionCookie(res: Response, token: string, role: 'STAFF' | 'CUSTOMER'): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = role === 'STAFF' ? 'ah_staff_session' : 'ah_customer_session';
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly auth: AuthenticationService) {}

  @Post('request-otp')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Post('verify-otp')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyOtp(dto);
    if (result.verified && result.token) {
      setSessionCookie(res, result.token, 'CUSTOMER');
    }
    return result;
  }

  @Post('staff-login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async staffLogin(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.staffLogin(dto);
    if (result.token) {
      setSessionCookie(res, result.token, 'STAFF');
    }
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('ah_session', { path: '/' });
    res.clearCookie('ah_staff_session', { path: '/' });
    res.clearCookie('ah_customer_session', { path: '/' });
    return { loggedOut: true };
  }

  @Post('staff-reset-password/request')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  requestStaffPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestStaffPasswordReset(dto.email);
  }

  @Post('staff-reset-password/confirm')
  confirmStaffPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmStaffPasswordReset(dto.token, dto.newPassword);
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
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnableMfaDto) {
    return this.auth.enableMfa(user.id, dto.code);
  }

  @Post('staff-change-password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changeStaffPassword(user.id, dto.currentPassword, dto.newPassword);
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
