import type { ReactNode } from 'react';
import { Pretext } from './Pretext';

interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ title, value, delta, icon, className }: KpiCardProps) {
  return (
    <div className={`kpi-card ${className || ''}`}>
      {icon && <div className="kpi-icon">{icon}</div>}
      <div className="kpi-value">{value}</div>
      <div className="kpi-label"><Pretext text={title} font="700 8px 'Plus Jakarta Sans'" balanced /></div>
      {delta && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}
