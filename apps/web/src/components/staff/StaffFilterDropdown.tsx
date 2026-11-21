'use client';

import { Check, ChevronDown, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type StaffFilterDropdownProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
};

export function StaffFilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: StaffFilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isFiltered = value !== 'All';

  return (
    <div className="staff-filter-wrap" ref={wrapRef}>
      <button
        type="button"
        className="staff-filter-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Filter size={14} color="var(--muted)" />
        <span>{isFiltered ? `${label}: ${value}` : 'Filters'}</span>
        <ChevronDown
          size={14}
          color="var(--muted)"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {open && (
        <div className="staff-filter-menu" role="listbox" aria-label={label}>
          <div className="staff-filter-menu-label">{label}</div>
          {options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                className={`staff-filter-option${active ? ' active' : ''}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                <span>{opt}</span>
                {active && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
