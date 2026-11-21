import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStaffPermissions(staffId: string): Promise<string[]> {
    const assignments = await this.prisma.staffGroupAssignment.findMany({
      where: { staffId },
      include: { group: { include: { permissions: { include: { permission: true } } } } },
    });
    return assignments.flatMap((a) => a.group.permissions.map((gp) => gp.permission.code));
  }

  async checkPermission(userId: string, code: string): Promise<boolean> {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId } });
    if (!staff || !staff.isActive) return false;
    const perms = await this.getStaffPermissions(staff.id);
    return perms.includes(code);
  }

  findAllGroups() {
    return this.prisma.permissionGroup.findMany({
      include: { permissions: { include: { permission: true } } },
    });
  }

  async findGroupById(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, members: true },
    });
    if (!group) throw new NotFoundException(`PermissionGroup ${id} not found`);
    return group;
  }

  async createGroup(dto: CreatePermissionGroupDto) {
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
    return this.prisma.permissionGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateGroup(id: string, dto: Partial<CreatePermissionGroupDto>) {
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

    return this.prisma.$transaction(async (tx) => {
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
  }
}
