import { formatStatusLabel, shortRef } from '@/lib/staffUtils';

export type CustomerPaymentItem = {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  date: string;
  method: string;
  amountPesewas: number;
  status: string;
  tone: 'green' | 'amber' | 'gray';
};

export type CustomerCollectionItem = {
  id: string;
  orderId: string;
  orderReference: string;
  item: string;
  status: 'Ready for collection' | 'Collected';
  location: string;
  date: string;
};

export type CustomerOrderRecord = {
  id: string;
  reference: string;
  date: string;
  productName: string;
  image: string;
  itemCount: number;
  totalPesewas: number;
  paidPesewas: number;
  paymentStatus: 'Part paid' | 'Paid' | 'Pending';
  collectionStatus: 'Ready for collection' | 'Collected' | 'Cancelled';
  collectionNote: string;
  payments: CustomerPaymentItem[];
  collections: CustomerCollectionItem[];
};

export type CustomerReservationRecord = {
  id: string;
  reference: string;
  productId: string;
  variantId: string;
  productName: string;
  image: string;
  quantity: number;
  pricePesewas: number;
  status: 'Approved' | 'Pending review' | 'Expired' | 'Cancelled';
  countdown?: string;
  note: string;
};

export type CustomerRequestRecord = {
  id: string;
  reference: string;
  submittedAt: string;
  productName: string;
  description: string;
  quantity: number;
  budgetPesewas?: number;
  status: 'Under review' | 'Sourcing' | 'Allocated' | 'Accepted' | 'Withdrawn' | 'Declined';
  updateNote: string;
};

export type CustomerNotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  category: 'Orders' | 'Requests' | 'Account';
  unread: boolean;
  tone: 'green' | 'amber' | 'blue' | 'slate';
};

function formatDateLabel(raw?: unknown): string {
  if (!raw) return 'Recent';
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime())
    ? 'Recent'
    : d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function mapCustomerOrders(rawOrders: unknown): CustomerOrderRecord[] {
  if (!Array.isArray(rawOrders)) return [];
  return rawOrders.map((raw) => {
    const o = raw as Record<string, unknown>;
    const id = String(o.id);
    const reference = shortRef(String(o.reference || id), 'ORD');
    const lines = Array.isArray(o.lines)
      ? (o.lines as Array<{
          quantity?: number;
          variant?: { product?: { id?: string; name?: string; media?: Array<{ url?: string }> } };
        }>)
      : [];
    const firstProduct = lines[0]?.variant?.product;
    const productName =
      lines.length > 1
        ? `${firstProduct?.name ?? 'Order item'} (+${lines.length - 1})`
        : firstProduct?.name ?? 'Order item';
    const image = firstProduct?.media?.[0]?.url || '/images/sofa.avif';
    const itemCount = lines.reduce((sum, l) => sum + Number(l.quantity ?? 1), 0) || 1;
    const totalPesewas = Number(o.totalCents ?? 0);

    const rawPayments = Array.isArray(o.payments) ? (o.payments as Array<Record<string, unknown>>) : [];
    const paidPesewas = rawPayments
      .filter((p) => ['VERIFIED', 'PAID', 'COMPLETED'].includes(String(p.status ?? '').toUpperCase()))
      .reduce((sum, p) => sum + Number(p.amountCents ?? 0), 0);

    const payRaw = String(o.paymentStatus ?? 'PENDING').toUpperCase();
    const paymentStatus: CustomerOrderRecord['paymentStatus'] =
      payRaw === 'PAID' || (totalPesewas > 0 && paidPesewas >= totalPesewas)
        ? 'Paid'
        : payRaw.includes('PARTIAL') || paidPesewas > 0
          ? 'Part paid'
          : 'Pending';

    const ordRaw = String(o.orderStatus ?? o.status ?? 'PLACED').toUpperCase();
    const colRaw = String(o.fulfilmentStatus ?? o.collectionStatus ?? 'NOT_STARTED').toUpperCase();
    const collectionStatus: CustomerOrderRecord['collectionStatus'] =
      ordRaw === 'CANCELLED'
        ? 'Cancelled'
        : colRaw === 'COLLECTED' || colRaw === 'COMPLETED'
          ? 'Collected'
          : 'Ready for collection';

    const payments: CustomerPaymentItem[] = rawPayments.map((p) => {
      const pStatus = String(p.status ?? 'PENDING').toUpperCase();
      return {
        id: String(p.id),
        reference: shortRef(String(p.reference || p.id), 'PAY'),
        orderId: id,
        orderReference: reference,
        date: formatDateLabel(p.createdAt),
        method: formatStatusLabel(String(p.method || 'PAYSTACK')),
        amountPesewas: Number(p.amountCents ?? 0),
        status: formatStatusLabel(pStatus),
        tone: pStatus === 'VERIFIED' || pStatus === 'PAID' ? 'green' : pStatus === 'PENDING' ? 'amber' : 'gray',
      };
    });

    const collections: CustomerCollectionItem[] =
      collectionStatus === 'Collected'
        ? [
            {
              id: `COL-${reference.replace(/^ORD-/, '')}`,
              orderId: id,
              orderReference: reference,
              item: `${productName} (${itemCount} ${itemCount === 1 ? 'unit' : 'units'})`,
              status: 'Collected',
              location: 'Community 25 Warehouse, Tema',
              date: `Collected ${formatDateLabel(o.updatedAt ?? o.createdAt)}`,
            },
          ]
        : [];

    return {
      id,
      reference,
      date: formatDateLabel(o.createdAt),
      productName,
      image,
      itemCount,
      totalPesewas,
      paidPesewas,
      paymentStatus,
      collectionStatus,
      collectionNote:
        collectionStatus === 'Collected'
          ? collections[0]?.date ?? 'Collected from Community 25 Warehouse, Tema.'
          : collectionStatus === 'Cancelled'
            ? 'Order cancelled; stock commitment released.'
            : 'Ready at Community 25 Warehouse, Tema (Mon–Sat, 9am–6pm).',
      payments,
      collections,
    };
  });
}

