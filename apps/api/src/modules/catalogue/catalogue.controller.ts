import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CatalogueService } from './catalogue.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('products')
  getProducts(@Query() query: ProductQueryDto) {
    return this.catalogue.getPublishedProducts(query);
  }

  @Get('admin/products')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.VIEW)
  getAdminProducts(@Query() query: ProductQueryDto) {
    return this.catalogue.getAllProductsAdmin(query);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalogue.getProductById(id);
  }

  @Post('products')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.CREATE)
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogue.createProduct(dto, user.id);
  }

  @Patch('products/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogue.updateProduct(id, dto, user.id);
  }

  @Post('products/:id/variants')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.CREATE)
  createVariant(
    @Param('id') id: string,
    @Body() dto: { sku?: string; name?: string; priceCents: number; attributes?: Record<string, string> },
  ) {
    return this.catalogue.createVariant(id, dto);
  }

  @Post('products/:id/media')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  addProductMedia(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { url?: string; urls?: string[]; type?: string },
  ) {
    return this.catalogue.addProductMedia(id, dto, user.id);
  }

  @Patch('products/:id/media')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  syncProductMedia(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { urls: string[]; type?: string },
  ) {
    return this.catalogue.syncProductMedia(id, dto, user.id);
  }

  @Delete('products/:id/media/:mediaId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  removeProductMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogue.removeProductMedia(id, mediaId, user.id);
  }

  @Post('products/:id/preparation')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  completePreparation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { step: string; notes?: string },
  ) {
    return this.catalogue.completePreparationStep(id, user.id, dto);
  }

  @Post('products/:id/preparation/revert')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  revertPreparation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { step?: string; resetAll?: boolean },
  ) {
    return this.catalogue.revertPreparation(id, user.id, dto);
  }

  @Post('variants/:variantId/price-proposals')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.UPDATE)
  proposePrice(
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { proposedPriceCents: number; reason?: string; comparableRef?: string; notes?: string },
  ) {
    return this.catalogue.proposePrice(variantId, user.id, dto);
  }

  @Post('price-approvals/:id/approve')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.APPROVE_PRICE)
  approvePrice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogue.approvePrice(id, user.id, user.isOwner);
  }

  @Post('products/:id/publish')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.PUBLISH)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogue.publishProduct(id, user.id);
  }

  @Post('products/:id/unpublish')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CATALOGUE.PUBLISH)
  unpublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.catalogue.unpublishProduct(id, user.id, reason);
  }
}
