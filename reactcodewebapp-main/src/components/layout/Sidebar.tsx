import { useApp } from '../../context/AppContext';
import {
  Sun,
  Moon,
} from 'lucide-react';
import type { PageId } from '../../types';
import * as React from 'react';

interface SidebarProps {
  onSignOut: () => void;
}

interface NavItem {
  page: PageId;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  countId?: string;
}

// Custom Premium SVG Icons from Mockup Design
const FleetIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="0.75" y="4" width="13.5" height="9.25" rx="1.75" stroke="currentColor" strokeWidth="1.6" />
    <path d="M14.25 7.5h2.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <circle cx="4.5" cy="13.5" r="1.75" fill="currentColor" />
    <circle cx="11.5" cy="13.5" r="1.75" fill="currentColor" />
  </svg>
);

const AnalyticsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1" y="1" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 13l3-4 3 2.5 3-5 2 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const BillingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1" y="3" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 7h16" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3.5" y="11" width="4" height="2" rx="0.5" fill="currentColor" />
    <rect x="9.5" y="11" width="4" height="2" rx="0.5" fill="currentColor" />
  </svg>
);

const GPSIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 7v2.5l2 1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <path d="M9 14v3M6 16.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const FuelIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="2" y="2" width="9" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 5.5l3.5 2v4.5a1 1 0 0 1-1 1H11" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4" y="5" width="5" height="4" rx="1" fill="currentColor" />
  </svg>
);

const CamerasIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7.5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14 5.5l4.5-2.5v9L14 9.5V5.5z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const DocumentsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4 1.5h6L14.5 6v10a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9.5 1.5V6h4.5M6 9.5h6M6 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClientsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="7" cy="5.5" r="3" stroke="currentColor" stroke-width="1.5" />
    <path d="M1 15c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke="currentColor" strokeLinecap="round" stroke-width="1.5" />
    <circle cx="15.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M13 14c0-2 1.1-3.5 2.5-3.5s2.5 1.5 2.5 3.5" stroke="currentColor" strokeLinecap="round" stroke-width="1.5" />
  </svg>
);

const OperatorsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="9" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M2 17c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeLinecap="round" stroke-width="1.5" />
  </svg>
);

const EarningsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M9 4.5v9M6.5 7h3.5a1.5 1.5 0 0 1 0 3H8a1.5 1.5 0 0 0 0 3H11.5" stroke="currentColor" strokeLinecap="round" stroke-width="1.5" />
  </svg>
);

const AttendanceIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1.5" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 1.5V5M12 1.5V5M1.5 8h15" stroke="currentColor" strokeLinecap="round" stroke-width="1.5" />
    <path d="M6 12l2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const HistoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M9 4.5v5.5l3.5 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const COMMAND_ITEMS: NavItem[] = [
  { page: 'fleet', name: 'Fleet', icon: FleetIcon, countId: 'nc-fleet' },
  { page: 'analytics', name: 'Analytics', icon: AnalyticsIcon },
  { page: 'billing', name: 'Billing', icon: BillingIcon },
  { page: 'gps', name: 'Live GPS', icon: GPSIcon },
  { page: 'fuel', name: 'Fuel', icon: FuelIcon },
  { page: 'cameras', name: 'Cameras', icon: CamerasIcon },
  { page: 'diagnostics', name: 'Documents', icon: DocumentsIcon, countId: 'nc-diag' },
];

const MANAGE_ITEMS: NavItem[] = [
  { page: 'clients', name: 'Clients', icon: ClientsIcon },
  { page: 'operators', name: 'Operators', icon: OperatorsIcon, countId: 'nc-ops' },
  { page: 'earnings', name: 'Earnings', icon: EarningsIcon },
  { page: 'attendance', name: 'Attendance', icon: AttendanceIcon },
];

const OPERATOR_ITEMS: NavItem[] = [
  { page: 'logger', name: 'Log Time', icon: AttendanceIcon },
  { page: 'op-history', name: 'History', icon: HistoryIcon, countId: 'nc-op-ts' },
  { page: 'attendance', name: 'Attendance', icon: AttendanceIcon },
];

