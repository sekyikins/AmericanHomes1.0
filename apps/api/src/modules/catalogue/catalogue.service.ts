import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PREP_ORDER = ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING', 'PRICING', 'FINAL_REVIEW'] as const;
const REQUIRED_PHYSICAL_STEPS = ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING'] as const;

export type PreparationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PREPARED';

export function deriveCompletedStageCount(product: {
  isPublished?: boolean;
  preparationSteps?: Array<{ step: string; status: string }>;
  variants?: Array<{ priceCents?: number }>;
}): number {
  const completedSteps = new Set(
    (product.preparationSteps ?? []).filter((s) => s.status === 'COMPLETED').map((s) => s.step),
  );
  let count = 0;
  if (completedSteps.has('INSPECTION')) count = 1;
  if (count === 1 && completedSteps.has('CLEANING')) count = 2;
  if (count === 2 && completedSteps.has('PHOTOGRAPHY')) count = 3;
  if (count === 3 && completedSteps.has('WRAPPING')) count = 4;
  const hasPositivePrice = (product.variants ?? []).some((v) => (v.priceCents ?? 0) > 0);
  if (count === 4 && (completedSteps.has('PRICING') || hasPositivePrice)) count = 5;
  if (count === 5 && (completedSteps.has('FINAL_REVIEW') || Boolean(product.isPublished))) count = 6;
  return count;
}

