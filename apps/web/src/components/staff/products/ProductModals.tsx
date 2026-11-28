'use client';

import { CollectionCombobox } from '@/components/staff/CollectionCombobox';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { ArrowRight, Plus, RotateCcw, Tag, Wrench } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export type PreparationStatusLabel = 'Not Started' | 'In Progress' | 'Prepared';

export type ProductVariantSummary = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  available: number;
  attributes: Array<{ name: string; value: string }>;
};

export type NewVariantPayload = {
  attributes: Record<string, string>;
  initialQuantity: number;
  priceCents?: number;
};

interface ProductRecordModalProps {
  modalMode: 'create' | 'edit' | null;
  editingIdentifier?: string;
  editingPublication?: 'Published' | 'Draft';
  editingPreparation?: PreparationStatusLabel;
  editingAvailableCount?: number;
  editingVariants?: ProductVariantSummary[];
  name: string;
  category: string;
  collectionOptions?: string[];
  shipment: string;
  shipmentOptions: string[];
  initialQuantity?: string;
  initialSize?: string;
  initialColor?: string;
  initialSpec?: string;
  description: string;
  brand: string;
  model: string;
  defectDisclosure: string;
  saving?: boolean;
  addingVariant?: boolean;
  togglingPublication: boolean;
  restartingPreparation?: boolean;
  editingPreparationLoading?: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onShipmentChange: (value: string) => void;
  onInitialQuantityChange?: (value: string) => void;
  onInitialSizeChange?: (value: string) => void;
  onInitialColorChange?: (value: string) => void;
  onInitialSpecChange?: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDefectDisclosureChange: (value: string) => void;
  onAddVariant?: (payload: NewVariantPayload) => Promise<boolean>;
  onRequestTogglePublication: () => void;
  onOpenPreparation?: () => void;
  onEditPreparation?: () => void;
  onRestartPreparation?: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function ProductRecordModal({
  modalMode,
  editingIdentifier,
  editingPublication,
  editingPreparation = 'Not Started',
  editingVariants = [],
  name,
  category,
  collectionOptions = ['Living room', 'Office', 'Kitchen', 'Outdoors', 'Dining', 'Electronics'],
  shipment,
  shipmentOptions,
  initialQuantity = '1',
  initialSize = '',
  initialColor = '',
  initialSpec = '',
  description,
  brand,
  model,
  defectDisclosure,
  saving = false,
  addingVariant = false,
  togglingPublication,
  restartingPreparation = false,
  editingPreparationLoading = false,
  onNameChange,
  onCategoryChange,
  onShipmentChange,
  onInitialQuantityChange,
  onInitialSizeChange,
  onInitialColorChange,
  onInitialSpecChange,
  onDescriptionChange,
  onBrandChange,
  onModelChange,
  onDefectDisclosureChange,
  onAddVariant,
  onRequestTogglePublication,
  onOpenPreparation,
  onEditPreparation,
  onRestartPreparation,
  onSubmit,
  onClose,
}: ProductRecordModalProps) {
  const [showAddVariantForm, setShowAddVariantForm] = useState(false);
  const [newVarSize, setNewVarSize] = useState('');
  const [newVarColor, setNewVarColor] = useState('');
  const [newVarSpec, setNewVarSpec] = useState('');
  const [newVarCustomKey, setNewVarCustomKey] = useState('');
  const [newVarCustomVal, setNewVarCustomVal] = useState('');
  const [newVarQty, setNewVarQty] = useState('1');
  const [newVarPriceGhs, setNewVarPriceGhs] = useState('');

  const initialAttrPreview = [initialSize.trim(), initialColor.trim(), initialSpec.trim()]
    .filter(Boolean)
    .join(' / ');

  const newVariantPreview = [
    newVarSize.trim(),
    newVarColor.trim(),
    newVarSpec.trim(),
    newVarCustomKey.trim() && newVarCustomVal.trim() ? newVarCustomVal.trim() : '',
  ]
    .filter(Boolean)
    .join(' / ');

  const handleCreateVariantClick = async () => {
    if (!onAddVariant || addingVariant) return;
    const attrs: Record<string, string> = {};
    if (newVarSize.trim()) attrs.Size = newVarSize.trim();
    if (newVarColor.trim()) attrs.Color = newVarColor.trim();
    if (newVarSpec.trim()) attrs.Material = newVarSpec.trim();
    if (newVarCustomKey.trim() && newVarCustomVal.trim()) {
      attrs[newVarCustomKey.trim()] = newVarCustomVal.trim();
    }
    const priceNum = Number(newVarPriceGhs);
    const ok = await onAddVariant({
      attributes: attrs,
      initialQuantity: Math.max(0, Number(newVarQty) || 0),
      priceCents: Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) : undefined,
    });
    if (ok) {
      setNewVarSize('');
      setNewVarColor('');
      setNewVarSpec('');
      setNewVarCustomKey('');
      setNewVarCustomVal('');
      setNewVarQty('1');
      setNewVarPriceGhs('');
      setShowAddVariantForm(false);
    }
  };

