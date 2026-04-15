import { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface OperatorFabProps {
  onSignOut: () => void;
}

export function OperatorFab({ onSignOut }: OperatorFabProps) {
  const { user, setSettingsOpen, theme, toggleTheme } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user ? user.slice(0, 2).toUpperCase() : 'U';
  const isDark = theme === 'dark';

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
      {/* Overlay */}
      {menuOpen && (
        <div
          className="operator-fab-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Popup Menu */}
      <div className={`operator-fab-menu${menuOpen ? ' open' : ''}`}>
        {/* Close button */}
        <button
          className="operator-fab-close"
          onClick={() => setMenuOpen(false)}
        >
          ✕
        </button>

        {/* Menu items */}
        <div className="operator-fab-items">
          {/* Upload Documents */}
          <button className="operator-fab-item" onClick={handleDocuments}>
            <div className="operator-fab-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <span className="operator-fab-item-label">Upload Documents</span>
          </button>

          {/* Dark/Light Mode Toggle */}
          <button className="operator-fab-item" onClick={handleThemeToggle}>
            <div className="operator-fab-item-icon">
              {isDark ? (
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
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
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </div>
            <span className="operator-fab-item-label">
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </span>
            <div className={`operator-fab-toggle${isDark ? '' : ' active'}`}>
              <div className="operator-fab-toggle-knob" />
            </div>
          </button>

          {/* Logout */}
          <button className="operator-fab-item operator-fab-item-danger" onClick={handleLogout}>
            <div className="operator-fab-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <span className="operator-fab-item-label">Logout</span>
          </button>
        </div>
      </div>

      {/* FAB Button */}
      <button
        className={`operator-fab-btn${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Profile menu"
      >
        {menuOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span className="operator-fab-initials">{initials}</span>
        )}
      </button>
    </>
  );
}
