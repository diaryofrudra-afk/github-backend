import { useEffect, useRef, useState } from 'react';

export interface DocAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}

interface Props {
  actions: DocAction[];
}

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
);

export function DocumentActions({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div
      className="bl-action-wrap"
      ref={ref}
      onClick={e => e.stopPropagation()}
    >
      <button
        className="bl-action-trigger"
        onClick={() => setOpen(o => !o)}
        title="Actions"
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="bl-action-menu">
          {actions.map((a, i) => (
            <button
              key={i}
              className={`bl-action-item ${a.danger ? 'bl-danger' : ''}`}
              onClick={e => { setOpen(false); a.onClick(e); }}
            >
              {a.icon && <span style={{ opacity: 0.7 }}>{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
