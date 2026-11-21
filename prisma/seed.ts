import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/common/utils/password.ts';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'inventory.view',
  'inventory.adjust',
  'inventory.approve_adjustment',
  'stocktakes.manage',
  'stocktakes.approve',
  'orders.view',
  'orders.create_walk_in',
  'orders.approve',
  'payments.view',
  'payments.record_manual',
  'payments.approve_manual',
  'payments.refund',
  'shipments.view',
  'shipments.manage',
  'receiving.view',
  'receiving.manage',
  'receiving.resolve_discrepancy',
  'catalogue.view',
  'catalogue.manage',
  'catalogue.approve_price',
  'catalogue.publish',
  'product_requests.view',
  'product_requests.review',
  'sourcing.manage',
  'allocations.manage',
  'reservations.view',
  'reservations.approve',
  'collections.manage',
  'returns.review',
  'returns.approve',
  'expenses.view',
  'expenses.manage',
  'reports.view',
  'reports.export',
  'customers.view',
  'staff.view',
  'staff.manage',
  'permissions.manage',
  'audit.view',
];

async function upsertGroupWithPermissions(
  name: string,
  description: string,
  codes: string[],
) {
  const perms = await Promise.all(
    codes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      }),
    ),
  );

  const existing = await prisma.permissionGroup.findUnique({ where: { name } });
  if (existing) {
    for (const p of perms) {
      await prisma.groupPermission.upsert({
        where: { groupId_permissionId: { groupId: existing.id, permissionId: p.id } },
        update: {},
        create: { groupId: existing.id, permissionId: p.id },
      });
    }
    return existing;
  }

  return prisma.permissionGroup.create({
    data: {
      name,
      description,
      permissions: {
        create: perms.map((p) => ({ permissionId: p.id })),
      },
    },
  });
}

async function main() {
  const ownerGroup = await upsertGroupWithPermissions(
    'Owner',
    'Full platform access including staff, permissions, finance, and audit logs',
    ALL_PERMISSIONS,
  );

  await upsertGroupWithPermissions(
    'Warehouse Officer',
    'Shipments, receiving, stocktakes, and inventory adjustments',
    ['shipments.view', 'shipments.manage', 'receiving.view', 'receiving.manage', 'inventory.view', 'inventory.adjust', 'stocktakes.manage', 'collections.manage'],
  );

  await upsertGroupWithPermissions(
    'Sales & Cashier',
    'Orders, reservations, manual payment recording, and collections',
    ['orders.view', 'orders.create_walk_in', 'reservations.view', 'payments.view', 'payments.record_manual', 'collections.manage', 'returns.review', 'customers.view'],
  );

  const ownerEmail = (process.env.OWNER_EMAIL ?? 'owner@americanhomes.gh').toLowerCase();
  const ownerPhone = process.env.OWNER_PHONE ?? '+233200000001';
  const ownerName = process.env.OWNER_NAME ?? 'Mr. Zero (Owner)';
  const ownerPassword = process.env.OWNER_PASSWORD ?? 'Owner@AmericanHomes2026!';

  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: ownerName, phone: ownerPhone, passwordHash: hashPassword(ownerPassword) },
    create: {
      email: ownerEmail,
      phone: ownerPhone,
      name: ownerName,
      passwordHash: hashPassword(ownerPassword),
    },
  });

  const staffProfile = await prisma.staffProfile.upsert({
    where: { userId: ownerUser.id },
    update: { isActive: true, isOwner: true, jobTitle: 'Owner' },
    create: { userId: ownerUser.id, isActive: true, isOwner: true, jobTitle: 'Owner' },
  });

  await prisma.staffGroupAssignment.upsert({
    where: { staffId_groupId: { staffId: staffProfile.id, groupId: ownerGroup.id } },
    update: {},
    create: { staffId: staffProfile.id, groupId: ownerGroup.id },
  });

  const defaultSettings = [
    { key: 'PENDING_RESERVATION_HOLD_MINUTES', value: '120', description: 'Pending reservation review hold duration (minutes)' },
    { key: 'APPROVED_RESERVATION_HOURS', value: '48', description: 'Approved reservation payment window (hours)' },
    { key: 'CHECKOUT_HOLD_MINUTES', value: '15', description: 'Direct checkout temporary stock hold duration (minutes)' },
    { key: 'ALLOCATION_OFFER_HOURS', value: '24', description: 'Allocation offer response window (hours)' },
    { key: 'STOCK_ADJUSTMENT_THRESHOLD_QTY', value: '0', description: 'Max absolute quantity adjustment allowed without second approval' },
    { key: 'PAYMENT_EVIDENCE_POLICY', value: 'FLEXIBLE_ANY_CONTACT_OR_EVIDENCE', description: 'Manual payment evidence validation policy (pending final owner spec)' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log(`Seeded Owner account: ${ownerEmail} (${ownerPhone}) -> group "${ownerGroup.name}"`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
