import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/common/utils/password.ts';

const prisma = new PrismaClient();

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
  // Owner is an intrinsic system group: anyone assigned to it automatically has all permissions
  // without needing individual GroupPermission rows attached.
  const ownerGroup = await prisma.permissionGroup.upsert({
    where: { name: 'Owner' },
    update: {
      description:
        'Intrinsic system group — always exists and grants unrestricted access to all permissions.',
    },
    create: {
      name: 'Owner',
      description:
        'Intrinsic system group — always exists and grants unrestricted access to all permissions.',
    },
  });

  await upsertGroupWithPermissions(
    'Warehouse Officer',
    'Shipments, receiving, stocktakes, suppliers, and inventory adjustments',
    ['shipments.view', 'shipments.manage', 'suppliers.view', 'suppliers.manage', 'receiving.view', 'receiving.manage', 'inventory.view', 'inventory.adjust', 'stocktakes.manage', 'collections.manage'],
  );

  await upsertGroupWithPermissions(
    'Sales & Cashier',
    'Orders, quotes, reservations, cashier shifts, tax invoices, manual payments, and collections',
    ['orders.view', 'orders.create_walk_in', 'quotes.view', 'quotes.manage', 'reservations.view', 'payments.view', 'payments.record_manual', 'shifts.view', 'shifts.manage', 'tax.view', 'collections.manage', 'returns.review', 'service_tickets.view', 'service_tickets.manage', 'customers.view'],
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
