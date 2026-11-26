import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RecordReceiptLineDto } from './dto/receipt-line.dto';
import { StartReceivingSessionDto } from './dto/start-session.dto';
import { ReceivingService } from './receiving.service';

@Controller('receiving')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Post('sessions')
  @RequirePermission(PERMISSIONS.RECEIVING.MANAGE)
  startSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartReceivingSessionDto) {
    return this.receiving.startSession(user.id, dto);
  }

  @Get('sessions')
  @RequirePermission(PERMISSIONS.RECEIVING.VIEW)
  listSessions() {
    return this.receiving.listSessions();
  }

  @Get('sessions/:id')
  @RequirePermission(PERMISSIONS.RECEIVING.VIEW)
  findSession(@Param('id') id: string) {
    return this.receiving.findSession(id);
  }

  @Post('sessions/:id/lines')
  @RequirePermission(PERMISSIONS.RECEIVING.MANAGE)
  recordLine(
    @Param('id') id: string,
    @Body() dto: RecordReceiptLineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receiving.recordLine(id, dto, user.id);
  }

  @Post('discrepancies/:id/resolve')
  @RequirePermission(PERMISSIONS.RECEIVING.RESOLVE_DISCREPANCY)
  resolveDiscrepancy(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { resolution: string; notes?: string },
  ) {
    return this.receiving.resolveDiscrepancy(id, user.id, body.resolution, body.notes);
  }

  @Post('sessions/:id/close')
  @RequirePermission(PERMISSIONS.RECEIVING.MANAGE)
  closeSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiving.closeSession(id, user.id);
  }

  @Post('lines/:lineId/create-product-draft')
  @RequirePermission(PERMISSIONS.RECEIVING.MANAGE)
  createProductDraftFromLine(
    @Param('lineId') lineId: string,
    @Body() dto: { category?: string; brand?: string; condition?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receiving.createProductDraftFromLine(lineId, dto, user.id);
  }
}
