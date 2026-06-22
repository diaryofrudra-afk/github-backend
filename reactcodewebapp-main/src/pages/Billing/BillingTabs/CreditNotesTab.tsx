import { useMemo, useState } from 'react';
import type { CreditNote, Invoice } from '../../../types';
import { fmtINR, fmtDate } from '../../../utils';
import { DocumentFilters, defaultFilters } from '../shared/DocumentFilters';
import type { FilterState } from '../shared/DocumentFilters';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';
import { DocumentActions } from '../shared/DocumentActions';

interface Props {
  creditNotes: CreditNote[];
  invoices: Invoice[];
  onDelete: (id: string) => void;
}

function invoiceNumber(id: string, invoices: Invoice[]) {
  return invoices.find(i => i.id === id || String(i.id) === String(id))?.number || id || '—';
}

export function CreditNotesTab({ creditNotes, invoices, onDelete }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalCredited = useMemo(() => creditNotes.reduce((s, c) => s + (c.amount || 0), 0), [creditNotes]);

  const filtered = useMemo(() => {
    let rows = [...creditNotes];
    const q = filters.search.toLowerCase();
    if (q) rows = rows.filter(c =>
      c.number?.toLowerCase().includes(q) ||
      invoiceNumber(c.invoiceId || c.invoice_id || '', invoices).toLowerCase().includes(q) ||
      (c.reason || '').toLowerCase().includes(q)
    );
    if (filters.dateFrom) rows = rows.filter(c => c.date >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(c => c.date <= filters.dateTo);

    rows.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'number') { av = a.number || ''; bv = b.number || ''; }
      else if (sortBy === 'date') { av = a.date || ''; bv = b.date || ''; }
      else if (sortBy === 'amount') { av = a.amount || 0; bv = b.amount || 0; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [creditNotes, filters, sortBy, sortDir, invoices]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'CN #', sortKey: 'number',
      render: r => <span className="bl-td-mono bl-td-bold">{r.number}</span>,
    },
    {
      key: 'date', header: 'Date', sortKey: 'date',
      render: r => <span className="bl-td-soft">{fmtDate(r.date)}</span>,
    },
    {
      key: 'invoice', header: 'Invoice #',
      render: r => <span className="bl-td-mono">{invoiceNumber(r.invoiceId || r.invoice_id, invoices)}</span>,
    },
    {
      key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right',
      render: r => <span className="bl-td-bold" style={{ color: '#ef4444' }}>−{fmtINR(r.amount)}</span>,
    },
    {
      key: 'reason', header: 'Reason', mobileHide: true,
      render: r => <span className="bl-td-soft">{r.reason || '—'}</span>,
    },
    {
      key: 'actions', header: '',
      render: r => (
        <DocumentActions actions={[
          { label: 'Delete', danger: true, onClick: () => { if (confirm(`Delete credit note ${r.number}?`)) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Credit Notes</div>
            <div className="bl-kpi-value" style={{ color: '#ef4444' }}>{creditNotes.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Credited</div>
            <div className="bl-kpi-value" style={{ color: '#ef4444' }}>−{fmtINR(totalCredited)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">Credit Notes <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({creditNotes.length})</span></h3>
        </div>
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          showClientFilter={false}
          placeholder="Search by CN # or invoice…"
        />
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          emptyTitle="No credit notes yet"
          emptySubtitle="Credit notes issued against invoices will appear here."
        />
      </div>
    </div>
  );
}
