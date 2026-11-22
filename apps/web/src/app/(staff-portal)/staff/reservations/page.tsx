'use client';

import {
  CreateReservationModal,
  ReviewReservationModal,
} from '@/components/staff/reservations/ReservationModals';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, reservationsApi } from '@/lib/api';
import { downloadCsv, formatStatusLabel } from '@/lib/staffUtils';
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

type ReservationRow = {
  id: string;
  reference: string;
  customer: string;
  source: 'Online' | 'Walk-in';
  product: string;
  variantId: string;
  amountOrQty: string;
  status: string;
  paymentTone: 'amber' | 'gray' | 'green';
  holdExpires: string;
  date: string;
  requestedQty: number;
};

type VariantOpt = { id: string; label: string };

export default function StaffReservationsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [variants, setVariants] = useState<VariantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Online' | 'Walk-in'>('All');
  const [modalMode, setModalMode] = useState<'create' | 'review' | null>(null);
  const [selected, setSelected] = useState<ReservationRow | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);

  const [newCustomer, setNewCustomer] = useState('');
  const [newVariantId, setNewVariantId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newNotes, setNewNotes] = useState('');

  const loadVariants = useCallback(async () => {
    if (variants.length > 0) return;
    const prodList = await catalogueApi.listAdmin().catch(() => []);
    const opts: VariantOpt[] = [];
    for (const p of (Array.isArray(prodList) ? prodList : []) as Array<{
      name: string;
      variants?: Array<{ id: string; sku?: string; name?: string }>;
    }>) {
      for (const v of p.variants ?? []) {
        opts.push({
          id: v.id,
          label: `${p.name}${v.sku ? ` (${v.sku})` : ''}`,
        });
      }
    }
    setVariants(opts);
    if (opts[0]) setNewVariantId((prev) => prev || opts[0].id);
  }, [variants.length]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const resList = await reservationsApi.list();
      const mapped: ReservationRow[] = (
        Array.isArray(resList) ? resList : []
      ).map((r: Record<string, unknown>) => {
        const customer = r.customer as { user?: { name?: string; phone?: string } } | undefined;
        const variant = r.variant as { name?: string; sku?: string; product?: { name?: string } } | undefined;
        const status = String(r.status || 'PENDING');
        const qty = Number(r.quantity ?? 1);
        return {
          id: String(r.id),
          reference: `RES-${String(r.id).slice(-6).toUpperCase()}`,
          customer: customer?.user?.name || customer?.user?.phone || 'Customer',
          source: String(r.source ?? 'ONLINE').toUpperCase() === 'WALK_IN' ? 'Walk-in' : 'Online',
          product: variant?.product?.name
            ? `${variant.product.name}${variant.name ? ` · ${variant.name}` : ''}`
            : String(r.variantId),
          variantId: String(r.variantId),
          amountOrQty: `${qty} ${qty === 1 ? 'unit' : 'units'}`,
          status,
          paymentTone:
            status === 'APPROVED' || status === 'ACTIVE' || status === 'FULFILLED'
              ? 'green'
              : status === 'PENDING'
                ? 'amber'
                : 'gray',
          holdExpires: r.expiresAt
            ? new Date(String(r.expiresAt)).toLocaleString('en-GH')
            : 'No expiry set',
          date: r.createdAt
            ? new Date(String(r.createdAt)).toLocaleDateString('en-GH')
            : 'Recent',
          requestedQty: Number(r.quantity ?? 1),
        };
      });
      setRows(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filterDefs: FilterCategoryDef<ReservationRow>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', accessor: (r) => r.status },
      { key: 'source', label: 'Channel', accessor: (r) => r.source },
    ],
    [],
  );

  const sortDefs: SortColumnDef<ReservationRow>[] = useMemo(
    () => [
      { key: 'reference', type: 'string', accessor: (r) => r.reference },
      { key: 'customer', type: 'string', accessor: (r) => r.customer },
      { key: 'requestedQty', type: 'number', accessor: (r) => r.requestedQty },
      {
        key: 'status',
        type: 'status',
        statusOrder: ['PENDING', 'APPROVED', 'ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED'],
        accessor: (r) => r.status,
      },
      { key: 'holdExpires', type: 'date', accessor: (r) => r.holdExpires },
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
        r.customer.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [rows, sourceFilter, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !newVariantId) return;
    setSubmitting(true);
    try {
      const combinedNotes = [
        newCustomer.trim() ? `Customer: ${newCustomer.trim()}` : '',
        newNotes.trim(),
      ]
        .filter(Boolean)
        .join(' · ');
      await reservationsApi.request({
        productVariantId: newVariantId,
        quantity: Math.max(1, Number(newQty) || 1),
        notes: combinedNotes || undefined,
      });
      setModalMode(null);
      setNewCustomer('');
      setNewNotes('');
      showToast('Reservation request submitted', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create reservation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await reservationsApi.approve(selected.id);
      setModalMode(null);
      showToast(`Reservation ${selected.reference} approved and stock held`, 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to approve reservation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await reservationsApi.decline(
        selected.id,
        decisionNote.trim() || 'Declined by staff',
      );
      setConfirmDecline(false);
      setModalMode(null);
      showToast(`Reservation ${selected.reference} declined`, 'warning');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to decline reservation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65240">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Reservations
          </h1>
          <p className="dash-sub">
            Hold eligible stock temporarily with clear expiry and approval controls.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setModalMode('create');
            loadVariants();
          }}
        >
          <Plus size={15} />
          <span>Create reservation</span>
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
            {ch === 'All' ? 'All reservations' : `${ch}`}
          </button>
        ))}
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, customer or product…"
            aria-label="Search reservation, customer or product"
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
              'reservations.csv',
              ['Reference', 'Customer', 'Product', 'Qty', 'Status', 'Expires', 'Date'],
              visible.map((r) => [
                r.reference,
                r.customer,
                r.product,
                r.amountOrQty,
                r.status,
                r.holdExpires,
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
          <SortableHeader label="AMOUNT / QTY" sortKey="requestedQty" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="STATUS" sortKey="status" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="HOLD EXPIRES" sortKey="holdExpires" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
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
            title="No reservations found"
            description="No reservations match your current search or filter."
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
                setDecisionNote('');
                setModalMode('review');
              }}
            >
              <div>
                <strong>{r.reference}</strong>
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
              <span className="staff-cell-text">{r.amountOrQty}</span>
              <div>
                <span className={`acct-pill ${r.paymentTone}`}>
                  ● {formatStatusLabel(r.status)}
                </span>
              </div>
              <span className="staff-cell-muted">{r.holdExpires}</span>
              <span className="staff-cell-muted">{r.date}</span>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <CreateReservationModal
        open={modalMode === 'create'}
        variants={variants}
        newCustomer={newCustomer}
        newVariantId={newVariantId}
        newQty={newQty}
        newNotes={newNotes}
        submitting={submitting}
        onCustomerChange={setNewCustomer}
        onVariantChange={setNewVariantId}
        onQtyChange={setNewQty}
        onNotesChange={setNewNotes}
        onSubmit={handleCreate}
        onClose={() => setModalMode(null)}
      />

      <ReviewReservationModal
        open={modalMode === 'review'}
        selected={selected}
        decisionNote={decisionNote}
        submitting={submitting}
        onDecisionNoteChange={setDecisionNote}
        onDeclineClick={() => setConfirmDecline(true)}
        onApprove={handleApprove}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={confirmDecline && Boolean(selected)}
        title="Decline reservation?"
        targetName={selected?.reference}
        description="Declining this reservation will close the request without holding inventory."
        reversible={false}
        destructive={true}
        confirmLabel="Decline reservation"
        loading={submitting}
        onCancel={() => setConfirmDecline(false)}
        onConfirm={handleDecline}
      />
    </div>
  );
}
