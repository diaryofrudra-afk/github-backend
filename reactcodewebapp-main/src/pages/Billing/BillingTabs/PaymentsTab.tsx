import { useMemo, useState } from 'react';
import type { Invoice, Payment } from '../../../types';
import { fmtINR, fmtDate } from '../../../utils';
import { DocumentFilters, defaultFilters } from '../shared/DocumentFilters';
import type { FilterState } from '../shared/DocumentFilters';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';
import { DocumentActions } from '../shared/DocumentActions';

interface Props {
  payments: Payment[];
  invoices: Invoice[];
  onDelete: (id: string) => void;
  onAddPayment: () => void;
}

function invoiceNumber(id: string, invoices: Invoice[]) {
  return invoices.find(i => i.id === id || String(i.id) === String(id))?.number || id || '—';
}

export function PaymentsTab({ payments, invoices, onDelete, onAddPayment }: Props) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalCollected = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments]);
  const avgPayment = payments.length > 0 ? totalCollected / payments.length : 0;

  const filtered = useMemo(() => {
    let rows = [...payments];
    const q = filters.search.toLowerCase();
    if (q) rows = rows.filter(p =>
      invoiceNumber(p.invoiceId || p.invoice_id || '', invoices).toLowerCase().includes(q) ||
      (p.method || '').toLowerCase().includes(q) ||
      (p.reference || '').toLowerCase().includes(q)
    );
    if (filters.dateFrom) rows = rows.filter(p => p.date >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(p => p.date <= filters.dateTo);

    rows.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'date') { av = a.date || ''; bv = b.date || ''; }
      else if (sortBy === 'amount') { av = a.amount || 0; bv = b.amount || 0; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [payments, filters, sortBy, sortDir, invoices]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const columns: Column[] = [
    {
      key: 'invoice', header: 'Invoice #',
      render: r => <span className="bl-td-mono">{invoiceNumber(r.invoiceId || r.invoice_id, invoices)}</span>,
    },
    {
      key: 'date', header: 'Date', sortKey: 'date',
      render: r => <span className="bl-td-soft">{fmtDate(r.date)}</span>,
    },
    {
      key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right',
      render: r => <span className="bl-td-bold" style={{ color: '#22c55e' }}>{fmtINR(r.amount)}</span>,
    },
    {
      key: 'method', header: 'Method', mobileHide: true,
      render: r => <span className="bl-td-soft" style={{ textTransform: 'capitalize' }}>{r.method || '—'}</span>,
    },
    {
      key: 'reference', header: 'Reference', mobileHide: true,
      render: r => <span className="bl-td-soft">{r.reference || '—'}</span>,
    },
    {
      key: 'actions', header: '',
      render: r => (
        <DocumentActions actions={[
          { label: 'Delete', danger: true, onClick: () => { if (confirm('Delete this payment record?')) onDelete(r.id); } },
        ]} />
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Collected</div>
            <div className="bl-kpi-value" style={{ color: '#22c55e' }}>{fmtINR(totalCollected)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Payments Count</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{payments.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(255,107,53,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Avg Payment</div>
            <div className="bl-kpi-value" style={{ color: 'var(--accent)' }}>{fmtINR(avgPayment)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">Payments <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({payments.length})</span></h3>
          <button className="btn-sm accent" onClick={onAddPayment} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Payment
          </button>
        </div>
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          showClientFilter={false}
          placeholder="Search by invoice # or method…"
        />
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          emptyTitle="No payments recorded"
          emptySubtitle="Record a payment against an invoice to track collections."
          emptyAction={
            <button className="btn-sm accent" onClick={onAddPayment} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontWeight: 700, marginTop: 4 }}>
              Add Payment
            </button>
          }
        />
      </div>
    </div>
  );
}
