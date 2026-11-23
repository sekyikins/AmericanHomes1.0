import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';

@Injectable()
export class ProductRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async resolveCustomerProfileId(userId: string): Promise<string> {
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) return existing.id;
    const created = await this.prisma.customerProfile.create({ data: { userId } });
    return created.id;
  }

  async create(userId: string, dto: CreateRequestDto) {
    const customerId = await this.resolveCustomerProfileId(userId);
    const created = await this.prisma.productRequest.create({
      data: {
        customerId,
        productName: dto.productName,
        category: dto.category,
        description: dto.description,
        quantity: dto.quantity ?? 1,
        budgetCents: dto.budgetCents,
        imageUrl: dto.imageUrl,
        referenceUrl: dto.referenceUrl,
        notes: dto.notes,
        status: 'SUBMITTED',
      },
    });
    await this.notifications.notifyCustomerByProfileId(
      customerId,
      'Product request submitted',
      `We received your sourcing request for "${dto.productName}".`,
      'REQUESTS',
    );
    await this.notifications.notifyActiveStaff(
      'New product request',
      `A customer requested "${dto.productName}".`,
      'REQUESTS',
    );
    return created;
  }

  async findByCustomer(userId: string) {
    const customerId = await this.resolveCustomerProfileId(userId);
    return this.prisma.productRequest.findMany({
      where: { customerId },
      include: { offers: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll(query: PaginationDto) {
    return this.prisma.productRequest.findMany({
      ...paginationParams(query),
      include: { customer: { include: { user: true } }, groups: { include: { group: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async review(id: string, dto: ReviewRequestDto, staffId?: string) {
    const existing = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProductRequest ${id} not found`);
    const updated = await this.prisma.productRequest.update({
      where: { id },
      data: { status: dto.decision, notes: dto.notes },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_REQUEST_REVIEWED',
      entityType: 'ProductRequest',
      entityId: id,
      before: { status: existing.status },
      after: { status: dto.decision, notes: dto.notes },
    });
    await this.notifications.notifyCustomerByProfileId(
      existing.customerId,
      dto.decision === 'APPROVED_FOR_SOURCING'
        ? 'Product request approved'
        : 'Product request updated',
      dto.decision === 'APPROVED_FOR_SOURCING'
        ? `Your product request for "${existing.productName}" has been approved for sourcing.`
        : `Your request for "${existing.productName}" is now ${dto.decision}.`,
      'REQUESTS',
    );
    return updated;
  }

  async setPriority(id: string, priority: number, staffId: string) {
    const existing = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProductRequest ${id} not found`);
    const updated = await this.prisma.productRequest.update({
      where: { id },
      data: { priority },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_REQUEST_PRIORITY_CHANGED',
      entityType: 'ProductRequest',
      entityId: id,
      before: { priority: existing.priority },
      after: { priority },
    });
    return updated;
  }

  async withdraw(id: string, userId: string, reason?: string) {
    const customerId = await this.resolveCustomerProfileId(userId);
    const request = await this.prisma.productRequest.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            group: { include: { sourcingItems: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException(`ProductRequest ${id} not found`);
    if (request.customerId !== customerId) {
      throw new ForbiddenException('You can only withdraw your own product request');
    }

    const hasProviderConfirmedPurchase =
      ['PROVIDER_CONFIRMED', 'RECEIVED', 'ALLOCATED', 'FULFILLED'].includes(request.status) ||
      request.groups.some((m) =>
        m.group.sourcingItems.some((s) => s.providerConfirmedAt !== null || s.status === 'CONFIRMED'),
      );

    if (hasProviderConfirmedPurchase) {
      const updated = await this.prisma.productRequest.update({
        where: { id },
        data: {
          status: 'WITHDRAWAL_REQUESTED',
          withdrawalReason: reason ?? 'Customer requested withdrawal after supplier confirmation',
        },
      });
      await this.audit.record({
        actorId: userId,
        action: 'PRODUCT_REQUEST_EXCEPTION_WITHDRAWAL',
        entityType: 'ProductRequest',
        entityId: id,
        before: { status: request.status },
        after: { status: 'WITHDRAWAL_REQUESTED', reason },
      });
      return {
        withdrawn: false,
        requiresManagementReview: true,
        message: 'Supplier has already confirmed purchase; withdrawal escalated for management review.',
        request: updated,
      };
    }

    const updated = await this.prisma.productRequest.update({
      where: { id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        withdrawalReason: reason ?? 'Withdrawn by customer prior to supplier confirmation',
      },
    });
    await this.audit.record({
      actorId: userId,
      action: 'PRODUCT_REQUEST_WITHDRAWN',
      entityType: 'ProductRequest',
      entityId: id,
      before: { status: request.status },
      after: { status: 'WITHDRAWN' },
    });
    return { withdrawn: true, requiresManagementReview: false, request: updated };
  }
}
