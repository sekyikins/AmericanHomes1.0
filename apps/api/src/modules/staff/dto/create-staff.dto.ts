import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ description: 'Staff member full name', example: 'Kwame Mensah' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Staff phone number', example: '+233241234567' })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ description: 'Staff email address for portal login', example: 'kwame@americanhomes.gh' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Initial password (min 8 chars)', example: 'StaffPass@2026' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ description: 'Staff job title', example: 'Warehouse Officer' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Initial permission group ID', example: 'grp-warehouse' })
  @IsOptional()
  @IsString()
  permissionGroupId?: string;

  @ApiPropertyOptional({ description: 'Multiple permission group IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionGroupIds?: string[];

  @ApiPropertyOptional({ description: 'Restrict financial visibility (Owner-only control)', default: false })
  @IsOptional()
  @IsBoolean()
  restrictFinancials?: boolean;
}
