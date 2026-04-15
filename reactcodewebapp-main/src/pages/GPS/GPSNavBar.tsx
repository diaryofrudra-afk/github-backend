interface GPSNavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeNav: string;
  onNavChange: (nav: string) => void;
  onSync: () => void;
  onSettings: () => void;
  syncing: boolean;
}

export function GPSNavBar({
  searchQuery,
  onSearchChange,
  activeNav,
  onNavChange,
  onSync,
  onSettings,
  syncing,
}: GPSNavBarProps) {
  return (
    <nav className="gps-navbar">
      <div className="gps-navbar-left">
        <span className="gps-logo">KINETIC TRACKER</span>
        
        <div className="gps-search-bar">
          <svg className="gps-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="gps-search-input"
            placeholder="Search assets, drivers, or alerts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <div className="gps-nav-pills">
          <button
            className={`gps-nav-pill ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavChange('dashboard')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Dashboard</span>
          </button>
          
          <button
            className={`gps-nav-pill ${activeNav === 'map' ? 'active' : ''}`}
            onClick={() => onNavChange('map')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <span>Map</span>
          </button>
          
          <button
            className={`gps-nav-pill ${activeNav === 'fleet' ? 'active' : ''}`}
            onClick={() => onNavChange('fleet')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span>Fleet</span>
          </button>
          
          <button
            className={`gps-nav-pill ${activeNav === 'analytics' ? 'active' : ''}`}
            onClick={() => onNavChange('analytics')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Analytics</span>
          </button>
        </div>
      </div>
      
      <div className="gps-navbar-right">
        <button className="gps-emergency-btn" onClick={() => {}}>
          Emergency Stop
        </button>
        
        <div className="gps-navbar-divider" />
        
        <button className="gps-navbar-icon-btn" onClick={onSync} title="Sync GPS data" disabled={syncing}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        
        <button className="gps-navbar-icon-btn" onClick={onSettings} title="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
        
        <div className="gps-navbar-avatar">
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="User profile"
          />
        </div>
      </div>
    </nav>
  );
}
