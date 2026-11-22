'use client';

import { OrderRecordModal } from '@/components/staff/orders/OrderModals';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, ordersApi } from '@/lib/api';
import { downloadCsv, formatStatusLabel, shortRef } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type OrderRow = {
  id: string;
  reference: string;
  customer: string;
  source: 'Online' | 'Walk-in';
  product: string;
  amountOrQty: string;
  payment: string;
  paymentTone: 'amber' | 'gray' | 'green';
  collection: string;
  collectionTone: 'green' | 'amber' | 'blue' | 'gray';
  date: string;
  qty: number;
  agreedPrice: string;
};

type VariantOpt = { id: string; label: string; priceCents: number };

export default function StaffOrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [variants, setVariants] = useState<VariantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerLookup, setCustomerLookup] = useState('');
  const [qty, setQty] = useState(1);
  const [agreedPrice, setAgreedPrice] = useState('0');
  const [draftLines, setDraftLines] = useState<
    Array<{ id: string; variantId: string; quantity: number; agreedPrice: string }>
  >([]);

  const loadVariants = useCallback(async () => {
    if (variants.length > 0) return;
    const prodList = await catalogueApi.listAdmin().catch(() => []);
    const opts: VariantOpt[] = [];
    for (const p of (Array.isArray(prodList) ? prodList : []) as Array<{
      name: string;
      variants?: Array<{ id: string; sku?: string; priceCents?: number }>;
    }>) {
      for (const v of p.variants ?? []) {
        opts.push({
          id: v.id,
          label: `${p.name}${v.sku ? ` (${v.sku})` : ''} — GHS ${((v.priceCents ?? 0) / 100).toLocaleString()}`,
          priceCents: v.priceCents ?? 0,
        });
      }
    }
    setVariants(opts);
    if (opts[0]) {
      setDraftLines((prev) =>
        prev.length > 0
          ? prev
          : [
              {
                id: `ol-${Date.now()}`,
                variantId: opts[0].id,
                quantity: 1,
                agreedPrice: String((opts[0].priceCents / 100).toFixed(2)),
              },
            ],
      );
    }
  }, [variants.length]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const ordList = await ordersApi.list();
      const mapped: OrderRow[] = (
        Array.isArray(ordList) ? ordList : []
      ).map((o: Record<string, unknown>) => {
        const customer = o.customer as { user?: { name?: string; phone?: string } } | undefined;
        const lines = (o.lines as Array<{ quantity?: number; variant?: { product?: { name?: string } } }> | undefined) ?? [];
        const firstProduct = lines[0]?.variant?.product?.name || 'Order items';
        const totalQty = lines.reduce((s, l) => s + Number(l.quantity ?? 1), 0);
        const totalCents = Number(o.totalCents ?? 0);
        const payStatus = String(o.paymentStatus || 'PENDING');
        const colStatus = String(o.collectionStatus || 'PENDING');
        const ordStatus = String(o.orderStatus || 'PLACED');
        return {
          id: String(o.id),
          reference: shortRef(String(o.reference || o.id), 'ORD'),
          customer: customer?.user?.name || customer?.user?.phone || 'Walk-in / Guest',
          source: String(o.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
          product: lines.length > 1 ? `${firstProduct} (+${lines.length - 1})` : firstProduct,
          amountOrQty: `GHS ${(totalCents / 100).toLocaleString()}`,
          payment: payStatus,
          paymentTone: payStatus === 'PAID' ? 'green' : payStatus.includes('PARTIAL') ? 'amber' : 'gray',
          collection: ordStatus === 'CANCELLED' ? 'Cancelled' : colStatus,
          collectionTone:
            ordStatus === 'CANCELLED'
              ? 'gray'
              : colStatus === 'COLLECTED'
                ? 'green'
                : colStatus === 'PARTIAL'
                  ? 'blue'
                  : 'amber',
          date: o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-GH') : 'Recent',
          qty: totalQty || 1,
          agreedPrice: String((totalCents / 100).toFixed(2)),
        };
      });
      setOrders(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visible = orders.filter((o) => {
    if (paymentFilter !== 'All' && o.payment.toUpperCase() !== paymentFilter.toUpperCase()) return false;
    if (sourceFilter !== 'All' && o.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.reference.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validLines = draftLines.filter((l) => l.variantId && l.quantity > 0);
    if (submitting || modalMode !== 'create' || validLines.length === 0) return;
    setSubmitting(true);
    try {
      await ordersApi.createWalkIn({
        lines: validLines.map((l) => ({
          variantId: l.variantId,
          quantity: Math.max(1, Number(l.quantity) || 1),
          unitPriceCents: Math.round((Number(l.agreedPrice) || 0) * 100),
        })),
        notes: customerLookup.trim() ? `Walk-in: ${customerLookup.trim()}` : 'Walk-in sale',
      });
      setModalMode(null);
      showToast('Walk-in sale created', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create walk-in order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65241">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Orders
          </h1>
          <p className="dash-sub">
            Online checkout orders and staff-assisted walk-in sales.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setModalMode('create');
            setEditingId(null);
            setCustomerLookup('');
            if (variants[0]) {
              setDraftLines([
                {
                  id: `ol-${Date.now()}`,
                  variantId: variants[0].id,
                  quantity: 1,
                  agreedPrice: String((variants[0].priceCents / 100).toFixed(2)),
                },
              ]);
            }
            loadVariants();
          }}
        >
          <Plus size={15} />
          <span>Create walk-in sale</span>
        </button>
      </div>

      <div className="ship-tabs-bar" style={{ marginBottom: 16 }}>
        {(['All', 'Online', 'Walk-in'] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            className={`ship-tab-btn${sourceFilter === ch ? ' active' : ''}`}
            onClick={() => setSourceFilter(ch)}
          >
            {ch === 'All' ? 'All orders' : `${ch}`}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order reference, customer or product…"
            aria-label="Search order reference, customer or product"
          />
        </label>

        <StaffFilterDropdown
          label="Payment"
          value={paymentFilter}
          options={['All', 'Pending', 'Partial', 'Paid']}
          onChange={setPaymentFilter}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'orders.csv',
              ['Reference', 'Customer', 'Channel', 'Product', 'Amount', 'Payment', 'Collection', 'Date'],
              visible.map((o) => [
                o.reference,
                o.customer,
                o.source,
                o.product,
                o.amountOrQty,
                o.payment,
                o.collection,
                o.date,
              ]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-sales-cols">
          <span>REFERENCE</span>
          <span>CUSTOMER</span>
          <span>AMOUNT</span>
          <span>PAYMENT</span>
          <span>COLLECTION</span>
          <span>DATE</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="No orders match your current search or payment filter."
            action={
              search || paymentFilter !== 'All' ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSearch('');
                    setPaymentFilter('All');
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          visible.map((o) => (
            <button
              key={o.id}
              type="button"
              className="staff-table-row staff-sales-cols"
              onClick={() => {
                setModalMode('edit');
                setEditingId(o.id);
                setCustomerLookup(o.customer);
                setQty(o.qty);
                setAgreedPrice(o.agreedPrice);
              }}
            >
              <div>
                <strong>{o.reference}</strong>
                <small>{o.product}</small>
              </div>
              <div>
                <span className="staff-cell-text">{o.customer}</span>
                <small style={{ display: 'block', marginTop: 2 }}>
                  <span className={`acct-pill ${o.source === 'Online' ? 'green' : 'blue'}`}>
                    {o.source}
                  </span>
                </small>
              </div>
              <span className="staff-cell-text">{o.amountOrQty}</span>
              <div>
                <span className={`acct-pill ${o.paymentTone}`}>
                  ● {formatStatusLabel(o.payment)}
                </span>
              </div>
              <div>
                <span className={`acct-pill ${o.collectionTone}`}>
                  ● {formatStatusLabel(o.collection)}
                </span>
              </div>
              <span className="staff-cell-muted">{o.date}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <OrderRecordModal
        modalMode={modalMode}
        orderReference={orders.find((o) => o.id === editingId)?.reference}
        isCancelled={orders.find((o) => o.id === editingId)?.collection === 'Cancelled'}
        canMakePayment={['PENDING', 'PARTIAL', 'PARTIALLY_PAID'].includes(
          (orders.find((o) => o.id === editingId)?.payment ?? '').toUpperCase(),
        )}
        editingId={editingId}
        customerLookup={customerLookup}
        variants={variants}
        draftLines={draftLines}
        qty={qty}
        agreedPrice={agreedPrice}
        submitting={submitting}
        cancellingOrder={cancellingOrder}
        onCustomerLookupChange={setCustomerLookup}
        onAddDraftLine={() => {
          const def = variants[0];
          setDraftLines((prev) => [
            ...prev,
            {
              id: `ol-${Date.now()}-${prev.length}`,
              variantId: def?.id ?? '',
              quantity: 1,
              agreedPrice: def ? String((def.priceCents / 100).toFixed(2)) : '0',
            },
          ]);
        }}
        onRemoveDraftLine={(id) => setDraftLines((prev) => prev.filter((r) => r.id !== id))}
        onChangeLineVariant={(id, variantId) => {
          const next = variants.find((v) => v.id === variantId);
          setDraftLines((prev) =>
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    variantId,
                    agreedPrice: next
                      ? String((next.priceCents / 100).toFixed(2))
                      : r.agreedPrice,
                  }
                : r,
            ),
          );
        }}
        onChangeLineQty={(id, quantity) =>
          setDraftLines((prev) => prev.map((r) => (r.id === id ? { ...r, quantity } : r)))
        }
        onChangeLinePrice={(id, price) =>
          setDraftLines((prev) => prev.map((r) => (r.id === id ? { ...r, agreedPrice: price } : r)))
        }
        onCancelOrderClick={() => setConfirmCancelOrder(true)}
        onMakePayment={() => {
          if (editingId) {
            setModalMode(null);
            router.push(`/staff/payments?recordOrderId=${encodeURIComponent(editingId)}`);
          }
        }}
        onSubmit={handleSubmit}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={confirmCancelOrder && Boolean(editingId)}
        title="Cancel order?"
        targetName={orders.find((o) => o.id === editingId)?.reference}
        description="This will cancel the order and release any committed stock back to inventory."
        consequence="Cancelled orders cannot be uncancelled."
        reversible={false}
        destructive={true}
        confirmLabel="Cancel order"
        loading={cancellingOrder}
        onCancel={() => setConfirmCancelOrder(false)}
        onConfirm={async () => {
          if (!editingId || cancellingOrder) return;
          setCancellingOrder(true);
          try {
            await ordersApi.cancel(editingId, 'Cancelled by staff');
            setConfirmCancelOrder(false);
            setModalMode(null);
            showToast('Order cancelled and commitment released', 'warning');
            await loadData(true);
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to cancel order', 'error');
          } finally {
            setCancellingOrder(false);
          }
        }}
      />
    </div>
  );
}
