import type { PrismaClient } from '@prisma/client';

const DEFAULT_COLLECTIONS = [
  'Living room',
  'Office',
  'Kitchen',
  'Outdoors',
  'Dining',
  'Electronics',
];

/**
 * Ensures one or more product collection names exist in SystemSetting['PRODUCT_COLLECTIONS'].
 * If a staff member types a brand-new collection on a shipment manifest or product record,
 * it is automatically appended so it becomes selectable everywhere and appears on the storefront.
 */
export async function ensureProductCollectionsInSettings(
  prisma: PrismaClient,
  names: Array<string | null | undefined>,
): Promise<void> {
  const incoming = names
    .map((n) => (n ?? '').trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (incoming.length === 0) return;

  const row = await prisma.systemSetting.findUnique({
    where: { key: 'PRODUCT_COLLECTIONS' },
  });
  const current = (row?.value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = current.length > 0 ? [...current] : [...DEFAULT_COLLECTIONS];
  const existingKeys = new Set(list.map((c) => c.toLowerCase().replace(/[-_]+/g, ' ')));

  let changed = false;
  for (const name of incoming) {
    const normalized = name.replace(/[-_]+/g, ' ');
    const key = normalized.toLowerCase();
    if (!existingKeys.has(key)) {
      const display =
        normalized === normalized.toLowerCase()
          ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
          : normalized;
      list.push(display);
      existingKeys.add(key);
      changed = true;
    }
  }

  if (changed || !row) {
    await prisma.systemSetting.upsert({
      where: { key: 'PRODUCT_COLLECTIONS' },
      update: { value: list.join(', ') },
      create: { key: 'PRODUCT_COLLECTIONS', value: list.join(', ') },
    });
  }
}
