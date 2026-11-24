import { api } from './client';

export const authApi = {
  requestOtp: (phone: string, mode: 'signin' | 'signup' = 'signin') =>
    api.post<{ sent: boolean; accountExists?: boolean }>('/auth/request-otp', { phone, mode }),
  verifyOtp: (
    phone: string,
    otp: string,
    extra?: {
      mode?: 'signin' | 'signup';
      name?: string;
      email?: string;
      whatsappOptIn?: boolean;
    },
  ) =>
    api.post<{
      verified: boolean;
      token: string;
      userId?: string;
      name?: string;
      email?: string | null;
      phone?: string;
    }>('/auth/verify-otp', { phone, otp, ...extra }),
  staffLogin: (email: string, password: string, mfaCode?: string) =>
    api.post<{
      token: string;
      userId: string;
      name?: string | null;
      email?: string | null;
      phone?: string;
      isOwner: boolean;
    }>('/auth/staff-login', {
      email,
      password,
      ...(mfaCode ? { mfaCode } : {}),
    }),
  changeStaffPassword: (currentPassword: string, newPassword: string) =>
    api.post<{ updated: boolean; token?: string }>('/auth/staff-change-password', {
      currentPassword,
      newPassword,
    }),
  revokeOtherSessions: () =>
    api.post<{ revoked: boolean; token?: string }>('/auth/revoke-other-sessions', {}),
  me: () =>
    api.get<{
      user: {
        id: string;
        phone?: string;
        email?: string | null;
        name?: string | null;
        role?: 'CUSTOMER' | 'STAFF';
        isOwner?: boolean;
        restrictFinancials?: boolean;
        permissions?: string[];
      };
    }>('/auth/me'),
};

export const usersApi = {
  getMe: () => api.get<Record<string, unknown>>('/users/me'),
  updateMe: (dto: { name?: string; email?: string }) =>
    api.patch<Record<string, unknown>>('/users/me', dto),
};

export const catalogueApi = {
  listPublished: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return api.get<Record<string, unknown>[]>(`/catalogue/products${q ? `?${q}` : ''}`);
  },
  listAdmin: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return api.get<Record<string, unknown>[]>(`/catalogue/admin/products${q ? `?${q}` : ''}`);
  },
  getProduct: (id: string) => api.get<unknown>(`/catalogue/products/${id}`),
  createProduct: (dto: Record<string, unknown>) =>
    api.post<unknown>('/catalogue/products', dto),
  updateProduct: (id: string, dto: Record<string, unknown>) =>
    api.patch<unknown>(`/catalogue/products/${id}`, dto),
  createVariant: (productId: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/catalogue/products/${productId}/variants`, dto),
  addProductMedia: (productId: string, url: string, type = 'IMAGE') =>
    api.post<unknown>(`/catalogue/products/${productId}/media`, { url, type }),
  addProductMediaBatch: (productId: string, urls: string[], type = 'IMAGE') =>
    api.post<unknown>(`/catalogue/products/${productId}/media`, { urls, type }),
  syncProductMedia: (productId: string, urls: string[], type = 'IMAGE') =>
    api.patch<unknown>(`/catalogue/products/${productId}/media`, { urls, type }),
  removeProductMedia: (productId: string, mediaId: string) =>
    api.del<unknown>(`/catalogue/products/${productId}/media/${mediaId}`),
  completePreparation: (productId: string, step: string, notes?: string) =>
    api.post<unknown>(`/catalogue/products/${productId}/preparation`, { step, notes }),
  revertPreparation: (productId: string, dto: { step?: string; resetAll?: boolean }) =>
    api.post<unknown>(`/catalogue/products/${productId}/preparation/revert`, dto),
  proposePrice: (variantId: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/catalogue/variants/${variantId}/price-proposals`, dto),
  approvePrice: (approvalId: string) =>
    api.post<unknown>(`/catalogue/price-approvals/${approvalId}/approve`, {}),
  publishProduct: (id: string) =>
    api.post<unknown>(`/catalogue/products/${id}/publish`, {}),
  unpublishProduct: (id: string, reason?: string) =>
    api.post<unknown>(`/catalogue/products/${id}/unpublish`, { reason }),
};

