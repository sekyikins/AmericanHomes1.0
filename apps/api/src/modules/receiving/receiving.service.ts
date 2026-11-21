import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecordReceiptLineDto } from './dto/receipt-line.dto';
import { StartReceivingSessionDto } from './dto/start-session.dto';

@Injectable()
export class ReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async startSession(staffId: string, dto: StartReceivingSessionDto) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: dto.shipmentId } });
    if (!shipment) throw new NotFoundException(`Shipment ${dto.shipmentId} not found`);
    if (shipment.status === 'CLOSED') {
      throw new ConflictException(`Shipment ${shipment.reference} is already closed`);
    }
    if (!['ARRIVED', 'RECEIVING', 'RECONCILIATION_PENDING'].includes(shipment.status)) {
      throw new ConflictException(
        `Shipment ${shipment.reference} must be marked as ARRIVED before starting receiving (current status: ${shipment.status})`,
      );
    }
    const existingOpen = await this.prisma.receivingSession.findFirst({
      where: { shipmentId: dto.shipmentId, status: 'OPEN' },
    });
    if (existingOpen) {
      throw new ConflictException(`Shipment ${shipment.reference} already has an open receiving session`);
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.receivingSession.create({
        data: { shipmentId: dto.shipmentId, staffId, notes: dto.notes },
      });
      if (shipment.status !== 'RECEIVING') {
        await tx.shipment.update({
          where: { id: dto.shipmentId },
          data: {
            status: 'RECEIVING',
            ...(!shipment.actualArrival ? { actualArrival: new Date() } : {}),
          },
        });
      }
      return created;
    });

    await this.audit.record({
      actorId: staffId,
      action: 'RECEIVING_SESSION_STARTED',
      entityType: 'ReceivingSession',
      entityId: session.id,
      after: { shipmentId: dto.shipmentId, previousShipmentStatus: shipment.status },
    });

    return session;
  }

  async listSessions() {
    return this.prisma.receivingSession.findMany({
      orderBy: { openedAt: 'desc' },
      include: {
        shipment: {
          include: {
            manifestRevisions: {
              orderBy: { revision: 'desc' },
              take: 1,
              include: { items: { include: { variant: { select: { id: true, sku: true, name: true } } } } },
            },
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
          include: { manifestItem: true, discrepancies: { include: { resolution: true } }, stockLots: true },
        },
      },
    });
  }

  async findSession(id: string) {
    const session = await this.prisma.receivingSession.findUnique({
      where: { id },
      include: {
        shipment: true,
        lines: {
          orderBy: { createdAt: 'asc' },
          include: { manifestItem: true, discrepancies: { include: { resolution: true } }, stockLots: true },
        },
      },
    });
    if (!session) throw new NotFoundException(`ReceivingSession ${id} not found`);
    return session;
  }

  async recordLine(sessionId: string, dto: RecordReceiptLineDto & { variantId?: string }, staffId?: string) {
    const session = await this.prisma.receivingSession.findUnique({
      where: { id: sessionId },
      include: { shipment: true },
    });
    if (!session) throw new NotFoundException(`ReceivingSession ${sessionId} not found`);
    if (session.status !== 'OPEN') {
      throw new ConflictException('Receiving session is already closed');
    }
    if (session.shipment.status === 'CLOSED') {
      throw new ConflictException(`Shipment ${session.shipment.reference} is already closed`);
    }

    const manifestItem = dto.manifestItemId
      ? await this.prisma.manifestItem.findUnique({ where: { id: dto.manifestItemId } })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const existingLine = dto.manifestItemId
        ? await tx.receiptLine.findFirst({
            where: { sessionId, manifestItemId: dto.manifestItemId },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      const line = existingLine
        ? await tx.receiptLine.update({
            where: { id: existingLine.id },
            data: {
              expectedQty: manifestItem?.quantity,
              receivedQty: dto.receivedQty,
              condition: dto.condition,
              notes: dto.notes,
            },
          })
        : await tx.receiptLine.create({
            data: {
              sessionId,
              manifestItemId: dto.manifestItemId,
              expectedQty: manifestItem?.quantity,
              receivedQty: dto.receivedQty,
              condition: dto.condition,
              notes: dto.notes,
            },
          });

      if (existingLine) {
        await tx.discrepancy.deleteMany({
          where: { lineId: existingLine.id, resolution: { is: null } },
        });
      }

      const discrepancies: Array<{ type: string; quantity: number; notes: string }> = [];
      if (!manifestItem) {
        discrepancies.push({
          type: 'UNEXPECTED',
          quantity: dto.receivedQty,
          notes: dto.notes ?? 'Unexpected item not on shipment manifest; requires management review',
        });
      } else {
        if (dto.receivedQty < manifestItem.quantity) {
          discrepancies.push({
            type: 'MISSING',
            quantity: manifestItem.quantity - dto.receivedQty,
            notes: `Expected ${manifestItem.quantity}, received ${dto.receivedQty}`,
          });
        } else if (dto.receivedQty > manifestItem.quantity) {
          discrepancies.push({
            type: 'EXCESS',
            quantity: dto.receivedQty - manifestItem.quantity,
            notes: `Expected ${manifestItem.quantity}, received ${dto.receivedQty}`,
          });
        }
      }

      if (dto.condition === 'DAMAGED' && dto.receivedQty > 0) {
        discrepancies.push({
          type: 'DAMAGED',
          quantity: dto.receivedQty,
          notes: dto.notes ?? 'Damaged condition recorded on receipt',
        });
      }

      for (const d of discrepancies) {
        await tx.discrepancy.create({
          data: { lineId: line.id, type: d.type, quantity: d.quantity, notes: d.notes },
        });
      }

      // Admitted expected goods enter UNAVAILABLE stock until onboarding completes (§4.8.1)
      const targetVariantId = dto.variantId ?? manifestItem?.variantId ?? undefined;
      if (targetVariantId && manifestItem) {
        const existingLot = await tx.stockLot.findFirst({ where: { receiptLineId: line.id } });
        if (existingLot) {
          await tx.stockLot.update({
            where: { id: existingLot.id },
            data: {
              quantity: dto.receivedQty,
              unavailable: dto.receivedQty,
              condition: dto.condition,
            },
          });
        } else if (dto.receivedQty > 0) {
          const lot = await tx.stockLot.create({
            data: {
              variantId: targetVariantId,
              receiptLineId: line.id,
              quantity: dto.receivedQty,
              available: 0,
              held: 0,
              unavailable: dto.receivedQty,
              condition: dto.condition,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              lotId: lot.id,
              quantity: dto.receivedQty,
              reason: 'RECEIVING_UNAVAILABLE',
              referenceType: 'RECEIVING_LINE',
              referenceId: line.id,
              actorId: staffId,
            },
          });
        }
      }

      return tx.receiptLine.findUnique({
        where: { id: line.id },
        include: { discrepancies: true, stockLots: true },
      });
    });
  }

  async resolveDiscrepancy(discrepancyId: string, staffId: string, resolution: string, notes?: string) {
    const disc = await this.prisma.discrepancy.findUnique({ where: { id: discrepancyId } });
    if (!disc) throw new NotFoundException(`Discrepancy ${discrepancyId} not found`);

    const saved = await this.prisma.discrepancyResolution.upsert({
      where: { discrepancyId },
      update: { resolution, resolvedBy: staffId, resolvedAt: new Date(), notes },
      create: { discrepancyId, resolution, resolvedBy: staffId, notes },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'DISCREPANCY_RESOLVED',
      entityType: 'Discrepancy',
      entityId: discrepancyId,
      after: { resolution, notes },
    });
    return saved;
  }

  async closeSession(sessionId: string, staffId?: string) {
    const session = await this.prisma.receivingSession.findUnique({
      where: { id: sessionId },
      include: { shipment: true },
    });
    if (!session) throw new NotFoundException(`ReceivingSession ${sessionId} not found`);
    if (session.status === 'CLOSED') {
      throw new ConflictException(`ReceivingSession ${sessionId} is already closed`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.receivingSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      if (session.shipment.status !== 'CLOSED') {
        await tx.shipment.update({
          where: { id: session.shipmentId },
          data: { status: 'RECONCILIATION_PENDING' },
        });
      }
      return closed;
    });

    await this.audit.record({
      actorId: staffId,
      action: 'RECEIVING_SESSION_CLOSED',
      entityType: 'ReceivingSession',
      entityId: sessionId,
      after: { status: 'CLOSED', shipmentId: session.shipmentId },
    });

    return updated;
  }
}
