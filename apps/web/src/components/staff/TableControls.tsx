'use client';

import type {
  FilterCategoryOption,
  FilterValueMap,
  SortState,
} from '@/lib/tableUtils';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface HierarchicalFilterDropdownProps {
  categories: FilterCategoryOption[];
  selected: FilterValueMap;
  onChange: (next: FilterValueMap) => void;
  label?: string;
}

export function HierarchicalFilterDropdown({
  categories,
  selected,
  onChange,
  label = 'Filters',
}: HierarchicalFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [flipLeft, setFlipLeft] = useState(false);
  const [mobileLeft, setMobileLeft] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const totalSelected = Object.values(selected).reduce((sum, list) => sum + list.length, 0);

  useEffect(() => {
    if (!open) {
      setActiveCategoryKey(null);
      return;
    }
    const checkFlip = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      if (window.innerWidth <= 720) {
        const popW = Math.min(280, window.innerWidth - 32);
        const clampedViewportLeft = Math.max(
          16,
          Math.min(rect.right - popW, window.innerWidth - 16 - popW),
        );
        setMobileLeft(clampedViewportLeft - rect.left);
        setFlipLeft(false);
      } else {
        setMobileLeft(null);
        // If less than 460px space on the right, flip submenu left so it never clips
        setFlipLeft(window.innerWidth - rect.left < 460);
      }
    };
    checkFlip();

    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeCategoryKey) {
          setActiveCategoryKey(null);
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', checkFlip);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', checkFlip);
    };
  }, [open, activeCategoryKey]);

  const activeCategory = categories.find((c) => c.key === activeCategoryKey) ?? null;

  const toggleValue = (catKey: string, val: string) => {
    const current = selected[catKey] ?? [];
    const nextList = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    const nextMap = { ...selected };
    if (nextList.length === 0) {
      delete nextMap[catKey];
    } else {
      nextMap[catKey] = nextList;
    }
    onChange(nextMap);
  };

  const clearCategory = (catKey: string) => {
    const nextMap = { ...selected };
    delete nextMap[catKey];
    onChange(nextMap);
  };

  const clearAll = () => {
    onChange({});
    setActiveCategoryKey(null);
  };

  return (
    <div className="hf-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`staff-filter-btn${totalSelected > 0 ? ' active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Filter size={14} color={totalSelected > 0 ? 'var(--green)' : 'var(--muted)'} />
        <span>{label}</span>
        {totalSelected > 0 && <span className="hf-badge">{totalSelected}</span>}
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
        <div
          className={`hf-popover${flipLeft ? ' flip-left' : ''}`}
          style={mobileLeft !== null ? { left: mobileLeft, right: 'auto' } : undefined}
          role="menu"
          aria-label="Filter columns"
        >
          <div className="hf-menu">
            <div className="hf-menu-head">
              <span>Filter by column</span>
              {totalSelected > 0 && (
                <button type="button" className="hf-clear-btn" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>

            {categories.map((cat) => {
              const count = selected[cat.key]?.length ?? 0;
              const isActive = activeCategoryKey === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={isActive}
                  className={`hf-cat-btn${isActive ? ' active' : ''}`}
                  onClick={() =>
                    setActiveCategoryKey((prev) => (prev === cat.key ? null : cat.key))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setActiveCategoryKey(cat.key);
                    }
                  }}
                >
                  <span className="hf-cat-label">
                    {cat.label}
                    {count > 0 && <span className="hf-cat-count">{count}</span>}
                  </span>
                  <ChevronRight size={14} color="var(--muted)" />
                </button>
              );
            })}
          </div>

          {activeCategory && (
            <div
              className="hf-submenu"
              role="menu"
              aria-label={`${activeCategory.label} options`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setActiveCategoryKey(null);
                }
              }}
            >
              <div className="hf-menu-head">
                <span>{activeCategory.label}</span>
                {(selected[activeCategory.key]?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    className="hf-clear-btn"
                    onClick={() => clearCategory(activeCategory.key)}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="hf-options-scroll">
                {activeCategory.values.length === 0 ? (
                  <div className="hf-empty">No values available</div>
                ) : (
                  activeCategory.values.map((val) => {
                    const checked = (selected[activeCategory.key] ?? []).includes(val);
                    return (
                      <label key={val} className={`hf-option${checked ? ' checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(activeCategory.key, val)}
                          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                        />
                        <span className={`hf-checkbox${checked ? ' checked' : ''}`} aria-hidden="true">
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="hf-option-text">{val}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActiveFilterChipsProps {
  categories: FilterCategoryOption[];
  selected: FilterValueMap;
  onChange: (next: FilterValueMap) => void;
}

export function ActiveFilterChips({
  categories,
  selected,
  onChange,
}: ActiveFilterChipsProps) {
  const entries = Object.entries(selected).filter(([, vals]) => vals.length > 0);
  if (entries.length === 0) return null;

  const labelMap = new Map(categories.map((c) => [c.key, c.label]));

  const removeOne = (key: string, val: string) => {
    const nextList = (selected[key] ?? []).filter((v) => v !== val);
    const nextMap = { ...selected };
    if (nextList.length === 0) delete nextMap[key];
    else nextMap[key] = nextList;
    onChange(nextMap);
  };

  return (
    <div className="hf-chip-bar" aria-label="Active filters">
      {entries.flatMap(([key, vals]) =>
        vals.map((val) => (
          <span key={`${key}:${val}`} className="hf-chip">
            <span className="hf-chip-cat">{labelMap.get(key) ?? key}:</span>
            <strong>{val}</strong>
            <button
              type="button"
              aria-label={`Remove ${labelMap.get(key) ?? key} filter ${val}`}
              onClick={() => removeOne(key, val)}
            >
              <X size={12} />
            </button>
          </span>
        )),
      )}
      <button type="button" className="hf-clear-all-chip" onClick={() => onChange({})}>
        Clear all
      </button>
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}

export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: SortableHeaderProps) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;

  return (
    <button
      type="button"
      className={`staff-sort-th${active ? ' active' : ''}`}
      style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
      aria-sort={
        direction === 'asc'
          ? 'ascending'
          : direction === 'desc'
            ? 'descending'
            : 'none'
      }
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      {direction === 'asc' ? (
        <ArrowUp size={13} strokeWidth={2.3} />
      ) : direction === 'desc' ? (
        <ArrowDown size={13} strokeWidth={2.3} />
      ) : (
        <ArrowUpDown size={12} opacity={0.45} />
      )}
    </button>
  );
}
