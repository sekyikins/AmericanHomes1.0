'use client';

import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import {
  StockActionModal,
  StockLedgerModal,
} from '@/components/staff/stock/StockModals';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { inventoryApi, stocktakesApi } from '@/lib/api';
import { downloadCsv } from '@/lib/staffUtils';
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
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  Lock,
  Plus,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type InventoryRow = {
  id: string;
  product: string;
  variant: string;
  identifier: string;
  lot: string;
  physical: number;
  available: number;
  held: number;
  unavailable: number;
  condition: string;
  status: 'Saleable' | 'Hold';
  image: string;
};

type AdjustmentRow = {
  id: string;
  reference: string;
  variantId: string;
  item: string;
  delta: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

type MovementRow = {
  id: string;
  quantity: number;
  reason: string;
  createdAt: string;
};

export function StockWorkspace({ mode }: { mode: 'inventory' | 'stocktakes' }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);
  const [modalOpen, setModalOpen] = useState<'adjustment' | 'stocktake' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [ledgerRow, setLedgerRow] = useState<InventoryRow | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [pendingDecision, setPendingDecision] = useState<{
    adj: AdjustmentRow;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [deciding, setDeciding] = useState(false);

  const [adjVariantId, setAdjVariantId] = useState('');
  const [adjCount, setAdjCount] = useState('0');
  const [adjReason, setAdjReason] = useState('Stocktake variance');
  const [adjNotes, setAdjNotes] = useState('');

  const [stkRef, setStkRef] = useState(() => `AH-STK-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`);
  const [stkNotes, setStkNotes] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await inventoryApi.list();
      const mappedRows: InventoryRow[] = (data.items ?? []).map((item) => ({
        id: item.id,
        product: item.productName,
        variant: item.variantName,
        identifier: item.sku,
        lot: item.lotRef,
        physical: item.physical,
        available: item.available,
        held: item.held,
        unavailable: item.unavailable,
        condition: item.condition,
        status: item.available > 0 ? 'Saleable' : 'Hold',
        image: item.image,
      }));
      setRows(mappedRows);
      if (mappedRows[0]) {
        setAdjVariantId((prev) => {
          if (prev) return prev;
          setAdjCount(String(mappedRows[0].physical));
          return mappedRows[0].id;
        });
      }

      const byId = new Map(mappedRows.map((r) => [r.id, r]));
      setAdjustments(
        (data.adjustments ?? []).map((a) => {
          const match = byId.get(a.variantId);
          return {
            id: a.id,
            reference: `AH-ADJ-${a.id.slice(-4).toUpperCase()}`,
            variantId: a.variantId,
            item: match ? `${match.product} · ${match.variant}` : a.variantId,
            delta: `${a.previousQty} → ${a.proposedQty} (${a.quantity >= 0 ? `+${a.quantity}` : a.quantity})`,
            reason: a.reason,
            status: (a.status as AdjustmentRow['status']) || 'PENDING',
          };
        }),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load inventory data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openLedger = async (row: InventoryRow) => {
    setLedgerRow(row);
    setMovements([]);
    setLoadingMovements(true);
    try {
      const res = (await inventoryApi.getMovements(row.id)) as MovementRow[];
      setMovements(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load stock movements', 'error');
    } finally {
      setLoadingMovements(false);
    }
  };

  const filterDefs: FilterCategoryDef<InventoryRow>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', accessor: (r) => r.status },
      { key: 'condition', label: 'Condition', accessor: (r) => r.condition },
      {
        key: 'stockPool',
        label: 'Stock pool',
        accessor: (r) => (r.held > 0 ? 'Has held' : 'All available'),
      },
    ],
    [],
  );

  const sortDefs: SortColumnDef<InventoryRow>[] = useMemo(
    () => [
      { key: 'product', type: 'string', accessor: (r) => r.product },
      { key: 'identifier', type: 'string', accessor: (r) => r.identifier },
      { key: 'physical', type: 'number', accessor: (r) => r.physical },
      { key: 'available', type: 'number', accessor: (r) => r.available },
      { key: 'held', type: 'number', accessor: (r) => r.held },
      { key: 'unavailable', type: 'number', accessor: (r) => r.unavailable },
      { key: 'condition', type: 'string', accessor: (r) => r.condition },
      {
        key: 'status',
        type: 'status',
        statusOrder: ['Saleable', 'Hold'],
        accessor: (r) => r.status,
      },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(rows, filterDefs), [rows, filterDefs]);

  const visible = useMemo(() => {
    const searched = rows.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.product.toLowerCase().includes(q) ||
        item.variant.toLowerCase().includes(q) ||
        item.identifier.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [rows, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const totals = rows.reduce(
    (acc, r) => ({
      physical: acc.physical + r.physical,
      available: acc.available + r.available,
      held: acc.held + r.held,
      unavailable: acc.unavailable + r.unavailable,
    }),
    { physical: 0, available: 0, held: 0, unavailable: 0 },
  );

  const selectedAdjRow = rows.find((r) => r.id === adjVariantId) ?? rows[0];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (modalOpen === 'adjustment') {
        if (!selectedAdjRow) return;
        const physicalCount = Math.max(0, Number(adjCount) || 0);
        const delta = physicalCount - selectedAdjRow.physical;
        await stocktakesApi.proposeAdjustment({
          variantId: selectedAdjRow.id,
          quantity: delta,
          reason: adjNotes.trim() ? `${adjReason}: ${adjNotes.trim()}` : adjReason,
        });
        showToast('Stock adjustment submitted for manager approval', 'success');
      } else {
        if (!stkRef.trim()) return;
        await stocktakesApi.create({ reference: stkRef.trim() });
        showToast(`Stocktake ${stkRef.trim()} created`, 'success');
      }
      setModalOpen(null);
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const executeDecision = async () => {
    if (!pendingDecision || deciding) return;
    setDeciding(true);
    try {
      if (pendingDecision.decision === 'APPROVED') {
        await stocktakesApi.approveAdjustment(pendingDecision.adj.id);
        showToast(`${pendingDecision.adj.reference} approved and applied to ledger`, 'success');
      } else {
        await stocktakesApi.rejectAdjustment(pendingDecision.adj.id, 'Rejected by manager');
        showToast(`${pendingDecision.adj.reference} rejected`, 'warning');
      }
      setPendingDecision(null);
      await loadData(true);
    } catch (err) {
      setPendingDecision(null);
      showToast(err instanceof Error ? err.message : 'Unable to process approval decision', 'error');
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div data-node-id="26:65236">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            {mode === 'inventory' ? 'Inventory & stocktakes' : 'Stocktakes'}
          </h1>
          <p className="dash-sub">
            {mode === 'inventory'
              ? 'Physical, available, held and unavailable stock in one view.'
              : 'Count physical stock and route variances for approval.'}
          </p>
        </div>

        <div className="dash-actions">
          <button
            type="button"
            className="button"
            onClick={() => setModalOpen('stocktake')}
          >
            <Plus size={15} />
            <span>Create stocktake</span>
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => setModalOpen('adjustment')}
          >
            <Plus size={15} />
            <span>Propose adjustment</span>
          </button>
        </div>
      </div>

      <section className="rec-stats-strip">
        <div className="rec-stat-cell">
          <Boxes size={19} color="var(--green)" />
          <div>
            <small>Physical stock</small>
            <strong>{totals.physical}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <CheckCircle2 size={19} color="var(--green)" />
          <div>
            <small>Available</small>
            <strong>{totals.available}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <Lock size={19} color="#b45309" />
          <div>
            <small>Held</small>
            <strong>{totals.held}</strong>
          </div>
        </div>
        <div className="rec-stat-cell">
          <AlertTriangle size={19} color="var(--muted)" />
          <div>
            <small>Unavailable</small>
            <strong>{totals.unavailable}</strong>
          </div>
        </div>
      </section>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, variant or identifier…"
            aria-label="Search product, variant or identifier"
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
              `${mode}.csv`,
              ['Product', 'Variant', 'Identifier', 'Lot', 'Physical', 'Available', 'Held', 'Unavailable', 'Condition', 'Status'],
              visible.map((r) => [
                r.product,
                r.variant,
                r.identifier,
                r.lot,
                r.physical,
                r.available,
                r.held,
                r.unavailable,
                r.condition,
                r.status,
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
        <div className="staff-table-head staff-inv-cols">
          <SortableHeader label="PRODUCT" sortKey="product" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="IDENTIFIER / LOT" sortKey="identifier" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="PHYSICAL" sortKey="physical" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="AVAILABLE" sortKey="available" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="HELD" sortKey="held" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="UNAVAILABLE" sortKey="unavailable" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="CONDITION" sortKey="condition" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="STATUS" sortKey="status" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadData} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No inventory items found"
            description="No product variants match your current search or filters."
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
          visible.map((row) => (
            <button
              key={row.id}
              type="button"
              className="staff-table-row staff-inv-cols"
              onClick={() => openLedger(row)}
            >
              <div className="prod-cell-media">
                <img
                  src={row.image}
                  alt={row.product}
                  className="prod-cell-thumb"
                />
                <div>
                  <strong>{row.product}</strong>
                  <small>{row.variant}</small>
                </div>
              </div>
              <div>
                <strong>{row.identifier}</strong>
                <small>{row.lot}</small>
              </div>
              <span className="staff-cell-text">{row.physical}</span>
              <span className="staff-cell-text">{row.available}</span>
              <span className="staff-cell-text">{row.held}</span>
              <span className="staff-cell-text">{row.unavailable}</span>
              <span className="staff-cell-text">{row.condition}</span>
              <div>
                <span className={`acct-pill ${row.status === 'Saleable' ? 'green' : 'amber'}`}>
                  ● {row.status}
                </span>
              </div>
            </button>
          ))
        )}
      </section>

      <section className="ship-card" style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, margin: 0 }}>Pending stock approvals</h2>
            <p className="ship-card-sub">
              Official balances change only after approval by another authorised
              manager.
            </p>
          </div>
        </div>

        {adjustments.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '10px 0 4px' }}>
            No stock adjustment proposals recorded yet.
          </p>
        ) : (
          adjustments.map((ap) => (
            <div
              key={ap.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 0',
                borderTop: '0.8px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>
                  {ap.reference} · {ap.item} ({ap.delta})
                </strong>
                <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {ap.reason}
                </small>
              </div>
              {ap.status === 'PENDING' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="button"
                    style={{ background: '#fff' }}
                    onClick={() => setPendingDecision({ adj: ap, decision: 'REJECTED' })}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setPendingDecision({ adj: ap, decision: 'APPROVED' })}
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <span className={`acct-pill ${ap.status === 'APPROVED' ? 'green' : 'gray'}`}>
                  ● {ap.status}
                </span>
              )}
            </div>
          ))
        )}
      </section>

      <StockLedgerModal
        ledgerRow={ledgerRow}
        movements={movements}
        loadingMovements={loadingMovements}
        onClose={() => setLedgerRow(null)}
      />

      <StockActionModal
        modalOpen={modalOpen}
        rows={rows}
        selectedAdjRow={selectedAdjRow}
        adjVariantId={adjVariantId}
        adjCount={adjCount}
        adjReason={adjReason}
        adjNotes={adjNotes}
        stkRef={stkRef}
        stkNotes={stkNotes}
        submitting={submitting}
        onAdjVariantChange={(id) => {
          setAdjVariantId(id);
          const match = rows.find((r) => r.id === id);
          if (match) setAdjCount(String(match.physical));
        }}
        onAdjCountChange={setAdjCount}
        onAdjReasonChange={setAdjReason}
        onAdjNotesChange={setAdjNotes}
        onStkRefChange={setStkRef}
        onStkNotesChange={setStkNotes}
        onSubmit={handleSubmit}
        onClose={() => setModalOpen(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDecision)}
        title={
          pendingDecision?.decision === 'APPROVED'
            ? 'Approve stock adjustment?'
            : 'Reject stock adjustment?'
        }
        targetName={pendingDecision ? `${pendingDecision.adj.reference} · ${pendingDecision.adj.item}` : undefined}
        description={
          pendingDecision?.decision === 'APPROVED'
            ? `This will apply ${pendingDecision.adj.delta} to the official stock ledger.`
            : 'This will reject the proposed adjustment without changing inventory balances.'
        }
        reversible={false}
        destructive={pendingDecision?.decision === 'REJECTED'}
        confirmLabel={
          pendingDecision?.decision === 'APPROVED' ? 'Approve adjustment' : 'Reject adjustment'
        }
        loading={deciding}
        onCancel={() => setPendingDecision(null)}
        onConfirm={executeDecision}
      />
    </div>
  );
}
