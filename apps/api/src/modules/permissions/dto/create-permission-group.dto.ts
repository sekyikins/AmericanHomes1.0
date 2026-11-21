import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionGroupDto {
  @ApiProperty({ description: 'Permission group name', example: 'Warehouse Supervisors' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Group description', example: 'Can receive shipments and approve stock adjustments' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String], description: 'List of permission codes', example: ['receiving.manage', 'inventory.adjust'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[] = [];
}
