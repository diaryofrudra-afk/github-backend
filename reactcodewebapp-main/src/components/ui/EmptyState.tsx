import type { ReactNode } from 'react';
import { Pretext } from './Pretext';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <p><Pretext text={message} font="400 12px Inter" balanced /></p>
    </div>
  );
}
