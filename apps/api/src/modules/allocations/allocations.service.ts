import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class AllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.allocationOffer.findMany({
      include: { request: { include: { customer: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOfferWindowHours(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'ALLOCATION_OFFER_HOURS' },
    });
    const val = setting ? Number(setting.value) : NaN;
    return Number.isFinite(val) && val > 0 ? val : 24;
  }

  async createOffer(
    staffId: string,
    dto: { requestId: string; variantId: string; quantity?: number; notes?: string },
  ) {
    const request = await this.prisma.productRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException(`ProductRequest ${dto.requestId} not found`);

    const qty = dto.quantity ?? request.quantity ?? 1;
    const hours = await this.getOfferWindowHours();
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const offer = await this.prisma.allocationOffer.create({
      data: {
        requestId: dto.requestId,
        variantId: dto.variantId,
        quantity: qty,
        status: 'PENDING',
        expiresAt,
        notes: dto.notes,
      },
    });

    await this.inventory.commitStock(
      {
        variantId: dto.variantId,
        quantity: qty,
        reason: 'ALLOCATION_OFFER',
        referenceType: 'ALLOCATION_OFFER',
        referenceId: offer.id,
      },
      staffId,
    );

    await this.prisma.productRequest.update({
      where: { id: dto.requestId },
      data: { status: 'ALLOCATED', variantId: dto.variantId },
    });

    await this.audit.record({
      actorId: staffId,
      action: 'ALLOCATION_OFFER_CREATED',
      entityType: 'AllocationOffer',
      entityId: offer.id,
      after: { requestId: dto.requestId, variantId: dto.variantId, quantity: qty, expiresAt: expiresAt.toISOString() },
    });
    return offer;
  }

  async respondToOffer(offerId: string, userId: string, accept: boolean) {
    const offer = await this.prisma.allocationOffer.findUnique({
      where: { id: offerId },
      include: { request: { include: { groups: true } } },
    });
    if (!offer) throw new NotFoundException(`AllocationOffer ${offerId} not found`);

    if (accept) {
      const updated = await this.prisma.allocationOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await this.prisma.productRequest.update({
        where: { id: offer.requestId },
        data: { status: 'FULFILLED' },
      });
      return updated;
    }

    // Declined -> release hold and automatically offer to next eligible customer (§4.3.8)
    const updated = await this.prisma.allocationOffer.update({
      where: { id: offerId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    const holds = await this.prisma.stockHold.findMany({
      where: { referenceType: 'ALLOCATION_OFFER', referenceId: offerId, status: 'ACTIVE' },
    });
    for (const h of holds) {
      await this.inventory.releaseHold(h.id, userId);
    }

    if (offer.variantId) {
      await this.offerNextEligibleCustomer(offer.variantId, offer.quantity, offer.requestId, userId);
    }
    return updated;
  }

  async offerNextEligibleCustomer(
    variantId: string,
    quantity: number,
    excludeRequestId: string,
    actorId: string,
  ) {
    const nextRequest = await this.prisma.productRequest.findFirst({
      where: {
        id: { not: excludeRequestId },
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'SOURCING', 'PROVIDER_CONFIRMED', 'RECEIVED'] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    if (!nextRequest) return null;
    try {
      return await this.createOffer(actorId, {
        requestId: nextRequest.id,
        variantId,
        quantity: Math.min(quantity, nextRequest.quantity),
        notes: 'Auto-progressed waitlist offer',
      });
    } catch {
      return null;
    }
  }
}
