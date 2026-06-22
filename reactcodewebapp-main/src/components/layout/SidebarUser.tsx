import { useApp } from '../../context/AppContext';

interface SidebarUserProps {
  onSignOut: () => void;
}

export function SidebarUser({ onSignOut }: SidebarUserProps) {
  const { state, userRole, toggleTheme, setSettingsOpen, sidebarCollapsed, theme } = useApp();
  const profile = state.ownerProfile;
  const displayName = userRole === 'owner' && profile.name ? profile.name : (userRole === 'owner' && profile.company ? profile.company : 'RUDRA CRANE SERVICE');
  const roleLabel = userRole === 'owner' ? 'Owner' : 'Operator';
  const initials = displayName.slice(0, 2).toUpperCase();
  const photo = userRole === 'owner' ? profile.photo : undefined;
  const isDark = theme === 'dark';

  return (
    <>
      <footer className="sidebar-footer" style={{ borderTop: '1px solid var(--border)', padding: sidebarCollapsed ? '16px 0' : '16px' }}>
        <div 
          className="sidebar-user" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            padding: sidebarCollapsed ? '8px 0' : '8px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            cursor: 'pointer'
          }}
          onClick={() => setSettingsOpen(true)}
        >
          <div className="user-avatar">
            {photo ? (
              <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : initials}
            <div className="user-status-dot" />
          </div>
          
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={displayName}>
                {displayName}
              </div>
              <div className="sidebar-user-role">
                {roleLabel}
              </div>
            </div>
          )}
        </div>
      </footer>

      <div className="sidebar-bottom" style={{ display: 'flex', padding: sidebarCollapsed ? '12px 0' : '12px 16px', gap: 8, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderTop: 'none' }}>
        <div className="sidebar-bottom-btn" onClick={() => setSettingsOpen(true)} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <div className="sidebar-bottom-btn" onClick={toggleTheme} title="Toggle Theme">
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </div>
        <div className="sidebar-bottom-btn" onClick={onSignOut} title="Sign Out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </div>
      </div>
    </>
  );
}
