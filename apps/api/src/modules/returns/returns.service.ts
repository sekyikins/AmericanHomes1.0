import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateReturnDto } from './dto/create-return.dto';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  findAll() {
    return this.prisma.returnRequest.findMany({
      include: {
        lines: true,
        order: {
          include: {
            lines: { include: { variant: { include: { product: true } } } },
            customer: { include: { user: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submit(userId: string, dto: CreateReturnDto, userRole?: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { OR: [{ id: dto.orderId }, { reference: dto.orderId }] },
      include: { lines: true, customer: true },
    });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    if (userRole !== 'STAFF' && order.customer?.userId !== userId) {
      throw new ForbiddenException('You can only submit return requests for your own orders');
    }

    const firstCollection = await this.prisma.collectionRecord.findFirst({
      where: { orderId: order.id, collectedAt: { not: null } },
      orderBy: { collectedAt: 'asc' },
    });
    if (userRole !== 'STAFF' && !firstCollection?.collectedAt) {
      throw new BadRequestException('Order must be collected before a return can be requested');
    }

    const firstCollectedAt = firstCollection?.collectedAt ?? order.createdAt;
    const daysSinceCollection = (Date.now() - firstCollectedAt.getTime()) / (1000 * 60 * 60 * 24);
    const withinSevenDays = daysSinceCollection <= 7;

    const isDisclosedDefect =
      order.disclosedDefectsAcknowledged &&
      dto.reason.toLowerCase().includes('disclosed');

    const linesToCreate: Array<{ variantId: string; quantity: number }> = [];
    if (dto.lines && dto.lines.length > 0) {
      const purchasedByVariant = new Map<string, number>();
      for (const ol of order.lines) {
        purchasedByVariant.set(ol.variantId, (purchasedByVariant.get(ol.variantId) ?? 0) + ol.quantity);
      }
      const existingReturns = await this.prisma.returnRequest.findMany({
        where: { orderId: order.id, status: { in: ['PENDING', 'APPROVED'] } },
        include: { lines: true },
      });
      const returnedByVariant = new Map<string, number>();
      for (const r of existingReturns) {
        for (const rl of r.lines) {
          returnedByVariant.set(rl.variantId, (returnedByVariant.get(rl.variantId) ?? 0) + rl.quantity);
        }
      }
      for (const reqLine of dto.lines) {
        const purchased = purchasedByVariant.get(reqLine.variantId) ?? 0;
        if (purchased === 0) {
          throw new BadRequestException(`Variant ${reqLine.variantId} is not part of this order`);
        }
        const alreadyReturned = returnedByVariant.get(reqLine.variantId) ?? 0;
        const maxReturnable = Math.max(0, purchased - alreadyReturned);
        if (reqLine.quantity > maxReturnable) {
          throw new BadRequestException(
            `Return quantity (${reqLine.quantity}) exceeds remaining returnable quantity (${maxReturnable})`,
          );
        }
        linesToCreate.push({ variantId: reqLine.variantId, quantity: reqLine.quantity });
      }
    }

    return this.prisma.returnRequest.create({
      data: {
        orderId: order.id,
        customerId: userId,
        reason: dto.reason,
        notes: dto.notes,
        firstCollectedAt,
        withinSevenDays,
        isDisclosedDefect,
        ...(linesToCreate.length > 0 ? { lines: { create: linesToCreate } } : {}),
      },
      include: { lines: true },
    });
  }

  async decide(
    id: string,
    staffId: string,
    dto: {
      approved: boolean;
      settlementType?: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
      refundAmountCents?: number;
      exchangeVariantId?: string;
      priceDiffCents?: number;
      disposition?: 'RESTOCK' | 'DISPOSE' | 'EXCHANGE';
      variantId?: string;
      quantity?: number;
      notes?: string;
    },
    isOwner = false,
  ) {
    const req = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { payments: true } }, lines: true },
    });
    if (!req) throw new NotFoundException(`ReturnRequest ${id} not found`);

    if (!isOwner && req.customerId === staffId) {
      throw new ForbiddenException('Self-approval is prohibited for return settlements');
    }

    if (!dto.approved) {
      const rejected = await this.prisma.returnRequest.update({
        where: { id },
        data: { status: 'REJECTED', reviewedBy: staffId, reviewedAt: new Date(), notes: dto.notes },
      });
      await this.audit.record({
        actorId: staffId,
        approverId: staffId,
        action: 'RETURN_REJECTED',
        entityType: 'ReturnRequest',
        entityId: id,
        after: { status: 'REJECTED', notes: dto.notes },
      });
      return rejected;
    }

    if (req.isDisclosedDefect && !dto.notes) {
      throw new BadRequestException(
        'Previously disclosed defects require an explicit management exception reason',
      );
    }

    // Settlement creation (§4.7.3 & §4.5.3)
    if (dto.settlementType === 'REFUND' && dto.refundAmountCents && dto.refundAmountCents > 0) {
      const verifiedPayment = req.order.payments.find((p) => p.status === 'VERIFIED');
      if (verifiedPayment) {
        await this.prisma.refund.create({
          data: {
            paymentId: verifiedPayment.id,
            amountCents: dto.refundAmountCents,
            reason: `Return #${id}: ${req.reason}`,
            status: 'APPROVED',
          },
        });
      }
    } else if (dto.settlementType === 'STORE_CREDIT' && dto.refundAmountCents && req.order.customerId) {
      await this.prisma.storeCreditEntry.create({
        data: {
          customerId: req.order.customerId,
          returnRequestId: id,
          amountCents: dto.refundAmountCents,
          remainingCents: dto.refundAmountCents,
          status: 'ACTIVE',
          issuedBy: staffId,
          notes: dto.notes,
        },
      });
    }

    // Returned goods enter unavailable inspection first; only RESTOCK disposition makes available
    if (dto.disposition === 'RESTOCK' && dto.variantId && dto.quantity && dto.quantity > 0) {
      await this.inventory.applyAdjustment(dto.variantId, dto.quantity, `RETURN_RESTOCK:${id}`, staffId);
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        settlementType: dto.settlementType,
        refundAmountCents: dto.refundAmountCents,
        exchangeVariantId: dto.exchangeVariantId,
        priceDiffCents: dto.priceDiffCents,
        approvedBy: staffId,
        approvedAt: new Date(),
        reviewedBy: staffId,
        reviewedAt: new Date(),
        notes: dto.notes,
      },
    });

    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'RETURN_APPROVED',
      entityType: 'ReturnRequest',
      entityId: id,
      after: {
        settlementType: dto.settlementType,
        refundAmountCents: dto.refundAmountCents,
        disposition: dto.disposition,
      },
    });
    return updated;
  }
}
