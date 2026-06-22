import { useMemo, useState } from 'react';
import type { Client, Invoice, Payment, CreditNote } from '../../../types';
import { fmtINR } from '../../../utils';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';

interface ClientRow extends Client {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
}

interface Props {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
}

export function ClientsTab({ clients, invoices, payments, creditNotes }: Props) {
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const rows: ClientRow[] = useMemo(() => {
    return clients.map(client => {
      const cid = String(client.id);
      const clientInvoices = invoices.filter(i => String(i.clientId || i.client_id) === cid);
      const totalInvoiced = clientInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const invoiceIds = new Set(clientInvoices.map(i => i.id));
      const totalPaid = payments
        .filter(p => invoiceIds.has(p.invoiceId || p.invoice_id || ''))
        .reduce((s, p) => s + (p.amount || 0), 0);
      const totalCredited = creditNotes
        .filter(c => invoiceIds.has(c.invoiceId || c.invoice_id || ''))
        .reduce((s, c) => s + (c.amount || 0), 0);
      const outstanding = Math.max(0, totalInvoiced - totalPaid - totalCredited);
      return { ...client, totalInvoiced, totalPaid, outstanding, invoiceCount: clientInvoices.length };
    });
  }, [clients, invoices, payments, creditNotes]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'name') { av = a.name || ''; bv = b.name || ''; }
      else if (sortBy === 'invoiced') { av = a.totalInvoiced; bv = b.totalInvoiced; }
      else if (sortBy === 'outstanding') { av = a.outstanding; bv = b.outstanding; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, search, sortBy, sortDir]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + r.totalInvoiced, 0), [rows]);
  const totalOutstanding = useMemo(() => rows.reduce((s, r) => s + r.outstanding, 0), [rows]);

  const columns: Column[] = [
    {
      key: 'name', header: 'Client', sortKey: 'name',
      render: r => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          {r.gstin && <div style={{ fontSize: 11, color: 'var(--bl-text-soft)', marginTop: 2 }}>{r.gstin}</div>}
        </div>
      ),
    },
    {
      key: 'contact', header: 'Contact', mobileHide: true,
      render: r => (
        <div style={{ fontSize: 12 }}>
          {r.phone && <div className="bl-td-soft">{r.phone}</div>}
          {r.email && <div className="bl-td-soft">{r.email}</div>}
        </div>
      ),
    },
    {
      key: 'invoices', header: 'Invoices', align: 'right',
      render: r => <span className="bl-td-soft">{r.invoiceCount}</span>,
    },
    {
      key: 'invoiced', header: 'Total Invoiced', sortKey: 'invoiced', align: 'right',
      render: r => <span className="bl-td-bold">{fmtINR(r.totalInvoiced)}</span>,
    },
    {
      key: 'paid', header: 'Paid', align: 'right', mobileHide: true,
      render: r => <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmtINR(r.totalPaid)}</span>,
    },
    {
      key: 'outstanding', header: 'Outstanding', sortKey: 'outstanding', align: 'right',
      render: r => (
        <span style={{ color: r.outstanding > 0 ? '#fb923c' : 'var(--bl-text-soft)', fontWeight: r.outstanding > 0 ? 700 : 400 }}>
          {r.outstanding > 0 ? fmtINR(r.outstanding) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Clients</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{clients.length}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(255,107,53,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total Revenue</div>
            <div className="bl-kpi-value" style={{ color: 'var(--accent)' }}>{fmtINR(totalRevenue)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Outstanding</div>
            <div className="bl-kpi-value" style={{ color: '#fb923c' }}>{fmtINR(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <h3 className="bl-section-title">Client Balances <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--bl-text-soft)' }}>({clients.length})</span></h3>
          <div className="bl-search-wrap" style={{ maxWidth: 240 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              className="bl-search"
              placeholder="Search clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          emptyTitle="No clients found"
          emptySubtitle="Add clients to track their billing balances."
        />
      </div>
    </div>
  );
}
