import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginationParams } from '../../common/utils/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

// Audit events are append-only. Never update or delete audit events.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(dto: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    approverId?: string;
    requestRef?: string;
  }) {
    return this.prisma.auditEvent.create({ data: dto });
  }

  async query(query: AuditQueryDto) {
    const where: Prisma.AuditEventWhereInput = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = { contains: query.action };
    if (query.entityType) where.entityType = query.entityType;
    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }
    const events = await this.prisma.auditEvent.findMany({
      ...paginationParams(query),
      where,
      orderBy: { createdAt: 'desc' },
    });
    const actorIds = Array.from(
      new Set(events.map((e) => e.actorId).filter((id): id is string => Boolean(id))),
    );
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return events.map((e) => ({
      ...e,
      actor: e.actorId ? (userMap.get(e.actorId) ?? null) : null,
    }));
  }
}
