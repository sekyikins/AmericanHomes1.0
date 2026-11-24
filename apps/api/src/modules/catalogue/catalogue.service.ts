import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
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
    const rows = await this.prisma.product.findMany({
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
    });
    for (const r of rows) {
      if (r.isPublished) {
        const stepNames = new Set((r.preparationSteps ?? []).map((s) => s.step));
        for (const reqStep of ['PRICING', 'FINAL_REVIEW'] as const) {
          if (!stepNames.has(reqStep)) {
            const createdStep = await this.prisma.productPreparationRecord.upsert({
              where: { productId_step: { productId: r.id, step: reqStep } },
              update: { status: 'COMPLETED' },
              create: {
                productId: r.id,
                step: reqStep,
                status: 'COMPLETED',
                completedAt: new Date(),
              },
            });
            r.preparationSteps.push(createdStep);
          }
        }
      } else {
        for (const v of r.variants) {
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
      }
    }
    return rows.map((r) => ({
      ...r,
      completedStageCount: deriveCompletedStageCount(r),
      preparationStatus: derivePreparationStatus(r),
    }));
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

  async createProduct(dto: CreateProductDto, staffId?: string) {
    const skuBase = dto.name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'ITEM';
    const sku = `AH-${skuBase}-${Date.now().toString().slice(-4)}`;
    const initialQty = Math.max(1, dto.initialQuantity ?? 1);
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
            name: 'Standard',
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
        variants: { include: { stockLots: true } },
        media: { orderBy: { position: 'asc' } },
        preparationSteps: true,
      },
    });

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
    dto: { sku?: string; name?: string; priceCents: number; attributes?: Record<string, string> },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    const sku = dto.sku ?? `AH-${productId.slice(-5).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const variant = await this.prisma.productVariant.create({
      data: { productId, sku, name: dto.name, priceCents: dto.priceCents },
    });

    if (dto.attributes) {
      for (const [attrName, attrValue] of Object.entries(dto.attributes)) {
        const attr = await this.prisma.productAttribute.upsert({
          where: { name: attrName },
          update: {},
          create: { name: attrName },
        });
        await this.prisma.productVariantAttribute.create({
          data: { variantId: variant.id, attributeId: attr.id, value: attrValue },
        });
      }
    }

    return this.prisma.productVariant.findUnique({
      where: { id: variant.id },
      include: { attributes: { include: { attribute: true } } },
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

    const approval = await this.prisma.pricingApproval.create({
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
    });
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { priceCents: dto.proposedPriceCents },
    });
    await this.prisma.productPreparationRecord.upsert({
      where: { productId_step: { productId: variant.productId, step: 'PRICING' } },
      update: {
        status: 'COMPLETED',
        completedBy: staffId,
        completedAt: new Date(),
        notes: dto.reason ?? dto.notes ?? 'Initial retail pricing',
      },
      create: {
        productId: variant.productId,
        step: 'PRICING',
        status: 'COMPLETED',
        completedBy: staffId,
        completedAt: new Date(),
        notes: dto.reason ?? dto.notes ?? 'Initial retail pricing',
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'PRICE_PROPOSED',
      entityType: 'PricingApproval',
      entityId: approval.id,
      before: { priceCents: variant.priceCents },
      after: { proposedPriceCents: dto.proposedPriceCents, reason: dto.reason },
    });
    return approval;
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

    // If all physical preparation steps are already completed, automatically publish the prepared product
    const parentProduct = await this.prisma.product.findUnique({
      where: { id: variant.productId },
      include: { preparationSteps: true },
    });
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
}
