import { useRef, useState } from 'react';
import type { Client } from '../../../types';
import { DateRangePicker } from './DateRangePicker';
import { Popover } from './Popover';

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

interface Option {
  value: string;
  label: string;
}

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** Compact toggle dropdown — replaces the bulky native <select> for status/client. */
function CompactDropdown({ label, value, options, onSelect }: {
  label: string;
  value: string;
  options: Option[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const active = options.find(o => o.value === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`bl-compact-dd ${active ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{active ? active.label : label}</span>
        <Chevron />
      </button>
      <Popover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} className="bl-compact-menu">
        <button
          type="button"
          className={`bl-compact-item ${!value ? 'sel' : ''}`}
          onClick={() => { onSelect(''); setOpen(false); }}
        >
          {label}
        </button>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`bl-compact-item ${value === o.value ? 'sel' : ''}`}
            onClick={() => { onSelect(o.value); setOpen(false); }}
          >
            {o.label}
          </button>
        ))}
      </Popover>
    </>
  );
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  clients?: Client[];
  statusOptions?: Option[];
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
  const clientOpts: Option[] = clients.map(c => ({ value: String(c.id), label: c.name }));

  return (
    <div className="bl-inv-filters">
      <div className="bl-search-wrap bl-inv-search">
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
        <CompactDropdown
          label="All Status"
          value={filters.status}
          options={statusOptions}
          onSelect={v => update({ status: v })}
        />
      )}

      {showClientFilter && clientOpts.length > 0 && (
        <CompactDropdown
          label="All Clients"
          value={filters.clientId}
          options={clientOpts}
          onSelect={v => update({ clientId: v })}
        />
      )}

      <DateRangePicker
        from={filters.dateFrom}
        to={filters.dateTo}
        onChange={(f, t) => update({ dateFrom: f, dateTo: t })}
      />

      {hasActiveFilters(filters) && (
        <button className="bl-clear-btn" onClick={() => onChange(defaultFilters())}>
          Clear
        </button>
      )}
    </div>
  );
}
