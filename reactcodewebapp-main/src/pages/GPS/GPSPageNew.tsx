import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useUnifiedGPS, type UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import { useBlackbuckSettings } from '../../hooks/useBlackbuckSettings';
import { useTrakNTellSettings } from '../../hooks/useTrakNTellSettings';
import { useWheelsEyeSettings } from '../../hooks/useWheelsEyeSettings';
import { Modal } from '../../components/ui/Modal';
import { GPSMap, getVehicleCategory } from './GPSMap';
import { VehicleTelemetry } from './VehicleTelemetry';
import { TnTHistoryPanel } from './TnTHistoryPanel';
import { BlackbuckHistoryModal } from './BlackbuckHistoryModal';
import { EngineHistoryModal } from '../../components/EngineHistoryModal';
import { api } from '../../services/api';
import L from 'leaflet';
import './GPSPageNew.css';

type StatusFilter = 'all' | 'working' | 'idle' | 'alert' | 'off';

function statusLabel(v: UnifiedVehicle): string {
  const cat = getVehicleCategory(v);
  if (cat === 'working') return (v.speed ?? 0) > 2 ? `Moving ${v.speed} km/h` : 'Lifting';
  if (cat === 'idle')    return 'Idle (engine on)';
  if (cat === 'alert')   return v.status === 'wire_disconnected' ? 'GPS wire off' : 'Needs attention';
  return 'Not started';
}

function fmt(n: number | undefined | null, unit = ''): string {
  if (n == null) return '—';
  return `${n}${unit}`;
}

