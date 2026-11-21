import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);
