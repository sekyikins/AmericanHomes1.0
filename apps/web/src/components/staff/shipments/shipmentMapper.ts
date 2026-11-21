import { formatGhs } from '@/lib/staffUtils';

export type ShipmentStatus =
  | 'Planned'
  | 'In transit'
  | 'Arrived'
  | 'Receiving'
  | 'Reconciliation pending'
  | 'Reconciled';

export type DetailTab =
  | 'overview'
  | 'manifest'
  | 'tracking'
  | 'receiving'
  | 'discrepancies'
  | 'expenses'
  | 'activity';

export type ManifestItem = {
  id: string;
  variantId?: string;
  product: string;
  variant: string;
  expectedQty: number;
  receivedQty: number;
  requestAssociation: string;
};

export type TrackingEvent = {
  id: string;
  title: string;
  timestamp: string;
  active?: boolean;
};

export type DiscrepancyItem = {
  id: string;
  product: string;
  expected: number;
  received: number;
  varianceLabel: string;
  varianceTone: 'red' | 'amber';
  disposition: string;
};

export type ExpenseItem = {
  id: string;
  category: string;
  supplier: string;
  amount: string;
  status: 'Approved' | 'Pending';
};

export type ActivityItem = {
  id: string;
  message: string;
  timeAgo: string;
};

export type ShipmentRecord = {
  id: string;
  reference: string;
  routeShort: string;
  routeFull: string;
  origin: string;
  originDate: string;
  destination: string;
  destinationDate: string;
  providerShort: string;
  providerFull: string;
  trackingRef: string;
  rawStatus: string;
  status: ShipmentStatus;
  expectedArrivalShort: string;
  expectedArrivalRange: string;
  manifestCount: number;
  receivedCount: number;
  expensesTotal: string;
  lastUpdate: string;
  manifestRevision: number;
  receivingSessionId: string;
  receivingSessionStatus?: 'OPEN' | 'CLOSED';
  manifest: ManifestItem[];
  tracking: TrackingEvent[];
  discrepancies: DiscrepancyItem[];
  expenses: ExpenseItem[];
  activity: ActivityItem[];
};

export type ApiShipment = {
  id: string;
  reference: string;
  providerName: string;
  status: string;
  departureDate?: string | null;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  trackingRef?: string | null;
  updatedAt?: string;
  manifestRevisions?: Array<{
    revision: number;
    items?: Array<{
      id: string;
      productName?: string;
      description?: string;
      quantity?: number;
      expectedQty?: number;
      variantId?: string | null;
      variant?: { id: string; sku: string; name?: string | null } | null;
    }>;
  }>;
  trackingEvents?: Array<{
    id: string;
    event: string;
    location?: string | null;
    occurredAt: string;
  }>;
  receivingSessions?: Array<{
    id: string;
    status?: string;
    lines?: Array<{
      manifestItemId?: string | null;
      expectedQty?: number | null;
      receivedQty: number;
      discrepancies?: Array<{
        id: string;
        type: string;
        quantity: number;
        notes?: string | null;
        resolution?: { resolution: string } | null;
      }>;
    }>;
  }>;
  expenses?: Array<{
    id: string;
    category: string;
    description: string;
    amountCents: number;
  }>;
};

