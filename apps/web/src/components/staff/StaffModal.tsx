'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type StaffModalProps = {
  open: boolean;
  label: string;
  onClose: () => void;
  variant?: 'settings' | 'review';
  children: ReactNode;
};

export function StaffModal({
  open,
  label,
  onClose,
  variant = 'settings',
  children,
}: StaffModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="login-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={variant === 'review' ? 'review-modal' : 'settings-modal'}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="login-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={17} />
        </button>
        {children}
      </div>
    </div>
  );
}
