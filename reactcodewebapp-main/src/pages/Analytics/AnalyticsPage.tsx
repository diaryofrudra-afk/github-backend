import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, fmtHours, calcBill } from '../../utils';
import { LineChart } from '../../components/charts/LineChart';
import { Pretext } from '../../components/ui/Pretext';
import type { ChartData } from 'chart.js';
import type { TimesheetEntry } from '../../types';

function getAccHrs(entries: TimesheetEntry[], date: string, startTime: string): number {
  return entries
    .filter(e => e.date === date && e.startTime < startTime)
    .reduce((s, e) => s + (Number(e.hoursDecimal) || 0), 0);
}

type RevPeriod = '7' | '30' | 'all';

/* ── Helper: mini ring SVG for day pills ── */
function MiniRing({ pct, accent, track }: { pct: number; accent: string; track: string }) {
  const r = 12, circ = 2 * Math.PI * r;
  const dash = circ * pct / 100;
  const gap = circ - dash;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r={r} fill="none" stroke={track} strokeWidth="3.5" />
      {pct > 0 && (
        <circle cx="16" cy="16" r={r} fill="none" stroke={accent} strokeWidth="3.5"
          strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 16 16)" style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
      )}
    </svg>
  );
}

/* ── Apple Activity Ring (canvas) ── */
function DeployRing({ pct }: { pct: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#9d6fff';
    const track = cs.getPropertyValue('--bg4').trim() || '#171728';
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = W * 0.37, lw = W * 0.115;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const START = -Math.PI / 2;
    const TARGET = START + (pct / 100) * 2 * Math.PI;
    let current = START;
    let raf: number;
    function frame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.strokeStyle = track; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.stroke();
      if (pct > 0 && current > START) {
        ctx.save();
        ctx.shadowColor = accent; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(cx, cy, r, START, current);
        ctx.strokeStyle = accent; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, cy - r, lw / 2 - 1, 0, 2 * Math.PI);
      ctx.fillStyle = pct >= 100 ? accent : track; ctx.fill();
      if (current < TARGET) {
        current = Math.min(current + (TARGET - START) / 30, TARGET);
        raf = requestAnimationFrame(frame);
      }
    }
    frame();
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  return <canvas ref={canvasRef} width={200} height={200} style={{ width: '160px', height: '160px' }} />;
}

