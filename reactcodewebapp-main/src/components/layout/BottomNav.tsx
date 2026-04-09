import { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface BottomNavProps {
  onSignOut: () => void;
}

export function BottomNav({ onSignOut }: BottomNavProps) {
  const { activePage, setActivePage, theme, toggleTheme, setSettingsOpen, user, userRole, state } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user || '').slice(0, 2).toUpperCase() || 'U';
  const isDark = theme === 'dark';

  // Get operator details
  const operators = state?.operators || [];
  const operatorProfiles = state?.operatorProfiles || {};
  const currentOperator = userRole === 'operator'
    ? operators.find(op => op.phone === user || String(op.id) === user)
    : null;
  const opProfile = currentOperator
    ? (operatorProfiles[currentOperator.phone] || operatorProfiles[String(currentOperator.id)] || {})
    : {};
  const opName = currentOperator?.name || user || 'User';
  const opPhone = currentOperator?.phone || user || '';
  const opSalary = (opProfile as Record<string, any>)?.salary || 0;
  const opWorkDays = (opProfile as Record<string, any>)?.workingDays || 26;

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
  const earnedAmount = opWorkDays > 0 ? Math.round((opSalary / opWorkDays) * presentCount) : 0;

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

  function handleThemeToggle() {
    toggleTheme();
  }

  function handleLogout() {
    setMenuOpen(false);
    onSignOut();
  }

  return (
    <>
      {/* Profile Popup Overlay */}
      {menuOpen && (
        <div className="bottom-nav-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Profile Popup — full page style */}
      <div className={`bottom-nav-popup${menuOpen ? ' open' : ''}`}>
        <button className="bottom-nav-popup-close" onClick={() => setMenuOpen(false)}>✕</button>

        <div style={{ padding: '24px 20px' }}>
          {/* Profile Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', background: 'var(--accent-grd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: 'var(--fh)',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--fh)' }}>{opName}</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>{opPhone}</div>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
            <div style={{
              padding: '14px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', fontFamily: 'var(--fh)' }}>{presentCount}</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px', fontWeight: 500 }}>Days Present</div>
            </div>
            <div style={{
              padding: '14px 10px', borderRadius: '12px', background: 'rgba(157,111,255,0.1)',
              border: '1px solid rgba(157,111,255,0.2)', textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--fh)' }}>₹{earnedAmount.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px', fontWeight: 500 }}>Earned</div>
            </div>
            <div style={{
              padding: '14px 10px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--fh)' }}>₹{opSalary.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px', fontWeight: 500 }}>Monthly Salary</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="bottom-nav-popup-item"
              onClick={handleDocuments}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px',
                cursor: 'pointer', color: 'var(--t1)', fontSize: '13px', fontWeight: 500, width: '100%',
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span>Upload Documents</span>
            </button>

            <button
              className="bottom-nav-popup-item"
              onClick={handleThemeToggle}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px',
                cursor: 'pointer', color: 'var(--t1)', fontSize: '13px', fontWeight: 500, width: '100%',
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
              }}>
                {isDark ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </div>
              <span style={{ flex: 1 }}>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              <div className={`bottom-nav-toggle${isDark ? '' : ' active'}`} style={{ margin: 0 }}>
                <div className="bottom-nav-toggle-knob" />
              </div>
            </button>

            <button
              className="bottom-nav-popup-item bottom-nav-popup-item-danger"
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px',
                cursor: 'pointer', color: '#ef4444', fontSize: '13px', fontWeight: 500, width: '100%', marginTop: '8px',
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <span>Logout</span>
            </button>
          </div>
        </div>
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

          {/* Profile Tab with badge */}
          <button
            className={`bottom-nav-tab bottom-nav-tab-profile${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Profile"
          >
            <span className="bottom-nav-icon bottom-nav-profile-icon">
              <div className="bottom-nav-profile-badge">{initials}</div>
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
