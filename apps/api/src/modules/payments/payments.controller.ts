import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.VIEW)
  listAll() {
    return this.payments.listAll();
  }

  @Post('initialize')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  initialize(@Body() dto: InitializePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.initializePayment(dto, user.id);
  }

  @Get('verify/:reference')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  verify(@Param('reference') reference: string) {
    return this.payments.verifyPayment(reference);
  }

  @Get('exceptions')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.VIEW)
  exceptions() {
    return this.payments.getExceptions();
  }

  @Post('manual')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.RECORD_MANUAL)
  manual(@Body() dto: ManualPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.recordManualPayment(dto, user.id);
  }

  @Post(':id/approve')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.APPROVE_MANUAL)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.approveManualPayment(id, user.id, user.isOwner);
  }

  @Post(':id/reverse')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.PAYMENTS.PROCESS_REFUND)
  reverse(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.reversePayment(id, user.id, dto.reason || 'Staff correction');
  }

  @Post('webhook')
  webhook(@Body() payload: unknown, @Headers('x-paystack-signature') signature = '') {
    return this.payments.handleWebhook(payload, signature);
  }
}
