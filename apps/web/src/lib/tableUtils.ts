export type SortDirection = 'asc' | 'desc';

export type SortState = {
  key: string;
  direction: SortDirection;
} | null;

export type SortDataType = 'string' | 'number' | 'date' | 'currency' | 'status';

export type FilterValueMap = Record<string, string[]>;

export interface FilterCategoryDef<T> {
  key: string;
  label: string;
  accessor: (row: T) => string | null | undefined;
  emptyLabel?: string;
  statusOrder?: string[];
}

export interface FilterCategoryOption {
  key: string;
  label: string;
  values: string[];
}

export interface SortColumnDef<T> {
  key: string;
  type: SortDataType;
  accessor: (row: T) => string | number | Date | null | undefined;
  statusOrder?: string[];
}

export function cycleSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) {
    return { key, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { key, direction: 'desc' };
  }
  return null;
}

export function deriveFilterCategories<T>(
  rows: T[],
  defs: FilterCategoryDef<T>[],
): FilterCategoryOption[] {
  return defs.map((def) => {
    const emptyLabel = def.emptyLabel ?? 'Unspecified';
    const seen = new Set<string>();
    let hasEmpty = false;

    for (const row of rows) {
      const raw = def.accessor(row);
      const val = raw === null || raw === undefined ? '' : String(raw).trim();
      if (!val) {
        hasEmpty = true;
      } else {
        seen.add(val);
      }
    }

    const values = Array.from(seen).sort((a, b) => {
      if (def.statusOrder) {
        const ia = def.statusOrder.indexOf(a);
        const ib = def.statusOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
      }
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    if (hasEmpty) {
      values.push(emptyLabel);
    }

    return {
      key: def.key,
      label: def.label,
      values,
    };
  });
}

export function parseCurrencyValue(raw: string | number | Date | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseDateValue(raw: string | number | Date | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const str = String(raw).trim();
  if (!str || str === 'TBD' || str === '—' || str === 'Pending') return null;

  // Handle DD/MM/YYYY or D MMM YYYY formats cleanly
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const t = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    if (Number.isFinite(t)) return t;
  }

  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyFiltersAndSort<T>(
  rows: T[],
  filters: FilterValueMap,
  filterDefs: FilterCategoryDef<T>[],
  sort: SortState,
  sortDefs: SortColumnDef<T>[],
): T[] {
  const activeEntries = Object.entries(filters).filter(([, vals]) => vals.length > 0);

  let result = rows;
  if (activeEntries.length > 0) {
    const defMap = new Map(filterDefs.map((d) => [d.key, d]));
    result = rows.filter((row) =>
      activeEntries.every(([key, selected]) => {
        const def = defMap.get(key);
        if (!def) return true;
        const emptyLabel = def.emptyLabel ?? 'Unspecified';
        const raw = def.accessor(row);
        const val = raw === null || raw === undefined ? '' : String(raw).trim();
        const normalized = val || emptyLabel;
        return selected.includes(normalized);
      }),
    );
  }

  if (!sort) {
    return result;
  }

  const sortDef = sortDefs.find((d) => d.key === sort.key);
  if (!sortDef) {
    return result;
  }

  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...result].sort((a, b) => {
    const rawA = sortDef.accessor(a);
    const rawB = sortDef.accessor(b);

    const emptyA = rawA === null || rawA === undefined || String(rawA).trim() === '';
    const emptyB = rawB === null || rawB === undefined || String(rawB).trim() === '';
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1; // always push missing values last
    if (emptyB) return -1;

    if (sortDef.type === 'number') {
      const na = Number(rawA);
      const nb = Number(rawB);
      const va = Number.isFinite(na) ? na : 0;
      const vb = Number.isFinite(nb) ? nb : 0;
      return (va - vb) * dir;
    }

    if (sortDef.type === 'currency') {
      const ca = parseCurrencyValue(rawA);
      const cb = parseCurrencyValue(rawB);
      if (ca === null && cb === null) return 0;
      if (ca === null) return 1;
      if (cb === null) return -1;
      return (ca - cb) * dir;
    }

    if (sortDef.type === 'date') {
      const da = parseDateValue(rawA);
      const db = parseDateValue(rawB);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * dir;
    }

    if (sortDef.type === 'status' && sortDef.statusOrder) {
      const sa = String(rawA).trim();
      const sb = String(rawB).trim();
      const ia = sortDef.statusOrder.indexOf(sa);
      const ib = sortDef.statusOrder.indexOf(sb);
      if (ia !== -1 && ib !== -1) return (ia - ib) * dir;
      if (ia !== -1) return -1 * dir;
      if (ib !== -1) return 1 * dir;
      return sa.localeCompare(sb, undefined, { sensitivity: 'base' }) * dir;
    }

    return (
      String(rawA)
        .trim()
        .localeCompare(String(rawB).trim(), undefined, { numeric: true, sensitivity: 'base' }) *
      dir
    );
  });
}
