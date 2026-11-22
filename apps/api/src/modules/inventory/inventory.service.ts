import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CommitStockDto } from './dto/commit-stock.dto';

// WARNING: All stock mutations MUST go through InventoryService. Never update stock tables directly.
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventorySummary() {
    const [variants, adjustments] = await Promise.all([
      this.prisma.productVariant.findMany({
        include: {
          product: { include: { media: { orderBy: { position: 'asc' }, take: 1 } } },
          stockLots: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adjustmentProposal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const items = variants.map((v) => {
      const physical = v.stockLots.reduce((s, l) => s + l.quantity, 0);
      const available = v.stockLots.reduce((s, l) => s + l.available, 0);
      const held = v.stockLots.reduce((s, l) => s + l.held, 0);
      const unavailable = v.stockLots.reduce((s, l) => s + l.unavailable, 0);
      return {
        id: v.id,
        sku: v.sku,
        variantName: v.name ?? v.sku,
        productId: v.productId,
        productName: v.product?.name ?? 'Product',
        image: v.product?.media?.[0]?.url ?? '/images/sofa.avif',
        condition: v.stockLots[0]?.condition ?? 'GOOD',
        physical,
        available,
        held,
        unavailable,
        lotRef: v.stockLots[0]?.id ? `LOT-${v.stockLots[0].id.slice(-6).toUpperCase()}` : '—',
      };
    });

    return { items, adjustments };
  }

  async getBalance(variantId: string) {
    const lots = await this.prisma.stockLot.findMany({ where: { variantId } });
    const available = lots.reduce((sum, lot) => sum + lot.available, 0);
    const held = lots.reduce((sum, lot) => sum + lot.held, 0);
    const unavailable = lots.reduce((sum, lot) => sum + lot.unavailable, 0);
    const physical = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    return { variantId, physical, available, held, unavailable, total: available + held + unavailable };
  }

  async moveUnavailableToAvailable(variantId: string, quantity: number, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const lots = await tx.$queryRaw<Array<{ id: string; unavailable: number }>>`
        SELECT id, unavailable FROM "StockLot" WHERE "variantId" = ${variantId} AND unavailable > 0 ORDER BY "createdAt" ASC FOR UPDATE
      `;
      const totalUnavailable = lots.reduce((s, l) => s + l.unavailable, 0);
      if (totalUnavailable < quantity) {
        throw new ConflictException(`Insufficient unavailable stock: requested ${quantity}, unavailable ${totalUnavailable}`);
      }
      let remaining = quantity;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const move = Math.min(lot.unavailable, remaining);
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { unavailable: { decrement: move }, available: { increment: move } },
        });
        await tx.inventoryMovement.create({
          data: {
            lotId: lot.id,
            quantity: move,
            reason: 'ONBOARDING_COMPLETED_AVAILABLE',
            actorId,
          },
        });
        remaining -= move;
      }
      return this.getBalance(variantId);
    });
  }

  async consumeHold(holdId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.stockHold.findUnique({
        where: { id: holdId },
        include: { lines: true },
      });
      if (!hold) throw new NotFoundException(`StockHold ${holdId} not found`);
      if (hold.status !== 'ACTIVE') return hold;

      for (const line of hold.lines) {
        await tx.stockLot.update({
          where: { id: line.lotId },
          data: { held: { decrement: line.quantity }, quantity: { decrement: line.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            lotId: line.lotId,
            quantity: -line.quantity,
            reason: `SALE_CONSUMED:${hold.reason}`,
            referenceType: hold.referenceType,
            referenceId: hold.referenceId,
            actorId,
          },
        });
      }
      return tx.stockHold.update({
        where: { id: holdId },
        data: { status: 'CONSUMED', releasedAt: new Date() },
      });
    });
  }

  async applyAdjustment(variantId: string, deltaQty: number, reason: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let lot = await tx.stockLot.findFirst({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
      });
      if (!lot) {
        if (deltaQty < 0) {
          throw new ConflictException(`Cannot apply negative adjustment without existing stock lot for ${variantId}`);
        }
        lot = await tx.stockLot.create({
          data: { variantId, quantity: deltaQty, available: deltaQty, held: 0, unavailable: 0 },
        });
      } else {
        if (lot.available + deltaQty < 0) {
          throw new ConflictException(`Adjustment would result in negative available stock`);
        }
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { quantity: { increment: deltaQty }, available: { increment: deltaQty } },
        });
      }
      await tx.inventoryMovement.create({
        data: { lotId: lot.id, quantity: deltaQty, reason: `ADJUSTMENT:${reason}`, actorId },
      });
      return lot;
    });
  }

  getMovements(variantId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { lot: { variantId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async commitStock(
    dto: CommitStockDto,
    actorId?: string,
    externalTx?: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ) {
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new ConflictException('Stock commitment quantity must be at least 1');
    }
    const run = async (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => {
      const lots = await tx.$queryRaw<
        Array<{ id: string; available: number }>
      >`SELECT id, available FROM "StockLot" WHERE "variantId" = ${dto.variantId} AND available > 0 ORDER BY "createdAt" ASC FOR UPDATE`;

      const totalAvailable = lots.reduce((sum, l) => sum + l.available, 0);
      if (totalAvailable < dto.quantity) {
        throw new ConflictException(
          `Insufficient available stock for variant ${dto.variantId}: requested ${dto.quantity}, available ${totalAvailable}`,
        );
      }

      const hold = await tx.stockHold.create({
        data: {
          reason: dto.reason,
          referenceType: dto.referenceType ?? 'ORDER',
          referenceId: dto.referenceId ?? `HOLD-${Date.now()}`,
          status: 'ACTIVE',
        },
      });

      let remaining = dto.quantity;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.available, remaining);
        remaining -= take;

        await tx.stockLot.update({
          where: { id: lot.id },
          data: {
            available: { decrement: take },
            held: { increment: take },
          },
        });

        await tx.stockHoldLine.create({
          data: {
            holdId: hold.id,
            lotId: lot.id,
            variantId: dto.variantId,
            quantity: take,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            lotId: lot.id,
            quantity: -take,
            reason: `HOLD:${dto.reason}`,
            referenceType: dto.referenceType ?? 'STOCK_HOLD',
            referenceId: hold.id,
            actorId,
          },
        });
      }

      return hold;
    };

    if (externalTx) {
      return run(externalTx);
    }
    return this.prisma.$transaction(run);
  }

  async releaseHold(holdId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.stockHold.findUnique({
        where: { id: holdId },
        include: { lines: true },
      });
      if (!hold) {
        throw new NotFoundException(`StockHold ${holdId} not found`);
      }
      if (hold.status !== 'ACTIVE') {
        return hold;
      }

      for (const line of hold.lines) {
        await tx.stockLot.update({
          where: { id: line.lotId },
          data: {
            available: { increment: line.quantity },
            held: { decrement: line.quantity },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            lotId: line.lotId,
            quantity: line.quantity,
            reason: 'HOLD_RELEASED',
            referenceType: hold.referenceType,
            referenceId: hold.referenceId,
            actorId,
          },
        });
      }

      return tx.stockHold.update({
        where: { id: holdId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
    });
  }
}
