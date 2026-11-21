import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.EXPENSES.VIEW)
  findAll() {
    return this.expenses.findAll();
  }

  @Post()
  @RequirePermission(PERMISSIONS.EXPENSES.MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.id, dto);
  }
}