export function derivePreparationStatus(product: {
  isPublished?: boolean;
  preparationSteps?: Array<{ step: string; status: string }>;
  variants?: Array<{ priceCents?: number; pricingApprovals?: Array<{ status: string }> }>;
}): PreparationStatus {
  const completedCount = deriveCompletedStageCount(product);
  if (completedCount >= 6) {
    return 'PREPARED';
  }
  const hasAnyCompletedStep = (product.preparationSteps ?? []).some(
    (s) => s.status === 'COMPLETED',
  );
  const hasAnyPriceActivity = (product.variants ?? []).some(
    (v) => (v.priceCents ?? 0) > 0 || (v.pricingApprovals ?? []).length > 0,
  );
  if (completedCount > 0 || hasAnyCompletedStep || hasAnyPriceActivity) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  getPublishedProducts(query: ProductQueryDto) {
    return this.prisma.product.findMany({
      ...paginationParams(query),
      where: {
        isPublished: true,
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: {
        variants: {
          include: {
            attributes: { include: { attribute: true } },
            stockLots: { select: { available: true, held: true, unavailable: true } },
          },
        },
        media: { orderBy: { position: 'asc' } },
      },
    });
  }

  async getAllProductsAdmin(query: ProductQueryDto) {
    const [rows, shipments] = await Promise.all([
      this.prisma.product.findMany({
        ...paginationParams(query),
        where: {
          ...(query.category ? { category: query.category } : {}),
          ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
        },
        include: {
          variants: {
            include: {
              stockLots: true,
              attributes: { include: { attribute: true } },
            },
          },
          preparationSteps: true,
          media: { orderBy: { position: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shipment.findMany({
        select: {
          id: true,
          reference: true,
          expenses: { select: { amountCents: true } },
          manifestRevisions: {
            orderBy: { revision: 'desc' },
            take: 1,
            select: {
              items: {
                select: {
                  variantId: true,
                  productName: true,
                  quantity: true,
                  unitCostCents: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const shipmentByIdOrRef = new Map<
      string,
      (typeof shipments)[number] & { allocatedExpensePerUnitCents: number }
    >();
    const manifestCostByVariantId = new Map<
      string,
      { shipmentRef: string; unitCostCents: number; allocatedExpensePerUnitCents: number }
    >();
    const manifestCostByProductName = new Map<
      string,
      { shipmentRef: string; unitCostCents: number; allocatedExpensePerUnitCents: number }
    >();

    for (const shp of shipments) {
      const items = shp.manifestRevisions[0]?.items ?? [];
      const totalExp = shp.expenses.reduce((s, e) => s + e.amountCents, 0);
      const totalUnits = Math.max(
        1,
        items.reduce((s, i) => s + i.quantity, 0),
      );
      const totalManifestFobCents = items.reduce(
        (s, i) => s + Math.max(0, i.unitCostCents) * Math.max(1, i.quantity),
        0,
      );
      const allocatedExpensePerUnitCents = Math.round(totalExp / totalUnits);
      const enriched = { ...shp, allocatedExpensePerUnitCents };
      shipmentByIdOrRef.set(shp.id, enriched);
      shipmentByIdOrRef.set(shp.reference, enriched);

      for (const item of items) {
        // Allocate container freight, customs duty & clearing proportionally by FOB Cost Share when unit costs are present
        const lineFobCents = Math.max(0, item.unitCostCents) * Math.max(1, item.quantity);
        const itemAllocatedExpensePerUnitCents =
          totalManifestFobCents > 0 && item.unitCostCents > 0
            ? Math.round((totalExp * (lineFobCents / totalManifestFobCents)) / Math.max(1, item.quantity))
            : allocatedExpensePerUnitCents;

        const entry = {
          shipmentRef: shp.reference,
          unitCostCents: item.unitCostCents,
          allocatedExpensePerUnitCents: itemAllocatedExpensePerUnitCents,
        };
        if (item.variantId && !manifestCostByVariantId.has(item.variantId)) {
          manifestCostByVariantId.set(item.variantId, entry);
        }
        const keyName = item.productName.trim().toLowerCase();
        if (keyName && !manifestCostByProductName.has(keyName)) {
          manifestCostByProductName.set(keyName, entry);
        }
      }
    }

    // Repair any inconsistent prep steps or unpublished available lots in the background
    // so GET /catalogue/admin/products never blocks on sequential write-on-read round-trips.
    const backgroundRepairs: Array<Promise<unknown>> = [];
    for (const r of rows) {
      if (r.isPublished) {
        const stepNames = new Set((r.preparationSteps ?? []).map((s) => s.step));
        for (const reqStep of ['PRICING', 'FINAL_REVIEW'] as const) {
          if (!stepNames.has(reqStep)) {
            const now = new Date();
            r.preparationSteps.push({
              id: `pending-${r.id}-${reqStep}`,
              productId: r.id,
              step: reqStep,
              status: 'COMPLETED',
              completedBy: null,
              completedAt: now,
              notes: null,
            });
            backgroundRepairs.push(
              this.prisma.productPreparationRecord.upsert({
                where: { productId_step: { productId: r.id, step: reqStep } },
                update: { status: 'COMPLETED' },
                create: {
                  productId: r.id,
                  step: reqStep,
                  status: 'COMPLETED',
                  completedAt: now,
                },
              }),
            );
          }
        }
      } else {
        for (const v of r.variants) {
          for (const lot of v.stockLots) {
            if (lot.available > 0) {
              const moved = lot.available;
              lot.unavailable += moved;
              lot.available = 0;
              backgroundRepairs.push(
                this.prisma.stockLot.update({
                  where: { id: lot.id },
                  data: {
                    available: 0,
                    unavailable: { increment: moved },
                  },
                }),
              );
            }
          }
        }
      }
    }
    if (backgroundRepairs.length > 0) {
      void Promise.allSettled(backgroundRepairs);
    }

    return rows.map((r) => {
      const firstVariantId = r.variants[0]?.id;
      const matchedManifest =
        (firstVariantId ? manifestCostByVariantId.get(firstVariantId) : undefined) ??
        manifestCostByProductName.get(r.name.trim().toLowerCase());
      const matchedShipment = r.shipmentId ? shipmentByIdOrRef.get(r.shipmentId) : undefined;

      const shipmentReference =
        matchedShipment?.reference ??
        matchedManifest?.shipmentRef ??
        (r.shipmentId || 'Warehouse');
      const unitAcquisitionCostCents = matchedManifest?.unitCostCents ?? 0;
      const allocatedFreightAndDutyCents =
        matchedManifest?.allocatedExpensePerUnitCents ??
        matchedShipment?.allocatedExpensePerUnitCents ??
        0;
      const estimatedLandedCostCents = unitAcquisitionCostCents + allocatedFreightAndDutyCents;

      return {
        ...r,
        shipmentReference,
        unitAcquisitionCostCents,
        allocatedFreightAndDutyCents,
        estimatedLandedCostCents,
        completedStageCount: deriveCompletedStageCount(r),
        preparationStatus: derivePreparationStatus(r),
      };
    });
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            attributes: { include: { attribute: true } },
            stockLots: { select: { available: true, held: true, unavailable: true } },
          },
        },
        media: { orderBy: { position: 'asc' } },
        preparationSteps: true,
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return {
      ...product,
      completedStageCount: deriveCompletedStageCount(product),
      preparationStatus: derivePreparationStatus(product),
    };
  }

  async createProduct(
    dto: CreateProductDto & {
      initialVariantName?: string;
      initialAttributes?: Record<string, string>;
    },
    staffId?: string,
  ) {
    const skuBase = dto.name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'ITEM';
    const sku = `AH-${skuBase}-${Date.now().toString().slice(-4)}`;
    const initialQty = Math.max(1, dto.initialQuantity ?? 1);
    const attrEntries = Object.entries(dto.initialAttributes ?? {})
      .map(([k, v]) => [k.trim(), String(v).trim()] as const)
      .filter(([k, v]) => Boolean(k && v));
    const derivedVariantName =
      dto.initialVariantName?.trim() ||
      (attrEntries.length > 0 ? attrEntries.map(([, v]) => v).join(' / ') : 'Standard');

    const created = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        brand: dto.brand,
        model: dto.model,
        specifications: dto.specifications,
        condition: dto.condition ?? 'GOOD',
        disposition: dto.disposition ?? 'NORMAL_SALE',
        defectDisclosures: dto.defectDisclosures,
        shipmentId: dto.shipmentId,
        isPublished: false,
        variants: {
          create: {
            sku,
            name: derivedVariantName,
            priceCents: 0,
            stockLots: {
              create: {
                quantity: initialQty,
                available: 0,
                held: 0,
                unavailable: initialQty,
                condition: dto.condition ?? 'GOOD',
              },
            },
          },
        },
      },
      include: {
        variants: { include: { stockLots: true, attributes: { include: { attribute: true } } } },
        media: { orderBy: { position: 'asc' } },
        preparationSteps: true,
      },
    });

    const firstVariant = created.variants[0];
    if (firstVariant && attrEntries.length > 0) {
      for (const [attrName, attrValue] of attrEntries) {
        const attr = await this.prisma.productAttribute.upsert({
          where: { name: attrName },
          update: {},
          create: { name: attrName },
        });
        await this.prisma.productVariantAttribute.create({
          data: { variantId: firstVariant.id, attributeId: attr.id, value: attrValue },
        });
      }
    }

    const firstLot = created.variants[0]?.stockLots[0];
    if (firstLot) {
      await this.prisma.inventoryMovement.create({
        data: {
          lotId: firstLot.id,
          quantity: initialQty,
          reason: 'DRAFT_CREATED_UNAVAILABLE',
          referenceType: 'PRODUCT_DRAFT',
          referenceId: created.id,
          actorId: staffId,
        },
      });
    }

    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: created.id,
      after: { name: created.name, category: created.category, sku, initialQty },
    });

    return {
      ...created,
      preparationStatus: derivePreparationStatus(created),
    };
  }

  async addProductMedia(
    productId: string,
    dto: string | { url?: string; urls?: string[]; type?: string },
    typeOrStaffId?: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const urls =
      typeof dto === 'string'
        ? [dto]
        : [
            ...(dto.url ? [dto.url] : []),
            ...(Array.isArray(dto.urls) ? dto.urls : []),
          ].filter(Boolean);
    const mediaType = typeof dto === 'string' ? (typeOrStaffId ?? 'IMAGE') : (dto.type ?? 'IMAGE');
    const staffId = typeof dto === 'string' ? undefined : typeOrStaffId;

    if (urls.length === 0) {
      throw new BadRequestException('At least one media URL is required');
    }

    const baseCount = await this.prisma.productMedia.count({ where: { productId } });
    const createdRecords = [];
    for (let i = 0; i < urls.length; i++) {
      const record = await this.prisma.productMedia.create({
        data: {
          productId,
          url: urls[i],
          type: mediaType,
          position: baseCount + i,
        },
      });
      createdRecords.push(record);
    }

    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_MEDIA_ADDED',
      entityType: 'Product',
      entityId: productId,
      after: { addedCount: createdRecords.length, urls },
    });

    return createdRecords.length === 1 ? createdRecords[0] : createdRecords;
  }

  async removeProductMedia(productId: string, mediaId: string, staffId?: string) {
    const existing = await this.prisma.productMedia.findFirst({
      where: { id: mediaId, productId },
    });
    if (!existing) throw new NotFoundException(`ProductMedia ${mediaId} not found`);
    await this.prisma.productMedia.delete({ where: { id: mediaId } });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_MEDIA_REMOVED',
      entityType: 'Product',
      entityId: productId,
      before: { mediaId, url: existing.url },
    });
    return { removed: true, id: mediaId };
  }

  async syncProductMedia(
    productId: string,
    dto: { urls: string[]; type?: string },
    staffId?: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const urls = (Array.isArray(dto.urls) ? dto.urls : []).map((u) => String(u).trim()).filter(Boolean);
    if (urls.length === 0) {
      throw new BadRequestException('At least one product photo is required');
    }
    const mediaType = dto.type ?? 'IMAGE';

    const createdRecords = await this.prisma.$transaction(async (tx) => {
      await tx.productMedia.deleteMany({ where: { productId } });
      const rows = [];
      for (let i = 0; i < urls.length; i++) {
        const rec = await tx.productMedia.create({
          data: {
            productId,
            url: urls[i],
            type: mediaType,
            position: i,
          },
        });
        rows.push(rec);
      }
      return rows;
    });

    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_MEDIA_SYNCED',
      entityType: 'Product',
      entityId: productId,
      after: { count: createdRecords.length, primaryUrl: urls[0], urls },
    });

    return createdRecords;
  }

  async updateProduct(id: string, dto: UpdateProductDto, staffId?: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    const updated = await this.prisma.product.update({ where: { id }, data: dto });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      before: { name: existing.name, category: existing.category },
      after: { name: updated.name, category: updated.category },
    });
    return updated;
  }

  async createVariant(
    productId: string,
    dto: {
      sku?: string;
      name?: string;
      priceCents: number;
      initialQuantity?: number;
      attributes?: Record<string, string>;
    },
    staffId?: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const attrEntries = Object.entries(dto.attributes ?? {})
      .map(([k, v]) => [k.trim(), String(v).trim()] as const)
      .filter(([k, v]) => Boolean(k && v));
    const derivedName =
      dto.name?.trim() ||
      (attrEntries.length > 0 ? attrEntries.map(([, v]) => v).join(' / ') : 'Standard');
    const sku = dto.sku?.trim() || `AH-${productId.slice(-5).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const initialQty = Math.max(1, Math.round(dto.initialQuantity ?? 1));

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        name: derivedName,
        priceCents: Math.max(0, Math.round(dto.priceCents ?? 0)),
        stockLots: {
          create: {
            quantity: initialQty,
            available: product.isPublished ? initialQty : 0,
            held: 0,
            unavailable: product.isPublished ? 0 : initialQty,
            condition: product.condition ?? 'GOOD',
          },
        },
      },
      include: { stockLots: true },
    });

    for (const [attrName, attrValue] of attrEntries) {
      const attr = await this.prisma.productAttribute.upsert({
        where: { name: attrName },
        update: {},
        create: { name: attrName },
      });
      await this.prisma.productVariantAttribute.create({
        data: { variantId: variant.id, attributeId: attr.id, value: attrValue },
      });
    }

    if (variant.stockLots[0]) {
      await this.prisma.inventoryMovement.create({
        data: {
          lotId: variant.stockLots[0].id,
          quantity: initialQty,
          reason: product.isPublished ? 'VARIANT_CREATED_AVAILABLE' : 'VARIANT_CREATED_UNAVAILABLE',
          referenceType: 'PRODUCT_VARIANT',
          referenceId: variant.id,
          actorId: staffId,
        },
      });
    }

    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_VARIANT_CREATED',
      entityType: 'ProductVariant',
      entityId: variant.id,
      after: {
        productId,
        sku,
        name: derivedName,
        priceCents: variant.priceCents,
        initialQty,
        attributes: dto.attributes,
      },
    });

    return this.prisma.productVariant.findUnique({
      where: { id: variant.id },
      include: { attributes: { include: { attribute: true } }, stockLots: true },
    });
  }

  async completePreparationStep(
    productId: string,
    staffId: string,
    dto: { step: string; notes?: string },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { preparationSteps: true, media: true },
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    if (!PREP_ORDER.includes(dto.step as (typeof PREP_ORDER)[number])) {
      throw new BadRequestException(`Invalid preparation step: ${dto.step}`);
    }

    const done = new Set(
      product.preparationSteps.filter((s) => s.status === 'COMPLETED').map((s) => s.step),
    );
    if (dto.step === 'CLEANING' && !done.has('INSPECTION')) {
      throw new BadRequestException('Cleaning cannot be completed before Inspection');
    }
    if (dto.step === 'PHOTOGRAPHY') {
      if (!done.has('INSPECTION') || !done.has('CLEANING')) {
        throw new BadRequestException('Photography cannot be completed before Inspection and Cleaning');
      }
      if ((product.media ?? []).length === 0) {
        throw new BadRequestException('Upload at least one product photo before completing Photography');
      }
    }
    if (dto.step === 'WRAPPING') {
      if (!done.has('INSPECTION') || !done.has('CLEANING') || !done.has('PHOTOGRAPHY')) {
        throw new BadRequestException('Wrapping cannot be completed before Photography');
      }
    }

    const isUpdate = done.has(dto.step);
    const record = await this.prisma.productPreparationRecord.upsert({
      where: { productId_step: { productId, step: dto.step } },
      update: { status: 'COMPLETED', completedBy: staffId, completedAt: new Date(), notes: dto.notes },
      create: {
        productId,
        step: dto.step,
        status: 'COMPLETED',
        completedBy: staffId,
        completedAt: new Date(),
        notes: dto.notes,
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: isUpdate ? 'PREPARATION_STEP_UPDATED' : 'PREPARATION_STEP_COMPLETED',
      entityType: 'Product',
      entityId: productId,
      after: { step: dto.step, notes: dto.notes },
    });
    return record;
  }

  async revertPreparation(
    productId: string,
    staffId: string,
    dto: { step?: string; resetAll?: boolean },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { include: { stockLots: true } },
        preparationSteps: true,
      },
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    if (dto.resetAll) {
      await this.prisma.productPreparationRecord.deleteMany({
        where: { productId },
      });
      await this.prisma.productVariant.updateMany({
        where: { productId },
        data: { priceCents: 0 },
      });

      for (const variant of product.variants) {
        for (const lot of variant.stockLots) {
          if (lot.available > 0) {
            const moved = lot.available;
            await this.prisma.stockLot.update({
              where: { id: lot.id },
              data: {
                available: 0,
                unavailable: { increment: moved },
              },
            });
            await this.prisma.inventoryMovement.create({
              data: {
                lotId: lot.id,
                quantity: -moved,
                reason: 'PREPARATION_RESTARTED_UNAVAILABLE',
                referenceType: 'PRODUCT',
                referenceId: productId,
                actorId: staffId,
              },
            });
          }
        }
      }

      if (product.isPublished) {
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            isPublished: false,
            unpublishReason: 'Preparation restarted',
            unpublishedBy: staffId,
            unpublishedAt: new Date(),
          },
        });
      }

      await this.audit.record({
        actorId: staffId,
        action: 'PREPARATION_RESTARTED',
        entityType: 'Product',
        entityId: productId,
        before: {
          isPublished: product.isPublished,
          completedSteps: product.preparationSteps.map((s) => s.step),
        },
        after: { isPublished: false, preparationStatus: 'NOT_STARTED' },
      });
      return this.getProductById(productId);
    }

    const stepToRevert = dto.step?.toUpperCase();
    const stepIdx = stepToRevert
      ? PREP_ORDER.indexOf(stepToRevert as (typeof PREP_ORDER)[number])
      : -1;
    if (stepIdx === -1) {
      throw new BadRequestException(`Invalid preparation step to revert: ${dto.step ?? ''}`);
    }

    const stepsToDelete = PREP_ORDER.slice(stepIdx);
    await this.prisma.productPreparationRecord.deleteMany({
      where: {
        productId,
        step: { in: [...stepsToDelete] },
      },
    });
    if (stepsToDelete.includes('PRICING')) {
      await this.prisma.productVariant.updateMany({
        where: { productId },
        data: { priceCents: 0 },
      });
    }

    for (const variant of product.variants) {
      for (const lot of variant.stockLots) {
        if (lot.available > 0) {
          const moved = lot.available;
          await this.prisma.stockLot.update({
            where: { id: lot.id },
            data: {
              available: 0,
              unavailable: { increment: moved },
            },
          });
          await this.prisma.inventoryMovement.create({
            data: {
              lotId: lot.id,
              quantity: -moved,
              reason: 'PREPARATION_STEP_REVERTED_UNAVAILABLE',
              referenceType: 'PRODUCT',
              referenceId: productId,
              actorId: staffId,
            },
          });
        }
      }
    }

    if (product.isPublished) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          isPublished: false,
          unpublishReason: `Preparation step ${stepToRevert} reopened`,
          unpublishedBy: staffId,
          unpublishedAt: new Date(),
        },
      });
    }

    await this.audit.record({
      actorId: staffId,
      action: 'PREPARATION_STEP_REVERTED',
      entityType: 'Product',
      entityId: productId,
      before: { isPublished: product.isPublished },
      after: { revertedFromStep: stepToRevert, removedSteps: stepsToDelete },
    });

    return this.getProductById(productId);
  }

  async proposePrice(
    variantId: string,
    staffId: string,
    dto: { proposedPriceCents: number; reason?: string; comparableRef?: string; notes?: string },
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { preparationSteps: true } } },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

    const doneSteps = new Set(
      (variant.product?.preparationSteps ?? [])
        .filter((s) => s.status === 'COMPLETED')
        .map((s) => s.step),
    );
    const allPhysicalDone = REQUIRED_PHYSICAL_STEPS.every((s) => doneSteps.has(s));
    if (!allPhysicalDone) {
      throw new BadRequestException(
        'Cannot propose price until Inspection, Cleaning, Photography, and Wrapping are completed',
      );
    }

    // Dual-control safeguard: If the product is already live/published on the storefront with an active price,
    // keep the existing approved storefront price until a second manager approves the PricingApproval.
    const isInitialDraftPricing = !variant.product?.isPublished || variant.priceCents <= 0;
    const now = new Date();
    const [approval] = await Promise.all([
      this.prisma.pricingApproval.create({
        data: {
          variantId,
          previousPriceCents: variant.priceCents,
          proposedPriceCents: dto.proposedPriceCents,
          reason: dto.reason,
          comparableRef: dto.comparableRef,
          notes: dto.notes,
          initiatedBy: staffId,
          status: 'PENDING',
        },
      }),
      isInitialDraftPricing
        ? this.prisma.productVariant.update({
            where: { id: variantId },
            data: { priceCents: dto.proposedPriceCents },
          })
        : Promise.resolve(null),
      this.prisma.productPreparationRecord.upsert({
        where: { productId_step: { productId: variant.productId, step: 'PRICING' } },
        update: {
          status: 'COMPLETED',
          completedBy: staffId,
          completedAt: now,
          notes: dto.reason ?? dto.notes ?? 'Initial retail pricing',
        },
        create: {
          productId: variant.productId,
          step: 'PRICING',
          status: 'COMPLETED',
          completedBy: staffId,
          completedAt: now,
          notes: dto.reason ?? dto.notes ?? 'Initial retail pricing',
        },
      }),
    ]);

    void this.audit
      .record({
        actorId: staffId,
        action: 'PRICE_PROPOSED',
        entityType: 'PricingApproval',
        entityId: approval.id,
        before: { priceCents: variant.priceCents },
        after: {
          proposedPriceCents: dto.proposedPriceCents,
          reason: dto.reason,
          appliedImmediatelyToDraft: isInitialDraftPricing,
        },
      })
      .catch(() => null);
    return approval;
  }

  async listPriceApprovals(status?: string) {
    const approvals = await this.prisma.pricingApproval.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const variantIds = Array.from(new Set(approvals.map((a) => a.variantId)));
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { select: { id: true, name: true, category: true, isPublished: true } } },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    return approvals.map((a) => ({
      ...a,
      variant: variantMap.get(a.variantId) ?? null,
    }));
  }

  private async notifyWishlistAndPollCustomers(
    productId: string,
    productName: string,
    eventType: 'PRICE_DROP' | 'PUBLISHED',
    details?: { previousPriceCents?: number; newPriceCents?: number },
  ) {
    try {
      const wishlistRows = await this.prisma.systemSetting.findMany({
        where: { key: { startsWith: 'WISHLIST:' } },
      });
      const notifiedUserIds = new Set<string>();

      for (const row of wishlistRows) {
        const userId = row.key.replace('WISHLIST:', '').trim();
        if (!userId) continue;
        try {
          const parsed = JSON.parse(row.value);
          if (!Array.isArray(parsed)) continue;
          const hasProduct = parsed.some((item) => item && item.productId === productId);
          if (!hasProduct) continue;

          notifiedUserIds.add(userId);
          if (eventType === 'PRICE_DROP' && details?.newPriceCents && details?.previousPriceCents) {
            const dropGhs = ((details.previousPriceCents - details.newPriceCents) / 100).toLocaleString();
            const newGhs = (details.newPriceCents / 100).toLocaleString();
            await this.prisma.notificationMessage.create({
              data: {
                userId,
                type: 'PROMOTIONS',
                referenceId: productId,
                title: `Price dropped on "${productName}"!`,
                body: `Good news! An item in your Saved Wishlist ("${productName}") dropped by GHS ${dropGhs} and is now GHS ${newGhs}.`,
              },
            });
          } else if (eventType === 'PUBLISHED') {
            await this.prisma.notificationMessage.create({
              data: {
                userId,
                type: 'AVAILABILITY',
                referenceId: productId,
                title: `"${productName}" is now available!`,
                body: `Your saved item "${productName}" has completed preparation and is now available for order or reservation.`,
              },
            });
          }
        } catch {
          // ignore malformed row
        }
      }

      if (eventType === 'PUBLISHED') {
        const matchingPolls = await this.prisma.productPoll.findMany({
          where: {
            title: { contains: productName.split(' ').slice(0, 2).join(' '), mode: 'insensitive' },
          },
          include: {
            votes: {
              where: { choice: 'YES' },
              include: { customer: { select: { userId: true } } },
            },
          },
        });
        for (const poll of matchingPolls) {
          for (const vote of poll.votes) {
            const voterUserId = vote.customer?.userId;
            if (voterUserId && !notifiedUserIds.has(voterUserId)) {
              notifiedUserIds.add(voterUserId);
              await this.prisma.notificationMessage.create({
                data: {
                  userId: voterUserId,
                  type: 'AVAILABILITY',
                  referenceId: productId,
                  title: `Poll winner "${productName}" has arrived!`,
                  body: `You voted YES for "${poll.title}" — "${productName}" is now prepared, published, and available in the storefront.`,
                },
              });
            }
          }
        }
      }
    } catch {
      // Non-blocking notification fan-out
    }
  }

  async approvePrice(approvalId: string, staffId: string, isOwner = false) {
    const approval = await this.prisma.pricingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException(`PricingApproval ${approvalId} not found`);
    if (!isOwner && approval.initiatedBy === staffId) {
      throw new ForbiddenException('Self-approval is prohibited for pricing approvals');
    }

    const variant = await this.prisma.productVariant.update({
      where: { id: approval.variantId },
      data: { priceCents: approval.proposedPriceCents },
    });
    const updated = await this.prisma.pricingApproval.update({
      where: { id: approvalId },
      data: { status: 'APPROVED', approvedBy: staffId, resolvedAt: new Date() },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'PRICE_APPROVED',
      entityType: 'PricingApproval',
      entityId: approvalId,
      before: { priceCents: approval.previousPriceCents },
      after: { priceCents: approval.proposedPriceCents },
    });

    const parentProduct = await this.prisma.product.findUnique({
      where: { id: variant.productId },
      include: { preparationSteps: true },
    });

    // If this approval is a markdown/price-drop, automatically alert all customers who saved this product in their Wishlist
    if (
      parentProduct &&
      approval.previousPriceCents &&
      approval.previousPriceCents > 0 &&
      approval.proposedPriceCents < approval.previousPriceCents
    ) {
      await this.notifyWishlistAndPollCustomers(
        parentProduct.id,
        parentProduct.name,
        'PRICE_DROP',
        {
          previousPriceCents: approval.previousPriceCents,
          newPriceCents: approval.proposedPriceCents,
        },
      );
    }

    // If all physical preparation steps are already completed, automatically publish the prepared product
    if (parentProduct && !parentProduct.isPublished) {
      const doneSteps = new Set(
        parentProduct.preparationSteps.filter((s) => s.status === 'COMPLETED').map((s) => s.step),
      );
      const allPhysicalDone = REQUIRED_PHYSICAL_STEPS.every((s) => doneSteps.has(s));
      if (allPhysicalDone) {
        await this.publishProduct(parentProduct.id, staffId).catch(() => null);
      }
    }

    return updated;
  }

  async rejectPrice(approvalId: string, staffId: string, notes?: string) {
    const approval = await this.prisma.pricingApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException(`PricingApproval ${approvalId} not found`);
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`PricingApproval is already ${approval.status}`);
    }

    // Restore previous price if variant was modified during draft stage
    if (typeof approval.previousPriceCents === 'number' && approval.previousPriceCents >= 0) {
      await this.prisma.productVariant.update({
        where: { id: approval.variantId },
        data: { priceCents: approval.previousPriceCents },
      });
    }

    const updated = await this.prisma.pricingApproval.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        approvedBy: staffId,
        notes: notes ?? approval.notes,
        resolvedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: staffId,
      approverId: staffId,
      action: 'PRICE_REJECTED',
      entityType: 'PricingApproval',
      entityId: approvalId,
      before: { proposedPriceCents: approval.proposedPriceCents },
      after: { status: 'REJECTED', restoredPriceCents: approval.previousPriceCents, notes },
    });
    return updated;
  }

  async publishProduct(id: string, staffId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            stockLots: true,
          },
        },
        preparationSteps: true,
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    if (product.variants.length === 0) {
      throw new BadRequestException('Cannot publish: product must have at least one variant');
    }
    if (!['NORMAL_SALE', 'DISCOUNTED_SALE'].includes(product.disposition)) {
      throw new BadRequestException(
        `Cannot publish: product disposition "${product.disposition}" is not saleable`,
      );
    }

    const completedSteps = new Set(
      product.preparationSteps.filter((s) => s.status === 'COMPLETED').map((s) => s.step),
    );
    for (const requiredStep of REQUIRED_PHYSICAL_STEPS) {
      if (!completedSteps.has(requiredStep)) {
        throw new BadRequestException(
          `Cannot publish: preparation step "${requiredStep}" is not completed`,
        );
      }
    }

    const variantIds = product.variants.map((v) => v.id);
    const pendingProposals = await this.prisma.pricingApproval.findMany({
      where: { variantId: { in: variantIds }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    for (const pendingProposal of pendingProposals) {
      if (pendingProposal.proposedPriceCents > 0) {
        await this.prisma.productVariant.update({
          where: { id: pendingProposal.variantId },
          data: { priceCents: pendingProposal.proposedPriceCents },
        });
      }
      await this.prisma.pricingApproval.update({
        where: { id: pendingProposal.id },
        data: { status: 'APPROVED', approvedBy: staffId, resolvedAt: new Date() },
      });
    }

    const approvedPrice = await this.prisma.pricingApproval.findFirst({
      where: { variantId: { in: variantIds }, status: 'APPROVED' },
    });
    const hasPositivePrice =
      product.variants.some((v) => v.priceCents > 0) ||
      pendingProposals.some((p) => p.proposedPriceCents > 0);
    if (!approvedPrice && !hasPositivePrice) {
      throw new BadRequestException('Cannot publish: an approved selling price is required');
    }

    // Automatically move unavailable onboarding stock to available saleable inventory
    let totalAvailable = 0;
    for (const variant of product.variants) {
      if (variant.stockLots.length === 0) {
        const newLot = await this.prisma.stockLot.create({
          data: {
            variantId: variant.id,
            quantity: 1,
            available: 1,
            held: 0,
            unavailable: 0,
            condition: product.condition ?? 'GOOD',
          },
        });
        await this.prisma.inventoryMovement.create({
          data: {
            lotId: newLot.id,
            quantity: 1,
            reason: 'ONBOARDING_COMPLETED_AVAILABLE',
            referenceType: 'PRODUCT',
            referenceId: id,
            actorId: staffId,
          },
        });
        totalAvailable += 1;
      } else {
        for (const lot of variant.stockLots) {
          if (lot.unavailable > 0) {
            const moveQty = lot.unavailable;
            await this.prisma.stockLot.update({
              where: { id: lot.id },
              data: {
                unavailable: 0,
                available: { increment: moveQty },
              },
            });
            await this.prisma.inventoryMovement.create({
              data: {
                lotId: lot.id,
                quantity: moveQty,
                reason: 'ONBOARDING_COMPLETED_AVAILABLE',
                referenceType: 'PRODUCT',
                referenceId: id,
                actorId: staffId,
              },
            });
            totalAvailable += lot.available + moveQty;
          } else {
            totalAvailable += lot.available;
          }
        }
      }
    }

    if (totalAvailable <= 0) {
      throw new BadRequestException('Cannot publish: no available stock on hand');
    }

    for (const stepName of ['PRICING', 'FINAL_REVIEW'] as const) {
      await this.prisma.productPreparationRecord.upsert({
        where: { productId_step: { productId: id, step: stepName } },
        update: { status: 'COMPLETED', completedBy: staffId, completedAt: new Date() },
        create: {
          productId: id,
          step: stepName,
          status: 'COMPLETED',
          completedBy: staffId,
          completedAt: new Date(),
        },
      });
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isPublished: true, unpublishReason: null },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_PUBLISHED',
      entityType: 'Product',
      entityId: id,
      after: { isPublished: true, availableStock: totalAvailable },
    });
    await this.notifyWishlistAndPollCustomers(id, product.name, 'PUBLISHED');
    return updated;
  }

  // --- Serialized / Individual Tracked Units (Appliances, Electronics & Open-Box Scratch-and-Dent) ---
  async listTrackedUnits(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    const variantIds = product.variants.map((v) => v.id);
    return this.prisma.trackedUnit.findMany({
      where: { variantId: { in: variantIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTrackedUnit(
    productId: string,
    dto: {
      unitCode?: string;
      condition?: string;
      defectNotes?: string;
      status?: string;
      lotId?: string;
    },
    staffId?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { include: { stockLots: true } } },
    });
    if (!product || product.variants.length === 0) {
      throw new NotFoundException(`Product ${productId} or its variant not found`);
    }
    const primaryVariant = product.variants[0];
    const primaryLot = dto.lotId ?? primaryVariant.stockLots[0]?.id;
    const unitCode =
      dto.unitCode?.trim() ||
      `${primaryVariant.sku}-SN${Date.now().toString().slice(-5)}`;

    const created = await this.prisma.trackedUnit.create({
      data: {
        variantId: primaryVariant.id,
        lotId: primaryLot,
        unitCode,
        condition: dto.condition ?? product.condition ?? 'GOOD',
        defectNotes: dto.defectNotes,
        status: dto.status ?? (product.isPublished ? 'AVAILABLE' : 'UNAVAILABLE'),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'TRACKED_UNIT_REGISTERED',
      entityType: 'TrackedUnit',
      entityId: created.id,
      after: { productId, unitCode: created.unitCode, condition: created.condition },
    });
    return created;
  }

  async updateTrackedUnit(
    unitId: string,
    dto: { condition?: string; defectNotes?: string; status?: string },
    staffId?: string,
  ) {
    const existing = await this.prisma.trackedUnit.findUnique({ where: { id: unitId } });
    if (!existing) throw new NotFoundException(`TrackedUnit ${unitId} not found`);
    const updated = await this.prisma.trackedUnit.update({
      where: { id: unitId },
      data: {
        ...(dto.condition ? { condition: dto.condition } : {}),
        ...(dto.defectNotes !== undefined ? { defectNotes: dto.defectNotes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'TRACKED_UNIT_UPDATED',
      entityType: 'TrackedUnit',
      entityId: unitId,
      before: { condition: existing.condition, status: existing.status },
      after: { condition: updated.condition, status: updated.status },
    });
    return updated;
  }

  async unpublishProduct(id: string, staffId?: string, reason?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { include: { stockLots: true } } },
    });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    if (existing.isPublished) {
      for (const stepName of ['PRICING', 'FINAL_REVIEW'] as const) {
        await this.prisma.productPreparationRecord.upsert({
          where: { productId_step: { productId: id, step: stepName } },
          update: { status: 'COMPLETED' },
          create: {
            productId: id,
            step: stepName,
            status: 'COMPLETED',
            completedBy: staffId,
            completedAt: new Date(),
          },
        });
      }
    }
    for (const variant of existing.variants) {
      for (const lot of variant.stockLots) {
        if (lot.available > 0) {
          const moved = lot.available;
          await this.prisma.stockLot.update({
            where: { id: lot.id },
            data: {
              available: 0,
              unavailable: { increment: moved },
            },
          });
          await this.prisma.inventoryMovement.create({
            data: {
              lotId: lot.id,
              quantity: -moved,
              reason: 'PRODUCT_UNPUBLISHED_WITHHELD',
              referenceType: 'PRODUCT',
              referenceId: id,
              actorId: staffId,
            },
          });
        }
      }
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        isPublished: false,
        unpublishReason: reason ?? 'Unpublished by staff',
        unpublishedBy: staffId,
        unpublishedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'PRODUCT_UNPUBLISHED',
      entityType: 'Product',
      entityId: id,
      before: { isPublished: existing.isPublished },
      after: { isPublished: false, reason: updated.unpublishReason },
    });
    return updated;
  }

  // --- Customer Wishlist / Saved Items (Guest-to-Account Hybrid Storage & Sync) ---
  private wishlistSettingKey(userId: string): string {
    return `WISHLIST:${userId}`;
  }

  private async readStoredWishlist(userId: string): Promise<
    Array<{
      productId: string;
      variantId?: string | null;
      priceAtSaveCents?: number;
      addedAt: string;
    }>
  > {
    const key = this.wishlistSettingKey(userId);
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row || !row.value) return [];
    try {
      const parsed = JSON.parse(row.value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item.productId === 'string' && item.productId.trim())
        .map((item) => ({
          productId: String(item.productId).trim(),
          variantId: item.variantId ? String(item.variantId) : null,
          priceAtSaveCents:
            typeof item.priceAtSaveCents === 'number' && Number.isFinite(item.priceAtSaveCents)
              ? item.priceAtSaveCents
              : undefined,
          addedAt:
            typeof item.addedAt === 'string' && item.addedAt
              ? item.addedAt
              : new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  private async writeStoredWishlist(
    userId: string,
    items: Array<{
      productId: string;
      variantId?: string | null;
      priceAtSaveCents?: number;
      addedAt: string;
    }>,
  ) {
    const key = this.wishlistSettingKey(userId);
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(items),
        updatedBy: userId,
      },
      create: {
        key,
        value: JSON.stringify(items),
        description: `Saved wishlist items for user ${userId}`,
        updatedBy: userId,
      },
    });
  }

  async getCustomerWishlist(userId: string) {
    const stored = await this.readStoredWishlist(userId);
    if (stored.length === 0) {
      return { items: [], count: 0 };
    }
    const productIds = Array.from(new Set(stored.map((s) => s.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: {
          include: {
            attributes: { include: { attribute: true } },
            stockLots: { select: { available: true, held: true, unavailable: true } },
          },
        },
        media: { orderBy: { position: 'asc' } },
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const validStored = stored.filter((s) => productMap.has(s.productId));
    if (validStored.length !== stored.length) {
      await this.writeStoredWishlist(userId, validStored);
    }

    const hydrated = validStored.map((s) => ({
      ...s,
      product: productMap.get(s.productId) ?? null,
    }));
    return {
      items: hydrated,
      count: hydrated.length,
    };
  }

  async addCustomerWishlistItem(
    userId: string,
    dto: {
      productId: string;
      variantId?: string | null;
      priceAtSaveCents?: number;
      addedAt?: string;
    },
  ) {
    if (!dto.productId || !dto.productId.trim()) {
      throw new BadRequestException('productId is required');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const stored = await this.readStoredWishlist(userId);
    const existingIdx = stored.findIndex((s) => s.productId === dto.productId);
    const defaultPriceCents =
      dto.priceAtSaveCents ?? product.variants[0]?.priceCents ?? undefined;
    const entry = {
      productId: product.id,
      variantId: dto.variantId ?? product.variants[0]?.id ?? null,
      priceAtSaveCents: defaultPriceCents,
      addedAt: dto.addedAt ?? new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      stored[existingIdx] = {
        ...stored[existingIdx],
        variantId: entry.variantId ?? stored[existingIdx].variantId,
        priceAtSaveCents: stored[existingIdx].priceAtSaveCents ?? entry.priceAtSaveCents,
      };
    } else {
      stored.unshift(entry);
    }

    await this.writeStoredWishlist(userId, stored);
    return this.getCustomerWishlist(userId);
  }

  async removeCustomerWishlistItem(userId: string, productId: string) {
    const stored = await this.readStoredWishlist(userId);
    const next = stored.filter((s) => s.productId !== productId);
    if (next.length !== stored.length) {
      await this.writeStoredWishlist(userId, next);
    }
    return this.getCustomerWishlist(userId);
  }

  async mergeCustomerWishlist(
    userId: string,
    guestItems: Array<{
      productId: string;
      variantId?: string | null;
      priceAtSaveCents?: number;
      addedAt?: string;
    }>,
  ) {
    const stored = await this.readStoredWishlist(userId);
    const existingIds = new Set(stored.map((s) => s.productId));
    const candidateGuest = (Array.isArray(guestItems) ? guestItems : []).filter(
      (g) => g && typeof g.productId === 'string' && g.productId.trim(),
    );

    if (candidateGuest.length === 0) {
      const current = await this.getCustomerWishlist(userId);
      return { ...current, mergedNewCount: 0 };
    }

    const candidateIds = Array.from(new Set(candidateGuest.map((g) => g.productId.trim())));
    const validProducts = await this.prisma.product.findMany({
      where: { id: { in: candidateIds } },
      include: { variants: true },
    });
    const validMap = new Map(validProducts.map((p) => [p.id, p]));

    let mergedNewCount = 0;
    const merged = [...stored];
    for (const guest of candidateGuest) {
      const pid = guest.productId.trim();
      const prod = validMap.get(pid);
      if (!prod) continue;
      if (!existingIds.has(pid)) {
        existingIds.add(pid);
        mergedNewCount++;
        merged.unshift({
          productId: pid,
          variantId: guest.variantId ?? prod.variants[0]?.id ?? null,
          priceAtSaveCents:
            guest.priceAtSaveCents ?? prod.variants[0]?.priceCents ?? undefined,
          addedAt: guest.addedAt ?? new Date().toISOString(),
        });
      }
    }

    if (mergedNewCount > 0) {
      await this.writeStoredWishlist(userId, merged);
    }
    const hydrated = await this.getCustomerWishlist(userId);
    return {
      ...hydrated,
      mergedNewCount,
    };
  }
}