export function Sidebar({ onSignOut }: SidebarProps) {
  const {
    state,
    activePage,
    setActivePage,
    sidebarCollapsed,
    userRole,
    theme,
    toggleTheme,
    setSettingsOpen,
    toggleSidebar,
  } = useApp();

  const isOwner = userRole === 'owner';
  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  const profile = state.ownerProfile;
  const displayName = isOwner
    ? (profile.company || profile.name || 'RUDRA CRANE SERVICE')
    : 'RUDRA CRANE SERVICE';
  const initials = displayName.slice(0, 2).toUpperCase();
  const photo = isOwner ? profile.photo : undefined;

  return (
    <aside
      id="sidebar"
      className={`h-screen ${sidebarCollapsed ? 'w-[80px]' : 'w-[218px]'} flex flex-col overflow-hidden transition-[width] duration-300`}
      style={{
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        color: 'var(--t1)',
        fontFamily: "'Plus Jakarta Sans', var(--fh), sans-serif",
      }}
    >
      {/* HEADER / LOGO */}
      <div
        className={`${sidebarCollapsed ? 'px-3' : 'px-[16px]'} py-[16px] flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-[10px]'} cursor-pointer select-none`}
        style={{
          borderBottom: `1px solid ${isLight ? '#F5F6F8' : 'var(--border)'}`,
          paddingTop: '18px',
          paddingBottom: '14px',
        }}
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: '34px',
            height: '34px',
            background: '#F97316',
            borderRadius: '9px',
            boxShadow: '0 2px 8px rgba(249,115,22,0.32)',
          }}
        >
          <svg fill="none" height="18" viewBox="0 0 20 20" width="18" xmlns="http://www.w3.org/2000/svg">
            <rect fill="white" height="7" rx="1.5" width="7" x="2" y="2" />
            <rect fill="white" height="7" opacity="0.72" rx="1.5" width="7" x="11" y="2" />
            <rect fill="white" height="7" opacity="0.72" rx="1.5" width="7" x="2" y="11" />
            <rect fill="white" height="7" rx="1.5" width="7" x="11" y="11" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <span
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: isLight ? '#0F172A' : 'var(--t1)',
              letterSpacing: '-0.5px',
            }}
          >
            Suprwise
          </span>
        )}
      </div>

      {/* NAV CONTENT */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-[10px]'} py-2 flex flex-col`}
      >
        <div className="flex-1">
          {isOwner ? (
            <>
              {/* COMMAND SECTION */}
              {!sidebarCollapsed && (
                <p
                  className="text-[9.5px] font-bold tracking-[1px] uppercase mb-1 px-2 pt-2 pb-1"
                  style={{ color: isLight ? '#A8B4C5' : 'var(--t3)' }}
                >
                  Command
                </p>
              )}
              <div className="space-y-[2px]">
                {COMMAND_ITEMS.map((item) => (
                  <NavButton
                    key={item.page}
                    item={item}
                    active={activePage === item.page}
                    collapsed={sidebarCollapsed}
                    onClick={() => setActivePage(item.page)}
                  />
                ))}
              </div>

              {!sidebarCollapsed && <div className="h-px my-2 rounded-full" style={{ background: isLight ? '#EAECF0' : 'var(--border)' }} />}

              {/* MANAGE SECTION */}
              {!sidebarCollapsed && (
                <p
                  className="text-[9.5px] font-bold tracking-[1px] uppercase mb-1 px-2 pt-2.5 pb-1"
                  style={{ color: isLight ? '#A8B4C5' : 'var(--t3)' }}
                >
                  Manage
                </p>
              )}
              <div className="space-y-[2px]">
                {MANAGE_ITEMS.map((item) => (
                  <NavButton
                    key={item.page}
                    item={item}
                    active={activePage === item.page}
                    collapsed={sidebarCollapsed}
                    onClick={() => setActivePage(item.page)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* OPERATOR SECTION */}
              {!sidebarCollapsed && (
                <p
                  className="text-[9.5px] font-bold tracking-[1px] uppercase mb-1 px-2 pt-2 pb-1"
                  style={{ color: isLight ? '#A8B4C5' : 'var(--t3)' }}
                >
                  Operator View
                </p>
              )}
              <div className="space-y-[2px]">
                {OPERATOR_ITEMS.map((item) => (
                  <NavButton
                    key={item.page}
                    item={item}
                    active={activePage === item.page}
                    collapsed={sidebarCollapsed}
                    onClick={() => setActivePage(item.page)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div
          className="pt-2.5 mt-2"
          style={{
            borderTop: `1px solid ${isLight ? '#F5F6F8' : 'var(--border)'}`,
          }}
        >
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-1.5 py-1">
              {/* Collapsed Avatar */}
              <div
                className="h-[33px] w-[33px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-extrabold text-[11.5px] tracking-[-0.04em] shadow-lg shadow-orange-500/20 overflow-hidden cursor-pointer relative shrink-0"
                onClick={() => setSettingsOpen(true)}
                title={displayName}
              >
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
                <div
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#22C55E]"
                  style={{ border: `1.5px solid ${isLight ? '#ffffff' : 'var(--bg2)'}` }}
                />
              </div>

              {/* Theme & Logout Buttons */}
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle Theme"
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: 'var(--t2)', background: 'transparent', border: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isLight ? '#E2E8F0' : 'var(--bg3)';
                  e.currentTarget.style.color = 'var(--t1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--t2)';
                }}
              >
                {isDark ? (
                  <Sun strokeWidth={2.2} className="h-[16px] w-[16px]" />
                ) : (
                  <Moon strokeWidth={2.2} className="h-[16px] w-[16px]" />
                )}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign Out"
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: 'var(--t2)', background: 'transparent', border: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isLight ? '#FEE2E2' : 'var(--red-s)';
                  e.currentTarget.style.color = 'var(--red)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--t2)';
                }}
              >
                <svg fill="none" height="15" viewBox="0 0 20 20" width="15" className="h-[15px] w-[15px]">
                  <path d="M13.5 4H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.5M8.5 13.5l-4-3.5 4-3.5M4.5 10h11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          ) : (
            /* Expanded Footer Card */
            <div
              className="flex items-center gap-2 p-[8px] pl-[10px] rounded-[11px] cursor-pointer transition-colors select-none"
              style={{
                background: isLight ? '#F8FAFC' : 'var(--bg3)',
                border: `1px solid ${isLight ? '#EAECF0' : 'var(--border)'}`,
              }}
              onClick={() => setSettingsOpen(true)}
            >
              {/* Avatar */}
              <div
                className="h-[33px] w-[33px] rounded-full bg-[#F97316] flex items-center justify-center text-white font-extrabold text-[11.5px] tracking-[-0.04em] overflow-hidden relative shrink-0"
              >
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
                <div
                  className="absolute bottom-[-1px] right-[-1px] h-[10px] w-[10px] rounded-full bg-[#22C55E]"
                  style={{ border: `2px solid ${isLight ? '#F8FAFC' : 'var(--bg3)'}` }}
                />
              </div>

              {/* Name & Role */}
              <div className="min-w-0 flex-1">
                <h2
                  className="text-[11.5px] font-bold tracking-[-0.02em] leading-tight truncate"
                  style={{ color: isLight ? '#0F172A' : 'var(--t1)' }}
                  title={displayName}
                >
                  {displayName}
                </h2>
                <p
                  className="text-[10px] font-medium leading-none mt-0.5"
                  style={{ color: isLight ? '#94A3B8' : 'var(--t3)' }}
                >
                  {isOwner ? 'Owner' : 'Operator'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title="Toggle Theme"
                  className="h-[30px] w-[30px] rounded-[7px] flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--t2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isLight ? '#E2E8F0' : 'var(--bg4)';
                    e.currentTarget.style.color = 'var(--t1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--t2)';
                  }}
                >
                  {isDark ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
                      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg fill="none" height="15" viewBox="0 0 20 20" width="15" className="h-[15px] w-[15px]">
                      <path d="M17.5 13A8.5 8.5 0 0 1 7.5 2 8.5 8.5 0 1 0 17.5 13z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
                    </svg>
                  )}
                </button>

                {/* Logout */}
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out"
                  className="h-[30px] w-[30px] rounded-[7px] flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--t2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isLight ? '#FEE2E2' : 'var(--red-s)';
                    e.currentTarget.style.color = 'var(--red)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--t2)';
                  }}
                >
                  <svg fill="none" height="15" viewBox="0 0 20 20" width="15" className="h-[15px] w-[15px]">
                    <path d="M13.5 4H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.5M8.5 13.5l-4-3.5 4-3.5M4.5 10h11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavButton({ item, active, collapsed, onClick }: NavButtonProps) {
  const Icon = item.icon;
  const { theme } = useApp();
  const isLight = theme === 'light';

  const activeBg = isLight ? '#FFF3E8' : 'var(--accent-g)';
  const activeBorder = isLight ? '#FED7AA' : 'var(--accent-s)';
  const activeColor = isLight ? '#F97316' : 'var(--accent)';

  const inactiveColor = isLight ? '#64748B' : 'var(--t2)';
  const hoverBg = isLight ? '#F8FAFC' : 'var(--bg3)';

  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={`group w-full h-[36px] rounded-[9px] flex items-center ${collapsed ? 'justify-center px-0' : 'gap-[10px] px-[10px]'} transition-all duration-200 cursor-pointer mb-[2px]`}
      style={{
        background: active ? activeBg : 'transparent',
        border: `1px solid ${active ? activeBorder : 'transparent'}`,
        color: active ? activeColor : inactiveColor,
        fontFamily: "'Plus Jakarta Sans', var(--fh), sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: '16px',
          height: '16px',
        }}
      >
        <Icon
          className="h-full w-full"
          style={{
            color: active ? activeColor : inactiveColor,
          }}
        />
      </div>
      {!collapsed && (
        <>
          <span
            className="text-[13px] tracking-[-0.02em]"
            style={{
              fontWeight: active ? 700 : 500,
              color: active ? activeColor : (isLight ? '#64748B' : 'var(--t1)'),
            }}
          >
            {item.name}
          </span>
          {item.countId && (
            <span
              id={item.countId}
              className="ml-auto text-[10px] font-bold rounded-[10px] px-1.5 py-[1px] min-w-[18px] text-center empty:hidden"
              style={{
                background: active ? activeColor : (isLight ? '#E2E8F0' : 'var(--bg4)'),
                color: active ? '#ffffff' : (isLight ? '#475569' : 'var(--t2)'),
                lineHeight: '1.4',
              }}
            />
          )}
        </>
      )}
    </button>
  );
}

