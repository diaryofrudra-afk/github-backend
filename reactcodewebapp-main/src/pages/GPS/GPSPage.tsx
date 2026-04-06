import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { useBlackbuckSettings } from '../../hooks/useBlackbuckSettings';
import { GPSMap } from '../../components/GPSMap';

export function GPSPage({ active }: { active: boolean }) {
  const { showToast } = useApp();
  const { blackbuck, blackbuckLoading, refetchBlackbuck, setGpsActive } = useData();
  const {
    credentials,
    health,
    error: settingsError,
    saving,
    fetchCredentials,
    fetchHealth,
    saveCredentials,
    deleteCredentials,
    setError,
  } = useBlackbuckSettings();

  const [showSettings, setShowSettings] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [fleetOwnerId, setFleetOwnerId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Auto-fetch GPS data when page becomes active
  useEffect(() => {
    setGpsActive(active);
    if (active) {
      fetchCredentials();
      fetchHealth();
      refetchBlackbuck();
    }
  }, [active, setGpsActive, fetchCredentials, fetchHealth, refetchBlackbuck]);

  function handleSync() {
    refetchBlackbuck();
    showToast('Syncing telemetry…', 'info');
  }

  async function handleSaveCredentials() {
    if (!authToken.trim() || !fleetOwnerId.trim()) {
      showToast('Enter both token and fleet owner ID', 'error');
      return;
    }
    const ok = await saveCredentials(authToken.trim(), fleetOwnerId.trim());
    if (ok) {
      showToast('Credentials saved! Fetching live data…', 'success');
      setAuthToken('');
      setFleetOwnerId('');
      refetchBlackbuck();
    }
  }

  async function handleDelete() {
    const ok = await deleteCredentials();
    if (ok) {
      showToast('Credentials removed', 'info');
      setConfirmDelete(false);
      refetchBlackbuck();
    }
  }

  async function handleSyncToFleet() {
    const token = localStorage.getItem('suprwise_token');
    if (!token) {
      showToast('Not authenticated', 'error');
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch('/api/gps/blackbuck/sync-to-fleet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        let msg = `${d.added} vehicles added to fleet`;
        if (d.updated > 0) msg += `, ${d.updated} updated with live GPS`;
        showToast(msg, 'success');
      } else {
        const err = await r.json();
        showToast(err.detail || 'Failed to sync vehicles', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setSyncing(false);
    }
  }

  const vehicles = blackbuck?.vehicles || [];
  const isConfigured = health?.configured || credentials?.configured;
  const showConfigError = !isConfigured && typeof blackbuck?.error === 'string' && blackbuck.error.length > 0;
  // Count vehicles with engine ON
  const engineOnCount = vehicles.filter(v => v.engine_on === true).length;
  const totalVehicles = vehicles.length;

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-gps">
      {/* Status Bar */}
      <div className="gps-sync-bar">
        <div>
          <div style={{ fontFamily: 'var(--fh)', fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
            Live GPS Tracking
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {blackbuckLoading ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} />
                <span style={{ color: 'var(--yellow)' }}>Loading…</span>
              </>
            ) : isConfigured ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ color: 'var(--green)' }}>Connected</span>
                {health?.fleet_owner_id && <span>• Fleet #{health.fleet_owner_id}</span>}
                {health?.vehicle_count != null && <span>• {engineOnCount}/{totalVehicles} engine on</span>}
              </>
            ) : (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                <span style={{ color: 'var(--red)' }}>No Credentials</span>
                <span>• Open Settings to connect</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-sm accent" onClick={handleSync} disabled={blackbuckLoading}>
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {blackbuckLoading ? 'Syncing…' : 'Sync'}
          </button>
          {vehicles.length > 0 && (
            <button
              className="btn-sm outline"
              onClick={handleSyncToFleet}
              disabled={syncing}
              title="Add GPS vehicles to Fleet menu"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              {syncing ? 'Adding…' : 'Add to Fleet'}
            </button>
          )}
          <button
            className="btn-sm outline"
            onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? 'var(--accent)' : '', color: showSettings ? '#fff' : '' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            {isConfigured ? 'Update' : 'Settings'}
          </button>
        </div>
      </div>

      {/* Error Banner - only show if no credentials configured */}
      {showConfigError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: 'var(--red)' }}>
          ⚠️ {blackbuck.error}
          <button className="btn-sm outline" style={{ marginLeft: '12px', fontSize: '11px' }} onClick={() => setShowSettings(true)}>
            Configure
          </button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ padding: '20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rlg)', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--fh)', fontSize: '14px', marginBottom: '8px', color: 'var(--t1)' }}>
            Blackbuck API Credentials
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '16px', lineHeight: 1.5 }}>
            {isConfigured
              ? 'Your credentials are stored and encrypted. Enter new values below to update.'
              : 'Log in at '}
            {!isConfigured && (
              <>
                <a href="https://blackbuck.com/boss/gps" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  blackbuck.com/boss/gps
                </a>
                {' '}→ Open DevTools (Cmd+Option+I) → Application → Local Storage → Copy the value of{' '}
                <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '3px' }}>accessToken</code>
                {' '}and{' '}
                <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '3px' }}>fleetOwnerID</code>
              </>
            )}
          </p>

          {credentials?.configured && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px', color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Current: Fleet #{credentials.fleet_owner_id} • Updated {credentials.updated_at || 'recently'}</span>
              <button
                className="btn-sm outline"
                style={{ fontSize: '10px', color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={() => setConfirmDelete(true)}
              >
                Remove
              </button>
            </div>
          )}

          {confirmDelete && (
            <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--red)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Remove your Blackbuck credentials? This will stop live GPS tracking.</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-sm accent" style={{ background: 'var(--red)' }} onClick={handleDelete}>Yes, Remove</button>
                <button className="btn-sm outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', marginBottom: '4px', display: 'block' }}>
                Auth Token (accessToken from localStorage)
              </label>
              <input
                type="text"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiJ9..."
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--t1)', fontSize: '11px', fontFamily: 'var(--fm)',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', marginBottom: '4px', display: 'block' }}>
                Fleet Owner ID
              </label>
              <input
                type="text"
                value={fleetOwnerId}
                onChange={(e) => setFleetOwnerId(e.target.value)}
                placeholder="e.g. 5599426"
                style={{
                  width: '100%', maxWidth: '200px', padding: '10px 12px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--t1)',
                  fontSize: '11px', fontFamily: 'var(--fm)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-sm accent" onClick={handleSaveCredentials} disabled={saving}>
                {saving ? 'Validating & Saving…' : 'Save & Test'}
              </button>
              <button className="btn-sm outline" onClick={() => { setShowSettings(false); setError(null); setConfirmDelete(false); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Table */}
      {vehicles.length > 0 ? (
        <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Status</th>
                <th>Engine</th>
                <th>Speed</th>
                <th>Signal</th>
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
                      <span className={`badge ${v.status === 'moving' ? 'green' : v.status === 'stopped' ? 'red' : v.status === 'wire_disconnected' ? 'yellow' : ''}`}>
                        {v.status_display_text || v.status.replace(/_/g, ' ')}
                      </span>
                      {v.status === 'moving' && <span className="pulse-dot" title="Live" />}
                    </div>
                  </td>
                  <td>
                    {v.engine_on === true ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--green)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                        ON
                      </span>
                    ) : v.engine_on === false ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--t3)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3" /></svg>
                        OFF
                      </span>
                    ) : (
                      <span style={{ color: 'var(--t3)' }}>—</span>
                    )}
                    {v.ignition_lock && (
                      <span title="Ignition locked" style={{ marginLeft: '4px', fontSize: '10px' }}>🔒</span>
                    )}
                  </td>
                  <td>{v.speed != null ? `${v.speed} km/h` : '—'}</td>
                  <td>
                    {v.signal && v.signal !== 'Unknown' ? (
                      <span style={{
                        fontSize: '10px',
                        color: v.signal.includes('Strong') ? 'var(--green)' : v.signal.includes('Good') ? 'var(--yellow)' : 'var(--t3)',
                      }}>
                        📶 {v.signal}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--fm)', fontSize: '10px' }}>
                    {v.latitude != null && v.latitude !== 0 && v.longitude != null && v.longitude !== 0 ? (
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

      {/* Vehicle Map */}
      {vehicles.length > 0 ? (
        <div style={{
          marginBottom: '16px',
          borderRadius: 'var(--rlg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          height: '450px',
          background: 'var(--bg2)',
        }}>
          <GPSMap vehicles={vehicles.filter(v => v.latitude != null && v.longitude != null) as any} active={active} />
        </div>
      ) : null}

      {/* Empty state */}
      {!vehicles.length && !blackbuckLoading && !showConfigError && (
        <div className="gps-iframe-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px', background: 'var(--bg3)', borderRadius: 'var(--rlg)', border: '1px solid var(--border)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
          </svg>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>No GPS Data</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
            Connect your Blackbuck account to see live GPS tracking data for your fleet.
          </div>
          <button className="btn-sm accent" onClick={() => setShowSettings(true)}>
            Open Settings
          </button>
        </div>
      )}
    </div>
  );
}
