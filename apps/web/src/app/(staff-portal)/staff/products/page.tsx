'use client';

import {
  ProductRecordModal,
  type NewVariantPayload,
  type PreparationStatusLabel,
  type ProductVariantSummary,
} from '@/components/staff/products/ProductModals';
import { StaffModal } from '@/components/staff/StaffModal';
import {
  ActiveFilterChips,
  HierarchicalFilterDropdown,
  SortableHeader,
} from '@/components/staff/TableControls';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, shipmentsApi } from '@/lib/api';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type PreparationStatus = PreparationStatusLabel;
type PublicationStatus = 'Published' | 'Draft';

type ProductRecord = {
  id: string;
  identifier: string;
  name: string;
  category: string;
  shipment: string;
  preparation: PreparationStatus;
  availableCount: number;
  publication: PublicationStatus;
  image: string;
  description: string;
  defectDisclosure?: string;
  brand: string;
  model: string;
  variants: ProductVariantSummary[];
};

function StaffProductsContent() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');

  useEffect(() => {
    const query = searchParams.get('search');
    if (query !== null) setSearch(query);
  }, [searchParams]);
  const [filters, setFilters] = useState<FilterValueMap>({});
  const [sort, setSort] = useState<SortState>(null);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(
    null,
  );
  const [confirmPublicationToggle, setConfirmPublicationToggle] = useState(false);
  const [confirmRestartPrep, setConfirmRestartPrep] = useState(false);
  const [confirmRejectPrice, setConfirmRejectPrice] = useState<{
    id: string;
    prodName: string;
  } | null>(null);
  const [togglingPublication, setTogglingPublication] = useState(false);
  const [restartingPreparation, setRestartingPreparation] = useState(false);
  const [editingPreparationLoading, setEditingPreparationLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Living room');
  const [shipment, setShipment] = useState('');
  const [shipmentOptions, setShipmentOptions] = useState<string[]>([]);
  const [initialQuantity, setInitialQuantity] = useState('1');
  const [initialSize, setInitialSize] = useState('');
  const [initialColor, setInitialColor] = useState('');
  const [initialSpec, setInitialSpec] = useState('');
  const [addingVariant, setAddingVariant] = useState(false);
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [defectDisclosure, setDefectDisclosure] = useState('');
  const [pendingPriceApprovals, setPendingPriceApprovals] = useState<
    Array<{
      id: string;
      variantId: string;
      previousPriceCents?: number | null;
      proposedPriceCents: number;
      reason?: string | null;
      variant?: {
        sku?: string;
        product?: { id?: string; name?: string; isPublished?: boolean };
      } | null;
    }>
  >([]);
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const [pricingQueueModalOpen, setPricingQueueModalOpen] = useState(false);

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [rows, pendingList] = (await Promise.all([
        catalogueApi.listAdmin(),
        catalogueApi.listPriceApprovals('PENDING').catch(() => []),
      ])) as [
        Array<{
          id: string;
          sku?: string;
          name: string;
          category?: string;
          description?: string;
          brand?: string;
          model?: string;
          published?: boolean;
          isPublished?: boolean;
          images?: string[];
          media?: Array<{ url?: string }>;
          defectDisclosure?: string;
          shipmentId?: string | null;
          shipmentReference?: string;
          completedStageCount?: number;
          preparationStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PREPARED';
          preparationSteps?: Array<{ step?: string; status?: string }>;
          variants?: Array<{
            id?: string;
            sku?: string;
            name?: string;
            priceCents?: number;
            stockLots?: Array<{ available?: number }>;
            attributes?: Array<{
              value?: string;
              attribute?: { name?: string } | null;
            }>;
          }>;
        }>,
        Array<{
          id: string;
          variantId: string;
          previousPriceCents?: number | null;
          proposedPriceCents: number;
          reason?: string | null;
          variant?: {
            sku?: string;
            product?: { id?: string; name?: string; isPublished?: boolean };
          } | null;
        }>,
      ];
      setPendingPriceApprovals(Array.isArray(pendingList) ? pendingList : []);
      const mapped: ProductRecord[] = (Array.isArray(rows) ? rows : []).map((r) => {
        const isPub = Boolean(r.isPublished ?? r.published);
        const rawAvailableCount = (r.variants ?? []).reduce(
          (sum, v) =>
            sum + (v.stockLots ?? []).reduce((ls, lot) => ls + (lot.available ?? 0), 0),
          0,
        );
        const availableCount = isPub ? rawAvailableCount : 0;
        const doneSet = new Set(
          (r.preparationSteps ?? [])
            .filter((s) => s.status === 'COMPLETED')
            .map((s) => String(s.step)),
        );
        let stageCount = 0;
        if (doneSet.has('INSPECTION')) stageCount = 1;
        if (stageCount === 1 && doneSet.has('CLEANING')) stageCount = 2;
        if (stageCount === 2 && doneSet.has('PHOTOGRAPHY')) stageCount = 3;
        if (stageCount === 3 && doneSet.has('WRAPPING')) stageCount = 4;
        const hasPrice = (r.variants ?? []).some((v) => (v.priceCents ?? 0) > 0);
        if (stageCount === 4 && (doneSet.has('PRICING') || hasPrice)) stageCount = 5;
        if (
          stageCount === 5 &&
          (doneSet.has('FINAL_REVIEW') || Boolean(r.isPublished ?? r.published))
        ) {
          stageCount = 6;
        }
        const effectiveStageCount =
          typeof r.completedStageCount === 'number' ? r.completedStageCount : stageCount;

        let preparation: PreparationStatus = 'Not Started';
        if (effectiveStageCount >= 6) {
          preparation = 'Prepared';
        } else if (effectiveStageCount > 0 || doneSet.size > 0 || hasPrice) {
          preparation = 'In Progress';
        } else {
          preparation = 'Not Started';
        }
        const variants: ProductVariantSummary[] = (r.variants ?? []).map((v, idx) => ({
          id: v.id || `${r.id}-v-${idx}`,
          sku: v.sku || '—',
          name: v.name || 'Standard',
          priceCents: v.priceCents ?? 0,
          available: (v.stockLots ?? []).reduce((ls, lot) => ls + (lot.available ?? 0), 0),
          attributes: (v.attributes ?? [])
            .map((a) => ({
              name: String(a.attribute?.name ?? '').trim(),
              value: String(a.value ?? '').trim(),
            }))
            .filter((a) => a.name && a.value),
        }));
        return {
          id: r.id,
          identifier: r.variants?.[0]?.sku || r.sku || r.id.slice(-6).toUpperCase(),
          name: r.name,
          category: r.category || 'Uncategorized',
          shipment: r.shipmentReference || r.shipmentId || 'Warehouse',
          preparation,
          availableCount,
          publication: (r.isPublished ?? r.published) ? 'Published' : 'Draft',
          image:
            (Array.isArray(r.media) && r.media[0]?.url ? String(r.media[0].url) : '') ||
            (Array.isArray(r.images) && r.images[0] ? String(r.images[0]) : '') ||
            '/images/sofa.avif',
          description: r.description ?? '',
          defectDisclosure: r.defectDisclosure ?? undefined,
          brand: r.brand ?? '',
          model: r.model ?? '',
          variants,
        };
      });
      setProducts(mapped);
      setEditingProduct((prev) =>
        prev ? mapped.find((item) => item.id === prev.id) ?? prev : null,
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load product catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    shipmentsApi
      .list()
      .then((rows) => {
        const refs = (Array.isArray(rows) ? rows : [])
          .map((s) => String(s.reference || ''))
          .filter(Boolean);
        setShipmentOptions(refs);
        if (refs[0]) setShipment((prev) => prev || refs[0]);
      })
      .catch(() => {});
  }, [loadProducts]);

  useEffect(() => {
    if (!modalMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMode]);

  const filterDefs: FilterCategoryDef<ProductRecord>[] = useMemo(
    () => [
      { key: 'publication', label: 'Publication', accessor: (p) => p.publication },
      { key: 'category', label: 'Category', accessor: (p) => p.category },
      { key: 'preparation', label: 'Preparation', accessor: (p) => p.preparation },
      { key: 'shipment', label: 'Shipment', accessor: (p) => (p.shipment === '—' ? '' : p.shipment) },
    ],
    [],
  );

  const sortDefs: SortColumnDef<ProductRecord>[] = useMemo(
    () => [
      { key: 'name', type: 'string', accessor: (p) => p.name },
      { key: 'identifier', type: 'string', accessor: (p) => p.identifier },
      { key: 'shipment', type: 'string', accessor: (p) => p.shipment },
      {
        key: 'preparation',
        type: 'status',
        statusOrder: ['Not Started', 'In Progress', 'Prepared'],
        accessor: (p) => p.preparation,
      },
      { key: 'availableCount', type: 'number', accessor: (p) => p.availableCount },
      {
        key: 'publication',
        type: 'status',
        statusOrder: ['Draft', 'Published'],
        accessor: (p) => p.publication,
      },
    ],
    [],
  );

  const filterCategories = useMemo(() => deriveFilterCategories(products, filterDefs), [products, filterDefs]);

  const visible = useMemo(() => {
    const searched = products.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.identifier.toLowerCase().includes(q) ||
        p.shipment.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
    return applyFiltersAndSort(searched, filters, filterDefs, sort, sortDefs);
  }, [products, search, filters, filterDefs, sort, sortDefs]);

  const hasActiveFilters = Object.values(filters).some((vals) => vals && vals.length > 0);

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setName('');
    setCategory('Living room');
    setShipment(shipmentOptions[0] || 'AH-SHP-2026-001');
    setInitialQuantity('1');
    setInitialSize('');
    setInitialColor('');
    setInitialSpec('');
    setDescription('');
    setBrand('');
    setModel('');
    setDefectDisclosure('');
  };

  const openEdit = (p: ProductRecord) => {
    setModalMode('edit');
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setShipment(p.shipment);
    setDescription(p.description);
    setBrand(p.brand);
    setModel(p.model);
    setDefectDisclosure(p.defectDisclosure ?? '');
  };

  const handleOpenPreparation = () => {
    if (!editingProduct) return;
    setModalMode(null);
    router.push(`/staff/preparation?productId=${encodeURIComponent(editingProduct.id)}`);
  };

  const handleEditPreparation = async () => {
    if (!editingProduct || editingPreparationLoading) return;
    setEditingPreparationLoading(true);
    try {
      await catalogueApi.revertPreparation(editingProduct.id, { step: 'FINAL_REVIEW' });
      showToast('Preparation reopened for editing', 'success');
      setModalMode(null);
      router.push(`/staff/preparation?productId=${encodeURIComponent(editingProduct.id)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reopen preparation', 'error');
    } finally {
      setEditingPreparationLoading(false);
    }
  };

  const handleRestartPreparation = async () => {
    if (!editingProduct || restartingPreparation) return;
    setRestartingPreparation(true);
    try {
      await catalogueApi.revertPreparation(editingProduct.id, { resetAll: true });
      showToast('Preparation restarted — product returned to Preparation queue', 'success');
      await loadProducts(true);
      setEditingProduct((prev) =>
        prev ? { ...prev, preparation: 'Not Started', publication: 'Draft', availableCount: 0 } : null,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restart preparation', 'error');
    } finally {
      setRestartingPreparation(false);
    }
  };

  const handleTogglePublication = async () => {
    if (!editingProduct || togglingPublication) return;
    setTogglingPublication(true);
    const nextPub: PublicationStatus =
      editingProduct.publication === 'Published' ? 'Draft' : 'Published';
    try {
      if (nextPub === 'Published') {
        await catalogueApi.publishProduct(editingProduct.id);
      } else {
        await catalogueApi.unpublishProduct(editingProduct.id);
      }
      await loadProducts(true);
      setConfirmPublicationToggle(false);
      setModalMode(null);
      showToast(
        nextPub === 'Published'
          ? `${editingProduct.name} republished to storefront and marked saleable`
          : `${editingProduct.name} unpublished (stock withheld from storefront sale)`,
        'success',
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to update publication status. Check onboarding and pricing approval.',
      );
    } finally {
      setTogglingPublication(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      if (modalMode === 'create') {
        const initialAttributes: Record<string, string> = {};
        if (initialSize.trim()) initialAttributes.Size = initialSize.trim();
        if (initialColor.trim()) initialAttributes.Color = initialColor.trim();
        if (initialSpec.trim()) initialAttributes.Material = initialSpec.trim();
        await catalogueApi.createProduct({
          name: name.trim(),
          category: category.toLowerCase().replace(/\s+/g, '-'),
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          shipmentId: shipment.trim() || undefined,
          initialQuantity: Math.max(1, Number(initialQuantity) || 1),
          initialAttributes: Object.keys(initialAttributes).length > 0 ? initialAttributes : undefined,
        });
        setModalMode(null);
        showToast('New product draft created', 'success');
        await loadProducts(true);
      } else if (modalMode === 'edit' && editingProduct) {
        await catalogueApi.updateProduct(editingProduct.id, {
          name: name.trim(),
          category: category.toLowerCase().replace(/\s+/g, '-'),
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          shipmentId: shipment.trim() || undefined,
          defectDisclosures: defectDisclosure.trim() || undefined,
        });
        setModalMode(null);
        showToast('Product record updated', 'success');
        await loadProducts(true);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (payload: NewVariantPayload): Promise<boolean> => {
    if (!editingProduct || addingVariant) return false;
    setAddingVariant(true);
    try {
      await catalogueApi.createVariant(editingProduct.id, {
        attributes: payload.attributes,
        initialQuantity: payload.initialQuantity,
        priceCents: payload.priceCents,
      });
      showToast('Variant added to product', 'success');
      await loadProducts(true);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add variant', 'error');
      return false;
    } finally {
      setAddingVariant(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Product',
      'Category',
      'Identifier',
      'Shipment',
      'Preparation',
      'Availability',
      'Publication',
    ];
    const rows = visible.map((p) => [
      p.name,
      p.category,
      p.identifier,
      p.shipment,
      p.preparation,
      `${p.availableCount} available`,
      p.publication,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-catalogue.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-node-id="26:65238">
      <div className="dash-head">
        <div>
          <h1 className="dash-title" style={{ marginTop: 0 }}>
            Product catalogue
          </h1>
          <p className="dash-sub">
            Manage draft, prepared and published product records.
          </p>
        </div>

        <div className="dash-actions">
          {pendingPriceApprovals.length > 0 && (
            <button
              type="button"
              className="button"
              style={{
                background: '#fffbeb',
                borderColor: '#f59e0b',
                color: '#92400e',
                fontWeight: 600,
              }}
              onClick={() => setPricingQueueModalOpen(true)}
            >
              <span>Pending price approvals</span>
              <span
                style={{
                  background: '#d97706',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                {pendingPriceApprovals.length}
              </span>
            </button>
          )}
          <button type="button" className="button primary" onClick={openCreate}>
            <Plus size={15} />
            <span>Create product draft</span>
          </button>
        </div>
      </div>

      <StaffModal
        open={pricingQueueModalOpen}
        label="Pending price approvals"
        onClose={() => setPricingQueueModalOpen(false)}
      >
        <span className="ship-eyebrow" style={{ color: 'var(--green)' }}>
          DUAL-CONTROL PRICING QUEUE ({pendingPriceApprovals.length} PENDING)
        </span>
        <h2 style={{ marginTop: 6 }}>Pending price approvals</h2>
        <p className="login-sub">
          Approve or reject proposed retail prices and floor-aging markdowns. Approving a price
          drop automatically notifies customers who saved the item in their Wishlist.
        </p>
        {pendingPriceApprovals.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            All price proposals have been reviewed.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            {pendingPriceApprovals.map((pa) => {
              const prodName = pa.variant?.product?.name || pa.variant?.sku || 'Product variant';
              const prevGhs = ((pa.previousPriceCents ?? 0) / 100).toLocaleString();
              const propGhs = (pa.proposedPriceCents / 100).toLocaleString();
              return (
                <div
                  key={pa.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#f9faf9',
                    border: '1px solid #dce8e0',
                    borderRadius: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12.5 }}>
                    <strong>{prodName}</strong> ·{' '}
                    <span style={{ color: 'var(--muted)' }}>
                      GHS {prevGhs} → <strong style={{ color: 'var(--green)' }}>GHS {propGhs}</strong>
                    </span>
                    {pa.reason && (
                      <small style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>
                        {pa.reason}
                      </small>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="button primary"
                      disabled={decidingApprovalId === pa.id}
                      style={{ minHeight: 28, padding: '0 10px', fontSize: 11.5 }}
                      onClick={async () => {
                        setDecidingApprovalId(pa.id);
                        try {
                          await catalogueApi.approvePrice(pa.id);
                          showToast(`Approved GHS ${propGhs} for ${prodName}`, 'success');
                          await loadProducts(true);
                        } catch (err) {
                          showToast(
                            err instanceof Error ? err.message : 'Unable to approve price',
                            'error',
                          );
                        } finally {
                          setDecidingApprovalId(null);
                        }
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={decidingApprovalId === pa.id}
                      style={{ minHeight: 28, padding: '0 10px', fontSize: 11.5 }}
                      onClick={() => setConfirmRejectPrice({ id: pa.id, prodName })}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StaffModal>

      <div className="staff-toolbar">
        <label className="staff-search-box">
          <Search size={16} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, IDs or shipments…"
            aria-label="Search products, IDs or shipments"
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
          onClick={handleExportCsv}
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
        <div className="staff-table-head staff-prod-cols">
          <SortableHeader label="PRODUCT" sortKey="name" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="IDENTIFIER" sortKey="identifier" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="SHIPMENT" sortKey="shipment" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="PREPARATION" sortKey="preparation" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="AVAILABILITY" sortKey="availableCount" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <SortableHeader label="PUBLICATION" sortKey="publication" sort={sort} onSort={(k) => setSort((s) => cycleSort(s, k))} />
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <TableSkeleton rows={5} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadProducts} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No products found"
            description="No products match your search or filters."
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
          visible.map((p) => (
            <button
              key={p.id}
              type="button"
              className="staff-table-row staff-prod-cols"
              onClick={() => openEdit(p)}
            >
              <div className="prod-cell-media">
                <img
                  src={p.image}
                  alt=""
                  className="prod-cell-thumb"
                />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.category}
                    {p.variants.length > 1
                      ? ` · ${p.variants.length} variants`
                      : p.variants[0] && p.variants[0].name !== 'Standard'
                        ? ` · ${p.variants[0].name}`
                        : ''}
                  </small>
                </div>
              </div>
              <span className="staff-cell-text">{p.identifier}</span>
              <span className="staff-cell-text">{p.shipment}</span>
              <div>
                <span
                  className={`acct-pill ${
                    p.preparation === 'Prepared'
                      ? 'green'
                      : p.preparation === 'In Progress'
                      ? 'amber'
                      : 'gray'
                  }`}
                >
                  ● {p.preparation}
                </span>
              </div>
              <span className="staff-cell-text">{p.availableCount} available</span>
              <div>
                <span
                  className={`acct-pill ${
                    p.publication === 'Published' ? 'green' : 'gray'
                  }`}
                >
                  ● {p.publication}
                </span>
              </div>
              <ChevronRight size={15} color="var(--green)" />
            </button>
          ))
        )}
      </section>

      <ProductRecordModal
        modalMode={modalMode}
        editingIdentifier={editingProduct?.identifier}
        editingPublication={editingProduct?.publication}
        editingPreparation={editingProduct?.preparation}
        editingAvailableCount={editingProduct?.availableCount}
        editingVariants={editingProduct?.variants ?? []}
        name={name}
        category={category}
        shipment={shipment}
        shipmentOptions={shipmentOptions}
        initialQuantity={initialQuantity}
        initialSize={initialSize}
        initialColor={initialColor}
        initialSpec={initialSpec}
        description={description}
        brand={brand}
        model={model}
        defectDisclosure={defectDisclosure}
        saving={saving}
        addingVariant={addingVariant}
        togglingPublication={togglingPublication}
        restartingPreparation={restartingPreparation}
        editingPreparationLoading={editingPreparationLoading}
        onNameChange={setName}
        onCategoryChange={setCategory}
        onShipmentChange={setShipment}
        onInitialQuantityChange={setInitialQuantity}
        onInitialSizeChange={setInitialSize}
        onInitialColorChange={setInitialColor}
        onInitialSpecChange={setInitialSpec}
        onDescriptionChange={setDescription}
        onBrandChange={setBrand}
        onModelChange={setModel}
        onDefectDisclosureChange={setDefectDisclosure}
        onAddVariant={handleAddVariant}
        onRequestTogglePublication={() => setConfirmPublicationToggle(true)}
        onOpenPreparation={handleOpenPreparation}
        onEditPreparation={handleEditPreparation}
        onRestartPreparation={() => setConfirmRestartPrep(true)}
        onSubmit={handleSubmit}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        open={confirmPublicationToggle && Boolean(editingProduct)}
        title={
          editingProduct?.publication === 'Published'
            ? 'Unpublish product?'
            : 'Republish product?'
        }
        targetName={editingProduct?.name}
        description={
          editingProduct?.publication === 'Published'
            ? 'This will remove the product from the customer storefront and keep it as a draft.'
            : 'This will make the product visible on the customer storefront.'
        }
        reversible={true}
        destructive={editingProduct?.publication === 'Published'}
        confirmLabel={
          editingProduct?.publication === 'Published'
            ? 'Unpublish product'
            : 'Republish product'
        }
        loading={togglingPublication}
        onCancel={() => setConfirmPublicationToggle(false)}
        onConfirm={handleTogglePublication}
      />

      <ConfirmDialog
        open={confirmRestartPrep && Boolean(editingProduct)}
        title="Restart preparation?"
        targetName={editingProduct?.name}
        description="This will clear all completed preparation steps, reset the price to GHS 0, unpublish the item from the storefront, and return it to the Preparation queue."
        reversible={false}
        destructive={true}
        confirmLabel="Restart preparation"
        loading={restartingPreparation}
        onCancel={() => setConfirmRestartPrep(false)}
        onConfirm={async () => {
          setConfirmRestartPrep(false);
          await handleRestartPreparation();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmRejectPrice)}
        title="Reject price proposal?"
        targetName={confirmRejectPrice?.prodName}
        description="This will reject the proposed retail price and restore the previous approved price."
        reversible={false}
        destructive={true}
        confirmLabel="Reject proposal"
        loading={Boolean(confirmRejectPrice && decidingApprovalId === confirmRejectPrice.id)}
        onCancel={() => setConfirmRejectPrice(null)}
        onConfirm={async () => {
          const target = confirmRejectPrice;
          if (!target) return;
          setDecidingApprovalId(target.id);
          try {
            await catalogueApi.rejectPrice(target.id, 'Rejected by manager');
            showToast(`Rejected price proposal for ${target.prodName}`, 'warning');
            setConfirmRejectPrice(null);
            await loadProducts(true);
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : 'Unable to reject price',
              'error',
            );
          } finally {
            setDecidingApprovalId(null);
          }
        }}
      />
    </div>
  );
}

export default function StaffProductsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <StaffProductsContent />
    </Suspense>
  );
}
