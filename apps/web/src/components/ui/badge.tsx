import type { CSSProperties, ReactNode } from 'react';

export type BadgeVariant = 'green' | 'blue' | 'amber' | 'red' | 'default';

const badgeStyles: Record<BadgeVariant, CSSProperties> = {
  green: { background: '#e7f2ec', color: '#147653' },
  blue: { background: '#dbeafe', color: '#1d69d5' },
  amber: { background: '#fef3c7', color: '#92400e' },
  red: { background: '#fee2e2', color: '#991b1b' },
  default: { background: '#f1eee6', color: '#102d48' },
};

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span
      style={{
        ...badgeStyles[variant],
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 700,
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
