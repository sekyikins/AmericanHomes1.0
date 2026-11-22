'use client';

import {
  CreateReturnModal,
  ReviewReturnModal,
} from '@/components/staff/returns/ReturnModals';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { ordersApi, returnsApi } from '@/lib/api';
import { downloadCsv, formatStatusLabel, shortRef } from '@/lib/staffUtils';
import {
  applyFiltersAndSort,
  cycleSort,
  deriveFilterCategories,
  type FilterCategoryDef,
  type FilterValueMap,
  type SortColumnDef,
  type SortState,
} from '@/lib/tableUtils';
import { useToast } from '@/providers/toast.provider';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type ReturnOrderLine = {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
};

type ReturnRow = {
  id: string;
  reference: string;
  orderReference: string;
  customer: string;
  source: 'Online' | 'Walk-in';
  reason: string;
  status: string;
  statusTone: 'amber' | 'gray' | 'green';
  disposition: string;
  settlementSummary: string;
  date: string;
  orderLines: ReturnOrderLine[];
};

type OrderOption = { id: string; reference: string; customer: string };

export default function StaffReturnsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Walk-in'>('All');
  const [modalMode, setModalMode] = useState<'create' | 'review' | null>(null);
  const [selected, setSelected] = useState<ReturnRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<boolean | null>(null);

  const [orderId, setOrderId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [settlementType, setSettlementType] = useState<'REFUND' | 'EXCHANGE' | 'STORE_CREDIT'>('REFUND');
  const [disposition, setDisposition] = useState<'RESTOCK' | 'DISPOSE' | 'EXCHANGE'>('RESTOCK');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [refundAmountGhs, setRefundAmountGhs] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  const loadOrders = useCallback(async () => {
    if (orders.length > 0) return;
    const ordList = await ordersApi.list().catch(() => []);
    const opts: OrderOption[] = (Array.isArray(ordList) ? ordList : []).map(
      (o: Record<string, unknown>) => {
        const customer = o.customer as { user?: { name?: string; phone?: string } } | undefined;
        return {
          id: String(o.id),
          reference: shortRef(String(o.reference || o.id), 'ORD'),
          customer: customer?.user?.name || customer?.user?.phone || 'Walk-in',
        };
      },
    );
    setOrders(opts);
    if (opts[0]) setOrderId((prev) => prev || opts[0].id);
  }, [orders.length]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const retList = await returnsApi.list();
      const mapped: ReturnRow[] = (
        Array.isArray(retList) ? retList : []
      ).map((r: Record<string, unknown>) => {
        const order = r.order as {
          reference?: string;
          source?: string;
          totalCents?: number;
          customer?: { user?: { name?: string; phone?: string } };
          lines?: Array<{
            id: string;
            variantId: string;
            quantity: number;
            unitPriceCents: number;
            variant?: { name?: string | null; sku?: string; product?: { name?: string } };
          }>;
        } | undefined;
        const status = String(r.status || 'REQUESTED');
        const orderLines: ReturnOrderLine[] = (order?.lines ?? []).map((l) => ({
          id: l.id,
          variantId: l.variantId,
          label: `${l.variant?.product?.name ?? 'Product'}${l.variant?.name ? ` (${l.variant.name})` : ''}`,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        }));
        const refundCents = Number(r.refundAmountCents ?? 0);
        const stType = r.settlementType ? String(r.settlementType) : '';
        return {
          id: String(r.id),
          reference: `RET-${String(r.id).slice(-6).toUpperCase()}`,
          orderReference: shortRef(order?.reference || String(r.orderId), 'ORD'),
          customer: order?.customer?.user?.name || order?.customer?.user?.phone || 'Customer',
          source: String(order?.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
          reason: String(r.reason || 'Return request'),
          status,
          statusTone:
            status === 'APPROVED' || status === 'COMPLETED'
              ? 'green'
              : status === 'PENDING' || status === 'REQUESTED' || status === 'UNDER_REVIEW'
                ? 'amber'
                : 'gray',
          disposition: String(
            r.disposition ||
              (status === 'APPROVED' || status === 'COMPLETED'
                ? 'Processed'
                : status === 'REJECTED'
                  ? 'Closed'
                  : 'Pending'),
          ),
          settlementSummary:
            stType && refundCents > 0
              ? `${formatStatusLabel(stType)} · GHS ${(refundCents / 100).toLocaleString()}`
              : stType
                ? formatStatusLabel(stType)
                : 'Pending',
          date: r.createdAt ? new Date(String(r.createdAt)).toLocaleDateString('en-GH') : 'Recent',
          orderLines,
        };
      });
      setRows(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load returns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filterDefs: FilterCategoryDef<ReturnRow>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', accessor: (r) => r.status },
      { key: 'disposition', label: 'Disposition', accessor: (r) => r.disposition },
      { key: 'source', label: 'Channel', accessor: (r) => r.source },
    ],
    [],
  );

  const sortDefs: SortColumnDef<ReturnRow>[] = useMemo(
    () => [
      { key: 'reference', type: 'string', accessor: (r) => r.reference },
      { key: 'customer', type: 'string', accessor: (r) => r.customer },
      { key: 'reason', type: 'string', accessor: (r) => r.reason },
      {
        key: 'status',
        type: 'status',
        statusOrder: ['PENDING', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'REJECTED'],
        accessor: (r) => r.status,
      },
      { key: 'disposition', type: 'string', accessor: (r) => r.disposition },
      { key: 'date', type: 'date', accessor: (r) => r.date },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(rows, filterDefs), [rows, filterDefs]);

  const visible = useMemo(() => {
    const searched = rows.filter((r) => {
      if (sourceFilter !== 'All' && r.source !== sourceFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.reference.toLowerCase().includes(q) ||
        r.orderReference.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [rows, sourceFilter, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !orderId || !returnReason.trim()) return;
    setSubmitting(true);
    try {
      await returnsApi.create({
        orderId,
        reason: returnReason.trim(),
      });
      setModalMode(null);
      setReturnReason('');
      showToast('Return case created', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create return', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async () => {
    if (!selected || pendingDecision === null || submitting) return;
    setSubmitting(true);
    try {
      const qtyNum = Math.max(1, Number(returnQty) || 1);
      const refundCents =
        settlementType !== 'EXCHANGE' && Number(refundAmountGhs) > 0
          ? Math.round(Number(refundAmountGhs) * 100)
          : undefined;
      await returnsApi.decide(selected.id, {
        approved: pendingDecision,
        ...(pendingDecision
          ? {
              settlementType,
              disposition,
              ...(refundCents ? { refundAmountCents: refundCents } : {}),
              ...(selectedVariantId ? { variantId: selectedVariantId, quantity: qtyNum } : {}),
            }
          : {}),
        notes: decisionNotes.trim() || undefined,
      });
      setPendingDecision(null);
      setModalMode(null);
      setDecisionNotes('');
      showToast(
        pendingDecision
          ? `Return ${selected.reference} approved (${settlementType})`
          : `Return ${selected.reference} rejected`,
        pendingDecision ? 'success' : 'warning',
      );
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record return decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65244">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Returns
          </h1>
          <p className="dash-sub">
            Inspect returns, apply policy decisions and assign stock disposition.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setModalMode('create');
            loadOrders();
          }}
        >
          <Plus size={15} />
          <span>Create return</span>
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
            {ch === 'All' ? 'All returns' : `${ch}`}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return ref, order or customer…"
            aria-label="Search return ref, order or customer"
          />
        </label>

        <HierarchicalFilterDropdown
          categories={filterCategories}
          selected={filters}
          onChange={setFilters}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'returns.csv',
              ['Reference', 'Order', 'Customer', 'Reason', 'Status', 'Disposition', 'Date'],
              visible.map((r) => [
                r.reference,
                r.orderReference,
                r.customer,
                r.reason,
                r.status,
                r.disposition,
                r.date,
              ]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <ActiveFilterChips
        categories={filterCategories}
        selected={filters}
        onChange={setFilters}
      />

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-sales-cols">
          <SortableHeader label="REFERENCE" sortKey="reference" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="CUSTOMER" sortKey="customer" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="REASON" sortKey="reason" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="STATUS" sortKey="status" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="DISPOSITION" sortKey="disposition" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="DATE" sortKey="date" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
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
            title="No return requests found"
            description="No return records match your current search or filter."
            action={
              search || hasActiveFilters ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSearch('');
                    setFilters({});
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          visible.map((r) => (
            <button
              key={r.id}
              type="button"
              className="staff-table-row staff-sales-cols"
              onClick={() => {
                setSelected(r);
                const firstLine = r.orderLines[0];
                setSelectedVariantId(firstLine?.variantId ?? '');
                setReturnQty(String(firstLine?.quantity ?? 1));
                setRefundAmountGhs(
                  firstLine
                    ? String(((firstLine.unitPriceCents * firstLine.quantity) / 100).toFixed(2))
                    : '',
                );
                setModalMode('review');
              }}
            >
              <div>
                <strong>{r.reference}</strong>
                <small>{r.orderReference}</small>
              </div>
              <div>
                <span className="staff-cell-text">{r.customer}</span>
                <small style={{ display: 'block', marginTop: 2 }}>
                  <span className={`acct-pill ${r.source === 'Online' ? 'green' : 'blue'}`}>
                    {r.source}
                  </span>
                </small>
              </div>
              <span className="staff-cell-text">{r.reason}</span>
              <div>
                <span className={`acct-pill ${r.statusTone}`}>● {formatStatusLabel(r.status)}</span>
              </div>
              <span className="staff-cell-muted">
                {formatStatusLabel(r.disposition)} · {r.settlementSummary}
              </span>
              <span className="staff-cell-muted">{r.date}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <CreateReturnModal
        open={modalMode === 'create'}
        orders={orders}
        orderId={orderId}
        returnReason={returnReason}
        submitting={submitting}
        onOrderIdChange={setOrderId}
        onReasonChange={setReturnReason}
        onSubmit={handleCreate}
        onClose={() => setModalMode(null)}
      />

      <ReviewReturnModal
        open={modalMode === 'review'}
        selected={selected}
        selectedVariantId={selectedVariantId}
        returnQty={returnQty}
        settlementType={settlementType}
        disposition={disposition}
        refundAmountGhs={refundAmountGhs}
        decisionNotes={decisionNotes}
        onVariantChange={(variantId) => {
          const line = selected?.orderLines.find((l) => l.variantId === variantId);
          setSelectedVariantId(variantId);
          if (line) {
            setReturnQty(String(line.quantity));
            setRefundAmountGhs(
              String(((line.unitPriceCents * line.quantity) / 100).toFixed(2)),
            );
          }
        }}
        onReturnQtyChange={setReturnQty}
        onSettlementTypeChange={setSettlementType}
        onDispositionChange={setDisposition}
        onRefundAmountChange={setRefundAmountGhs}
        onDecisionNotesChange={setDecisionNotes}
        onDecisionClick={(approved) => setPendingDecision(approved)}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={pendingDecision !== null && Boolean(selected)}
        title={pendingDecision ? 'Approve return case?' : 'Reject return case?'}
        targetName={selected ? `${selected.reference} · ${selected.orderReference}` : undefined}
        description={
          pendingDecision
            ? `This will approve the return with ${settlementType} settlement and ${disposition} stock disposition.`
            : 'This will reject the return request.'
        }
        reversible={false}
        destructive={!pendingDecision}
        confirmLabel={pendingDecision ? 'Approve return' : 'Reject return'}
        loading={submitting}
        onCancel={() => setPendingDecision(null)}
        onConfirm={handleDecision}
      />
    </div>
  );
}
