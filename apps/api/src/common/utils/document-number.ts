import type { Prisma } from '@prisma/client';

/**
 * Atomically allocates the next number in a named series. Must be called inside the same
 * transaction that persists the document so that a rollback also rolls back the number
 * (this is what keeps tax-invoice series free of gaps).
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string,
  pad = 6,
): Promise<string> {
  const row = await tx.documentSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(row.value).padStart(pad, '0')}`;
}
