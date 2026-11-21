export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'AWAITING_PAYMENT'
  | 'PART_PAID'
  | 'PAID'
  | 'READY_FOR_COLLECTION'
  | 'COLLECTED'
  | 'CANCELLED';

export type CollectionStatus = 'Ready for collection' | 'Collected' | 'Held';

export type OrderLine = {
  id: string;
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
};

export type Order = {
  id: string;
  reference: string;
  customerId?: string;
  status: OrderStatus;
  totalCents: number;
  lines: OrderLine[];
  createdAt: string;
};
