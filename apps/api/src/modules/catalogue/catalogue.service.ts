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
        media: true,
      },
    });
  }

  getAllProductsAdmin(query: ProductQueryDto) {
    return this.prisma.product.findMany({
      ...paginationParams(query),
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: {
        variants: { include: { stockLots: true, attributes: { include: { attribute: true } } } },
        preparationSteps: true,
        media: true,
      },
      orderBy: { createdAt: 'desc' },
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
        media: true,
        preparationSteps: true,
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
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
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    return this.prisma.product.update({ where: { id }, data: dto });
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
      include: { preparationSteps: true },
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    if (!PREP_ORDER.includes(dto.step as (typeof PREP_ORDER)[number])) {
      throw new BadRequestException(`Invalid preparation step: ${dto.step}`);
    }

    const done = new Set(
      product.preparationSteps.filter((s) => s.status === 'COMPLETED').map((s) => s.step),
    );
    if (dto.step === 'PHOTOGRAPHY') {
      if (!done.has('CLEANING')) {
        throw new BadRequestException('Photography cannot be completed before cleaning');
      }
      if (done.has('WRAPPING')) {
        throw new BadRequestException('Photography must occur before wrapping');
      }
    }

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
      action: 'PREPARATION_STEP_COMPLETED',
      entityType: 'Product',
      entityId: productId,
      after: { step: dto.step, notes: dto.notes },
    });
    return record;
  }

  async proposePrice(
    variantId: string,
    staffId: string,
    dto: { proposedPriceCents: number; reason?: string; comparableRef?: string; notes?: string },
  ) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

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

    await this.prisma.productVariant.update({
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
    return updated;
  }

  async publishProduct(id: string, staffId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: { stockLots: true } },
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
    for (const requiredStep of ['INSPECTION', 'CLEANING', 'PHOTOGRAPHY', 'WRAPPING']) {
      if (!completedSteps.has(requiredStep)) {
        throw new BadRequestException(
          `Cannot publish: preparation step "${requiredStep}" is not completed`,
        );
      }
    }

    const variantIds = product.variants.map((v) => v.id);
    const approvedPrice = await this.prisma.pricingApproval.findFirst({
      where: { variantId: { in: variantIds }, status: 'APPROVED' },
    });
    if (!approvedPrice) {
      throw new BadRequestException('Cannot publish: an approved selling price is required');
    }

    const totalAvailable = product.variants.reduce(
      (sum, v) => sum + v.stockLots.reduce((s, l) => s + l.available, 0),
      0,
    );
    if (totalAvailable <= 0) {
      throw new BadRequestException('Cannot publish: no available stock on hand');
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
      after: { isPublished: true },
    });
    return updated;
  }

  async unpublishProduct(id: string, staffId?: string, reason?: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
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
