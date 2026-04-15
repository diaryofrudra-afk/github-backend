import { useMemo, useState } from 'react';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';

interface GPSAssetCardProps {
  vehicle: UnifiedVehicle;
  provider?: 'blackbuck' | 'trakntell';
  onClick: () => void;
  onHistory?: () => void;
  onEngineHistory?: () => void;
}

function getTimeAgo(lastUpdated?: string): string {
  if (!lastUpdated) return '--';
  const now = new Date();
  const updated = new Date(lastUpdated);
  const diffMs = now.getTime() - updated.getTime();
  if (isNaN(diffMs)) return lastUpdated;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function headingToCompass(deg?: number): string {
  if (deg == null) return '--';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function GPSAssetCard({ vehicle, provider, onClick, onHistory, onEngineHistory }: GPSAssetCardProps) {
  const [expanded, setExpanded] = useState(false);

  const cardData = useMemo(() => {
    let status: 'connected' | 'stopped' | 'alert' | 'signal-lost' = 'connected';
    let statusLabel = 'CONNECTED';
    let description = '';
    let actionLabel = 'MOVING';

    const isWireDisconnected = vehicle.status === 'wire_disconnected';
    const isSignalLost = vehicle.status === 'signal_lost';
    let isGpsLost = vehicle.is_gps_working === false;
    const isStopped = vehicle.status === 'stopped';
    const speed = vehicle.speed || 0;
    const isEngineOn = vehicle.ignition === 'on' || vehicle.engine_on === true;

    // Cross-validation: if we have valid coordinates and address, GPS is working
    const hasValidCoordinates = vehicle.latitude != null && vehicle.longitude != null &&
      !(vehicle.latitude === 0 && vehicle.longitude === 0);
    const hasValidAddress = vehicle.address != null && vehicle.address.trim() !== '';

    if (hasValidCoordinates && hasValidAddress) {
      isGpsLost = false;
    }

    if (isWireDisconnected) {
      // Wire physically disconnected — critical
      status = 'alert';
      statusLabel = 'WIRE DISCONNECTED';
      description = `Critical Alert • ${vehicle.address || 'Unknown location'}`;
      actionLabel = 'STALLED';
    } else if (isSignalLost) {
      // GPS signal lost but wire connected
      status = 'signal-lost';
      statusLabel = 'SIGNAL LOST';
      description = vehicle.address || 'Last known location unavailable';
      actionLabel = 'OFFLINE';
    } else if (isGpsLost) {
      // GPS module not working
      status = 'alert';
      statusLabel = 'GPS LOST';
      description = `Alert • ${vehicle.address || 'Unknown location'}`;
      actionLabel = 'STALLED';
    } else if (isStopped && isEngineOn) {
      // Engine on but stationary — crane lifting
      status = 'stopped';
      statusLabel = 'CONNECTED';
      description = vehicle.address || 'Engine on, stationary';
      actionLabel = 'LIFTING';
    } else if (isStopped) {
      // Engine off, stationary
      status = 'stopped';
      statusLabel = 'CONNECTED';
      description = vehicle.address || 'Idle';
      actionLabel = 'STOPPED';
    } else if (speed > 0) {
      // Moving vehicle
      status = 'connected';
      statusLabel = 'CONNECTED';
      description = `${speed} km/h • ${vehicle.address || ''}`.trim().replace(/•\s*$/, '');
      actionLabel = `${speed} km/h`;
    } else {
      // Unknown / default
      status = 'connected';
      statusLabel = 'CONNECTED';
      description = vehicle.address || 'Position tracked';
      actionLabel = 'ACTIVE';
    }

    const timeAgo = getTimeAgo(vehicle.last_updated);
    let iconType = 'local_shipping';
    if (status === 'alert') iconType = 'warning';
    else if (status === 'signal-lost') iconType = 'signal_disconnected';

    return { status, statusLabel, description, timeAgo, actionLabel, iconType };
  }, [vehicle]);

  // ── Determine which extended data sections exist ──
  const hasSLI = provider === 'trakntell' && (
    vehicle.sli_angle != null || vehicle.sli_length != null ||
    vehicle.sli_load != null || vehicle.sli_swl != null ||
    vehicle.sli_radius != null || vehicle.sli_overload != null ||
    vehicle.sos_button != null || vehicle.battery_charge_status != null ||
    vehicle.sli_duty != null ||
    ((vehicle as any).ain_sensors?.length ?? 0) > 0
  );
  const hasCAN = provider === 'trakntell' && (
    vehicle.j1939_coolant_temp != null || vehicle.j1939_oil_pressure != null ||
    vehicle.j1939_engine_speed != null || vehicle.j1939_hour_meter != null ||
    vehicle.j1939_fuel_level != null || vehicle.j1939_mil != null ||
    vehicle.j1939_fuel_consumption != null || vehicle.j1939_battery_potential != null ||
    vehicle.j1939_trans_oil_temp != null || vehicle.j1939_urea_level != null ||
    vehicle.j1939_stop_indicator != null || vehicle.j1939_water_in_fuel != null
  );
  const hasStatusDuration = vehicle.ignition_on_since || vehicle.ignition_off_since ||
    vehicle.parked_since || vehicle.trip_distance != null || vehicle.trip_avg_speed != null;
  const hasGPSQuality = vehicle.heading != null || vehicle.altitude != null ||
    vehicle.gps_satellites != null || vehicle.hdop != null;
  const hasDistanceHours = vehicle.odometer != null || vehicle.today_km != null ||
    vehicle.engine_hours != null || vehicle.today_engine_hours != null ||
    vehicle.stop_duration || vehicle.idle_duration;
  const hasFuel = vehicle.fuel_percentage != null || vehicle.fuel_litres != null;
  const hasEngine = vehicle.rpm != null || vehicle.main_voltage != null ||
    vehicle.backup_voltage != null;
  const hasTemperature = vehicle.temperature != null || vehicle.temperature2 != null;
  const hasSensors = vehicle.door_status || vehicle.ac_status ||
    vehicle.immobilizer || vehicle.is_inside_geofence != null;
  const hasDriver = vehicle.driver_name || vehicle.driver_mobile;

  const hasExtras = hasSLI || hasCAN || hasStatusDuration || hasGPSQuality ||
    hasDistanceHours || hasFuel || hasEngine || hasTemperature || hasSensors || hasDriver;

  // Active alerts
  const alerts = [
    vehicle.is_panic && 'PANIC',
    vehicle.is_towing && 'TOWING',
    vehicle.is_overspeeding && 'OVERSPEED',
    vehicle.is_harsh_braking && 'HARSH BRAKE',
    vehicle.is_harsh_acceleration && 'HARSH ACCEL',
  ].filter(Boolean) as string[];

  return (
    <div className={`beacon-card status-${cardData.status}${expanded ? ' expanded' : ''}`}>
      {/* Main card — click centers map */}
      <div className="beacon-card-inner" onClick={onClick}>
        <div className="beacon-card-header">
          <div className="beacon-card-identity">
            <span className={`material-symbols-outlined beacon-card-icon status-${cardData.status}`}>
              {cardData.iconType}
            </span>
            <span className="beacon-card-name">{vehicle.registration_number}</span>
          </div>
          <span className={`beacon-status-badge status-${cardData.status}`}>
            {cardData.statusLabel}
          </span>
        </div>

        <p className="beacon-card-description">{cardData.description}</p>

        <div className="beacon-card-footer">
          <div className="beacon-card-meta-left">
            <span className="beacon-meta-item">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              {cardData.timeAgo}
            </span>
            <span className={`beacon-meta-item action-${cardData.status}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {cardData.status === 'alert' ? 'error' : cardData.status === 'signal-lost' ? 'cloud_off' : 'precision_manufacturing'}
              </span>
              {cardData.actionLabel}
            </span>
          </div>
          <div className="beacon-card-actions">
            <button
              className="beacon-card-btn"
              onClick={(e) => { e.stopPropagation(); onHistory?.(); }}
              title="Play route history"
            >
              History
            </button>
            {onEngineHistory && (
              <button
                className="beacon-card-btn outline"
                onClick={(e) => { e.stopPropagation(); onEngineHistory(); }}
                title="Engine on/off history"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Engine
              </button>
            )}
            {hasExtras && (
              <button className="beacon-card-btn outline" onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}>
                {expanded ? 'Less' : 'More Data'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded detail grid ── */}
      {expanded && hasExtras && (
        <div className="beacon-card-detail-grid">

          {/* Alerts row */}
          {alerts.length > 0 && (
            <div className="beacon-card-alerts">
              {alerts.map(a => <span key={a} className="beacon-alert-pill">{a}</span>)}
            </div>
          )}

          {/* SLI Crane Monitor */}
          {hasSLI && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">SLI Crane Monitor</p>
              <div className="beacon-detail-row-group">
                {vehicle.sli_duty != null && <DetailRow label="Duty" value={`${vehicle.sli_duty.toFixed(1)}%`} />}
                {vehicle.sli_angle != null && <DetailRow label="Angle" value={`${vehicle.sli_angle.toFixed(1)}°`} />}
                {vehicle.sli_radius != null && <DetailRow label="Radius" value={`${vehicle.sli_radius.toFixed(1)} m`} />}
                {vehicle.sli_length != null && <DetailRow label="Boom Length" value={`${vehicle.sli_length.toFixed(1)} m`} />}
              </div>
              {/* Load vs SWL bar */}
              {vehicle.sli_load != null && vehicle.sli_swl != null && vehicle.sli_swl > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span className="beacon-detail-label">Load</span>
                    <span className={`beacon-detail-value${vehicle.sli_load / vehicle.sli_swl > 0.8 ? ' warn' : ''}`}>
                      {vehicle.sli_load.toFixed(2)} / {vehicle.sli_swl.toFixed(2)} ton
                    </span>
                  </div>
                  <div className="beacon-fuel-bar">
                    <div className="beacon-fuel-bar-fill" style={{
                      width: `${Math.min(100, (vehicle.sli_load / vehicle.sli_swl) * 100)}%`,
                      background: vehicle.sli_load / vehicle.sli_swl > 0.8 ? '#ef4444' : undefined,
                    }} />
                  </div>
                </div>
              )}
              {vehicle.sli_load != null && (vehicle.sli_swl == null || vehicle.sli_swl === 0) && (
                <DetailRow label="Load" value={`${vehicle.sli_load.toFixed(2)} ton`} />
              )}
              {vehicle.sli_overload != null && vehicle.sli_overload > 0 && (
                <div className="beacon-alert-pill" style={{ marginTop: 4, textAlign: 'center' }}>
                  ⚠ OVERLOAD ({vehicle.sli_overload.toFixed(1)})
                </div>
              )}
              {vehicle.sos_button && <DetailRow label="SOS" value={vehicle.sos_button} warn={vehicle.sos_button.toLowerCase().includes('press')} />}
              {vehicle.battery_charge_status && <DetailRow label="Battery" value={vehicle.battery_charge_status} />}
              {/* Generic AIN sensors */}
              {((vehicle as any).ain_sensors as { label: string; value: any; units: string }[])?.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {(vehicle as any).ain_sensors
                    .filter((s: any) => !['SLI Duty', 'SLI Angle', 'SLI Radius', 'SLI Length', 'SLI Load', 'SLI SWL', 'Over Load Indication'].includes(s.label))
                    .map((s: any) => (
                      <DetailRow key={s.label} label={s.label} value={s.value != null ? `${s.value}${s.units ? ' ' + s.units : ''}` : '--'} />
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* J1939 CAN Bus */}
          {hasCAN && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">CAN / J1939</p>
              <div className="beacon-detail-row-group">
                {vehicle.j1939_hour_meter != null && <DetailRow label="Hour Meter" value={`${vehicle.j1939_hour_meter.toFixed(0)} h`} />}
                {vehicle.j1939_engine_speed != null && <DetailRow label="Engine RPM" value={String(vehicle.j1939_engine_speed)} />}
                {vehicle.j1939_coolant_temp != null && <DetailRow label="Coolant Temp" value={`${vehicle.j1939_coolant_temp.toFixed(0)} °C`} warn={vehicle.j1939_coolant_temp > 105} />}
                {vehicle.j1939_oil_pressure != null && <DetailRow label="Oil Pressure" value={String(vehicle.j1939_oil_pressure)} />}
                {vehicle.j1939_fuel_level != null && <DetailRow label="CAN Fuel" value={String(vehicle.j1939_fuel_level)} />}
                {vehicle.j1939_fuel_consumption != null && <DetailRow label="Fuel Rate" value={`${vehicle.j1939_fuel_consumption} L/h`} />}
                {vehicle.j1939_battery_potential != null && <DetailRow label="Battery V" value={`${vehicle.j1939_battery_potential.toFixed(1)} V`} />}
                {vehicle.j1939_trans_oil_temp != null && <DetailRow label="Trans Oil Temp" value={`${vehicle.j1939_trans_oil_temp.toFixed(0)} °C`} warn={vehicle.j1939_trans_oil_temp > 110} />}
                {vehicle.j1939_urea_level != null && <DetailRow label="Urea Level" value={`${vehicle.j1939_urea_level.toFixed(0)}%`} warn={vehicle.j1939_urea_level < 15} />}
                {vehicle.j1939_mil === true && <DetailRow label="MIL Lamp" value="ON — Check Engine" warn />}
                {vehicle.j1939_stop_indicator === true && <DetailRow label="Stop Indicator" value="ACTIVE" warn />}
                {vehicle.j1939_water_in_fuel === true && <DetailRow label="Water in Fuel" value="DETECTED" warn />}
              </div>
            </div>
          )}

          {/* Ignition / Parking / Trip */}
          {hasStatusDuration && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Status Duration</p>
              <div className="beacon-detail-row-group">
                {vehicle.ignition_on_since && <DetailRow label="Running for" value={vehicle.ignition_on_since} />}
                {vehicle.ignition_off_since && <DetailRow label="Off for" value={vehicle.ignition_off_since} />}
                {vehicle.parked_since && <DetailRow label="Parked since" value={vehicle.parked_since} />}
                {vehicle.trip_distance != null && <DetailRow label="Trip distance" value={`${vehicle.trip_distance.toFixed(1)} km`} />}
                {vehicle.trip_avg_speed != null && <DetailRow label="Avg speed" value={`${vehicle.trip_avg_speed.toFixed(0)} km/h`} />}
              </div>
            </div>
          )}

          {/* GPS Quality */}
          {hasGPSQuality && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">GPS Quality</p>
              <div className="beacon-detail-row-group">
                {vehicle.heading != null && <DetailRow label="Heading" value={`${Math.round(vehicle.heading)}° ${headingToCompass(vehicle.heading)}`} />}
                {vehicle.altitude != null && <DetailRow label="Altitude" value={`${vehicle.altitude.toFixed(0)} m`} />}
                {vehicle.gps_satellites != null && <DetailRow label="Satellites" value={String(vehicle.gps_satellites)} />}
                {vehicle.hdop != null && <DetailRow label="HDOP" value={vehicle.hdop.toFixed(1)} />}
              </div>
            </div>
          )}

          {/* Distance & Hours */}
          {hasDistanceHours && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Distance & Hours</p>
              <div className="beacon-detail-row-group">
                {vehicle.odometer != null && <DetailRow label="Odometer" value={`${vehicle.odometer.toFixed(1)} km`} />}
                {vehicle.today_km != null && <DetailRow label="Today" value={`${vehicle.today_km.toFixed(1)} km`} />}
                {vehicle.engine_hours != null && <DetailRow label="Engine hrs" value={`${vehicle.engine_hours.toFixed(1)} h`} />}
                {vehicle.today_engine_hours != null && <DetailRow label="Today hrs" value={`${vehicle.today_engine_hours.toFixed(1)} h`} />}
                {vehicle.stop_duration && <DetailRow label="Stopped for" value={vehicle.stop_duration} />}
                {vehicle.idle_duration && <DetailRow label="Idling for" value={vehicle.idle_duration} />}
              </div>
            </div>
          )}

          {/* Fuel */}
          {hasFuel && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Fuel</p>
              {vehicle.fuel_percentage != null && (
                <div className="beacon-fuel-bar-wrap">
                  <div className="beacon-fuel-bar">
                    <div className="beacon-fuel-bar-fill" style={{ width: `${Math.min(100, vehicle.fuel_percentage)}%` }} />
                  </div>
                  <span className="beacon-fuel-label">{vehicle.fuel_percentage.toFixed(0)}%</span>
                  {vehicle.fuel_litres != null && (
                    <span className="beacon-fuel-label" style={{ color: '#00e5a0' }}>({vehicle.fuel_litres.toFixed(1)} L)</span>
                  )}
                </div>
              )}
              {vehicle.fuel_litres != null && vehicle.fuel_percentage == null && (
                <DetailRow label="Fuel" value={`${vehicle.fuel_litres.toFixed(1)} L`} />
              )}
            </div>
          )}

          {/* Engine & RPM */}
          {hasEngine && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Engine</p>
              <div className="beacon-detail-row-group">
                {vehicle.rpm != null && <DetailRow label="RPM" value={String(vehicle.rpm)} />}
                {vehicle.main_voltage != null && vehicle.main_voltage > 0 && (
                  <DetailRow label="Main power" value={`${vehicle.main_voltage.toFixed(2)} V`} warn={vehicle.is_main_power_low} />
                )}
                {vehicle.backup_voltage != null && vehicle.backup_voltage > 0 && (
                  <DetailRow label="Backup" value={`${vehicle.backup_voltage.toFixed(2)} V`} />
                )}
              </div>
            </div>
          )}

          {/* Temperature */}
          {hasTemperature && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Temperature</p>
              <div className="beacon-detail-row-group">
                {vehicle.temperature != null && <DetailRow label="Sensor 1" value={`${vehicle.temperature.toFixed(1)} °C`} />}
                {vehicle.temperature2 != null && <DetailRow label="Sensor 2" value={`${vehicle.temperature2.toFixed(1)} °C`} />}
              </div>
            </div>
          )}

          {/* Sensors & Security */}
          {hasSensors && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Sensors & Security</p>
              <div className="beacon-detail-row-group">
                {vehicle.door_status && <DetailRow label="Door" value={vehicle.door_status} warn={vehicle.door_status === 'open'} />}
                {vehicle.ac_status && <DetailRow label="AC" value={vehicle.ac_status.toUpperCase()} />}
                {vehicle.immobilizer && <DetailRow label="Immobilizer" value={vehicle.immobilizer} warn={vehicle.immobilizer === 'armed'} />}
                {vehicle.is_inside_geofence != null && <DetailRow label="Geofence" value={vehicle.is_inside_geofence ? 'Inside' : 'Outside'} />}
              </div>
            </div>
          )}

          {/* Driver */}
          {hasDriver && (
            <div className="beacon-detail-section">
              <p className="beacon-section-title">Driver</p>
              <div className="beacon-detail-row-group">
                {vehicle.driver_name && <DetailRow label="Name" value={vehicle.driver_name} />}
                {vehicle.driver_mobile && <DetailRow label="Mobile" value={vehicle.driver_mobile} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="beacon-detail-row">
      <span className="beacon-detail-label">{label}</span>
      <span className={`beacon-detail-value${warn ? ' warn' : ''}`}>{value}</span>
    </div>
  );
}
