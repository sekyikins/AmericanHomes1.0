'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
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
          <div className="login-field">
            <span>Shipment</span>
            <SearchableSelect
              ariaLabel="Shipment"
              options={shipments.map((s) => ({
                value: s.id,
                label: s.reference,
                searchText: s.reference,
              }))}
              value={newShipmentId}
              onChange={onShipmentIdChange}
              placeholder="Select shipment…"
              searchPlaceholder="Type shipment reference…"
            />
          </div>
        )}

        {mode === 'allocations' ? (
          <>
            <div className="login-field">
              <span>Product request</span>
              <SearchableSelect
                ariaLabel="Product request"
                options={requestOptions.map((r) => ({
                  value: r.id,
                  label: r.label,
                  searchText: r.label,
                }))}
                value={newRequestId}
                onChange={onRequestIdChange}
                placeholder="Select product request…"
                searchPlaceholder="Type request ref or product…"
              />
            </div>
            <div className="login-field">
              <span>Stock variant</span>
              <SearchableSelect
                ariaLabel="Stock variant"
                options={variants.map((v) => ({
                  value: v.id,
                  label: v.label,
                  searchText: v.label,
                }))}
                value={newVariantId}
                onChange={onVariantIdChange}
                placeholder="Select stock variant…"
                searchPlaceholder="Type product name or SKU…"
              />
            </div>
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
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingText="Saving…"
            disabled={
              mode === 'allocations'
                ? !newRequestId || !newVariantId
                : mode === 'sourcing'
                  ? !newShipmentId || !newProduct.trim()
                  : !newProduct.trim()
            }
          >
            <span>Create record</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