export const shipmentsApi = {
  list: () => api.get<Record<string, unknown>[]>('/shipments'),
  get: (id: string) => api.get<unknown>(`/shipments/${id}`),
  create: (dto: Record<string, unknown>) => api.post<unknown>('/shipments', dto),
  addManifest: (id: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/shipments/${id}/manifest`, dto),
  addTracking: (id: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/shipments/${id}/tracking`, dto),
  addExpense: (id: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/shipments/${id}/expenses`, dto),
  updateStatus: (id: string, status: string) =>
    api.patch<unknown>(`/shipments/${id}/status`, { status }),
  close: (id: string, overrideReason?: string) =>
    api.post<unknown>(`/shipments/${id}/close`, { overrideReason }),
};

export const receivingApi = {
  listSessions: () => api.get<Record<string, unknown>[]>('/receiving/sessions'),
  startSession: (dto: Record<string, unknown>) =>
    api.post<unknown>('/receiving/sessions', dto),
  getSession: (id: string) => api.get<unknown>(`/receiving/sessions/${id}`),
  recordLine: (sessionId: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/receiving/sessions/${sessionId}/lines`, dto),
  resolveDiscrepancy: (id: string, resolution: string, notes?: string) =>
    api.post<unknown>(`/receiving/discrepancies/${id}/resolve`, { resolution, notes }),
  closeSession: (sessionId: string) =>
    api.post<unknown>(`/receiving/sessions/${sessionId}/close`, {}),
};

export const inventoryApi = {
  list: () =>
    api.get<{
      items: Array<{
        id: string;
        sku: string;
        variantName: string;
        productId: string;
        productName: string;
        isPublished?: boolean;
        disposition?: string;
        image: string;
        condition: string;
        physical: number;
        available: number;
        held: number;
        unavailable: number;
        lotRef: string;
      }>;
      adjustments: Array<{
        id: string;
        variantId: string;
        previousQty: number;
        quantity: number;
        proposedQty: number;
        reason: string;
        status: string;
        initiatedBy: string;
        createdAt: string;
      }>;
    }>('/inventory'),
  getBalance: (variantId: string) =>
    api.get<{
      variantId: string;
      physical: number;
      available: number;
      held: number;
      unavailable: number;
      total: number;
    }>(`/inventory/balance/${variantId}`),
  getMovements: (variantId: string) =>
    api.get<Record<string, unknown>[]>(`/inventory/movements/${variantId}`),
  commitStock: (dto: Record<string, unknown>) =>
    api.post<unknown>('/inventory/commit', dto),
  releaseHold: (holdId: string) =>
    api.del<unknown>(`/inventory/holds/${holdId}`),
};

export const stocktakesApi = {
  list: () => api.get<Record<string, unknown>[]>('/stocktakes'),
  create: (dto: { reference: string }) => api.post<unknown>('/stocktakes', dto),
  recordLines: (id: string, lines: Array<{ variantId: string; countedQty: number; notes?: string }>) =>
    api.post<unknown>(`/stocktakes/${id}/lines`, { lines }),
  proposeAdjustment: (dto: { stocktakeId?: string; variantId: string; quantity: number; reason: string }) =>
    api.post<unknown>('/stocktakes/adjustments', dto),
  approveAdjustment: (id: string) => api.post<unknown>(`/stocktakes/adjustments/${id}/approve`, {}),
  rejectAdjustment: (id: string, reason: string) =>
    api.post<unknown>(`/stocktakes/adjustments/${id}/reject`, { reason }),
};

export const requestsApi = {
  submit: (dto: Record<string, unknown>) =>
    api.post<unknown>('/product-requests', dto),
  list: () => api.get<Record<string, unknown>[]>('/product-requests'),
  getMy: () => api.get<Record<string, unknown>[]>('/product-requests/my'),
  review: (id: string, dto: Record<string, unknown>) =>
    api.patch<unknown>(`/product-requests/${id}/review`, dto),
  setPriority: (id: string, priority: number) =>
    api.patch<unknown>(`/product-requests/${id}/priority`, { priority }),
  withdraw: (id: string, reason?: string) =>
    api.post<{ withdrawn: boolean; requiresManagementReview: boolean; message?: string }>(
      `/product-requests/${id}/withdraw`,
      { reason },
    ),
};

export const sourcingApi = {
  list: () => api.get<Record<string, unknown>[]>('/sourcing'),
  createGroup: (name: string, requestIds: string[]) =>
    api.post<unknown>('/sourcing/groups', { name, requestIds }),
  createItem: (dto: Record<string, unknown>) => api.post<unknown>('/sourcing', dto),
  confirmProvider: (id: string, providerRef?: string) =>
    api.post<unknown>(`/sourcing/${id}/confirm-provider`, { providerRef }),
};

