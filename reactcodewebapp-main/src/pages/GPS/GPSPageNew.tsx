import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useUnifiedGPS, type UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import { useBlackbuckSettings } from '../../hooks/useBlackbuckSettings';
import { useTrakNTellSettings } from '../../hooks/useTrakNTellSettings';
import { Modal } from '../../components/ui/Modal';
import { GPSMap } from './GPSMap';
import { GPSLeftPanel } from './GPSLeftPanel';
import { GPSRightPanel } from './GPSRightPanel';
import { TnTHistoryPanel } from './TnTHistoryPanel';
import { BlackbuckHistoryModal } from './BlackbuckHistoryModal';
import { EngineHistoryModal } from '../../components/EngineHistoryModal';
import L from 'leaflet';

type GPSVehicle = UnifiedVehicle;

export function GPSPageNew({ active }: { active: boolean }) {
  const { showToast } = useApp();
  const { vehicles, loading, refetch } = useUnifiedGPS();

  const {
    credentials: bbCredentials,
    health: bbHealth,
    fetchCredentials: bbFetchCredentials,
    fetchHealth: bbFetchHealth,
    deleteCredentials: bbDeleteCredentials,
  } = useBlackbuckSettings();

  const {
    credentials: tntCredentials,
    health: tntHealth,
    fetchCredentials: tntFetchCredentials,
    fetchHealth: tntFetchHealth,
    deleteCredentials: tntDeleteCredentials,
  } = useTrakNTellSettings();

  const [filterQuery, setFilterQuery] = useState('');
  const mapRef = useRef<L.Map | null>(null);
  const [historyVehicle, setHistoryVehicle] = useState<UnifiedVehicle | null>(null);
  const [engineHistoryReg, setEngineHistoryReg] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'blackbuck' | 'trakntell'>('blackbuck');
  const [bbConfirmDelete, setBbConfirmDelete] = useState(false);
  const [tntConfirmDelete, setTntConfirmDelete] = useState(false);
  const [bbAutoPhone, setBbAutoPhone] = useState('');
  const [bbAutoOtp, setBbAutoOtp] = useState('');
  const [bbAutoSessionToken, setBbAutoSessionToken] = useState('');
  const [bbOtpSent, setBbOtpSent] = useState(false);
  const [bbAutoLogging, setBbAutoLogging] = useState(false);
  const [bbLoginMode, setBbLoginMode] = useState<'otp' | 'password'>('otp');
  const [bbAutoPassword, setBbAutoPassword] = useState('');
  const [tntAutoUsername, setTntAutoUsername] = useState('');
  const [tntAutoPassword, setTntAutoPassword] = useState('');
  const [tntAutoLogging, setTntAutoLogging] = useState(false);

  useEffect(() => {
    if (active) {
      bbFetchCredentials();
      bbFetchHealth();
      tntFetchCredentials();
      tntFetchHealth();
      refetch();
    }
  }, [active, bbFetchCredentials, bbFetchHealth, tntFetchCredentials, tntFetchHealth, refetch]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => { refetch(); }, 30000);
    return () => clearInterval(interval);
  }, [active, refetch]);

  const bbConfigured = bbHealth?.configured || bbCredentials?.configured;
  const tntConfigured = tntHealth?.configured || tntCredentials?.configured;
  const isAnyConfigured = bbConfigured || tntConfigured;

  const filteredVehicles = useMemo(() => {
    if (!filterQuery) return vehicles;
    const query = filterQuery.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.registration_number.toLowerCase().includes(query) ||
        v.status.toLowerCase().includes(query) ||
        (v.address || '').toLowerCase().includes(query)
    );
  }, [vehicles, filterQuery]);

  const connectedCount = useMemo(
    () => vehicles.filter((v) => v.status !== 'signal_lost' && v.status !== 'wire_disconnected').length,
    [vehicles]
  );

  const engineOnCount = useMemo(
    () => vehicles.filter((v) => v.ignition === 'on' || v.engine_on === true).length,
    [vehicles]
  );

  const handleSync = () => {
    refetch()
      .then(() => { showToast('GPS data synced', 'success'); })
      .catch(() => { showToast('Failed to sync GPS data', 'error'); });
  };

  const handleVehicleClick = (vehicle: GPSVehicle) => {
    if (vehicle.latitude && vehicle.longitude && mapRef.current) {
      mapRef.current.setView([vehicle.latitude, vehicle.longitude], 15, { animate: true });
    }
  };

  const handleLayersClick = () => { showToast('Layer switching coming soon', 'info'); };

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mapRef.current) {
            mapRef.current.setView([position.coords.latitude, position.coords.longitude], 15, { animate: true });
          }
        },
        () => { showToast('Unable to retrieve your location', 'error'); }
      );
    }
  };

  const handleZoomIn = () => { if (mapRef.current) mapRef.current.zoomIn(); };
  const handleZoomOut = () => { if (mapRef.current) mapRef.current.zoomOut(); };

  const handleSyncToFleet = async () => {
    const token = localStorage.getItem('suprwise_token');
    if (!token) { showToast('Not authenticated', 'error'); return; }
    try {
      const r = await fetch('/api/gps/sync-to-fleet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        let msg = `${d.added} vehicles added to fleet`;
        if (d.updated > 0) msg += `, ${d.updated} updated`;
        showToast(msg, 'success');
      } else {
        const err = await r.json();
        showToast(err.detail || 'Failed to sync', 'error');
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    bbFetchCredentials();
    tntFetchCredentials();
  };

  const handleTntHistory = (vehicle: UnifiedVehicle) => {
    setHistoryVehicle(vehicle);
  };

  async function handleDeleteBlackbuck() {
    const ok = await bbDeleteCredentials();
    if (ok) {
      showToast('Blackbuck credentials removed', 'info');
      setBbConfirmDelete(false);
      refetch();
    }
  }

  async function handleDeleteTrakNTell() {
    const ok = await tntDeleteCredentials();
    if (ok) {
      showToast('Trak N Tell credentials removed', 'info');
      setTntConfirmDelete(false);
      refetch();
    }
  }

  async function handleRequestOtpBlackbuck() {
    if (!bbAutoPhone.trim()) { showToast('Enter your Blackbuck phone number', 'error'); return; }
    const token = localStorage.getItem('suprwise_token');
    setBbAutoLogging(true);
    showToast('Requesting OTP from Blackbuck...', 'info');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100_000); // 100s client-side timeout
      try {
        const r = await fetch('/api/gps/blackbuck/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ phone: bbAutoPhone.trim() }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await r.json();
        if (r.ok) {
          setBbAutoSessionToken(data.session_token);
          setBbOtpSent(true);
          showToast('OTP sent to your phone!', 'success');
        } else {
          const detail = Array.isArray(data.detail)
            ? data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
            : (data.detail || 'Failed to send OTP');
          showToast(detail, 'error');
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          showToast('Request timed out. Blackbuck may be blocking automated access. Try again.', 'error');
        } else {
          throw e;
        }
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handleVerifyOtpBlackbuck() {
    if (!bbAutoOtp.trim()) { showToast('Enter the OTP sent to your phone', 'error'); return; }
    const token = localStorage.getItem('suprwise_token');
    setBbAutoLogging(true);
    try {
      const r = await fetch('/api/gps/blackbuck/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_token: bbAutoSessionToken, otp: bbAutoOtp.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        showToast('Blackbuck connected via OTP login!', 'success');
        setBbAutoPhone(''); setBbAutoOtp(''); setBbAutoSessionToken(''); setBbOtpSent(false);
        bbFetchCredentials(); bbFetchHealth(); refetch();
      } else {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
          : (data.detail || 'OTP verification failed');
        showToast(detail, 'error');
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handlePasswordLoginBlackbuck() {
    if (!bbAutoPhone.trim() || !bbAutoPassword.trim()) { showToast('Enter phone and password', 'error'); return; }
    const token = localStorage.getItem('suprwise_token');
    setBbAutoLogging(true);
    showToast('Connecting securely to Blackbuck...', 'info');
    try {
      const r = await fetch('/api/gps/blackbuck/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: bbAutoPhone.trim(), password: bbAutoPassword.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        showToast('Blackbuck connected via password!', 'success');
        setBbAutoPhone(''); setBbAutoPassword('');
        bbFetchCredentials(); bbFetchHealth(); refetch();
      } else {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
          : (data.detail || 'Password login failed');
        showToast(detail, 'error');
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handleAutoLoginTrakNTell() {
    if (!tntAutoUsername.trim() || !tntAutoPassword.trim()) {
      showToast('Enter Trak N Tell username/phone and password', 'error');
      return;
    }
    const token = localStorage.getItem('suprwise_token');
    setTntAutoLogging(true);
    try {
      const r = await fetch('/api/gps/trakntell/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: tntAutoUsername.trim(), password: tntAutoPassword.trim() }),
      });
      if (r.ok) {
        showToast('Trak N Tell connected via auto-login!', 'success');
        setTntAutoUsername(''); setTntAutoPassword('');
        tntFetchCredentials(); tntFetchHealth(); refetch();
      } else {
        const err = await r.json();
        const detail = Array.isArray(err.detail)
          ? err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
          : (err.detail || 'Auto-login failed');
        showToast(detail, 'error');
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setTntAutoLogging(false); }
  }

  return (
    <div className={`beacon-page ${active ? 'active' : ''}`} id="page-gps">
      {/* Map */}
      <GPSMap
        vehicles={filteredVehicles}
        onVehicleClick={handleVehicleClick}
        mapRef={mapRef}
        isDark={false}
      />

      {/* Left Panel - Stats & Tools */}
      <GPSLeftPanel
        connectedCount={connectedCount}
        totalCount={vehicles.length}
        engineOnCount={engineOnCount}
        onLayersClick={handleLayersClick}
        onLocationClick={handleLocationClick}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSettings={handleOpenSettings}
      />

      {/* Right Panel - Asset List */}
      <GPSRightPanel
        vehicles={filteredVehicles}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        onVehicleClick={handleVehicleClick}
        onSync={handleSync}
        onAdd={handleSyncToFleet}
        onSettings={handleOpenSettings}
        isConfigured={!!isAnyConfigured}
        onHistory={(v) => handleTntHistory(v)}
        onEngineHistory={(v) => setEngineHistoryReg(v.registration_number)}
      />

      {/* Empty / Unconfigured state */}
      {!isAnyConfigured && !loading && (
        <div className="beacon-unconfigured-overlay">
          <div className="beacon-empty-center">
            <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.3, marginBottom: 16 }}>satellite_alt</span>
            <h3>No GPS Providers Configured</h3>
            <p>Connect Blackbuck or Trak N Tell to see live vehicle tracking.</p>
            <button className="beacon-btn-primary" onClick={handleOpenSettings}>Configure GPS Providers</button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="beacon-loading-overlay">
          <div className="beacon-loading-spinner" />
        </div>
      )}

      {/* Blackbuck Play History Modal */}
      {historyVehicle?.provider === 'blackbuck' && (
        <div className="tnt-history-overlay" onClick={() => setHistoryVehicle(null)}>
          <div className="tnt-history-modal" onClick={e => e.stopPropagation()}>
            <BlackbuckHistoryModal
              vehicle={historyVehicle}
              onClose={() => setHistoryVehicle(null)}
            />
          </div>
        </div>
      )}

      {/* Trak N Tell History Panel */}
      {historyVehicle && historyVehicle.provider === 'trakntell' && (
        <div className="tnt-history-overlay" onClick={() => setHistoryVehicle(null)}>
          <div className="tnt-history-modal" onClick={e => e.stopPropagation()}>
            <TnTHistoryPanel
              vehicleId={historyVehicle.device_id || historyVehicle.vehicle_id || historyVehicle.registration_number}
              registrationNumber={historyVehicle.registration_number}
              onClose={() => setHistoryVehicle(null)}
            />
          </div>
        </div>
      )}

      {/* Engine History Modal */}
      {engineHistoryReg && (
        <EngineHistoryModal
          craneReg={engineHistoryReg}
          open={true}
          onClose={() => setEngineHistoryReg(null)}
        />
      )}

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setBbConfirmDelete(false); setTntConfirmDelete(false); }}
        title="GPS Settings"
      >
        {/* Provider Tabs */}
        <div className="gps-settings-tabs">
          <button
            className={`gps-settings-tab${settingsTab === 'blackbuck' ? ' active' : ''}`}
            onClick={() => setSettingsTab('blackbuck')}
          >
            Blackbuck
            {bbConfigured && <span className="gps-settings-tab-dot configured" />}
          </button>
          <button
            className={`gps-settings-tab${settingsTab === 'trakntell' ? ' active' : ''}`}
            onClick={() => setSettingsTab('trakntell')}
          >
            Trak N Tell
            {tntConfigured && <span className="gps-settings-tab-dot configured" />}
          </button>
        </div>

        {/* Blackbuck */}
        {settingsTab === 'blackbuck' && (
          <div className="gps-settings-panel">
            {bbCredentials?.configured && !bbConfirmDelete && (
              <div className="gps-settings-info-row">
                <div className="gps-settings-info-text">
                  <span className="gps-settings-connected-dot" />
                  Fleet #{bbCredentials.fleet_owner_id}
                  <span className="gps-settings-updated">· Updated {bbCredentials.updated_at || 'recently'}</span>
                </div>
                <button
                  className="btn-sm outline danger"
                  onClick={() => setBbConfirmDelete(true)}
                >
                  Remove
                </button>
              </div>
            )}
            {bbConfirmDelete && (
              <div className="gps-settings-confirm-row">
                <span>Remove Blackbuck credentials?</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-sm accent" style={{ background: 'var(--red)' }} onClick={handleDeleteBlackbuck}>Yes, Remove</button>
                  <button className="btn-sm outline" onClick={() => setBbConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="gps-settings-hint" style={{ marginBottom: 16 }}>
              <strong>Auto Login</strong> — connect your fleet securely via OTP or Password.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className={`btn-sm ${bbLoginMode === 'otp' ? 'accent' : 'outline'}`} 
                onClick={() => setBbLoginMode('otp')}
              >OTP Login</button>
              <button 
                className={`btn-sm ${bbLoginMode === 'password' ? 'accent' : 'outline'}`} 
                onClick={() => setBbLoginMode('password')}
              >Password Login</button>
            </div>

            <label className="lbl">Phone Number</label>
            <input
              className="inp"
              type="tel"
              value={bbAutoPhone}
              onChange={e => setBbAutoPhone(e.target.value)}
              placeholder="9876543210 (10 digits or +91...)"
            />

            {bbLoginMode === 'password' ? (
              <>
                <label className="lbl" style={{ marginTop: 12 }}>Password</label>
                <input
                  className="inp"
                  type="password"
                  value={bbAutoPassword}
                  onChange={e => setBbAutoPassword(e.target.value)}
                  placeholder="Your Blackbuck password"
                  onKeyDown={e => e.key === 'Enter' && handlePasswordLoginBlackbuck()}
                />
                <button className="btn-sm accent" style={{ marginTop: 12 }} onClick={handlePasswordLoginBlackbuck} disabled={bbAutoLogging}>
                  {bbAutoLogging ? 'Logging in…' : 'Log In with Password'}
                </button>
              </>
            ) : (
              !bbOtpSent ? (
                <button className="btn-sm accent" style={{ marginTop: 12 }} onClick={handleRequestOtpBlackbuck} disabled={bbAutoLogging}>
                  {bbAutoLogging ? 'Requesting OTP…' : 'Send OTP'}
                </button>
              ) : (
                <>
                  <div className="gps-settings-otp-sent" style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: 'var(--success)' }}>
                    ✓ OTP sent to {bbAutoPhone}
                  </div>
                  <label className="lbl">Enter OTP</label>
                  <input
                    className="inp"
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={bbAutoOtp}
                    onChange={e => setBbAutoOtp(e.target.value)}
                    placeholder="6-digit OTP"
                    style={{ maxWidth: '160px' }}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtpBlackbuck()}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: 12 }}>
                    <button className="btn-sm accent" onClick={handleVerifyOtpBlackbuck} disabled={bbAutoLogging}>
                      {bbAutoLogging ? 'Verifying…' : 'Verify & Connect'}
                    </button>
                    <button className="btn-sm outline" onClick={() => { setBbOtpSent(false); setBbAutoOtp(''); setBbAutoSessionToken(''); }}>
                      Resend
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        )}

        {/* Trak N Tell */}
        {settingsTab === 'trakntell' && (
          <div className="gps-settings-panel">
            {tntCredentials?.configured && !tntConfirmDelete && (
              <div className="gps-settings-info-row">
                <div className="gps-settings-info-text">
                  <span className="gps-settings-connected-dot" />
                  User #{tntCredentials.user_id_preview}
                  {tntCredentials.has_sessionid && <span className="gps-settings-session-badge">Session Active</span>}
                </div>
                <button
                  className="btn-sm outline danger"
                  onClick={() => setTntConfirmDelete(true)}
                >
                  Remove
                </button>
              </div>
            )}
            {tntConfirmDelete && (
              <div className="gps-settings-confirm-row">
                <span>Remove Trak N Tell credentials?</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-sm accent" style={{ background: 'var(--red)' }} onClick={handleDeleteTrakNTell}>Yes, Remove</button>
                  <button className="btn-sm outline" onClick={() => setTntConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="gps-settings-hint">
              <strong>Auto Login</strong> — enter your Trak N Tell credentials and the backend will extract the session token automatically.
            </div>

            <label className="lbl">Phone / Username</label>
            <input
              className="inp"
              type="text"
              value={tntAutoUsername}
              onChange={e => setTntAutoUsername(e.target.value)}
              placeholder="+91 98765 43210 or username"
            />
            <label className="lbl">Password</label>
            <input
              className="inp"
              type="password"
              value={tntAutoPassword}
              onChange={e => setTntAutoPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleAutoLoginTrakNTell()}
            />
            <button className="btn-sm accent" onClick={handleAutoLoginTrakNTell} disabled={tntAutoLogging}>
              {tntAutoLogging ? 'Connecting…' : 'Auto Login'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
