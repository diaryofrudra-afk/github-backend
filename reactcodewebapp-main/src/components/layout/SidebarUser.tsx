import { useApp } from '../../context/AppContext';

interface SidebarUserProps {
  onSignOut: () => void;
}

export function SidebarUser({ onSignOut }: SidebarUserProps) {
  const { user, state, userRole, toggleTheme, setSettingsOpen, sidebarCollapsed, theme } = useApp();
  const profile = state.ownerProfile;
  const displayName = userRole === 'owner' && profile.name ? profile.name : (userRole === 'owner' && profile.company ? profile.company : user || '—');
  const roleLabel = userRole === 'owner' ? 'Owner' : 'Operator';
  const initials = displayName.slice(0, 2).toUpperCase();
  const photo = userRole === 'owner' ? profile.photo : undefined;

  const isDark = theme === 'dark';

  return (
    <footer className="sidebar-user">
      {sidebarCollapsed ? (
        /* COLLAPSED: Avatar centered + vertical utility buttons */
        <>
          <div
            className="user-avatar"
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setSettingsOpen(true)}
          >
            {photo ? (
              <img src={photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center text-accent font-bold text-sm">
                <span style={{ fontSize: 14, fontWeight: 700, color: '#ED8936' }}>{initials}</span>
              </div>
            )}
            <span className="user-status-dot" style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              background: '#22C55E',
              border: '2px solid #ffffff',
              borderRadius: '50%',
            }} />
          </div>

          <div className="utility-actions">
            <button className="utility-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button className="utility-btn" title="Toggle theme" onClick={toggleTheme}>
              {isDark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
            <button className="utility-btn logout-btn" title="Logout" onClick={onSignOut}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        /* EXPANDED: User info left + horizontal utility buttons */
        <>
          <div className="user-info-row">
            <div
              className="user-avatar"
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setSettingsOpen(true)}
            >
              {photo ? (
                <img src={photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center text-accent font-bold text-sm">
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ED8936' }}>{initials}</span>
                </div>
              )}
              <span className="user-status-dot" style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 12,
                height: 12,
                background: '#22C55E',
                border: '2px solid #ffffff',
                borderRadius: '50%',
              }} />
            </div>
            <div className="user-details">
              <p className="user-name">{displayName}</p>
              <p className="user-role">{roleLabel}</p>
            </div>
          </div>

          <div className="footer-actions">
            <button className="footer-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button className="footer-btn" title="Toggle theme" onClick={toggleTheme}>
              {isDark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
            <button className="footer-btn logout-btn" title="Logout" onClick={onSignOut}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </>
      )}
    </footer>
  );
}
