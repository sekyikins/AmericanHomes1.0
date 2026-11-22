import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ManifestRevisionDto } from './dto/manifest-revision.dto';

@Injectable()
export class ShipmentsService {
  private readonly listCache = new Map<string, { expiresAt: number; data: unknown }>();
  private static readonly LIST_CACHE_TTL_MS = 15_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private invalidateListCache() {
    this.listCache.clear();
  }

  async findAll(query: PaginationDto) {
    const { skip, take } = paginationParams(query);
    const cacheKey = `${skip}:${take}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const data = await this.prisma.shipment.findMany({
      skip,
      take,
      include: {
        _count: { select: { manifestRevisions: true, receivingSessions: true, expenses: true } },
        manifestRevisions: {
          orderBy: { revision: 'desc' },
          take: 1,
          include: { items: { include: { variant: { select: { id: true, sku: true, name: true } } } } },
        },
        receivingSessions: {
          orderBy: { openedAt: 'desc' },
          select: {
            id: true,
            status: true,
            lines: {
              select: {
                manifestItemId: true,
                expectedQty: true,
                receivedQty: true,
                discrepancies: { include: { resolution: true } },
              },
            },
          },
        },
        expenses: { select: { id: true, category: true, description: true, amountCents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    this.listCache.set(cacheKey, {
      expiresAt: Date.now() + ShipmentsService.LIST_CACHE_TTL_MS,
      data,
    });
    return data;
  }

  async findById(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        manifestRevisions: {
          include: { items: { include: { variant: { select: { id: true, sku: true, name: true } } } } },
          orderBy: { revision: 'desc' },
        },
        trackingEvents: { orderBy: { occurredAt: 'asc' } },
        receivingSessions: {
          orderBy: { openedAt: 'desc' },
          include: { lines: { include: { discrepancies: { include: { resolution: true } } } } },
        },
        expenses: { orderBy: { date: 'desc' } },
      },
    });
    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);
    return shipment;
  }

  create(dto: CreateShipmentDto) {
    return this.prisma.shipment.create({
      data: {
        reference: dto.reference,
        providerName: dto.providerName,
        estimatedArrival: dto.estimatedArrival ? new Date(dto.estimatedArrival) : undefined,
        notes: dto.notes,
      },
    });
  }

  async addManifestRevision(id: string, dto: ManifestRevisionDto) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);
    if (!['PLANNED', 'IN_TRANSIT', 'ARRIVED'].includes(shipment.status)) {
      throw new BadRequestException(
        `Cannot revise manifest once receiving has started (current status: ${shipment.status})`,
      );
    }
    const count = await this.prisma.manifestRevision.count({ where: { shipmentId: id } });
    return this.prisma.manifestRevision.create({
      data: {
        shipmentId: id,
        revision: count + 1,
        notes: dto.notes,
        items: { create: dto.items },
      },
      include: { items: true },
    });
  }

  async addTrackingEvent(
    shipmentId: string,
    dto: { event: string; location?: string; occurredAt?: string; notes?: string },
  ) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} not found`);
    return this.prisma.shipmentTrackingEvent.create({
      data: {
        shipmentId,
        event: dto.event,
        location: dto.location,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        notes: dto.notes,
      },
    });
  }

  async addExpense(
    shipmentId: string,
    staffId: string,
    dto: { category: string; description: string; amountCents: number; date?: string },
  ) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} not found`);
    const expense = await this.prisma.shipmentExpense.create({
      data: {
        shipmentId,
        category: dto.category,
        description: dto.description,
        amountCents: dto.amountCents,
        recordedBy: staffId,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'SHIPMENT_EXPENSE_RECORDED',
      entityType: 'ShipmentExpense',
      entityId: expense.id,
      after: { shipmentId, amountCents: dto.amountCents, category: dto.category },
    });
    return expense;
  }

  async updateStatus(shipmentId: string, status: string, staffId: string) {
    const allowedTransitions: Record<string, string[]> = {
      PLANNED: ['IN_TRANSIT'],
      IN_TRANSIT: ['ARRIVED'],
      ARRIVED: ['RECEIVING'],
      RECEIVING: ['RECONCILIATION_PENDING'],
      RECONCILIATION_PENDING: ['CLOSED'],
      CLOSED: [],
    };
    if (!(status in allowedTransitions)) {
      throw new BadRequestException(`Invalid shipment status: ${status}`);
    }

    const existing = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!existing) throw new NotFoundException(`Shipment ${shipmentId} not found`);
    if (existing.status === status) return existing;

    const nextAllowed = allowedTransitions[existing.status] ?? [];
    if (!nextAllowed.includes(status)) {
      throw new BadRequestException(
        `Invalid shipment transition from ${existing.status} to ${status}`,
      );
    }

    if (status === 'CLOSED') {
      return this.close(shipmentId, staffId);
    }
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        ...(status === 'ARRIVED' && !existing.actualArrival ? { actualArrival: new Date() } : {}),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'SHIPMENT_STATUS_UPDATED',
      entityType: 'Shipment',
      entityId: shipmentId,
      before: { status: existing.status },
      after: { status },
    });
    return updated;
  }

  async close(id: string, staffId?: string, overrideReason?: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        receivingSessions: {
          include: { lines: { include: { discrepancies: { include: { resolution: true } } } } },
        },
      },
    });
    if (!shipment) throw new NotFoundException(`Shipment ${id} not found`);

    const unresolved = shipment.receivingSessions.flatMap((s) =>
      s.lines.flatMap((l) => l.discrepancies.filter((d) => !d.resolution)),
    );
    if (unresolved.length > 0 && !overrideReason) {
      throw new BadRequestException(
        `Cannot close shipment: ${unresolved.length} unresolved discrepancy(ies) remain. Resolve them or provide an authorised overrideReason.`,
      );
    }

    const closedAt = new Date();
    const { updated, closedOpenSessions } = await this.prisma.$transaction(async (tx) => {
      const closedSessions = await tx.receivingSession.updateMany({
        where: { shipmentId: id, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt },
      });
      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: { status: 'CLOSED' },
      });
      return { updated: updatedShipment, closedOpenSessions: closedSessions.count };
    });

    await this.audit.record({
      actorId: staffId,
      action: 'SHIPMENT_CLOSED',
      entityType: 'Shipment',
      entityId: id,
      after: {
        status: 'CLOSED',
        unresolvedCount: unresolved.length,
        closedOpenSessions,
        overrideReason,
      },
    });
    return updated;
  }
}