  const prepTone =
    editingPreparation === 'Prepared'
      ? 'green'
      : editingPreparation === 'In Progress'
        ? 'amber'
        : 'gray';
  return (
    <StaffModal
      open={Boolean(modalMode)}
      label={modalMode === 'create' ? 'Create product draft' : 'Product record'}
      onClose={onClose}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          paddingRight: 28,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--green)',
            textTransform: 'uppercase',
          }}
        >
          {modalMode === 'create' ? 'NEW RECORD' : editingIdentifier ?? 'RECORD'}
        </span>
        {modalMode === 'edit' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`acct-pill ${prepTone}`}>● {editingPreparation}</span>
            <span
              className={`acct-pill ${
                editingPublication === 'Published' ? 'green' : 'gray'
              }`}
            >
              ● {editingPublication ?? 'Draft'}
            </span>
          </div>
        )}
      </div>

      <h2 style={{ marginTop: 0 }}>
        {modalMode === 'create' ? 'Create product draft' : 'Product record'}
      </h2>
      <p className="login-sub">
        Draft records remain private until preparation is complete, after which they are
        automatically published.
      </p>

      {modalMode === 'edit' && (
        <div
          style={{
            padding: '12px 14px',
            marginBottom: 14,
            background: '#f7f9f8',
            border: '0.8px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)' }}>
              Preparation status: {editingPreparation}
            </strong>
            <small style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {editingPreparation === 'Prepared'
                ? 'All preparation steps are completed. You can edit or restart preparation if updates are needed.'
                : 'Complete all preparation steps in the Preparation workspace to publish this product.'}
            </small>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {editingPreparation === 'Prepared' ? (
              <>
                {onEditPreparation && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={editingPreparationLoading}
                    loadingText="Opening…"
                    disabled={restartingPreparation || saving}
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12, background: '#fff' }}
                    onClick={onEditPreparation}
                  >
                    <Wrench size={13} />
                    <span>Edit preparation</span>
                  </Button>
                )}
                {onRestartPreparation && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={restartingPreparation}
                    loadingText="Restarting…"
                    disabled={editingPreparationLoading || saving}
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12, background: '#fff' }}
                    onClick={onRestartPreparation}
                  >
                    <RotateCcw size={13} />
                    <span>Restart preparation</span>
                  </Button>
                )}
              </>
            ) : (
              <>
                {editingPreparation === 'In Progress' && onRestartPreparation && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={restartingPreparation}
                    loadingText="Restarting…"
                    disabled={saving}
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12, background: '#fff' }}
                    onClick={onRestartPreparation}
                  >
                    <RotateCcw size={13} />
                    <span>Restart preparation</span>
                  </Button>
                )}
                {onOpenPreparation && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={restartingPreparation || saving}
                    style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
                    onClick={onOpenPreparation}
                  >
                    <span>
                      {editingPreparation === 'Not Started'
                        ? 'Start preparation'
                        : 'Continue preparation'}
                    </span>
                    <ArrowRight size={13} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="req-row-2">
          <label className="login-field">
            <span>Product name</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Product name"
              required
            />
          </label>

          <div className="login-field">
            <span>Collection / Category</span>
            <CollectionCombobox
              value={category}
              options={collectionOptions}
              placeholder="Select or type collection…"
              onChange={onCategoryChange}
            />
          </div>
        </div>

        <div className="req-row-2">
          <label className="login-field">
            <span>Product identifier</span>
            <input
              value={
                modalMode === 'create'
                  ? 'Generated on save'
                  : editingIdentifier ?? ''
              }
              readOnly
              style={{ background: '#f7f8f7', color: 'var(--ink)' }}
            />
          </label>

          <div className="login-field">
            <span>Shipment association</span>
            <SearchableSelect
              ariaLabel="Shipment association"
              options={[
                { value: '', label: 'Warehouse / Direct', searchText: 'Warehouse Direct' },
                ...shipmentOptions.map((ref) => ({
                  value: ref,
                  label: ref,
                  searchText: ref,
                })),
              ]}
              value={shipment}
              onChange={onShipmentChange}
              placeholder="Warehouse / Direct"
              searchPlaceholder="Type shipment reference…"
            />
          </div>
        </div>

        {modalMode === 'create' && onInitialQuantityChange && (
          <>
            <label className="login-field">
              <span>Received quantity (entering preparation)</span>
              <input
                type="number"
                min={1}
                value={initialQuantity}
                onChange={(e) => onInitialQuantityChange(e.target.value)}
                placeholder="1"
                required
              />
            </label>

            <div
              style={{
                padding: '10px 12px',
                marginBottom: 12,
                background: '#f7f9f8',
                border: '0.8px solid var(--line)',
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--green)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Tag size={12} /> Initial variant attributes (optional)
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  Label:{' '}
                  <strong style={{ color: 'var(--ink)' }}>
                    {initialAttrPreview || 'Standard'}
                  </strong>
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                <label className="login-field" style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: 11 }}>Size</span>
                  <input
                    value={initialSize}
                    onChange={(e) => onInitialSizeChange?.(e.target.value)}
                    placeholder="e.g. Small"
                  />
                </label>
                <label className="login-field" style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: 11 }}>Color</span>
                  <input
                    value={initialColor}
                    onChange={(e) => onInitialColorChange?.(e.target.value)}
                    placeholder="e.g. Red"
                  />
                </label>
                <label className="login-field" style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: 11 }}>Material / Spec</span>
                  <input
                    value={initialSpec}
                    onChange={(e) => onInitialSpecChange?.(e.target.value)}
                    placeholder="e.g. Velvet"
                  />
                </label>
              </div>
            </div>
          </>
        )}

        <label className="login-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Product description and useful customer details…"
            style={{
              width: '100%',
              border: '0.8px solid var(--line)',
              borderRadius: 3,
              padding: 12,
              fontSize: 13,
              resize: 'vertical',
            }}
          />
        </label>

        <div className="req-row-2">
          <label className="login-field">
            <span>Brand</span>
            <input
              value={brand}
              onChange={(e) => onBrandChange(e.target.value)}
              placeholder="Optional brand"
            />
          </label>

          <label className="login-field">
            <span>Model</span>
            <input
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="Optional model"
            />
          </label>
        </div>

        <label className="login-field">
          <span>Defect disclosure</span>
          <input
            value={defectDisclosure}
            onChange={(e) => onDefectDisclosureChange(e.target.value)}
            placeholder="Optional disclosed condition notes shown to buyers"
          />
        </label>

        {modalMode === 'edit' && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              background: '#f7f9f8',
              border: '0.8px solid var(--line)',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: 12,
                    color: 'var(--ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Tag size={13} color="var(--green)" />
                  Variants &amp; attributes ({editingVariants.length})
                </strong>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  Express multi-dimensional options such as Size: Small + Color: Red.
                </div>
              </div>
              {onAddVariant && (
                <Button
                  type="button"
                  variant="secondary"
                  style={{ minHeight: 30, padding: '0 10px', fontSize: 12, background: '#fff' }}
                  onClick={() => setShowAddVariantForm((prev) => !prev)}
                >
                  <Plus size={13} />
                  <span>{showAddVariantForm ? 'Cancel' : 'Add variant'}</span>
                </Button>
              )}
            </div>

            {editingVariants.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showAddVariantForm ? 12 : 0 }}>
                {editingVariants.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      background: '#fff',
                      border: '0.8px solid var(--line)',
                      borderRadius: 3,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{v.name}</strong>
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--muted)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {v.sku}
                        </span>
                      </div>
                      {v.attributes.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {v.attributes.map((a, idx) => (
                            <span
                              key={`${v.id}-${a.name}-${idx}`}
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 99,
                                background: '#eef5f1',
                                color: 'var(--green)',
                                border: '0.8px solid rgba(11, 93, 59, 0.18)',
                              }}
                            >
                              {a.name}: {a.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12 }}>
                      <strong style={{ display: 'block', color: 'var(--ink)' }}>
                        {v.priceCents > 0
                          ? `GHS ${(v.priceCents / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
                          : 'Price pending'}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {v.available} available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddVariantForm && onAddVariant && (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#fff',
                  border: '1px solid rgba(11, 93, 59, 0.25)',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 12, color: 'var(--green)' }}>
                    New multi-attribute variant
                  </strong>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Preview:{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      {newVariantPreview || 'Enter at least one attribute'}
                    </strong>
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Size</span>
                    <input
                      value={newVarSize}
                      onChange={(e) => setNewVarSize(e.target.value)}
                      placeholder="e.g. Small"
                    />
                  </label>
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Color</span>
                    <input
                      value={newVarColor}
                      onChange={(e) => setNewVarColor(e.target.value)}
                      placeholder="e.g. Red"
                    />
                  </label>
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Material / Spec</span>
                    <input
                      value={newVarSpec}
                      onChange={(e) => setNewVarSpec(e.target.value)}
                      placeholder="e.g. Cotton"
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 90px 120px',
                    gap: 8,
                  }}
                >
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Custom attribute</span>
                    <input
                      value={newVarCustomKey}
                      onChange={(e) => setNewVarCustomKey(e.target.value)}
                      placeholder="e.g. Voltage"
                    />
                  </label>
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Custom value</span>
                    <input
                      value={newVarCustomVal}
                      onChange={(e) => setNewVarCustomVal(e.target.value)}
                      placeholder="e.g. 220V"
                    />
                  </label>
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Qty</span>
                    <input
                      type="number"
                      min={0}
                      value={newVarQty}
                      onChange={(e) => setNewVarQty(e.target.value)}
                    />
                  </label>
                  <label className="login-field" style={{ marginBottom: 0 }}>
                    <span style={{ fontSize: 11 }}>Price (GHS)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newVarPriceGhs}
                      onChange={(e) => setNewVarPriceGhs(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button
                    type="button"
                    variant="primary"
                    loading={addingVariant}
                    loadingText="Adding…"
                    disabled={!newVariantPreview || addingVariant}
                    style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
                    onClick={handleCreateVariantClick}
                  >
                    <Plus size={13} />
                    <span>Save variant</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent:
              modalMode === 'edit' &&
              (editingPublication === 'Published' || editingPreparation === 'Prepared')
                ? 'space-between'
                : 'flex-end',
            gap: 10,
            marginTop: 18,
          }}
        >
          {modalMode === 'edit' &&
            (editingPublication === 'Published' || editingPreparation === 'Prepared') && (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  togglingPublication ||
                  saving ||
                  restartingPreparation ||
                  editingPreparationLoading ||
                  (editingPublication !== 'Published' && editingPreparation !== 'Prepared')
                }
                onClick={onRequestTogglePublication}
              >
                {editingPublication === 'Published' ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingText={modalMode === 'create' ? 'Creating…' : 'Saving…'}
            disabled={!name.trim() || togglingPublication || restartingPreparation || editingPreparationLoading}
          >
            <span>{modalMode === 'create' ? 'Create record' : 'Save changes'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
