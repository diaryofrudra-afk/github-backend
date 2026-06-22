import { useApp } from '../../context/AppContext';

export function SidebarHeader() {
  const { sidebarCollapsed, toggleSidebar } = useApp();

  return (
    <header className="sidebar-header" style={{ padding: sidebarCollapsed ? '16px' : '16px 20px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: 10 }}>
      <div
        className="sidebar-logo"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
          <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {!sidebarCollapsed && (
        <span className="sidebar-brand">Suprwise</span>
      )}
    </header>
  );
}
