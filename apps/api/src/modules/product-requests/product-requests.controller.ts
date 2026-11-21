import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationDto } from '../../common/utils/pagination';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { ProductRequestsService } from './product-requests.service';

@Controller('product-requests')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ProductRequestsController {
  constructor(private readonly requests: ProductRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRequestDto) {
    return this.requests.create(user.id, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.REQUESTS.VIEW)
  findAll(@Query() query: PaginationDto) {
    return this.requests.findAll(query);
  }

  @Get('my')
  getMy(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.findByCustomer(user.id);
  }

  @Patch(':id/review')
  @RequirePermission(PERMISSIONS.REQUESTS.REVIEW)
  review(
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.review(id, dto, user.id);
  }

  @Patch(':id/priority')
  @RequirePermission(PERMISSIONS.REQUESTS.REVIEW)
  setPriority(
    @Param('id') id: string,
    @Body('priority') priority: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.setPriority(id, Number(priority) || 0, user.id);
  }

  @Post(':id/withdraw')
  withdraw(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.requests.withdraw(id, user.id, reason);
  }
}
