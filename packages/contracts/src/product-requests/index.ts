export type ProductRequestStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'SOURCING'
  | 'ALLOCATED'
  | 'FULFILLED'
  | 'DECLINED';

export type ProductRequest = {
  id: string;
  customerId: string;
  description: string;
  budgetCents?: number;
  status: ProductRequestStatus;
  notes?: string;
  createdAt: string;
};
