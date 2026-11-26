import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  isOwnerGroupName,
  OWNER_GROUP_DESCRIPTION,
  OWNER_GROUP_NAME,
  PERMISSION_IMPLIED_BY,
} from '../../common/constants/permissions';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    if (!process.env.DATABASE_URL) return;
    await this.ensureOwnerGroup().catch(() => null);
  }

  /**
   * Ensures the intrinsic Owner permission group always exists.
   * Anyone assigned to this group automatically has unrestricted access to all permissions
   * without needing individual GroupPermission rows attached to it.
   */
  async ensureOwnerGroup() {
    return this.prisma.permissionGroup.upsert({
      where: { name: OWNER_GROUP_NAME },
      update: {},
      create: {
        name: OWNER_GROUP_NAME,
        description: OWNER_GROUP_DESCRIPTION,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async getStaffPermissions(staffId: string): Promise<string[]> {
    const assignments = await this.prisma.staffGroupAssignment.findMany({
      where: { staffId },
      include: { group: { include: { permissions: { include: { permission: true } } } } },
    });
    return assignments.flatMap((a) => a.group.permissions.map((gp) => gp.permission.code));
  }

  async checkPermission(userId: string, code: string): Promise<boolean> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: { groupAssignments: { include: { group: { select: { name: true } } } } },
    });
    if (!staff || !staff.isActive) return false;
    if (staff.isOwner || staff.groupAssignments.some((a) => isOwnerGroupName(a.group.name))) {
      return true;
    }
    const perms = await this.getStaffPermissions(staff.id);
    if (perms.includes(code)) return true;
    const impliedBy = PERMISSION_IMPLIED_BY[code] ?? [];
    return impliedBy.some((p) => perms.includes(p));
  }

  async findAllGroups() {
    await this.ensureOwnerGroup();
    const groups = await this.prisma.permissionGroup.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return groups.map((g) => ({
      ...g,
      isIntrinsic: isOwnerGroupName(g.name),
    }));
  }

  async findGroupById(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, members: true },
    });
    if (!group) throw new NotFoundException(`PermissionGroup ${id} not found`);
    return {
      ...group,
      isIntrinsic: isOwnerGroupName(group.name),
    };
  }

  async createGroup(dto: CreatePermissionGroupDto, actorId?: string) {
    if (isOwnerGroupName(dto.name)) {
      throw new ForbiddenException('The intrinsic Owner permission group already exists and cannot be recreated');
    }
    const existing = await this.prisma.permissionGroup.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Permission group "${dto.name}" already exists`);
    }
    const codes = Array.from(new Set((dto.permissionCodes ?? []).filter(Boolean)));
    const permissions: Array<{ id: string }> = [];
    for (const code of codes) {
      const perm = await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
      permissions.push(perm);
    }
    const group = await this.prisma.permissionGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit.record({
      actorId,
      action: 'PERMISSION_GROUP_CREATED',
      entityType: 'PermissionGroup',
      entityId: group.id,
      after: { name: group.name, permissionCodes: codes },
    });
    return group;
  }

  async updateGroup(id: string, dto: Partial<CreatePermissionGroupDto>, actorId?: string) {
    const existing = await this.prisma.permissionGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PermissionGroup ${id} not found`);
    if (existing.name.toLowerCase() === 'owner') {
      throw new ForbiddenException('The Owner permission group cannot be modified');
    }

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.permissionGroup.findUnique({ where: { name: dto.name } });
      if (conflict) {
        throw new ConflictException(`Permission group "${dto.name}" already exists`);
      }
    }

    const codes = Array.from(new Set((dto.permissionCodes ?? []).filter(Boolean)));
    const permissions: Array<{ id: string }> = [];
    for (const code of codes) {
      const perm = await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
      permissions.push(perm);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionCodes) {
        await tx.groupPermission.deleteMany({ where: { groupId: id } });
      }
      return tx.permissionGroup.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.permissionCodes
            ? { permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } }
            : {}),
        },
        include: { permissions: { include: { permission: true } } },
      });
    });
    await this.audit.record({
      actorId,
      action: 'PERMISSION_GROUP_UPDATED',
      entityType: 'PermissionGroup',
      entityId: id,
      before: { name: existing.name, description: existing.description },
      after: { name: updated.name, description: updated.description, permissionCodes: codes },
    });
    return updated;
  }
}
