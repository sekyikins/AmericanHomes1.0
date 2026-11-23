'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { Button, SearchableSelect } from '@/components/ui';
import { ArrowRight, Info, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';

export interface ReturnOrderLineOption {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ReturnCaseSummary {
  id: string;
  reference: string;
  orderReference: string;
  customer: string;
  reason: string;
  status: string;
  orderLines: ReturnOrderLineOption[];
}

export function CreateReturnModal({
  open,
  orders,
  orderId,
  returnReason,
  submitting,
  onOrderIdChange,
  onReasonChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  orders: Array<{ id: string; reference: string; customer: string }>;
  orderId: string;
  returnReason: string;
  submitting: boolean;
  onOrderIdChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open} label="Create return case" onClose={onClose}>
      <div className="ship-eyebrow">RETURNS</div>
      <h2 style={{ marginTop: 6 }}>Create return case</h2>
      <form onSubmit={onSubmit}>
        <div className="login-field">
          <span>Original order</span>
          <SearchableSelect
            options={orders.map((o) => ({
              value: o.id,
              label: `${o.reference} · ${o.customer}`,
              searchText: `${o.reference} ${o.customer}`,
            }))}
            value={orderId}
            onChange={onOrderIdChange}
            placeholder="Search order by reference or customer…"
            searchPlaceholder="Type order ref or customer name…"
          />
        </div>
        <label className="login-field">
          <span>Return reason</span>
          <textarea
            rows={3}
            required
            value={returnReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Describe item condition and reason for return…"
            style={{
              width: '100%',
              border: '0.8px solid var(--line)',
              borderRadius: 3,
              padding: 10,
              fontSize: 13,
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button type="submit" variant="primary" loading={submitting} disabled={!orderId}>
            <span>{submitting ? 'Creating…' : 'Create return'}</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}

export function ReviewReturnModal({
  open,
  selected,
  selectedVariantId,
  returnQty,
  settlementType,
  disposition,
  refundAmountGhs,
  decisionNotes,
  onVariantChange,
  onReturnQtyChange,
  onSettlementTypeChange,
  onDispositionChange,
  onRefundAmountChange,
  onDecisionNotesChange,
  onDecisionClick,
  onClose,
}: {
  open: boolean;
  selected: ReturnCaseSummary | null;
  selectedVariantId: string;
  returnQty: string;
  settlementType: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
  disposition: 'RESTOCK' | 'DISPOSE' | 'EXCHANGE';
  refundAmountGhs: string;
  decisionNotes: string;
  onVariantChange: (variantId: string) => void;
  onReturnQtyChange: (value: string) => void;
  onSettlementTypeChange: (value: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT') => void;
  onDispositionChange: (value: 'RESTOCK' | 'DISPOSE' | 'EXCHANGE') => void;
  onRefundAmountChange: (value: string) => void;
  onDecisionNotesChange: (value: string) => void;
  onDecisionClick: (approved: boolean) => void;
  onClose: () => void;
}) {
  return (
    <StaffModal open={open && Boolean(selected)} label="Review return case" onClose={onClose}>
      {selected && (
        <>
          <div className="res-head-row">
            <span className="ship-eyebrow">{selected.reference}</span>
            <span className="res-guard-pill">
              <ShieldCheck size={12} /> Approval required
            </span>
          </div>

          <h2 style={{ marginTop: 8 }}>Review return case</h2>
          <p className="login-sub">
            Order {selected.orderReference} · {selected.customer} · {selected.reason}
          </p>

          {selected.orderLines.length > 0 && (
            <div className="req-row-2" style={{ marginBottom: 12 }}>
              <label className="login-field">
                <span>Returned item</span>
                <SearchableSelect
                  value={selectedVariantId}
                  onChange={onVariantChange}
                  options={selected.orderLines.map((l) => ({
                    value: l.variantId,
                    label: `${l.label} (Qty ${l.quantity})`,
                  }))}
                  placeholder="Select returned item…"
                  searchPlaceholder="Search order items…"
                />
              </label>
              <label className="login-field">
                <span>Returned quantity</span>
                <input
                  type="number"
                  min={1}
                  value={returnQty}
                  onChange={(e) => onReturnQtyChange(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="req-row-2">
            <label className="login-field">
              <span>Settlement</span>
              <select
                className="staff-field-select"
                value={settlementType}
                onChange={(e) =>
                  onSettlementTypeChange(e.target.value as 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT')
                }
              >
                <option value="REFUND">Refund</option>
                <option value="EXCHANGE">Exchange</option>
                <option value="STORE_CREDIT">Store credit</option>
              </select>
            </label>
            <label className="login-field">
              <span>Stock disposition</span>
              <select
                className="staff-field-select"
                value={disposition}
                onChange={(e) =>
                  onDispositionChange(e.target.value as 'RESTOCK' | 'DISPOSE' | 'EXCHANGE')
                }
              >
                <option value="RESTOCK">Restock</option>
                <option value="DISPOSE">Dispose</option>
                <option value="EXCHANGE">Exchange</option>
              </select>
            </label>
          </div>

          {settlementType !== 'EXCHANGE' && (
            <label className="login-field">
              <span>
                {settlementType === 'STORE_CREDIT'
                  ? 'Store credit amount (GHS)'
                  : 'Refund amount (GHS)'}
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={refundAmountGhs}
                onChange={(e) => onRefundAmountChange(e.target.value)}
                placeholder="0.00"
              />
            </label>
          )}

          <label className="login-field">
            <span>Inspection notes</span>
            <textarea
              rows={2}
              value={decisionNotes}
              onChange={(e) => onDecisionNotesChange(e.target.value)}
              style={{
                width: '100%',
                border: '0.8px solid var(--line)',
                borderRadius: 3,
                padding: 10,
                fontSize: 13,
              }}
            />
          </label>

          <div className="rec-info-banner" style={{ marginBottom: 14 }}>
            <Info size={16} color="#49616e" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11.5 }}>
              Returned stock enters unavailable inventory until inspection and disposition are confirmed.
            </span>
          </div>

          {(selected.status === 'PENDING' ||
            selected.status === 'REQUESTED' ||
            selected.status === 'UNDER_REVIEW') && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                type="button"
                variant="secondary"
                style={{ flex: 1 }}
                onClick={() => onDecisionClick(false)}
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="primary"
                style={{ flex: 1.4 }}
                onClick={() => onDecisionClick(true)}
              >
                Approve return
              </Button>
            </div>
          )}
        </>
      )}
    </StaffModal>
  );
}
