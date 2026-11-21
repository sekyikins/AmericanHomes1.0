'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  targetName?: string;
  description: string;
  consequence?: string;
  reversible?: boolean;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  targetName,
  description,
  consequence,
  reversible = false,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="login-backdrop"
      role="presentation"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <section
        className="login-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="login-close"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close confirmation dialog"
        >
          <X size={17} strokeWidth={2} />
        </button>

        <div className="login-inner" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: destructive ? '#fef2f2' : '#fffbeb',
                color: destructive ? '#b42318' : '#b45309',
              }}
            >
              <AlertTriangle size={17} />
            </span>
            <h2 id="confirm-dialog-title" style={{ margin: 0, fontSize: 18 }}>
              {title}
            </h2>
          </div>

          {targetName && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--canvas)',
                borderRadius: 0,
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Affected record: {targetName}
            </div>
          )}

          <p id="confirm-dialog-desc" style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--ink-body)' }}>
            {description}
          </p>

          {consequence && (
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)' }}>
              {consequence}
            </p>
          )}

          <p style={{ margin: '0 0 20px', fontSize: 12, color: destructive ? '#b42318' : 'var(--muted)' }}>
            {reversible ? 'This action can be reversed later.' : 'This action cannot be undone automatically.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              ref={cancelRef}
              type="button"
              className="button"
              disabled={loading}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="button primary"
              disabled={loading}
              style={
                destructive
                  ? { background: '#b42318', borderColor: '#b42318', color: '#fff' }
                  : undefined
              }
              onClick={onConfirm}
            >
              {loading ? 'Processing…' : confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
