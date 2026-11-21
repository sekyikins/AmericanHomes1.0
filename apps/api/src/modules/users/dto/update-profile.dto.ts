import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Customer full name', example: 'Abena Osei' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Customer email address', example: 'abena@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
