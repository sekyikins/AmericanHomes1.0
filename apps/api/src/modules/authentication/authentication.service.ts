import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isOwnerGroupName } from '../../common/constants/permissions';
import { invalidateAuthCache } from '../../common/guards/auth.guard';
import { createHash, randomBytes } from 'crypto';
import { generateTotpCode, hashPassword, verifyPassword, verifyTotpCode } from '../../common/utils/password';
import { signSessionToken } from '../../common/utils/token';
import { PrismaService } from '../../database/prisma.service';
import { OtpService } from '../../integrations/otp/otp.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const MANAGER_PERMISSION_MARKERS = [
  'staff.manage',
  'permissions.manage',
  'payments.approve_manual',
  'payments.refund',
  'inventory.approve_adjustment',
  'reservations.approve',
  'catalogue.approve_price',
  'returns.approve',
  'orders.approve',
];

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

type PasswordResetEntry = {
  userId: string;
  expiresAt: number;
};

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);
  private readonly resetTokens = new Map<string, PasswordResetEntry>();

  constructor(
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(
    dto: RequestOtpDto,
  ): Promise<{ sent: boolean; accountExists?: boolean }> {
    const cleanPhone = dto.phone.replace(/\s+/g, '');
    let accountExists = true;
    if (process.env.DATABASE_URL) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
        include: { staff: true },
      });
      if (existing?.staff) {
        throw new BadRequestException(
          'This phone number is linked to a staff account. Please create an independent customer account using a separate personal phone number.',
        );
      }
      accountExists = Boolean(existing);
      if (dto.mode !== 'signup' && !existing) {
        return { sent: false, accountExists: false };
      }
    }
    await this.otpService.sendOtp(cleanPhone);
    return { sent: true, accountExists };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{
    verified: boolean;
    token: string;
    userId?: string;
    name?: string;
    email?: string | null;
    phone?: string;
  }> {
    const cleanPhone = dto.phone.replace(/\s+/g, '');
    const valid = await this.otpService.verifyOtp(cleanPhone, dto.otp);
    if (!valid) {
      return { verified: false, token: '' };
    }

    let userId = cleanPhone;
    let userName = dto.name?.trim() || undefined;
    let userEmail: string | null | undefined = dto.email?.trim()
      ? dto.email.trim().toLowerCase()
      : null;
    let sessionVersion = 1;

    if (process.env.DATABASE_URL) {
      let user = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
        include: { staff: true, customer: true },
      });

      if (user?.staff) {
        throw new UnauthorizedException(
          'Staff members must create an independent customer account using a separate personal phone number.',
        );
      }

      if (!user) {
        if (dto.mode !== 'signup') {
          throw new UnauthorizedException(
            'No account found for this phone number. Please sign up first.',
          );
        }
        user = await this.prisma.user.create({
          data: {
            phone: cleanPhone,
            name: dto.name?.trim() || null,
            email: dto.email?.trim() ? dto.email.trim().toLowerCase() : null,
            lastLoginAt: new Date(),
            customer: { create: {} },
          },
          include: { staff: true, customer: true },
        });
      } else {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            ...(dto.mode === 'signup' && dto.name?.trim() && !user.name
              ? { name: dto.name.trim() }
              : {}),
            ...(dto.mode === 'signup' && dto.email?.trim() && !user.email
              ? { email: dto.email.trim().toLowerCase() }
              : {}),
          },
          include: { staff: true, customer: true },
        });
      }
      userId = user.id;
      userName = user.name ?? undefined;
      userEmail = user.email;
      sessionVersion = user.sessionVersion ?? 1;
    }

    const secret =
      this.config.get<string>('auth.jwtSecret') ?? 'dev-jwt-secret-change-in-prod';
    const token = signSessionToken({ sub: userId, role: 'CUSTOMER', ver: sessionVersion }, secret);
    return {
      verified: true,
      token,
      userId,
      name: userName,
      email: userEmail,
      phone: cleanPhone,
    };
  }

  async staffLogin(dto: StaffLoginDto): Promise<{
    token: string;
    userId: string;
    name: string | null;
    email: string | null;
    phone: string;
    isOwner: boolean;
    mfaRequired?: boolean;
  }> {
    if (!process.env.DATABASE_URL) {
      throw new UnauthorizedException('Database not configured');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: {
        staff: {
          include: {
            groupAssignments: {
              include: {
                group: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user?.staff || !user.staff.isActive) {
      this.logger.warn(`[SECURITY] Failed staff login: inactive or unknown email=${dto.email}`);
      throw new UnauthorizedException('Invalid or inactive staff account');
    }
    if (!user.passwordHash || !verifyPassword(dto.password, user.passwordHash)) {
      this.logger.warn(`[SECURITY] Failed staff login: wrong password userId=${user.id}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const hasOwnerGroup = user.staff.groupAssignments.some((a) => isOwnerGroupName(a.group.name));
    const isOwner = user.staff.isOwner || hasOwnerGroup;
    const perms = user.staff.groupAssignments.flatMap((a) =>
      a.group.permissions.map((gp) => gp.permission.code),
    );
    const isPrivileged =
      isOwner || perms.some((p) => MANAGER_PERMISSION_MARKERS.includes(p));

    if (user.mfaEnabled && user.mfaSecret) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA verification code required');
      }
      if (!verifyTotpCode(user.mfaSecret, dto.mfaCode)) {
        this.logger.warn(`[SECURITY] Invalid MFA code on staff login userId=${user.id}`);
        throw new UnauthorizedException('Invalid MFA verification code');
      }
    } else if (isPrivileged && dto.mfaCode && user.mfaSecret) {
      if (!verifyTotpCode(user.mfaSecret, dto.mfaCode)) {
        this.logger.warn(`[SECURITY] Invalid MFA code on privileged login userId=${user.id}`);
        throw new UnauthorizedException('Invalid MFA verification code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const secret =
      this.config.get<string>('auth.jwtSecret') ?? 'dev-jwt-secret-change-in-prod';
    const token = signSessionToken(
      { sub: user.id, role: 'STAFF', ver: user.sessionVersion ?? 1 },
      secret,
    );
    return {
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isOwner,
    };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { staff: true } });
    if (!user?.staff) throw new UnauthorizedException('Staff account required');
    const secret = randomBytes(16).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    return {
      secret,
      sampleCode: generateTotpCode(secret),
      message: 'Verify with a 6-digit code via POST /auth/staff-mfa/enable to activate MFA.',
    };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('Run MFA setup first');
    if (!verifyTotpCode(user.mfaSecret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { mfaEnabled: true };
  }

  async changeStaffPassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('New password must be different from your current password');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { staff: true } });
    if (!user?.staff || !user.staff.isActive) {
      throw new UnauthorizedException('Active staff account required');
    }
    if (user.passwordHash && !verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(newPassword),
        sessionVersion: { increment: 1 },
      },
      select: { sessionVersion: true },
    });
    invalidateAuthCache(userId);
    await this.prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: 'STAFF_PASSWORD_CHANGED',
        entityType: 'User',
        entityId: userId,
      },
    });
    const secret =
      this.config.get<string>('auth.jwtSecret') ?? 'dev-jwt-secret-change-in-prod';
    const token = signSessionToken(
      { sub: userId, role: 'STAFF', ver: updatedUser.sessionVersion },
      secret,
    );
    return { updated: true, token };
  }

  async revokeOtherSessions(userId: string, role: 'CUSTOMER' | 'STAFF') {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    invalidateAuthCache(userId);
    await this.prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: 'OTHER_SESSIONS_REVOKED',
        entityType: 'User',
        entityId: userId,
      },
    });
    const secret =
      this.config.get<string>('auth.jwtSecret') ?? 'dev-jwt-secret-change-in-prod';
    const token = signSessionToken(
      { sub: userId, role, ver: updatedUser.sessionVersion },
      secret,
    );
    return { revoked: true, token };
  }

  async requestStaffPasswordReset(email: string): Promise<{ requested: boolean; expiresInMinutes: number }> {
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { staff: true },
    });
    if (user?.staff && user.staff.isActive) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      // Prune expired entries before adding
      const now = Date.now();
      for (const [k, entry] of this.resetTokens.entries()) {
        if (now > entry.expiresAt) this.resetTokens.delete(k);
      }
      this.resetTokens.set(tokenHash, {
        userId: user.id,
        expiresAt: now + RESET_TOKEN_TTL_MS,
      });
      await this.prisma.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'STAFF_PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
        },
      });
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[DEV] Staff password reset token generated for ${cleanEmail} (expires 15m)`);
      }
    }
    return { requested: true, expiresInMinutes: 15 };
  }

  async confirmStaffPasswordReset(rawToken: string, newPassword: string): Promise<{ reset: boolean }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');
    const entry = this.resetTokens.get(tokenHash);
    if (!entry || Date.now() > entry.expiresAt) {
      this.resetTokens.delete(tokenHash);
      this.logger.warn('[SECURITY] Invalid or expired staff password reset token');
      throw new UnauthorizedException('Invalid or expired password reset link');
    }
    this.resetTokens.delete(tokenHash);
    await this.prisma.user.update({
      where: { id: entry.userId },
      data: {
        passwordHash: hashPassword(newPassword),
        sessionVersion: { increment: 1 },
      },
    });
    invalidateAuthCache(entry.userId);
    await this.prisma.auditEvent.create({
      data: {
        actorId: entry.userId,
        action: 'STAFF_PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: entry.userId,
      },
    });
    return { reset: true };
  }
}
