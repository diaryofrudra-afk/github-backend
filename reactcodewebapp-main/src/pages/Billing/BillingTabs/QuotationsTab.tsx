import { useMemo, useState } from 'react';
import type { Client, Quotation } from '../../../types';
import { fmtINR, fmtDate } from '../../../utils';
import { StatusBadge } from '../shared/StatusBadge';
import { getToken } from '../../../services/api';
import { DocumentFilters, defaultFilters, hasActiveFilters } from '../shared/DocumentFilters';
import type { FilterState } from '../shared/DocumentFilters';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';
import { DocumentActions } from '../shared/DocumentActions';

const STATUS_OPTS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

interface Props {
  quotations: Quotation[];
  clients: Client[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
}

function clientName(id: string, clients: Client[]) {
  return clients.find(c => String(c.id) === String(id))?.name || id || '—';
}

export function QuotationsTab({ quotations, clients, onNew, onEdit, onDelete, onConvert }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const today = new Date().toISOString().slice(0, 10);
  const accepted = useMemo(() => quotations.filter(q => q.status === 'accepted').length, [quotations]);
  const active = useMemo(() => quotations.filter(q => {
    const v = q.validUntil || q.valid_until;
    return (q.status === 'draft' || q.status === 'sent') && (!v || v >= today);
  }).length, [quotations, today]);
  const conversionRate = quotations.length > 0 ? Math.round((accepted / quotations.length) * 100) : 0;

  const filtered = useMemo(() => {
    let rows = [...quotations];
    const q = filters.search.toLowerCase();
    if (q) rows = rows.filter(i =>
      i.number?.toLowerCase().includes(q) ||
      clientName(i.clientId || i.client_id || '', clients).toLowerCase().includes(q)
    );
    if (filters.status) rows = rows.filter(i => i.status === filters.status);
    if (filters.clientId) rows = rows.filter(i => (i.clientId || i.client_id) === filters.clientId);
    if (filters.dateFrom) rows = rows.filter(i => i.date >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(i => i.date <= filters.dateTo);

    rows.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'number') { av = a.number || ''; bv = b.number || ''; }
      else if (sortBy === 'date') { av = a.date || ''; bv = b.date || ''; }
      else if (sortBy === 'total') { av = a.total || 0; bv = b.total || 0; }
      else if (sortBy === 'status') { av = a.status || ''; bv = b.status || ''; }
      else if (sortBy === 'valid') { av = a.validUntil || a.valid_until || ''; bv = b.validUntil || b.valid_until || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [quotations, filters, sortBy, sortDir, clients]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'Quote #', sortKey: 'number',
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
      key: 'valid', header: 'Valid Until', sortKey: 'valid',
      render: r => {
        const v = r.validUntil || r.valid_until;
        const expired = v && v < today;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <span style={{ color: expired ? '#ef4444' : undefined }}>{fmtDate(v)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const token = getToken();
                const base = import.meta.env.VITE_API_BASE || '/api';
                const apiBase = base.endsWith('/') ? base.slice(0, -1) : base;
                const url = `${apiBase}/quotations/${r.id}/pdf` + (token ? `?token=${encodeURIComponent(token)}` : '');
                window.open(url, '_blank');
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              className="bl-download-btn-hover"
              title="Download PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        );
      },
    },
    {
      key: 'actions', header: '',
      render: r => (
        <DocumentActions actions={[
          { label: 'Edit', onClick: () => onEdit(r.id) },
          { label: 'Convert to Invoice', onClick: () => onConvert(r.id) },
          {
            label: 'Download PDF',
            onClick: () => {
              const token = getToken();
              const base = import.meta.env.VITE_API_BASE || '/api';
              const apiBase = base.endsWith('/') ? base.slice(0, -1) : base;
              const url = `${apiBase}/quotations/${r.id}/pdf` + (token ? `?token=${encodeURIComponent(token)}` : '');
              window.open(url, '_blank');
            }
          },
          { label: 'Delete', danger: true, onClick: () => { if (confirm(`Delete quotation ${r.number}?`)) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Estimates</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{quotations.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Accepted</div>
            <div className="bl-kpi-value" style={{ color: '#22c55e' }}>{accepted}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Active</div>
            <div className="bl-kpi-value" style={{ color: '#fb923c' }}>{active}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Conversion Rate</div>
            <div className="bl-kpi-value" style={{ color: '#a855f7' }}>{conversionRate}%</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">
            Estimates{' '}
            {hasActiveFilters(filters)
              ? <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({filtered.length} results)</span>
              : <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({quotations.length})</span>
            }
          </h3>
          <button className="btn-sm outline" onClick={onNew} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Estimate
          </button>
        </div>
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          clients={clients}
          statusOptions={STATUS_OPTS}
          placeholder="Search by number or client…"
        />
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={r => onEdit(r.id)}
          emptyTitle="No estimates yet"
          emptySubtitle="Create your first estimate to start quoting clients."
          emptyAction={
            <button className="btn-sm outline" onClick={onNew} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, marginTop: 4 }}>
              New Estimate
            </button>
          }
        />
      </div>
    </div>
  );
}
