'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ListInputField({
  value,
  savedValue = '',
  placeholder = 'Add item...',
  disabled = false,
  onChange,
}: {
  value: string;
  savedValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (nextValue: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const items = useMemo(() => parseList(value), [value]);
  const savedSet = useMemo(
    () => new Set(parseList(savedValue).map((s) => s.toLowerCase())),
    [savedValue],
  );

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    if (items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, trimmed].join(', '));
    setDraft('');
  };

  const handleRemove = (index: number) => {
    if (disabled) return;
    const next = items.filter((_, i) => i !== index);
    onChange(next.join(', '));
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="button primary"
          onClick={handleAdd}
          disabled={disabled || !draft.trim()}
          aria-label="Add item"
          style={{ padding: '0 12px', flexShrink: 0 }}
        >
          <Plus size={16} />
        </button>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: '12px 14px',
            border: '0.8px dashed var(--line)',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          No items configured yet.
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            border: '0.8px solid var(--line)',
            background: '#fff',
          }}
        >
          {items.map((item, idx) => {
            const isFromDb = savedSet.has(item.toLowerCase());
            return (
              <li
                key={`${item}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 12px',
                  borderBottom: idx === items.length - 1 ? 0 : '0.8px solid var(--line)',
                  background: isFromDb ? '#fff' : '#f4fbf7',
                  borderLeft: isFromDb ? '3px solid transparent' : '3px solid var(--green)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item}</span>
                  <span className={`acct-pill ${isFromDb ? 'blue' : 'amber'}`}>
                    {isFromDb ? 'Saved' : 'New'}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  disabled={disabled}
                  aria-label={`Remove ${item}`}
                  onClick={() => handleRemove(idx)}
                  style={{ width: 28, height: 28, color: 'var(--alert)' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
