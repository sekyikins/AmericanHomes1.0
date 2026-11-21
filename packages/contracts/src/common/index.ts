export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  error: true;
  message: string;
  statusCode: number;
};

export type SortOrder = 'asc' | 'desc';

export type DateRange = {
  from?: string;
  to?: string;
};

export type DashboardSummary = {
  availableInventory: number;
  heldInventory: number;
  activeOrders: number;
  outstandingPaymentsCents: number;
  pendingApprovals: number;
};
