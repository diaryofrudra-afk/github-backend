import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { fmtINR, calcBill } from '../../utils';
import type { TimesheetEntry } from '../../types';

export function FloatingDashboard() {
  const { state, userRole } = useApp();
  const { blackbuck } = useData();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const stats = useMemo(() => {
    if (userRole !== 'owner') return null;

    let totalRev = 0;
    state.cranes.forEach(crane => {
      const op = crane.operator;
      const opTs: TimesheetEntry[] = (op ? state.timesheets[op] : undefined) || [];
      opTs.forEach(e => {
        const h = Number(e.hoursDecimal) || 0;
        const b = calcBill(h, crane, 0); // Simplified for quick dashboard
        if (b) totalRev += b.total;
      });
    });

    const deployed = state.cranes.filter(c => c.operator).length;
    const utilPct = state.cranes.length ? Math.round((deployed / state.cranes.length) * 100) : 0;

    // Sync with GPS engine count
    const gpsVehicles = blackbuck?.vehicles || [];
    const engineOn = gpsVehicles.filter(v => v.engine_on === true).length;
    const totalVehicles = gpsVehicles.length || state.cranes.length;

    return { totalRev, deployed, total: state.cranes.length, utilPct, engineOn, totalVehicles };
  }, [state, userRole, blackbuck]);

  if (!stats) return null;

  if (isCollapsed) {
    return (
      <button className="fd-trigger" onClick={() => setIsCollapsed(false)} title="Show Stats">
        <div className="fd-pulse-dot" />
        <span className="fd-trigger-text">Fleet Pulse</span>
      </button>
    );
  }

  return (
    <div className="floating-dashboard">
      <button className="fd-close-btn" onClick={() => setIsCollapsed(true)} title="Hide Stats">×</button>
      <div className="fd-item">
        <span className="fd-label">Revenue</span>
        <span className="fd-value accent">{fmtINR(stats.totalRev)}</span>
      </div>
      <div className="fd-divider" />
      <div className="fd-item">
        <span className="fd-label">Utilization</span>
        <span className="fd-value amber">{stats.utilPct}%</span>
      </div>
      <div className="fd-divider" />
      <div className="fd-item">
        <span className="fd-label">Active Fleet</span>
        <span className="fd-value green">{stats.engineOn}/{stats.totalVehicles}</span>
      </div>
    </div>
  );
}
