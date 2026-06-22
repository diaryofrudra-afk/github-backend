import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconBgClass?: string;
  children?: ReactNode; // For actions or right-side content
  filters?: ReactNode; // For filter buttons next to the title
}

export function PageHeader({ 
  title, 
  subtitle, 
  icon, 
  iconBgClass = 'bg-orange-500 shadow-orange-100',
  children,
  filters
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${iconBgClass}`}>
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--t1)]">{title}</h1>
            {subtitle && (
              <p className="text-[11px] font-medium text-[var(--t3)] uppercase tracking-wider">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {filters && (
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-1">
            {filters}
          </div>
        )}
      </div>

      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
