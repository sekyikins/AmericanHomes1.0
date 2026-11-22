'use client';

import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matching options found',
  disabled = false,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel ?? ''} ${o.searchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery('');
    }
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        style={{
          width: '100%',
          minHeight: 40,
          padding: '8px 12px',
          border: '0.8px solid var(--line)',
          borderRadius: 4,
          background: disabled ? '#f8fafc' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          fontSize: 13,
          color: selected ? 'var(--ink)' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} color="var(--muted)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#fff',
            border: '0.8px solid var(--line)',
            borderRadius: 6,
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderBottom: '0.8px solid var(--line)',
              background: '#f8fafc',
            }}
          >
            <Search size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: 'transparent',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 2,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ maxHeight: 230, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      border: 0,
                      borderBottom: '0.8px solid var(--line)',
                      background: active ? '#edf7f1' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        color: active ? 'var(--green)' : 'var(--ink)',
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{opt.sublabel}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
