import { useMemo, useState } from 'react';
import type { Client, Invoice, Payment, CreditNote } from '../../../types';
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
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

interface Props {
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  clients: Client[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function clientName(id: string, clients: Client[]) {
  return clients.find(c => String(c.id) === String(id))?.name || id || '—';
}

function isOverdue(inv: Invoice): boolean {
  const due = inv.dueDate || inv.due_date;
  if (!due) return false;
  return inv.status !== 'paid' && new Date(due) < new Date();
}

export function InvoicesTab({ invoices, payments, creditNotes, clients, onNew, onEdit, onDelete }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + (i.total || 0), 0), [invoices]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments]);
  const totalCredited = useMemo(() => creditNotes.reduce((s, c) => s + (c.amount || 0), 0), [creditNotes]);
  const totalGST = useMemo(() => invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0), [invoices]);

  const filtered = useMemo(() => {
    let rows = [...invoices];
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
      else if (sortBy === 'due') { av = a.dueDate || a.due_date || ''; bv = b.dueDate || b.due_date || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [invoices, filters, sortBy, sortDir, clients]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'Invoice #', sortKey: 'number',
      render: r => <span className="bl-td-mono bl-td-bold">{r.number}</span>,
    },
    {
      key: 'date', header: 'Date', sortKey: 'date',
      render: r => <span className="bl-td-soft">{fmtDate(r.date)}</span>,
    },
    {
      key: 'client', header: 'Client', sortKey: 'client',
      render: r => clientName(r.clientId || r.client_id, clients),
    },
    {
      key: 'total', header: 'Amount', sortKey: 'total', align: 'right',
      render: r => <span className="bl-td-bold">{fmtINR(r.total)}</span>,
    },
    {
      key: 'status', header: 'Status', sortKey: 'status',
      render: r => {
        const status = isOverdue(r) && r.status !== 'paid' ? 'overdue' : r.status;
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'due', header: 'Due Date', sortKey: 'due',
      render: r => {
        const due = r.dueDate || r.due_date;
        const overdue = isOverdue(r);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <span style={{ color: overdue ? '#ef4444' : undefined }}>{fmtDate(due)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const token = getToken();
                const base = import.meta.env.VITE_API_BASE || '/api';
                const apiBase = base.endsWith('/') ? base.slice(0, -1) : base;
                const url = `${apiBase}/invoices/${r.id}/pdf` + (token ? `?token=${encodeURIComponent(token)}` : '');
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
          {
            label: 'Download PDF',
            onClick: () => {
              const token = getToken();
              const base = import.meta.env.VITE_API_BASE || '/api';
              const apiBase = base.endsWith('/') ? base.slice(0, -1) : base;
              const url = `${apiBase}/invoices/${r.id}/pdf` + (token ? `?token=${encodeURIComponent(token)}` : '');
              window.open(url, '_blank');
            }
          },
          { label: 'Delete', danger: true, onClick: () => { if (confirm(`Delete invoice ${r.number}?`)) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      {/* KPI row */}
      <div className="bl-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(255,107,53,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Invoiced</div>
            <div className="bl-kpi-value" style={{ color: 'var(--accent)' }}>{fmtINR(totalInvoiced)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Outstanding</div>
            <div className="bl-kpi-value" style={{ color: '#fb923c' }}>{fmtINR(Math.max(0, totalInvoiced - totalPaid - totalCredited))}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Collected</div>
            <div className="bl-kpi-value" style={{ color: '#22c55e' }}>{fmtINR(totalPaid)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">GST Liability</div>
            <div className="bl-kpi-value" style={{ color: '#a855f7' }}>{fmtINR(totalGST)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">
            Invoices{' '}
            {hasActiveFilters(filters)
              ? <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({filtered.length} results)</span>
              : <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({invoices.length})</span>
            }
          </h3>
          <button className="btn-sm accent" onClick={onNew} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Invoice
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
          emptyTitle="No invoices yet"
          emptySubtitle="Create your first invoice to start tracking revenue."
          emptyAction={
            <button className="btn-sm accent" onClick={onNew} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, marginTop: 4 }}>
              New Invoice
            </button>
          }
        />
      </div>
    </div>
  );
}
