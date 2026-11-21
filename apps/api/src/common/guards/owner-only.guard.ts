import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export const OWNER_ONLY_KEY = 'owner_only';
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);

@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isOwnerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isOwnerOnly) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user?.isOwner) {
      throw new ForbiddenException('Owner-exclusive permission required');
    }
    return true;
  }
}
