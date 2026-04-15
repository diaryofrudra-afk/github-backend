interface GPSBottomBarProps {
  coordinates?: string;
  utcTime?: string;
  isConfigured?: boolean;
  vehicleCount?: number;
}

export function GPSBottomBar({ coordinates, utcTime, isConfigured, vehicleCount }: GPSBottomBarProps) {
  const currentTime = utcTime || (new Date().toISOString().substr(11, 8) + ' UTC');
  const statusLabel = isConfigured ? 'Connected' : 'Not Configured';
  const dataLabel = vehicleCount !== undefined && vehicleCount > 0
    ? `${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'} live`
    : isConfigured ? 'No vehicles found' : 'No data';

  return (
    <div className="gps-bottom-bar">
      <div className="gps-bottom-bar-left">
        <div className="gps-bottom-bar-status">
          <span className={`gps-bottom-bar-dot${isConfigured ? '' : ' offline'}`} />
          <span className="gps-bottom-bar-label">{statusLabel}</span>
        </div>

        <div className="gps-bottom-bar-divider" />

        <div className="gps-bottom-bar-status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span className="gps-bottom-bar-label">{dataLabel}</span>
        </div>
      </div>

      <div className="gps-bottom-bar-right">
        {coordinates && <span className="gps-bottom-bar-coords">{coordinates}</span>}
        <span className="gps-bottom-bar-coords">{currentTime}</span>
      </div>
    </div>
  );
}
