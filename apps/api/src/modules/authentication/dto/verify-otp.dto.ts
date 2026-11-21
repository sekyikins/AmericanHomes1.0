import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Customer phone number', example: '+233241234567' })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiProperty({ description: '4 to 8 digit verification code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  @Length(4, 8)
  otp!: string;

  @ApiPropertyOptional({ enum: ['signin', 'signup'], default: 'signin' })
  @IsOptional()
  @IsIn(['signin', 'signup'])
  mode?: 'signin' | 'signup';

  @ApiPropertyOptional({ description: 'Customer full name for registration' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Optional email address for registration' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Opt-in for WhatsApp notifications' })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
