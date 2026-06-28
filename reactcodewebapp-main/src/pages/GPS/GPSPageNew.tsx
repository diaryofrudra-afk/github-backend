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
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { api } from '../../services/api';
import L from 'leaflet';
import './GPSPageNew.css';

type StatusFilter = 'all' | 'on' | 'off';

function statusLabel(v: UnifiedVehicle): string {
  return getVehicleCategory(v) === 'on' ? 'Engine On' : 'Engine Off';
}

function fmt(n: number | undefined | null, unit = ''): string {
  if (n == null) return '—';
  return `${n}${unit}`;
}

// Minutes since the engine last turned off, parsed from `ignition_off_since`
// duration strings like "4h 5m" / "2d 3h" / "45m" / "30s" (Trak N Tell).
// A smaller value means the engine shut off more recently, i.e. was on most
// recently. Missing/unparseable values sort last (+Infinity).
function offDurationMinutes(v: UnifiedVehicle): number {
  const s = v.ignition_off_since;
  if (!s) return Infinity;
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+)\s*([dhms])/gi)) {
    matched = true;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    total += unit === 'd' ? n * 1440
           : unit === 'h' ? n * 60
           : unit === 'm' ? n
           : n / 60; // seconds
  }
  return matched ? total : Infinity;
}

// Short "last seen" timestamp, e.g. "24 Jun, 03:42 PM". Returns "—" when absent.
function fmtLastSeen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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

