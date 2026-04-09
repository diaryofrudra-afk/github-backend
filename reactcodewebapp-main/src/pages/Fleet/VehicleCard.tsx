import { useState } from 'react';
import { useUnifiedGPS } from '../../hooks/useUnifiedGPS';
import { fmtINR, fmtHours, calcBill, fmtDate } from '../../utils';
import type { Crane, TimesheetEntry } from '../../types';
import technologyIcon from '../../assets/technology.png';

interface VehicleCardProps {
  crane: Crane;
  timesheets: TimesheetEntry[];
  operatorName?: string;
  alerts: string[];
  onAssign: (reg: string) => void;
  onDelete: (reg: string) => void;
  onEdit: (reg: string) => void;
}

function getAccHrs(entries: TimesheetEntry[], date: string, startTime: string): number {
  return entries
    .filter(e => e.date === date && e.startTime < startTime)
    .reduce((s, e) => s + (Number(e.hoursDecimal) || 0), 0);
}

export function VehicleCard({ crane, timesheets, operatorName, alerts, onAssign, onDelete, onEdit }: VehicleCardProps) {
  const { vehicles: gpsVehicles } = useUnifiedGPS();
  const [dismissed, setDismissed] = useState(false);
  const op = crane.operator;
  const opLabel = operatorName ? `${operatorName} · ${op}` : op;
  const specsLine = crane.make
    ? [crane.year, crane.make, crane.model, crane.capacity].filter(Boolean).join(' · ')
    : '';

  // Match with unified GPS telemetry (both Blackbuck + Trak N Tell)
  const gpsMatch = gpsVehicles.find(v =>
    v.registration_number.replace(/\s/g, '').toUpperCase() === crane.reg.replace(/\s/g, '').toUpperCase()
  );

  // Determine engine status: GPS match first, then parse crane.status/notes
  let engineOn: boolean | null = null;
  let engineLabel: string | null = null;

  if (gpsMatch) {
    // Priority 1: Live GPS data
    engineOn = gpsMatch.engine_on ?? (gpsMatch.ignition === 'on' ? true : gpsMatch.ignition === 'off' ? false : null);
    engineLabel = engineOn === true ? 'ON' : engineOn === false ? 'OFF' : null;
  } else {
    // Priority 2: Parse crane.status text (from sync-to-fleet)
    const status = (crane.status || '').toLowerCase();
    if (status.includes('engine on')) {
      engineOn = true;
      engineLabel = 'ON';
    } else if (status.includes('engine off')) {
      engineOn = false;
      engineLabel = 'OFF';
    } else if (status.includes('moving')) {
      engineOn = true;
      engineLabel = 'ON';
    }
  }

  // Determine provider badge
  const provider = gpsMatch?.provider || (crane.notes?.includes('Trak N Tell') ? 'trakntell' : crane.notes?.includes('Blackbuck') ? 'blackbuck' : null);

  // Check connectivity issues
  const hasGpsIssue = gpsMatch?.is_gps_working === false;
  const hasNetworkIssue = gpsMatch?.network_status === 'weak' || (gpsMatch?.gsm_signal != null && gpsMatch.gsm_signal < 10);
  const isWireDisconnected = gpsMatch?.status === 'wire_disconnected' || gpsMatch?.status === 'signal_lost';
  const hasConnectivityIssue = hasGpsIssue || hasNetworkIssue || isWireDisconnected;

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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="crane-reg">{crane.reg}</div>
            {specsLine && <div className="crane-spec">{specsLine}</div>}
          </div>
          {hasConnectivityIssue && !dismissed && (
            <img
              src={technologyIcon}
              alt="Connectivity issue"
              className="connectivity-icon"
              style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0, marginTop: '2px', cursor: 'pointer', animation: 'connectivity-pulse 2s ease-in-out infinite' }}
              title={
                (hasGpsIssue ? 'GPS lost' : '') +
                (hasNetworkIssue ? ' Weak network' : '') +
                (isWireDisconnected ? ' Wire disconnected' : '')
              }
              onClick={() => setDismissed(true)}
            />
          )}
        </div>
        <div className="badges">
          {provider && (
            <span style={{
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: provider === 'blackbuck' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
              color: provider === 'blackbuck' ? '#3b82f6' : '#10b981',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              {provider === 'blackbuck' ? 'BB' : 'TNT'}
            </span>
          )}
          {timesheets.length > 0 && <span className="badge">{timesheets.length} logs</span>}
          {crane.rate ? <span className="badge amber">₹{Number(crane.rate).toLocaleString('en-IN')}/hr</span> : null}
          {alerts.length > 0 && <span className="badge red">⚠ {alerts.length}</span>}
        </div>
      </div>

      <div className="crane-mid">
        <span className={`op-pill ${hasConnectivityIssue ? 'gps-error' : engineOn === true ? 'on' : engineOn === false ? 'off' : (op ? 'on' : 'off')}`}>
          <span className={`op-dot ${engineOn ? 'pulse' : (hasConnectivityIssue ? 'gps-error-dot' : '')}`}></span>
          {hasConnectivityIssue ? (
            <span style={{ color: '#ef4444' }}>GPS Error</span>
          ) : engineLabel ? (
            <span>
              Engine {engineLabel}
              {op ? <span style={{ opacity: 0.6, fontSize: '0.9em' }}> · {operatorName || op}</span> : null}
            </span>
          ) : (op ? opLabel : 'Standby')}
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
          <button className="ca-btn c-amber btn-edit-crane" title="Edit Details"
            onClick={() => onEdit(crane.reg)}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
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
