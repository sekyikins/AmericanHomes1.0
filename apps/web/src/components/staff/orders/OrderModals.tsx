'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { ArrowRight, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';

export interface OrderDraftLine {
  id: string;
  variantId: string;
  quantity: number;
  agreedPrice: string;
}

export interface OrderVariantOption {
  id: string;
  label: string;
  priceCents: number;
}

interface OrderRecordModalProps {
  modalMode: 'create' | 'edit' | null;
  orderReference?: string;
  isCancelled?: boolean;
  editingId: string | null;
  customerLookup: string;
  variants: OrderVariantOption[];
  draftLines: OrderDraftLine[];
  qty: number;
  agreedPrice: string;
  submitting: boolean;
  cancellingOrder: boolean;
  onCustomerLookupChange: (value: string) => void;
  onAddDraftLine: () => void;
  onRemoveDraftLine: (id: string) => void;
  onChangeLineVariant: (id: string, variantId: string) => void;
  onChangeLineQty: (id: string, quantity: number) => void;
  onChangeLinePrice: (id: string, agreedPrice: string) => void;
  onCancelOrderClick: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function OrderRecordModal({
  modalMode,
  orderReference,
  isCancelled = false,
  editingId,
  customerLookup,
  variants,
  draftLines,
  qty,
  agreedPrice,
  submitting,
  cancellingOrder,
  onCustomerLookupChange,
  onAddDraftLine,
  onRemoveDraftLine,
  onChangeLineVariant,
  onChangeLineQty,
  onChangeLinePrice,
  onCancelOrderClick,
  onSubmit,
  onClose,
}: OrderRecordModalProps) {
  return (
    <StaffModal
      open={Boolean(modalMode)}
      label={modalMode === 'create' ? 'Create walk-in sale' : 'Order detail'}
      onClose={onClose}
    >
      <div className="res-head-row">
        <span className="ship-eyebrow">
          {modalMode === 'create' ? 'WALK-IN SALE' : 'ORDER DETAIL'}
        </span>
        {modalMode === 'edit' && isCancelled ? (
          <span className="acct-pill gray">● Cancelled</span>
        ) : (
          <span className="res-guard-pill">
            <ShieldCheck size={12} /> Stock commit active
          </span>
        )}
      </div>

      <h2 style={{ marginTop: 8 }}>
        {modalMode === 'create'
          ? 'Create walk-in sale'
          : orderReference ?? 'Order'}
      </h2>

      <form onSubmit={onSubmit}>
        <label className="login-field">
          <span>Customer / Guest name or phone</span>
          <input
            value={customerLookup}
            readOnly={modalMode === 'edit'}
            onChange={(e) => onCustomerLookupChange(e.target.value)}
            placeholder="Guest sale or customer phone"
          />
        </label>

        {modalMode === 'create' ? (
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: 12.5 }}>Order items</strong>
              <Button
                type="button"
                variant="secondary"
                style={{ minHeight: 30, padding: '0 10px', fontSize: 12, background: '#fff' }}
                onClick={onAddDraftLine}
              >
                <Plus size={13} />
                <span>Add product</span>
              </Button>
            </div>

            {draftLines.map((line) => (
              <div
                key={line.id}
                style={{
                  border: '0.8px solid var(--line)',
                  padding: 10,
                  background: '#f9faf9',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    aria-label="Product variant"
                    value={line.variantId}
                    onChange={(e) => onChangeLineVariant(line.id, e.target.value)}
                    style={{
                      flex: 1,
                      height: 40,
                      border: '0.8px solid var(--line)',
                      padding: '0 10px',
                      background: '#fff',
                      fontSize: 12.5,
                    }}
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  {draftLines.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove product"
                      onClick={() => onRemoveDraftLine(line.id)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="req-row-2">
                  <label className="login-field" style={{ margin: 0 }}>
                    <span>Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        onChangeLineQty(line.id, Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </label>
                  <label className="login-field" style={{ margin: 0 }}>
                    <span>Unit price (GHS)</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.agreedPrice}
                      onChange={(e) => onChangeLinePrice(line.id, e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                fontWeight: 700,
                paddingTop: 4,
              }}
            >
              <span>Order total</span>
              <span>
                GHS{' '}
                {draftLines
                  .reduce(
                    (sum, l) =>
                      sum + (Number(l.agreedPrice) || 0) * Math.max(1, Number(l.quantity) || 1),
                    0,
                  )
                  .toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="req-row-2">
            <label className="login-field">
              <span>Quantity</span>
              <input
                type="text"
                readOnly
                value={qty}
                style={{ background: '#f7f8f7', color: 'var(--ink)' }}
              />
            </label>
            <label className="login-field">
              <span>Order total (GHS)</span>
              <input
                type="text"
                readOnly
                value={agreedPrice}
                style={{ background: '#f7f8f7', color: 'var(--ink)' }}
              />
            </label>
          </div>
        )}

        <div className="rec-info-banner" style={{ marginBottom: 14 }}>
          <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11.5 }}>
            {modalMode === 'edit' && isCancelled
              ? 'This order is cancelled and its stock commitment has been released.'
              : 'The agreed price is preserved on the sale. Cancelling an order releases committed stock back to inventory.'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: modalMode === 'edit' && !isCancelled ? 'space-between' : 'flex-end',
            gap: 10,
          }}
        >
          {modalMode === 'edit' && editingId && !isCancelled && (
            <Button
              type="button"
              variant="secondary"
              disabled={cancellingOrder}
              onClick={onCancelOrderClick}
            >
              Cancel order
            </Button>
          )}
          {modalMode === 'create' && (
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              loadingText="Creating…"
              disabled={draftLines.filter((l) => l.variantId).length === 0}
            >
              <span>Create walk-in sale</span>
              <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </form>
    </StaffModal>
  );
}
