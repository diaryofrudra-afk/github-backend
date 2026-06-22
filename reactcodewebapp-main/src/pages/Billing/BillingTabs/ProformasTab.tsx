import { useMemo, useState } from 'react';
import type { Client, Proforma } from '../../../types';
import { fmtINR, fmtDate } from '../../../utils';
import { StatusBadge } from '../shared/StatusBadge';
import { DocumentFilters, defaultFilters, hasActiveFilters } from '../shared/DocumentFilters';
import type { FilterState } from '../shared/DocumentFilters';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';
import { DocumentActions } from '../shared/DocumentActions';

interface Props {
  proformas: Proforma[];
  clients: Client[];
  onDelete: (id: string) => void;
}

function clientName(id: string, clients: Client[]) {
  return clients.find(c => String(c.id) === String(id))?.name || id || '—';
}

export function ProformasTab({ proformas, clients, onDelete }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalValue = useMemo(() => proformas.reduce((s, p) => s + (p.total || 0), 0), [proformas]);

  const filtered = useMemo(() => {
    let rows = [...proformas];
    const q = filters.search.toLowerCase();
    if (q) rows = rows.filter(p =>
      p.number?.toLowerCase().includes(q) ||
      clientName(p.clientId || p.client_id || '', clients).toLowerCase().includes(q)
    );
    if (filters.status) rows = rows.filter(p => p.status === filters.status);
    if (filters.clientId) rows = rows.filter(p => (p.clientId || p.client_id) === filters.clientId);
    if (filters.dateFrom) rows = rows.filter(p => p.date >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(p => p.date <= filters.dateTo);

    rows.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'number') { av = a.number || ''; bv = b.number || ''; }
      else if (sortBy === 'date') { av = a.date || ''; bv = b.date || ''; }
      else if (sortBy === 'total') { av = a.total || 0; bv = b.total || 0; }
      else if (sortBy === 'status') { av = a.status || ''; bv = b.status || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [proformas, filters, sortBy, sortDir, clients]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'Proforma #', sortKey: 'number',
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
      key: 'total', header: 'Amount', sortKey: 'total', align: 'right',
      render: r => <span className="bl-td-bold">{fmtINR(r.total)}</span>,
    },
    {
      key: 'status', header: 'Status', sortKey: 'status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions', header: '',
      render: r => (
        <DocumentActions actions={[
          { label: 'Delete', danger: true, onClick: () => { if (confirm(`Delete proforma ${r.number}?`)) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Proformas</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{proformas.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(255,107,53,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Value</div>
            <div className="bl-kpi-value" style={{ color: 'var(--accent)' }}>{fmtINR(totalValue)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">
            Proformas{' '}
            {hasActiveFilters(filters)
              ? <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({filtered.length} results)</span>
              : <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({proformas.length})</span>
            }
          </h3>
        </div>
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          clients={clients}
          placeholder="Search by number or client…"
        />
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          emptyTitle="No proformas yet"
          emptySubtitle="Proforma invoices will appear here once created."
        />
      </div>
    </div>
  );
}
