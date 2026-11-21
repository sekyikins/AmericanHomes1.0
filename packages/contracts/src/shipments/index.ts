export type ShipmentStatus = 'PLANNED' | 'IN_TRANSIT' | 'ARRIVED' | 'CLOSED';

export type Shipment = {
  id: string;
  reference: string;
  providerName: string;
  status: ShipmentStatus;
  estimatedArrival?: string;
  actualArrival?: string;
  notes?: string;
  createdAt: string;
};

export type ManifestItem = {
  id: string;
  productName: string;
  quantity: number;
  unitCostCents: number;
  notes?: string;
};
