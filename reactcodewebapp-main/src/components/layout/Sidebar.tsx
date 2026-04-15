import type { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarUser } from './SidebarUser';

// ── Icon components (Lucide-style SVGs matching reference design) ────────────

function FleetIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-4.293-1.43a1 1 0 0 1-.623-.948V7a1 1 0 0 0-1-1h-1.5" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function AnalyticsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function BillingIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  );
}

function GpsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FuelIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" x2="15" y1="22" y2="22" />
      <line x1="4" x2="14" y1="9" y2="9" />
      <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
      <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
    </svg>
  );
}

function CamerasIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect height="12" rx="2" ry="2" width="14" x="2" y="6" />
    </svg>
  );
}

function DiagnosticsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function EngineStatusIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function OperatorsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function EarningsIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function AttendanceIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function LoggerIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function OpHistoryIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  onSignOut: () => void;
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const { sidebarCollapsed, userRole } = useApp();
  const isOwner = userRole === 'owner';

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`} id="sidebar">
      <SidebarHeader />

      <nav className="sidebar-nav">
        {isOwner && (
          <>
            {/* ── Command section ── */}
            {!sidebarCollapsed && <div className="nav-section-label">Command</div>}
            <section data-purpose="navigation-section">
              <ul className="space-y-2">
                <li className="flex justify-center">
                  <SidebarNavItem page="fleet" label="Fleet" icon={<FleetIcon />} countId="nc-fleet" />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="analytics" label="Analytics" icon={<AnalyticsIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="billing" label="Billing" icon={<BillingIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="gps" label="Live GPS" icon={<GpsIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="fuel" label="Fuel" icon={<FuelIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="cameras" label="Cameras" icon={<CamerasIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="diagnostics" label="Diagnostics" icon={<DiagnosticsIcon />} countId="nc-diag" />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="engine-status" label="Engine History" icon={<EngineStatusIcon />} />
                </li>
              </ul>
            </section>

            {/* ── Manage section ── */}
            <div className="nav-section-divider" />

            {!sidebarCollapsed && <div className="nav-section-label">Manage</div>}
            <section data-purpose="navigation-section">
              <ul className="space-y-2">
                <li className="flex justify-center">
                  <SidebarNavItem page="operators" label="Operators" icon={<OperatorsIcon />} countId="nc-ops" />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="earnings" label="Earnings" icon={<EarningsIcon />} />
                </li>
                <li className="flex justify-center">
                  <SidebarNavItem page="attendance" label="Attendance" icon={<AttendanceIcon />} />
                </li>
              </ul>
            </section>
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
      </nav>

      <SidebarUser onSignOut={onSignOut} />
    </aside>
  );
}
