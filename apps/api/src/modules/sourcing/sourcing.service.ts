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

  async getDemandRecommendations() {
    const [products, openRequests, wishlistSettings, polls, returns, discrepancies, openQuotes, serviceTickets] =
      await Promise.all([
        this.prisma.product.findMany({
          include: {
            media: { orderBy: { position: 'asc' }, take: 1 },
            variants: {
              include: {
                stockLots: true,
                orderLines: {
                  include: {
                    order: {
                      select: {
                        id: true,
                        source: true,
                        orderStatus: true,
                        createdAt: true,
                      },
                    },
                  },
                },
                reservations: {
                  select: {
                    id: true,
                    source: true,
                    status: true,
                    quantity: true,
                    createdAt: true,
                  },
                },
                manifestItems: {
                  include: {
                    revision: {
                      include: {
                        shipment: {
                          select: { id: true, status: true, reference: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.productRequest.findMany({
          where: {
            status: { notIn: ['WITHDRAWN', 'DECLINED', 'FULFILLED'] },
          },
        }),
        this.prisma.systemSetting.findMany({
          where: { key: { startsWith: 'WISHLIST:' } },
        }),
        this.prisma.productPoll.findMany({
          include: { votes: true },
        }),
        this.prisma.returnLine.findMany(),
        this.prisma.discrepancy.findMany({
          where: { type: { in: ['DAMAGED', 'DEFECTIVE'] } },
          include: { line: { include: { manifestItem: true } } },
        }),
        this.prisma.quotation.findMany({
          where: { status: 'SENT' },
          select: { items: true },
        }),
        this.prisma.serviceTicket.findMany({
          where: { issueType: { in: ['WARRANTY_CLAIM', 'REPAIR'] } },
          include: { trackedUnit: { select: { variantId: true } } },
        }),
      ]);

    // 1. Count unique customer wishlist saves per productId
    const wishlistCountByProduct = new Map<string, number>();
    for (const row of wishlistSettings) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) {
          const seenInUser = new Set<string>();
          for (const entry of parsed) {
            const pid = typeof entry?.productId === 'string' ? entry.productId.trim() : '';
            if (pid && !seenInUser.has(pid)) {
              seenInUser.add(pid);
              wishlistCountByProduct.set(pid, (wishlistCountByProduct.get(pid) ?? 0) + 1);
            }
          }
        }
      } catch {
        // ignore malformed setting
      }
    }

    // 2. Count returns and transit-damage discrepancies per variantId
    const returnedByVariant = new Map<string, number>();
    for (const r of returns) {
      returnedByVariant.set(r.variantId, (returnedByVariant.get(r.variantId) ?? 0) + r.quantity);
    }
    const damagedByVariant = new Map<string, number>();
    for (const d of discrepancies) {
      const vid = d.line?.manifestItem?.variantId;
      if (vid) {
        damagedByVariant.set(vid, (damagedByVariant.get(vid) ?? 0) + d.quantity);
      }
    }

    // 3. Count active formal quotation demand and warranty/repair ticket penalties per variantId
    const quotedByVariant = new Map<string, number>();
    for (const q of openQuotes) {
      const qItems = Array.isArray(q.items)
        ? (q.items as Array<{ variantId?: string; quantity?: number }>)
        : [];
      for (const qi of qItems) {
        if (qi.variantId) {
          quotedByVariant.set(
            qi.variantId,
            (quotedByVariant.get(qi.variantId) ?? 0) + Math.max(1, Number(qi.quantity ?? 1)),
          );
        }
      }
    }
    const warrantyIssuesByVariant = new Map<string, number>();
    for (const tk of serviceTickets) {
      const vid = tk.trackedUnit?.variantId;
      if (vid) {
        warrantyIssuesByVariant.set(vid, (warrantyIssuesByVariant.get(vid) ?? 0) + 1);
      }
    }

    const nowMs = Date.now();
    const restockRecommendations: Array<{
      productId: string;
      variantId: string;
      sku: string;
      productName: string;
      variantName: string;
      category: string;
      image: string;
      demandScore: number;
      priorityTier: 'HIGH' | 'MEDIUM' | 'EMERGING';
      recommendedQty: number;
      dominantChannel: 'Walk-in mover' | 'Storefront demand' | 'Omnichannel (Online + Walk-in)';
      currentAvailable: number;
      inTransitQty: number;
      onlineSoldQty: number;
      walkInSoldQty: number;
      monthlyVelocity: number;
      wishlistSaves: number;
      wishlistUnmet: number;
      openRequestUnits: number;
      reservationUnits: number;
      pollYesVotes: number;
      returnDefectUnits: number;
      lastUnitCostCents: number;
      rationale: string;
    }> = [];

    const markdownCandidates: Array<{
      productId: string;
      variantId: string;
      sku: string;
      productName: string;
      category: string;
      image: string;
      daysOnFloor: number;
      availableStock: number;
      totalSoldQty: number;
      wishlistSaves: number;
      currentPriceCents: number;
      suggestedPriceCents: number;
      markdownPct: number;
      reason: string;
    }> = [];

    for (const product of products) {
      const primaryVariant = product.variants[0];
      if (!primaryVariant) continue;

      const availableStock = product.variants.reduce(
        (s, v) => s + v.stockLots.reduce((ls, l) => ls + l.available, 0),
        0,
      );
      const physicalStock = product.variants.reduce(
        (s, v) => s + v.stockLots.reduce((ls, l) => ls + l.quantity, 0),
        0,
      );

      let onlineSoldQty = 0;
      let walkInSoldQty = 0;
      let onlineResUnits = 0;
      let walkInResUnits = 0;
      let unfulfilledResUnits = 0;
      let inTransitQty = 0;
      let lastUnitCostCents = 0;
      let returnDefectUnits = 0;
      let quotedUnits = 0;
      let warrantyIssueCount = 0;

      for (const v of product.variants) {
        returnDefectUnits +=
          (returnedByVariant.get(v.id) ?? 0) + (damagedByVariant.get(v.id) ?? 0);
        quotedUnits += quotedByVariant.get(v.id) ?? 0;
        warrantyIssueCount += warrantyIssuesByVariant.get(v.id) ?? 0;

        for (const ol of v.orderLines) {
          if (ol.order && ol.order.orderStatus !== 'CANCELLED') {
            if (String(ol.order.source).toUpperCase() === 'WALK_IN') {
              walkInSoldQty += ol.quantity;
            } else {
              onlineSoldQty += ol.quantity;
            }
          }
        }

        for (const res of v.reservations) {
          if (String(res.source).toUpperCase() === 'WALK_IN') {
            walkInResUnits += res.quantity;
          } else {
            onlineResUnits += res.quantity;
          }
          if (res.status === 'EXPIRED' || res.status === 'CANCELLED') {
            unfulfilledResUnits += res.quantity;
          }
        }

        // Only count the latest manifest revision per non-closed shipment to avoid double-counting revisions
        const latestRevByShipment = new Map<string, { rev: number; qty: number }>();
        for (const mi of v.manifestItems) {
          if (mi.unitCostCents > 0) {
            lastUnitCostCents = mi.unitCostCents;
          }
          const shp = mi.revision?.shipment;
          if (shp && shp.status !== 'CLOSED') {
            const revNum = mi.revision?.revision ?? 1;
            const prev = latestRevByShipment.get(shp.id);
            if (!prev || revNum > prev.rev) {
              latestRevByShipment.set(shp.id, { rev: revNum, qty: mi.quantity });
            } else if (revNum === prev.rev) {
              prev.qty += mi.quantity;
            }
          }
        }
        for (const entry of latestRevByShipment.values()) {
          inTransitQty += entry.qty;
        }
      }

      const totalSoldQty = onlineSoldQty + walkInSoldQty;
      const reservationUnits = onlineResUnits + walkInResUnits;
      const daysOnFloor = Math.max(
        1,
        Math.floor((nowMs - new Date(product.createdAt).getTime()) / 86_400_000),
      );
      const activeSalesWindowDays = Math.max(1, Math.min(daysOnFloor, 30));
      const rawMonthlyVelocity = (totalSoldQty / activeSalesWindowDays) * 30;
      // Boost velocity if product sold out or is low stock
      const stockoutMultiplier =
        availableStock === 0 && totalSoldQty > 0
          ? 1.5
          : availableStock <= 3 && totalSoldQty > 0
            ? 1.25
            : 1.0;
      const monthlyVelocity = Math.round(rawMonthlyVelocity * stockoutMultiplier * 10) / 10;

      const wishlistSaves = wishlistCountByProduct.get(product.id) ?? 0;
      const wishlistUnmet = Math.max(0, wishlistSaves - availableStock);

      const prodNameLower = product.name.toLowerCase();
      const prodCatLower = product.category.toLowerCase();
      const matchingRequests = openRequests.filter((req) => {
        if (req.variantId && product.variants.some((v) => v.id === req.variantId)) return true;
        const rName = (req.productName ?? '').toLowerCase();
        return (
          Boolean(rName) &&
          (prodNameLower.includes(rName) || rName.includes(prodNameLower))
        );
      });
      const openRequestUnits = matchingRequests.reduce((s, r) => s + r.quantity, 0);

      const matchingPolls = polls.filter((poll) => {
        const t = poll.title.toLowerCase();
        return t.includes(prodNameLower) || t.includes(prodCatLower);
      });
      const pollYesVotes = matchingPolls.reduce(
        (s, p) => s + p.votes.filter((v) => v.choice === 'YES').length,
        0,
      );

      const rawScore =
        totalSoldQty * 2.2 +
        monthlyVelocity * 1.6 +
        wishlistUnmet * 3.0 +
        wishlistSaves * 1.4 +
        openRequestUnits * 3.5 +
        reservationUnits * 1.8 +
        quotedUnits * 2.2 +
        pollYesVotes * 1.2 +
        (availableStock <= 5 ? 8 : 0) -
        returnDefectUnits * 3.0 -
        warrantyIssueCount * 2.5;
      const demandScore = Math.max(0, Math.round(rawScore));

      // Recommended manifest replenishment quantity covering ~45-day container lead time
      const leadTimeDemand = Math.ceil(monthlyVelocity * 1.5);
      const rawRecommendedQty =
        leadTimeDemand +
        openRequestUnits +
        Math.ceil(quotedUnits * 0.6) +
        Math.ceil(wishlistSaves * 0.4) +
        Math.ceil(reservationUnits * 0.5) -
        Math.floor(availableStock * 0.35) -
        inTransitQty;
      const recommendedQty = Math.max(
        2,
        rawRecommendedQty > 0 ? rawRecommendedQty : Math.max(2, totalSoldQty + openRequestUnits + wishlistSaves),
      );

      const walkInSignal = walkInSoldQty + walkInResUnits;
      const onlineSignal = onlineSoldQty + onlineResUnits + wishlistSaves + openRequestUnits;
      const dominantChannel: 'Walk-in mover' | 'Storefront demand' | 'Omnichannel (Online + Walk-in)' =
        walkInSignal > 0 && onlineSignal > 0
          ? 'Omnichannel (Online + Walk-in)'
          : walkInSignal > onlineSignal
            ? 'Walk-in mover'
            : 'Storefront demand';

      const priorityTier: 'HIGH' | 'MEDIUM' | 'EMERGING' =
        demandScore >= 18 || availableStock <= 3 || openRequestUnits > 0 || wishlistUnmet > 0
          ? 'HIGH'
          : demandScore >= 8
            ? 'MEDIUM'
            : 'EMERGING';

      const signalParts: string[] = [];
      if (totalSoldQty > 0) {
        signalParts.push(
          `${totalSoldQty} sold (${onlineSoldQty} Online, ${walkInSoldQty} Walk-in)`,
        );
      }
      if (reservationUnits > 0) {
        signalParts.push(`${reservationUnits} reserved`);
      }
      if (wishlistSaves > 0) {
        signalParts.push(`${wishlistSaves} wishlist ${wishlistSaves === 1 ? 'save' : 'saves'}`);
      }
      if (openRequestUnits > 0) {
        signalParts.push(`${openRequestUnits} requested`);
      }
      if (quotedUnits > 0) {
        signalParts.push(`${quotedUnits} quoted`);
      }
      if (pollYesVotes > 0) {
        signalParts.push(`${pollYesVotes} poll votes`);
      }
      signalParts.push(`${availableStock} currently in stock`);
      if (inTransitQty > 0) {
        signalParts.push(`${inTransitQty} already on planned/in-transit manifests`);
      }
      if (returnDefectUnits > 0 || warrantyIssueCount > 0) {
        signalParts.push(
          `${returnDefectUnits + warrantyIssueCount} return/warranty penalty applied`,
        );
      }

      restockRecommendations.push({
        productId: product.id,
        variantId: primaryVariant.id,
        sku: primaryVariant.sku,
        productName: product.name,
        variantName: primaryVariant.name ?? 'Standard',
        category: product.category,
        image: product.media[0]?.url ?? '/images/sofa.avif',
        demandScore,
        priorityTier,
        recommendedQty,
        dominantChannel,
        currentAvailable: availableStock,
        inTransitQty,
        onlineSoldQty,
        walkInSoldQty,
        monthlyVelocity,
        wishlistSaves,
        wishlistUnmet,
        openRequestUnits,
        reservationUnits,
        pollYesVotes,
        returnDefectUnits,
        lastUnitCostCents,
        rationale: signalParts.join(' · '),
      });

      // Check if product is a candidate for Dynamic Floor Aging Markdown
      if (
        product.isPublished &&
        availableStock >= 8 &&
        primaryVariant.priceCents > 0 &&
        totalSoldQty <= Math.floor(availableStock * 0.25)
      ) {
        const markdownPct = availableStock >= 20 || daysOnFloor >= 30 ? 15 : 10;
        const suggestedPriceCents = Math.round(
          (primaryVariant.priceCents * (100 - markdownPct)) / 100,
        );
        markdownCandidates.push({
          productId: product.id,
          variantId: primaryVariant.id,
          sku: primaryVariant.sku,
          productName: product.name,
          category: product.category,
          image: product.media[0]?.url ?? '/images/sofa.avif',
          daysOnFloor,
          availableStock,
          totalSoldQty,
          wishlistSaves,
          currentPriceCents: primaryVariant.priceCents,
          suggestedPriceCents,
          markdownPct,
          reason: `${availableStock} units occupying warehouse floor (${totalSoldQty} sold)${
            wishlistSaves > 0
              ? ` · ${wishlistSaves} customers have this saved in Wishlist and will see a Price Drop badge`
              : ''
          }`,
        });
      }
    }

    restockRecommendations.sort((a, b) => b.demandScore - a.demandScore);
    markdownCandidates.sort((a, b) => b.availableStock - a.availableStock);

    return {
      generatedAt: new Date().toISOString(),
      restockRecommendations,
      markdownCandidates,
    };
  }
}
