import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('exports')
  @RequirePermission(PERMISSIONS.REPORTS.VIEW)
  listExports() {
    return this.reports.listExportJobs();
  }

  @Get('financial-summary')
  @RequirePermission(PERMISSIONS.REPORTS.VIEW)
  getFinancialSummary() {
    return this.reports.getFinancialSummary();
  }

  @Get('shipments/:shipmentId/performance')
  @RequirePermission(PERMISSIONS.REPORTS.VIEW)
  getShipmentPerformance(@Param('shipmentId') shipmentId: string) {
    return this.reports.getShipmentPerformance(shipmentId);
  }

  @Post('exports')
  @RequirePermission(PERMISSIONS.REPORTS.EXPORT)
  generateExport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { type: string; format: 'CSV' | 'XLSX' | 'PDF'; from?: string; to?: string },
  ) {
    return this.reports.generateExport(user, dto);
  }
}
