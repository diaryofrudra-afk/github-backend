import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useData } from '../../context/DataContext';
import { api } from '../../services/api';
import type { TripPoint } from '../../services/api';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import { useUnifiedGPS } from '../../hooks/useUnifiedGPS';
import { useBlackbuckSettings } from '../../hooks/useBlackbuckSettings';
import { useTrakNTellSettings } from '../../hooks/useTrakNTellSettings';
import { Modal } from '../../components/ui/Modal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import technologyIcon from '../../assets/technology.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function GPSPage({ active }: { active: boolean }) {
  const { showToast } = useApp();
  const { setGpsActive } = useData();
  const {
    vehicles,
    loading,
    error,
    refetch,
    blackbuckCount,
    trakntellCount,
  } = useUnifiedGPS();

  const {
    credentials: bbCredentials,
    health: bbHealth,
    saving: bbSaving,
    fetchCredentials: bbFetchCredentials,
    fetchHealth: bbFetchHealth,
    saveCredentials: bbSaveCredentials,
    deleteCredentials: bbDeleteCredentials,
  } = useBlackbuckSettings();

  const {
    credentials: tntCredentials,
    health: tntHealth,
    saving: tntSaving,
    fetchCredentials: tntFetchCredentials,
    fetchHealth: tntFetchHealth,
    saveCredentials: tntSaveCredentials,
    deleteCredentials: tntDeleteCredentials,
  } = useTrakNTellSettings();

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'blackbuck' | 'trakntell'>('blackbuck');
  const [bbAuthToken, setBbAuthToken] = useState('');
  const [bbFleetOwnerId, setBbFleetOwnerId] = useState('');
  const [bbConfirmDelete, setBbConfirmDelete] = useState(false);
  const [tntUserId, setTntUserId] = useState('');
  const [tntUserIdEncrypt, setTntUserIdEncrypt] = useState('');
  const [tntOrgid, setTntOrgid] = useState('');
  const [tntSessionid, setTntSessionid] = useState('');
  const [tntTnt_s, setTntTnt_s] = useState('');
  const [tntConfirmDelete, setTntConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissedIssues, setDismissedIssues] = useState<Set<string>>(new Set());

  // Map state
  const [showMap, setShowMap] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Trip History state
  const [tripHistoryVehicle, setTripHistoryVehicle] = useState<UnifiedVehicle | null>(null);
  const [tripHistoryDate, setTripHistoryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tripHistoryFrom, setTripHistoryFrom] = useState<string>('00:00');
  const [tripHistoryTo, setTripHistoryTo] = useState<string>('23:59');
  const [tripHistoryLoading, setTripHistoryLoading] = useState(false);
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [tripError, setTripError] = useState<string | null>(null);
  
  const tripMapRef = useRef<L.Map | null>(null);
  const tripMapContainerRef = useRef<HTMLDivElement | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripRouteLayerRef = useRef<L.LayerGroup | null>(null);
  const tripMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    setGpsActive(active);
    if (active) {
      bbFetchCredentials();
      bbFetchHealth();
      tntFetchCredentials();
      tntFetchHealth();
      refetch();
    }
  }, [active, setGpsActive, bbFetchCredentials, bbFetchHealth, tntFetchCredentials, tntFetchHealth, refetch]);

  // Map init/update
  useEffect(() => {
    if (!showMap || vehicles.length === 0) return;
    const withCoords = vehicles.filter(v =>
      v.latitude != null && v.longitude != null && (v.latitude !== 0 || v.longitude !== 0)
    );
    if (withCoords.length === 0) return;

    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true })
        .setView([withCoords[0].latitude!, withCoords[0].longitude!], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19, subdomains: 'abcd',
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    if (markersRef.current && mapRef.current) {
      markersRef.current.clearLayers();
      const bounds: [number, number][] = [];

      withCoords.forEach((v) => {
        const lat = v.latitude!, lng = v.longitude!;
        const sc = v.status === 'moving' ? '#10b981' : v.status === 'stopped' ? '#ef4444' : '#f59e0b';
        const gpsOk = v.is_gps_working !== false;
        const netOk = v.network_status !== 'weak' && (v.gsm_signal == null || v.gsm_signal >= 10);
        const wireOk = v.status !== 'wire_disconnected' && v.status !== 'signal_lost';
        const hasIssue = !gpsOk || !netOk || !wireOk;
        const issueBadge = hasIssue
          ? `<div style="position:absolute;top:-4px;left:-4px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid #1a1a2e;" title="Connectivity issue"></div>`
          : '';

        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
            <div style="position:relative;">
              <svg width="28" height="40" viewBox="0 0 28 40" fill="none">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${sc}"/>
                <circle cx="14" cy="14" r="6" fill="white"/>
              </svg>
              ${issueBadge}
            </div>
            <div style="margin-top:-2px;padding:1px 6px;background:rgba(0,0,0,0.75);border-radius:4px;font-size:9px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:0.3px;border:1px solid rgba(255,255,255,0.1);">${v.registration_number}</div>
          </div>`,
          iconSize: [70, 50], iconAnchor: [14, 48], popupAnchor: [0, -48],
        });

        const engOn = v.ignition === 'on' || v.engine_on === true;
        const engOff = v.ignition === 'off' || v.engine_on === false;

        L.marker([lat, lng], { icon }).bindPopup(`
          <div style="font-family:-apple-system,sans-serif;padding:8px;min-width:220px;background:#1a1a2e;color:#e0e0e0;border-radius:6px;">
            <h3 style="margin:0 0 6px;font-size:13px;font-weight:700;color:#fff;">${v.registration_number}</h3>
            <div style="font-size:11px;line-height:1.6;">
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Engine</span><span style="color:${sc};font-weight:600;">${engOn ? 'ON' : engOff ? 'OFF' : 'Unknown'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Status</span><span style="color:${sc};font-weight:500;text-transform:capitalize;">${v.status}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Speed</span><span>${v.speed || 0} km/h</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Power</span><span>${v.main_voltage?.toFixed(2) || '--'}V</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">GPS</span><span style="color:${gpsOk ? '#10b981' : '#ef4444'};">${gpsOk ? 'OK' : 'Lost'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Network</span><span style="color:${netOk ? '#10b981' : '#ef4444'};">${v.gsm_signal || 0} — ${(v.network_status || 'unknown').toUpperCase()}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Address</span><span style="text-align:right;max-width:140px;">${v.address || 'N/A'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#888;">Coords</span><span style="font-family:monospace;font-size:10px;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></div>
            </div>
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
              <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:#3b82f6;text-decoration:none;font-size:11px;font-weight:500;">Open in Google Maps</a>
            </div>
          </div>
        `).addTo(markersRef.current!);
        bounds.push([lat, lng]);
      });

      if (bounds.length > 0) {
        mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [showMap, vehicles]);

  useEffect(() => {
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Actions
  function handleSync() { refetch(); showToast('Syncing telemetry…', 'info'); }

  async function handleSaveBlackbuck() {
    if (!bbAuthToken.trim() || !bbFleetOwnerId.trim()) { showToast('Enter both token and fleet owner ID', 'error'); return; }
    const ok = await bbSaveCredentials(bbAuthToken.trim(), bbFleetOwnerId.trim());
    if (ok) { showToast('Blackbuck credentials saved!', 'success'); setBbAuthToken(''); setBbFleetOwnerId(''); refetch(); }
  }

  async function handleDeleteBlackbuck() {
    const ok = await bbDeleteCredentials();
    if (ok) { showToast('Blackbuck credentials removed', 'info'); setBbConfirmDelete(false); refetch(); }
  }

  async function handleSaveTrakNTell() {
    if (!tntUserId.trim() || !tntUserIdEncrypt.trim() || !tntOrgid.trim()) { showToast('User ID, User ID Encrypt, and Org ID required', 'error'); return; }
    const ok = await tntSaveCredentials(tntUserId.trim(), tntUserIdEncrypt.trim(), tntOrgid.trim(), tntSessionid.trim(), tntTnt_s.trim());
    if (ok) { showToast('Trak N Tell credentials saved!', 'success'); setTntUserId(''); setTntUserIdEncrypt(''); setTntOrgid(''); setTntSessionid(''); setTntTnt_s(''); refetch(); }
  }

  async function handleDeleteTrakNTell() {
    const ok = await tntDeleteCredentials();
    if (ok) { showToast('Trak N Tell credentials removed', 'info'); setTntConfirmDelete(false); refetch(); }
  }

  async function handleSyncToFleet() {
    const token = localStorage.getItem('suprwise_token');
    if (!token) { showToast('Not authenticated', 'error'); return; }
    setSyncing(true);
    try {
      const r = await fetch('/api/gps/sync-to-fleet', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); let msg = `${d.added} vehicles added to fleet`; if (d.updated > 0) msg += `, ${d.updated} updated`; showToast(msg, 'success'); }
      else { const err = await r.json(); showToast(err.detail || 'Failed to sync', 'error'); }
    } catch (e: any) { showToast(e.message || 'Network error', 'error'); }
    finally { setSyncing(false); refetch(); }
  }

  function openTripHistory(v: UnifiedVehicle) {
    setTripHistoryVehicle(v);
    setTripPoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
    setTripError(null);
  }

  async function fetchTripHistory() {
    if (!tripHistoryVehicle) return;
    setTripHistoryLoading(true);
    setTripError(null);
    setTripPoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);

    try {
      let resp;
      if (tripHistoryVehicle.provider === 'blackbuck') {
        const fromDateObj = new Date(`${tripHistoryDate}T${tripHistoryFrom}:00`);
        const toDateObj = new Date(`${tripHistoryDate}T${tripHistoryTo}:59`);
        resp = await api.getBlackbuckTripHistory(
          tripHistoryVehicle.registration_number,
          fromDateObj.getTime(),
          toDateObj.getTime()
        );
      } else {
        if (!tripHistoryVehicle.vehicle_id) {
          throw new Error("Trak N Tell vehicle ID missing. Wait for data to sync.");
        }
        // Trak N Tell expects dd/MM/yyyy HH:mm
        const ymd = tripHistoryDate.split('-');
        const tntDate = `${ymd[2]}/${ymd[1]}/${ymd[0]}`;
        resp = await api.getTrakNTellTripHistory(
          tripHistoryVehicle.vehicle_id,
          `${tntDate} ${tripHistoryFrom}`,
          `${tntDate} ${tripHistoryTo}`
        );
      }

      if (resp.error) {
        setTripError(resp.error);
      } else if (resp.points.length === 0) {
        setTripError("No tracking data available for the selected time range.");
      } else {
        setTripPoints(resp.points);
      }
    } catch (e: any) {
      setTripError(e.message || "Failed to fetch trip history");
    } finally {
      setTripHistoryLoading(false);
    }
  }

  // Trip Map Init
  useEffect(() => {
    if (tripHistoryVehicle && tripMapContainerRef.current && !tripMapRef.current) {
      tripMapRef.current = L.map(tripMapContainerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([0, 0], 2);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19, subdomains: 'abcd',
      }).addTo(tripMapRef.current);
      tripRouteLayerRef.current = L.layerGroup().addTo(tripMapRef.current);
    }
  }, [tripHistoryVehicle]);

  // Trip Map Cleanup
  useEffect(() => {
    if (!tripHistoryVehicle && tripMapRef.current) {
      tripMapRef.current.remove();
      tripMapRef.current = null;
      tripRouteLayerRef.current = null;
      tripMarkerRef.current = null;
    }
  }, [tripHistoryVehicle]);

  // Draw Route
  useEffect(() => {
    if (!tripMapRef.current || !tripRouteLayerRef.current) return;
    tripRouteLayerRef.current.clearLayers();
    tripMarkerRef.current = null;

    if (tripPoints.length === 0) return;

    const bounds: [number, number][] = [];
    
    // Draw polyline with color based on speed
    for (let i = 0; i < tripPoints.length - 1; i++) {
      const p1 = tripPoints[i];
      const p2 = tripPoints[i+1];
      const speed = p1.speed;
      let color = '#10b981'; // Green (slow/moderate)
      if (speed === 0) color = '#9ca3af'; // Gray (stopped)
      else if (speed > 40) color = '#ef4444'; // Red (fast)
      else if (speed > 20) color = '#f59e0b'; // Orange (medium)
      
      L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
        color, weight: 4, opacity: 0.8
      }).addTo(tripRouteLayerRef.current);
      bounds.push([p1.lat, p1.lng]);
    }
    bounds.push([tripPoints[tripPoints.length-1].lat, tripPoints[tripPoints.length-1].lng]);

    // Add start marker
    const startP = tripPoints[0];
    L.marker([startP.lat, startP.lng], {
      icon: L.divIcon({
        className: '', html: '<div style="font-size: 20px;">🏁</div>', iconSize: [20, 20], iconAnchor: [10, 10]
      })
    }).addTo(tripRouteLayerRef.current);

    tripMapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });

    // Initial marker pos
    const curr = tripPoints[playbackIndex];
    if (curr) {
      tripMarkerRef.current = L.marker([curr.lat, curr.lng], {
        icon: L.divIcon({
          className: '', html: '<div style="font-size: 24px;">🚛</div>', iconSize: [24, 24], iconAnchor: [12, 12]
        })
      }).addTo(tripRouteLayerRef.current);
    }
  }, [tripPoints]); // Notice playbackIndex is NOT here, we update marker separately

  // Update Live Marker
  useEffect(() => {
    if (tripMarkerRef.current && tripPoints.length > 0) {
      const curr = tripPoints[playbackIndex];
      if (curr) {
        tripMarkerRef.current.setLatLng([curr.lat, curr.lng]);
        if (tripMapRef.current && isPlaying) {
          tripMapRef.current.panTo([curr.lat, curr.lng], { animate: true, duration: 0.5 });
        }
      }
    }
  }, [playbackIndex, tripPoints, isPlaying]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      if (playbackIndex >= tripPoints.length - 1) {
        setIsPlaying(false);
        return;
      }
      playbackTimerRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= tripPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500 / playbackSpeed);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => { if (playbackTimerRef.current) clearInterval(playbackTimerRef.current); };
  }, [isPlaying, playbackSpeed, tripPoints.length]);

  const bbConfigured = bbHealth?.configured || bbCredentials?.configured;
  const tntConfigured = tntHealth?.configured || tntCredentials?.configured;
  const isAnyConfigured = bbConfigured || tntConfigured;
  const engineOnCount = vehicles.filter(v => v.engine_on === true || v.ignition === 'on').length;
  const currPoint = tripPoints[playbackIndex];

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-gps">
      {/* Status Bar — clean, 3 icons only */}
      <div className="gps-sync-bar">
        <div>
          <div style={{ fontFamily: 'var(--fh)', fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
            Live GPS Tracking
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading ? (
              <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} /><span style={{ color: 'var(--yellow)' }}>Loading…</span></>
            ) : isAnyConfigured ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ color: 'var(--green)' }}>Connected</span>
                {vehicles.length > 0 && <span>• {engineOnCount}/{vehicles.length} engine on</span>}
                {blackbuckCount > 0 && <span style={{ color: 'var(--t3)' }}>({blackbuckCount} Blackbuck, {trakntellCount} Trak N Tell)</span>}
              </>
            ) : (
              <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} /><span style={{ color: 'var(--red)' }}>No Credentials</span></>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-sm accent" onClick={handleSync} disabled={loading} title="Sync GPS data">
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {loading ? 'Syncing…' : 'Sync'}
          </button>
          {vehicles.length > 0 && (
            <button className="btn-sm outline" onClick={handleSyncToFleet} disabled={syncing} title="Add GPS vehicles to Fleet">
              <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              {syncing ? 'Adding…' : 'Add to Fleet'}
            </button>
          )}
          <button className="btn-sm outline" onClick={() => { setSettingsOpen(true); bbFetchCredentials(); tntFetchCredentials(); }} title="GPS Settings">
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Settings
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {!isAnyConfigured && error && vehicles.length === 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: 'var(--red)' }}>
          ⚠️ {error}
          <button className="btn-sm outline" style={{ marginLeft: '12px', fontSize: '11px' }} onClick={() => setSettingsOpen(true)}>Configure</button>
        </div>
      )}

      {/* Vehicle Table */}
      {vehicles.length > 0 && (
        <div style={{ borderRadius: 'var(--rlg)', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg2)', marginBottom: '12px' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Status</th>
                <th>Engine / Ignition</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, idx) => {
                const isEngineOn = vehicle.ignition === 'on' || vehicle.engine_on === true;
                const isEngineOff = vehicle.ignition === 'off' || vehicle.engine_on === false;
                const speed = vehicle.speed || 0;

                // ── Detect hardware root cause ──
                const isGpsLost = vehicle.is_gps_working === false;
                const isGsmWeak = vehicle.network_status === 'weak' || (vehicle.gsm_signal != null && vehicle.gsm_signal > 0 && vehicle.gsm_signal < 10);
                const isGsmLost = vehicle.network_status === 'lost' || vehicle.gsm_signal === 0;
                const isMainPowerLow = vehicle.is_main_power_low === true;
                const isWireDisconnected = vehicle.status === 'wire_disconnected';
                const isSignalLost = vehicle.status === 'signal_lost';
                const hasNoData = vehicle.last_updated === '' || vehicle.last_updated === '--';

                // Compute display status with hardware diagnostics
                let displayStatus: string;
                let statusColor: string;
                let dotColor: string;

                if (isWireDisconnected) {
                  displayStatus = 'Wire disconnected';
                  statusColor = '#ef4444';
                  dotColor = '#ef4444';
                } else if (isSignalLost || isGsmLost) {
                  displayStatus = `Signal lost · GSM ${vehicle.gsm_signal || 0}`;
                  statusColor = '#ef4444';
                  dotColor = '#ef4444';
                } else if (isGpsLost) {
                  displayStatus = 'GPS module lost';
                  statusColor = '#ef4444';
                  dotColor = '#ef4444';
                } else if (isMainPowerLow) {
                  displayStatus = `Low power · ${vehicle.main_voltage?.toFixed(1) || '--'}V`;
                  statusColor = '#f59e0b';
                  dotColor = '#f59e0b';
                } else if (isGsmWeak) {
                  displayStatus = `Weak network · GSM ${vehicle.gsm_signal}`;
                  statusColor = '#f59e0b';
                  dotColor = '#f59e0b';
                } else if (vehicle.status === 'stopped' && isEngineOn) {
                  displayStatus = 'Lifting';
                  statusColor = '#f59e0b';
                  dotColor = '#f59e0b';
                } else if (vehicle.status === 'moving' && speed > 0) {
                  displayStatus = `Marching at ${speed} km/h`;
                  statusColor = '#10b981';
                  dotColor = '#10b981';
                } else if (vehicle.status === 'moving') {
                  displayStatus = 'Marching';
                  statusColor = '#10b981';
                  dotColor = '#10b981';
                } else if (vehicle.status === 'stopped') {
                  displayStatus = 'Stopped';
                  statusColor = '#ef4444';
                  dotColor = '#ef4444';
                } else if (hasNoData) {
                  displayStatus = 'No data from device';
                  statusColor = '#ef4444';
                  dotColor = '#ef4444';
                } else {
                  displayStatus = vehicle.status.replace('_', ' ');
                  statusColor = 'var(--t3)';
                  dotColor = '#9ca3af';
                }

                const hasIssue = isGpsLost || isGsmWeak || isGsmLost || isMainPowerLow || isWireDisconnected || isSignalLost;
                return (
                  <tr key={`${vehicle.provider}-${vehicle.registration_number}-${idx}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{vehicle.registration_number}</span>
                        {hasIssue && !dismissedIssues.has(vehicle.registration_number) && (
                          <img
                            src={technologyIcon}
                            alt="Issue detected"
                            className="connectivity-icon"
                            style={{ width: '14px', height: '14px', objectFit: 'contain', cursor: 'pointer', animation: 'connectivity-pulse 2s ease-in-out infinite' }}
                            title={
                              (isGpsLost ? 'GPS lost' : '') +
                              (isGsmWeak ? ' Weak network' : '') +
                              (isGsmLost ? ' GSM lost' : '') +
                              (isMainPowerLow ? ' Low power' : '') +
                              (isWireDisconnected ? ' Wire disconnected' : '')
                            }
                            onClick={() => setDismissedIssues(prev => new Set(prev).add(vehicle.registration_number))}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: statusColor }}>
                        {dotColor === '#10b981' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, display: 'inline-block', animation: 'pulse 2s infinite' }} />}
                        {dotColor === '#ef4444' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />}
                        {dotColor === '#f59e0b' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />}
                        {dotColor === '#9ca3af' && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />}
                        {displayStatus}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isEngineOn ? '#10b981' : isEngineOff ? '#ef4444' : '#f59e0b' }}>
                        {isEngineOn ? 'ON' : isEngineOff ? 'OFF' : vehicle.ignition?.toUpperCase() || '--'}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--t3)' }}>{vehicle.last_updated || '--'}</td>
                    <td>
                      <button
                        className="btn-sm outline"
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                        onClick={() => openTripHistory(vehicle)}
                        title="Play trip history"
                      >
                        ▶ History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Map — UNDER the table */}
      {vehicles.length > 0 && (
        <div style={{ borderRadius: 'var(--rlg)', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg2)', marginBottom: '12px' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--fh)', fontSize: '12px', color: 'var(--t1)', margin: 0 }}>Live Map</h3>
              <p style={{ fontSize: '10px', color: 'var(--t3)', margin: '1px 0 0 0' }}>Click markers for details</p>
            </div>
            <button className="btn-sm outline" onClick={() => setShowMap(!showMap)} style={{ fontSize: '10px' }}>
              {showMap ? 'Hide' : 'Show'}
            </button>
          </div>
          {showMap && (
            <div ref={mapContainerRef} style={{ width: '100%', height: '480px', background: '#0d1117' }} />
          )}
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && !loading && (!isAnyConfigured || error) && (
        <div className="gps-iframe-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '32px', background: 'var(--bg3)', borderRadius: 'var(--rlg)', border: '1px solid var(--border)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
          </svg>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>No GPS Vehicles Found</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
            Configure your Blackbuck or Trak N Tell credentials to see live GPS tracking data.
          </div>
          <button className="btn-sm accent" onClick={() => setSettingsOpen(true)}>Open Settings</button>
        </div>
      )}

      {/* Settings Modal */}
      <Modal open={settingsOpen} onClose={() => { setSettingsOpen(false); setBbConfirmDelete(false); setTntConfirmDelete(false); }} title="GPS Settings">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button className="btn-sm accent" onClick={() => setSettingsTab('blackbuck')} style={{ background: settingsTab === 'blackbuck' ? 'var(--accent)' : 'transparent', color: settingsTab === 'blackbuck' ? '#fff' : 'var(--t2)' }}>Blackbuck</button>
          <button className="btn-sm accent" onClick={() => setSettingsTab('trakntell')} style={{ background: settingsTab === 'trakntell' ? 'var(--accent)' : 'transparent', color: settingsTab === 'trakntell' ? '#fff' : 'var(--t2)' }}>Trak N Tell</button>
        </div>

        {/* Blackbuck */}
        {settingsTab === 'blackbuck' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bbCredentials?.configured && (
              <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px', color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Current: Fleet #{bbCredentials.fleet_owner_id} • Updated {bbCredentials.updated_at || 'recently'}</span>
                <button className="btn-sm outline" style={{ fontSize: '10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setBbConfirmDelete(true)}>Remove</button>
              </div>
            )}
            {bbConfirmDelete && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--red)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Remove Blackbuck credentials?</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-sm accent" style={{ background: 'var(--red)' }} onClick={handleDeleteBlackbuck}>Yes</button>
                  <button className="btn-sm outline" onClick={() => setBbConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
            <label className="lbl">Auth Token (accessToken from localStorage)</label>
            <input className="inp" value={bbAuthToken} onChange={e => setBbAuthToken(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiJ9..." />
            <label className="lbl">Fleet Owner ID</label>
            <input className="inp" value={bbFleetOwnerId} onChange={e => setBbFleetOwnerId(e.target.value)} placeholder="e.g. 5599426" style={{ maxWidth: '200px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-sm accent" onClick={handleSaveBlackbuck} disabled={bbSaving}>{bbSaving ? 'Saving…' : 'Save & Test'}</button>
              <button className="btn-sm outline" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Trak N Tell */}
        {settingsTab === 'trakntell' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tntCredentials?.configured && (
              <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px', color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>User #{tntCredentials.user_id_preview}</span>
                  {tntCredentials.has_sessionid && <span style={{ marginLeft: '8px', color: 'var(--green)' }}>✓ Session</span>}
                </div>
                <button className="btn-sm outline" style={{ fontSize: '10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setTntConfirmDelete(true)}>Remove</button>
              </div>
            )}
            {tntConfirmDelete && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--red)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Remove Trak N Tell credentials?</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-sm accent" style={{ background: 'var(--red)' }} onClick={handleDeleteTrakNTell}>Yes</button>
                  <button className="btn-sm outline" onClick={() => setTntConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
            {!tntConfigured && (
              <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px', color: 'var(--t2)', lineHeight: 1.6 }}>
                <strong>How to get credentials:</strong><br />
                1. Log in to Trak N Tell<br />
                2. Copy iframe URL params: u, userIdEncrypt, orgid<br />
                3. Get JSESSIONID + tnt_s from DevTools → Cookies
              </div>
            )}
            <label className="lbl">User ID (u parameter)</label>
            <input className="inp" value={tntUserId} onChange={e => setTntUserId(e.target.value)} placeholder="e.g. 7008693400" style={{ maxWidth: '200px' }} />
            <label className="lbl">User ID Encrypt (userIdEncrypt parameter)</label>
            <input className="inp" value={tntUserIdEncrypt} onChange={e => setTntUserIdEncrypt(e.target.value)} placeholder="e.g. ed28b9610eba386..." />
            <label className="lbl">Organization ID (orgid parameter)</label>
            <input className="inp" value={tntOrgid} onChange={e => setTntOrgid(e.target.value)} placeholder="e.g. f0391b0f72ad..." />
            <label className="lbl">JSESSIONID (from Cookies)</label>
            <input className="inp" value={tntSessionid} onChange={e => setTntSessionid(e.target.value)} placeholder="e.g. E25E18B1A6137..." />
            <label className="lbl">tnt_s Cookie (session state)</label>
            <input className="inp" value={tntTnt_s} onChange={e => setTntTnt_s(e.target.value)} placeholder='e.g. s=dd28b4a8...&v=1' />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-sm accent" onClick={handleSaveTrakNTell} disabled={tntSaving}>{tntSaving ? 'Saving…' : 'Save Credentials'}</button>
              <button className="btn-sm outline" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Trip History Modal */}
      <Modal 
        open={!!tripHistoryVehicle} 
        onClose={() => setTripHistoryVehicle(null)} 
        title={`Trip History: ${tripHistoryVehicle?.registration_number}`}
        maxWidth="800px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '4px' }}>Date</div>
              <input type="date" className="inp" value={tripHistoryDate} onChange={e => setTripHistoryDate(e.target.value)} style={{ padding: '6px 10px' }} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '4px' }}>From</div>
              <input type="time" className="inp" value={tripHistoryFrom} onChange={e => setTripHistoryFrom(e.target.value)} style={{ padding: '6px 10px' }} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '4px' }}>To</div>
              <input type="time" className="inp" value={tripHistoryTo} onChange={e => setTripHistoryTo(e.target.value)} style={{ padding: '6px 10px' }} />
            </div>
            <button className="btn-sm accent" onClick={fetchTripHistory} disabled={tripHistoryLoading} style={{ height: '32px', minWidth: '100px' }}>
              {tripHistoryLoading ? 'Loading…' : 'Fetch History'}
            </button>
          </div>

          {tripError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(239,68,68,0.3)' }}>
              {tripError}
            </div>
          )}

          {/* Map Container */}
          <div style={{ width: '100%', height: '360px', background: '#0d1117', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
            <div ref={tripMapContainerRef} style={{ width: '100%', height: '100%' }} />
            
            {tripPoints.length === 0 && !tripHistoryLoading && !tripError && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,17,23,0.8)', color: 'var(--t3)', fontSize: '13px', zIndex: 1000 }}>
                Select a date range and click Fetch History
              </div>
            )}
            
            {/* Info overlay */}
            {tripPoints.length > 0 && currPoint && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(26,26,46,0.9)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 1000, color: '#fff', fontSize: '11px', minWidth: '200px', backdropFilter: 'blur(4px)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{currPoint.speed} km/h</div>
                <div style={{ color: 'var(--t3)', marginBottom: '4px' }}>{currPoint.timestamp}</div>
                <div style={{ color: 'var(--t2)', lineHeight: 1.4 }}>{currPoint.address || 'Unknown location'}</div>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          {tripPoints.length > 0 && (
            <div style={{ background: 'var(--bg2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <button 
                  className="btn-sm" 
                  style={{ background: isPlaying ? 'var(--bg3)' : 'var(--accent)', color: isPlaying ? 'var(--t1)' : '#fff', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    if (playbackIndex >= tripPoints.length - 1) setPlaybackIndex(0);
                    setIsPlaying(!isPlaying);
                  }}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                
                <input 
                  type="range" 
                  min="0" 
                  max={tripPoints.length - 1} 
                  value={playbackIndex}
                  onChange={e => {
                    setIsPlaying(false);
                    setPlaybackIndex(parseInt(e.target.value));
                  }}
                  style={{ flex: 1, cursor: 'pointer', height: '4px', accentColor: 'var(--accent)' }} 
                />
                
                <div style={{ fontSize: '12px', color: 'var(--t2)', minWidth: '80px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {playbackIndex + 1} / {tripPoints.length}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-sm outline" onClick={() => setPlaybackIndex(Math.max(0, playbackIndex - 10))} title="-10 points">⏪</button>
                  <button className="btn-sm outline" onClick={() => setPlaybackIndex(Math.min(tripPoints.length - 1, playbackIndex + 10))} title="+10 points">⏩</button>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--t3)', marginRight: '4px' }}>Speed:</span>
                  {[1, 2, 5, 10].map(s => (
                    <button 
                      key={s} 
                      className="btn-sm outline" 
                      style={{ padding: '2px 6px', fontSize: '10px', background: playbackSpeed === s ? 'var(--bg3)' : 'transparent', borderColor: playbackSpeed === s ? 'var(--t2)' : '' }}
                      onClick={() => setPlaybackSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
