import { useApp } from '../../context/AppContext';

export function SidebarHeader() {
  const { sidebarCollapsed, toggleSidebar } = useApp();

  return (
    <header className="sidebar-header">
      <div
        className="sidebar-brand-mark"
        onClick={sidebarCollapsed ? toggleSidebar : undefined}
        style={sidebarCollapsed ? { cursor: 'pointer' } : undefined}
        title={sidebarCollapsed ? 'Expand sidebar' : undefined}
        onMouseEnter={sidebarCollapsed ? (e) => (e.currentTarget.style.opacity = '0.8') : undefined}
        onMouseLeave={sidebarCollapsed ? (e) => (e.currentTarget.style.opacity = '1') : undefined}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ED8936"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      {!sidebarCollapsed && (
        <>
          <div className="sidebar-brand-name">Suprwise</div>
          <button
            id="btn-sidebar-toggle"
            title="Collapse sidebar"
            onClick={toggleSidebar}
          >
            <svg
              className="sidebar-toggle-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M11 19l-7-7 7-7" />
              <path d="M21 12H4" />
            </svg>
          </button>
        </>
      )}
    </header>
  );
}
