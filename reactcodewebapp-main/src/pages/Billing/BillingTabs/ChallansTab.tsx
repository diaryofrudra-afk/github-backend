import { useMemo, useState } from 'react';
import type { Challan, Client } from '../../../types';
import { fmtDate } from '../../../utils';
import { StatusBadge } from '../shared/StatusBadge';
import { DocumentFilters, defaultFilters, hasActiveFilters } from '../shared/DocumentFilters';
import type { FilterState } from '../shared/DocumentFilters';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';
import { DocumentActions } from '../shared/DocumentActions';

const STATUS_OPTS = [
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'received', label: 'Received' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Props {
  challans: Challan[];
  clients: Client[];
  onDelete: (id: string) => void;
}

function clientName(id: string, clients: Client[]) {
  return clients.find(c => String(c.id) === String(id))?.name || id || '—';
}

export function ChallansTab({ challans, clients, onDelete }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const dispatched = useMemo(() => challans.filter(c => c.status === 'dispatched').length, [challans]);

  const filtered = useMemo(() => {
    let rows = [...challans];
    const q = filters.search.toLowerCase();
    if (q) rows = rows.filter(c =>
      c.number?.toLowerCase().includes(q) ||
      clientName(c.clientId || c.client_id || '', clients).toLowerCase().includes(q) ||
      (c.assetReg || c.asset_reg || '').toLowerCase().includes(q)
    );
    if (filters.status) rows = rows.filter(c => c.status === filters.status);
    if (filters.clientId) rows = rows.filter(c => (c.clientId || c.client_id) === filters.clientId);
    if (filters.dateFrom) rows = rows.filter(c => c.date >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(c => c.date <= filters.dateTo);

    rows.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'number') { av = a.number || ''; bv = b.number || ''; }
      else if (sortBy === 'date') { av = a.date || ''; bv = b.date || ''; }
      else if (sortBy === 'status') { av = a.status || ''; bv = b.status || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [challans, filters, sortBy, sortDir, clients]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'Challan #', sortKey: 'number',
      render: r => <span className="bl-td-mono bl-td-bold">{r.number}</span>,
    },
    {
      key: 'date', header: 'Date', sortKey: 'date',
      render: r => <span className="bl-td-soft">{fmtDate(r.date)}</span>,
    },
    {
      key: 'client', header: 'Client',
      render: r => clientName(r.clientId || r.client_id, clients),
    },
    {
      key: 'asset', header: 'Asset', mobileHide: true,
      render: r => <span className="bl-td-soft">{r.assetReg || r.asset_reg || '—'}</span>,
    },
    {
      key: 'site', header: 'Site', mobileHide: true,
      render: r => <span className="bl-td-soft">{r.site || '—'}</span>,
    },
    {
      key: 'status', header: 'Status', sortKey: 'status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions', header: '',
      render: r => (
        <DocumentActions actions={[
          { label: 'Delete', danger: true, onClick: () => { if (confirm(`Delete challan ${r.number}?`)) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Challans</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{challans.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Dispatched</div>
            <div className="bl-kpi-value" style={{ color: '#fb923c' }}>{dispatched}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">
            Challans{' '}
            {hasActiveFilters(filters)
              ? <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({filtered.length} results)</span>
              : <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({challans.length})</span>
            }
          </h3>
        </div>
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          clients={clients}
          statusOptions={STATUS_OPTS}
          placeholder="Search by number, client, or asset…"
        />
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          emptyTitle="No challans yet"
          emptySubtitle="Delivery challans will appear here once created."
        />
      </div>
    </div>
  );
}
