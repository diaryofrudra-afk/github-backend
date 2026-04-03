import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';

export function GPSPage({ active }: { active: boolean }) {
  const { showToast } = useApp();
  const { blackbuck, blackbuckLoading, refetchBlackbuck } = useData();

  function handleSync() {
    refetchBlackbuck();
    showToast('Syncing telemetry…', 'info');
  }

  function handleMock() {
    showToast('Mock data injected', 'info');
  }

  const vehicles = blackbuck?.vehicles || [];

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-gps">
      <div className="gps-sync-bar">
        <div>
          <div style={{ fontFamily: 'var(--fh)', fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
            Live GPS Tracking
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px' }}>
            fleet.blackbuck.com
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-sm accent" id="btn-gps-sync" onClick={handleSync}>
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {blackbuckLoading ? 'Syncing…' : 'Sync Telemetry'}
          </button>
          <button className="btn-sm outline" id="btn-gps-mock" title="Inject test data without Blackbuck credentials" onClick={handleMock}>
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Test Mock
          </button>
        </div>
      </div>

      {vehicles.length > 0 ? (
        <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Status</th>
                <th>Speed</th>
                <th>Coordinates</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.registration_number}>
                  <td style={{ fontWeight: 700 }}>{v.registration_number}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${v.status === 'moving' ? 'green' : v.status === 'stopped' ? 'red' : ''}`}>
                        {v.status}
                      </span>
                      {v.status === 'moving' && <span className="pulse-dot" title="Live updates active" />}
                    </div>
                  </td>
                  <td>{v.speed != null ? `${v.speed} km/h` : '—'}</td>
                  <td style={{ fontFamily: 'var(--fm)', fontSize: '10px' }}>
                    {v.latitude != null && v.longitude != null ? (
                      <span style={{ color: 'var(--accent)' }}>
                        {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: '10px', color: 'var(--t3)' }}>{v.last_updated || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {vehicles.length > 0 ? (
        <div className="gps-map-container" style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--rlg)',
          border: '1px solid var(--border)',
          padding: '20px',
          marginBottom: '16px',
          height: '400px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Simple SVG Grid Map */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--t1)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {(() => {
              const withCoords = vehicles.filter(v => v.latitude != null && v.longitude != null);
              if (withCoords.length === 0) return null;

              // Calculate bounds for better projection
              const lats = withCoords.map(v => v.latitude as number);
              const lngs = withCoords.map(v => v.longitude as number);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              const latRange = Math.max(maxLat - minLat, 0.01);
              const lngRange = Math.max(maxLng - minLng, 0.01);

              return withCoords.map(v => {
                const lat = v.latitude as number;
                const lng = v.longitude as number;

                // Scale to 10-90% to avoid edges
                const x = 10 + ((lng - minLng) / lngRange) * 80;
                const y = 90 - ((lat - minLat) / latRange) * 80; // Invert Y for map

                return (
                  <div
                    key={v.registration_number}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'all 1s ease-in-out',
                      zIndex: 10
                    }}
                  >
                    <div className={`pulse-dot ${v.status === 'moving' ? 'green' : 'red'}`} style={{ width: '12px', height: '12px', background: v.status === 'moving' ? 'var(--green)' : 'var(--red)' }} />
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      background: 'var(--bg3)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      color: 'var(--t1)',
                      boxShadow: 'var(--sh)'
                    }}>
                      {v.registration_number}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <div style={{ position: 'absolute', bottom: '12px', left: '12px', fontSize: '10px', color: 'var(--t3)', background: 'var(--bg2)', padding: '4px 8px', borderRadius: '4px' }}>
            Visual Telemetry Area (Relative Coordinates)
          </div>
        </div>
      ) : null}

      <div className="gps-iframe-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', background: 'var(--bg3)', borderRadius: 'var(--rlg)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--t2)', textAlign: 'center' }}>
          Real-time map requires external provider access.
        </div>
        <a
          href="https://fleet.blackbuck.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-sm outline"
          style={{ textDecoration: 'none' }}
        >
          View on Blackbuck Fleet Map →
        </a>
      </div>
    </div>
  );
}
