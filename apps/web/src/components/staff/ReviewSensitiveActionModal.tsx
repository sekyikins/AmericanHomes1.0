'use client';

import { StaffModal } from '@/components/staff/StaffModal';
import { shortRef } from '@/lib/staffUtils';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

export type SensitiveActionItem = {
  id?: string;
  kind?: 'ADJUSTMENT' | 'PRICE' | 'PAYMENT';
  reference: string;
  title: string;
  initiatedBy: string;
  submittedAt: string;
  beforeLabel: string;
  beforeValue: string;
  afterLabel: string;
  afterValue: string;
};

export function ReviewSensitiveActionModal({
  action,
  onClose,
  onDecision,
}: {
  action: SensitiveActionItem | null;
  onClose: () => void;
  onDecision?: (
    action: SensitiveActionItem,
    decision: 'APPROVED' | 'REJECTED',
    note: string,
  ) => Promise<void> | void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action) return null;

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onDecision?.(action, decision, note);
      setNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process decision');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedSubmitted = (() => {
    const parsed = Date.parse(action.submittedAt);
    return Number.isNaN(parsed)
      ? action.submittedAt
      : new Date(parsed).toLocaleString('en-GH');
  })();

  return (
    <StaffModal
      open={Boolean(action)}
      variant="review"
      label="Review sensitive action"
      onClose={onClose}
    >
      <div className="review-top-row">
        <div className="eyebrow">{action.reference}</div>
        <span className="acct-pill amber" style={{ marginRight: 36 }}>
          ● Action required
        </span>
      </div>

      <h2 className="review-title">Review sensitive action</h2>
      <p className="review-sub">
        Review the initiating user, evidence and before-and-after values. Self-approval is
        disabled.
      </p>

      <div className="review-meta-grid">
        <div className="review-meta-cell">
          <span>Reference</span>
          <strong>{action.reference}</strong>
        </div>
        <div className="review-meta-cell">
          <span>Initiated by</span>
          <strong>{shortRef(action.initiatedBy, 'STF')}</strong>
        </div>
        <div className="review-meta-cell">
          <span>Submitted</span>
          <strong>{formattedSubmitted}</strong>
        </div>
      </div>

        <div className="review-diff-row">
          <div className="review-diff-box">
            <span>{action.beforeLabel}</span>
            <strong>{action.beforeValue}</strong>
          </div>
          <ArrowRight size={16} color="var(--muted)" />
          <div className="review-diff-box">
            <span>{action.afterLabel}</span>
            <strong>{action.afterValue}</strong>
          </div>
        </div>

        <div className="req-field" style={{ marginTop: 20 }}>
          <label htmlFor="review-approval-note">
            <strong>Approval note</strong>
          </label>
          <textarea
            id="review-approval-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add the reason for your decision..."
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 4,
              background: '#fdf3f2',
              border: '1px solid #f0c2bd',
              color: '#b42318',
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        <div className="review-actions">
          <button
            type="button"
            className="button"
            disabled={submitting}
            style={{ background: '#fff' }}
            onClick={() => handleDecision('REJECTED')}
          >
            {submitting ? 'Processing…' : 'Reject'}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
            onClick={() => handleDecision('APPROVED')}
          >
            <span>{submitting ? 'Approving…' : 'Approve action'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </StaffModal>
  );
}
