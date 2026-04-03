import { useApp } from '../../context/AppContext';

interface SidebarUserProps {
  onSignOut: () => void;
}

export function SidebarUser({ onSignOut }: SidebarUserProps) {
  const { user, sidebarCollapsed, state, userRole, toggleTheme, setSettingsOpen } = useApp();
  const profile = state.ownerProfile;
  const displayName = userRole === 'owner' && profile.company ? profile.company : (userRole === 'owner' && profile.name ? profile.name : user || '—');
  const initials = displayName.slice(0, 2).toUpperCase();
  const photo = userRole === 'owner' ? profile.photo : undefined;

  return (
    <div className="sidebar-user">
      <div className="user-row sidebar-user-clickable" id="sidebar-user-row" title="Account settings" onClick={() => setSettingsOpen(true)} style={{ cursor: 'pointer' }}>
        {photo ? (
          <img src={photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div className="user-av" id="user-av">{initials}</div>
        )}
        {!sidebarCollapsed && (
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <div className="user-name" id="user-name-display" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
          </div>
        )}
      </div>
      {!sidebarCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Settings */}
          <button className="btn-signout" title="Settings" onClick={() => setSettingsOpen(true)} style={{ padding: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {/* Dark mode toggle */}
          <button className="btn-signout" title="Toggle dark mode" onClick={toggleTheme} style={{ padding: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          {/* Sign out */}
          <button className="btn-signout" title="Sign out" onClick={onSignOut} style={{ padding: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
