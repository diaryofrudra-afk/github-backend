import { useState } from 'react';
import { useUnifiedGPS } from '../../hooks/useUnifiedGPS';
import { calcBill } from '../../utils';
import type { Crane, TimesheetEntry } from '../../types';
import craneImage from '../../assets/crane-escort-f23.png';
import { EngineHistoryModal } from '../../components/EngineHistoryModal';

interface VehicleCardProps {
  crane: Crane;
  timesheets: TimesheetEntry[];
  operatorName?: string;
  alerts: string[];
  onAssign: (reg: string) => void;
  onDelete: (reg: string) => void;
  onEdit: (reg: string) => void;
}

// Status badge config
const STATUS_CONFIG = {
  active: { label: 'ACTIVE', color: '#fff', bg: '#27AE60' },
  standby: { label: 'STANDBY', color: '#fff', bg: '#475569' },
  alert: { label: 'ALERT', color: '#fff', bg: '#E74C3C' },
};

// Placeholder vehicle images by type
const VEHICLE_IMAGES: Record<string, string> = {
  crane: craneImage,
  excavator: 'https://images.unsplash.com/photo-1578894384872-0e04e64f3e90?w=400&q=80',
  loader: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
  digger: 'https://images.unsplash.com/photo-1580901368919-7738efb0f228?w=400&q=80',
  default: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=400&q=80',
};

