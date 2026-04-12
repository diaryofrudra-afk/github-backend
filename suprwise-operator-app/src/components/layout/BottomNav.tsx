import { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface BottomNavProps {
  onSignOut: () => void;
}

export function BottomNav({ onSignOut }: BottomNavProps) {
  const { activePage, setActivePage, toggleTheme, setSettingsOpen, user, userRole, state } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  // Get operator details
  const operators = state?.operators || [];
  const currentOperator = userRole === 'operator'
    ? operators.find(op => op.phone === user || String(op.id) === user)
    : null;
  const opName = currentOperator?.name || '';
  const opPhone = currentOperator?.phone || user || '';

  // Initials: prefer name words, fall back to last 2 digits of phone
  const initials = opName
    ? opName.split(' ').map((w: string) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : (user || '').replace(/\D/g, '').slice(-2) || 'OP';

  // Calculate attendance stats
  const attendance = state?.attendance || [];
  const operatorKeys = currentOperator ? [currentOperator.phone, String(currentOperator.id)].filter(Boolean) : [];
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let presentCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const att = attendance.find(a => operatorKeys.includes(a.operator_key) && a.date === iso && a.status === 'present');
    if (att) presentCount++;
  }

  const tabs = [
    {
      page: 'logger' as const, label: 'Log Time', icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      page: 'op-history' as const, label: 'History', icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      page: 'attendance' as const, label: 'Attendance', icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      )
    },
  ];

  function handleDocuments() {
    setMenuOpen(false);
    setSettingsOpen(true);
  }

  function handleLogout() {
    setMenuOpen(false);
    onSignOut();
  }

  return (
    <>
      {/* Invisible dismiss layer */}
      {menuOpen && (
        <div className="bnp-dismiss" onClick={() => setMenuOpen(false)} />
      )}

      {/* Floating profile card — anchored above profile tab */}
      <div className={`bnp-float${menuOpen ? ' open' : ''}`}>
        {/* User row at top */}
        <div className="bnp-float-user">
          <div className="bnp-float-avatar">{initials}</div>
          <div className="bnp-float-userinfo">
            <div className="bnp-float-name">{opName || opPhone}</div>
            {opName && <div className="bnp-float-phone">{opPhone}</div>}
          </div>
        </div>

        <div className="bnp-float-sep" />

        {/* Account Settings */}
        <button className="bnp-float-item" onClick={handleDocuments}>
          <div className="bnp-float-icon bnp-fi-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <span className="bnp-float-label">Account settings</span>
        </button>

        <div className="bnp-float-sep" />

        {/* Dark Mode */}
        <button className="bnp-float-item" onClick={toggleTheme}>
          <div className="bnp-float-icon bnp-fi-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </div>
          <span className="bnp-float-label">Dark mode</span>
        </button>

        <div className="bnp-float-sep" />

        {/* Log out */}
        <button className="bnp-float-item bnp-float-logout" onClick={handleLogout}>
          <div className="bnp-float-icon bnp-fi-red">
            <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <span className="bnp-float-label">Log out</span>
        </button>
      </div>

      {/* Spacer */}
      <div id="bottom-nav-spacer" />

      {/* Bottom Nav — Modern Floating Style */}
      <nav id="bottom-nav">
        <div className="bottom-nav-inner">
          {tabs.map((tab) => {
            const isActive = activePage === tab.page;
            return (
              <button
                key={tab.page}
                className={`bottom-nav-tab${isActive ? ' active' : ''}`}
                onClick={() => setActivePage(tab.page)}
                aria-label={tab.label}
              >
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span className="bottom-nav-label">{tab.label}</span>
                {isActive && <span className="bottom-nav-indicator" />}
              </button>
            );
          })}

          {/* Profile Tab */}
          <button
            className={`bottom-nav-tab bottom-nav-tab-profile${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Profile"
          >
            <span className="bottom-nav-icon bottom-nav-profile-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="8" r="3" />
                <path d="M8.5 6C8.5 3.5 10 2 12 2s3.5 1.5 3.5 4" />
                <line x1="6.5" y1="6" x2="17.5" y2="6" />
              </svg>
              {presentCount > 0 && (
                <span className="bottom-nav-profile-count">{presentCount}</span>
              )}
            </span>
            <span className="bottom-nav-label">Profile</span>
            {menuOpen && <span className="bottom-nav-indicator" />}
          </button>
        </div>
      </nav>
    </>
  );
}
