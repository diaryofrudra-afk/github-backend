interface StatusCfg {
  label: string;
  bg: string;
  color: string;
}

const STATUS_MAP: Record<string, StatusCfg> = {
  draft:      { label: 'Draft',      bg: 'rgba(100,116,139,0.14)', color: '#94a3b8' },
  sent:       { label: 'Sent',       bg: 'rgba(59,130,246,0.14)',  color: '#60a5fa' },
  pending:    { label: 'Pending',    bg: 'rgba(251,146,60,0.14)',  color: '#fb923c' },
  partial:    { label: 'Partial',    bg: 'rgba(234,179,8,0.14)',   color: '#eab308' },
  paid:       { label: 'Paid',       bg: 'rgba(34,197,94,0.14)',   color: '#22c55e' },
  overdue:    { label: 'Overdue',    bg: 'rgba(239,68,68,0.14)',   color: '#ef4444' },
  accepted:   { label: 'Accepted',   bg: 'rgba(34,197,94,0.14)',   color: '#22c55e' },
  rejected:   { label: 'Rejected',   bg: 'rgba(239,68,68,0.14)',   color: '#ef4444' },
  dispatched: { label: 'Dispatched', bg: 'rgba(59,130,246,0.14)',  color: '#60a5fa' },
  received:   { label: 'Received',   bg: 'rgba(34,197,94,0.14)',   color: '#22c55e' },
  converted:  { label: 'Converted',  bg: 'rgba(168,85,247,0.14)',  color: '#a855f7' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(239,68,68,0.14)',   color: '#ef4444' },
  active:     { label: 'Active',     bg: 'rgba(34,197,94,0.14)',   color: '#22c55e' },
  expired:    { label: 'Expired',    bg: 'rgba(239,68,68,0.14)',   color: '#ef4444' },
};

export function StatusBadge({ status }: { status: string | undefined }) {
  const key = (status || 'draft').toLowerCase();
  const cfg = STATUS_MAP[key] ?? { label: status || '—', bg: 'rgba(100,116,139,0.14)', color: '#94a3b8' };
  return (
    <span className="bl-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="bl-badge-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}
