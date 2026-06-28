import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useMobileAppMode } from '../../hooks/useMobileAppMode';
import { fmtINR, fmtHours, calcBill, toISO } from '../../utils';
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
  ArrowRight
} from 'lucide-react';

// Last 12 months as { value: 'YYYY-MM', label: 'Month YYYY' } options for the salary tracker.
function getMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

export function AnalyticsPage({ active }: { active: boolean }) {
  const { state } = useApp();
  const isMobileApp = useMobileAppMode();

  // States
  const [period, setPeriod] = useState<string>('30'); // '7' | '30' | '90' | '180' | 'all'
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string>('');

  // Pending salary tracker is month-scoped, independent of the period pills above.
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [salaryMonth, setSalaryMonth] = useState(monthOptions[0].value);

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

    // Operator Payables + salary-paid coverage
    let operatorPayables = 0;
    let totalOperatorSalary = 0; // sum of every operator's base monthly salary
    let totalOperatorPaid = 0;   // sum of all salary/advance payments made (this period)
    state.operators.forEach(op => {
      const opKey = op.phone || op.id;
      const opStat = assetStats.find(as => as.crane.operator === opKey);
      const earned = opStat ? opStat.operatorCost : 0;
      const advances = ((state.advancePayments[opKey] || []) as any[]).filter((e: any) => !startDateISO || e.date >= startDateISO);
      const totalAdvances = advances.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      operatorPayables += Math.max(earned - totalAdvances, 0);

      const opProfile = (state.operatorProfiles[opKey] || {}) as any;
      totalOperatorSalary += Number(opProfile.salary) || 0;
      totalOperatorPaid += totalAdvances;
    });
    // % of total operator salary that has been paid out, and the remainder still owed.
    const salaryPaidPct = totalOperatorSalary > 0
      ? Math.min(100, Math.round((totalOperatorPaid / totalOperatorSalary) * 100))
      : 0;
    const salaryOwedPct = 100 - salaryPaidPct;

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
      totalOperatorSalary,
      totalOperatorPaid,
      salaryPaidPct,
      salaryOwedPct,
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

  // Per-operator pending salary for the selected month — attendance present-days basis,
  // mirroring the Attendance page so the numbers match there. Present = a timesheet day
  // with hours > 0, or a manual attendance row 'present' (manual overrides).
  const salaryTracker = useMemo(() => {
    const [yr, mo] = salaryMonth.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();

    const rows = (state.operators || []).map(operator => {
      const phone = operator.phone || '';
      const operatorKeys = [phone, String(operator.id)].filter(Boolean);
      const opKey = phone || String(operator.id);
      const profile = (state.operatorProfiles[phone] || state.operatorProfiles[String(operator.id)] || {}) as Record<string, unknown>;
      const salary = Number(profile.salary) || 0;
      const workDays = Number(profile.workingDays) || 26;

      const dayHoursMap: Record<string, number> = {};
      operatorKeys.forEach(key => {
        (state.timesheets[key] || []).forEach(e => {
          const iso = toISO(e?.date || '');
          if (iso) dayHoursMap[iso] = (dayHoursMap[iso] || 0) + (Number(e?.hoursDecimal) || 0);
        });
      });

      const att: Record<string, boolean> = {};
      for (const [iso, hrs] of Object.entries(dayHoursMap)) {
        if (hrs > 0) att[iso] = true;
      }
      (state.attendance || []).filter(a => operatorKeys.includes(a?.operator_key)).forEach(a => {
        if (a?.status === 'present') att[a.date] = true;
        else if (a?.status === 'absent') att[a.date] = false;
      });

      let presentCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (att[iso]) presentCount++;
      }

      const perDay = workDays > 0 ? salary / workDays : 0;
      const earnedGross = Math.round(perDay * presentCount);

      const opAdvances = (state.advancePayments[opKey] || []) as Array<{ date?: string; amount?: number }>;
      const totalAdvances = (Array.isArray(opAdvances) ? opAdvances : [])
        .filter(a => a?.date?.startsWith(salaryMonth))
        .reduce((s, a) => s + (Number(a?.amount) || 0), 0);

      const pendingBalance = earnedGross - totalAdvances;
      return { id: opKey, name: operator.name || '—', presentCount, earnedGross, totalAdvances, pendingBalance };
    });

    rows.sort((a, b) => b.pendingBalance - a.pendingBalance);

    return {
      rows,
      totalPending: rows.reduce((s, r) => s + r.pendingBalance, 0),
      totalEarned: rows.reduce((s, r) => s + r.earnedGross, 0),
      totalAdvances: rows.reduce((s, r) => s + r.totalAdvances, 0),
    };
  }, [state.operators, state.timesheets, state.attendance, state.operatorProfiles, state.advancePayments, salaryMonth]);

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
    <div className="page active analytics-page" id="page-analytics" style={{ background: 'var(--bg)', color: 'var(--t1)', padding: isMobileApp ? '16px 14px 100px' : '24px 20px 100px' }}>
      {/* ── Dashboard Header ── */}
      <header style={{ display: 'flex', alignItems: isMobileApp ? 'stretch' : 'center', flexDirection: isMobileApp ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 28, gap: isMobileApp ? '14px' : undefined }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--fh)', color: 'var(--t1)', letterSpacing: '-0.5px' }}>Fleet Analytics</h2>
          <p style={{ fontSize: '13px', color: 'var(--t2)', marginTop: '4px' }}>Real-time earnings, pro-rata overhead costs & operational efficiency</p>
        </div>
        
        {/* Preset filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', width: isMobileApp ? '100%' : undefined, gap: '8px', background: 'var(--bg3)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobileApp ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: isMobileApp ? '14px' : '20px', marginBottom: 28 }}>
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

        {/* Operator Salary Owed */}
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 170, 0, 0.12)', color: '#ffaa00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operator Salary Owed</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginTop: '2px' }}>{analytics.salaryOwedPct}%</div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>
              {fmtINR(analytics.totalOperatorPaid)} paid / {fmtINR(analytics.totalOperatorSalary)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Fleet Performance Pane (Dynamic Charts & Expenses Breakdown) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobileApp ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: 28 }}>
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

      {/* ── Section 2.5: Operator Pending Salary Tracker (month-scoped) ── */}
      <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: isMobileApp ? '18px 16px' : '24px', border: '1px solid var(--border)', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: isMobileApp ? 'stretch' : 'center', flexDirection: isMobileApp ? 'column' : 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)' }}>Operator Pending Salary</h3>
            <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Earned from attendance minus advances paid · per operator for the selected month</p>
          </div>
          <select
            value={salaryMonth}
            onChange={e => setSalaryMonth(e.target.value)}
            style={{ width: isMobileApp ? '100%' : undefined, fontSize: 13, padding: '10px 16px', border: '1px solid var(--border)', background: 'var(--bg4)', color: 'var(--t1)', borderRadius: 12, outline: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Total pending stat */}
        <div style={{ display: 'flex', alignItems: isMobileApp ? 'flex-start' : 'center', flexDirection: isMobileApp ? 'column' : 'row', gap: '16px', background: 'var(--bg4)', borderRadius: '14px', padding: '18px 20px', border: '1px solid var(--border)', marginBottom: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: salaryTracker.totalPending >= 0 ? 'var(--red-s)' : 'var(--green-s)', color: salaryTracker.totalPending >= 0 ? 'var(--red)' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Pending Salary · All Operators</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: salaryTracker.totalPending >= 0 ? 'var(--t1)' : 'var(--green)', marginTop: '2px' }}>{fmtINR(salaryTracker.totalPending)}</div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '2px' }}>Earned {fmtINR(salaryTracker.totalEarned)} · Advances paid {fmtINR(salaryTracker.totalAdvances)}</div>
          </div>
        </div>

        {/* Per-operator table */}
        {isMobileApp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {salaryTracker.rows.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>No operators yet.</div>
            ) : (
              salaryTracker.rows.map(r => (
                <div key={r.id} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--t1)', fontWeight: 800, fontSize: '14px', marginBottom: '12px' }}>
                    <Users size={14} style={{ color: 'var(--t3)' }} />
                    {r.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'Present Days', value: `${r.presentCount} days`, color: 'var(--t2)' },
                      { label: 'Earned', value: fmtINR(r.earnedGross), color: 'var(--t1)' },
                      { label: 'Advances', value: fmtINR(r.totalAdvances), color: 'var(--t2)' },
                      { label: 'Pending', value: fmtINR(r.pendingBalance), color: r.pendingBalance >= 0 ? 'var(--accent)' : 'var(--green)' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'var(--bg5)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t3)', marginBottom: '4px' }}>{item.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Operator</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Present Days</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Earned</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Advances Paid</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {salaryTracker.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>No operators yet.</td>
                  </tr>
                ) : (
                  salaryTracker.rows.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--t1)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={14} style={{ color: 'var(--t3)' }} />
                          {r.name}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--t2)', fontWeight: 600 }}>{r.presentCount} days</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--t1)', fontWeight: 700 }}>{fmtINR(r.earnedGross)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--t2)', fontWeight: 600 }}>{fmtINR(r.totalAdvances)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: r.pendingBalance >= 0 ? 'var(--accent)' : 'var(--green)' }}>{fmtINR(r.pendingBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3+4: Earning Tracker (half width) beside Audit + Compliance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobileApp ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: 28, alignItems: 'start' }}>
      <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: isMobileApp ? '18px 16px' : '24px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)', marginBottom: '10px' }}>Individual Asset Earning &amp; Expense Tracker</h3>
        
        {isMobileApp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {analytics.assetStats.map(as => {
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
                <div
                  key={as.reg}
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--t1)', fontSize: '14px', fontWeight: 800 }}>{as.reg}</div>
                      <div style={{ color: 'var(--t2)', fontSize: '11px', fontWeight: 500, marginTop: '1px' }}>{as.crane.type || 'Crane'} · {as.crane.model || 'N/A'}</div>
                    </div>
                    <span style={{ color: badgeColor, background: badgeBg, padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', flexShrink: 0 }}>
                      {badgeText} ({as.margin.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[
                      { label: 'Hours', value: fmtHours(as.hours), color: 'var(--t1)' },
                      { label: 'Revenue', value: fmtINR(as.revenue), color: 'var(--green)' },
                      { label: 'Expenses', value: fmtINR(as.totalExpenses), color: 'var(--red)' },
                      { label: 'Net Profit', value: fmtINR(as.netProfit), color: as.netProfit >= 0 ? 'var(--green)' : 'var(--red)' },
                    ].map(item => (
                      <div key={item.label} style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t3)', marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: item.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 10px' }}>Vehicle (Reg)</th>
                <th style={{ padding: '8px 10px' }}>Hours Logged</th>
                <th style={{ padding: '8px 10px' }}>Earned Revenue</th>
                <th style={{ padding: '8px 10px' }}>Total Expenses</th>
                <th style={{ padding: '8px 10px' }}>Net Profit</th>
                <th style={{ padding: '8px 10px' }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {analytics.assetStats.map(as => {
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
                    style={{ borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, color: 'var(--t1)', transition: 'all 0.15s ease' }}
                  >
                    <td style={{ padding: '9px 10px' }}>
                      <div>
                        <div style={{ color: 'var(--t1)', fontSize: '14px', fontWeight: 800 }}>{as.reg}</div>
                        <div style={{ color: 'var(--t2)', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{as.crane.type || 'Crane'} · {as.crane.model || 'N/A'}</div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>{fmtHours(as.hours)}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--green)' }}>{fmtINR(as.revenue)}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--red)' }}>{fmtINR(as.totalExpenses)}</td>
                    <td style={{ padding: '9px 10px', color: as.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtINR(as.netProfit)}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ color: badgeColor, background: badgeBg, padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {badgeText} ({as.margin.toFixed(0)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Right half: Logbook Audit + Balances & Compliance stacked beside the tracker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: isMobileApp ? '18px 16px' : '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ background: 'var(--bg3)', borderRadius: '18px', padding: isMobileApp ? '18px 16px' : '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
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
