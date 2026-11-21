import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Expense description', example: 'Container clearing fee' })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Amount in pesewas/cents', example: 450000 })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({ description: 'Expense category', example: 'Shipment' })
  @IsNotEmpty()
  @IsString()
  category!: string;

  @ApiProperty({ description: 'ISO date of expense', example: '2026-11-20' })
  @IsDateString()
  date!: string;
}
