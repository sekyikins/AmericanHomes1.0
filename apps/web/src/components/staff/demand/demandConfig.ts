export type DemandStatus =
  | 'Under review'
  | 'Provider confirmed'
  | 'Added to sourcing'
  | 'Deferred';

export type DemandMode = 'requests' | 'sourcing' | 'allocations';

export type DemandItem = {
  id: string;
  reference: string;
  title: string;
  customerName: string;
  customerInitials: string;
  customerMeta: string;
  qty: number;
  status: DemandStatus;
  submittedDate: string;
  colour: string;
  budget: string;
  relatedRequests: string;
  image: string;
};

export function demandTone(status: DemandStatus): string {
  if (status === 'Provider confirmed') return 'green';
  if (status === 'Added to sourcing') return 'blue';
  if (status === 'Deferred') return 'gray';
  return 'amber';
}

export const MODE_CONFIG = {
  requests: {
    title: 'Product requests',
    subtitle: 'Review customer demand without treating it as a sale.',
    cta: 'Record request',
    searchPlaceholder: 'Search product requests…',
    modalTitle: 'Record product request',
    modalSub:
      'A product request is customer demand, not an order, reservation or sourcing guarantee.',
  },
  sourcing: {
    title: 'Sourcing plan',
    subtitle: 'Separate decisions, planned quantities and provider confirmation.',
    cta: 'Add sourcing item',
    searchPlaceholder: 'Search sourcing plan…',
    modalTitle: 'Add sourcing item',
    modalSub:
      'Planning, provider confirmation, manifest inclusion and physical receipt remain separate stages.',
  },
  allocations: {
    title: 'Allocation offers',
    subtitle:
      'Offer eligible received stock without exceeding physical availability.',
    cta: 'Create offer',
    searchPlaceholder: 'Search allocation offers…',
    modalTitle: 'Create allocation offer',
    modalSub:
      'Offers commit only eligible physical stock and do not create a completed sale.',
  },
} as const;

export function mapStatus(raw?: string): DemandStatus {
  const s = (raw ?? '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'ACCEPTED' || s === 'RECEIVED') return 'Provider confirmed';
  if (s === 'APPROVED' || s === 'IN_SOURCING' || s === 'SOURCING') return 'Added to sourcing';
  if (s === 'DEFERRED' || s === 'DECLINED' || s === 'CANCELLED' || s === 'EXPIRED') return 'Deferred';
  return 'Under review';
}

export function initialsOf(name: string): string {
  const letters = name
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || 'AH';
}