export const allocationsApi = {
  list: () => api.get<Record<string, unknown>[]>('/allocations'),
  createOffer: (dto: Record<string, unknown>) => api.post<unknown>('/allocations', dto),
  respond: (id: string, accept: boolean) =>
    api.post<unknown>(`/allocations/${id}/respond`, { accept }),
};

export const reservationsApi = {
  request: (dto: Record<string, unknown>) =>
    api.post<unknown>('/reservations', dto),
  list: () => api.get<Record<string, unknown>[]>('/reservations'),
  getMy: () => api.get<Record<string, unknown>[]>('/reservations/my'),
  approve: (id: string) => api.post<unknown>(`/reservations/${id}/approve`, {}),
  decline: (id: string, reason: string) =>
    api.post<unknown>(`/reservations/${id}/decline`, { reason }),
  cancel: (id: string) => api.post<unknown>(`/reservations/${id}/cancel`, {}),
};

export const ordersApi = {
  list: () => api.get<Record<string, unknown>[]>('/orders'),
  get: (id: string) => api.get<unknown>(`/orders/${id}`),
  getMy: () => api.get<Record<string, unknown>[]>('/orders/my'),
  checkout: (dto: {
    items: Array<{ variantId: string; quantity: number }>;
    disclosedDefectsAcknowledged?: boolean;
    notes?: string;
  }) => api.post<{ order: { id: string; reference: string; totalCents: number } }>('/orders/checkout', dto),
  createWalkIn: (dto: Record<string, unknown>) =>
    api.post<unknown>('/orders/walk-in', dto),
  cancel: (id: string, reason: string) =>
    api.post<unknown>(`/orders/${id}/cancel`, { reason }),
};

export const paymentsApi = {
  list: () => api.get<Record<string, unknown>[]>('/payments'),
  initialize: (dto: Record<string, unknown>) =>
    api.post<{ authorizationUrl: string; reference: string; paymentId?: string }>(
      '/payments/initialize',
      dto,
    ),
  verify: (reference: string) =>
    api.get<{ status: string; reference: string; amountPesewas: number }>(
      `/payments/verify/${reference}`,
    ),
  exceptions: () => api.get<Record<string, unknown>[]>('/payments/exceptions'),
  recordManual: (dto: Record<string, unknown>) =>
    api.post<unknown>('/payments/manual', dto),
  approveManual: (id: string) => api.post<unknown>(`/payments/${id}/approve`, {}),
  reverse: (id: string, reason: string) =>
    api.post<unknown>(`/payments/${id}/reverse`, { reason }),
};

export const collectionsApi = {
  list: () => api.get<Record<string, unknown>[]>('/collections'),
  eligibleOrders: () => api.get<Record<string, unknown>[]>('/collections/eligible-orders'),
  record: (dto: Record<string, unknown>) => api.post<unknown>('/collections', dto),
};

export const returnsApi = {
  list: () => api.get<Record<string, unknown>[]>('/returns'),
  create: (dto: Record<string, unknown>) => api.post<unknown>('/returns', dto),
  decide: (id: string, dto: Record<string, unknown>) =>
    api.post<unknown>(`/returns/${id}/decision`, dto),
};

export const expensesApi = {
  list: () => api.get<Record<string, unknown>[]>('/expenses'),
  create: (dto: {
    description: string;
    amountCents: number;
    category: string;
    date: string;
  }) => api.post<unknown>('/expenses', dto),
};

export const staffApi = {
  list: () => api.get<Record<string, unknown>[]>('/staff'),
  get: (id: string) => api.get<unknown>(`/staff/${id}`),
  create: (dto: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    jobTitle?: string;
    permissionGroupId?: string;
    restrictFinancials?: boolean;
  }) => api.post<unknown>('/staff', dto),
  update: (id: string, dto: Record<string, unknown>) =>
    api.patch<unknown>(`/staff/${id}`, dto),
  deactivate: (id: string) => api.del<unknown>(`/staff/${id}`),
};

export const permissionsApi = {
  listGroups: () => api.get<Record<string, unknown>[]>('/permissions/groups'),
  getGroup: (id: string) => api.get<unknown>(`/permissions/groups/${id}`),
  createGroup: (dto: {
    name: string;
    description?: string;
    permissionCodes: string[];
  }) => api.post<unknown>('/permissions/groups', dto),
  updateGroup: (
    id: string,
    dto: {
      name?: string;
      description?: string;
      permissionCodes?: string[];
    },
  ) => api.patch<unknown>(`/permissions/groups/${id}`, dto),
};

