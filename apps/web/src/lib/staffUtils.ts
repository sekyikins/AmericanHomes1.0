export function shortRef(value: string, prefix = 'REF'): string {
  const clean = (value || '').trim();
  if (!clean) return '—';
  // Shorten raw Prisma CUIDs (e.g. cmwp8rg8t001fm5fwmh5s7hu9) while keeping formatted refs like AH-ORD-...
  if (clean.length > 18 && !clean.includes('-')) {
    return `${prefix}-${clean.slice(-6).toUpperCase()}`;
  }
  return clean;
}

export function formatGhs(cents: number): string {
  return `GHS ${(cents / 100).toLocaleString()}`;
}

export function formatShortDate(value?: string | Date | null, fallback = 'Recent'): string {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString('en-GH');
}

export function customerName(
  customer?: { user?: { name?: string | null; phone?: string | null } } | null,
  fallback = 'Walk-in',
): string {
  return customer?.user?.name || customer?.user?.phone || fallback;
}

export function formatStatusLabel(raw?: string | null, fallback = 'Unknown'): string {
  if (!raw) return fallback;
  const cleaned = raw.trim().replace(/_/g, ' ').toLowerCase();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number>>,
) {
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}
