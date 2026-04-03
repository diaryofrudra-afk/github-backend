import { useApp } from '../../context/AppContext';

export function SidebarHeader() {
  const { sidebarCollapsed, toggleSidebar } = useApp();

  return (
    <div className="sidebar-header">
      <div className="sidebar-brand-mark">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M2 20h20" />
          <path d="M10 4v16" />
          <path d="M10 4l8 4" />
          <path d="M18 8v12" />
        </svg>
      </div>
      {!sidebarCollapsed && <span className="sidebar-brand-name">Suprwise</span>}
      <button id="btn-sidebar-toggle" title="Collapse sidebar (⌘\)" onClick={toggleSidebar}>
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
    </div>
  );
}
