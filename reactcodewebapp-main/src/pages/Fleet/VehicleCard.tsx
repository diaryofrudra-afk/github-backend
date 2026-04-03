import { fmtINR, fmtHours, calcBill, fmtDate } from '../../utils';
import type { Crane, TimesheetEntry } from '../../types';

interface VehicleCardProps {
  crane: Crane;
  timesheets: TimesheetEntry[];
  operatorName?: string;
  alerts: string[];
  onAssign: (reg: string) => void;
  onDelete: (reg: string) => void;
}

function getAccHrs(entries: TimesheetEntry[], date: string, startTime: string): number {
  return entries
    .filter(e => e.date === date && e.startTime < startTime)
    .reduce((s, e) => s + (Number(e.hoursDecimal) || 0), 0);
}

export function VehicleCard({ crane, timesheets, operatorName, alerts, onAssign, onDelete }: VehicleCardProps) {
  const op = crane.operator;
  const opLabel = operatorName ? `${operatorName} · ${op}` : op;
  const specsLine = crane.make
    ? [crane.year, crane.make, crane.model, crane.capacity].filter(Boolean).join(' · ')
    : '';

  let grandTotal = 0;
  timesheets.forEach(e => {
    const h = Number(e.hoursDecimal) || 0;
    const acc = getAccHrs(timesheets, e.date, e.startTime);
    const b = calcBill(h, crane, acc);
    if (b) grandTotal += b.total;
  });

  const recent = timesheets.slice(0, 3);

  return (
    <div className="crane-card">
      <div className="crane-top">
        <div>
          <div className="crane-reg">{crane.reg}</div>
          {specsLine && <div className="crane-spec">{specsLine}</div>}
        </div>
        <div className="badges">
          {timesheets.length > 0 && <span className="badge">{timesheets.length} logs</span>}
          {crane.rate ? <span className="badge amber">₹{Number(crane.rate).toLocaleString('en-IN')}/hr</span> : null}
          {alerts.length > 0 && <span className="badge red">⚠ {alerts.length}</span>}
        </div>
      </div>

      <div className="crane-mid">
        <span className={`op-pill ${op ? 'on' : 'off'}`}>
          <span className="op-dot"></span>
          {op ? opLabel : 'Standby'}
        </span>
        <div className="crane-actions">
          {!op && (
            <button className="ca-btn c-acc btn-assign" title="Assign Operator"
              onClick={() => onAssign(crane.reg)}>
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          )}
          <button className="ca-btn c-red btn-del-crane" title="Delete"
            onClick={() => onDelete(crane.reg)}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="sh-table">
          <div className="sh-head">
            <span className="sh-hl">Last {recent.length} Shift{recent.length > 1 ? 's' : ''}</span>
            <span className="sh-ht">
              {crane.rate ? fmtINR(grandTotal) + ' total' : timesheets.length + ' logs'}
            </span>
          </div>
          {recent.map(e => {
            const h = Number(e.hoursDecimal) || 0;
            const b = crane.rate ? calcBill(h, crane, getAccHrs(timesheets, e.date, e.startTime)) : null;
            return (
              <div key={e.id} className="sh-row">
                <span className="sh-date">{fmtDate(e.date)}</span>
                <span className="sh-hrs">{fmtHours(h)}</span>
                <span className="sh-bill">{b ? fmtINR(b.total) : '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="warn-bar">⚠ {alerts.join(' · ')}</div>
      )}
    </div>
  );
}
