import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SourcingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.shipmentSourcingItem.findMany({
      include: { shipment: true, group: { include: { members: { include: { request: true } } } } },
    });
  }

  async createGroup(name: string, requestIds: string[], staffId: string) {
    const group = await this.prisma.requestGroup.create({
      data: {
        name,
        members: {
          create: requestIds.map((requestId) => ({ requestId })),
        },
      },
      include: { members: true },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'REQUEST_GROUP_CREATED',
      entityType: 'RequestGroup',
      entityId: group.id,
      after: { name, requestIds },
    });
    return group;
  }

  async createSourcingItem(
    dto: { shipmentId: string; groupId?: string; description: string; quantity: number },
    staffId: string,
  ) {
    const item = await this.prisma.shipmentSourcingItem.create({
      data: {
        shipmentId: dto.shipmentId,
        groupId: dto.groupId,
        description: dto.description,
        quantity: dto.quantity,
        status: 'PENDING',
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'SOURCING_ITEM_ADDED',
      entityType: 'ShipmentSourcingItem',
      entityId: item.id,
      after: dto,
    });
    return item;
  }

  async confirmByProvider(id: string, staffId: string, providerRef?: string) {
    const existing = await this.prisma.shipmentSourcingItem.findUnique({
      where: { id },
      include: { group: { include: { members: true } } },
    });
    if (!existing) throw new NotFoundException(`ShipmentSourcingItem ${id} not found`);

    const now = new Date();
    const updated = await this.prisma.shipmentSourcingItem.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: now,
        providerConfirmedAt: now,
        providerRef,
      },
    });

    if (existing.group) {
      const requestIds = existing.group.members.map((m) => m.requestId);
      if (requestIds.length > 0) {
        await this.prisma.productRequest.updateMany({
          where: { id: { in: requestIds }, status: { notIn: ['WITHDRAWN', 'DECLINED'] } },
          data: { status: 'PROVIDER_CONFIRMED' },
        });
      }
    }

    await this.audit.record({
      actorId: staffId,
      action: 'SOURCING_PROVIDER_CONFIRMED',
      entityType: 'ShipmentSourcingItem',
      entityId: id,
      after: { providerConfirmedAt: now.toISOString(), providerRef },
    });
    return updated;
  }
}
