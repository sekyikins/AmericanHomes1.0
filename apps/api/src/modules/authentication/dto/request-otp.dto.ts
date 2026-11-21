import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ description: 'Customer phone number in E.164 format', example: '+233241234567' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'Invalid phone number format' })
  phone!: string;

  @ApiPropertyOptional({ enum: ['signin', 'signup'], default: 'signin' })
  @IsOptional()
  @IsIn(['signin', 'signup'])
  mode?: 'signin' | 'signup';
}
