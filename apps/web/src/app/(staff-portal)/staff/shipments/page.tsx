'use client';

import type { ProductVariantOption } from '@/components/staff/ProductVariantCombobox';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import {
  CreateShipmentView,
  type DraftManifestRow,
} from '@/components/staff/shipments/CreateShipmentView';
import {
  ShipmentDetailView,
  type ManifestDraftRow,
} from '@/components/staff/shipments/ShipmentDetailView';
import {
  mapApiShipment,
  statusTone,
  type ApiShipment,
  type DetailTab,
  type ShipmentRecord,
  type ShipmentStatus,
} from '@/components/staff/shipments/shipmentMapper';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, governanceApi, receivingApi, shipmentsApi } from '@/lib/api';
import { downloadCsv } from '@/lib/staffUtils';
import { useToast } from '@/providers/toast.provider';
import { ChevronRight, Download, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

export default function StaffShipmentsPage() {
  const { showToast } = useToast();
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [variantOptions, setVariantOptions] = useState<ProductVariantOption[]>([]);
  const [providerOptions, setProviderOptions] = useState<string[]>([
    'Atlantic Freight & Logistics',
    'OceanBridge Cargo',
    'Tema Express Freight',
  ]);
  const [editingManifest, setEditingManifest] = useState(false);
  const [manifestDraftRows, setManifestDraftRows] = useState<ManifestDraftRow[]>([]);
  const [manifestRevisionNote, setManifestRevisionNote] = useState('');
  const [savingManifest, setSavingManifest] = useState(false);

  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed' | ShipmentStatus>('All');
  const [showRevisionNote, setShowRevisionNote] = useState(false);

  const [newRef, setNewRef] = useState(() => `AH-SHP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`);
  const [newProvider, setNewProvider] = useState('Atlantic Freight & Logistics');
  const [newTrackingRef, setNewTrackingRef] = useState('');
  const [newDeparture, setNewDeparture] = useState('');
  const [newArrival, setNewArrival] = useState('');
  const [newConfidence, setNewConfidence] = useState('Estimated timeframe');
  const [draftManifest, setDraftManifest] = useState<DraftManifestRow[]>([
    { id: 'dm1', product: '', variant: '', qty: 1 },
  ]);

  const [newMilestone, setNewMilestone] = useState('');
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [newExpCategory, setNewExpCategory] = useState('Customs');
  const [newExpSupplier, setNewExpSupplier] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const loadShipments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [res, productsRes, settingsRes] = await Promise.all([
        shipmentsApi.list(),
        catalogueApi.listAdmin().catch(() => []),
        governanceApi.listSettings().catch(() => []),
      ]);
      const providersRow = (
        Array.isArray(settingsRes) ? (settingsRes as Array<{ key?: string; value?: string }>) : []
      ).find((r) => r.key === 'SHIPMENT_PROVIDERS');
      if (providersRow?.value) {
        const parsed = providersRow.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (parsed.length > 0) {
          setProviderOptions(parsed);
          setNewProvider((prev) => (parsed.includes(prev) ? prev : parsed[0]));
        }
      }
      const mapped = (Array.isArray(res) ? (res as ApiShipment[]) : []).map(mapApiShipment);
      setShipments(mapped);
      if (mapped[0]) setSelectedId((prev) => prev || mapped[0].id);

      const opts: ProductVariantOption[] = [];
      for (const p of Array.isArray(productsRes) ? productsRes : []) {
        const prodName = String((p as { name?: string }).name ?? 'Product');
        const variants = (p as { variants?: Array<{ id: string; sku: string; name?: string | null }> }).variants ?? [];
        for (const v of variants) {
          opts.push({ variantId: v.id, productName: prodName, variantName: v.name ?? '', sku: v.sku });
        }
      }
      setVariantOptions(opts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load shipments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('shipmentId');
      if (id) {
        setSelectedId(id);
        setView('detail');
      } else {
        setView('list');
      }
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const selectedShipment = shipments.find((s) => s.id === selectedId) ?? shipments[0];

  const refreshSelectedShipment = async (id: string) => {
    const full = (await shipmentsApi.get(id)) as ApiShipment;
    setShipments((prev) => prev.map((s) => (s.id === full.id ? mapApiShipment(full) : s)));
    return full;
  };

  const visibleShipments = shipments.filter((s) => {
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Open'
          ? s.status !== 'Reconciled'
          : statusFilter === 'Closed'
            ? s.status === 'Reconciled'
            : s.status === statusFilter;
    if (!matchesStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.reference.toLowerCase().includes(q) ||
      s.providerShort.toLowerCase().includes(q) ||
      s.providerFull.toLowerCase().includes(q)
    );
  });

  const handleCompleteShipment = async () => {
    if (!selectedShipment || submitting) return;
    setSubmitting(true);
    try {
      await shipmentsApi.close(selectedShipment.id);
      setConfirmCloseOpen(false);
      showToast(`Shipment ${selectedShipment.reference} closed and reconciled`, 'success');
      await loadShipments(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to close shipment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus: string) => {
    if (!selectedShipment || submitting || statusUpdating) return;
    setStatusUpdating(nextStatus);
    try {
      await shipmentsApi.updateStatus(selectedShipment.id, nextStatus);
      showToast(`Shipment ${selectedShipment.reference} moved to ${nextStatus.replaceAll('_', ' ')}`, 'success');
      await refreshSelectedShipment(selectedShipment.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update shipment status', 'error');
    } finally {
      setStatusUpdating(null);
    }
  };

  const openManifestEditor = () => {
    if (!selectedShipment) return;
    setManifestDraftRows(
      selectedShipment.manifest.length > 0
        ? selectedShipment.manifest.map((m) => ({
            id: m.id,
            variantId: m.variantId,
            product: m.product,
            qty: m.expectedQty,
          }))
        : [{ id: `mr-${Date.now()}`, product: '', qty: 1 }],
    );
    setManifestRevisionNote('');
    setEditingManifest(true);
  };

  const handleSaveManifestRevision = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || savingManifest) return;
    const validItems = manifestDraftRows
      .filter((r) => r.product.trim() && r.qty > 0)
      .map((r) => ({
        ...(r.variantId ? { variantId: r.variantId } : {}),
        productName: r.product.trim(),
        quantity: Number(r.qty),
        unitCostCents: 0,
      }));
    if (validItems.length === 0) {
      showToast('Add at least one product with quantity > 0', 'warning');
      return;
    }
    setSavingManifest(true);
    try {
      await shipmentsApi.addManifest(selectedShipment.id, {
        notes: manifestRevisionNote.trim() || undefined,
        items: validItems,
      });
      const full = await refreshSelectedShipment(selectedShipment.id);
      setEditingManifest(false);
      showToast(`Saved manifest revision ${full.manifestRevisions?.[0]?.revision ?? ''}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update manifest', 'error');
    } finally {
      setSavingManifest(false);
    }
  };

  const handleAddTrackingMilestone = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !newMilestone.trim() || submitting) return;
    setSubmitting(true);
    try {
      await shipmentsApi.addTracking(selectedShipment.id, { event: newMilestone.trim() });
      setNewMilestone('');
      setShowTrackingForm(false);
      showToast('Tracking milestone added', 'success');
      await refreshSelectedShipment(selectedShipment.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add tracking event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDisposition = async (discrepancyId: string, disposition: string) => {
    if (!selectedShipment) return;
    try {
      await receivingApi.resolveDiscrepancy(discrepancyId, disposition);
      showToast(`Discrepancy resolved: ${disposition}`, 'success');
      await refreshSelectedShipment(selectedShipment.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to resolve discrepancy', 'error');
    }
  };

  const handleAddShipmentExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !newExpSupplier.trim() || !newExpAmount.trim() || submitting) return;
    const numeric = Number(newExpAmount.replace(/[^0-9.]/g, '')) || 0;
    if (numeric <= 0) {
      showToast('Enter a positive expense amount in GHS', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await shipmentsApi.addExpense(selectedShipment.id, {
        category: newExpCategory,
        description: newExpSupplier.trim(),
        amountCents: Math.round(numeric * 100),
      });
      setNewExpSupplier('');
      setNewExpAmount('');
      setShowExpenseForm(false);
      showToast('Shipment expense recorded', 'success');
      await refreshSelectedShipment(selectedShipment.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to record shipment expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (shipmentId: string, tab: DetailTab = 'overview') => {
    setSelectedId(shipmentId);
    setActiveTab(tab);
    setShowRevisionNote(false);
    setEditingManifest(false);
    setView('detail');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('shipmentId', shipmentId);
      window.history.pushState({ shipmentId }, '', url.toString());
    }
    try {
      await refreshSelectedShipment(shipmentId);
    } catch {
      // List data remains visible if detail refresh fails
    }
  };

  const handleCreateShipment = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !newRef.trim()) return;
    setSubmitting(true);
    try {
      const created = (await shipmentsApi.create({
        reference: newRef.trim(),
        providerName: newProvider.trim() || 'Atlantic Freight & Logistics',
        ...(newArrival ? { estimatedArrival: new Date(newArrival).toISOString() } : {}),
        ...(newTrackingRef.trim() ? { notes: `Tracking: ${newTrackingRef.trim()}` } : {}),
      })) as { id: string };
      const validItems = draftManifest
        .filter((item) => item.product.trim())
        .map((item) => ({
          ...(item.variantId ? { variantId: item.variantId } : {}),
          productName:
            !item.variantId && item.variant.trim()
              ? `${item.product.trim()} (${item.variant.trim()})`
              : item.product.trim(),
          quantity: Math.max(1, Number(item.qty) || 1),
          unitCostCents: 0,
        }));
      if (validItems.length > 0) {
        await shipmentsApi.addManifest(created.id, { items: validItems });
      }
      showToast(`Shipment ${newRef.trim()} created`, 'success');
      await loadShipments(true);
      setSelectedId(created.id);
      setActiveTab('overview');
      setView('detail');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create shipment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'create') {
    return (
      <CreateShipmentView
        submitting={submitting}
        newRef={newRef}
        setNewRef={setNewRef}
        newProvider={newProvider}
        setNewProvider={setNewProvider}
        providerOptions={providerOptions}
        newTrackingRef={newTrackingRef}
        setNewTrackingRef={setNewTrackingRef}
        newDeparture={newDeparture}
        setNewDeparture={setNewDeparture}
        newArrival={newArrival}
        setNewArrival={setNewArrival}
        newConfidence={newConfidence}
        setNewConfidence={setNewConfidence}
        draftManifest={draftManifest}
        setDraftManifest={setDraftManifest}
        variantOptions={variantOptions}
        onAddRow={() =>
          setDraftManifest((prev) => [...prev, { id: `dm-${Date.now()}`, product: '', variant: '', qty: 1 }])
        }
        onRemoveRow={(rowId) =>
          setDraftManifest((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev))
        }
        onBack={() => {
          setView('list');
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('shipmentId');
            window.history.pushState({}, '', url.toString());
          }
        }}
        onSubmit={handleCreateShipment}
      />
    );
  }

  if (view === 'detail' && selectedShipment) {
    return (
      <ShipmentDetailView
        selectedShipment={selectedShipment}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        submitting={submitting}
        statusUpdating={statusUpdating}
        showRevisionNote={showRevisionNote}
        setShowRevisionNote={setShowRevisionNote}
        editingManifest={editingManifest}
        setEditingManifest={setEditingManifest}
        manifestDraftRows={manifestDraftRows}
        setManifestDraftRows={setManifestDraftRows}
        manifestRevisionNote={manifestRevisionNote}
        setManifestRevisionNote={setManifestRevisionNote}
        savingManifest={savingManifest}
        variantOptions={variantOptions}
        showTrackingForm={showTrackingForm}
        setShowTrackingForm={setShowTrackingForm}
        newMilestone={newMilestone}
        setNewMilestone={setNewMilestone}
        showExpenseForm={showExpenseForm}
        setShowExpenseForm={setShowExpenseForm}
        newExpCategory={newExpCategory}
        setNewExpCategory={setNewExpCategory}
        newExpSupplier={newExpSupplier}
        setNewExpSupplier={setNewExpSupplier}
        newExpAmount={newExpAmount}
        setNewExpAmount={setNewExpAmount}
        confirmCloseOpen={confirmCloseOpen}
        setConfirmCloseOpen={setConfirmCloseOpen}
        onBack={() => {
          setView('list');
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('shipmentId');
            window.history.pushState({}, '', url.toString());
          }
        }}
        onAdvanceStatus={handleAdvanceStatus}
        onCompleteShipment={handleCompleteShipment}
        onOpenManifestEditor={openManifestEditor}
        onSaveManifestRevision={handleSaveManifestRevision}
        onAddTrackingMilestone={handleAddTrackingMilestone}
        onUpdateDisposition={handleUpdateDisposition}
        onAddShipmentExpense={handleAddShipmentExpense}
      />
    );
  }

  return (
    <div data-node-id="2:12656">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Shipments
          </h1>
          <p className="dash-sub">
            Track imported goods from manifest to reconciliation.
          </p>
        </div>
        <button type="button" className="button primary" onClick={() => setView('create')}>
          <Plus size={15} />
          <span>Create shipment</span>
        </button>
      </div>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shipment reference or provider…"
            aria-label="Search shipment reference or provider"
          />
        </label>

        <StaffFilterDropdown
          label="Status"
          value={statusFilter}
          options={[
            'All',
            'Open',
            'Closed',
            'Planned',
            'In transit',
            'Arrived',
            'Receiving',
            'Reconciliation pending',
            'Reconciled',
          ]}
          onChange={setStatusFilter}
        />

        <button
          type="button"
          className="button"
          style={{ background: '#fff' }}
          onClick={() =>
            downloadCsv(
              'shipments.csv',
              ['Shipment', 'Provider', 'Status', 'Expected Arrival', 'Manifest', 'Receiving', 'Expenses'],
              visibleShipments.map((s) => [
                s.reference,
                s.providerShort,
                s.status,
                s.expectedArrivalShort,
                `${s.manifestCount} ${s.manifestCount === 1 ? 'item' : 'items'}`,
                `${s.receivedCount} / ${s.manifestCount}`,
                s.expensesTotal,
              ]),
            )
          }
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      <section className="acct-panel" style={{ padding: 0 }} data-node-id="2:12731">
        <div className="staff-table-head staff-ship-cols">
          <span>SHIPMENT</span>
          <span>PROVIDER</span>
          <span>STATUS</span>
          <span>EXPECTED ARRIVAL</span>
          <span>MANIFEST</span>
          <span>RECEIVING</span>
          <span>EXPENSES</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadShipments} />
        ) : visibleShipments.length === 0 ? (
          <EmptyState
            title="No shipments found"
            description="Create a new shipment or clear your search/status filter."
            action={
              search || statusFilter !== 'All' ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('All');
                  }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          visibleShipments.map((s) => {
            const pct = Math.min(100, Math.round((s.receivedCount / Math.max(1, s.manifestCount)) * 100));
            return (
              <button
                key={s.id}
                type="button"
                className="staff-table-row staff-ship-cols"
                onClick={() => openDetail(s.id, 'overview')}
              >
                <div>
                  <strong>{s.reference}</strong>
                  <small>{s.routeShort}</small>
                </div>
                <span className="staff-cell-text">{s.providerShort}</span>
                <div>
                  <span className={`acct-pill ${statusTone(s.status)}`}>● {s.status}</span>
                </div>
                <span className="staff-cell-text">{s.expectedArrivalShort}</span>
                <span className="staff-cell-text">
                  {s.manifestCount} {s.manifestCount === 1 ? 'item' : 'items'}
                </span>
                <div className="ship-progress-cell">
                  <div className="ship-progress-track">
                    <div className="ship-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="staff-cell-text">
                    {s.receivedCount} / {s.manifestCount}
                  </span>
                </div>
                <span className="staff-cell-text">{s.expensesTotal}</span>
                <ChevronRight size={15} color="var(--green)" />
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}
