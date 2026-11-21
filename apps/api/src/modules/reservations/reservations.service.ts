import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async resolveCustomerProfileId(userId: string): Promise<string> {
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) return existing.id;
    const created = await this.prisma.customerProfile.create({ data: { userId } });
    return created.id;
  }

  private async getSettingNumber(key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    const parsed = setting ? Number(setting.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  async requestReservation(userId: string, dto: CreateReservationDto) {
    const customerId = await this.resolveCustomerProfileId(userId);
    const pendingMinutes = await this.getSettingNumber('PENDING_RESERVATION_HOLD_MINUTES', 120);
    const expiresAt = new Date(Date.now() + pendingMinutes * 60 * 1000);
    const isStaffCreated = Boolean(dto.notes?.includes('Staff-created'));
    const reservation = await this.prisma.reservation.create({
      data: {
        customerId,
        variantId: dto.productVariantId,
        quantity: dto.quantity,
        source: isStaffCreated ? 'WALK_IN' : 'ONLINE',
        notes: dto.notes,
        status: 'PENDING',
        expiresAt,
      },
    });
    await this.inventory.commitStock(
      {
        variantId: dto.productVariantId,
        quantity: dto.quantity,
        reason: 'RESERVATION_PENDING',
        referenceType: 'RESERVATION',
        referenceId: reservation.id,
      },
      userId,
    );
    await this.notifications.notifyCustomerByProfileId(
      customerId,
      'Reservation submitted',
      `Your reservation request for ${dto.quantity} unit(s) is pending review.`,
      'RESERVATIONS',
    );
    await this.notifications.notifyActiveStaff(
      'New reservation request',
      `A customer submitted a reservation request (${dto.quantity} unit(s)).`,
      'RESERVATIONS',
    );
    return reservation;
  }

  findAll(query: PaginationDto) {
    return this.prisma.reservation.findMany({
      ...paginationParams(query),
      include: {
        customer: { include: { user: true } },
        variant: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCustomer(userId: string) {
    const customerId = await this.resolveCustomerProfileId(userId);
    return this.prisma.reservation.findMany({
      where: { customerId },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveReservation(id: string, staffId: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Reservation ${id} not found`);
    const approvedHours = await this.getSettingNumber('APPROVED_RESERVATION_HOURS', 48);
    const expiresAt = new Date(Date.now() + approvedHours * 60 * 60 * 1000);
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: staffId,
        approvedAt: new Date(),
        expiresAt,
      },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'RESERVATION_APPROVED',
      entityType: 'Reservation',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'APPROVED', expiresAt: expiresAt.toISOString() },
    });
    await this.notifications.notifyCustomerByProfileId(
      existing.customerId,
      'Reservation approved',
      'Your reservation has been approved and stock is held for collection.',
      'RESERVATIONS',
    );
    return updated;
  }

  async declineReservation(id: string, reason: string, staffId?: string) {
    const existing = await this.prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Reservation ${id} not found`);

    const holds = await this.prisma.stockHold.findMany({
      where: { referenceType: 'RESERVATION', referenceId: id, status: 'ACTIVE' },
    });
    for (const hold of holds) {
      await this.inventory.releaseHold(hold.id, staffId);
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED', notes: reason },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'RESERVATION_DECLINED',
      entityType: 'Reservation',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'CANCELLED', reason },
    });
    await this.notifications.notifyCustomerByProfileId(
      existing.customerId,
      'Reservation cancelled',
      `Your reservation was cancelled (${reason}).`,
      'RESERVATIONS',
    );
    return updated;
  }

  async cancelOwnReservation(id: string, userId: string) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!existing) throw new NotFoundException(`Reservation ${id} not found`);
    if (existing.customer.userId !== userId) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    return this.declineReservation(id, 'Cancelled by customer', userId);
  }

  expireReservations() {
    return this.prisma.reservation.updateMany({
      where: { status: 'APPROVED', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }
}
