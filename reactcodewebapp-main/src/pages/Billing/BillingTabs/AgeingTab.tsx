import { useMemo, useState } from 'react';
import type { Client, Invoice, Payment, CreditNote } from '../../../types';
import { fmtINR, fmtDate } from '../../../utils';
import { DocumentListView } from '../shared/DocumentListView';
import type { Column } from '../shared/DocumentListView';

interface AgeingRow {
  id: string;
  number: string;
  clientName: string;
  total: number;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+' | 'current';
}

interface Props {
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  clients: Client[];
  onViewInvoice: (id: string) => void;
}

function clientName(id: string, clients: Client[]) {
  return clients.find(c => String(c.id) === String(id))?.name || id || '—';
}

export function AgeingTab({ invoices, payments, creditNotes, clients, onViewInvoice }: Props) {
  const [sortBy, setSortBy] = useState('daysOverdue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [bucketFilter, setBucketFilter] = useState<string>('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: AgeingRow[] = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'paid' && (inv.status as string) !== 'cancelled')
      .map(inv => {
        const invPayments = payments.filter(p => (p.invoiceId || p.invoice_id) === inv.id);
        const invCredits = creditNotes.filter(c => (c.invoiceId || c.invoice_id) === inv.id);
        const totalPaid = invPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalCredited = invCredits.reduce((s, c) => s + (c.amount || 0), 0);
        const outstanding = Math.max(0, (inv.total || 0) - totalPaid - totalCredited);
        if (outstanding <= 0) return null;

        const due = inv.dueDate || inv.due_date;
        const dueDate = due ? new Date(due) : null;
        let daysOverdue = 0;
        let bucket: AgeingRow['bucket'] = 'current';
        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0);
          daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
          if (daysOverdue <= 0) bucket = 'current';
          else if (daysOverdue <= 30) bucket = '0-30';
          else if (daysOverdue <= 60) bucket = '31-60';
          else if (daysOverdue <= 90) bucket = '61-90';
          else bucket = '90+';
        }

        return {
          id: inv.id,
          number: inv.number,
          clientName: clientName(inv.clientId || inv.client_id || '', clients),
          total: inv.total || 0,
          outstanding,
          dueDate: due || '',
          daysOverdue: Math.max(0, daysOverdue),
          bucket,
        };
      })
      .filter(Boolean) as AgeingRow[];
  }, [invoices, payments, creditNotes, clients]);

  const bands = useMemo(() => {
    const current = rows.filter(r => r.bucket === 'current');
    const b30 = rows.filter(r => r.bucket === '0-30');
    const b60 = rows.filter(r => r.bucket === '31-60');
    const b90 = rows.filter(r => r.bucket === '61-90');
    const b90plus = rows.filter(r => r.bucket === '90+');
    return {
      current: { count: current.length, amount: current.reduce((s, r) => s + r.outstanding, 0) },
      '0-30': { count: b30.length, amount: b30.reduce((s, r) => s + r.outstanding, 0) },
      '31-60': { count: b60.length, amount: b60.reduce((s, r) => s + r.outstanding, 0) },
      '61-90': { count: b90.length, amount: b90.reduce((s, r) => s + r.outstanding, 0) },
      '90+': { count: b90plus.length, amount: b90plus.reduce((s, r) => s + r.outstanding, 0) },
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = bucketFilter ? rows.filter(r => r.bucket === bucketFilter) : rows;
    list = [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortBy === 'number') { av = a.number; bv = b.number; }
      else if (sortBy === 'client') { av = a.clientName; bv = b.clientName; }
      else if (sortBy === 'outstanding') { av = a.outstanding; bv = b.outstanding; }
      else if (sortBy === 'daysOverdue') { av = a.daysOverdue; bv = b.daysOverdue; }
      else if (sortBy === 'dueDate') { av = a.dueDate; bv = b.dueDate; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, bucketFilter, sortBy, sortDir]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  const BUCKET_COLORS: Record<string, string> = {
    current: '#22c55e',
    '0-30': '#fb923c',
    '31-60': '#f59e0b',
    '61-90': '#ef4444',
    '90+': '#7f1d1d',
  };

  const columns: Column[] = [
    {
      key: 'number', header: 'Invoice #', sortKey: 'number',
      render: r => <span className="bl-td-mono bl-td-bold">{r.number}</span>,
    },
    {
      key: 'client', header: 'Client', sortKey: 'client',
      render: r => r.clientName,
    },
    {
      key: 'outstanding', header: 'Outstanding', sortKey: 'outstanding', align: 'right',
      render: r => <span className="bl-td-bold" style={{ color: '#fb923c' }}>{fmtINR(r.outstanding)}</span>,
    },
    {
      key: 'dueDate', header: 'Due Date', sortKey: 'dueDate', mobileHide: true,
      render: r => <span className="bl-td-soft">{fmtDate(r.dueDate)}</span>,
    },
    {
      key: 'daysOverdue', header: 'Days Overdue', sortKey: 'daysOverdue',
      render: r => {
        if (r.bucket === 'current') return <span className="bl-td-soft">Current</span>;
        return <span style={{ color: BUCKET_COLORS[r.bucket], fontWeight: 700 }}>{r.daysOverdue}d</span>;
      },
    },
    {
      key: 'bucket', header: 'Bucket',
      render: r => {
        const color = BUCKET_COLORS[r.bucket];
        const labels: Record<string, string> = { current: 'Current', '0-30': '0–30 days', '31-60': '31–60 days', '61-90': '61–90 days', '90+': '90+ days' };
        return (
          <span style={{ color, fontWeight: 700, fontSize: 12 }}>{labels[r.bucket]}</span>
        );
      },
    },
  ];

  return (
    <div>
      {/* Aging bands */}
      <div className="bl-aging-bands" style={{ marginBottom: 20 }}>
        {[
          { key: 'current', label: 'Current', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
          { key: '0-30', label: '1–30 Days', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
          { key: '31-60', label: '31–60 Days', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { key: '61-90', label: '61–90 Days', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { key: '90+', label: '90+ Days', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
        ].map(band => {
          const data = bands[band.key as keyof typeof bands];
          const isActive = bucketFilter === band.key;
          return (
            <div
              key={band.key}
              className="bl-aging-band"
              style={{
                background: band.bg,
                cursor: 'pointer',
                outline: isActive ? `2px solid ${band.color}` : 'none',
                outlineOffset: 2,
              }}
              onClick={() => setBucketFilter(bucketFilter === band.key ? '' : band.key)}
            >
              <div className="bl-aging-band-label">{band.label}</div>
              <div className="bl-aging-band-value" style={{ color: band.color }}>{fmtINR(data.amount)}</div>
              <div className="bl-aging-band-count">{data.count} invoice{data.count !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="bl-card">
        <div className="bl-section-row">
          <div>
            <h3 className="bl-section-title" style={{ marginBottom: 2 }}>
              {bucketFilter ? `${['current','0-30','31-60','61-90','90+'].includes(bucketFilter) ? { current: 'Current', '0-30': '1–30 Days', '31-60': '31–60 Days', '61-90': '61–90 Days', '90+': '90+ Days' }[bucketFilter as 'current'|'0-30'|'31-60'|'61-90'|'90+'] : bucketFilter} Overdue` : 'All Outstanding'}
            </h3>
            <div style={{ fontSize: 13, color: 'var(--bl-text-soft)' }}>
              {filtered.length} invoices · {fmtINR(totalOutstanding)} total
            </div>
          </div>
          {bucketFilter && (
            <button className="bl-clear-btn" onClick={() => setBucketFilter('')}>Show All</button>
          )}
        </div>
        <DocumentListView
          rows={filtered}
          columns={columns}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={r => onViewInvoice(r.id)}
          emptyTitle="No outstanding invoices"
          emptySubtitle="All invoices have been paid. Great work!"
        />
      </div>
    </div>
  );
}
