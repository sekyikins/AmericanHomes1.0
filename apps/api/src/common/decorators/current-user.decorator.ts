import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  phone?: string;
  email?: string | null;
  name?: string | null;
  role?: 'CUSTOMER' | 'STAFF';
  isOwner?: boolean;
  restrictFinancials?: boolean;
  permissions?: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);
