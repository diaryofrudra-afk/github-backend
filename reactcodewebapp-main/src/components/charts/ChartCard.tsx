import type { ReactNode } from 'react';
import { Pretext } from '../ui/Pretext';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function ChartCard({ title, children, className, id }: ChartCardProps) {
  return (
    <div className={`chart-card ${className || ''}`} id={id}>
      <div className="chart-title"><Pretext text={title} font="700 13px 'Plus Jakarta Sans'" balanced /></div>
      {children}
    </div>
  );
}
