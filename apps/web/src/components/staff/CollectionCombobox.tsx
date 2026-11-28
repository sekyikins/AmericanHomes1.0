'use client';

import { Check, Plus, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';

type CollectionComboboxProps = {
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/**
 * Text + dropdown list combo for Product Collections / Categories.
 * Staff can select an existing collection or type a brand-new name,
 * which is automatically created and registered when saved.
 */
export function CollectionCombobox({
  value,
  options,
  placeholder = 'Select or type collection…',
  disabled = false,
  onChange,
}: CollectionComboboxProps) {
  const [open, setOpen] = useState(false);

  const normalizedVal = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedVal) return options;
    return options.filter((c) => c.toLowerCase().includes(normalizedVal));
  }, [options, normalizedVal]);

  const exactMatch = useMemo(
    () => options.some((c) => c.trim().toLowerCase() === normalizedVal),
    [options, normalizedVal],
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Tag
          size={13}
          color="var(--muted)"
          style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
        />
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 130)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            height: 38,
            border: '0.8px solid var(--line)',
            borderRadius: 3,
            padding: '0 10px 0 30px',
            fontSize: 12.5,
            background: disabled ? '#f7f8f7' : '#fff',
          }}
        />
      </div>

      {open && !disabled && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#fff',
            border: '0.8px solid var(--line)',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtered.map((opt) => {
            const isSelected = opt.trim().toLowerCase() === normalizedVal;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  border: 0,
                  borderBottom: '0.8px solid #f0f2f1',
                  background: isSelected ? '#f2f8f4' : '#fff',
                  fontSize: 12.5,
                  color: 'var(--ink)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>{opt}</span>
                {isSelected && <Check size={13} color="var(--green)" />}
              </button>
            );
          })}

          {value.trim() && !exactMatch && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(value.trim());
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 10px',
                border: 0,
                background: '#f7fbf8',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--green)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>Create collection &ldquo;{value.trim()}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
