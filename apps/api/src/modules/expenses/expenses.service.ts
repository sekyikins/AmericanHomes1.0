import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.generalExpense.findMany({ orderBy: { date: 'desc' } });
  }

  async create(staffId: string, dto: CreateExpenseDto) {
    const expense = await this.prisma.generalExpense.create({
      data: {
        description: dto.description,
        amountCents: dto.amountCents,
        category: dto.category,
        recordedBy: staffId,
        date: new Date(dto.date),
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'GENERAL_EXPENSE_RECORDED',
      entityType: 'GeneralExpense',
      entityId: expense.id,
      after: { description: dto.description, category: dto.category, amountCents: dto.amountCents },
    });
    return expense;
  }
}