// Builds the "N vehicles · updated <date>" sub-line for a connected GPS provider.
function providerMeta(health: { vehicle_count?: number } | null | undefined, updatedAt?: string): string {
  const parts: string[] = [];
  const count = health?.vehicle_count;
  if (count != null) parts.push(`${count} vehicle${count === 1 ? '' : 's'}`);
  if (updatedAt) {
    const d = new Date(updatedAt);
    if (!isNaN(d.getTime())) parts.push(`updated ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`);
  }
  return parts.join(' · ');
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────

export function GPSPageNew({ active }: { active: boolean }) {
  const { setState, showToast } = useApp();
  const { vehicles, initialLoading, refetch, loading } = useUnifiedGPS();
  
  const { credentials: bbCredentials, health: bbHealth, fetchCredentials: bbFetchCredentials, fetchHealth: bbFetchHealth, deleteCredentials: bbDeleteCredentials } = useBlackbuckSettings();
  const { credentials: tntCredentials, health: tntHealth, fetchCredentials: tntFetchCredentials, fetchHealth: tntFetchHealth, deleteCredentials: tntDeleteCredentials } = useTrakNTellSettings();
  const { credentials: weCredentials, health: weHealth, fetchCredentials: weFetchCredentials, fetchHealth: weFetchHealth, deleteCredentials: weDeleteCredentials } = useWheelsEyeSettings();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<UnifiedVehicle | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const [bbConfirmDelete, setBbConfirmDelete] = useState(false);
  const [tntConfirmDelete, setTntConfirmDelete] = useState(false);
  const [bbAutoPhone, setBbAutoPhone]         = useState('');
  const [bbAutoOtp, setBbAutoOtp]             = useState('');
  const [bbAutoSessionToken, setBbAutoSessionToken] = useState('');
  const [bbOtpSent, setBbOtpSent]             = useState(false);
  const [bbAutoLogging, setBbAutoLogging]     = useState(false);
  const [bbLoginMode, setBbLoginMode]         = useState<'otp' | 'password'>('otp');
  const [bbAutoPassword, setBbAutoPassword]   = useState('');
  const [tntAutoUsername, setTntAutoUsername] = useState('');
  const [tntAutoPassword, setTntAutoPassword] = useState('');
  const [tntAutoLogging, setTntAutoLogging]   = useState(false);
  const [weConfirmDelete, setWeConfirmDelete] = useState(false);
  const [weAutoPhone, setWeAutoPhone]         = useState('');
  const [weAutoOtp, setWeAutoOtp]             = useState('');
  const [weAutoSessionToken, setWeAutoSessionToken] = useState('');
  const [weOtpSent, setWeOtpSent]             = useState(false);
  const [weAutoLogging, setWeAutoLogging]     = useState(false);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [settingsTab, setSettingsTab]         = useState<'blackbuck' | 'trakntell' | 'wheelseye'>('blackbuck');

  const [tntHistoryOpen, setTntHistoryOpen] = useState(false);
  const [bbHistoryOpen, setBbHistoryOpen] = useState(false);
  const [engineHistoryOpen, setEngineHistoryOpen] = useState(false);
  const [syncingToFleet, setSyncingToFleet] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Notifications (engine ON/OFF events from the GPS poller) ──
  const [userKey, setUserKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: string; timestamp: string; read: number }[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const loadNotifications = useMemo(() => async (key: string) => {
    try {
      const rows = await api.getNotifications(key);
      // Newest first
      rows.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setNotifications(rows as any);
    } catch { /* ignore transient fetch errors */ }
  }, []);

  // Resolve current user id once (used as notification user_key)
  useEffect(() => {
    if (!active || userKey) return;
    api.me().then(me => setUserKey(me.user_id)).catch(() => {});
  }, [active, userKey]);

  // Poll notifications while the GPS page is active
  useEffect(() => {
    if (!active || !userKey) return;
    loadNotifications(userKey);
    const t = setInterval(() => loadNotifications(userKey), 20_000);
    return () => clearInterval(t);
  }, [active, userKey, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    try { await api.markNotificationRead(id); } catch { /* will re-sync on next poll */ }
  };

  useEffect(() => {
    if (!active) return;
    bbFetchCredentials(); bbFetchHealth(); tntFetchCredentials(); tntFetchHealth(); weFetchCredentials(); weFetchHealth(); refetch();
  }, [active, bbFetchCredentials, bbFetchHealth, tntFetchCredentials, tntFetchHealth, weFetchCredentials, weFetchHealth, refetch]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => refetch(), 30_000);
    return () => clearInterval(t);
  }, [active, refetch]);

  const bbConfigured  = bbHealth?.configured  || bbCredentials?.configured;
  const tntConfigured = tntHealth?.configured || tntCredentials?.configured;
  const weConfigured  = weHealth?.configured  || weCredentials?.configured;

  const handleSyncToFleet = async () => {
    setSyncingToFleet(true);
    try {
      const d = await api.syncGPSToFleet();
      showToast(`${d.added} vehicles added${d.updated > 0 ? `, ${d.updated} updated` : ''}`, 'success');
      
      const updatedCranes = await api.getCranes();
      setState(prev => ({ ...prev, cranes: updatedCranes }));
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setSyncingToFleet(false); }
  };

  // Called right after a provider connects so its vehicles auto-populate the Fleet
  // (cranes) list as well as the live map. Best-effort: failures are non-fatal.
  const autoSyncToFleet = async () => {
    try {
      await api.syncGPSToFleet();
      const updatedCranes = await api.getCranes();
      setState(prev => ({ ...prev, cranes: updatedCranes }));
    } catch { /* live view already refreshed; Fleet sync is best-effort */ }
  };

  async function handleDeleteBlackbuck() {
    if (await bbDeleteCredentials()) { showToast('Blackbuck credentials removed', 'info'); setBbConfirmDelete(false); refetch(); }
  }
  async function handleDeleteTrakNTell() {
    if (await tntDeleteCredentials()) { showToast('Trak N Tell credentials removed', 'info'); setTntConfirmDelete(false); refetch(); }
  }

  async function handleRequestOtpBlackbuck() {
    if (!bbAutoPhone.trim()) { showToast('Enter your Blackbuck phone number', 'error'); return; }
    setBbAutoLogging(true);
    try {
      const d = await api.blackbuckRequestOtp(bbAutoPhone.trim());
      setBbAutoSessionToken(d.session_token); setBbOtpSent(true); showToast('OTP sent!', 'success');
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handleVerifyOtpBlackbuck() {
    if (!bbAutoOtp.trim()) { showToast('Enter the OTP', 'error'); return; }
    setBbAutoLogging(true);
    try {
      await api.blackbuckVerifyOtp(bbAutoSessionToken, bbAutoOtp.trim());
      showToast('Blackbuck connected!', 'success'); setBbOtpSent(false); setSettingsOpen(false); refetch(); autoSyncToFleet();
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handlePasswordLoginBlackbuck() {
    if (!bbAutoPhone.trim() || !bbAutoPassword.trim()) { showToast('Enter phone and password', 'error'); return; }
    setBbAutoLogging(true);
    try {
      await api.blackbuckAutoLogin(bbAutoPhone.trim(), bbAutoPassword.trim());
      showToast('Blackbuck connected!', 'success'); setSettingsOpen(false); refetch(); autoSyncToFleet();
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setBbAutoLogging(false); }
  }

  async function handleAutoLoginTrakNTell() {
    if (!tntAutoUsername.trim() || !tntAutoPassword.trim()) { showToast('Enter credentials', 'error'); return; }
    setTntAutoLogging(true);
    try {
      await api.trakntellAutoLogin(tntAutoUsername.trim(), tntAutoPassword.trim());
      showToast('Trak N Tell connected!', 'success'); setSettingsOpen(false); refetch(); autoSyncToFleet();
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setTntAutoLogging(false); }
  }

  async function handleDeleteWheelsEye() {
    if (await weDeleteCredentials()) { showToast('WheelsEye credentials removed', 'info'); setWeConfirmDelete(false); refetch(); }
  }

  async function handleRequestOtpWheelsEye() {
    if (!weAutoPhone.trim()) { showToast('Enter your WheelsEye phone number', 'error'); return; }
    setWeAutoLogging(true);
    try {
      const d = await api.wheelseyeRequestOtp(weAutoPhone.trim());
      setWeAutoSessionToken(d.session_token); setWeOtpSent(true); showToast('OTP sent!', 'success');
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setWeAutoLogging(false); }
  }

  async function handleVerifyOtpWheelsEye() {
    if (!weAutoOtp.trim()) { showToast('Enter the OTP', 'error'); return; }
    setWeAutoLogging(true);
    try {
      await api.wheelseyeVerifyOtp(weAutoSessionToken, weAutoOtp.trim());
      showToast('WheelsEye connected!', 'success'); setWeOtpSent(false); setSettingsOpen(false);
      weFetchCredentials(); weFetchHealth(); refetch(); autoSyncToFleet();
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setWeAutoLogging(false); }
  }

  // Derived stats
  const stats = useMemo(() => {
    const working = vehicles.filter(v => getVehicleCategory(v) === 'working').length;
    const idle    = vehicles.filter(v => getVehicleCategory(v) === 'idle').length;
    const alert   = vehicles.filter(v => getVehicleCategory(v) === 'alert').length;
    const off     = vehicles.filter(v => getVehicleCategory(v) === 'off').length;
    return { working, idle, alert, off, total: vehicles.length };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (filter !== 'all') {
      list = list.filter(v => getVehicleCategory(v) === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v => 
        v.registration_number.toLowerCase().includes(q) || 
        (v.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, filter, searchQuery]);

  const zoomMap = (dir: number) => {
    if (mapRef.current) {
      mapRef.current.setZoom(mapRef.current.getZoom() + dir);
    }
  };

  const resetMap = () => {
    if (mapRef.current && filteredVehicles.length > 0) {
      const pts = filteredVehicles.filter(v => v.latitude && v.longitude);
      if (pts.length > 0) {
        const bounds = L.latLngBounds(pts.map(v => [v.latitude!, v.longitude!]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  const handleVehicleSelect = (v: UnifiedVehicle) => {
    setSelectedVehicle(v);
    if (mapRef.current && v.latitude && v.longitude) {
      mapRef.current.setView([v.latitude, v.longitude], 15);
    }
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`gps-page-container ${active ? 'active' : ''}`}>
      <header className="gps-header">
        <div className="header-left">
          <h1>Live GPS</h1>
          <div className="date-line">
            {today} <span className="live-dot"></span> live
          </div>
        </div>
        <div className="header-right">
          <div className="gps-search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t3)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input 
              type="text" 
              placeholder="Search fleet..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="notif-wrap">
            <div className="header-btn" title="Notifications" onClick={() => setNotifOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </div>
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-dropdown-header">
                  <span>Notifications</span>
                  {userKey && notifications.length > 0 && (
                    <button
                      className="notif-clear-btn"
                      onClick={async () => { try { await api.clearNotifications(userKey); setNotifications([]); } catch { /* noop */ } }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications yet</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.read ? 'read' : 'unread'} type-${n.type}`}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                      >
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">
                          {new Date(n.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="header-btn" onClick={refetch} title="Refresh GPS data">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
          </div>
          <div className="header-btn" onClick={() => setSettingsOpen(true)} title="GPS Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
          </div>
        </div>
      </header>

      <div className="map-container">
        <GPSMap 
          vehicles={filteredVehicles} 
          onVehicleSelect={handleVehicleSelect} 
          selectedVehicle={selectedVehicle}
          mapRef={mapRef}
        />

        {/* Fleet Status Panel */}
        <div className="fleet-status-panel fade-in">
          <div className="fleet-status-title">
            Fleet status
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {vehicles.length > 0 && (
                <button 
                  className="header-btn" 
                  onClick={handleSyncToFleet} 
                  disabled={syncingToFleet} 
                  title="Sync GPS vehicles to Fleet list"
                  style={{ width: 24, height: 24, borderRadius: 6, padding: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
          <div className="status-row" onClick={() => setFilter('working')}>
            <span className="status-dot working"></span>
            <span className="status-label">Working</span>
            <span className="status-count">{stats.working}/{stats.total}</span>
          </div>
          <div className="status-row" onClick={() => setFilter('idle')}>
            <span className="status-dot idle"></span>
            <span className="status-label">Idle at site</span>
            <span className="status-count">{stats.idle}/{stats.total}</span>
          </div>
          <div className="status-row" onClick={() => setFilter('alert')}>
            <span className="status-dot needs-attention"></span>
            <span className="status-label">Needs attention</span>
            <span className="status-count">{stats.alert}/{stats.total}</span>
          </div>
          <div className="status-row" onClick={() => setFilter('off')}>
            <span className="status-dot off"></span>
            <span className="status-label">Off / not started</span>
            <span className="status-count">{stats.off}/{stats.total}</span>
          </div>
          <div className="status-filters">
            <button className={`status-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`status-filter-btn ${filter === 'working' ? 'active' : ''}`} onClick={() => setFilter('working')}>Working</button>
            <button className={`status-filter-btn ${filter === 'idle' ? 'active' : ''}`} onClick={() => setFilter('idle')}>Idle</button>
            <button className={`status-filter-btn ${filter === 'alert' ? 'active' : ''}`} onClick={() => setFilter('alert')}>Alert</button>
            <button className={`status-filter-btn ${filter === 'off' ? 'active' : ''}`} onClick={() => setFilter('off')}>Off</button>
          </div>

          {/* GPS Provider Errors */}
          {(bbHealth?.last_error || tntHealth?.last_error || weHealth?.last_error) && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.3)', borderRadius: 4, fontSize: '12px', color: 'rgba(220, 53, 69, 1)' }}>
              {bbHealth?.last_error && <div>🔴 Blackbuck: {bbHealth.last_error}</div>}
              {tntHealth?.last_error && <div>🔴 Trak N Tell: {tntHealth.last_error}</div>}
              {weHealth?.last_error && <div>🔴 WheelsEye: {weHealth.last_error}</div>}
              <div style={{ marginTop: 6, fontSize: '11px', opacity: 0.8 }}>Re-authenticate in GPS Settings to resolve</div>
            </div>
          )}
        </div>

        {/* Map Controls */}
        <div className="map-controls">
          <div className="map-ctrl-btn" onClick={() => zoomMap(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div className="map-ctrl-btn" onClick={() => zoomMap(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div className="map-ctrl-btn" onClick={resetMap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
          </div>
        </div>

        {/* Vehicle Panel */}
        {selectedVehicle && (
          <div className="vehicle-panel fade-in">
            <div className="vehicle-panel-header">
              <div className="vehicle-status-toggle">
                <div className={`toggle-switch ${selectedVehicle.engine_on || selectedVehicle.ignition === 'on' ? 'on' : ''}`}></div>
                <span>{selectedVehicle.engine_on || selectedVehicle.ignition === 'on' ? 'On' : 'Off'}</span>
              </div>
              <button className="vehicle-close-btn" onClick={() => setSelectedVehicle(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="vehicle-id-section">
              <div className="vehicle-id-row">
                <div className="vehicle-flag"></div>
                <span className="vehicle-id">{selectedVehicle.registration_number}</span>
              </div>
              <div className="vehicle-name">
                {selectedVehicle.name || 'Unknown Truck'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
            </div>

            <div className="engine-lock">
              <div className="engine-lock-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className="engine-lock-text">
                <div className="engine-lock-label">Engine Lock</div>
                <div className="engine-lock-status">Ready to start</div>
              </div>
              <button className="lock-btn">LOCK</button>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Load on Hook</div>
                <div className="metric-value">{fmt(selectedVehicle.sli_load, ' T')}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Engine Hours</div>
                <div className="metric-value">{fmt(selectedVehicle.today_engine_hours, ' hrs')}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Boom Angle</div>
                <div className="metric-value">{fmt(selectedVehicle.sli_angle, '°')}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Diesel</div>
                <div className="metric-value">{fmt(selectedVehicle.j1939_fuel_level, '%')}</div>
              </div>
            </div>

            {showAllMetrics && <VehicleTelemetry vehicle={selectedVehicle} />}

            <button className="show-less-btn" onClick={() => setShowAllMetrics(!showAllMetrics)}>
              {showAllMetrics ? 'Show less' : 'Show all sensor data...'}
            </button>

            <div className="vehicle-actions">
              <button className="vehicle-action-btn" onClick={() => {
                if (selectedVehicle.provider === 'trakntell') setTntHistoryOpen(true);
                else if (selectedVehicle.provider === 'blackbuck') setBbHistoryOpen(true);
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                History
              </button>
              <button className="vehicle-action-btn" onClick={() => setEngineHistoryOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Engine Info
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Fleet strip */}
      <div className="bottom-section">
        <div className="bottom-section-inner">
          <div className="fleet-title-label">Your fleet</div>
          <div className="fleet-chips">
            {vehicles.map(v => {
              const cat = getVehicleCategory(v);
              const isActive = selectedVehicle?.registration_number === v.registration_number;
              return (
                <div 
                  key={v.registration_number} 
                  className={`fleet-chip ${isActive ? 'active' : ''}`}
                  onClick={() => handleVehicleSelect(v)}
                >
                  <div className={`chip-dot ${cat === 'alert' ? 'red' : cat === 'working' ? 'green' : cat === 'idle' ? 'orange' : 'gray'}`}></div>
                  <div className={`chip-icon ${isActive ? 'primary' : 'gray'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 19h18"/><path d="M7 11l2-4h6l2 4"/><path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>
                    </svg>
                  </div>
                  <div className="chip-info">
                    <div className="chip-name">{v.name || 'Unknown Truck'}</div>
                    <div className="chip-id">{v.registration_number}</div>
                    {cat === 'alert' && <div className="chip-alert-text">{statusLabel(v)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="fleet-chip-scroll-hint" style={{ color: 'var(--t3)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Modals */}
      {tntHistoryOpen && selectedVehicle && (
        <Modal open={tntHistoryOpen} onClose={() => setTntHistoryOpen(false)} title="History Panel">
          <TnTHistoryPanel 
            vehicleId={selectedVehicle.device_id || selectedVehicle.vehicle_id || selectedVehicle.registration_number}
            registrationNumber={selectedVehicle.registration_number}
            onClose={() => setTntHistoryOpen(false)} 
          />
        </Modal>
      )}
      {bbHistoryOpen && selectedVehicle && (
        <BlackbuckHistoryModal 
          vehicle={selectedVehicle} 
          onClose={() => setBbHistoryOpen(false)} 
        />
      )}
      {engineHistoryOpen && selectedVehicle && (
        <EngineHistoryModal
          open={engineHistoryOpen}
          onClose={() => setEngineHistoryOpen(false)}
          craneReg={selectedVehicle.registration_number}
        />
      )}

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // reset transient form + confirm state so the modal opens clean next time
          setBbConfirmDelete(false); setTntConfirmDelete(false); setWeConfirmDelete(false);
          setBbAutoPhone(''); setBbAutoOtp(''); setBbAutoPassword(''); setBbAutoSessionToken('');
          setBbOtpSent(false); setBbLoginMode('otp');
          setTntAutoUsername(''); setTntAutoPassword('');
          setWeAutoPhone(''); setWeAutoOtp(''); setWeAutoSessionToken(''); setWeOtpSent(false);
          setSettingsTab('blackbuck');
          bbFetchHealth(); tntFetchHealth(); weFetchHealth();
          refetch();
        }}
        title="GPS Settings"
        subtitle="Connect your GPS providers to sync vehicles to the live map"
      >
        <div className="gps-settings-tabs">
          <button className={`gps-settings-tab ${settingsTab === 'blackbuck' ? 'active' : ''}`} onClick={() => setSettingsTab('blackbuck')}>
            Blackbuck {bbConfigured && <span className="gps-settings-tab-dot configured" />}
          </button>
          <button className={`gps-settings-tab ${settingsTab === 'trakntell' ? 'active' : ''}`} onClick={() => setSettingsTab('trakntell')}>
            Trak N Tell {tntConfigured && <span className="gps-settings-tab-dot configured" />}
          </button>
          <button className={`gps-settings-tab ${settingsTab === 'wheelseye' ? 'active' : ''}`} onClick={() => setSettingsTab('wheelseye')}>
            WheelsEye {weConfigured && <span className="gps-settings-tab-dot configured" />}
          </button>
        </div>

        {settingsTab === 'blackbuck' && (
          <div className="gps-settings-panel">
            {bbCredentials?.configured && !bbConfirmDelete && (
              <div className="gps-settings-info-row">
                <div className="gps-settings-info-text">
                  <span className="gps-settings-connected-dot" />
                  <div>
                    <div>Connected{bbHealth?.token_preview ? ` · ${bbHealth.token_preview}` : ''}</div>
                    <div className="gps-settings-updated">{providerMeta(bbHealth, bbCredentials?.updated_at)}</div>
                  </div>
                </div>
                <button className="btn-sm outline danger" onClick={() => setBbConfirmDelete(true)}>Remove</button>
              </div>
            )}
            {bbHealth?.last_error && !bbConfirmDelete && (
              <div className="gps-settings-error">⚠ {bbHealth.last_error}</div>
            )}
            {bbConfirmDelete && (
              <div className="gps-settings-confirm-row">
                <span>Remove Blackbuck credentials?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm red" onClick={handleDeleteBlackbuck}>Remove</button>
                  <button className="btn-sm outline" onClick={() => setBbConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div className="gps-settings-segment">
              <button className={`btn-sm ${bbLoginMode === 'otp' ? 'accent' : 'outline'}`} onClick={() => setBbLoginMode('otp')}>OTP Login</button>
              <button className={`btn-sm ${bbLoginMode === 'password' ? 'accent' : 'outline'}`} onClick={() => setBbLoginMode('password')}>Password Login</button>
            </div>
            <label className="lbl">Phone Number</label>
            <input className="inp" type="tel" value={bbAutoPhone} onChange={e => setBbAutoPhone(e.target.value)} placeholder="9876543210" />
            {bbLoginMode === 'password' ? (
              <>
                <label className="lbl">Password</label>
                <input className="inp" type="password" value={bbAutoPassword} onChange={e => setBbAutoPassword(e.target.value)} placeholder="Your Blackbuck password" />
                <button className="btn-sm accent gps-settings-cta" onClick={handlePasswordLoginBlackbuck} disabled={bbAutoLogging}>{bbAutoLogging ? 'Logging in…' : 'Log In'}</button>
              </>
            ) : !bbOtpSent ? (
              <button className="btn-sm accent gps-settings-cta" onClick={handleRequestOtpBlackbuck} disabled={bbAutoLogging}>{bbAutoLogging ? 'Sending…' : 'Send OTP'}</button>
            ) : (
              <>
                <div className="gps-settings-otp-sent">OTP sent to {bbAutoPhone}</div>
                <label className="lbl">Enter OTP</label>
                <input className="inp center" type="tel" value={bbAutoOtp} onChange={e => setBbAutoOtp(e.target.value)} placeholder="6-digit OTP" />
                <button className="btn-sm accent gps-settings-cta" onClick={handleVerifyOtpBlackbuck} disabled={bbAutoLogging}>{bbAutoLogging ? 'Verifying…' : 'Verify & Connect'}</button>
              </>
            )}
            <div className="gps-settings-hint">Log in with your Blackbuck account to sync its vehicles onto the live map.</div>
          </div>
        )}

        {settingsTab === 'trakntell' && (
          <div className="gps-settings-panel">
            {tntCredentials?.configured && !tntConfirmDelete && (
              <div className="gps-settings-info-row">
                <div className="gps-settings-info-text">
                  <span className="gps-settings-connected-dot" />
                  <div>
                    <div>
                      Connected{tntHealth?.user_id_preview ? ` · ${tntHealth.user_id_preview}` : ''}
                      {tntCredentials.auto_refresh_enabled && <span className="gps-settings-session-badge" style={{ marginLeft: 6 }}>AUTO-REFRESH</span>}
                    </div>
                    <div className="gps-settings-updated">{providerMeta(tntHealth, tntCredentials?.updated_at)}</div>
                  </div>
                </div>
                <button className="btn-sm outline danger" onClick={() => setTntConfirmDelete(true)}>Remove</button>
              </div>
            )}
            {tntCredentials?.configured && !tntConfirmDelete && (
              tntCredentials.auto_refresh_enabled
                ? <div className="gps-settings-otp-sent">Auto-refresh enabled — the session renews automatically.</div>
                : <div className="gps-settings-hint">Session only — re-enter username &amp; password below to enable auto-refresh.</div>
            )}
            {tntHealth?.last_error && !tntConfirmDelete && (
              <div className="gps-settings-error">⚠ {tntHealth.last_error}</div>
            )}
            {tntConfirmDelete && (
              <div className="gps-settings-confirm-row">
                <span>Remove Trak N Tell credentials?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm red" onClick={handleDeleteTrakNTell}>Remove</button>
                  <button className="btn-sm outline" onClick={() => setTntConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
            <label className="lbl">Username</label>
            <input className="inp" type="text" value={tntAutoUsername} onChange={e => setTntAutoUsername(e.target.value)} placeholder="Username" />
            <label className="lbl">Password</label>
            <input className="inp" type="password" value={tntAutoPassword} onChange={e => setTntAutoPassword(e.target.value)} placeholder="Password" />
            <button className="btn-sm accent gps-settings-cta" onClick={handleAutoLoginTrakNTell} disabled={tntAutoLogging}>{tntAutoLogging ? 'Connecting…' : tntCredentials?.configured ? 'Re-connect & Enable Auto-refresh' : 'Connect'}</button>
            <div className="gps-settings-hint">Enter your Trak N Tell username &amp; password to connect and keep the session alive.</div>
          </div>
        )}

        {settingsTab === 'wheelseye' && (
          <div className="gps-settings-panel">
            {weCredentials?.configured && !weConfirmDelete && (
              <div className="gps-settings-info-row">
                <div className="gps-settings-info-text">
                  <span className="gps-settings-connected-dot" />
                  <div>
                    <div>Connected{weHealth?.phone_preview ? ` · ${weHealth.phone_preview}` : ''}</div>
                    <div className="gps-settings-updated">{providerMeta(weHealth, weCredentials?.updated_at)}</div>
                  </div>
                </div>
                <button className="btn-sm outline danger" onClick={() => setWeConfirmDelete(true)}>Remove</button>
              </div>
            )}
            {weHealth?.last_error && !weConfirmDelete && (
              <div className="gps-settings-error">⚠ {weHealth.last_error}</div>
            )}
            {weConfirmDelete && (
              <div className="gps-settings-confirm-row">
                <span>Remove WheelsEye credentials?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm red" onClick={handleDeleteWheelsEye}>Remove</button>
                  <button className="btn-sm outline" onClick={() => setWeConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
            <label className="lbl">Phone Number</label>
            <input className="inp" type="tel" value={weAutoPhone} onChange={e => setWeAutoPhone(e.target.value)} placeholder="9876543210" />
            {!weOtpSent ? (
              <button className="btn-sm accent gps-settings-cta" onClick={handleRequestOtpWheelsEye} disabled={weAutoLogging}>{weAutoLogging ? 'Sending…' : 'Send OTP'}</button>
            ) : (
              <>
                <div className="gps-settings-otp-sent">OTP sent to {weAutoPhone}</div>
                <label className="lbl">Enter OTP</label>
                <input className="inp center" type="tel" value={weAutoOtp} onChange={e => setWeAutoOtp(e.target.value.slice(0, 4))} placeholder="4-digit OTP" maxLength={4} />
                <button className="btn-sm accent gps-settings-cta" onClick={handleVerifyOtpWheelsEye} disabled={weAutoLogging}>{weAutoLogging ? 'Verifying…' : 'Verify & Connect'}</button>
              </>
            )}
            <div className="gps-settings-hint">Enter your registered WheelsEye phone number to receive an OTP.</div>
          </div>
        )}
      </Modal>

      {loading && !initialLoading && (
        <div className="gps-loading" title="Updating GPS..." style={{ position: 'absolute', bottom: 116, right: 24, zIndex: 120, width: 32, height: 32, background: 'var(--gps-panel-bg)', border: '1px solid var(--gps-panel-border)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '50%', boxShadow: 'var(--gps-panel-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 16, height: 16, border: '2px solid var(--gps-panel-border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
