import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Operational Incidents (FR-INC-001) ---
  listIncidents() {
    return this.prisma.operationalIncident.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createIncident(staffId: string, dto: { title: string; severity?: string; notes?: string }) {
    const incident = await this.prisma.operationalIncident.create({
      data: { title: dto.title, severity: dto.severity ?? 'MEDIUM', notes: dto.notes, status: 'OPEN' },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'INCIDENT_REPORTED',
      entityType: 'OperationalIncident',
      entityId: incident.id,
      after: { title: dto.title, severity: dto.severity },
    });
    return incident;
  }

  async resolveIncident(id: string, staffId: string, notes?: string) {
    const existing = await this.prisma.operationalIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Incident ${id} not found`);
    return this.prisma.operationalIncident.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), notes: notes ?? existing.notes },
    });
  }

  // --- Announcements (FR-ANN-001) ---
  listAnnouncements(publishedOnly = false) {
    return this.prisma.announcement.findMany({
      where: publishedOnly ? { status: 'PUBLISHED' } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  createAnnouncement(staffId: string, dto: { title: string; body: string }) {
    return this.prisma.announcement.create({
      data: { title: dto.title, body: dto.body, status: 'DRAFT', createdBy: staffId },
    });
  }

  async publishAnnouncement(id: string, staffId: string, publish: boolean) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);
    return this.prisma.announcement.update({
      where: { id },
      data: {
        status: publish ? 'PUBLISHED' : 'UNPUBLISHED',
        publishedBy: publish ? staffId : existing.publishedBy,
        publishedAt: publish ? new Date() : existing.publishedAt,
      },
    });
  }

  // --- Product Polls (FR-POL-001) ---
  private async notifyAllCustomers(title: string, body: string, referenceId: string) {
    const customers = await this.prisma.customerProfile.findMany({
      select: { userId: true },
    });
    if (customers.length > 0) {
      await this.prisma.notificationMessage.createMany({
        data: customers.map((c) => ({
          userId: c.userId,
          type: 'PROMOTIONS',
          referenceId,
          title,
          body,
        })),
      });
    }
  }

  private async closeExpiredPolls() {
    const now = new Date();
    const expired = await this.prisma.productPoll.findMany({
      where: { status: 'OPEN', closesAt: { lte: now } },
      select: { id: true, title: true },
    });
    if (expired.length === 0) return;

    await this.prisma.productPoll.updateMany({
      where: { id: { in: expired.map((p) => p.id) }, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });

    for (const poll of expired) {
      await this.audit.record({
        action: 'POLL_AUTO_CLOSED',
        entityType: 'ProductPoll',
        entityId: poll.id,
        after: { title: poll.title },
      });
      await this.notifyAllCustomers(
        'Product poll closed',
        `The poll "${poll.title}" has closed.`,
        poll.id,
      );
    }
  }

  async listPolls(userId?: string, activeOnly = false) {
    await this.closeExpiredPolls();
    const polls = await this.prisma.productPoll.findMany({
      where: activeOnly ? { status: 'OPEN' } : undefined,
      include: {
        _count: { select: { votes: true } },
        votes: {
          select: {
            choice: true,
            customer: { select: { userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return polls.map((p) => {
      const yesVotes = p.votes.filter((v) => v.choice.toUpperCase() === 'YES').length;
      const noVotes = p.votes.filter((v) => v.choice.toUpperCase() === 'NO').length;
      const myVote = userId ? p.votes.find((v) => v.customer?.userId === userId) : undefined;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        closesAt: p.closesAt,
        createdAt: p.createdAt,
        _count: p._count,
        yesVotes,
        noVotes,
        myChoice: myVote ? myVote.choice : null,
      };
    });
  }

  async createPoll(staffId: string, dto: { title: string; description?: string; closesAt?: string }) {
    const poll = await this.prisma.productPoll.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: 'OPEN',
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        createdBy: staffId,
      },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'POLL_CREATED',
      entityType: 'ProductPoll',
      entityId: poll.id,
      after: { title: dto.title, closesAt: dto.closesAt ?? null },
    });
    const closesNote = poll.closesAt
      ? ` Closes ${poll.closesAt.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}.`
      : '';
    await this.notifyAllCustomers(
      'New product poll',
      `Have your say: "${dto.title}". Vote now in your account polls.${closesNote}`,
      poll.id,
    );
    return poll;
  }

  async closePoll(pollId: string, staffId: string) {
    const poll = await this.prisma.productPoll.update({
      where: { id: pollId },
      data: { status: 'CLOSED' },
    });
    await this.audit.record({
      actorId: staffId,
      action: 'POLL_CLOSED',
      entityType: 'ProductPoll',
      entityId: pollId,
    });
    await this.notifyAllCustomers(
      'Product poll closed',
      `The poll "${poll.title}" has closed.`,
      poll.id,
    );
    return poll;
  }

  async votePoll(pollId: string, userId: string, choice = 'YES') {
    await this.closeExpiredPolls();
    const poll = await this.prisma.productPoll.findUnique({ where: { id: pollId } });
    if (!poll || poll.status !== 'OPEN') {
      throw new BadRequestException('Poll is not open for voting');
    }
    const profile =
      (await this.prisma.customerProfile.findUnique({ where: { userId } })) ??
      (await this.prisma.customerProfile.create({ data: { userId } }));

    return this.prisma.pollVote.upsert({
      where: { pollId_customerId: { pollId, customerId: profile.id } },
      update: { choice },
      create: { pollId, customerId: profile.id, choice },
    });
  }

  async getPaymentAccounts() {
    const keys = [
      'MOMO_NETWORK',
      'MOMO_ACCOUNT_NUMBER',
      'MOMO_ACCOUNT_NAME',
      'BANK_NAME',
      'BANK_ACCOUNT_NUMBER',
      'BANK_ACCOUNT_NAME',
    ];
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      momoNetwork: map.get('MOMO_NETWORK') ?? 'MTN Mobile Money',
      momoNumber: map.get('MOMO_ACCOUNT_NUMBER') ?? 'Not configured',
      momoName: map.get('MOMO_ACCOUNT_NAME') ?? 'AmericanHomes Ltd',
      bankName: map.get('BANK_NAME') ?? 'Not configured',
      bankAccountNumber: map.get('BANK_ACCOUNT_NUMBER') ?? 'Not configured',
      bankAccountName: map.get('BANK_ACCOUNT_NAME') ?? 'AmericanHomes Ltd',
    };
  }

  // --- System Settings (Configurable Rules) ---
  listSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(key: string, value: string, ownerId: string) {
    const updated = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedBy: ownerId },
      create: { key, value, updatedBy: ownerId },
    });
    await this.audit.record({
      actorId: ownerId,
      action: 'SYSTEM_SETTING_UPDATED',
      entityType: 'SystemSetting',
      entityId: key,
      after: { value },
    });
    return updated;
  }

  // --- File Uploads & Signed URLs (StorageService) ---
  async uploadEvidenceBase64(dto: { folder: string; filename: string; mimetype: string; base64: string }) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'];
    if (!allowed.includes(dto.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${dto.mimetype}`);
    }
    const buffer = Buffer.from(dto.base64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('File exceeds 5MB limit');
    }
    const path = `${dto.folder}/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    return this.storage.uploadFile(path, buffer, dto.mimetype);
  }

  // --- Staff Reports & Requests (New Implementation) ---
  async listStaffReports() {
    const reports = await this.prisma.staffReport.findMany({ orderBy: { createdAt: 'desc' } });
    const reviewerIds = Array.from(
      new Set(reports.map((r) => r.reviewedBy).filter((id): id is string => Boolean(id))),
    );
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((u) => [u.id, u.name || u.email || 'Staff member']));
    return reports.map((r) => ({
      ...r,
      reviewerName: r.reviewedBy ? (reviewerMap.get(r.reviewedBy) ?? 'Staff member') : null,
    }));
  }

  async createStaffReport(
    userId: string,
    role: string | undefined,
    dto: {
      title: string;
      category?: string;
      description: string;
      isAnonymous?: boolean;
      requestedChanges?: { name?: string; email?: string; phone?: string };
    },
  ) {
    if (role !== 'STAFF') {
      throw new ForbiddenException('Only staff members can submit staff reports.');
    }
    if (!dto.title?.trim() || !dto.description?.trim()) {
      throw new BadRequestException('Title and description are required.');
    }
    const category = (dto.category || 'GENERAL').toUpperCase();
    const isAnonymous = category === 'PROFILE_CHANGE' ? false : Boolean(dto.isAnonymous);
    const reporter = isAnonymous
      ? null
      : await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });

    const sanitizedChanges =
      category === 'PROFILE_CHANGE' && dto.requestedChanges
        ? {
            ...(dto.requestedChanges.name?.trim()
              ? { name: dto.requestedChanges.name.trim() }
              : {}),
            ...(dto.requestedChanges.email?.trim()
              ? { email: dto.requestedChanges.email.trim().toLowerCase() }
              : {}),
            ...(dto.requestedChanges.phone?.trim()
              ? { phone: dto.requestedChanges.phone.trim().replace(/\s+/g, '') }
              : {}),
          }
        : undefined;

    if (
      category === 'PROFILE_CHANGE' &&
      (!sanitizedChanges || Object.keys(sanitizedChanges).length === 0)
    ) {
      throw new BadRequestException('Provide at least one profile field to update.');
    }

    const report = await this.prisma.staffReport.create({
      data: {
        title: dto.title.trim(),
        category,
        description: dto.description.trim(),
        requestedChanges: sanitizedChanges,
        isAnonymous,
        reporterId: isAnonymous ? null : userId,
        reporterName: isAnonymous ? 'Anonymous' : reporter?.name || reporter?.email || 'Staff member',
        status: 'SUBMITTED',
      },
    });

    await this.audit.record({
      actorId: isAnonymous ? undefined : userId,
      action:
        category === 'PROFILE_CHANGE' ? 'STAFF_PROFILE_CHANGE_REQUESTED' : 'STAFF_REPORT_SUBMITTED',
      entityType: 'StaffReport',
      entityId: report.id,
      after: {
        title: report.title,
        category: report.category,
        isAnonymous,
        ...(sanitizedChanges ? { requestedChanges: sanitizedChanges } : {}),
      },
    });

    await this.notifications.notifyActiveStaff(
      category === 'PROFILE_CHANGE' ? 'Staff profile change request' : 'New staff report submitted',
      `${isAnonymous ? 'Anonymous' : report.reporterName} submitted "${report.title}" (${report.category}).`,
      'STAFF_REPORTS',
      category === 'PROFILE_CHANGE'
        ? ['staff_reports.view', 'staff_reports.manage', 'staff.manage']
        : ['staff_reports.view', 'staff_reports.manage'],
    );

    return report;
  }

  async actOnStaffReport(
    id: string,
    actor: { id: string; isOwner?: boolean; permissions?: string[] },
    dto: { action: 'ADDRESSED' | 'DECLINED'; resolution?: string },
  ) {
    const existing = await this.prisma.staffReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`StaffReport ${id} not found`);
    if (dto.action !== 'ADDRESSED' && dto.action !== 'DECLINED') {
      throw new BadRequestException('Action must be ADDRESSED or DECLINED');
    }

    const isProfileChange = existing.category === 'PROFILE_CHANGE';
    const hasPerm =
      Boolean(actor.isOwner) ||
      Boolean(actor.permissions?.includes('staff_reports.manage')) ||
      (isProfileChange && Boolean(actor.permissions?.includes('staff.manage')));
    if (!hasPerm) {
      throw new ForbiddenException('You do not have permission to act on this report.');
    }

    if (
      dto.action === 'ADDRESSED' &&
      isProfileChange &&
      existing.reporterId &&
      existing.requestedChanges &&
      typeof existing.requestedChanges === 'object'
    ) {
      const changes = existing.requestedChanges as {
        name?: string;
        email?: string;
        phone?: string;
      };
      const updateData: { name?: string; email?: string; phone?: string } = {};
      if (changes.name) updateData.name = changes.name;
      if (changes.email) updateData.email = changes.email;
      if (changes.phone) updateData.phone = changes.phone;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.user.update({
          where: { id: existing.reporterId },
          data: updateData,
        });
      }
    }

    const updated = await this.prisma.staffReport.update({
      where: { id },
      data: {
        status: dto.action,
        resolution: dto.resolution?.trim() || null,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      },
    });

    if (isProfileChange && existing.reporterId) {
      await this.notifications.sendInApp(existing.reporterId, {
        title:
          dto.action === 'ADDRESSED'
            ? 'Profile change approved'
            : 'Profile change request declined',
        body:
          dto.action === 'ADDRESSED'
            ? 'Your requested staff profile changes are now active.'
            : `Your profile change request was declined${updated.resolution ? `: ${updated.resolution}` : '.'}`,
        type: 'STAFF_REPORTS',
      });
    }

    await this.audit.record({
      actorId: actor.id,
      approverId: actor.id,
      action: dto.action === 'ADDRESSED' ? 'STAFF_REPORT_ADDRESSED' : 'STAFF_REPORT_DECLINED',
      entityType: 'StaffReport',
      entityId: id,
      before: { status: existing.status },
      after: { status: dto.action, resolution: updated.resolution },
    });

    return updated;
  }
}
