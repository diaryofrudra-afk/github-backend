import { useMemo, useState } from 'react';
import type { Invoice } from '../../../types';
import { fmtINR } from '../../../utils';

interface Props {
  invoices: Invoice[];
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function GSTTab({ invoices }: Props) {
  const allMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(i => { if (i.date) set.add(i.date.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(allMonths[0] || currentMonth);

  const stats = useMemo(() => {
    const monthInvoices = invoices.filter(i => i.date?.startsWith(selectedMonth));
    const taxableValue = monthInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const cgst = monthInvoices.reduce((s, i) => s + (i.cgst || 0), 0);
    const sgst = monthInvoices.reduce((s, i) => s + (i.sgst || 0), 0);
    const totalGST = cgst + sgst;
    const totalSales = monthInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const invoiceCount = monthInvoices.length;
    return { taxableValue, cgst, sgst, totalGST, totalSales, invoiceCount };
  }, [invoices, selectedMonth]);

  const annualStats = useMemo(() => {
    const year = selectedMonth.slice(0, 4);
    const yearInvoices = invoices.filter(i => i.date?.startsWith(year));
    const cgst = yearInvoices.reduce((s, i) => s + (i.cgst || 0), 0);
    const sgst = yearInvoices.reduce((s, i) => s + (i.sgst || 0), 0);
    return { totalGST: cgst + sgst, invoiceCount: yearInvoices.length };
  }, [invoices, selectedMonth]);

  return (
    <div>
      <div className="bl-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Monthly Sales</div>
            <div className="bl-kpi-value" style={{ color: '#a855f7' }}>{fmtINR(stats.totalSales)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">CGST</div>
            <div className="bl-kpi-value" style={{ color: '#60a5fa' }}>{fmtINR(stats.cgst)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">SGST</div>
            <div className="bl-kpi-value" style={{ color: '#22c55e' }}>{fmtINR(stats.sgst)}</div>
          </div>
        </div>
        <div className="bl-kpi-card">
          <div className="bl-kpi-icon" style={{ background: 'rgba(255,107,53,0.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="bl-kpi-info">
            <div className="bl-kpi-label">Total GST Due</div>
            <div className="bl-kpi-value" style={{ color: 'var(--accent)' }}>{fmtINR(stats.totalGST)}</div>
          </div>
        </div>
      </div>

      <div className="bl-card">
        <div className="bl-gst-period">
          <label>Period: </label>
          <select
            className="bl-filter-select"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {allMonths.length === 0 && <option value={currentMonth}>{monthLabel(currentMonth)}</option>}
            {allMonths.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>

        <div className="bl-gst-summary">
          <div className="bl-gst-stat">
            <div className="bl-gst-stat-label">Invoices Filed</div>
            <div className="bl-gst-stat-value">{stats.invoiceCount}</div>
            <div className="bl-gst-stat-sub">for {monthLabel(selectedMonth)}</div>
          </div>
          <div className="bl-gst-stat">
            <div className="bl-gst-stat-label">Taxable Value (Subtotal)</div>
            <div className="bl-gst-stat-value">{fmtINR(stats.taxableValue)}</div>
            <div className="bl-gst-stat-sub">excluding GST</div>
          </div>
          <div className="bl-gst-stat">
            <div className="bl-gst-stat-label">Total GST Liability</div>
            <div className="bl-gst-stat-value" style={{ color: 'var(--accent)' }}>{fmtINR(stats.totalGST)}</div>
            <div className="bl-gst-stat-sub">CGST {fmtINR(stats.cgst)} + SGST {fmtINR(stats.sgst)}</div>
          </div>
        </div>

        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--bl-divider)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bl-text)', marginBottom: 10 }}>
            {selectedMonth.slice(0, 4)} Annual Summary
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--bl-text-mute)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Invoices</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bl-text)' }}>{annualStats.invoiceCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--bl-text-mute)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Annual GST Paid</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmtINR(annualStats.totalGST)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
