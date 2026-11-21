import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant = 'secondary',
  className = '',
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantClass = variant === 'primary' ? 'button primary' : 'button';
  return (
    <button
      className={`${variantClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="btn-spinner" aria-hidden="true" />
          <span>{loadingText ?? 'Processing…'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
