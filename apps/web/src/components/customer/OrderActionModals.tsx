'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { taxApi, type TaxInvoiceDto } from '@/lib/api';
import type { CustomerOrderRecord } from '@/lib/customerAccount';
import { formatGHS } from '@/lib/formatting/currency';

export function OrderReceiptModal({
  order,
  onClose,
}: {
  order: CustomerOrderRecord;
  onClose: () => void;
}) {
  const [seller, setSeller] = useState<{
    tin: string;
    name: string;
    address: string;
    evatMode: 'LIVE' | 'SANDBOX';
  } | null>(null);
  const [invoices, setInvoices] = useState<TaxInvoiceDto[]>([]);

  useEffect(() => {
    let active = true;
    taxApi
      .getForOrder(order.id)
      .then((res) => {
        if (!active) return;
        setSeller(res.seller);
        setInvoices(res.invoices ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [order.id]);

  const primaryInv = invoices.find((i) => i.documentType === 'INVOICE');
  const creditNotes = invoices.filter((i) => i.documentType === 'CREDIT_NOTE');

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Digital receipt"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-close" aria-label="Close receipt" onClick={onClose}>
          <X size={17} />
        </button>
        <div className="login-inner">
          <div className="eyebrow">
            {primaryInv
              ? primaryInv.status === 'CLEARED'
                ? 'GRA E-VAT Tax Invoice'
                : 'Tax Invoice (Sandbox / Pending GRA Clearance)'
              : 'Order Receipt'}
          </div>
          <h2 className="login-title" style={{ fontSize: 24 }}>
            {primaryInv ? primaryInv.invoiceNumber : order.reference}
          </h2>
          <p className="login-subtitle">
            {seller?.name ?? 'AmericanHomes Ltd'}
            {seller?.tin ? ` · TIN: ${seller.tin}` : ''} · {order.reference} · {order.date}
          </p>

          {primaryInv && primaryInv.isSandbox && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 10px',
                background: '#fffbeb',
                border: '0.8px solid #f59e0b',
                borderRadius: 4,
                fontSize: 11.5,
                color: '#92400e',
              }}
            >
              <strong>Sandbox E-VAT document:</strong> Not yet cleared by GRA. Configure live GRA
              E-VAT credentials for a legally valid tax invoice.
            </div>
          )}

          <div style={{ marginTop: 16, borderTop: '0.8px solid var(--line)', paddingTop: 12 }}>
            {order.lines && order.lines.length > 0 ? (
              order.lines.map((line) => (
                <div key={line.variantId} className="pdp-detail-row">
                  <span>
                    {line.name} × {line.quantity}
                  </span>
                  <strong>{formatGHS(line.unitPriceCents * line.quantity)}</strong>
                </div>
              ))
            ) : (
              <div className="pdp-detail-row">
                <span>Item</span>
                <strong>{order.productName}</strong>
              </div>
            )}

            {primaryInv && (
              <>
                <div className="pdp-detail-row" style={{ borderTop: '0.8px dashed var(--line)', paddingTop: 8, marginTop: 6 }}>
                  <span>Net taxable value</span>
                  <strong>{formatGHS(primaryInv.netCents)}</strong>
                </div>
                <div className="pdp-detail-row">
                  <span>NHIL (2.5%)</span>
                  <strong>{formatGHS(primaryInv.nhilCents)}</strong>
                </div>
                <div className="pdp-detail-row">
                  <span>GETFund Levy (2.5%)</span>
                  <strong>{formatGHS(primaryInv.getFundCents)}</strong>
                </div>
                <div className="pdp-detail-row">
                  <span>VAT (15%)</span>
                  <strong>{formatGHS(primaryInv.vatCents)}</strong>
                </div>
              </>
            )}

            <div className="pdp-detail-row">
              <span>Total payable (tax-inclusive)</span>
              <strong>{formatGHS(order.totalPesewas)}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Total verified paid</span>
              <strong>{formatGHS(order.paidPesewas)}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Balance remaining</span>
              <strong>{formatGHS(Math.max(0, order.totalPesewas - order.paidPesewas))}</strong>
            </div>
            <div className="pdp-detail-row">
              <span>Payment / Gate status</span>
              <strong>
                {order.paymentStatus} · {order.collectionStatus}
              </strong>
            </div>

            {primaryInv?.evatReference && (
              <div className="pdp-detail-row" style={{ fontSize: 11.5 }}>
                <span>GRA E-VAT ref</span>
                <strong style={{ fontFamily: 'monospace' }}>{primaryInv.evatReference}</strong>
              </div>
            )}
            {primaryInv?.evatSignature && (
              <div className="pdp-detail-row" style={{ fontSize: 11 }}>
                <span>Digital signature</span>
                <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right' }}>
                  {primaryInv.evatSignature.slice(0, 24)}…
                </span>
              </div>
            )}
          </div>

          {creditNotes.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef2f2', border: '0.8px solid #fecaca', borderRadius: 4, fontSize: 11.5 }}>
              <strong style={{ display: 'block', color: '#991b1b', marginBottom: 4 }}>
                Credit Notes Issued
              </strong>
              {creditNotes.map((cn) => (
                <div key={cn.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{cn.invoiceNumber}</span>
                  <strong>{formatGHS(cn.totalCents)}</strong>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              background: '#f8faf9',
              border: '0.8px solid var(--line)',
              borderRadius: 4,
              fontSize: 11.5,
              color: 'var(--nav-muted)',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ display: 'block', color: 'var(--ink)', marginBottom: 2 }}>
              Inspection &amp; &ldquo;As-Is&rdquo; Condition Disclosure Policy
            </strong>
            <span>
              Disclosed cosmetic defects acknowledged at purchase are non-returnable. Undisclosed
              functional defects may be reported within 7 days of warehouse gate collection.
            </span>
          </div>
          <button
            type="button"
            className="button primary"
            style={{ width: '100%', minHeight: 42, marginTop: 22 }}
            onClick={() => window.print()}
          >
            Print {primaryInv ? 'Tax Invoice' : 'Receipt'} / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderReturnModal({
  order,
  submitted,
  reason,
  setReason,
  selectedLines,
  onToggleLine,
  onLineQtyChange,
  submitting,
  onSubmit,
  onClose,
}: {
  order: CustomerOrderRecord;
  submitted: boolean;
  reason: string;
  setReason: (v: string) => void;
  selectedLines?: Record<string, number>;
  onToggleLine?: (variantId: string, maxQty: number) => void;
  onLineQtyChange?: (variantId: string, qty: number) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Request return or exchange"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-close"
          aria-label="Close return request"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <div className="login-inner">
          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div className="eyebrow">Return request submitted</div>
              <h2 className="login-title" style={{ fontSize: 24 }}>
                Under management review
              </h2>
              <p className="login-subtitle" style={{ marginTop: 10 }}>
                Return request for <strong>{order.productName}</strong> ({order.reference}) has been
                logged against your collection record.
              </p>
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', minHeight: 42, marginTop: 22 }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="eyebrow">Returns &amp; exchanges</div>
              <h2 className="login-title" style={{ fontSize: 24 }}>
                Request return
              </h2>
              <p className="login-subtitle">
                {order.productName} ({order.reference}). Returns are reviewed within 7 days of
                collection.
              </p>
              <form onSubmit={onSubmit} className="login-form">
                {order.lines && order.lines.length > 0 && selectedLines && onToggleLine && onLineQtyChange && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="login-label" style={{ marginBottom: 6 }}>
                      Select item(s) &amp; quantity to return
                    </div>
                    <div
                      style={{
                        border: '0.8px solid var(--line)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        background: '#f8fafc',
                      }}
                    >
                      {order.lines.map((line) => {
                        const qtySelected = selectedLines[line.variantId] ?? 0;
                        const checked = qtySelected > 0;
                        return (
                          <div
                            key={line.variantId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              fontSize: 13,
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleLine(line.variantId, line.quantity)}
                              />
                              <span>
                                <strong>{line.name}</strong> (Purchased: {line.quantity})
                              </span>
                            </label>
                            {checked && (
                              <input
                                type="number"
                                min={1}
                                max={line.quantity}
                                value={qtySelected}
                                onChange={(e) =>
                                  onLineQtyChange(
                                    line.variantId,
                                    Math.min(line.quantity, Math.max(1, Number(e.target.value) || 1)),
                                  )
                                }
                                style={{
                                  width: 64,
                                  padding: '4px 8px',
                                  border: '0.8px solid var(--line)',
                                  borderRadius: 4,
                                  background: '#fff',
                                  fontSize: 13,
                                }}
                                aria-label={`Return quantity for ${line.name}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="login-label" htmlFor="return-reason">
                  Reason for return or exchange
                </label>
                <textarea
                  id="return-reason"
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the issue or exchange preference..."
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '0.8px solid var(--line)',
                    borderRadius: 4,
                    marginBottom: 18,
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="login-submit"
                  loading={submitting}
                  loadingText="Submitting…"
                  disabled={!reason.trim()}
                >
                  Submit return request
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderPayBalanceModal({
  order,
  channel,
  setChannel,
  customAmountGhs,
  setCustomAmountGhs,
  storeCreditPesewas,
  redeemingCredit,
  onRedeemStoreCredit,
  submitting,
  onSubmit,
  onClose,
}: {
  order: CustomerOrderRecord;
  channel: 'paystack_momo' | 'paystack_card';
  setChannel: (c: 'paystack_momo' | 'paystack_card') => void;
  customAmountGhs?: string;
  setCustomAmountGhs?: (val: string) => void;
  storeCreditPesewas?: number;
  redeemingCredit?: boolean;
  onRedeemStoreCredit?: () => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const outstandingPesewas = Math.max(0, order.totalPesewas - order.paidPesewas);
  const parsedCustomPesewas =
    customAmountGhs && Number(customAmountGhs) > 0
      ? Math.min(outstandingPesewas, Math.round(Number(customAmountGhs) * 100))
      : outstandingPesewas;

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pay order balance"
      onClick={onClose}
    >
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-close"
          aria-label="Close payment modal"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <div className="login-inner">
          <div className="eyebrow">Paystack &amp; Layaway Installment Checkout</div>
          <h2 className="login-title" style={{ fontSize: 24 }}>
            Pay full or partial balance
          </h2>
          <p className="login-subtitle">
            {order.reference} · {order.productName} · Remaining Balance{' '}
            <strong>{formatGHS(outstandingPesewas)}</strong>
          </p>

          {(storeCreditPesewas ?? 0) > 0 && onRedeemStoreCredit && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#f2f8f4',
                border: '1px solid #cce0d4',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12 }}>
                <strong style={{ display: 'block', color: 'var(--green)' }}>
                  Store Credit Available: {formatGHS(storeCreditPesewas ?? 0)}
                </strong>
                <span style={{ color: 'var(--muted)' }}>
                  Apply your return store credit directly toward this order balance.
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={redeemingCredit}
                loadingText="Applying…"
                disabled={submitting || redeemingCredit}
                onClick={onRedeemStoreCredit}
              >
                Apply {formatGHS(Math.min(outstandingPesewas, storeCreditPesewas ?? 0))} Credit
              </Button>
            </div>
          )}

          <form onSubmit={onSubmit} className="login-form">
            {setCustomAmountGhs && (
              <div style={{ marginBottom: 14 }}>
                <label className="login-label" htmlFor="pay-amount-ghs">
                  Amount to pay now (GHS) — Full balance or partial MoMo installment
                </label>
                <input
                  id="pay-amount-ghs"
                  type="number"
                  step="0.01"
                  min={1}
                  max={outstandingPesewas / 100}
                  value={customAmountGhs ?? String(outstandingPesewas / 100)}
                  onChange={(e) => setCustomAmountGhs(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '0.8px solid var(--line)',
                    borderRadius: 4,
                    fontSize: 14,
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: '100% (Full)', pct: 1 },
                    { label: '50% Installment', pct: 0.5 },
                    { label: '30% Deposit', pct: 0.3 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="button"
                      style={{ minHeight: 26, padding: '0 8px', fontSize: 11 }}
                      onClick={() =>
                        setCustomAmountGhs(
                          ((Math.round(outstandingPesewas * preset.pct) || outstandingPesewas) / 100).toFixed(2),
                        )
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="req-checkbox-row" style={{ marginBottom: 10 }}>
              <input
                type="radio"
                name="order-pay-channel"
                checked={channel === 'paystack_momo'}
                onChange={() => setChannel('paystack_momo')}
              />
              <span>Mobile Money (MTN, Telecel, AT)</span>
            </label>
            <label className="req-checkbox-row" style={{ marginBottom: 18 }}>
              <input
                type="radio"
                name="order-pay-channel"
                checked={channel === 'paystack_card'}
                onChange={() => setChannel('paystack_card')}
              />
              <span>Debit / Credit Card</span>
            </label>
            <Button
              type="submit"
              variant="primary"
              className="login-submit"
              loading={submitting}
              loadingText="Initializing…"
            >
              Pay {formatGHS(parsedCustomPesewas)}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
