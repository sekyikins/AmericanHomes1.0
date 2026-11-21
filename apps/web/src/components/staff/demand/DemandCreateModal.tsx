'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import type { FormEvent } from 'react';
import type { DemandMode } from './demandConfig';

interface DemandCreateModalProps {
  open: boolean;
  mode: DemandMode;
  eyebrow: string;
  title: string;
  subtitle: string;
  submitting: boolean;
  shipments: Array<{ id: string; reference: string }>;
  variants: Array<{ id: string; label: string }>;
  requestOptions: Array<{ id: string; label: string }>;
  newProduct: string;
  newDesc: string;
  newQty: string;
  newShipmentId: string;
  newRequestId: string;
  newVariantId: string;
  onProductChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onQtyChange: (value: string) => void;
  onShipmentIdChange: (value: string) => void;
  onRequestIdChange: (value: string) => void;
  onVariantIdChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function DemandCreateModal({
  open,
  mode,
  eyebrow,
  title,
  subtitle,
  submitting,
  shipments,
  variants,
  requestOptions,
  newProduct,
  newDesc,
  newQty,
  newShipmentId,
  newRequestId,
  newVariantId,
  onProductChange,
  onDescChange,
  onQtyChange,
  onShipmentIdChange,
  onRequestIdChange,
  onVariantIdChange,
  onSubmit,
  onClose,
}: DemandCreateModalProps) {
  return (
    <StaffModal open={open} label={title} onClose={onClose}>
      <div className="ship-eyebrow">{eyebrow}</div>
      <h2 style={{ marginTop: 6 }}>{title}</h2>
      <p className="login-sub">{subtitle}</p>

      <form onSubmit={onSubmit}>
        {mode === 'sourcing' && (
          <label className="login-field">
            <span>Shipment</span>
            <select
              className="staff-field-select"
              value={newShipmentId}
              onChange={(e) => onShipmentIdChange(e.target.value)}
            >
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.reference}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === 'allocations' ? (
          <>
            <label className="login-field">
              <span>Product request</span>
              <select
                className="staff-field-select"
                value={newRequestId}
                onChange={(e) => onRequestIdChange(e.target.value)}
              >
                {requestOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="login-field">
              <span>Stock variant</span>
              <select
                className="staff-field-select"
                value={newVariantId}
                onChange={(e) => onVariantIdChange(e.target.value)}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="login-field">
              <span>Product / item description</span>
              <input
                value={newProduct}
                onChange={(e) => onProductChange(e.target.value)}
                required
                placeholder="e.g. KitchenAid stand mixer"
              />
            </label>
            {mode === 'requests' && (
              <label className="login-field">
                <span>Details</span>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => onDescChange(e.target.value)}
                  placeholder="Specs, color, condition notes…"
                  style={{
                    width: '100%',
                    border: '0.8px solid var(--line)',
                    borderRadius: 3,
                    padding: 10,
                    fontSize: 13,
                  }}
                />
              </label>
            )}
          </>
        )}

        <label className="login-field">
          <span>Quantity</span>
          <input
            type="number"
            min={1}
            value={newQty}
            onChange={(e) => onQtyChange(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Button type="submit" variant="primary" loading={submitting}>
            <span>{submitting ? 'Saving…' : 'Create record'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