export function mapApiShipment(s: ApiShipment): ShipmentRecord {
  const latestManifest = s.manifestRevisions?.[0];
  const manifestItems = latestManifest?.items ?? [];
  const allLines = (s.receivingSessions ?? []).flatMap((rs) => rs.lines ?? []);
  const receivedByManifest = new Map<string, number>();
  for (const l of allLines) {
    if (l.manifestItemId) {
      receivedByManifest.set(
        l.manifestItemId,
        (receivedByManifest.get(l.manifestItemId) ?? 0) + l.receivedQty,
      );
    }
  }
  const manifestCount = manifestItems.reduce(
    (sum, i) => sum + Number(i.quantity ?? i.expectedQty ?? 0),
    0,
  );
  const receivedCount = allLines.reduce((sum, l) => sum + Number(l.receivedQty ?? 0), 0);
  const expensesCents = (s.expenses ?? []).reduce((sum, e) => sum + e.amountCents, 0);

  const normalizedStatus: ShipmentStatus =
    s.status === 'CLOSED'
      ? 'Reconciled'
      : s.status === 'RECONCILIATION_PENDING'
        ? 'Reconciliation pending'
        : s.status === 'RECEIVING'
          ? 'Receiving'
          : s.status === 'ARRIVED'
            ? 'Arrived'
            : s.status === 'IN_TRANSIT'
              ? 'In transit'
              : 'Planned';

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : 'TBD';

  const discrepancies: DiscrepancyItem[] = [];
  for (const l of allLines) {
    for (const d of l.discrepancies ?? []) {
      const mItem = manifestItems.find((m) => m.id === l.manifestItemId);
      discrepancies.push({
        id: d.id,
        product: mItem?.productName ?? mItem?.description ?? 'Received item',
        expected: l.expectedQty ?? 0,
        received: l.receivedQty,
        varianceLabel: `${d.type} (${d.quantity})`,
        varianceTone: d.type === 'UNEXPECTED' ? 'amber' : 'red',
        disposition: d.resolution?.resolution ?? 'Pending review',
      });
    }
  }

  return {
    id: s.id,
    reference: s.reference,
    routeShort: `${s.providerName} → Tema`,
    routeFull: 'Origin port → Tema, Ghana',
    origin: 'Origin port',
    originDate: s.departureDate ? `Departed ${fmtDate(s.departureDate)}` : 'Scheduled',
    destination: 'Tema, Ghana',
    destinationDate: s.actualArrival
      ? `Arrived ${fmtDate(s.actualArrival)}`
      : s.estimatedArrival
        ? `ETA ${fmtDate(s.estimatedArrival)}`
        : 'Pending',
    providerShort: s.providerName,
    providerFull: s.providerName,
    trackingRef: s.trackingRef ?? 'Pending assignment',
    rawStatus: s.status,
    status: normalizedStatus,
    expectedArrivalShort: s.actualArrival
      ? `Arrived ${fmtDate(s.actualArrival)}`
      : fmtDate(s.estimatedArrival),
    expectedArrivalRange: s.estimatedArrival
      ? new Date(s.estimatedArrival).toLocaleDateString('en-GH', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'TBD',
    manifestCount,
    receivedCount,
    expensesTotal: formatGhs(expensesCents),
    lastUpdate: s.updatedAt ? fmtDate(s.updatedAt) : 'Recent',
    manifestRevision: latestManifest?.revision ?? 1,
    receivingSessionId: s.receivingSessions?.[0]?.id
      ? `#${s.receivingSessions[0].id.slice(-5).toUpperCase()}`
      : 'None yet',
    receivingSessionStatus:
      s.receivingSessions?.[0]?.status === 'OPEN'
        ? 'OPEN'
        : s.receivingSessions?.[0]?.status === 'CLOSED'
          ? 'CLOSED'
          : undefined,
    manifest: manifestItems.map((m) => ({
      id: m.id,
      variantId: m.variantId ?? undefined,
      product: m.productName ?? m.description ?? 'Manifest item',
      variant: m.variant
        ? `${m.variant.name ?? 'Standard'} (${m.variant.sku})`
        : m.variantId
          ? `Variant ${m.variantId.slice(-6)}`
          : 'New item',
      expectedQty: Number(m.quantity ?? m.expectedQty ?? 0),
      receivedQty: receivedByManifest.get(m.id) ?? 0,
      requestAssociation: m.variantId ? 'Catalogue linked' : 'Manifest',
    })),
    tracking: (s.trackingEvents ?? []).map((t, idx) => ({
      id: t.id,
      title: t.location ? `${t.event} (${t.location})` : t.event,
      timestamp: new Date(t.occurredAt).toLocaleString('en-GH'),
      active: idx === 0,
    })),
    discrepancies,
    expenses: (s.expenses ?? []).map((e) => ({
      id: e.id,
      category: e.category,
      supplier: e.description,
      amount: formatGhs(e.amountCents),
      status: 'Approved',
    })),
    activity: (s.trackingEvents ?? []).map((t) => ({
      id: t.id,
      message: t.event,
      timeAgo: new Date(t.occurredAt).toLocaleDateString('en-GH'),
    })),
  };
}

export function statusTone(status: ShipmentStatus): string {
  if (status === 'Reconciled') return 'green';
  if (status === 'Planned' || status === 'Reconciliation pending') return 'amber';
  return 'blue';
}
