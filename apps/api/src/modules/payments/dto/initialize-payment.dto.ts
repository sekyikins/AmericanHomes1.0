import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({ description: 'Order ID to pay for', example: 'ord-001' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Amount in pesewas/cents', example: 350000, minimum: 1 })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({ description: 'Preferred Paystack channel', example: 'paystack_momo' })
  @IsOptional()
  @IsString()
  channel?: string;
}