function getTypeImage(type?: string): string {
  if (!type) return VEHICLE_IMAGES.default;
  const lower = type.toLowerCase();
  for (const [key, url] of Object.entries(VEHICLE_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return VEHICLE_IMAGES.default;
}

export function VehicleCard({ crane, timesheets, operatorName, alerts, onAssign, onDelete, onEdit }: VehicleCardProps) {
  const { vehicles: gpsVehicles } = useUnifiedGPS();
  const [engineHistoryOpen, setEngineHistoryOpen] = useState(false);
  const op = crane.operator;
  const typeLabel = crane.type || 'Asset';
  const specsLine = crane.make
    ? [crane.year, crane.make, crane.model, crane.capacity].filter(Boolean).join(' · ')
    : typeLabel;

  // Match with unified GPS telemetry
  const gpsMatch = gpsVehicles.find(v =>
    v.registration_number.replace(/\s/g, '').toUpperCase() === crane.reg.replace(/\s/g, '').toUpperCase()
  );

  // Engine status
  let engineOn: boolean | null = null;
  let engineLabel = 'UNKNOWN';

  if (gpsMatch) {
    engineOn = gpsMatch.engine_on ?? (gpsMatch.ignition === 'on' ? true : gpsMatch.ignition === 'off' ? false : null);
    engineLabel = engineOn === true ? 'OPTIMAL' : engineOn === false ? 'OFFLINE' : 'UNKNOWN';
  } else {
    const status = (crane.status || '').toLowerCase();
    if (status.includes('engine on') || status.includes('moving')) {
      engineOn = true;
      engineLabel = 'OPTIMAL';
    } else if (status.includes('engine off')) {
      engineOn = false;
      engineLabel = 'OFF';
    }
  }

  // Connectivity issues
  const hasGpsIssue = gpsMatch?.is_gps_working === false;
  const hasNetworkIssue = gpsMatch?.network_status === 'weak' || (gpsMatch?.gsm_signal != null && gpsMatch.gsm_signal < 10);
  const isWireDisconnected = gpsMatch?.status === 'wire_disconnected';
  const isSignalLost = gpsMatch?.status === 'signal_lost';
  const hasConnectivityIssue = hasGpsIssue || hasNetworkIssue || isWireDisconnected || isSignalLost;

  // Activity status — mirrors GPS page logic
  let activityLabel = '—';
  let activityColor = '#94a3b8';
  if (gpsMatch) {
    const gSpeed = gpsMatch.speed || 0;
    const gEngineOn = gpsMatch.engine_on ?? (gpsMatch.ignition === 'on');
    const gStopped = gpsMatch.status === 'stopped';
    if (isWireDisconnected) {
      activityLabel = 'STALLED';
      activityColor = '#ef4444';
    } else if (isSignalLost) {
      activityLabel = 'OFFLINE';
      activityColor = '#6b7280';
    } else if (hasGpsIssue) {
      activityLabel = 'STALLED';
      activityColor = '#ef4444';
    } else if (gStopped && gEngineOn) {
      activityLabel = 'LIFTING';
      activityColor = '#f59e0b';
    } else if (gStopped) {
      activityLabel = 'STOPPED';
      activityColor = '#6b7280';
    } else if (gSpeed > 0) {
      activityLabel = `${gSpeed} km/h`;
      activityColor = '#10b981';
    }
  }

  // Determine card status
  const cardStatus = alerts.length > 0 || hasConnectivityIssue ? 'alert' : op ? 'active' : 'standby';
  const statusConfig = STATUS_CONFIG[cardStatus];

  // GPS status
  const gpsStatus = isWireDisconnected ? 'WIRE DISCONNECTED' : isSignalLost ? 'SIGNAL LOST' : hasConnectivityIssue ? 'SIGNAL LOST' : gpsMatch ? 'STABLE' : 'IDLE';

  // Grand total for recent logs
  let recentTotal = 0;
  const recent = timesheets.slice(0, 3);
  recent.forEach(e => {
    const h = Number(e.hoursDecimal) || 0;
    const b = crane.rate ? calcBill(h, crane, 0) : null;
    if (b) recentTotal += b.total;
  });

  const initials = operatorName
    ? operatorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const vehicleImg = getTypeImage(crane.type);

  return (
    <div className={`asset-card${cardStatus === 'alert' ? ' asset-alert' : ''}`}>
      {/* Image Section */}
      <div className="asset-card-image-wrap">
        <img
          className="asset-card-img"
          src={vehicleImg}
          alt={crane.reg}
          style={cardStatus === 'alert' ? { filter: 'grayscale(0.3)' } : undefined}
        />
        <div className={`asset-card-gradient${cardStatus === 'alert' ? ' asset-gradient-alert' : ''}`} />
        <span
          className="asset-card-badge"
          style={{ background: statusConfig.bg, color: statusConfig.color }}
        >
          {cardStatus === 'alert' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          )}
          {statusConfig.label}
        </span>
      </div>

      {/* Content Section */}
      <div className="asset-card-body">
        <div className="asset-card-main">
          {/* Left: Vehicle Info + Status Indicators */}
          <div className="asset-card-info">
            <h3 className="asset-card-title">{crane.reg}</h3>
            <p className="asset-card-subtitle">{specsLine}</p>

            {/* Status Indicators */}
            <div className="asset-card-indicators">
              {/* Engine Status */}
              <div className="asset-indicator" style={{ position: 'relative' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={engineOn ? '#27AE60' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <div>
                  <p className="asset-indicator-label">Engine</p>
                  <p className="asset-indicator-value" style={{ color: engineOn ? '#0F172A' : '#94a3b8' }}>
                    {engineLabel}
                  </p>
                </div>
                <button
                  className="asset-action-btn"
                  onClick={(e) => { e.stopPropagation(); setEngineHistoryOpen(true); }}
                  title="Engine on/off history"
                  style={{ marginLeft: 4, padding: '3px 6px', opacity: 0.7 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </button>
              </div>

              {/* Activity Status */}
              <div className="asset-indicator">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activityColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {activityLabel === 'LIFTING' ? (
                    <path d="M12 2v20M2 12h20" />
                  ) : activityLabel === 'STALLED' || activityLabel === 'OFFLINE' ? (
                    <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>
                  ) : (
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  )}
                </svg>
                <div>
                  <p className="asset-indicator-label">Status</p>
                  <p className="asset-indicator-value" style={{ color: activityColor, fontWeight: activityLabel === 'LIFTING' || activityLabel === 'STALLED' ? 700 : 500 }}>
                    {activityLabel}
                  </p>
                </div>
              </div>

              {/* GPS Status */}
              <div className={`asset-indicator${hasConnectivityIssue ? ' asset-indicator-error' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasConnectivityIssue ? '#E74C3C' : '#E67E22'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div>
                  <p className="asset-indicator-label">GPS</p>
                  <p className="asset-indicator-value" style={{ color: hasConnectivityIssue ? '#E74C3C' : '#0F172A' }}>
                    {gpsStatus}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Operator + Actions */}
          <div className="asset-card-right">
            <div className="asset-operator" style={{ opacity: !op ? 0.6 : 1 }}>
              {op ? (
                <div className="asset-operator-avatar" style={{
                  background: 'var(--accent-s)',
                  color: 'var(--accent)',
                }}>
                  {initials}
                </div>
              ) : (
                <div className="asset-operator-avatar" style={{
                  background: 'var(--bg4)',
                  color: 'var(--t3)',
                  border: '1px solid var(--border)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              <div>
                <p className="asset-operator-label">Operator</p>
                <p className="asset-operator-name">{operatorName || (op ? op : 'Unassigned')}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="asset-actions">
              {cardStatus === 'alert' ? (
                <button className="asset-reconnect-btn" onClick={() => onEdit(crane.reg)}>
                  Reconnect
                </button>
              ) : (
                <>
                  <button className="asset-action-btn" onClick={() => onEdit(crane.reg)} title="Edit">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!op && (
                    <button className="asset-action-btn" onClick={() => onAssign(crane.reg)} title="Assign Operator">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                    </button>
                  )}
                  <button className="asset-action-btn" onClick={() => onDelete(crane.reg)} title="Delete">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Logs Summary */}
        {recent.length > 0 && crane.rate && (
          <div className="asset-card-logs">
            <span className="asset-logs-label">Last {recent.length} shift{recent.length > 1 ? 's' : ''}</span>
            <span className="asset-logs-total">₹{recentTotal.toLocaleString('en-IN')} total</span>
          </div>
        )}
      </div>

      {/* Engine History Modal */}
      <EngineHistoryModal
        craneReg={crane.reg}
        open={engineHistoryOpen}
        onClose={() => setEngineHistoryOpen(false)}
      />
    </div>
  );
}
