import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  colorClass?: string; // e.g., 'text-blue-600'
  bgClass?: string;    // e.g., 'bg-blue-50'
}

export function StatCard({ icon, label, value, colorClass = 'text-[var(--t2)]', bgClass = 'bg-[var(--bg5)]' }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-black text-[var(--t1)]">{value}</div>
        <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