function getVehicleDisplayName(v: UnifiedVehicle | null | undefined, cranes: any[]): string {
  if (!v) return 'Unknown Truck';
  const regNormalized = (v.registration_number || '').replace(/\s+/g, '').toUpperCase();
  const crane = (cranes || []).find(c => (c.reg || '').replace(/\s+/g, '').toUpperCase() === regNormalized);
  if (crane) {
    const make = crane.make || '';
    const model = crane.model || '';
    if (make || model) {
      return `${make} ${model}`.trim();
    }
  }
  return v.name || 'Unknown Truck';
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────

export function GPSPageNew({ active }: { active: boolean }) {
  const { state, setState, showToast } = useApp();
  const { vehicles, initialLoading, refetch, loading } = useUnifiedGPS();
  
  const { credentials: bbCredentials, health: bbHealth, fetchCredentials: bbFetchCredentials, fetchHealth: bbFetchHealth, deleteCredentials: bbDeleteCredentials } = useBlackbuckSettings();
  const { credentials: tntCredentials, health: tntHealth, fetchCredentials: tntFetchCredentials, fetchHealth: tntFetchHealth, deleteCredentials: tntDeleteCredentials } = useTrakNTellSettings();
  const { credentials: weCredentials, health: weHealth, fetchCredentials: weFetchCredentials, fetchHealth: weFetchHealth, deleteCredentials: weDeleteCredentials } = useWheelsEyeSettings();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetSheetOpen, setFleetSheetOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<UnifiedVehicle | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fleetScrollRef = useRef<HTMLDivElement | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');

  // Reset name input value on selected vehicle or cranes list changes
  useEffect(() => {
    setIsEditingName(false);
    if (selectedVehicle) {
      setEditNameVal(getVehicleDisplayName(selectedVehicle, state.cranes));
    }
  }, [selectedVehicle, state.cranes]);

  const handleRenameVehicle = async (newName: string) => {
    if (!selectedVehicle || !newName.trim()) return;
    
    const regNormalized = selectedVehicle.registration_number.replace(/\s+/g, '').toUpperCase();
    let matchingCrane = state.cranes.find(c => 
      (c.reg || '').replace(/\s+/g, '').toUpperCase() === regNormalized
    );
    
    try {
      if (!matchingCrane) {
        showToast("Registering vehicle to fleet database...", "info");
        await api.syncGPSToFleet();
        const updatedCranes = await api.getCranes();
        setState(prev => ({ ...prev, cranes: updatedCranes }));
        matchingCrane = updatedCranes.find(c => 
          (c.reg || '').replace(/\s+/g, '').toUpperCase() === regNormalized
        );
      }
      
      if (!matchingCrane) {
        showToast("Could not find or register this vehicle in the fleet database", "error");
        return;
      }
      
      const parts = newName.trim().split(/\s+/);
      const make = parts[0] || '';
      const model = parts.slice(1).join(' ') || '';
      
      showToast("Updating vehicle name...", "info");
      await api.updateCrane(matchingCrane.id, { make, model });
      
      const updatedCranes = await api.getCranes();
      setState(prev => ({ ...prev, cranes: updatedCranes }));
      showToast("Vehicle renamed successfully!", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to rename vehicle", "error");
    }
  };

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
  const [refreshing, setRefreshing] = useState(false);
  const [addingToFleet, setAddingToFleet] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);

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

  // Single manual control: refresh the live GPS data AND sync those vehicles into the
  // Fleet (cranes) list. The refresh icon spins + turns accent while this runs.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetch();
      if (vehicles.length > 0) {
        const d = await api.syncGPSToFleet();
        const updatedCranes = await api.getCranes();
        setState(prev => ({ ...prev, cranes: updatedCranes }));
        if (d.added > 0 || d.updated > 0) {
          showToast(`${d.added} vehicles added${d.updated > 0 ? `, ${d.updated} updated` : ''}`, 'success');
        }
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setRefreshing(false); }
  };

  // Explicit "Add to Fleet" action: pushes all live GPS vehicles into the Fleet
  // (cranes) list via the existing /sync-to-fleet endpoint. Unlike the refresh
  // side-effect, this always reports what it did so the user knows it ran.
  const handleAddToFleet = async () => {
    if (addingToFleet) return;
    if (vehicles.length === 0) { showToast('No live GPS vehicles to add', 'info'); return; }
    setAddingToFleet(true);
    try {
      const d = await api.syncGPSToFleet();
      const updatedCranes = await api.getCranes();
      setState(prev => ({ ...prev, cranes: updatedCranes }));
      if (d.added > 0 || d.updated > 0) {
        showToast(`${d.added} added to fleet${d.updated > 0 ? `, ${d.updated} updated` : ''}`, 'success');
      } else {
        showToast('Fleet already up to date', 'info');
      }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setAddingToFleet(false); }
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
    const on  = vehicles.filter(v => getVehicleCategory(v) === 'on').length;
    const off = vehicles.filter(v => getVehicleCategory(v) === 'off').length;
    return { on, off, total: vehicles.length };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (filter !== 'all') {
      list = list.filter(v => getVehicleCategory(v) === filter);
    }
    return list;
  }, [vehicles, filter]);

  // "Your fleet" strip order: engine-on vehicles first, then engine-off
  // vehicles ordered by how recently their engine was last on (shortest
  // off-duration first). Sort a copy so the memoized array isn't mutated.
  const sortedFleet = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      const ga = getVehicleCategory(a) === 'on' ? 0 : 1;
      const gb = getVehicleCategory(b) === 'on' ? 0 : 1;
      if (ga !== gb) return ga - gb;
      if (ga === 1) return offDurationMinutes(a) - offDurationMinutes(b);
      return 0; // engine-on group: stable
    });
  }, [filteredVehicles]);

  // Fleet list filtered by the mobile search box (matches name or registration).
  const searchedFleet = useMemo(() => {
    const q = fleetSearch.trim().toLowerCase();
    if (!q) return sortedFleet;
    return sortedFleet.filter(v =>
      getVehicleDisplayName(v, state.cranes).toLowerCase().includes(q) ||
      (v.registration_number || '').toLowerCase().includes(q)
    );
  }, [sortedFleet, fleetSearch, state.cranes]);

  // Translate a vertical mouse-wheel delta into horizontal scroll so the fleet
  // strip is scrollable with a plain mouse, not just a trackpad/shift-wheel.
  const handleFleetWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = fleetScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  // Chevron button: step right; cycle back to start when already at the end.
  const handleFleetScrollButton = () => {
    const el = fleetScrollRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + 250, behavior: 'smooth' });
  };

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
    setFleetSheetOpen(false); // collapse the mobile fleet panel after picking
    if (mapRef.current && v.latitude && v.longitude) {
      mapRef.current.setView([v.latitude, v.longitude], 15);
    }
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`gps-page-container ${active ? 'active' : ''}`}>
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Fleet status <span className="live-dot"></span>
              </div>
              <div className="date-line" style={{ marginTop: 2, fontSize: 11 }}>{today}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div className="header-btn" onClick={() => setSettingsOpen(true)} title="GPS Settings" style={{ width: 24, height: 24, borderRadius: 6, padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                </svg>
              </div>
              <div
                className="header-btn"
                onClick={handleAddToFleet}
                title="Add all live GPS vehicles to the Fleet"
                style={{ width: 24, height: 24, borderRadius: 6, padding: 0, opacity: addingToFleet ? 0.5 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 19h13"/><path d="M7 11l2-4h6l2 4"/><path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><circle cx="7" cy="17" r="1"/><circle cx="14" cy="17" r="1"/><line x1="19" y1="14" x2="19" y2="20"/><line x1="16" y1="17" x2="22" y2="17"/>
                </svg>
              </div>
              <div className="notif-wrap">
                <div 
                  className={`header-btn ${notifOpen ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`} 
                  title="Notifications" 
                  onClick={() => setNotifOpen(o => !o)} 
                  style={{ width: 24, height: 24, borderRadius: 6, padding: 0 }}
                >
                  <svg className="notif-bell-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge-pulse">
                      <span className="badge-ping"></span>
                      <span className="badge-dot"></span>
                    </span>
                  )}
                </div>
                
                {notifOpen && (
                  <NotificationsPanel
                    variant="dropdown"
                    notifications={notifications}
                    onClose={() => setNotifOpen(false)}
                    onMarkRead={handleMarkRead}
                    onClearAll={userKey ? async () => {
                      try { await api.clearNotifications(userKey); setNotifications([]); } catch { /* noop */ }
                    } : undefined}
                  />
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
          <div className="status-summary">
            <button
              type="button"
              className={`status-chip ${filter === 'on' ? 'active' : ''}`}
              onClick={() => setFilter(filter === 'on' ? 'all' : 'on')}
            >
              <span className="status-dot on"></span>
              <span className="status-chip-count">{stats.on}</span> On
            </button>
            <button
              type="button"
              className={`status-chip ${filter === 'off' ? 'active' : ''}`}
              onClick={() => setFilter(filter === 'off' ? 'all' : 'off')}
            >
              <span className="status-dot off"></span>
              <span className="status-chip-count">{stats.off}</span> Off
            </button>
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
          <div className={`map-ctrl-btn${refreshing ? ' syncing' : ''}`} onClick={handleRefresh} title="Refresh GPS data & sync to Fleet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
          </div>
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
              <div className="vehicle-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isEditingName ? (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsEditingName(false);
                      if (selectedVehicle && editNameVal.trim()) {
                        await handleRenameVehicle(editNameVal);
                      }
                    }}
                    style={{ display: 'flex', width: '100%', gap: 6 }}
                  >
                    <input
                      type="text"
                      className="vehicle-name-input"
                      value={editNameVal}
                      onChange={(e) => setEditNameVal(e.target.value)}
                      autoFocus
                      onBlur={async () => {
                        setIsEditingName(false);
                        if (selectedVehicle && editNameVal.trim() && editNameVal !== getVehicleDisplayName(selectedVehicle, state.cranes)) {
                          await handleRenameVehicle(editNameVal);
                        }
                      }}
                      style={{
                        background: 'var(--bg4)',
                        border: '1px solid var(--gps-panel-border)',
                        borderRadius: 6,
                        color: 'var(--t1)',
                        padding: '4px 8px',
                        fontSize: 13,
                        fontFamily: 'var(--fb)',
                        flex: 1,
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="submit" 
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <span 
                      onClick={() => {
                        setEditNameVal(getVehicleDisplayName(selectedVehicle, state.cranes));
                        setIsEditingName(true);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {getVehicleDisplayName(selectedVehicle, state.cranes)}
                    </span>
                    <svg 
                      onClick={() => {
                        setEditNameVal(getVehicleDisplayName(selectedVehicle, state.cranes));
                        setIsEditingName(true);
                      }}
                      style={{ width: 14, height: 14, cursor: 'pointer', color: 'var(--t3)' }}
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </>
                )}
              </div>
            </div>

            {selectedVehicle.provider === 'trakntell' ? (
              <>
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
              </>
            ) : (
              <>
                {/* Blackbuck / WheelsEye only report location + engine status,
                    so the panel shows just movement basics — no crane sensors. */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Status</div>
                    <div className="metric-value">{statusLabel(selectedVehicle)}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Speed</div>
                    <div className="metric-value">{fmt(selectedVehicle.speed, ' km/h')}</div>
                  </div>
                </div>

                <div className="telemetry-address">
                  {selectedVehicle.address
                    || (selectedVehicle.latitude != null && selectedVehicle.longitude != null
                      ? `${selectedVehicle.latitude.toFixed(5)}, ${selectedVehicle.longitude.toFixed(5)}`
                      : 'Location unavailable')}
                  {selectedVehicle.last_updated && (
                    <span style={{ color: 'var(--t3)', fontSize: 11, marginLeft: 6, whiteSpace: 'nowrap' }}>
                      · {fmtLastSeen(selectedVehicle.last_updated)}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="vehicle-actions">
              <button className="vehicle-action-btn" onClick={() => setEngineHistoryOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><polyline points="12 7 12 12 15 14"/>
                </svg>
                Status History
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Fleet strip */}
      <div className={`bottom-section${fleetSheetOpen ? ' open' : ''}`}>
        {/* Mobile-only search row (CSS-hidden on desktop) */}
        <div className="fleet-search-row">
          <div className="fleet-search-input-wrap">
            <svg className="fleet-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              className="fleet-search-input"
              type="text"
              value={fleetSearch}
              onChange={e => setFleetSearch(e.target.value)}
              placeholder="Search fleet…"
              aria-label="Search fleet"
            />
          </div>
          <button
            type="button"
            className={`fleet-sheet-toggle${fleetSheetOpen ? ' open' : ''}`}
            onClick={() => setFleetSheetOpen(o => !o)}
            aria-expanded={fleetSheetOpen}
            aria-label="Toggle fleet list"
          >
            <span>Fleet · {searchedFleet.length}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
        </div>
        <div className="bottom-section-inner">
          <div className="fleet-title-label">Your fleet</div>
          <div className="fleet-chips" ref={fleetScrollRef} onWheel={handleFleetWheel}>
            {searchedFleet.map(v => {
              const cat = getVehicleCategory(v);
              const isActive = selectedVehicle?.registration_number === v.registration_number;
              return (
                <div 
                  key={v.registration_number} 
                  className={`fleet-chip ${isActive ? 'active' : ''}`}
                  onClick={() => handleVehicleSelect(v)}
                >
                  <div className={`chip-dot ${cat === 'on' ? 'green' : 'gray'}`}></div>
                  <div className={`chip-icon ${isActive ? 'primary' : 'gray'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 19h18"/><path d="M7 11l2-4h6l2 4"/><path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>
                    </svg>
                  </div>
                  <div className="chip-info">
                    <div className="chip-name">{getVehicleDisplayName(v, state.cranes)}</div>
                    <div className="chip-id">{v.registration_number}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="fleet-chip-scroll-hint"
            style={{ color: 'var(--t3)', flexShrink: 0 }}
            onClick={handleFleetScrollButton}
            aria-label="Scroll fleet"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
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
