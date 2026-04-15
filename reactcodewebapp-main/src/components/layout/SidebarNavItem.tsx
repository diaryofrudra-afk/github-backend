import type { ReactNode } from 'react';
import type { PageId } from '../../types';
import { useApp } from '../../context/AppContext';

interface SidebarNavItemProps {
  page: PageId;
  label: string;
  icon: ReactNode;
  count?: number;
  countId?: string;
  countVariant?: 'default' | 'alert';
}

export function SidebarNavItem({ page, label, icon, count, countId, countVariant }: SidebarNavItemProps) {
  const { activePage, setActivePage, sidebarCollapsed } = useApp();
  const isActive = activePage === page;

  return (
    <a
      className={`nav-item ${isActive ? 'active' : ''}`}
      data-page={page}
      onClick={() => setActivePage(page)}
      href="#"
      title={sidebarCollapsed ? label : undefined}
    >
      <span className="nav-icon-wrap">{icon}</span>
      {!sidebarCollapsed && (
        <>
          <span className="nav-label">{label}</span>
          {count !== undefined && count > 0 && (
            <span
              className={`nav-count ${countVariant === 'alert' ? 'alert' : ''}`}
              id={countId}
            >
              {count}
            </span>
          )}
        </>
      )}
      {sidebarCollapsed && <span className="nav-tooltip">{label}</span>}
    </a>
  );
}
