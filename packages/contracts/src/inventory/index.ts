export type StockBalance = {
  variantId: string;
  available: number;
  held: number;
  total: number;
};

export type InventoryMovement = {
  id: string;
  lotId: string;
  quantity: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
};
