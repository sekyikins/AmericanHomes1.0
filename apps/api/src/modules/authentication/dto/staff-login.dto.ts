import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({ description: 'Staff account email address', example: 'owner@americanhomes.gh' })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Staff account password', example: 'Owner@AmericanHomes2026!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ description: '6-digit MFA TOTP code (required for Owner/Manager with MFA enabled)', example: '123456' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}
