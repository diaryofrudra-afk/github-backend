import type { ReactNode } from 'react';

interface PageContainerProps {
  id?: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export function PageContainer({ id, active, className = '', children }: PageContainerProps) {
  return (
    <div className={`page ${className} ${active ? 'active' : ''}`} id={id}>
      <div className="w-full h-full flex flex-col">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg4)] shadow-[0_8px_30px_rgba(15,23,42,0.04)] flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
