import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, fmtHours, calcBill } from '../../utils';
import type { Crane, TimesheetEntry } from '../../types';

type Period = 'all' | 'month' | '3month' | '6month' | 'year';

function getAccHrs(entries: TimesheetEntry[], date: string, startTime: string): number {
  return entries
    .filter(e => e.date === date && e.startTime < startTime)
    .reduce((s, e) => s + (Number(e.hoursDecimal) || 0), 0);
}

function getPeriodFromISO(period: Period): string | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); return d.toISOString().slice(0, 10); }
  if (period === '3month') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
  if (period === '6month') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); }
  if (period === 'year') { return `${now.getFullYear()}-01-01`; }
  return null;
}

function computeEarnings(crane: Crane, timesheets: Record<string, TimesheetEntry[]>, operatorProfiles: Record<string, unknown>, fromISO: string | null) {
  const op = crane.operator;
  const opTs = (op ? timesheets[op] || [] : []).filter(e => !fromISO || e.date >= fromISO);

  let revenue = 0, totalHrs = 0;
  opTs.forEach(e => {
    const h = Number(e.hoursDecimal) || 0;
    const b = calcBill(h, crane, getAccHrs(opTs, e.date, e.startTime));
    if (b) revenue += b.total;
    totalHrs += h;
  });

  const p = op ? (operatorProfiles[op] as { name?: string; salary?: number } || {}) : {};
  const opName = p.name || op || '';

  return { revenue, totalHrs, opName, op: op || '' };
}

export function EarningsPage({ active }: { active: boolean }) {
  const { state } = useApp();
  const [period, setPeriod] = useState<Period>('all');

  const data = useMemo(() => {
    const fromISO = getPeriodFromISO(period);
    let fleetRev = 0;

    const cards = state.cranes.map(crane => {
      const { revenue, totalHrs, opName, op } = computeEarnings(
        crane, state.timesheets, state.operatorProfiles, fromISO
      );
      fleetRev += revenue;
      return { crane, revenue, totalHrs, opName, op };
    }).sort((a, b) => b.revenue - a.revenue);

    return { cards, fleetRev };
  }, [state.cranes, state.timesheets, state.operatorProfiles, period]);

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-earnings">
      <div className="section-bar" style={{ marginBottom: '16px' }}>
        <div>
          <div className="section-title">Asset Earnings Report</div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px' }}>
            Revenue per asset from timesheets
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            style={{ fontSize: '11px', padding: '6px 10px', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--t1)', borderRadius: 'var(--rmd)', outline: 'none', cursor: 'pointer' }}
            id="earnings-period"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="3month">Last 3 Months</option>
            <option value="6month">Last 6 Months</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Fleet summary */}
      <div id="earnings-summary" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div className="e-cell">
            <div className="e-cell-lbl">Fleet Revenue</div>
            <div className="e-cell-val" style={{ color: 'var(--accent)' }}>{fmtINR(data.fleetRev)}</div>
          </div>
          <div className="e-cell">
            <div className="e-cell-lbl">Assets Tracked</div>
            <div className="e-cell-val" style={{ color: 'var(--t1)' }}>{state.cranes.length}</div>
          </div>
        </div>
      </div>

      {/* Per-asset cards */}
      <div id="earnings-list">
        {state.cranes.length === 0 ? (
          <p className="empty-msg">No assets registered.</p>
        ) : (
          data.cards.map(d => (
            <div key={d.crane.reg} className="earnings-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div className="earnings-reg">{d.crane.reg}</div>
                  <div className="earnings-spec">
                    {[d.crane.year, d.crane.make, d.crane.model].filter(Boolean).join(' · ') || 'No specs'}
                  </div>
                  {d.opName
                    ? <div style={{ fontSize: '10px', color: 'var(--t2)', marginTop: '2px', fontFamily: 'var(--fm)' }}>Operator: {d.opName}</div>
                    : <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>Unassigned</div>
                  }
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--fh)', fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
                    {fmtINR(d.revenue)}
                  </div>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--fm)', color: 'var(--t3)' }}>
                    {fmtHours(d.totalHrs)} logged
                  </div>
                </div>
              </div>

              <div className="earnings-grid">
                <div className="e-cell">
                  <div className="e-cell-lbl">Revenue</div>
                  <div className="e-cell-val" style={{ color: 'var(--accent)' }}>{fmtINR(d.revenue)}</div>
                  <div className="e-cell-sub">{fmtHours(d.totalHrs)} logged</div>
                </div>
                <div className="e-cell">
                  <div className="e-cell-lbl">Rate</div>
                  <div className="e-cell-val" style={{ color: 'var(--t1)' }}>
                    {d.crane.rate ? `₹${Number(d.crane.rate).toLocaleString('en-IN')}/hr` : '—'}
                  </div>
                  <div className="e-cell-sub">base rate</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
