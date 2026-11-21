import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CollectionLineInputDto {
  @ApiProperty({ description: 'OrderLine ID' })
  @IsNotEmpty()
  @IsString()
  orderLineId!: string;

  @ApiProperty({ description: 'Quantity collected', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class RecordCollectionDto {
  @ApiProperty({ description: 'Order ID being collected', example: 'ord-001' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiPropertyOptional({ type: [CollectionLineInputDto], description: 'Line-level quantities for partial collection' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionLineInputDto)
  lines?: CollectionLineInputDto[];

  @ApiPropertyOptional({ description: 'Authorised representative name' })
  @IsOptional()
  @IsString()
  representativeName?: string;

  @ApiPropertyOptional({ description: 'Authorised representative phone' })
  @IsOptional()
  @IsString()
  representativePhone?: string;

  @ApiPropertyOptional({ description: 'Whether customer-phone OTP verified the representative' })
  @IsOptional()
  @IsBoolean()
  representativeOtpVerified?: boolean;

  @ApiPropertyOptional({ description: 'Manager ID approving representative authorization' })
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @ApiPropertyOptional({ description: 'Manager ID authorizing unpaid balance collection exception' })
  @IsOptional()
  @IsString()
  unpaidExceptionApprovedBy?: string;

  @ApiPropertyOptional({ description: 'Collection handover notes', example: 'Collected by customer in person' })
  @IsOptional()
  @IsString()
  notes?: string;
}
