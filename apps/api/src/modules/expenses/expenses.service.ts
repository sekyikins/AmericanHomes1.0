import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.generalExpense.findMany({ orderBy: { date: 'desc' } });
  }

  create(staffId: string, dto: CreateExpenseDto) {
    return this.prisma.generalExpense.create({
      data: {
        description: dto.description,
        amountCents: dto.amountCents,
        category: dto.category,
        recordedBy: staffId,
        date: new Date(dto.date),
      },
    });
  }
}
