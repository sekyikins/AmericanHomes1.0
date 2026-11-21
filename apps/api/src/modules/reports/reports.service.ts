import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildPdfBase64, buildXlsxBase64 } from './export-formatters';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listExportJobs() {
    return this.prisma.exportJob.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getFinancialSummary() {
    const [orders, verifiedPayments, refunds, shipmentExpenses, generalExpenses] =
      await Promise.all([
        this.prisma.salesOrder.aggregate({
          where: { orderStatus: { not: 'CANCELLED' } },
          _sum: { totalCents: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'VERIFIED' },
          _sum: { amountCents: true },
        }),
        this.prisma.refund.aggregate({
          where: { status: { in: ['APPROVED', 'PROCESSED'] } },
          _sum: { amountCents: true },
        }),
        this.prisma.shipmentExpense.aggregate({ _sum: { amountCents: true } }),
        this.prisma.generalExpense.aggregate({ _sum: { amountCents: true } }),
      ]);

    const salesValueCents = orders._sum.totalCents ?? 0;
    const verifiedPaymentsCents = verifiedPayments._sum.amountCents ?? 0;
    return {
      salesValueCents,
      verifiedPaymentsCents,
      outstandingBalancesCents: Math.max(0, salesValueCents - verifiedPaymentsCents),
      refundsCents: refunds._sum.amountCents ?? 0,
      shipmentExpensesCents: shipmentExpenses._sum.amountCents ?? 0,
      generalExpensesCents: generalExpenses._sum.amountCents ?? 0,
      generatedAt: new Date().toISOString(),
    };
  }

  async getShipmentPerformance(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        expenses: true,
        manifestRevisions: { include: { items: true }, orderBy: { revision: 'desc' }, take: 1 },
        receivingSessions: { include: { lines: true } },
      },
    });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} not found`);

    const manifestItems = shipment.manifestRevisions[0]?.items ?? [];
    const expectedUnits = manifestItems.reduce((s, i) => s + i.quantity, 0);
    const receivedUnits = shipment.receivingSessions.flatMap((s) => s.lines).reduce((s, l) => s + l.receivedQty, 0);
    const shipmentExpensesCents = shipment.expenses.reduce((s, e) => s + e.amountCents, 0);
    const hasIncompleteCosts = manifestItems.some((i) => i.unitCostCents <= 0) || manifestItems.length === 0;
    const estimatedAcquisitionCents = manifestItems.reduce((s, i) => s + i.quantity * i.unitCostCents, 0);

    return {
      shipmentId: shipment.id,
      reference: shipment.reference,
      expectedUnits,
      receivedUnits,
      shipmentExpensesCents,
      estimatedAcquisitionCents,
      isEstimatedProfit: true,
      costCompletenessWarning: hasIncompleteCosts
        ? 'Acquisition cost data is incomplete; profitability figures are estimates only.'
        : 'Estimated shipment performance based on recorded manifest costs and direct shipment expenses.',
      generatedAt: new Date().toISOString(),
    };
  }

  async generateExport(
    actor: AuthenticatedUser,
    dto: { type: string; format: 'CSV' | 'XLSX' | 'PDF'; from?: string; to?: string },
  ) {
    const typeUpper = (dto.type || 'INVENTORY').toUpperCase();
    const requiredEntityPermission =
      typeUpper === 'ORDERS'
        ? PERMISSIONS.ORDERS.VIEW
        : typeUpper === 'EXPENSES'
          ? PERMISSIONS.EXPENSES.VIEW
          : typeUpper === 'AUDIT'
            ? PERMISSIONS.AUDIT.VIEW
            : PERMISSIONS.INVENTORY.VIEW_STOCK;

    if (!actor.isOwner && !(actor.permissions ?? []).includes(requiredEntityPermission)) {
      throw new ForbiddenException(
        `Missing entity permission (${requiredEntityPermission}) to export ${typeUpper} data`,
      );
    }

    const generatedAt = new Date().toISOString();
    const period = `${dto.from ?? 'ALL'} to ${dto.to ?? 'PRESENT'}`;
    const fromDate = dto.from ? new Date(dto.from) : undefined;
    const toDate = dto.to ? new Date(dto.to) : undefined;
    if (toDate && dto.to && dto.to.length <= 10) {
      toDate.setHours(23, 59, 59, 999);
    }
    const dateRange =
      fromDate || toDate
        ? {
            ...(fromDate && !Number.isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
            ...(toDate && !Number.isNaN(toDate.getTime()) ? { lte: toDate } : {}),
          }
        : undefined;

    let rows: Array<Record<string, unknown>> = [];
    if (typeUpper === 'ORDERS') {
      rows = await this.prisma.salesOrder.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        take: 500,
        orderBy: { createdAt: 'desc' },
      });
    } else if (typeUpper === 'EXPENSES') {
      rows = await this.prisma.generalExpense.findMany({
        where: dateRange ? { date: dateRange } : undefined,
        take: 500,
        orderBy: { date: 'desc' },
      });
    } else if (typeUpper === 'AUDIT') {
      rows = await this.prisma.auditEvent.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        take: 500,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      rows = await this.prisma.stockLot.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        take: 500,
        include: { variant: true },
      });
    }

    const headers = rows.length > 0 ? Object.keys(rows[0]) : ['empty'];
    const stringifyCell = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };
    const tableRows = rows.map((r) => headers.map((h) => stringifyCell(r[h])));

    const format = (dto.format || 'CSV').toUpperCase() as 'CSV' | 'XLSX' | 'PDF';
    const metaLines = [
      `AmericanHomes Export | Type: ${typeUpper}`,
      `Period: ${period} | Generated: ${generatedAt}`,
    ];
    const filename = `${typeUpper.toLowerCase()}-report.${format.toLowerCase()}`;

    let content: string | undefined;
    let contentBase64: string | undefined;
    let mimeType = 'text/csv;charset=utf-8';

    if (format === 'XLSX') {
      contentBase64 = buildXlsxBase64(typeUpper, metaLines, headers, tableRows);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (format === 'PDF') {
      contentBase64 = buildPdfBase64(`AmericanHomes ${typeUpper} Report`, metaLines, headers, tableRows);
      mimeType = 'application/pdf';
    } else {
      const csvLines = [
        `# ${metaLines.join(' | ')}`,
        headers.join(','),
        ...tableRows.map((row) => row.map((cell) => JSON.stringify(cell)).join(',')),
      ];
      content = csvLines.join('\n');
    }

    const job = await this.prisma.exportJob.create({
      data: {
        type: `${typeUpper}:${format}`,
        status: 'COMPLETED',
        requestedBy: actor.id,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      action: 'REPORT_EXPORTED',
      entityType: 'ExportJob',
      entityId: job.id,
      after: { type: typeUpper, format, period, rowCount: rows.length },
    });

    return {
      job,
      metadata: { generatedAt, period, format, rowCount: rows.length },
      filename,
      mimeType,
      ...(content !== undefined ? { content } : {}),
      ...(contentBase64 !== undefined ? { contentBase64 } : {}),
    };
  }
}
