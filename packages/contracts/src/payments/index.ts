export type PaymentMethod =
  | 'PAYSTACK_CARD'
  | 'PAYSTACK_MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'MANUAL';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'VERIFIED' | 'FAILED' | 'REFUNDED';

export type Payment = {
  id: string;
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  verifiedAt?: string;
  createdAt: string;
};
