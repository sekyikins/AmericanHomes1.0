import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { invalidateAuthCache } from '../../common/guards/auth.guard';
import { hashPassword } from '../../common/utils/password';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.staffProfile.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, mfaEnabled: true } },
        groupAssignments: { include: { group: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, mfaEnabled: true } },
        groupAssignments: { include: { group: true } },
      },
    });
  }

  async create(dto: CreateStaffDto, actorId?: string, actorIsOwner = false) {
    if (dto.restrictFinancials !== undefined && !actorIsOwner) {
      throw new ForbiddenException('Only the Owner may configure financial visibility restrictions');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { phone: dto.phone },
        update: {
          name: dto.name,
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.password ? { passwordHash: hashPassword(dto.password) } : {}),
        },
        create: {
          phone: dto.phone,
          name: dto.name,
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.password ? { passwordHash: hashPassword(dto.password) } : {}),
        },
      });
      const groupIds = Array.from(
        new Set([
          ...(dto.permissionGroupId ? [dto.permissionGroupId] : []),
          ...(dto.permissionGroupIds ?? []),
        ]),
      );
      const existingStaff = await tx.staffProfile.findUnique({ where: { userId: user.id } });
      const staff = existingStaff
        ? await tx.staffProfile.update({
            where: { id: existingStaff.id },
            data: {
              isActive: true,
              ...(dto.jobTitle ? { jobTitle: dto.jobTitle } : {}),
            },
            include: { user: { select: { id: true, name: true, phone: true, email: true } } },
          })
        : await tx.staffProfile.create({
            data: {
              userId: user.id,
              jobTitle: dto.jobTitle,
              isActive: true,
              restrictFinancials: actorIsOwner ? (dto.restrictFinancials ?? false) : false,
              ...(groupIds.length > 0
                ? { groupAssignments: { create: groupIds.map((groupId) => ({ groupId })) } }
                : {}),
            },
            include: {
              user: { select: { id: true, name: true, phone: true, email: true } },
              groupAssignments: true,
            },
          });
      return staff;
    });

    await this.audit.record({
      actorId,
      action: 'STAFF_ACCOUNT_CREATED',
      entityType: 'StaffProfile',
      entityId: result.id,
      after: { name: dto.name, phone: dto.phone, permissionGroupId: dto.permissionGroupId },
    });
    return result;
  }

  async update(id: string, dto: UpdateStaffDto, actorId?: string, actorIsOwner = false) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Staff profile ${id} not found`);
    if (existing.isOwner && !actorIsOwner) {
      throw new ForbiddenException('Managers cannot modify the Owner account');
    }
    if (dto.restrictFinancials !== undefined && !actorIsOwner) {
      throw new ForbiddenException('Only the Owner may change financial visibility restrictions');
    }

    if (dto.name || dto.phone || dto.email || dto.password) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.phone ? { phone: dto.phone } : {}),
          ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.password ? { passwordHash: hashPassword(dto.password) } : {}),
        },
      });
    }
    if (dto.isActive === false && existing.isOwner) {
      throw new ForbiddenException('The Owner account cannot be deactivated');
    }
    if (dto.permissionGroupIds !== undefined || dto.permissionGroupId !== undefined) {
      invalidateAuthCache(existing.userId);
      const nextGroupIds = Array.from(
        new Set([
          ...(dto.permissionGroupId ? [dto.permissionGroupId] : []),
          ...(dto.permissionGroupIds ?? []),
        ]),
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.staffGroupAssignment.deleteMany({ where: { staffId: id } });
        if (nextGroupIds.length > 0) {
          await tx.staffGroupAssignment.createMany({
            data: nextGroupIds.map((groupId) => ({ staffId: id, groupId })),
          });
        }
      });
    }
    if (
      dto.jobTitle !== undefined ||
      dto.restrictFinancials !== undefined ||
      dto.isActive !== undefined
    ) {
      await this.prisma.staffProfile.update({
        where: { id },
        data: {
          ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(actorIsOwner && dto.restrictFinancials !== undefined
            ? { restrictFinancials: dto.restrictFinancials }
            : {}),
        },
      });
    }
    if (dto.permissionGroupId) {
      await this.prisma.staffGroupAssignment.upsert({
        where: { staffId_groupId: { staffId: id, groupId: dto.permissionGroupId } },
        update: {},
        create: { staffId: id, groupId: dto.permissionGroupId },
      });
    }

    await this.audit.record({
      actorId,
      action: 'STAFF_ACCOUNT_UPDATED',
      entityType: 'StaffProfile',
      entityId: id,
      before: { jobTitle: existing.jobTitle, restrictFinancials: existing.restrictFinancials },
      after: { jobTitle: dto.jobTitle, restrictFinancials: dto.restrictFinancials, permissionGroupId: dto.permissionGroupId },
    });
    return this.findById(id);
  }

  async deactivate(id: string, actorId?: string, actorIsOwner = false) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Staff profile ${id} not found`);
    if (existing.isOwner) {
      throw new ForbiddenException('The Owner account cannot be deactivated');
    }
    if (!actorIsOwner && existing.userId === actorId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }
    const updated = await this.prisma.staffProfile.update({
      where: { id },
      data: { isActive: false },
    });
    await this.prisma.user.update({
      where: { id: existing.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    invalidateAuthCache(existing.userId);
    await this.audit.record({
      actorId,
      action: 'STAFF_ACCOUNT_DEACTIVATED',
      entityType: 'StaffProfile',
      entityId: id,
      before: { isActive: true },
      after: { isActive: false },
    });
    return updated;
  }
}
