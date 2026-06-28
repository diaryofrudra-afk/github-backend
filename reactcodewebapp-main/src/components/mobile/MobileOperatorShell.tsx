import type { ReactNode } from 'react';
import { BottomNav } from '../layout/BottomNav';
import type { PageId } from '../../types';
import './mobile-shell.css';

interface MobileOperatorShellProps {
  activePage: PageId;
  children: ReactNode;
  onSignOut: () => void;
}

export function MobileOperatorShell({
  children,
  onSignOut,
}: MobileOperatorShellProps) {
  return (
    <div className="mobile-shell mobile-operator-shell operator-mode">
      <header className="mobile-app-topbar mobile-app-topbar-blank" aria-hidden="true" />

      <main className="page-content mobile-shell-content">
        {children}
      </main>

      <BottomNav onSignOut={onSignOut} />
    </div>
  );
}
