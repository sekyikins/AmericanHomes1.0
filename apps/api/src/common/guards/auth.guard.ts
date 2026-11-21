import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { verifySessionToken } from '../utils/token';

const FINANCIAL_PERMISSION_PREFIXES = ['reports.', 'expenses.', 'payments.view'];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty bearer token');
    }

    const secret =
      this.config.get<string>('auth.jwtSecret') ?? 'dev-jwt-secret-change-in-prod';
    const payload = verifySessionToken(token, secret);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    let permissions: string[] = [];
    let isOwner = false;
    let restrictFinancials = false;
    let phone: string | undefined;
    let email: string | null | undefined;
    let name: string | null | undefined;

    if (process.env.DATABASE_URL) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, phone: true, email: true, name: true, sessionVersion: true },
      });
      if (!dbUser) {
        throw new UnauthorizedException('Account not found');
      }
      if (payload.ver !== undefined && payload.ver !== dbUser.sessionVersion) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }
      phone = dbUser.phone;
      email = dbUser.email;
      name = dbUser.name;
    }

    if (payload.role === 'STAFF' && process.env.DATABASE_URL) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: payload.sub },
        include: {
          groupAssignments: {
            include: {
              group: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException('Staff account is inactive or missing');
      }
      isOwner = staff.isOwner;
      restrictFinancials = staff.restrictFinancials;
      permissions = Array.from(
        new Set(
          staff.groupAssignments.flatMap((a) =>
            a.group.permissions.map((gp) => gp.permission.code),
          ),
        ),
      );
      if (restrictFinancials && !isOwner) {
        permissions = permissions.filter(
          (code) => !FINANCIAL_PERMISSION_PREFIXES.some((prefix) => code.startsWith(prefix)),
        );
      }
    }

    request.user = {
      id: payload.sub,
      phone,
      email,
      name,
      role: payload.role,
      isOwner,
      restrictFinancials,
      permissions,
    };
    return true;
  }
}