export function mapCustomerReservations(rawReservations: unknown): CustomerReservationRecord[] {
  if (!Array.isArray(rawReservations)) return [];
  return rawReservations.map((raw) => {
    const r = raw as Record<string, unknown>;
    const variant = r.variant as
      | {
          id?: string;
          priceCents?: number;
          product?: { id?: string; name?: string; media?: Array<{ url?: string }> };
        }
      | undefined;
    const statusRaw = String(r.status ?? 'PENDING').toUpperCase();
    const status: CustomerReservationRecord['status'] =
      statusRaw === 'APPROVED'
        ? 'Approved'
        : statusRaw === 'EXPIRED'
          ? 'Expired'
          : statusRaw === 'CANCELLED' || statusRaw === 'DECLINED'
            ? 'Cancelled'
            : 'Pending review';

    let countdown: string | undefined;
    if (status === 'Approved' && r.expiresAt) {
      const diffMs = new Date(String(r.expiresAt)).getTime() - Date.now();
      if (diffMs > 0) {
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        countdown = `${hrs}h ${mins}m left`;
      }
    }

    const quantity = Number(r.quantity ?? 1);
    const unitPrice = Number(variant?.priceCents ?? 0);
    return {
      id: String(r.id),
      reference: shortRef(String(r.id), 'RES'),
      productId: variant?.product?.id ?? 'sofa',
      variantId: String(r.variantId ?? variant?.id ?? ''),
      productName: variant?.product?.name ?? 'Reserved item',
      image: variant?.product?.media?.[0]?.url || '/images/chair.avif',
      quantity,
      pricePesewas: unitPrice * quantity,
      status,
      countdown,
      note:
        (r.notes ? String(r.notes) : '') ||
        (status === 'Approved'
          ? 'Your reservation is approved. Complete payment before the deadline to keep your item.'
          : status === 'Pending review'
            ? 'Awaiting staff confirmation on stock hold availability.'
            : status === 'Expired'
              ? 'Payment deadline passed; stock hold was automatically released.'
              : 'Reservation closed; stock hold released.'),
    };
  });
}

export function mapCustomerRequests(rawRequests: unknown): CustomerRequestRecord[] {
  if (!Array.isArray(rawRequests)) return [];
  return rawRequests.map((raw) => {
    const r = raw as Record<string, unknown>;
    const st = String(r.status ?? 'PENDING').toUpperCase();
    const status: CustomerRequestRecord['status'] =
      st === 'APPROVED' || st === 'IN_SOURCING' || st === 'SOURCING'
        ? 'Sourcing'
        : st === 'ALLOCATED'
          ? 'Allocated'
          : st === 'ACCEPTED' || st === 'CONFIRMED'
            ? 'Accepted'
            : st === 'WITHDRAWN'
              ? 'Withdrawn'
              : st === 'DECLINED' || st === 'REJECTED' || st === 'DEFERRED'
                ? 'Declined'
                : 'Under review';
    return {
      id: String(r.id),
      reference: shortRef(String(r.id), 'REQ'),
      submittedAt: formatDateLabel(r.createdAt),
      productName: String(r.productName || 'Product request'),
      description: String(r.description || ''),
      quantity: Number(r.quantity ?? 1),
      budgetPesewas: typeof r.budgetCents === 'number' ? r.budgetCents : undefined,
      status,
      updateNote:
        (r.notes ? String(r.notes) : '') ||
        (status === 'Sourcing'
          ? 'Confirmed for sourcing on an upcoming shipment.'
          : status === 'Allocated'
            ? 'Stock allocated to your request.'
            : status === 'Withdrawn'
              ? 'Request withdrawn.'
              : 'Our sourcing team is reviewing availability.'),
    };
  });
}

export function mapCustomerNotifications(rawList: unknown): CustomerNotificationItem[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw) => {
    const n = raw as Record<string, unknown>;
    const type = String(n.type ?? '').toUpperCase();
    const category: CustomerNotificationItem['category'] = type.includes('REQUEST')
      ? 'Requests'
      : type.includes('ORDER') || type.includes('PAYMENT') || type.includes('RESERVATION')
        ? 'Orders'
        : 'Account';
    const tone: CustomerNotificationItem['tone'] =
      category === 'Orders' ? 'green' : category === 'Requests' ? 'amber' : 'blue';
    return {
      id: String(n.id),
      title: String(n.title || 'Notification'),
      body: String(n.body || ''),
      time: formatDateLabel(n.createdAt),
      category,
      unread: !n.readAt,
      tone,
    };
  });
}
