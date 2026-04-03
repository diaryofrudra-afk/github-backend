import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarUser } from './SidebarUser';

// ── Icon components ──────────────────────────────────────────────────────────

function FleetIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Base / tracks - shifted +2px right */}
      <path d="M4 21h14" />
      <rect x="5" y="18" width="12" height="3" rx="1.5" />
      {/* Cabin */}
      <rect x="11" y="13" width="5" height="5" rx="0.5" />
      <line x1="12.5" y1="13" x2="12.5" y2="18" />
      {/* Boom arm */}
      <line x1="13" y1="13" x2="5" y2="4" />
      {/* Hook cable + hook */}
      <line x1="5" y1="4" x2="5" y2="8" />
      <path d="M4 8.5a1.2 1.2 0 1 0 2 0" />
      {/* Boom support strut */}
      <line x1="9" y1="18" x2="8" y2="9" />
    </svg>
  );
}

function AnalyticsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function BillingIcon(): ReactNode {
  return (
    <svg className="rupee-icon" viewBox="0 0 24 24" stroke="none">
      <text x="12" y="15.5" textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">₹</text>
    </svg>
  );
}

function GpsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FuelIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M5 21h10" />
      <rect x="6" y="3" width="9" height="18" rx="1.5" />
      <rect x="8" y="6" width="5" height="4" rx="0.5" />
      <path d="M15 8h2.5a1.5 1.5 0 0 1 1.5 1.5v7" />
      <circle cx="19" cy="18" r="1.5" />
    </svg>
  );
}

function CamerasIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function DiagnosticsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}


function OperatorsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2" />
      <circle cx="8" cy="7" r="4" />
      <line x1="22" y1="18" x2="22" y2="12" />
      <line x1="19" y1="15" x2="25" y2="15" />
    </svg>
  );
}

function EarningsIcon(): ReactNode {
  return (
    <svg className="rupee-icon" viewBox="0 0 24 24" stroke="none">
      <text x="12" y="15.5" textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">₹</text>
    </svg>
  );
}

function AttendanceIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
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
            <div className="nav-section-divider" />

            <SidebarNavItem page="fleet"       label="Fleet"        icon={<FleetIcon />}       countId="nc-fleet" />
            <SidebarNavItem page="analytics"   label="Analytics"    icon={<AnalyticsIcon />} />
            <SidebarNavItem page="billing"     label="Billing"      icon={<BillingIcon />} />
            <SidebarNavItem page="gps"         label="Live GPS"     icon={<GpsIcon />} />
            <SidebarNavItem page="fuel"        label="Fuel"         icon={<FuelIcon />} />
            <SidebarNavItem page="cameras"     label="Cameras"      icon={<CamerasIcon />} />
            <SidebarNavItem page="diagnostics" label="Diagnostics"  icon={<DiagnosticsIcon />} countId="nc-diag" />

            {/* ── Manage section ── */}
            <div className="nav-section-label">Manage</div>
            <div className="nav-section-divider" />


            <SidebarNavItem page="operators" label="Operators"  icon={<OperatorsIcon />} countId="nc-ops" />
            <SidebarNavItem page="earnings"  label="Earnings"   icon={<EarningsIcon />} />
            <SidebarNavItem page="attendance" label="Attendance" icon={<AttendanceIcon />} />
          </>
        )}

        {!isOwner && (
          <>
            {/* ── Operator View section ── */}
            <div className="nav-section-label">Operator View</div>
            <div className="nav-section-divider" />

            <SidebarNavItem page="logger"     label="Log Time" icon={<LoggerIcon />} />
            <SidebarNavItem page="op-history" label="History"  icon={<OpHistoryIcon />} countId="nc-op-ts" />
            <SidebarNavItem page="attendance" label="Attendance" icon={<AttendanceIcon />} />
          </>
        )}
      </div>

      <SidebarUser onSignOut={onSignOut} />
    </aside>
  );
}
