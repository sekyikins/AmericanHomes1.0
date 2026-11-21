'use client';

import {
  CollectionDetailModal,
  RecordCollectionModal,
} from '@/components/staff/collections/CollectionModals';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { collectionsApi } from '@/lib/api';
import { downloadCsv, formatStatusLabel, shortRef } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type CollectionRow = {
  id: string;
  reference: string;
  orderId: string;
  customer: string;
  source: 'Online' | 'Walk-in';
  product: string;
  collectorName: string;
  collectionStatus: string;
  collectionTone: 'green' | 'amber' | 'blue';
  date: string;
  quantity: number;
  isAwaitingCollection?: boolean;
  paymentStatus?: string;
  remainingCents?: number;
};

type OrderOption = {
  id: string;
  reference: string;
  customer: string;
  paymentStatus: string;
  remainingCents: number;
  totalCents: number;
};

export default function StaffCollectionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Walk-in'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<CollectionRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [collectorId, setCollectorId] = useState('');
  const [notes, setNotes] = useState('');
  const [unpaidApproved, setUnpaidApproved] = useState(false);

  const loadOrderOptions = useCallback(async () => {
    const ordList = await collectionsApi.eligibleOrders().catch(() => []);
    const opts: OrderOption[] = (Array.isArray(ordList) ? ordList : []).map(
      (o: Record<string, unknown>) => {
        const customer = o.customer as { user?: { name?: string; phone?: string } } | undefined;
        const totalCents = Number(o.totalCents ?? 0);
        const verified = (Array.isArray(o.payments) ? o.payments : []) as Array<{ amountCents?: number }>;
        const paid = verified.reduce((s, p) => s + Number(p.amountCents ?? 0), 0);
        return {
          id: String(o.id),
          reference: shortRef(String(o.reference || o.id), 'ORD'),
          customer: customer?.user?.name || customer?.user?.phone || 'Walk-in',
          paymentStatus: String(o.paymentStatus || 'PENDING'),
          totalCents,
          remainingCents: Math.max(0, totalCents - paid),
        };
      },
    );
    setOrderOptions(opts);
    if (opts[0]) setSelectedOrderId((prev) => prev || opts[0].id);
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [colList, eligList] = await Promise.all([
        collectionsApi.list(),
        collectionsApi.eligibleOrders().catch(() => []),
      ]);
      const recordedRows: CollectionRow[] = (
        Array.isArray(colList) ? colList : []
      ).map((c: Record<string, unknown>) => {
        const order = c.order as {
          id?: string;
          reference?: string;
          source?: string;
          collectionStatus?: string;
          customer?: { user?: { name?: string; phone?: string } };
        } | undefined;
        const status = String(order?.collectionStatus || 'COLLECTED');
        return {
          id: String(c.id),
          orderId: String(c.orderId || order?.id || ''),
          reference: shortRef(
            String(order?.reference || `COL-${String(c.id).slice(-6).toUpperCase()}`),
            'ORD',
          ),
          customer: order?.customer?.user?.name || order?.customer?.user?.phone || 'Customer',
          source: String(order?.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
          product: String(c.notes || 'Warehouse handover'),
          collectorName: String(c.representativeName || c.collectorName || 'Customer'),
          collectionStatus: status,
          collectionTone: status === 'COLLECTED' ? 'green' : status === 'PARTIAL' ? 'blue' : 'amber',
          date: c.collectedAt ? new Date(String(c.collectedAt)).toLocaleDateString('en-GH') : 'Recent',
          quantity: Number(c.quantity ?? 1),
        };
      });

      const recordedOrderIds = new Set(recordedRows.map((r) => r.orderId));
      const awaitingRows: CollectionRow[] = (
        Array.isArray(eligList) ? eligList : []
      )
        .filter((o: Record<string, unknown>) => {
          const payStatus = String(o.paymentStatus || 'PENDING');
          return !recordedOrderIds.has(String(o.id)) && (payStatus === 'PAID' || payStatus === 'PARTIALLY_PAID');
        })
        .map((o: Record<string, unknown>) => {
          const customer = o.customer as { user?: { name?: string; phone?: string } } | undefined;
          const totalCents = Number(o.totalCents ?? 0);
          const verified = (Array.isArray(o.payments) ? o.payments : []) as Array<{ amountCents?: number }>;
          const paid = verified.reduce((s, p) => s + Number(p.amountCents ?? 0), 0);
          const remainingCents = Math.max(0, totalCents - paid);
          const payStatus = String(o.paymentStatus || 'PENDING');
          const lines = (Array.isArray(o.lines) ? o.lines : []) as Array<{
            quantity?: number;
            variant?: { product?: { name?: string } };
          }>;
          const totalQty = lines.reduce((s, l) => s + Number(l.quantity ?? 1), 0);
          const firstProd = lines[0]?.variant?.product?.name || 'Order items';
          return {
            id: `await-${String(o.id)}`,
            orderId: String(o.id),
            reference: shortRef(String(o.reference || o.id), 'ORD'),
            customer: customer?.user?.name || customer?.user?.phone || 'Walk-in',
            source: String(o.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
            product:
              payStatus === 'PAID'
                ? `${firstProd} · Paid in full`
                : `${firstProd} · Balance GHS ${(remainingCents / 100).toLocaleString()}`,
            collectorName: 'Awaiting pickup',
            collectionStatus: payStatus === 'PAID' ? 'READY' : 'RESTRICTED (PARTIAL)',
            collectionTone: payStatus === 'PAID' ? 'green' : 'amber',
            date: o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString('en-GH') : 'Recent',
            quantity: totalQty || 1,
            isAwaitingCollection: true,
            paymentStatus: payStatus,
            remainingCents,
          };
        });

      setRows([...awaitingRows, ...recordedRows]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load collections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visible = rows.filter((r) => {
    if (collectionFilter !== 'All' && r.collectionStatus !== collectionFilter) return false;
    if (sourceFilter !== 'All' && r.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reference.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.collectorName.toLowerCase().includes(q)
    );
  });

  const selectedOrderOpt = orderOptions.find((o) => o.id === selectedOrderId);
  const needsUnpaidApproval =
    selectedOrderOpt !== undefined && selectedOrderOpt.paymentStatus !== 'PAID';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedOrderId) return;
    if (needsUnpaidApproval && !user?.isOwner && !unpaidApproved) {
      showToast(
        'Orders with an unpaid balance are restricted unless authorized by management or the Owner.',
        'warning',
      );
      return;
    }
    setSubmitting(true);
    try {
      await collectionsApi.record({
        orderId: selectedOrderId,
        representativeName: collectorName.trim() || undefined,
        representativePhone: collectorId.trim() || undefined,
        ...(needsUnpaidApproval && (user?.isOwner || unpaidApproved)
          ? { unpaidExceptionApprovedBy: user?.id }
          : {}),
        notes: notes.trim() || undefined,
      });
      setModalOpen(false);
      setCollectorName('');
      setCollectorId('');
      setNotes('');
      setUnpaidApproved(false);
      showToast('Collection handover recorded', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record collection', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65242">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Collections
          </h1>
          <p className="dash-sub">
            Record warehouse collection and partial handovers.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setModalOpen(true);
            loadOrderOptions();
          }}
        >
          <Plus size={15} />
          <span>Record collection</span>
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
            {ch === 'All' ? 'All collections' : `${ch}`}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order reference, customer or collector…"
            aria-label="Search order reference, customer or collector"
          />
        </label>

        <StaffFilterDropdown
          label="Status"
          value={collectionFilter}
          options={['All', 'COLLECTED', 'PARTIAL', 'PENDING']}
          onChange={setCollectionFilter}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'collections.csv',
              ['Reference', 'Customer', 'Collector', 'Qty', 'Status', 'Date'],
              visible.map((r) => [
                r.reference,
                r.customer,
                r.collectorName,
                r.quantity,
                r.collectionStatus,
                r.date,
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
          <span>ORDER</span>
          <span>CUSTOMER</span>
          <span>COLLECTOR</span>
          <span>STATUS</span>
          <span>QTY</span>
          <span>DATE</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No collections recorded"
            description="Record a warehouse handover or clear your current filters."
          />
        ) : (
          visible.map((r) => (
            <button
              key={r.id}
              type="button"
              className="staff-table-row staff-sales-cols"
              onClick={() => {
                if (r.isAwaitingCollection) {
                  setSelectedOrderId(r.orderId);
                  setUnpaidApproved(false);
                  setModalOpen(true);
                  loadOrderOptions();
                } else {
                  setDetailRow(r);
                }
              }}
            >
              <div>
                <strong title={r.reference}>{r.reference}</strong>
                <small>{r.product}</small>
              </div>
              <div>
                <span className="staff-cell-text">{r.customer}</span>
                <small style={{ display: 'block', marginTop: 2 }}>
                  <span className={`acct-pill ${r.source === 'Online' ? 'green' : 'blue'}`}>
                    {r.source}
                  </span>
                </small>
              </div>
              <span className="staff-cell-text">{r.collectorName}</span>
              <div>
                <span className={`acct-pill ${r.collectionTone}`}>
                  ● {formatStatusLabel(r.collectionStatus)}
                </span>
              </div>
              <span className="staff-cell-text">{r.quantity}</span>
              <span className="staff-cell-muted">{r.date}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <CollectionDetailModal
        detailRow={detailRow}
        onClose={() => setDetailRow(null)}
      />

      <RecordCollectionModal
        open={modalOpen}
        orderOptions={orderOptions}
        selectedOrderId={selectedOrderId}
        selectedOrderOpt={selectedOrderOpt}
        needsUnpaidApproval={Boolean(needsUnpaidApproval)}
        isOwner={Boolean(user?.isOwner)}
        unpaidApproved={unpaidApproved}
        collectorName={collectorName}
        collectorId={collectorId}
        notes={notes}
        submitting={submitting}
        onOrderChange={setSelectedOrderId}
        onUnpaidApprovedChange={setUnpaidApproved}
        onCollectorNameChange={setCollectorName}
        onCollectorIdChange={setCollectorId}
        onNotesChange={setNotes}
        onSubmit={handleSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
