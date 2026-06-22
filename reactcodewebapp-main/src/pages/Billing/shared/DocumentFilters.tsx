import type { Client } from '../../../types';

export interface FilterState {
  search: string;
  status: string;
  clientId: string;
  dateFrom: string;
  dateTo: string;
}

export const defaultFilters = (): FilterState => ({
  search: '',
  status: '',
  clientId: '',
  dateFrom: '',
  dateTo: '',
});

export function hasActiveFilters(f: FilterState): boolean {
  return !!(f.search || f.status || f.clientId || f.dateFrom || f.dateTo);
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  clients?: Client[];
  statusOptions?: Array<{ value: string; label: string }>;
  placeholder?: string;
  showClientFilter?: boolean;
}

export function DocumentFilters({
  filters,
  onChange,
  clients = [],
  statusOptions = [],
  placeholder = 'Search…',
  showClientFilter = true,
}: Props) {
  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="bl-filters">
      <div className="bl-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="bl-search"
          placeholder={placeholder}
          value={filters.search}
          onChange={e => update({ search: e.target.value })}
        />
      </div>

      {statusOptions.length > 0 && (
        <select
          className="bl-filter-select"
          value={filters.status}
          onChange={e => update({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {showClientFilter && clients.length > 0 && (
        <select
          className="bl-filter-select"
          value={filters.clientId}
          onChange={e => update({ clientId: e.target.value })}
        >
          <option value="">All clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <input
        type="date"
        className="bl-date-input"
        value={filters.dateFrom}
        onChange={e => update({ dateFrom: e.target.value })}
        title="From date"
      />
      <input
        type="date"
        className="bl-date-input"
        value={filters.dateTo}
        onChange={e => update({ dateTo: e.target.value })}
        title="To date"
      />

      {hasActiveFilters(filters) && (
        <button className="bl-clear-btn" onClick={() => onChange(defaultFilters())}>
          Clear
        </button>
      )}
    </div>
  );
}
