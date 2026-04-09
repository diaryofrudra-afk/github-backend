import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useUnifiedGPS } from '../../hooks/useUnifiedGPS';
import { fmtINR, calcBill } from '../../utils';
import type { TimesheetEntry } from '../../types';

export function FloatingDashboard() {
  const { state, userRole } = useApp();
  const { vehicles: gpsVehicles } = useUnifiedGPS({ pollInterval: 30000 });
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

    // Sync with unified GPS engine count — only for vehicles in the fleet
    const fleetRegs = new Set(state.cranes.map(c => c.reg?.toUpperCase()).filter(Boolean));
    const fleetGpsVehicles = gpsVehicles.filter(v =>
      fleetRegs.has(v.registration_number?.toUpperCase())
    );
    const engineOn = fleetGpsVehicles.filter(v => v.engine_on === true || v.ignition === 'on').length;
    const totalVehicles = fleetGpsVehicles.length || state.cranes.length;

    return { totalRev, deployed, total: state.cranes.length, utilPct, engineOn, totalVehicles };
  }, [state, userRole, gpsVehicles]);

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
    <div className="floating-dashboard" onClick={() => setIsCollapsed(true)} style={{ cursor: 'pointer' }}>
      <div className="fd-item">
        <span className="fd-label">Revenue</span>
        <span className="fd-value">{fmtINR(stats.totalRev)}</span>
      </div>
      <div className="fd-divider" />
      <div className="fd-item">
        <span className="fd-label">Utilization</span>
        <span className="fd-value">{stats.utilPct}%</span>
      </div>
      <div className="fd-divider" />
      <div className="fd-item">
        <span className="fd-label">Active Fleet</span>
        <span className="fd-value">{stats.engineOn}/{stats.totalVehicles}</span>
      </div>
    </div>
  );
}
