import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function ChartCard({ title, children, className, id }: ChartCardProps) {
  return (
    <div className={`chart-card ${className || ''}`} id={id}>
      <div className="chart-title">{title}</div>
      {children}
    </div>
  );
}
