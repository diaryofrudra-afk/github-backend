import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, fmtHours, calcBill } from '../../utils';
import type { Crane, TimesheetEntry } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { IndianRupee, TrendingUp, Calendar, Truck } from 'lucide-react';

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
    <div className={`page earnings-page ${active ? 'active' : ''}`} id="page-earnings">
      <PageHeader 
        title="Earnings" 
        subtitle="Revenue per asset from timesheets"
        icon={<TrendingUp size={20} />}
        iconBgClass="bg-green-500"
      >
          <div className="relative flex items-center bg-[var(--bg4)] border border-[var(--border)] rounded-xl px-3 py-1 shadow-sm">
            <Calendar size={14} className="text-[var(--t4)] mr-2" />
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="bg-transparent text-sm font-bold text-[var(--t1)] outline-none cursor-pointer py-1.5 pr-4 appearance-none"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="3month">Last 3 Months</option>
              <option value="6month">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center px-1 text-[var(--t3)]">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </PageHeader>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<IndianRupee size={18} />}
            label="Fleet Revenue"
            value={fmtINR(data.fleetRev)}
            colorClass="text-green-600 dark:text-green-400"
            bgClass="bg-green-500/10 dark:bg-green-500/20"
          />
          <StatCard
            icon={<Truck size={18} />}
            label="Assets Tracked"
            value={state.cranes.length}
            colorClass="text-[var(--t2)]"
            bgClass="bg-[var(--bg5)]"
          />
        </div>

      <div className="mt-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {state.cranes.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg4)] px-6 py-12 text-center">
              <p className="text-[var(--t3)] font-medium">No assets registered.</p>
            </div>
          ) : (
            data.cards.map(d => (
              <article key={d.crane.reg} className="bg-[var(--bg4)] rounded-2xl p-5 border border-[var(--border)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col group">
                <header className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-base font-black text-[var(--t1)] truncate">{d.crane.reg}</h3>
                    <p className="text-[11px] font-medium text-[var(--t3)] truncate">
                      {[d.crane.year, d.crane.make, d.crane.model].filter(Boolean).join(' · ') || 'No specs'}
                    </p>
                    <div className="text-[10px] font-bold text-orange-600 mt-2 uppercase tracking-widest truncate">
                      {d.opName ? `Op: ${d.opName}` : 'Unassigned'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black text-green-600 tracking-tight">
                      {fmtINR(d.revenue)}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--t4)] uppercase tracking-widest mt-1">
                      {fmtHours(d.totalHrs)} Logged
                    </div>
                  </div>
                </header>

                <section className="bg-[var(--bg5)] border border-[var(--border)] rounded-xl p-3 grid grid-cols-2 gap-3 mt-auto">
                  <div>
                    <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Base Rate</div>
                    <div className="text-xs font-bold text-[var(--t1)] truncate">
                      {d.crane.rate ? `₹${Number(d.crane.rate).toLocaleString('en-IN')}/hr` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-[var(--t4)] uppercase tracking-widest mb-1">Status</div>
                    <div className="text-xs font-bold text-green-600 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 block" /> Active
                    </div>
                  </div>
                </section>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
