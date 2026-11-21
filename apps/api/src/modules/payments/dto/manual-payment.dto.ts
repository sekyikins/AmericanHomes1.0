import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ManualPaymentDto {
  @ApiProperty({ description: 'Order ID', example: 'ord-001' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Amount in pesewas/cents', example: 350000, minimum: 1 })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({ description: 'Payment method (CASH, BANK_TRANSFER, MOMO)', example: 'CASH' })
  @IsNotEmpty()
  @IsString()
  method!: string;

  @ApiPropertyOptional({ description: 'External receipt or transfer reference', example: 'TXN-88912' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Payer full name' })
  @IsOptional()
  @IsString()
  payerName?: string;

  @ApiPropertyOptional({ description: 'Payer phone number' })
  @IsOptional()
  @IsString()
  payerPhone?: string;

  @ApiPropertyOptional({ description: 'Uploaded receipt/screenshot storage URL' })
  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @ApiPropertyOptional({ description: 'Staff notes', example: 'Paid at East Legon desk' })
  @IsOptional()
  @IsString()
  notes?: string;
}
