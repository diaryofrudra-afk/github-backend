import { useApp } from '../../context/AppContext';
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
import { Pretext } from '../ui/Pretext';

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
          <div className="drawer-brand"><Pretext text="Suprwise" font="800 14px 'Plus Jakarta Sans'" /></div>
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
          <div className="nav-section-label"><Pretext text="Command" font="700 10px Inter" balanced /></div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'fleet' ? ' active' : ''}`}
            onClick={() => nav('fleet')}
          >
            <img src={craneIcon} alt="Fleet" style={{ width: 20, height: 20 }} />
            <Pretext text="Fleet" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'analytics' ? ' active' : ''}`}
            onClick={() => nav('analytics')}
          >
            <img src={analyticsIcon} alt="Analytics" style={{ width: 20, height: 20 }} />
            <Pretext text="Analytics" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'billing' ? ' active' : ''}`}
            onClick={() => nav('billing')}
          >
            <img src={billingIcon} alt="Billing" style={{ width: 20, height: 20 }} />
            <Pretext text="Billing" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'gps' ? ' active' : ''}`}
            onClick={() => nav('gps')}
          >
            <img src={gpsIcon} alt="Live GPS" style={{ width: 20, height: 20 }} />
            <Pretext text="Live GPS" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'fuel' ? ' active' : ''}`}
            onClick={() => nav('fuel')}
          >
            <img src={fuelIcon} alt="Fuel" style={{ width: 20, height: 20 }} />
            <Pretext text="Fuel" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'cameras' ? ' active' : ''}`}
            onClick={() => nav('cameras')}
          >
            <img src={camerasIcon} alt="Cameras" style={{ width: 20, height: 20 }} />
            <Pretext text="Cameras" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'diagnostics' ? ' active' : ''}`}
            onClick={() => nav('diagnostics')}
          >
            <img src={diagnosticsIcon} alt="Diagnostics" style={{ width: 20, height: 20 }} />
            <Pretext text="Diagnostics" font="500 12px Inter" balanced />
          </div>

          <div className="nav-section-label"><Pretext text="Manage" font="700 10px Inter" balanced /></div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'operators' ? ' active' : ''}`}
            onClick={() => nav('operators')}
          >
            <img src={operatorsIcon} alt="Operators" style={{ width: 20, height: 20 }} />
            <Pretext text="Manage Operators" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'earnings' ? ' active' : ''}`}
            onClick={() => nav('earnings')}
          >
            <img src={earningsIcon} alt="Earnings" style={{ width: 20, height: 20 }} />
            <Pretext text="Earnings" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'attendance' ? ' active' : ''}`}
            onClick={() => nav('attendance')}
          >
            <img src={attendanceIcon} alt="Attendance" style={{ width: 20, height: 20 }} />
            <Pretext text="Attendance" font="500 12px Inter" balanced />
          </div>

          <div className="nav-section-label"><Pretext text="System" font="700 10px Inter" balanced /></div>
          <div
            className="nav-item drawer-nav-item"
            onClick={() => { setSettingsOpen(true); onClose(); }}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <Pretext text="Settings" font="500 12px Inter" balanced />
          </div>
        </div>

        {/* Operator nav */}
        <div id="drawer-nav-operator">
          <div className="nav-section-label"><Pretext text="My Shift" font="700 10px Inter" balanced /></div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'logger' ? ' active' : ''}`}
            onClick={() => nav('logger')}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <Pretext text="Log Time" font="500 12px Inter" balanced />
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
            <Pretext text="History" font="500 12px Inter" balanced />
          </div>
          <div
            className={`nav-item drawer-nav-item${activePage === 'attendance' ? ' active' : ''}`}
            onClick={() => nav('attendance')}
          >
            <img src={attendanceIcon} alt="Attendance" style={{ width: 20, height: 20 }} />
            <Pretext text="Attendance" font="500 12px Inter" balanced />
          </div>
          <div className="nav-section-label"><Pretext text="System" font="700 10px Inter" balanced /></div>
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