export function AnalyticsPage({ active }: { active: boolean }) {
  const { state } = useApp();
  const [revPeriod, setRevPeriod] = useState<RevPeriod>('7');
  const [deployWeekOffset, setDeployWeekOffset] = useState(0);
  const [deploySelectedISO, setDeploySelectedISO] = useState(() => new Date().toISOString().slice(0, 10));

  const analytics = useMemo(() => {
    let totalRev = 0, totalHrs = 0, totalShifts = 0, totalOT = 0;
    const dailyRevMap: Record<string, number> = {};

    state.cranes.forEach(crane => {
      const op = crane.operator;
      const opTs: TimesheetEntry[] = (op ? state.timesheets[op] : undefined) || [];
      opTs.forEach(e => {
        const h = Number(e.hoursDecimal) || 0;
        const b = calcBill(h, crane, getAccHrs(opTs, e.date, e.startTime));
        const rev = b ? b.total : 0;
        totalRev += rev;
        totalHrs += h;
        totalShifts++;
        if (b && b.hasOT) totalOT++;
        const k = e.date;
        if (!dailyRevMap[k]) dailyRevMap[k] = 0;
        dailyRevMap[k] += rev;
      });
    });

    const deployed = state.cranes.filter(c => c.operator).length;
    const utilPct = state.cranes.length ? Math.round(deployed / state.cranes.length * 100) : 0;

    // Fuel totals
    let totalFuelLitres = 0, totalFuelCost = 0;
    const fuelByAsset = state.cranes.map(crane => {
      const logs = state.fuelLogs[crane.reg] || [];
      const litres = logs.reduce((s: number, e: { litres?: number }) => s + (Number(e.litres) || 0), 0);
      const cost = logs.reduce((s: number, e: { cost?: number }) => s + (Number(e.cost) || 0), 0);
      const withOdo = logs.filter((e: { odometer?: number }) => e.odometer).map((e: { odometer?: number }) => Number(e.odometer)).sort((a: number, b: number) => a - b);
      const kpl = withOdo.length >= 2 && litres > 0 ? ((withOdo[withOdo.length - 1] - withOdo[0]) / litres).toFixed(1) : null;
      totalFuelLitres += litres; totalFuelCost += cost;
      return { crane, litres, cost, kpl, entries: logs.length };
    }).filter(d => d.litres > 0).sort((a, b) => b.cost - a.cost);
    const avgKpl = fuelByAsset.filter(d => d.kpl).length
      ? (fuelByAsset.filter(d => d.kpl).reduce((s, d) => s + Number(d.kpl), 0) / fuelByAsset.filter(d => d.kpl).length).toFixed(1)
      : null;

    // Top earners by operator
    const earners = state.operators.map(op => {
      const crane = state.cranes.find(c => c.operator === op.phone || c.operator === op.id);
      const opTs: TimesheetEntry[] = (state.timesheets[op.phone] || state.timesheets[op.id] || []);
      let rev = 0, hrs = 0;
      opTs.forEach(e => {
        const h = Number(e.hoursDecimal) || 0;
        const b = crane ? calcBill(h, crane, getAccHrs(opTs, e.date, e.startTime)) : null;
        if (b) rev += b.total;
        hrs += h;
      });
      const profile = state.operatorProfiles[op.phone] || state.operatorProfiles[op.id] || {};
      const name = (profile as { name?: string }).name || op.name;
      return { op, crane, rev, hrs, shifts: opTs.length, name };
    }).sort((a, b) => b.rev - a.rev).slice(0, 5);

    // Operator performance
    const perfRows = state.operators.map(op => {
      const crane = state.cranes.find(c => c.operator === op.phone || c.operator === op.id);
      const opTs: TimesheetEntry[] = (state.timesheets[op.phone] || state.timesheets[op.id] || []);
      let shifts = 0, hrs = 0, otShifts = 0, rev = 0;
      opTs.forEach(e => {
        const h = Number(e.hoursDecimal) || 0;
        shifts++;
        hrs += h;
        const b = crane ? calcBill(h, crane, getAccHrs(opTs, e.date, e.startTime)) : null;
        if (b) { rev += b.total; if (b.hasOT) otShifts++; }
      });
      const profile = state.operatorProfiles[op.phone] || state.operatorProfiles[op.id] || {};
      const name = (profile as { name?: string }).name || op.name;
      return { op, crane, shifts, hrs, otShifts, rev, name };
    }).sort((a, b) => b.rev - a.rev);

    // Diagnostics KPI
    const gpsAssets = state.cranes.filter(c => (c as any).gpsId);
    const diagData = gpsAssets.map(c => state.diagnostics[c.reg]).filter(Boolean);
    const critCount = diagData.filter((d: any) => d.health === 'critical').length;
    const warnCount = diagData.filter((d: any) => d.health === 'warning').length;
    const onCount = diagData.filter((d: any) => d.health && d.health !== 'offline').length;

    return {
      totalRev, totalHrs, totalShifts, totalOT, dailyRevMap, deployed, utilPct,
      totalFuelLitres, totalFuelCost, fuelByAsset, avgKpl,
      earners, perfRows,
      gpsAssets, critCount, warnCount, onCount,
    };
  }, [state]);

  // Revenue chart data
  const revChartData = useMemo((): ChartData<'line'> => {
    const days = revPeriod === 'all'
      ? Math.max(30, Object.keys(analytics.dailyRevMap).length + 7)
      : Number(revPeriod);
    const pts: Array<{ l: string; v: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      pts.push({ l: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), v: analytics.dailyRevMap[iso] || 0 });
    }
    pts.reduce((s, p) => s + p.v, 0); // Calculate total for side-effects if any, or remove if truly unused
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#9d6fff';
    return {
      labels: pts.map(p => p.l),
      datasets: [{
        data: pts.map(p => p.v),
        fill: true,
        borderColor: accent,
        borderWidth: 2.5,
        tension: 0.4,
        pointRadius: pts.length > 14 ? 0 : 4,
        pointBackgroundColor: accent,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: accent,
        pointHoverBorderWidth: 2.5,
      }],
    };
  }, [analytics.dailyRevMap, revPeriod]);

  const revChartSub = useMemo(() => {
    const days = revPeriod === 'all'
      ? Math.max(30, Object.keys(analytics.dailyRevMap).length + 7)
      : Number(revPeriod);
    let total = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      total += analytics.dailyRevMap[d.toISOString().slice(0, 10)] || 0;
    }
    return `Total: ${fmtINR(total)} over ${days} days`;
  }, [analytics.dailyRevMap, revPeriod]);

  // Week dates for deploy section
  const getWeekDates = useCallback((offset: number) => {
    const today = new Date();
    const dow = today.getDay();
    const toMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(today); mon.setDate(today.getDate() + toMon + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      return { iso: d.toISOString().slice(0, 10), dow: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], d };
    });
  }, []);

  const getDeployForDate = useCallback((iso: string) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (iso === todayISO) {
      const dep = state.cranes.filter(c => c.operator).length;
      return { deployed: dep, total: state.cranes.length };
    }
    const depSet = new Set<string>();
    state.operators.forEach(op => {
      const key = op.phone || op.id;
      (state.timesheets[key] || []).forEach((e: TimesheetEntry) => {
        if (e.date === iso) {
          const cr = state.cranes.find(c => c.operator === key);
          if (cr) depSet.add(cr.reg);
        }
      });
    });
    return { deployed: Math.min(depSet.size, state.cranes.length), total: state.cranes.length };
  }, [state.cranes, state.operators, state.timesheets]);

  const week = useMemo(() => getWeekDates(deployWeekOffset), [getWeekDates, deployWeekOffset]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const deployData = getDeployForDate(deploySelectedISO);
  const deployPct = deployData.total ? Math.round(deployData.deployed / deployData.total * 100) : 0;
  const isCurrentWeek = deployWeekOffset === 0;
  const weekLabel = isCurrentWeek
    ? 'This week'
    : `${week[0].d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${week[6].d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

  // Heatmap data
  const heatmapData = useMemo(() => {
    const WEEKS = 10;
    const days: Array<{ iso: string; dow: number; label: string }> = [];
    for (let i = WEEKS * 7 - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ iso: d.toISOString().slice(0, 10), dow: d.getDay(), label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) });
    }
    const maxV = Math.max(...Object.values(analytics.dailyRevMap), 1);
    const weeks: typeof days[] = [];
    for (let w = 0; w < WEEKS; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
    return { weeks, maxV };
  }, [analytics.dailyRevMap]);

  function getHeatColor(v: number) {
    if (!v) return 'var(--bg5)';
    const p = v / heatmapData.maxV;
    if (p > 0.75) return 'rgba(0,212,255,1)';
    if (p > 0.5) return 'rgba(0,212,255,0.7)';
    if (p > 0.25) return 'rgba(0,212,255,0.4)';
    return 'rgba(0,212,255,0.2)';
  }

  const maxPerfRev = Math.max(...analytics.perfRows.map(d => d.rev), 1);
  const earnerColors = ['var(--accent)', 'var(--green)', 'var(--amber)', 'var(--violet)', 'var(--red)'];
  const earnerRanks = ['🥇', '🥈', '🥉', '4', '5'];

  // Diagnostics KPI label/color
  const diagLabel = analytics.critCount ? `${analytics.critCount} critical` : analytics.warnCount ? `${analytics.warnCount} warnings` : analytics.onCount ? `${analytics.onCount} reporting` : 'No GPS data';
  const diagColor = analytics.critCount ? 'var(--red)' : analytics.warnCount ? 'var(--amber)' : 'var(--green)';
  const diagBg = analytics.critCount ? 'var(--red-s)' : analytics.warnCount ? 'var(--amber-s)' : 'var(--green-s)';

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-analytics">
      {/* ── KPI grid (6 cards) ── */}
      <div className="kpi-grid" id="kpi-analytics">
        {/* Fleet Revenue */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ 
              background: 'var(--accent-s)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '15px', 
              fontWeight: '700', 
              color: 'var(--accent)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              ₹
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Fleet Revenue</div>
            <div className="kpi-val" style={{ color: 'var(--accent)' }}>
              {analytics.totalRev >= 100000 ? `₹${(analytics.totalRev / 100000).toFixed(1)}L` : fmtINR(analytics.totalRev)}
            </div>
            <div className="kpi-sub">{analytics.totalShifts} shifts · {fmtHours(analytics.totalHrs)}</div>
          </div>
        </div>

        {/* Total Hours */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--green-s)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Total Hours</div>
            <div className="kpi-val" style={{ color: 'var(--green)' }}>{fmtHours(analytics.totalHrs)}</div>
            <div className="kpi-sub">{analytics.totalOT} OT shifts</div>
          </div>
        </div>

        {/* Utilisation */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--amber-s)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 21h14" />
                <rect x="3" y="18" width="12" height="3" rx="1.5" />
                <rect x="9" y="13" width="5" height="5" rx="0.5" />
                <line x1="10.5" y1="13" x2="10.5" y2="18" />
                <line x1="11" y1="13" x2="3" y2="4" />
                <line x1="3" y1="4" x2="3" y2="8" />
                <path d="M2 8.5a1.2 1.2 0 1 0 2 0" />
                <line x1="7" y1="18" x2="6" y2="9" />
              </svg>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Utilisation</div>
            <div className="kpi-val" style={{ color: 'var(--amber)' }}>{analytics.utilPct}%</div>
            <div className="kpi-sub">{analytics.deployed} of {state.cranes.length} active</div>
          </div>
        </div>

        {/* Fuel Cost */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--red-s)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 21h10" />
                <rect x="6" y="3" width="9" height="18" rx="1.5" />
                <rect x="8" y="6" width="5" height="4" rx="0.5" />
                <path d="M15 8h2.5a1.5 1.5 0 0 1 1.5 1.5v7" />
                <circle cx="19" cy="18" r="1.5" />
              </svg>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Fuel Cost</div>
            <div className="kpi-val" style={{ color: 'var(--red)' }}>
              {analytics.totalFuelCost > 0 ? fmtINR(analytics.totalFuelCost) : analytics.totalFuelLitres > 0 ? `${analytics.totalFuelLitres.toFixed(0)}L` : '—'}
            </div>
            <div className="kpi-sub">
              {analytics.totalFuelCost > 0 ? `${analytics.totalFuelLitres.toFixed(0)}L consumed` : `${analytics.fuelByAsset.length} assets tracked`}
            </div>
          </div>
        </div>

        {/* Efficiency */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--violet-s)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Efficiency</div>
            <div className="kpi-val" style={{ color: 'var(--violet)' }}>{analytics.avgKpl ? `${analytics.avgKpl} km/L` : '—'}</div>
            <div className="kpi-sub">{analytics.avgKpl ? 'Fleet avg fuel economy' : 'Add odometer readings'}</div>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: diagBg }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={diagColor} strokeWidth="2" strokeLinecap="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-label">Diagnostics</div>
            <div className="kpi-val" style={{ color: diagColor }}>
              {analytics.gpsAssets.length ? `${analytics.onCount}/${analytics.gpsAssets.length}` : '—'}
            </div>
            <div className="kpi-sub">{diagLabel}</div>
          </div>
        </div>
      </div>

      {/* ── Revenue Trend + Fleet Deployment ── */}
      <div className="a-grid-2">
        {/* Revenue Trend */}
        <div className="chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">
                <Pretext text="Revenue Trend" balanced font="700 15px 'Plus Jakarta Sans'" />
              </div>
              <div className="card-sub">{revChartSub}</div>
            </div>
            <div className="chart-tabs" id="rev-tabs">
              {(['7', '30', 'all'] as RevPeriod[]).map(p => (
                <button key={p} className={`ctab${revPeriod === p ? ' active' : ''}`} onClick={() => setRevPeriod(p)}>
                  {p === 'all' ? 'All' : `${p}D`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', height: '220px' }}>
            <LineChart data={revChartData} height={220} gradient />
          </div>
        </div>

        {/* Fleet Deployment */}
        <div className="chart-card" style={{ paddingBottom: '8px' }}>
          <div className="card-head">
            <div>
              <div className="card-title">
                <Pretext text="Fleet Deployment" balanced font="700 15px 'Plus Jakarta Sans'" />
              </div>
              <div className="card-sub">Active vs standby</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="ctab" onClick={() => { setDeployWeekOffset(o => o - 1); setDeploySelectedISO(getWeekDates(deployWeekOffset - 1)[6].iso); }}>‹</button>
              <span style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t2)', minWidth: '70px', textAlign: 'center' }}>{weekLabel}</span>
              <button className="ctab" disabled={isCurrentWeek} onClick={() => { setDeployWeekOffset(o => o + 1); setDeploySelectedISO(getWeekDates(deployWeekOffset + 1)[0].iso); }}>›</button>
            </div>
          </div>

          {/* Day pills */}
          <div className="deploy-days">
            {week.map(w => {
              const isFuture = w.iso > todayISO;
              const isToday = w.iso === todayISO;
              const isSelected = w.iso === deploySelectedISO;
              const dd = getDeployForDate(w.iso);
              const dayPct = dd.total ? Math.round(dd.deployed / dd.total * 100) : 0;
              return (
                <div
                  key={w.iso}
                  className={`deploy-day${isFuture ? ' future' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => !isFuture && setDeploySelectedISO(w.iso)}
                >
                  <div className="deploy-day-lbl">{w.dow}</div>
                  <MiniRing pct={isFuture ? 0 : dayPct} accent={isSelected ? 'var(--accent)' : (isToday ? 'var(--accent)' : 'rgba(157,111,255,0.45)')} track="var(--bg4)" />
                  <div className="deploy-day-num">{w.d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Main ring */}
          <div className="deploy-ring-wrap">
            <DeployRing pct={deployPct} />
            <div className="deploy-ring-center">
              <div className="deploy-ring-pct">{deployPct}%</div>
              <div className="deploy-ring-sub">Deployed</div>
              <div className="deploy-ring-date">
                {week.find(w => w.iso === deploySelectedISO)?.d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) || ''}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="deploy-legend">
            <div className="deploy-legend-row">
              <div style={{ display: 'flex', alignItems: 'center' }}><div className="deploy-legend-dot" style={{ background: 'var(--accent)' }} />Deployed</div>
              <span className="deploy-legend-val">{deployData.deployed}</span>
            </div>
            <div className="deploy-legend-row">
              <div style={{ display: 'flex', alignItems: 'center' }}><div className="deploy-legend-dot" style={{ background: 'var(--bg4)', border: '1px solid var(--border2)' }} />Standby</div>
              <span className="deploy-legend-val">{deployData.total - deployData.deployed}</span>
            </div>
            <div className="deploy-legend-row total">
              <div>Total Fleet</div>
              <span className="deploy-legend-val">{deployData.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Shift Activity Heatmap + Top Earners ── */}
      <div className="a-grid-2">
        {/* Heatmap */}
        <div className="chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">
                <Pretext text="Shift Activity" balanced font="700 15px 'Plus Jakarta Sans'" />
              </div>
              <div className="card-sub">Last 10 weeks — colour = revenue</div>
            </div>
          </div>
          <div className="heatmap-wrap">
            <div className="hmap-day-labels">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(l => (
                <div key={l} className="hmap-day-label">{l}</div>
              ))}
            </div>
            {heatmapData.weeks.map((wk, wi) => (
              <div key={wi} className="hmap-col">
                {wk.map(d => {
                  const v = analytics.dailyRevMap[d.iso] || 0;
                  return (
                    <div
                      key={d.iso}
                      className="hmap-cell"
                      style={{ background: getHeatColor(v) }}
                      title={`${d.label}${v > 0 ? ': ' + fmtINR(v) : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Top Earners */}
        <div className="chart-card" style={{ paddingBottom: '12px' }}>
          <div className="card-head">
            <div>
              <div className="card-title">
                <Pretext text="Top Earners" balanced font="700 15px 'Plus Jakarta Sans'" />
              </div>
              <div className="card-sub">By total revenue</div>
            </div>
          </div>
          <div id="earners-list">
            {analytics.earners.length === 0 ? (
              <p className="empty-msg" style={{ fontSize: '11px' }}>No revenue data yet</p>
            ) : (
              analytics.earners.map(({ op, crane, rev, hrs, shifts, name }, i) => {
                const initials = name ? name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : op.phone.slice(-2);
                return (
                  <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--fh)', fontSize: '14px', width: '22px', textAlign: 'center' }}>{earnerRanks[i]}</div>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: earnerColors[i] + '22', border: `1px solid ${earnerColors[i]}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontFamily: 'var(--fh)', fontWeight: 700, color: earnerColors[i], flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--fm)', fontWeight: 600, color: 'var(--t1)' }}>{crane ? crane.reg : 'N/A'}</div>
                      <div style={{ fontSize: '9px', color: 'var(--t3)', marginTop: '1px' }}>
                        {name} · {shifts} shifts
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--fh)', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>{fmtINR(rev)}</div>
                      <div style={{ fontSize: '9px', fontFamily: 'var(--fm)', color: 'var(--t3)' }}>{fmtHours(hrs)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Operator Performance Table ── */}
      <div className="chart-card">
        <div className="card-head">
          <div className="card-title">
            <Pretext text="Operator Performance" balanced font="700 15px 'Plus Jakarta Sans'" />
          </div>
          <div className="card-sub" style={{ marginLeft: '12px' }}>{analytics.perfRows.length} operators</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" id="perf-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Asset</th>
                <th>Shifts</th>
                <th>Hours</th>
                <th>OT</th>
                <th>Revenue</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {analytics.perfRows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t4)', fontSize: '11px' }}>No data</td></tr>
              ) : (
                analytics.perfRows.map(({ op, crane, shifts, hrs, otShifts, rev, name }) => {
                  const pct = Math.round(rev / maxPerfRev * 100);
                  return (
                    <tr key={op.id}>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>{name}</div>
                        {name !== op.phone && <div style={{ fontSize: '9px', fontFamily: 'var(--fm)', color: 'var(--t3)' }}>{op.phone}</div>}
                      </td>
                      <td style={{ color: 'var(--accent)' }}>{crane ? crane.reg : '—'}</td>
                      <td>{shifts}</td>
                      <td><span className="hours-badge">{fmtHours(hrs)}</span></td>
                      <td>{otShifts ? <span className="ot-badge">{otShifts} OT</span> : '—'}</td>
                      <td><span className="bill-badge">{fmtINR(rev)}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="perf-bar-track" style={{ width: '70px' }}>
                            <div className="perf-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                          </div>
                          <span style={{ fontSize: '9px', fontFamily: 'var(--fm)', color: 'var(--t3)' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Fuel Breakdown by Asset ── */}
      {analytics.fuelByAsset.length > 0 && (
        <div className="chart-card">
          <div className="card-head">
            <div className="card-title">
              <Pretext text="Fuel Breakdown by Asset" balanced font="700 15px 'Plus Jakarta Sans'" />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Specs</th>
                  <th>Entries</th>
                  <th>Litres</th>
                  <th>Fuel Cost</th>
                  <th>Efficiency</th>
                  <th>Cost/Rev</th>
                </tr>
              </thead>
              <tbody>
                {analytics.fuelByAsset.map(d => {
                  const opTs: TimesheetEntry[] = (d.crane.operator ? state.timesheets[d.crane.operator] : undefined) || [];
                  let assetRev = 0;
                  opTs.forEach(e => {
                    const h = Number(e.hoursDecimal) || 0;
                    const b = calcBill(h, d.crane, getAccHrs(opTs, e.date, e.startTime));
                    if (b) assetRev += b.total;
                  });
                  const costRevRatio = assetRev > 0 ? ((d.cost / assetRev) * 100).toFixed(1) : null;
                  const maxCost = Math.max(...analytics.fuelByAsset.map(x => x.cost), 1);
                  const barPct = Math.round(d.cost / maxCost * 100);
                  const barColor = barPct > 70 ? 'var(--red)' : barPct > 40 ? 'var(--amber)' : 'var(--green)';
                  return (
                    <tr key={d.crane.reg}>
                      <td><span style={{ fontFamily: 'var(--fh)', fontWeight: 700, color: 'var(--accent)' }}>{d.crane.reg}</span></td>
                      <td style={{ color: 'var(--t2)' }}>{[d.crane.year, d.crane.make, d.crane.model].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ color: 'var(--t2)' }}>{d.entries}</td>
                      <td><span className="hours-badge">{d.litres.toFixed(1)} L</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span className="bill-badge" style={{ background: 'var(--red-s)', color: 'var(--red)', borderColor: 'rgba(255,68,102,0.25)' }}>{fmtINR(d.cost)}</span>
                          <div className="perf-bar-track" style={{ width: '50px' }}><div className="perf-bar-fill" style={{ width: `${barPct}%`, background: barColor }} /></div>
                        </div>
                      </td>
                      <td>{d.kpl ? <span style={{ fontFamily: 'var(--fm)', color: 'var(--amber)' }}>{d.kpl} km/L</span> : <span style={{ color: 'var(--t4)' }}>—</span>}</td>
                      <td>
                        {costRevRatio
                          ? <><span style={{ fontFamily: 'var(--fm)', color: Number(costRevRatio) > 25 ? 'var(--red)' : 'var(--t2)' }}>{costRevRatio}%</span> <span style={{ fontSize: '9px', color: 'var(--t4)' }}>of revenue</span></>
                          : <span style={{ color: 'var(--t4)' }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
                {/* Fleet total row */}
                <tr style={{ background: 'var(--bg4)' }}>
                  <td colSpan={3} style={{ fontFamily: 'var(--fh)', fontWeight: 700, color: 'var(--t1)' }}>FLEET TOTAL</td>
                  <td><span className="hours-badge">{analytics.totalFuelLitres.toFixed(1)} L</span></td>
                  <td><span className="bill-badge" style={{ background: 'var(--red-s)', color: 'var(--red)', borderColor: 'rgba(255,68,102,0.25)' }}>{fmtINR(analytics.totalFuelCost)}</span></td>
                  <td>—</td>
                  <td>
                    {(() => {
                      let totalRev2 = 0;
                      analytics.fuelByAsset.forEach(d => {
                        const opTs: TimesheetEntry[] = (d.crane.operator ? state.timesheets[d.crane.operator] : undefined) || [];
                        opTs.forEach(e => { const b = calcBill(Number(e.hoursDecimal) || 0, d.crane, getAccHrs(opTs, e.date, e.startTime)); if (b) totalRev2 += b.total; });
                      });
                      const avg = totalRev2 > 0 ? ((analytics.totalFuelCost / totalRev2) * 100).toFixed(1) : null;
                      return avg
                        ? <><span style={{ fontFamily: 'var(--fm)', color: Number(avg) > 25 ? 'var(--red)' : 'var(--green)' }}>{avg}%</span> <span style={{ fontSize: '9px', color: 'var(--t4)' }}>of fleet revenue</span></>
                        : '—';
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
