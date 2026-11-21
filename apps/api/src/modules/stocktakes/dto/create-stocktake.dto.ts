import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStocktakeDto {
  @ApiProperty({ description: 'Stocktake reference code', example: 'STK-2026-11' })
  @IsNotEmpty()
  @IsString()
  reference!: string;
}
