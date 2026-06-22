import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtINR, fmtHours, calcBill } from '../../utils';
import { LineChart } from '../../components/charts/LineChart';
import { LogbookViewer } from '../../components/ui/LogbookViewer';
import { 
  TrendingUp, 
  IndianRupee, 
  Clock, 
  Percent, 
  Flame, 
  Wrench, 
  Users, 
  Wallet, 
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronRight,
  ChevronDown,
  ArrowRight
} from 'lucide-react';

export function AnalyticsPage({ active }: { active: boolean }) {
  const { state } = useApp();
  
  // States
  const [period, setPeriod] = useState<string>('30'); // '7' | '30' | '90' | '180' | 'all'
  const [selectedCraneReg, setSelectedCraneReg] = useState<string | null>(null);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string>('');

  // 1. Dynamic Date Range Calculation
  const startDateISO = useMemo(() => {
    if (period === 'all') return null;
    const now = new Date();
    const days = Number(period);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const numDays = useMemo(() => {
    if (period === 'all') {
      let oldest = new Date();
      state.cranes.forEach(c => {
        const op = c.operator || '';
        const ts = state.timesheets[op] || [];
        ts.forEach(e => {
          const d = new Date(e.date);
          if (d < oldest) oldest = d;
        });
      });
      const diff = Math.ceil((Date.now() - oldest.getTime()) / 86400000);
      return Math.max(diff, 1);
    }
    return Number(period);
  }, [period, state]);

  // 2. Aggregate Data Engine & Individual Crane Stats
  const analytics = useMemo(() => {
    const assetStats = state.cranes.map(crane => {
      const reg = crane.reg;
      const op = crane.operator || '';
      
      // Filter timesheets for this crane falling within period
      const opTs = (state.timesheets[op] || []).filter(e => {
        const matchesCrane = e.crane_reg ? e.crane_reg === reg : true;
        return matchesCrane && (!startDateISO || e.date >= startDateISO);
      });

      // Calculate runtime hours and timesheet earned revenue
      let hours = 0;
      let revenue = 0;
      opTs.forEach(e => {
        const h = Number(e.hoursDecimal) || 0;
        // Timesheet billing rate check
        const b = calcBill(h, crane, 0); 
        if (b) revenue += b.total;
        hours += h;
      });

      // Filter fuel cost & litres
      const fuelLogs = (state.fuelLogs[reg] || []).filter(e => !startDateISO || e.date >= startDateISO);
      const fuelCost = fuelLogs.reduce((s, e) => s + (Number(e.cost) || 0), 0);
      const fuelLitres = fuelLogs.reduce((s, e) => s + (Number(e.litres) || 0), 0);

      // Filter maintenance cost
      const maintenanceLogs = (state.maintenance[reg] || []).filter(e => !startDateISO || e.date >= startDateISO);
      const maintenanceCost = maintenanceLogs.reduce((s, e) => s + (Number(e.cost) || 0), 0);

      // Pro-rata operator salary
      const profile = (state.operatorProfiles[op] || {}) as any;
      const salary = Number(profile.salary) || 0;
      const workingDays = Number(profile.workingDays) || 26;
      const operatorCost = opTs.length * (salary / Math.max(workingDays, 1));

      // Pro-rata EMI & Fixed Overheads
      const emi = Number(crane.emi || 0);
      const fixed = Number(crane.fixedExpenses ?? crane.fixed_expenses ?? 0);
      const emiCost = emi * (numDays / 30.4);
      const fixedCost = fixed * (numDays / 30.4);

      const totalExpenses = fuelCost + maintenanceCost + operatorCost + emiCost + fixedCost;
      const netProfit = revenue - totalExpenses;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      const lph = hours > 0 ? (fuelLitres / hours) : 0;

      // Identify missing logbook file scans
      const userFiles = (state.files[op] || []) as any[];
      const missingScans = opTs.filter(e => {
        const hasScan = userFiles.some(f => f.name.includes(`Logbook-${e.date}`) || f.name.includes(e.date));
        return !hasScan;
      });

      return {
        crane,
        reg,
        hours,
        shifts: opTs.length,
        revenue,
        fuelCost,
        fuelLitres,
        maintenanceCost,
        operatorCost,
        emiCost,
        fixedCost,
        totalExpenses,
        netProfit,
        margin,
        lph,
        missingLogbookCount: missingScans.length,
        missingScans,
        opTs,
        fuelLogs,
        maintenanceLogs
      };
    });

    // Sum aggregate values
    let fleetRevenue = 0;
    let fleetHours = 0;
    let fleetShifts = 0;
    let fleetFuelCost = 0;
    let fleetFuelLitres = 0;
    let fleetMaintenanceCost = 0;
    let fleetOperatorCost = 0;
    let fleetEmiCost = 0;
    let fleetFixedCost = 0;
    let fleetExpenses = 0;
    let fleetMissingLogbooks = 0;

    assetStats.forEach(as => {
      fleetRevenue += as.revenue;
      fleetHours += as.hours;
      fleetShifts += as.shifts;
      fleetFuelCost += as.fuelCost;
      fleetFuelLitres += as.fuelLitres;
      fleetMaintenanceCost += as.maintenanceCost;
      fleetOperatorCost += as.operatorCost;
      fleetEmiCost += as.emiCost;
      fleetFixedCost += as.fixedCost;
      fleetExpenses += as.totalExpenses;
      fleetMissingLogbooks += as.missingLogbookCount;
    });

    const netProfit = fleetRevenue - fleetExpenses;
    const profitMargin = fleetRevenue > 0 ? (netProfit / fleetRevenue) * 100 : 0;

    // Utilization calculation
    const activeCraneDays = assetStats.reduce((sum, as) => sum + as.shifts, 0);
    const totalPotentialCraneDays = state.cranes.length * numDays;
    const utilizationRate = totalPotentialCraneDays > 0 ? Math.round((activeCraneDays / totalPotentialCraneDays) * 100) : 0;

    // Receivables calculation
    let clientReceivables = 0;
    state.invoices.forEach(inv => {
      if (inv.status !== 'paid') {
        const total = Number(inv.total) || 0;
        const paid = Number(inv.paidAmount ?? inv.paid_amount ?? 0);
        clientReceivables += (total - paid);
      }
    });

    // Operator Payables
    let operatorPayables = 0;
    state.operators.forEach(op => {
      const opKey = op.phone || op.id;
      const opStat = assetStats.find(as => as.crane.operator === opKey);
      const earned = opStat ? opStat.operatorCost : 0;
      const advances = ((state.advancePayments[opKey] || []) as any[]).filter((e: any) => !startDateISO || e.date >= startDateISO);
      const totalAdvances = advances.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      operatorPayables += Math.max(earned - totalAdvances, 0);
    });

    // Compliance alerts check
    let complianceRiskCount = 0;
    state.cranes.forEach(c => {
      const rec = state.compliance[c.reg];
      if (rec) {
        const checkExpiry = (d?: string) => {
          if (!d) return false;
          const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
          return diff <= 30;
        };
        if (checkExpiry(rec.insurance?.date) || checkExpiry(rec.fitness?.date)) {
          complianceRiskCount++;
        }
      }
    });

    return {
      assetStats,
      fleetRevenue,
      fleetHours,
      fleetShifts,
      fleetFuelCost,
      fleetFuelLitres,
      fleetMaintenanceCost,
      fleetOperatorCost,
      fleetEmiCost,
      fleetFixedCost,
      fleetExpenses,
      fleetMissingLogbooks,
      netProfit,
      profitMargin,
      utilizationRate,
      clientReceivables,
      operatorPayables,
      complianceRiskCount,
      activeCraneDays,
      totalPotentialCraneDays
    };
  }, [state, startDateISO, numDays]);

  // 3. Dynamic Daily Chart Data Engine
  const chartData = useMemo(() => {
    const labels: string[] = [];
    const profitPoints: number[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

      let dayRev = 0;
      let dayExp = 0;

      analytics.assetStats.forEach(as => {
        // Daily shifts earned revenue
        const dayTs = as.opTs.filter(e => e.date === iso);
        dayTs.forEach(e => {
          const b = calcBill(Number(e.hoursDecimal) || 0, as.crane, 0);
          if (b) dayRev += b.total;
          
          const profile = (state.operatorProfiles[as.crane.operator || ''] || {}) as any;
          const salary = Number(profile.salary) || 0;
          const workingDays = Number(profile.workingDays) || 26;
          dayExp += (salary / Math.max(workingDays, 1));
        });

        // Daily fuel costs
        const dayFuel = as.fuelLogs.filter(e => e.date === iso);
        dayExp += dayFuel.reduce((s, e) => s + (Number(e.cost) || 0), 0);

        // Daily maintenance costs
        const dayMaint = as.maintenanceLogs.filter(e => e.date === iso);
        dayExp += dayMaint.reduce((s, e) => s + (Number(e.cost) || 0), 0);

        // Daily pro-rata fixed overheads
        const emi = Number(as.crane.emi || 0) / 30.4;
        const fixed = Number(as.crane.fixedExpenses ?? as.crane.fixed_expenses ?? 0) / 30.4;
        dayExp += (emi + fixed);
      });

      profitPoints.push(dayRev - dayExp);
    }

    return {
      labels,
      datasets: [{
        label: 'Net Earnings',
        data: profitPoints,
        borderColor: '#E8732A',
        backgroundColor: 'rgba(232, 115, 42, 0.1)',
        fill: true,
        tension: 0.4,
      }]
    };
  }, [analytics.assetStats, numDays, state]);

  // Selected asset detail variables
  const selectedAssetDetail = useMemo(() => {
    if (!selectedCraneReg) return null;
    return analytics.assetStats.find(as => as.reg === selectedCraneReg) || null;
  }, [selectedCraneReg, analytics.assetStats]);

  const openLogbookScan = (operatorKey: string, date: string) => {
    const userFiles = (state.files[operatorKey] || []) as any[];
    const file = userFiles.find(f => f.name.includes(`Logbook-${date}`) || f.name.includes(date));
    if (file) {
      setViewerFileUrl(file.data);
      setViewerFileName(file.name);
    }
  };

  if (!active) return null;

  return (
    <div className="page active" id="page-analytics" style={{ background: 'var(--bg)', color: 'var(--t1)', padding: '24px 20px 100px' }}>
      {/* ── Dashboard Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--t1)', letterSpacing: '-0.5px' }}>Fleet Analytics</h2>
          <p style={{ fontSize: '13px', color: 'var(--t2)', marginTop: '4px' }}>Real-time earnings, pro-rata overhead costs & operational efficiency</p>
        </div>
        
        {/* Preset filter pills */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg3)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {[
            { value: '7', label: '7D' },
            { value: '30', label: '30D' },
            { value: '90', label: '90D' },
            { value: '180', label: '180D' },
            { value: 'all', label: 'ALL' }
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '6px 12px',
                background: period === p.value ? 'var(--accent)' : 'transparent',
                color: period === p.value ? '#fff' : 'var(--t2)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Section 1: KPI Stats Summary Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px', marginBottom: 28 }}>
        {/* Net Profit */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: analytics.netProfit >= 0 ? 'var(--green-s)' : 'var(--red-s)', color: analytics.netProfit >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{fmtINR(analytics.netProfit)}</div>
            <div style={{ fontSize: '11px', color: analytics.netProfit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Percent size={11} /> {analytics.profitMargin.toFixed(1)}% margin
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-s)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Earned Revenue</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{fmtINR(analytics.fleetRevenue)}</div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>
              {analytics.fleetShifts} shifts · {fmtHours(analytics.fleetHours)}
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--red-s)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Expenses</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{fmtINR(analytics.fleetExpenses)}</div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>
              Fuel, wages, EMI, overheads
            </div>
          </div>
        </div>

        {/* Utilization */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--green-s)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Percent size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Utilization</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{analytics.utilizationRate}%</div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>
              {analytics.activeCraneDays} active days / {analytics.totalPotentialCraneDays}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Fleet Performance Pane (Dynamic Charts & Expenses Breakdown) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: 28 }}>
        {/* Profitability Trend */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--t1)' }}>Profitability Trend</h3>
              <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Daily net profit over time</p>
            </div>
          </div>
          <div style={{ height: '230px' }}>
            <LineChart data={chartData} height={230} gradient />
          </div>
        </div>

        {/* Expenses Composition Card */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--t1)' }}>Expenses Composition</h3>
            <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Distribution of operating costs for whole fleet</p>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px', marginTop: '20px' }}>
            {[
              { label: 'Fuel Expenses', val: analytics.fleetFuelCost, icon: <Flame size={14} />, color: '#E8732A' },
              { label: 'Operator Wages', val: analytics.fleetOperatorCost, icon: <Users size={14} />, color: 'var(--green)' },
              { label: 'Crane EMIs', val: analytics.fleetEmiCost, icon: <CreditCard size={14} />, color: '#ffaa00' },
              { label: 'Maintenance Work', val: analytics.fleetMaintenanceCost, icon: <Wrench size={14} />, color: 'var(--red)' },
              { label: 'Fixed Overheads', val: analytics.fleetFixedCost, icon: <Wallet size={14} />, color: '#bd6eff' }
            ].map(c => {
              const pct = analytics.fleetExpenses > 0 ? (c.val / analytics.fleetExpenses) * 100 : 0;
              return (
                <div key={c.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--t1)' }}>
                      <span style={{ color: c.color }}>{c.icon}</span>
                      {c.label}
                    </span>
                    <span style={{ color: 'var(--t2)' }}>{fmtINR(c.val)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg5)', borderRadius: '9px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: '9px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 3: Individual Asset Earning & Expense Tracker (Profitability Leaderboard) ── */}
      <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border)', marginBottom: 28 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)', marginBottom: '18px' }}>Individual Asset Earning &amp; Expense Tracker</h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 10px' }}>Vehicle (Reg)</th>
                <th style={{ padding: '12px 10px' }}>Hours Logged</th>
                <th style={{ padding: '12px 10px' }}>Earned Revenue</th>
                <th style={{ padding: '12px 10px' }}>Total Expenses</th>
                <th style={{ padding: '12px 10px' }}>Net Profit</th>
                <th style={{ padding: '12px 10px' }}>Margin</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {analytics.assetStats.map(as => {
                const isSelected = selectedCraneReg === as.reg;
                let badgeText = 'Standby';
                let badgeColor = 'var(--t3)';
                let badgeBg = 'var(--bg5)';

                if (as.shifts > 0) {
                  if (as.margin > 25) {
                    badgeText = 'High Yield';
                    badgeColor = 'var(--green)';
                    badgeBg = 'var(--green-s)';
                  } else if (as.margin > 0) {
                    badgeText = 'Moderate';
                    badgeColor = '#ffaa00';
                    badgeBg = 'var(--amber-s)';
                  } else {
                    badgeText = 'Loss Maker';
                    badgeColor = 'var(--red)';
                    badgeBg = 'var(--red-s)';
                  }
                }

                return (
                  <tr 
                    key={as.reg} 
                    style={{ borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, color: 'var(--t1)', background: isSelected ? 'var(--bg4)' : 'transparent', transition: 'all 0.15s ease' }}
                  >
                    <td style={{ padding: '16px 10px' }}>
                      <div>
                        <div style={{ color: 'var(--t1)', fontSize: '14px', fontWeight: 800 }}>{as.reg}</div>
                        <div style={{ color: 'var(--t2)', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{as.crane.type || 'Crane'} · {as.crane.model || 'N/A'}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 10px' }}>{fmtHours(as.hours)}</td>
                    <td style={{ padding: '16px 10px', color: 'var(--green)' }}>{fmtINR(as.revenue)}</td>
                    <td style={{ padding: '16px 10px', color: 'var(--red)' }}>{fmtINR(as.totalExpenses)}</td>
                    <td style={{ padding: '16px 10px', color: as.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtINR(as.netProfit)}</td>
                    <td style={{ padding: '16px 10px' }}>
                      <span style={{ color: badgeColor, background: badgeBg, padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {badgeText} ({as.margin.toFixed(0)}%)
                      </span>
                    </td>
                    <td style={{ padding: '16px 10px', textAlign: 'right' }}>
                      <button 
                        onClick={() => setSelectedCraneReg(isSelected ? null : as.reg)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--bg5)',
                          color: 'var(--t1)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isSelected ? 'Collapse' : 'Details'}
                        {isSelected ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Asset Drill-down Card Drawer ── */}
        {selectedAssetDetail && (
          <div style={{ marginTop: '24px', padding: '24px', background: 'var(--bg4)', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)' }}>Granular Diagnostic Drawer: {selectedAssetDetail.reg}</h4>
                <p style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '2px' }}>Comprehensive runtime logs & overhead breakouts for selected dates</p>
              </div>
              <button 
                onClick={() => setSelectedCraneReg(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              {/* Asset stats breakdown */}
              <div style={{ background: 'var(--bg5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h5 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '12px' }}>Profit &amp; Overhead Splits</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', fontWeight: 700 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Timesheet Revenue</span>
                    <span style={{ color: 'var(--green)' }}>{fmtINR(selectedAssetDetail.revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Operator Wages (Shifts)</span>
                    <span style={{ color: 'var(--t1)' }}>{fmtINR(selectedAssetDetail.operatorCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Fuel Expenditures</span>
                    <span style={{ color: 'var(--t1)' }}>{fmtINR(selectedAssetDetail.fuelCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Maintenance Work</span>
                    <span style={{ color: 'var(--t1)' }}>{fmtINR(selectedAssetDetail.maintenanceCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Pro-rata EMI Cost</span>
                    <span style={{ color: 'var(--t1)' }}>{fmtINR(selectedAssetDetail.emiCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--t2)' }}>Pro-rata Fixed Overheads</span>
                    <span style={{ color: 'var(--t1)' }}>{fmtINR(selectedAssetDetail.fixedCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontWeight: 800 }}>
                    <span style={{ color: 'var(--t1)' }}>Net Profit Margin</span>
                    <span style={{ color: selectedAssetDetail.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtINR(selectedAssetDetail.netProfit)} ({selectedAssetDetail.margin.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Fuel and Operating logs */}
              <div style={{ background: 'var(--bg5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <h5 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '12px' }}>Operational Efficiency</h5>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg4)', flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--t2)', fontWeight: 800 }}>Fuel Efficiency</div>
                    <div style={{ fontSize: '16px', color: 'var(--t1)', fontWeight: 800, marginTop: '2px' }}>{selectedAssetDetail.lph.toFixed(1)} L/H</div>
                  </div>
                  <div style={{ background: 'var(--bg4)', flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--t2)', fontWeight: 800 }}>Fuel Litres Filled</div>
                    <div style={{ fontSize: '16px', color: 'var(--t1)', fontWeight: 800, marginTop: '2px' }}>{selectedAssetDetail.fuelLitres.toFixed(0)} L</div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '120px' }}>
                  <h6 style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Fuel Logs</h6>
                  {selectedAssetDetail.fuelLogs.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--t3)', padding: '6px 0' }}>No fuel fillings in selected period.</div>
                  ) : (
                    selectedAssetDetail.fuelLogs.map((fl: any, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ color: 'var(--t2)' }}>{fl.date}</span>
                        <span style={{ color: 'var(--t1)', fontWeight: 700 }}>{fl.litres} L · {fmtINR(fl.cost)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Maintenance logs list */}
              <div style={{ background: 'var(--bg5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <h5 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '12px' }}>Maintenance History</h5>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
                  {selectedAssetDetail.maintenanceLogs.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--t3)', padding: '10px 0' }}>No maintenance records found.</div>
                  ) : (
                    selectedAssetDetail.maintenanceLogs.map((m: any, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                          <span style={{ color: 'var(--t1)' }}>{m.type || 'General Service'}</span>
                          <span style={{ color: 'var(--red)' }}>{fmtINR(m.cost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--t2)' }}>
                          <span>{m.date}</span>
                          <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{m.notes}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Logbook Scans & Timesheet Verification Audit ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: 28 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--t1)' }}>Timesheet &amp; Logbook Scan Audit</h3>
            <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Logged timesheet entries with matching uploaded logbook scans</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px', marginTop: '16px' }}>
            {analytics.fleetMissingLogbooks === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--green)', padding: '20px 0' }}>
                <CheckCircle2 size={36} />
                <span style={{ fontSize: '12px', fontWeight: 700 }}>100% Logbook Compliance</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analytics.assetStats.filter(as => as.missingLogbookCount > 0).map(as => {
                  const op = as.crane.operator || '';
                  const name = state.operators.find(o => o.phone === op || o.id === op)?.name || op;
                  return (
                    <div key={as.reg} style={{ background: 'var(--bg5)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t1)' }}>{as.reg} · {name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--red)', background: 'var(--red-s)', padding: '2px 6px', borderRadius: '6px', fontWeight: 800 }}>
                          {as.missingLogbookCount} Missing Scans
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {as.opTs.map((e, index) => {
                          const userFiles = (state.files[op] || []) as any[];
                          const file = userFiles.find(f => f.name.includes(`Logbook-${e.date}`) || f.name.includes(e.date));
                          return (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg4)', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                              <span style={{ color: 'var(--t2)' }}>{e.date} ({fmtHours(Number(e.hoursDecimal))})</span>
                              {file ? (
                                <button 
                                  onClick={() => openLogbookScan(op, e.date)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                                >
                                  <Eye size={12} /> View Scan
                                </button>
                              ) : (
                                <span style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <XCircle size={12} /> Missing Slip
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Balances & Compliance Dashboard ── */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--t1)' }}>Balances &amp; Compliance Index</h3>
            <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Outstanding client dues, operator payables & RTO certificate flags</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px', flex: 1, justifyContent: 'center' }}>
            {/* Receivables */}
            <div style={{ background: 'var(--bg5)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Client Receivables</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{fmtINR(analytics.clientReceivables)}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                Unpaid Invoices <ArrowRight size={12} />
              </div>
            </div>

            {/* Operator Payables */}
            <div style={{ background: 'var(--bg5)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Operator Payables</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{fmtINR(analytics.operatorPayables)}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                Wages Net of Advances <ArrowRight size={12} />
              </div>
            </div>

            {/* Compliance risk */}
            <div style={{ background: 'var(--bg5)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Compliance Flag Index</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: analytics.complianceRiskCount > 0 ? 'var(--red)' : 'var(--green)', marginTop: '2px' }}>
                  {analytics.complianceRiskCount} Flagged Assets
                </div>
              </div>
              {analytics.complianceRiskCount > 0 ? (
                <div style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}>
                  <AlertTriangle size={14} /> Expiring &lt;30d
                </div>
              ) : (
                <div style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}>
                  <CheckCircle2 size={14} /> Safe &amp; Registered
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Logbook Viewer Scan Overlay Modal ── */}
      <LogbookViewer 
        isOpen={viewerFileUrl !== null} 
        onClose={() => setViewerFileUrl(null)} 
        fileDataUrl={viewerFileUrl} 
        fileName={viewerFileName} 
      />
    </div>
  );
}
