'use client';

import { ProductRecordModal } from '@/components/staff/products/ProductModals';
import { StaffFilterDropdown } from '@/components/staff/StaffFilterDropdown';
import { ConfirmDialog, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { catalogueApi, shipmentsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import {
  ChevronRight,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';

type PreparationStatus = 'Complete' | 'In progress';
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
};

function StaffProductsContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');

  useEffect(() => {
    const query = searchParams.get('search');
    if (query !== null) setSearch(query);
  }, [searchParams]);
  const [pubFilter, setPubFilter] = useState<'All' | PublicationStatus>('All');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(
    null,
  );
  const [confirmPublicationToggle, setConfirmPublicationToggle] = useState(false);
  const [togglingPublication, setTogglingPublication] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Living room');
  const [shipment, setShipment] = useState('');
  const [shipmentOptions, setShipmentOptions] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [defectDisclosure, setDefectDisclosure] = useState('');
  const [imageName, setImageName] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const rows = (await catalogueApi.listAdmin()) as Array<{
        id: string;
        sku?: string;
        name: string;
        category?: string;
        description?: string;
        brand?: string;
        model?: string;
        published?: boolean;
        images?: string[];
        defectDisclosure?: string;
        onboarding?: {
          inspected?: boolean;
          cleaned?: boolean;
          photographed?: boolean;
          wrapped?: boolean;
        };
        variants?: Array<{
          sku?: string;
          stockLots?: Array<{ available?: number }>;
        }>;
      }>;
      const mapped: ProductRecord[] = (Array.isArray(rows) ? rows : []).map((r) => {
        const availableCount = (r.variants ?? []).reduce(
          (sum, v) =>
            sum + (v.stockLots ?? []).reduce((ls, lot) => ls + (lot.available ?? 0), 0),
          0,
        );
        const ob = r.onboarding;
        const prepDone = Boolean(ob?.inspected && ob?.cleaned && ob?.photographed && ob?.wrapped);
        return {
          id: r.id,
          identifier: r.variants?.[0]?.sku || r.sku || r.id.slice(-6).toUpperCase(),
          name: r.name,
          category: r.category || 'Uncategorized',
          shipment: 'Warehouse',
          preparation: prepDone ? 'Complete' : 'In progress',
          availableCount,
          publication: r.published ? 'Published' : 'Draft',
          image: Array.isArray(r.images) && r.images[0] ? String(r.images[0]) : '/images/sofa.avif',
          description: r.description ?? '',
          defectDisclosure: r.defectDisclosure ?? undefined,
          brand: r.brand ?? '',
          model: r.model ?? '',
        };
      });
      setProducts(mapped);
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

  const visible = products.filter((p) => {
    const matchesPub = pubFilter === 'All' || p.publication === pubFilter;
    if (!matchesPub) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.identifier.toLowerCase().includes(q) ||
      p.shipment.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setName('');
    setCategory('Living room');
    setShipment('AH-SHP-2026-001');
    setDescription('');
    setBrand('');
    setModel('');
    setDefectDisclosure('');
    setImageName('');
    setImagePreview('');
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
    setImageName('');
    setImagePreview(p.image);
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
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id ? { ...p, publication: nextPub } : p,
        ),
      );
      setConfirmPublicationToggle(false);
      setModalMode(null);
      showToast(
        nextPub === 'Published'
          ? `${editingProduct.name} republished to storefront`
          : `${editingProduct.name} unpublished (kept as draft)`,
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
        await catalogueApi.createProduct({
          name: name.trim(),
          category: category.toLowerCase().replace(/\s+/g, '-'),
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
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
          defectDisclosure: defectDisclosure.trim() || undefined,
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

        <button type="button" className="button primary" onClick={openCreate}>
          <Plus size={15} />
          <span>Create product draft</span>
        </button>
      </div>

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

        <StaffFilterDropdown
          label="Publication"
          value={pubFilter}
          options={['All', 'Published', 'Draft']}
          onChange={setPubFilter}
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

      <section className="acct-panel" style={{ padding: 0 }}>
        <div className="staff-table-head staff-prod-cols">
          <span>PRODUCT</span>
          <span>IDENTIFIER</span>
          <span>SHIPMENT</span>
          <span>PREPARATION</span>
          <span>AVAILABILITY</span>
          <span>PUBLICATION</span>
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
            description="No products match your search or publication filter."
            action={
              search || pubFilter !== 'All' ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setSearch('');
                    setPubFilter('All');
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
                  <small>{p.category}</small>
                </div>
              </div>
              <span className="staff-cell-text">{p.identifier}</span>
              <span className="staff-cell-text">{p.shipment}</span>
              <div>
                <span
                  className={`acct-pill ${
                    p.preparation === 'Complete' ? 'green' : 'amber'
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
        name={name}
        category={category}
        shipment={shipment}
        shipmentOptions={shipmentOptions}
        description={description}
        brand={brand}
        model={model}
        defectDisclosure={defectDisclosure}
        imageName={imageName}
        imagePreview={imagePreview}
        togglingPublication={togglingPublication}
        onNameChange={setName}
        onCategoryChange={setCategory}
        onShipmentChange={setShipment}
        onDescriptionChange={setDescription}
        onBrandChange={setBrand}
        onModelChange={setModel}
        onDefectDisclosureChange={setDefectDisclosure}
        onImageChange={(nextName, nextPreview) => {
          setImageName(nextName);
          setImagePreview(nextPreview);
        }}
        onRequestTogglePublication={() => setConfirmPublicationToggle(true)}
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
