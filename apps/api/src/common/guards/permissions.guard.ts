import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_IMPLIED_BY } from '../constants/permissions';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { PERMISSION_KEY } from '../decorators/permissions.decorator';

const FINANCIAL_CODES = new Set([
  'reports.view',
  'reports.export',
  'expenses.view',
  'expenses.manage',
  'payments.view',
]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user || user.role !== 'STAFF') {
      throw new ForbiddenException('Staff access required');
    }
    if (user.isOwner) {
      return true;
    }
    if (user.restrictFinancials && FINANCIAL_CODES.has(required)) {
      throw new ForbiddenException('Financial visibility is restricted for this account');
    }
    const impliedBy = PERMISSION_IMPLIED_BY[required] ?? [];
    const hasPermission =
      Boolean(user.permissions?.includes(required)) ||
      impliedBy.some((code) => Boolean(user.permissions?.includes(code)));
    if (!hasPermission) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}
