import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';

@Injectable()
export class StocktakesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.stocktake.findMany({
      include: { lines: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  create(dto: CreateStocktakeDto) {
    return this.prisma.stocktake.create({ data: { reference: dto.reference } });
  }

  async recordLines(
    stocktakeId: string,
    staffId: string,
    lines: Array<{ variantId: string; countedQty: number; notes?: string }>,
  ) {
    const st = await this.prisma.stocktake.findUnique({ where: { id: stocktakeId } });
    if (!st) throw new NotFoundException(`Stocktake ${stocktakeId} not found`);

    const created = [];
    for (const line of lines) {
      const balance = await this.inventory.getBalance(line.variantId);
      const difference = line.countedQty - balance.physical;
      const saved = await this.prisma.stocktakeLine.create({
        data: {
          stocktakeId,
          variantId: line.variantId,
          countedQty: line.countedQty,
          systemQty: balance.physical,
          difference,
          notes: line.notes,
        },
      });
      created.push(saved);
    }

    await this.prisma.stocktake.update({
      where: { id: stocktakeId },
      data: { status: 'SUBMITTED', submittedBy: staffId },
    });
    return created;
  }

  async proposeAdjustment(
    staffId: string,
    dto: { stocktakeId?: string; variantId: string; quantity: number; reason: string },
  ) {
    const balance = await this.inventory.getBalance(dto.variantId);
    const thresholdSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'STOCK_ADJUSTMENT_THRESHOLD_QTY' },
    });
    const threshold = thresholdSetting ? Number(thresholdSetting.value) : 0;

    const proposal = await this.prisma.adjustmentProposal.create({
      data: {
        stocktakeId: dto.stocktakeId,
        variantId: dto.variantId,
        previousQty: balance.physical,
        quantity: dto.quantity,
        proposedQty: balance.physical + dto.quantity,
        reason: dto.reason,
        initiatedBy: staffId,
        status: Math.abs(dto.quantity) <= threshold && threshold > 0 ? 'APPROVED' : 'PENDING',
        ...(Math.abs(dto.quantity) <= threshold && threshold > 0
          ? { approvedBy: staffId, resolvedAt: new Date() }
          : {}),
      },
    });

    if (proposal.status === 'APPROVED') {
      await this.inventory.applyAdjustment(dto.variantId, dto.quantity, dto.reason, staffId);
    }

    await this.audit.record({
      actorId: staffId,
      action: 'STOCK_ADJUSTMENT_PROPOSED',
      entityType: 'AdjustmentProposal',
      entityId: proposal.id,
      after: { variantId: dto.variantId, quantity: dto.quantity, status: proposal.status },
    });
    return proposal;
  }

  async approveAdjustment(id: string, staffId: string, isOwner = false) {
    const proposal = await this.prisma.adjustmentProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException(`AdjustmentProposal ${id} not found`);
    if (!isOwner && proposal.initiatedBy === staffId) {
      throw new ForbiddenException('Self-approval is prohibited for stock adjustments');
    }
    await this.inventory.applyAdjustment(proposal.variantId, proposal.quantity, proposal.reason, staffId);
    const updated = await this.prisma.adjustmentProposal.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: staffId, resolvedAt: new Date() },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'STOCK_ADJUSTMENT_APPROVED',
      entityType: 'AdjustmentProposal',
      entityId: id,
      before: { status: proposal.status },
      after: { status: 'APPROVED', quantity: proposal.quantity },
    });
    return updated;
  }

  async rejectAdjustment(id: string, staffId: string, reason: string) {
    const proposal = await this.prisma.adjustmentProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException(`AdjustmentProposal ${id} not found`);
    const updated = await this.prisma.adjustmentProposal.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: staffId, rejectionReason: reason, resolvedAt: new Date() },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'STOCK_ADJUSTMENT_REJECTED',
      entityType: 'AdjustmentProposal',
      entityId: id,
      after: { status: 'REJECTED', reason },
    });
    return updated;
  }
}
