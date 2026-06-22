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
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <span className="operator-fab-item-label">Upload Documents</span>
          </button>

          {/* Dark/Light Mode Toggle */}
          <button className="operator-fab-item" onClick={handleThemeToggle}>
            <div className="operator-fab-item-icon">
              <span className="material-symbols-outlined">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
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
              <span className="material-symbols-outlined">logout</span>
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
          <span className="material-symbols-outlined">close</span>
        ) : (
          <span className="operator-fab-initials">{initials}</span>
        )}
      </button>
    </>
  );
}
