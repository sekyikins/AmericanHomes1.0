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
          product: {
            include: {
              media: { orderBy: { position: 'asc' }, take: 1 },
              preparationSteps: true,
            },
          },
          stockLots: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adjustmentProposal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const preparedVariants = [];
    for (const v of variants) {
      if (!v.product) continue;
      const doneSteps = new Set(
        (v.product.preparationSteps ?? [])
          .filter((s) => s.status === 'COMPLETED')
          .map((s) => s.step),
      );
      const allPhysicalDone = ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING'].every((s) =>
        doneSteps.has(s),
      );
      const hasPrice = doneSteps.has('PRICING') || v.priceCents > 0;
      const isFullyPrepared =
        Boolean(v.product.isPublished) ||
        (allPhysicalDone && hasPrice && doneSteps.has('FINAL_REVIEW'));

      if (!isFullyPrepared || !v.product.isPublished) {
        // Unprepared (< 6 stages) or unpublished products have their unheld stock in unavailable
        for (const lot of v.stockLots) {
          if (lot.available > 0) {
            const moved = lot.available;
            await this.prisma.stockLot.update({
              where: { id: lot.id },
              data: {
                available: 0,
                unavailable: { increment: moved },
              },
            });
            lot.unavailable += moved;
            lot.available = 0;
          }
        }
      }
      if (!isFullyPrepared) {
        continue;
      }
      preparedVariants.push(v);
    }

    const items = preparedVariants.map((v) => {
      const physical = v.stockLots.reduce((s, l) => s + l.quantity, 0);
      const available = v.stockLots.reduce((s, l) => s + l.available, 0);
      const held = v.stockLots.reduce((s, l) => s + l.held, 0);
      const unavailable = v.stockLots.reduce((s, l) => s + l.unavailable, 0);
      const primaryLot = v.stockLots[0];
      return {
        id: v.id,
        sku: v.sku,
        variantName: v.name ?? v.sku,
        productId: v.productId,
        productName: v.product?.name ?? 'Product',
        boxCount: v.product?.boxCount ?? 1,
        isPublished: Boolean(v.product?.isPublished),
        disposition: v.product?.disposition ?? 'NORMAL_SALE',
        image: v.product?.media?.[0]?.url ?? '/images/sofa.avif',
        condition: primaryLot?.condition ?? 'GOOD',
        physical,
        available,
        held,
        unavailable,
        lotId: primaryLot?.id ?? null,
        lotRef: primaryLot?.id ? `LOT-${primaryLot.id.slice(-6).toUpperCase()}` : '—',
        binLocation: primaryLot?.binLocation ?? null,
        abcClass: primaryLot?.abcClass ?? 'B',
        landedUnitCostCents: primaryLot?.landedUnitCostCents ?? 0,
      };
    });

    const variantLabelById = new Map(
      variants.map((v) => [
        v.id,
        {
          productName: v.product?.name ?? 'Product',
          variantName: v.name ?? v.sku,
          sku: v.sku,
        },
      ]),
    );

    const enrichedAdjustments = adjustments.map((a) => {
      const info = variantLabelById.get(a.variantId);
      return {
        ...a,
        productName: info?.productName ?? null,
        variantName: info?.variantName ?? null,
        sku: info?.sku ?? null,
      };
    });

    return { items, adjustments: enrichedAdjustments };
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
        const lot = await tx.stockLot.findUnique({ where: { id: line.lotId } });
        const deductHeld = lot ? Math.min(lot.held, line.quantity) : line.quantity;
        const deductQty = lot ? Math.min(lot.quantity, line.quantity) : line.quantity;
        if (deductHeld > 0 || deductQty > 0) {
          await tx.stockLot.update({
            where: { id: line.lotId },
            data: {
              held: { decrement: deductHeld },
              quantity: { decrement: deductQty },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              lotId: line.lotId,
              quantity: -deductQty,
              reason: `SALE_CONSUMED:${hold.reason}`,
              referenceType: hold.referenceType,
              referenceId: hold.referenceId,
              actorId,
            },
          });
        }
      }
      return tx.stockHold.update({
        where: { id: holdId },
        data: { status: 'CONSUMED', releasedAt: new Date() },
      });
    });
  }

  async consumeOrderQuantity(
    orderId: string,
    variantId: string,
    quantityToConsume: number,
    actorId?: string,
  ) {
    if (quantityToConsume <= 0) return { consumed: 0 };
    return this.prisma.$transaction(async (tx) => {
      const holds = await tx.stockHold.findMany({
        where: {
          referenceId: orderId,
          referenceType: { in: ['ORDER', 'CHECKOUT_ORDER', 'SALES_ORDER', 'RESERVATION'] },
          status: 'ACTIVE',
        },
        include: { lines: true },
        orderBy: { createdAt: 'asc' },
      });

      let remaining = quantityToConsume;
      for (const hold of holds) {
        if (remaining <= 0) break;
        for (const line of hold.lines) {
          if (remaining <= 0) break;
          if (line.variantId !== variantId || line.quantity <= 0) continue;

          const take = Math.min(line.quantity, remaining);
          const lot = await tx.stockLot.findUnique({ where: { id: line.lotId } });
          if (lot) {
            const deductHeld = Math.min(lot.held, take);
            const deductQty = Math.min(lot.quantity, take);
            await tx.stockLot.update({
              where: { id: lot.id },
              data: {
                held: { decrement: deductHeld },
                quantity: { decrement: deductQty },
              },
            });
            await tx.inventoryMovement.create({
              data: {
                lotId: lot.id,
                quantity: -deductQty,
                reason: 'COLLECTION_GATE_CONSUMED',
                referenceType: 'ORDER',
                referenceId: orderId,
                actorId,
              },
            });
          }

          const newLineQty = line.quantity - take;
          await tx.stockHoldLine.update({
            where: { id: line.id },
            data: { quantity: newLineQty },
          });
          remaining -= take;
        }

        const updatedLines = await tx.stockHoldLine.findMany({
          where: { holdId: hold.id },
        });
        if (updatedLines.every((l) => l.quantity <= 0)) {
          await tx.stockHold.update({
            where: { id: hold.id },
            data: { status: 'CONSUMED', releasedAt: new Date() },
          });
        }
      }

      // Fallback if hold was already marked CONSUMED earlier without decrementing physical stock
      if (remaining > 0) {
        const fallbackLot = await tx.stockLot.findFirst({
          where: { variantId, held: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        });
        if (fallbackLot) {
          const take = Math.min(fallbackLot.held, remaining);
          await tx.stockLot.update({
            where: { id: fallbackLot.id },
            data: {
              held: { decrement: take },
              quantity: { decrement: Math.min(fallbackLot.quantity, take) },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              lotId: fallbackLot.id,
              quantity: -take,
              reason: 'COLLECTION_GATE_CONSUMED',
              referenceType: 'ORDER',
              referenceId: orderId,
              actorId,
            },
          });
          remaining -= take;
        }
      }

      return { consumed: quantityToConsume - remaining };
    });
  }

  async receiveReturnedToUnavailable(
    variantId: string,
    quantity: number,
    returnId: string,
    actorId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let lot = await tx.stockLot.findFirst({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
      });
      if (!lot) {
        lot = await tx.stockLot.create({
          data: {
            variantId,
            quantity,
            available: 0,
            held: 0,
            unavailable: quantity,
            condition: 'GOOD',
          },
        });
      } else {
        lot = await tx.stockLot.update({
          where: { id: lot.id },
          data: {
            quantity: { increment: quantity },
            unavailable: { increment: quantity },
          },
        });
      }
      await tx.inventoryMovement.create({
        data: {
          lotId: lot.id,
          quantity,
          reason: `RETURN_TO_INSPECTION:${returnId}`,
          referenceType: 'RETURN_REQUEST',
          referenceId: returnId,
          actorId,
        },
      });
      return lot;
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
      const variantRecord = await tx.productVariant.findUnique({
        where: { id: dto.variantId },
        include: { product: true },
      });
      if (!variantRecord || !variantRecord.product) {
        throw new NotFoundException(`Variant ${dto.variantId} not found`);
      }
      if (
        !variantRecord.product.isPublished ||
        !['NORMAL_SALE', 'DISCOUNTED_SALE'].includes(variantRecord.product.disposition)
      ) {
        throw new ConflictException(
          `Product "${variantRecord.product.name}" is not published and cannot be sold or reserved`,
        );
      }

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
      // Atomically claim the ACTIVE -> RELEASED transition so concurrent callers
      // can never double-release the same hold or push StockLot.held negative.
      const claimed = await tx.stockHold.updateMany({
        where: { id: holdId, status: 'ACTIVE' },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });

      const hold = await tx.stockHold.findUnique({
        where: { id: holdId },
        include: { lines: true },
      });
      if (!hold) {
        throw new NotFoundException(`StockHold ${holdId} not found`);
      }
      if (claimed.count === 0) {
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

      return hold;
    });
  }
}
