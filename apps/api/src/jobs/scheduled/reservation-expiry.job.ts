import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../../modules/inventory/inventory.service';

@Injectable()
export class ReservationExpiryJob {
  private readonly logger = new Logger(ReservationExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  @Cron('*/5 * * * *')
  async expireOverdueReservations(): Promise<{ expiredReservations: number; expiredCheckouts: number }> {
    if (!process.env.DATABASE_URL) return { expiredReservations: 0, expiredCheckouts: 0 };

    const now = new Date();
    const overdueReservations = await this.prisma.reservation.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        expiresAt: { lt: now },
      },
    });

    let expiredReservations = 0;
    for (const res of overdueReservations) {
      const updated = await this.prisma.reservation.updateMany({
        where: { id: res.id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'EXPIRED' },
      });
      if (updated.count === 0) continue;

      const holds = await this.prisma.stockHold.findMany({
        where: { referenceType: 'RESERVATION', referenceId: res.id, status: 'ACTIVE' },
      });
      for (const hold of holds) {
        await this.inventory.releaseHold(hold.id, 'SYSTEM_EXPIRY');
      }
      expiredReservations += 1;
    }

    const overdueCheckouts = await this.prisma.checkoutSession.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
    });

    let expiredCheckouts = 0;
    for (const session of overdueCheckouts) {
      const updated = await this.prisma.checkoutSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      if (updated.count === 0) continue;

      const holdIdsToRelease = new Set<string>();
      if (session.holdId) holdIdsToRelease.add(session.holdId);
      if (session.orderId) {
        const orderHolds = await this.prisma.stockHold.findMany({
          where: {
            referenceType: { in: ['ORDER', 'CHECKOUT_ORDER'] },
            referenceId: session.orderId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        for (const h of orderHolds) holdIdsToRelease.add(h.id);
      }
      for (const holdId of holdIdsToRelease) {
        const hold = await this.prisma.stockHold.findUnique({ where: { id: holdId } });
        if (hold && hold.status === 'ACTIVE') {
          await this.inventory.releaseHold(hold.id, 'SYSTEM_CHECKOUT_EXPIRY');
        }
      }
      expiredCheckouts += 1;
    }

    if (expiredReservations > 0 || expiredCheckouts > 0) {
      this.logger.log(
        `Expired ${expiredReservations} reservation(s) and ${expiredCheckouts} checkout session(s)`,
      );
    }

    await this.prisma.productPoll.updateMany({
      where: { status: 'OPEN', closesAt: { lte: now } },
      data: { status: 'CLOSED' },
    });

    return { expiredReservations, expiredCheckouts };
  }
}
