'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { ArrowRight, RotateCcw, Wrench } from 'lucide-react';
import type { FormEvent } from 'react';

export type PreparationStatusLabel = 'Not Started' | 'In Progress' | 'Prepared';

interface ProductRecordModalProps {
  modalMode: 'create' | 'edit' | null;
  editingIdentifier?: string;
  editingPublication?: 'Published' | 'Draft';
  editingPreparation?: PreparationStatusLabel;
  editingAvailableCount?: number;
  name: string;
  category: string;
  shipment: string;
  shipmentOptions: string[];
  initialQuantity?: string;
  description: string;
  brand: string;
  model: string;
  defectDisclosure: string;
  saving?: boolean;
  togglingPublication: boolean;
  restartingPreparation?: boolean;
  editingPreparationLoading?: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onShipmentChange: (value: string) => void;
  onInitialQuantityChange?: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDefectDisclosureChange: (value: string) => void;
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
  name,
  category,
  shipment,
  shipmentOptions,
  initialQuantity = '1',
  description,
  brand,
  model,
  defectDisclosure,
  saving = false,
  togglingPublication,
  restartingPreparation = false,
  editingPreparationLoading = false,
  onNameChange,
  onCategoryChange,
  onShipmentChange,
  onInitialQuantityChange,
  onDescriptionChange,
  onBrandChange,
  onModelChange,
  onDefectDisclosureChange,
  onRequestTogglePublication,
  onOpenPreparation,
  onEditPreparation,
  onRestartPreparation,
  onSubmit,
  onClose,
}: ProductRecordModalProps) {
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

          <label className="login-field">
            <span>Category</span>
            <select
              className="staff-field-select"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="Living room">Living room</option>
              <option value="Office">Office</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Outdoors">Outdoors</option>
              <option value="Dining">Dining</option>
              <option value="Electronics">Electronics</option>
            </select>
          </label>
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
