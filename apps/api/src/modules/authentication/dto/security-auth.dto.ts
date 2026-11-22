import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EnableMfaDto {
  @ApiProperty({ description: '6-digit TOTP verification code', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'MFA code must be a 6-digit number' })
  code!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: 'New password (min 8 chars)' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128)
  newPassword!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Staff email address' })
  @IsString()
  @IsNotEmpty()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'Expiring password reset token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (min 8 chars)' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128)
  newPassword!: string;
}
