import { useApp } from '../../context/AppContext';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function MobileDrawer({ open, onClose, onSignOut }: MobileDrawerProps) {
  const { activePage, setActivePage, user, setSettingsOpen } = useApp();
  const initials = user ? user.slice(0, 2).toUpperCase() : '—';

  function nav(page: Parameters<typeof setActivePage>[0]) {
    setActivePage(page);
    onClose();
  }

  return (
    <>
      <div
        id="mobile-drawer-overlay"
        className={open ? 'open' : ''}
        onClick={onClose}
      />
      <div id="mobile-drawer" className={open ? 'open' : ''}>
        <div className="drawer-header">
          <div className="drawer-logo">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              <path d="M2 20h20" />
              <path d="M10 4v16" />
              <path d="M10 4l8 4" />
              <path d="M18 8v12" />
            </svg>
          </div>
          <span className="drawer-brand">Suprwise</span>
          <button className="drawer-close" id="btn-drawer-close" onClick={onClose}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Owner nav */}
        <div id="drawer-nav-owner">
          <div className="nav-section-label">Command</div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'fleet' ? ' active' : ''}`}
            onClick={() => nav('fleet')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M2 20h20" />
              <path d="M10 4v16" />
              <path d="M10 4l8 4" />
              <path d="M18 8v12" />
            </svg>
            Fleet
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'analytics' ? ' active' : ''}`}
            onClick={() => nav('analytics')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'billing' ? ' active' : ''}`}
            onClick={() => nav('billing')}
          >
            <svg className="rupee-icon" viewBox="0 0 24 24" stroke="none">
              <text x="12" y="15.5" textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">₹</text>
            </svg>
            Billing
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'gps' ? ' active' : ''}`}
            onClick={() => nav('gps')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Live GPS
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'fuel' ? ' active' : ''}`}
            onClick={() => nav('fuel')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M3 22V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15" />
              <path d="M6 9h6v4H6z" />
              <path d="M17 10h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
              <circle cx="19" cy="8" r="1" fill="currentColor" />
              <path d="M19 18v3" />
            </svg>
            Fuel
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'cameras' ? ' active' : ''}`}
            onClick={() => nav('cameras')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Cameras
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'diagnostics' ? ' active' : ''}`}
            onClick={() => nav('diagnostics')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Diagnostics
          </div>

          <div className="nav-section-label">Manage</div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'operators' ? ' active' : ''}`}
            onClick={() => nav('operators')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="23" y1="21" x2="23" y2="15" />
              <line x1="20" y1="18" x2="26" y2="18" />
            </svg>
            Manage Operators
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'earnings' ? ' active' : ''}`}
            onClick={() => nav('earnings')}
          >
            <svg className="rupee-icon" viewBox="0 0 24 24" stroke="none">
              <text x="12" y="15.5" textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="600" fontFamily="system-ui,-apple-system,sans-serif">₹</text>
            </svg>
            Earnings
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'attendance' ? ' active' : ''}`}
            onClick={() => nav('attendance')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M9 16l2 2 4-4" />
            </svg>
            Attendance
          </div>

          <div className="nav-section-label">System</div>
          <div
            className="nav-item drawer-nav-item"
            onClick={() => { setSettingsOpen(true); onClose(); }}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </div>
        </div>

        {/* Operator nav */}
        <div id="drawer-nav-operator">
          <div className="nav-section-label">My Shift</div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'logger' ? ' active' : ''}`}
            onClick={() => nav('logger')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Log Time
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'op-history' ? ' active' : ''}`}
            onClick={() => nav('op-history')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            History
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'attendance' ? ' active' : ''}`}
            onClick={() => nav('attendance')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M9 16l2 2 4-4" />
            </svg>
            Attendance
          </div>
          <div className="nav-section-label">System</div>
          <div
            className="nav-item drawer-nav-item"
            onClick={() => { setSettingsOpen(true); onClose(); }}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </div>
        </div>

        {/* User footer */}
        <div className="sidebar-user" style={{ marginTop: 'auto' }}>
          <div className="user-row">
            <div className="user-av" id="drawer-user-av">{initials}</div>
            <div>
              <div className="user-name" id="drawer-user-name">{user || '—'}</div>
            </div>
          </div>
          <button
            className="btn-outline-red"
            id="btn-logout-drawer"
            style={{ marginTop: '10px', padding: '9px' }}
            onClick={onSignOut}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
