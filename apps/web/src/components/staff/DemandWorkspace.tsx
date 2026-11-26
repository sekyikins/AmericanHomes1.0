'use client';

import {
  demandTone,
  initialsOf,
  mapStatus,
  MODE_CONFIG,
  type DemandItem,
  type DemandMode,
  type DemandStatus,
} from '@/components/staff/demand/demandConfig';
import { DemandCreateModal } from '@/components/staff/demand/DemandCreateModal';
import { DemandDetailDrawer } from '@/components/staff/demand/DemandDetailDrawer';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
} from '@/components/staff/TableControls';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import {
  allocationsApi,
  catalogueApi,
  requestsApi,
  shipmentsApi,
  sourcingApi,
} from '@/lib/api';
import { downloadCsv } from '@/lib/staffUtils';
import {
  applyFiltersAndSort,
  deriveFilterCategories,
  type FilterCategoryDef,
  type FilterValueMap,
} from '@/lib/tableUtils';
import { useToast } from '@/providers/toast.provider';
import {
  ChevronRight,
  Download,
  Info,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

export function DemandWorkspace({
  mode,
}: {
  mode: DemandMode;
}) {
  const cfg = MODE_CONFIG[mode];
  const { showToast } = useToast();

  const [items, setItems] = useState<DemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [managementNote, setManagementNote] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeferOpen, setConfirmDeferOpen] = useState(false);

  // Supporting options for sourcing / allocations modals
  const [shipments, setShipments] = useState<Array<{ id: string; reference: string }>>([]);
  const [variants, setVariants] = useState<Array<{ id: string; label: string }>>([]);
  const [requestOptions, setRequestOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [restockRecs, setRestockRecs] = useState<
    Array<{
      variantId: string;
      productName: string;
      category: string;
      priorityTier: 'HIGH' | 'MEDIUM' | 'EMERGING';
      recommendedQty: number;
      dominantChannel: string;
      rationale: string;
    }>
  >([]);
  const [markdownRecs, setMarkdownRecs] = useState<
    Array<{
      variantId: string;
      productName: string;
      availableStock: number;
      daysOnFloor: number;
      wishlistSaves: number;
      currentPriceCents: number;
      suggestedPriceCents: number;
      markdownPct: number;
      reason: string;
    }>
  >([]);
  const [proposingMarkdownId, setProposingMarkdownId] = useState<string | null>(null);

  // Create modal fields
  const [newProduct, setNewProduct] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newShipmentId, setNewShipmentId] = useState('');
  const [newRequestId, setNewRequestId] = useState('');
  const [newVariantId, setNewVariantId] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      if (mode === 'requests') {
        const res = (await requestsApi.list()) as Array<{
          id: string;
          productName: string;
          description?: string;
          quantity: number;
          status: string;
          budgetCents?: number | null;
          createdAt: string;
          customer?: { user?: { name?: string; phone?: string } };
        }>;
        const mapped: DemandItem[] = (Array.isArray(res) ? res : []).map((r) => {
          const customerName = r.customer?.user?.name || r.customer?.user?.phone || 'Customer';
          return {
            id: r.id,
            reference: `REQ-${r.id.slice(-6).toUpperCase()}`,
            title: r.productName,
            customerName,
            customerInitials: initialsOf(customerName),
            customerMeta: r.customer?.user?.phone || 'Registered customer',
            qty: r.quantity,
            status: mapStatus(r.status),
            submittedDate: new Date(r.createdAt).toLocaleDateString('en-GH'),
            colour: 'Requested spec',
            budget: r.budgetCents ? `GHS ${(r.budgetCents / 100).toLocaleString()}` : 'Not specified',
            relatedRequests: r.description || 'Customer request',
            image: '/images/sofa.avif',
          };
        });
        setItems(mapped);
        if (mapped[0]) setSelectedId((prev) => prev || mapped[0].id);
      } else if (mode === 'sourcing') {
        const [res, shpList, recData] = await Promise.all([
          sourcingApi.list(),
          shipmentsApi.list().catch(() => []),
          sourcingApi.recommendations().catch(() => null),
        ]);
        if (recData) {
          setRestockRecs(recData.restockRecommendations ?? []);
          setMarkdownRecs(recData.markdownCandidates ?? []);
        }
        const typedShp = (Array.isArray(shpList) ? shpList : []) as Array<{
          id: string;
          reference: string;
        }>;
        setShipments(typedShp);
        if (typedShp[0]) setNewShipmentId((prev) => prev || typedShp[0].id);

        const mapped: DemandItem[] = (
          Array.isArray(res) ? res : []
        ).map((s: Record<string, unknown>) => ({
          id: String(s.id),
          reference: `SRC-${String(s.id).slice(-6).toUpperCase()}`,
          title: String(s.description || 'Sourcing item'),
          customerName: String((s.shipment as { reference?: string } | undefined)?.reference || 'Shipment'),
          customerInitials: 'SR',
          customerMeta: s.providerRef ? `Ref: ${String(s.providerRef)}` : 'Awaiting provider confirmation',
          qty: Number(s.quantity ?? 1),
          status: mapStatus(String(s.status)),
          submittedDate: s.confirmedAt
            ? new Date(String(s.confirmedAt)).toLocaleDateString('en-GH')
            : 'Pending',
          colour: 'Sourcing plan',
          budget: 'Provider quote',
          relatedRequests: 'Shipment sourcing',
          image: '/images/blender.avif',
        }));
        setItems(mapped);
        if (mapped[0]) setSelectedId((prev) => prev || mapped[0].id);
      } else {
        const [res, reqs, prods] = await Promise.all([
          allocationsApi.list(),
          requestsApi.list().catch(() => []),
          catalogueApi.listAdmin().catch(() => []),
        ]);
        const reqOpts = (Array.isArray(reqs) ? reqs : []).map((r) => ({
          id: String(r.id),
          label: `${String(r.productName || 'Request')} (${String(r.id).slice(-5).toUpperCase()})`,
        }));
        setRequestOptions(reqOpts);
        if (reqOpts[0]) setNewRequestId((prev) => prev || reqOpts[0].id);

        const varOpts: Array<{ id: string; label: string }> = [];
        for (const p of (Array.isArray(prods) ? prods : []) as Array<{
          name: string;
          variants?: Array<{ id: string; sku?: string; name?: string }>;
        }>) {
          for (const v of p.variants ?? []) {
            varOpts.push({
              id: v.id,
              label: `${p.name}${v.sku ? ` (${v.sku})` : ''}`,
            });
          }
        }
        setVariants(varOpts);
        if (varOpts[0]) setNewVariantId((prev) => prev || varOpts[0].id);

        const mapped: DemandItem[] = (
          Array.isArray(res) ? res : []
        ).map((a: Record<string, unknown>) => {
          const req = a.request as { productName?: string; customer?: { user?: { name?: string } } } | undefined;
          const customerName = req?.customer?.user?.name || 'Customer';
          return {
            id: String(a.id),
            reference: `ALC-${String(a.id).slice(-6).toUpperCase()}`,
            title: req?.productName || 'Allocation offer',
            customerName,
            customerInitials: initialsOf(customerName),
            customerMeta: 'Allocation offer',
            qty: Number(a.quantity ?? 1),
            status: mapStatus(String(a.status)),
            submittedDate: a.createdAt
              ? new Date(String(a.createdAt)).toLocaleDateString('en-GH')
              : 'Recent',
            colour: 'Allocated stock',
            budget: 'Matched variant',
            relatedRequests: 'Waitlist / Priority queue',
            image: '/images/tv.avif',
          };
        });
        setItems(mapped);
        if (mapped[0]) setSelectedId((prev) => prev || mapped[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : `Unable to load ${cfg.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [cfg.title, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailOpen]);

  const filterDefs: FilterCategoryDef<DemandItem>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', accessor: (i) => i.status },
      { key: 'customer', label: 'Customer', accessor: (i) => i.customerName },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(items, filterDefs), [items, filterDefs]);

  const visible = useMemo(() => {
    const searched = items.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, null, []);
  }, [items, search, filters, filterDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const selected = items.find((i) => i.id === selectedId) ?? visible[0] ?? items[0];

  const handlePrimaryDecision = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'requests') {
        await requestsApi.review(selected.id, {
          decision: 'SOURCING',
          notes: managementNote.trim() || undefined,
        });
        showToast('Request approved for sourcing', 'success');
      } else if (mode === 'sourcing') {
        await sourcingApi.confirmProvider(selected.id, managementNote.trim() || undefined);
        showToast('Provider confirmation recorded', 'success');
      } else {
        await allocationsApi.respond(selected.id, true);
        showToast('Allocation offer marked accepted', 'success');
      }
      setManagementNote('');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSecondaryDecision = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'requests') {
        await requestsApi.review(selected.id, {
          decision: 'DECLINED',
          notes: managementNote.trim() || 'Deferred by staff',
        });
        showToast('Request marked as deferred', 'warning');
      } else if (mode === 'allocations') {
        await allocationsApi.respond(selected.id, false);
        showToast('Offer declined · advanced waitlist', 'warning');
      }
      setConfirmDeferOpen(false);
      setManagementNote('');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to process action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'requests') {
        if (!newProduct.trim()) return;
        await requestsApi.submit({
          productName: newProduct.trim(),
          description: newDesc.trim() || newProduct.trim(),
          quantity: Math.max(1, Number(newQty) || 1),
        });
      } else if (mode === 'sourcing') {
        if (!newShipmentId || !newProduct.trim()) return;
        await sourcingApi.createItem({
          shipmentId: newShipmentId,
          description: newProduct.trim(),
          quantity: Math.max(1, Number(newQty) || 1),
        });
      } else {
        if (!newRequestId || !newVariantId) return;
        await allocationsApi.createOffer({
          requestId: newRequestId,
          variantId: newVariantId,
          quantity: Math.max(1, Number(newQty) || 1),
        });
      }
      setModalOpen(false);
      setNewProduct('');
      setNewDesc('');
      showToast(`${cfg.modalTitle} saved`, 'success');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-node-id="26:65235">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            {cfg.title}
          </h1>
          <p className="dash-sub">{cfg.subtitle}</p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={15} />
          <span>{cfg.cta}</span>
        </button>
      </div>

      {mode === 'sourcing' && (restockRecs.length > 0 || markdownRecs.length > 0) && (
        <section
          className="ship-card"
          style={{
            marginBottom: 16,
            background: '#f7faf8',
            border: '1px solid #d5e5dc',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span className="ship-eyebrow">PREDICTIVE DEMAND &amp; FLOOR AGING INTELLIGENCE</span>
              <h3 style={{ fontSize: 16, marginTop: 4 }}>
                Storefront + Walk-in Shipment &amp; Markdown Recommendations
              </h3>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
              marginTop: 12,
            }}
          >
            {restockRecs.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  border: '0.8px solid var(--line)',
                  borderRadius: 4,
                  padding: 12,
                }}
              >
                <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>
                  Top Predicted Restocks for Next Shipment ({restockRecs.length})
                </strong>
                <div style={{ display: 'grid', gap: 8 }}>
                  {restockRecs.slice(0, 4).map((rec) => (
                    <div
                      key={rec.variantId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        paddingBottom: 8,
                        borderBottom: '0.8px solid var(--line)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 12.5 }}>{rec.productName}</strong>
                          <span className={`acct-pill ${rec.priorityTier === 'HIGH' ? 'green' : 'amber'}`} style={{ fontSize: 10 }}>
                            ● {rec.priorityTier}
                          </span>
                          <span className="acct-pill blue" style={{ fontSize: 10 }}>
                            {rec.dominantChannel}
                          </span>
                        </div>
                        <small style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginTop: 2 }}>
                          {rec.rationale}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="button"
                        style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5, background: '#fff' }}
                        onClick={() => {
                          setNewProduct(rec.productName);
                          setNewQty(String(rec.recommendedQty));
                          setNewDesc(rec.rationale);
                          setModalOpen(true);
                        }}
                      >
                        + Source {rec.recommendedQty} units
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {markdownRecs.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  border: '0.8px solid var(--line)',
                  borderRadius: 4,
                  padding: 12,
                }}
              >
                <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)', marginBottom: 8 }}>
                  Floor Aging &amp; Dynamic Markdown Candidates ({markdownRecs.length})
                </strong>
                <div style={{ display: 'grid', gap: 8 }}>
                  {markdownRecs.slice(0, 4).map((m) => (
                    <div
                      key={m.variantId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        paddingBottom: 8,
                        borderBottom: '0.8px solid var(--line)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: 12.5, display: 'block' }}>{m.productName}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                          {m.reason} · Current: GHS {(m.currentPriceCents / 100).toLocaleString()} → Suggested: GHS {(m.suggestedPriceCents / 100).toLocaleString()} (-{m.markdownPct}%)
                        </small>
                      </div>
                      <button
                        type="button"
                        className="button"
                        disabled={proposingMarkdownId === m.variantId}
                        style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5, background: '#fff' }}
                        onClick={async () => {
                          setProposingMarkdownId(m.variantId);
                          try {
                            await catalogueApi.proposePrice(m.variantId, {
                              proposedPriceCents: m.suggestedPriceCents,
                              reason: `Dynamic ${m.markdownPct}% floor-aging markdown (${m.availableStock} units in stock)`,
                            });
                            showToast(
                              `Proposed ${m.markdownPct}% markdown for ${m.productName}`,
                              'success',
                            );
                            await loadData(true);
                          } catch (err) {
                            showToast(
                              err instanceof Error ? err.message : 'Unable to propose markdown',
                              'error',
                            );
                          } finally {
                            setProposingMarkdownId(null);
                          }
                        }}
                      >
                        {proposingMarkdownId === m.variantId
                          ? 'Proposing…'
                          : `Propose -${m.markdownPct}% markdown`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="demand-split">
        <div>
          <div className="staff-toolbar">
            <label className="staff-search-box">
              <Search size={16} color="var(--muted)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={cfg.searchPlaceholder}
                aria-label={cfg.searchPlaceholder}
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
                  ['Reference', 'Product', 'Customer', 'Qty', 'Status', 'Submitted'],
                  visible.map((i) => [
                    i.reference,
                    i.title,
                    i.customerName,
                    i.qty,
                    i.status,
                    i.submittedDate,
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
            {loading ? (
              <div style={{ padding: 16 }}>
                <TableSkeleton rows={4} />
              </div>
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={loadData} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={`No ${cfg.title.toLowerCase()} found`}
                description={
                  search || hasActiveFilters
                    ? 'No records match your current search or filter.'
                    : `No ${cfg.title.toLowerCase()} have been recorded yet.`
                }
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
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`demand-row${selected?.id === item.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedId(item.id);
                    setDetailOpen(true);
                  }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.reference} · {item.customerName}
                    </small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.qty > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--muted)',
                          border: '0.8px solid var(--line)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: '#fff',
                        }}
                      >
                        Qty {item.qty}
                      </span>
                    )}
                    <span className={`acct-pill ${demandTone(item.status)}`}>
                      ● {item.status}
                    </span>
                    <ChevronRight size={15} color="var(--muted)" />
                  </div>
                </button>
              ))
            )}
          </section>
        </div>

        {selected && (
          <DemandDetailDrawer
            selected={selected}
            detailOpen={detailOpen}
            onClose={() => setDetailOpen(false)}
            mode={mode}
            managementNote={managementNote}
            setManagementNote={setManagementNote}
            submitting={submitting}
            onDefer={() => setConfirmDeferOpen(true)}
            onPrimaryDecision={handlePrimaryDecision}
          />
        )}
      </div>

      <DemandCreateModal
        open={modalOpen}
        mode={mode}
        eyebrow={cfg.title.toUpperCase()}
        title={cfg.modalTitle}
        subtitle={cfg.modalSub}
        submitting={submitting}
        shipments={shipments}
        variants={variants}
        requestOptions={requestOptions}
        newProduct={newProduct}
        newDesc={newDesc}
        newQty={newQty}
        newShipmentId={newShipmentId}
        newRequestId={newRequestId}
        newVariantId={newVariantId}
        onProductChange={setNewProduct}
        onDescChange={setNewDesc}
        onQtyChange={setNewQty}
        onShipmentIdChange={setNewShipmentId}
        onRequestIdChange={setNewRequestId}
        onVariantIdChange={setNewVariantId}
        onSubmit={handleCreate}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeferOpen && Boolean(selected)}
        title={mode === 'allocations' ? 'Decline allocation offer?' : 'Defer product request?'}
        targetName={selected ? `${selected.reference} · ${selected.title}` : undefined}
        description={
          mode === 'allocations'
            ? 'This will mark the offer declined and free the allocation for the next customer.'
            : 'This will move the request to Deferred status.'
        }
        reversible={true}
        destructive={true}
        confirmLabel={mode === 'allocations' ? 'Decline offer' : 'Defer request'}
        loading={submitting}
        onCancel={() => setConfirmDeferOpen(false)}
        onConfirm={handleSecondaryDecision}
      />
    </div>
  );
}
