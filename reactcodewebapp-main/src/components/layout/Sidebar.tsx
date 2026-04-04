import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarUser } from './SidebarUser';
import billingIcon from '../../assets/invoice-2.png';
import analyticsIcon from '../../assets/analytics-2.png';
import craneIcon from '../../assets/crane.png';
import fuelIcon from '../../assets/gas-station.png';
import gpsIcon from '../../assets/gps.png';
import camerasIcon from '../../assets/security-camera.png';
import diagnosticsIcon from '../../assets/diagnostic.png';
import operatorsIcon from '../../assets/builders.png';
import earningsIcon from '../../assets/money.png';
import attendanceIcon from '../../assets/availability.png';

// ── Icon components ──────────────────────────────────────────────────────────

function FleetIcon(): ReactNode {
  return <img src={craneIcon} alt="Fleet" style={{ width: 20, height: 20 }} />;
}

function AnalyticsIcon(): ReactNode {
  return <img src={analyticsIcon} alt="Analytics" style={{ width: 20, height: 20 }} />;
}

function BillingIcon(): ReactNode {
  return <img src={billingIcon} alt="Billing" style={{ width: 20, height: 20 }} />;
}

function GpsIcon(): ReactNode {
  return <img src={gpsIcon} alt="GPS" style={{ width: 20, height: 20 }} />;
}

function FuelIcon(): ReactNode {
  return <img src={fuelIcon} alt="Fuel" style={{ width: 20, height: 20 }} />;
}

function CamerasIcon(): ReactNode {
  return <img src={camerasIcon} alt="Cameras" style={{ width: 20, height: 20 }} />;
}

function DiagnosticsIcon(): ReactNode {
  return <img src={diagnosticsIcon} alt="Diagnostics" style={{ width: 20, height: 20 }} />;
}


function OperatorsIcon(): ReactNode {
  return <img src={operatorsIcon} alt="Operators" style={{ width: 20, height: 20 }} />;
}

function EarningsIcon(): ReactNode {
  return <img src={earningsIcon} alt="Earnings" style={{ width: 20, height: 20 }} />;
}

function AttendanceIcon(): ReactNode {
  return <img src={attendanceIcon} alt="Attendance" style={{ width: 20, height: 20 }} />;
}

function LoggerIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function OpHistoryIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}




// ── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  onSignOut: () => void;
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const { sidebarCollapsed, userRole } = useApp();
  const isOwner = userRole === 'owner';

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`} id="sidebar">
      <SidebarHeader />

      <div className="sidebar-nav">
        {isOwner && (
          <>
            {/* ── Command section ── */}
            <div className="nav-section-label">Command</div>

            <SidebarNavItem page="fleet" label="Fleet" icon={<FleetIcon />} countId="nc-fleet" />
            <SidebarNavItem page="analytics" label="Analytics" icon={<AnalyticsIcon />} />
            <SidebarNavItem page="billing" label="Billing" icon={<BillingIcon />} />
            <SidebarNavItem page="gps" label="Live GPS" icon={<GpsIcon />} />
            <SidebarNavItem page="fuel" label="Fuel" icon={<FuelIcon />} />
            <SidebarNavItem page="cameras" label="Cameras" icon={<CamerasIcon />} />
            <SidebarNavItem page="diagnostics" label="Diagnostics" icon={<DiagnosticsIcon />} countId="nc-diag" />

            {/* ── Manage section ── */}
            <div className="nav-section-divider" />
            <div className="nav-section-label">Manage</div>


            <SidebarNavItem page="operators" label="Operators" icon={<OperatorsIcon />} countId="nc-ops" />
            <SidebarNavItem page="earnings" label="Earnings" icon={<EarningsIcon />} />
            <SidebarNavItem page="attendance" label="Attendance" icon={<AttendanceIcon />} />
          </>
        )}

        {!isOwner && (
          <>
            {/* ── Operator View section ── */}
            <div className="nav-section-label">Operator View</div>

            <SidebarNavItem page="logger" label="Log Time" icon={<LoggerIcon />} />
            <SidebarNavItem page="op-history" label="History" icon={<OpHistoryIcon />} countId="nc-op-ts" />
            <SidebarNavItem page="attendance" label="Attendance" icon={<AttendanceIcon />} />
          </>
        )}
      </div>

      <SidebarUser onSignOut={onSignOut} />
    </aside>
  );
}
