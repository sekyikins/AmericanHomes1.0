'use client';

import { AlertCircle, Inbox, RefreshCw, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px dashed var(--line)',
        borderRadius: 0,
        background: '#fff',
      }}
    >
      <Inbox size={26} color="var(--muted)" style={{ marginBottom: 10 }} />
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{title}</h3>
      <p style={{ margin: '0 auto 14px', maxWidth: 420, fontSize: 13, color: 'var(--muted)' }}>
        {description}
      </p>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: '28px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid #fecaca',
        borderRadius: 0,
        background: '#fef2f2',
        color: '#991b1b',
      }}
    >
      <AlertCircle size={24} style={{ marginBottom: 8 }} />
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Unable to load data</h3>
      <p style={{ margin: '0 auto 14px', maxWidth: 420, fontSize: 13 }}>{message}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          <RefreshCw size={14} />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}

export function PermissionDeniedState({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid #fde68a',
        borderRadius: 0,
        background: '#fffbeb',
        color: '#92400e',
      }}
    >
      <ShieldAlert size={24} style={{ marginBottom: 8 }} />
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Access restricted</h3>
      <p style={{ margin: 0, fontSize: 13 }}>
        {message ?? 'You do not have permission to view or perform this action.'}
      </p>
    </div>
  );
}
