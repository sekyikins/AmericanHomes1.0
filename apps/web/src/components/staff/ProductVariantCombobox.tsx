'use client';

import { Check, Link2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export type ProductVariantOption = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  category?: string;
};

type Props = {
  value: string;
  variantId?: string;
  options: ProductVariantOption[];
  placeholder?: string;
  onChange: (next: {
    productName: string;
    variantId?: string;
    variantLabel?: string;
    category?: string;
  }) => void;
};

export function ProductVariantCombobox({
  value,
  variantId,
  options,
  placeholder = 'Search existing product or type new name…',
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter(
        (o) =>
          o.productName.toLowerCase().includes(q) ||
          o.variantName.toLowerCase().includes(q) ||
          o.sku.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [options, value]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={13}
          color="var(--muted)"
          style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
        />
        <input
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) =>
            onChange({
              productName: e.target.value,
              variantId: undefined,
              variantLabel: undefined,
            })
          }
          style={{
            width: '100%',
            height: 38,
            border: '0.8px solid var(--line)',
            padding: variantId ? '0 76px 0 30px' : '0 10px 0 30px',
            fontSize: 12.5,
            background: '#fff',
          }}
        />
        {variantId && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--green)',
              background: '#edf7f1',
              padding: '2px 6px',
              pointerEvents: 'none',
            }}
          >
            <Link2 size={11} />
            Linked
          </span>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: '#fff',
            border: '0.8px solid var(--line)',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((opt) => {
              const displayName = opt.variantName
                ? `${opt.productName} (${opt.variantName})`
                : opt.productName;
              const isSelected = variantId === opt.variantId;
              return (
                <button
                  key={opt.variantId}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({
                      productName: displayName,
                      variantId: opt.variantId,
                      variantLabel: opt.variantName || opt.sku,
                      category: opt.category,
                    });
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 0,
                    borderBottom: '0.6px solid var(--line)',
                    background: isSelected ? '#f3f8f5' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.productName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {opt.variantName || 'Default'} · SKU {opt.sku}
                    </div>
                  </div>
                  {isSelected && <Check size={14} color="var(--green)" />}
                </button>
              );
            })
          ) : (
            <div style={{ padding: '9px 10px', fontSize: 12, color: 'var(--muted)' }}>
              No matching catalogue variant — &ldquo;{value.trim() || 'New item'}&rdquo; will be recorded as a new item.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
