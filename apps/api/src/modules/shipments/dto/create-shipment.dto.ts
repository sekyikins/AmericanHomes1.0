import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty({ description: 'Shipment reference code', example: 'SHP-2026-014' })
  @IsNotEmpty()
  @IsString()
  reference!: string;

  @ApiProperty({ description: 'Freight provider or shipper name', example: 'Maersk Accra Container' })
  @IsNotEmpty()
  @IsString()
  providerName!: string;

  @ApiPropertyOptional({ description: 'Estimated arrival date (ISO)', example: '2026-12-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  estimatedArrival?: string;

  @ApiPropertyOptional({ description: 'Shipment notes', example: '40ft HQ container from Savannah' })
  @IsOptional()
  @IsString()
  notes?: string;
}
