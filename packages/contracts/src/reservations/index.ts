export type ReservationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FULFILLED';

export type Reservation = {
  id: string;
  customerId: string;
  variantId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt?: string;
  createdAt: string;
};