export const notificationsApi = {
  getMy: () => api.get<Record<string, unknown>[]>('/notifications/my'),
  markRead: (id: string) => api.patch<unknown>(`/notifications/${id}/read`, {}),
  getPreferences: () => api.get<Record<string, unknown>>('/notifications/preferences'),
  updatePreferences: (dto: Record<string, boolean>) =>
    api.patch<Record<string, unknown>>('/notifications/preferences', dto),
  recordWhatsAppConsent: (granted: boolean, source = 'CUSTOMER_PORTAL') =>
    api.post<unknown>('/notifications/whatsapp-consent', { granted, source }),
  getDigitalReceipt: (orderId: string) =>
    api.get<Record<string, unknown>>(`/notifications/receipt/${orderId}`),
};

export const reportsApi = {
  listExports: () => api.get<Record<string, unknown>[]>('/reports/exports'),
  financialSummary: () => api.get<Record<string, unknown>>('/reports/financial-summary'),
  shipmentPerformance: (shipmentId: string) =>
    api.get<Record<string, unknown>>(`/reports/shipments/${shipmentId}/performance`),
  generateExport: (dto: { type: string; format: 'CSV' | 'XLSX' | 'PDF'; from?: string; to?: string }) =>
    api.post<{
      content?: string;
      contentBase64?: string;
      mimeType?: string;
      filename?: string;
      metadata: Record<string, unknown>;
    }>('/reports/exports', dto),
};

export const governanceApi = {
  listIncidents: () => api.get<Record<string, unknown>[]>('/governance/incidents'),
  createIncident: (dto: { title: string; severity?: string; notes?: string }) =>
    api.post<unknown>('/governance/incidents', dto),
  listAnnouncements: () => api.get<Record<string, unknown>[]>('/governance/announcements/public'),
  createAnnouncement: (dto: { title: string; body: string }) =>
    api.post<unknown>('/governance/announcements', dto),
  listPolls: () => api.get<Record<string, unknown>[]>('/governance/polls'),
  listCustomerPolls: () => api.get<Record<string, unknown>[]>('/governance/polls/customer'),
  createPoll: (dto: { title: string; description?: string; closesAt?: string }) =>
    api.post<Record<string, unknown>>('/governance/polls', dto),
  closePoll: (id: string) => api.post<Record<string, unknown>>(`/governance/polls/${id}/close`, {}),
  votePoll: (id: string, choice = 'YES') =>
    api.post<unknown>(`/governance/polls/${id}/vote`, { choice }),
  listSettings: () => api.get<Record<string, unknown>[]>('/governance/settings'),
  getPaymentAccounts: () =>
    api.get<{
      momoNetwork: string;
      momoNumber: string;
      momoName: string;
      bankName: string;
      bankAccountNumber: string;
      bankAccountName: string;
    }>('/governance/payment-accounts'),
  updateSetting: (key: string, value: string) =>
    api.patch<unknown>(`/governance/settings/${key}`, { value }),
  uploadFile: (dto: { folder: string; filename: string; mimetype: string; base64: string }) =>
    api.post<{ path: string; bucket: string; publicUrl?: string }>('/governance/uploads', dto),
  listStaffReports: () => api.get<Record<string, unknown>[]>('/governance/staff-reports'),
  createStaffReport: (dto: {
    title: string;
    category?: string;
    description: string;
    isAnonymous?: boolean;
    requestedChanges?: { name?: string; email?: string; phone?: string };
  }) => api.post<Record<string, unknown>>('/governance/staff-reports', dto),
  actOnStaffReport: (id: string, dto: { action: 'ADDRESSED' | 'DECLINED'; resolution?: string }) =>
    api.post<Record<string, unknown>>(`/governance/staff-reports/${id}/act`, dto),
};

export const adminApi = {
  customers: () => api.get<Record<string, unknown>[]>('/customers'),
  staff: () => api.get<Record<string, unknown>[]>('/staff'),
  permissions: () => api.get<Record<string, unknown>[]>('/permissions/groups'),
  auditLogs: () => api.get<Record<string, unknown>[]>('/audit'),
  dashboard: () => api.get<Record<string, unknown>>('/staff/dashboard/summary'),
  reports: () => api.get<Record<string, unknown>[]>('/reports/exports'),
  expenses: () => api.get<Record<string, unknown>[]>('/expenses'),
  notifications: () => api.get<Record<string, unknown>[]>('/notifications/my'),
};
