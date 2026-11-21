import { Injectable } from '@nestjs/common';
import { paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: CustomerQueryDto) {
    return this.prisma.customerProfile.findMany({
      ...paginationParams(query),
      include: { user: true },
      where: {
        user: {
          staff: null,
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { phone: { contains: query.search } },
                ],
              }
            : {}),
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.customerProfile.findUnique({ where: { id }, include: { user: true } });
  }

  getHistory(id: string) {
    return this.prisma.salesOrder.findMany({
      where: { customerId: id },
      include: { lines: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
