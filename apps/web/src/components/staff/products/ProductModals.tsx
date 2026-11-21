'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { ArrowRight, ImagePlus } from 'lucide-react';
import type { FormEvent } from 'react';

interface ProductRecordModalProps {
  modalMode: 'create' | 'edit' | null;
  editingIdentifier?: string;
  editingPublication?: 'Published' | 'Draft';
  editingPreparation?: 'Complete' | 'In progress';
  editingAvailableCount?: number;
  name: string;
  category: string;
  shipment: string;
  shipmentOptions: string[];
  description: string;
  brand: string;
  model: string;
  defectDisclosure: string;
  imageName: string;
  imagePreview: string;
  togglingPublication: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onShipmentChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDefectDisclosureChange: (value: string) => void;
  onImageChange: (name: string, previewUrl: string) => void;
  onRequestTogglePublication: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function ProductRecordModal({
  modalMode,
  editingIdentifier,
  editingPublication,
  editingPreparation,
  editingAvailableCount = 0,
  name,
  category,
  shipment,
  shipmentOptions,
  description,
  brand,
  model,
  defectDisclosure,
  imageName,
  imagePreview,
  togglingPublication,
  onNameChange,
  onCategoryChange,
  onShipmentChange,
  onDescriptionChange,
  onBrandChange,
  onModelChange,
  onDefectDisclosureChange,
  onImageChange,
  onRequestTogglePublication,
  onSubmit,
  onClose,
}: ProductRecordModalProps) {
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
          <span className="acct-pill amber">● Action required</span>
        )}
      </div>

      <h2 style={{ marginTop: 0 }}>
        {modalMode === 'create' ? 'Create product draft' : 'Product record'}
      </h2>
      <p className="login-sub">
        Draft records remain private until preparation and publication approval
        are complete.
      </p>

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

          <label className="login-field">
            <span>Shipment association</span>
            <select
              className="staff-field-select"
              value={shipment}
              onChange={(e) => onShipmentChange(e.target.value)}
            >
              <option value="">Warehouse / Direct</option>
              {shipmentOptions.map((ref) => (
                <option key={ref} value={ref}>
                  {ref}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <label className="prod-upload-box" style={{ width: '100%' }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImageChange(file.name, URL.createObjectURL(file));
              }
            }}
          />
          {imagePreview ? (
            <img
              src={imagePreview}
              alt={imageName || 'Selected product image'}
              className="prod-upload-preview"
            />
          ) : (
            <ImagePlus size={20} color="var(--green)" />
          )}
          <strong>
            {imageName
              ? `Selected: ${imageName}`
              : imagePreview
                ? 'Replace product image'
                : 'Add product images'}
          </strong>
          <span>Images can be completed during preparation</span>
        </label>

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
              (editingPublication === 'Published' ||
                (editingPreparation === 'Complete' && editingAvailableCount > 0))
                ? 'space-between'
                : 'flex-end',
            gap: 10,
            marginTop: 18,
          }}
        >
          {modalMode === 'edit' &&
            (editingPublication === 'Published' ||
              (editingPreparation === 'Complete' && editingAvailableCount > 0)) && (
              <Button
                type="button"
                variant="secondary"
                disabled={togglingPublication}
                onClick={onRequestTogglePublication}
              >
                {editingPublication === 'Published' ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          <Button type="submit" variant="primary">
            <span>{modalMode === 'create' ? 'Create record' : 'Save changes'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
