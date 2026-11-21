import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification title', example: 'Order ready for pickup' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Notification message body', example: 'Your order is ready at East Legon warehouse.' })
  @IsNotEmpty()
  @IsString()
  body!: string;

  @ApiProperty({ description: 'Notification type', example: 'ORDER_READY' })
  @IsNotEmpty()
  @IsString()
  type!: string;

  @ApiPropertyOptional({ description: 'Related entity ID', example: 'ord-001' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
