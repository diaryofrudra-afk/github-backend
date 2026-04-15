import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getToken } from '../../services/api';
import { Modal } from '../../components/ui/Modal';

interface HistoryRecord { [key: string]: any }

interface FetchResult {
  records: HistoryRecord[];
  count: number;
  endpoint?: string;
  error?: string;
  all_fields?: string[];
  field_categories?: {
    boom_crane: string[];
    can_engine: string[];
    sensors: string[];
    other: string[];
  };
}

type DataTab = 'sensors' | 'can' | 'history' | 'alerts' | 'trips';

interface Props {
  vehicleId: string;
  registrationNumber: string;
  onClose: () => void;
}

const TAB_LABELS: { id: DataTab; label: string; icon: string }[] = [
  { id: 'sensors', label: 'Sensors',  icon: '📡' },
  { id: 'can',     label: 'CAN / OBD', icon: '⚙️' },
  { id: 'history', label: 'GPS Track', icon: '🗺️' },
  { id: 'alerts',  label: 'Alerts',   icon: '⚠️' },
  { id: 'trips',   label: 'Trips',    icon: '🛣️' },
];

function todayStr()   { return new Date().toISOString().slice(0, 10); }
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// Speed colour
function speedColor(speed: number): string {
  if (speed >= 40) return '#10b981';
  if (speed >= 10) return '#f59e0b';
  return '#ef4444';
}

// Bearing A → B (degrees)
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function makeTruckIcon(deg: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${deg}deg);
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));
    ">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#6366f1" stroke="#fff" stroke-width="2.5"/>
        <polygon points="16,6 21,22 16,18 11,22" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const START_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const END_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface TripPoint { lat: number; lng: number; speed: number; timestamp: string; }

function parseGPSPoints(records: HistoryRecord[]): TripPoint[] {
  return records
    .map(r => {
      const lat = parseFloat(r.latitude ?? r.lat ?? r.Latitude ?? '');
      const lng = parseFloat(r.longitude ?? r.lng ?? r.Longitude ?? '');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
      return {
        lat,
        lng,
        speed: parseFloat(r.speed ?? r.Speed ?? '0') || 0,
        timestamp: r.timestamp ?? r.time ?? r.dateTime ?? r.date_time ?? r.created_at ?? '',
      };
    })
    .filter(Boolean) as TripPoint[];
}

export function TnTHistoryPanel({ vehicleId, registrationNumber, onClose }: Props) {
  const [tab, setTab] = useState<DataTab>('sensors');
  const [fromDate, setFromDate] = useState(weekAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const [result, setResult] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [probeResults, setProbeResults] = useState<Record<string, any> | null>(null);

  // GPS playback state (only for 'history' tab)
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [followCam, setFollowCam] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const segmentsRef = useRef<L.Polyline[]>([]);
  const markerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const mapInitialized = useRef(false);

  // ── Init / destroy map when GPS Track tab is shown ────────────────────────
  useEffect(() => {
    if (tab !== 'history') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapInitialized.current = false;
      }
      setTripPoints([]);
      setPlaybackIndex(0);
      setIsPlaying(false);
      return;
    }
    // Map is initialized once the container mounts; use a timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
      mapRef.current = map;
      mapInitialized.current = true;
      map.invalidateSize();
    }, 150);
    return () => {
      clearTimeout(timer);
    };
  }, [tab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw route when tripPoints change ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || tab !== 'history') return;

    segmentsRef.current.forEach(s => s.remove());
    segmentsRef.current = [];
    markerRef.current?.remove();
    startMarkerRef.current?.remove();
    endMarkerRef.current?.remove();
    markerRef.current = null;
    startMarkerRef.current = null;
    endMarkerRef.current = null;

    if (tripPoints.length === 0) return;

    for (let i = 0; i < tripPoints.length - 1; i++) {
      const a = tripPoints[i];
      const b = tripPoints[i + 1];
      const seg = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: speedColor(a.speed), weight: 4, opacity: 0.9,
      }).addTo(map);
      segmentsRef.current.push(seg);
    }

    const latlngs: [number, number][] = tripPoints.map(p => [p.lat, p.lng]);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });

    startMarkerRef.current = L.marker(latlngs[0], { icon: START_ICON }).addTo(map);
    endMarkerRef.current = L.marker(latlngs[latlngs.length - 1], { icon: END_ICON }).addTo(map);

    const initBear = latlngs.length > 1
      ? bearing(latlngs[0][0], latlngs[0][1], latlngs[1][0], latlngs[1][1])
      : 0;
    markerRef.current = L.marker(latlngs[0], { icon: makeTruckIcon(initBear), zIndexOffset: 1000 }).addTo(map);

    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [tripPoints, tab]);

  // ── Playback animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || tripPoints.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(i => {
        const next = i + 1;
        if (next >= tripPoints.length) { setIsPlaying(false); return i; }
        const pt = tripPoints[next];
        const deg = next < tripPoints.length - 1
          ? bearing(pt.lat, pt.lng, tripPoints[next + 1].lat, tripPoints[next + 1].lng)
          : 0;
        markerRef.current?.setIcon(makeTruckIcon(deg));
        markerRef.current?.setLatLng([pt.lat, pt.lng]);
        if (followCam) mapRef.current?.panTo([pt.lat, pt.lng], { animate: false });
        return next;
      });
    }, Math.max(50, Math.round(1000 / playbackSpeed)));
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, tripPoints, followCam]);

  const stepTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(tripPoints.length - 1, idx));
    setPlaybackIndex(clamped);
    setIsPlaying(false);
    if (tripPoints[clamped]) {
      const pt = tripPoints[clamped];
      const deg = clamped < tripPoints.length - 1
        ? bearing(pt.lat, pt.lng, tripPoints[clamped + 1].lat, tripPoints[clamped + 1].lng)
        : 0;
      markerRef.current?.setIcon(makeTruckIcon(deg));
      markerRef.current?.setLatLng([pt.lat, pt.lng]);
      if (followCam) mapRef.current?.panTo([pt.lat, pt.lng], { animate: false });
    }
  }, [tripPoints, followCam]);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    stepTo(Number(e.target.value));
  }, [stepTo]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setTripPoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);

    if (showCustom && customEndpoint.trim()) {
      try {
        const res = await fetch('/api/gps/trakntell/custom-fetch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint_name: customEndpoint.trim(), vehicle_id: vehicleId, from_date: fromDate, to_date: toDate }),
        });
        const data = await res.json();
        if (!res.ok) {
          const detail = data.detail;
          setError(typeof detail === 'object' ? detail.message : (detail || 'Request failed'));
        } else {
          setResult({ records: data.records, count: data.count, endpoint: data.endpoint });
          if (tab === 'history') setTripPoints(parseGPSPoints(data.records));
        }
      } catch (e: any) {
        setError(e.message || 'Network error');
      } finally {
        setLoading(false);
      }
      return;
    }

    const endpointMap: Record<DataTab, string> = {
      sensors: `/api/gps/trakntell/sensors/${encodeURIComponent(vehicleId)}`,
      can:     `/api/gps/trakntell/can/${encodeURIComponent(vehicleId)}`,
      history: `/api/gps/trakntell/history/${encodeURIComponent(vehicleId)}`,
      alerts:  `/api/gps/trakntell/alerts/${encodeURIComponent(vehicleId)}`,
      trips:   `/api/gps/trakntell/trips/${encodeURIComponent(vehicleId)}`,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000); // 45s hard cap

    try {
      const res = await fetch(`${endpointMap[tab]}?from=${fromDate}&to=${toDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Request failed');
      } else {
        setResult(data);
        if (data.error) setError(data.error);
        if (tab === 'history') setTripPoints(parseGPSPoints(data.records ?? []));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Click "🔍 Auto-detect" first to find working endpoints, then try Fetch again.');
      } else {
        setError(e.message || 'Network error');
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [tab, vehicleId, fromDate, toDate, showCustom, customEndpoint]);

  const probeEndpoints = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setProbeLoading(true);
    setProbeResults(null);
    setError(null);

    try {
      // POST /discover-endpoints: Playwright-based in-browser discovery (more reliable than HTTP probing)
      const res = await fetch('/api/gps/trakntell/discover-endpoints', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Discovery failed');
      } else {
        setProbeResults(data);
        // Persist discovered endpoints so future fetches use them automatically
        if (data.reachable_endpoints?.length > 0) {
          fetch('/api/gps/trakntell/save-discovered-endpoints', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reachable_endpoints: data.reachable_endpoints }),
          }).catch(() => {/* best-effort save */});
        }
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setProbeLoading(false);
    }
  }, []);

  // Derived values
  const currentPoint = tripPoints[playbackIndex];
  const progress = tripPoints.length > 1 ? playbackIndex / (tripPoints.length - 1) : 0;
  const spColor = speedColor(currentPoint?.speed ?? 0);
  const startTs = tripPoints[0]?.timestamp ?? '—';
  const endTs = tripPoints[tripPoints.length - 1]?.timestamp ?? '—';

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`${registrationNumber} History - Trak N Tell`}
      maxWidth="1100px"
    >

      {/* Tab bar */}
      <div className="tnt-history-tabs">
        {TAB_LABELS.map(t => (
          <button
            key={t.id}
            className={`tnt-history-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => { setTab(t.id); setResult(null); setError(null); }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="tnt-history-date-row">
        <div className="tnt-history-date-group">
          <label className="lbl">From</label>
          <input className="inp" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate} />
        </div>
        <div className="tnt-history-date-group">
          <label className="lbl">To</label>
          <input className="inp" type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate} max={todayStr()} />
        </div>
        <button className="btn-sm accent" onClick={fetchData} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? 'Loading…' : 'Fetch'}
        </button>
        <button className="btn-sm" onClick={probeEndpoints} disabled={probeLoading || loading} style={{ alignSelf: 'flex-end' }}>
          {probeLoading ? 'Probing…' : '🔍 Auto-detect'}
        </button>
       </div>

      {/* Probe results — normalise both {reachable_endpoints:[]} and legacy {working:[]} shapes */}
      {probeResults && (() => {
        const raw = probeResults as Record<string, any>;
        const rawList = raw.reachable_endpoints ?? raw.working;
        const found: string[] = Array.isArray(rawList) ? rawList : [];
        const allResults = raw.all_results;
        const total: number = allResults && typeof allResults === 'object'
          ? Object.keys(allResults).length
          : (typeof raw.total === 'number' ? raw.total : 54);
        return (
          <div className="tnt-probe-summary" style={{
            padding: '10px 12px',
            background: 'var(--bg2)',
            borderRadius: 6,
            margin: '8px 0',
            fontSize: 13,
          }}>
            {found.length > 0
              ? <>✅ <strong>{found.length}</strong> working endpoints found out of {total}: <code style={{ marginLeft: 8, color: '#10b981' }}>{found.join(', ')}</code></>
              : <>⚠️ No working endpoints found out of {total} tried. Try clicking Fetch — endpoints may have been intercepted from the live page.</>}
          </div>
        );
      })()}

      {/* Custom endpoint */}
      <div className="tnt-custom-endpoint-toggle">
        <button className="tnt-custom-toggle-btn" onClick={() => setShowCustom(x => !x)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          {showCustom ? 'Use auto-detect' : 'Manual endpoint (DevTools)'}
        </button>
      </div>
      {showCustom && (
        <div className="tnt-custom-endpoint-row">
          <input
            className="inp tnt-custom-endpoint-input"
            type="text"
            placeholder="e.g. tntServiceGetHistoryData"
            value={customEndpoint}
            onChange={e => setCustomEndpoint(e.target.value)}
          />
          <p className="tnt-custom-hint">
            Open Chrome DevTools → Network tab on web.trakntell.com → navigate to History for a vehicle → copy the servlet name from the request URL.
          </p>
        </div>
      )}

      {/* ── GPS Track tab: map + playback ── */}
      {tab === 'history' && (
        <div className="bb-history-body">

          {/* Map pane */}
          <div className="bb-history-map-pane" style={{ position: 'relative' }}>
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 8, overflow: 'hidden' }}
            />

            {/* Empty state overlay */}
            {tripPoints.length === 0 && !loading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--t3)', fontSize: 13, gap: 8,
                pointerEvents: 'none', zIndex: 500,
                background: 'rgba(0,0,0,0.35)', borderRadius: 8,
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}>
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" /><path d="M12 8v4l3 3" />
                </svg>
                <span>Fetch GPS track to play history</span>
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)', zIndex: 600, gap: 10, borderRadius: 8,
              }}>
                <div className="gps-loading-spinner" />
                <span style={{ color: '#fff', fontSize: 13 }}>Fetching GPS track…</span>
              </div>
            )}

            {/* Speed legend */}
            {tripPoints.length > 0 && (
              <div className="bb-speed-legend">
                <span className="bb-speed-dot" style={{ background: '#10b981' }} /> ≥40
                <span className="bb-speed-dot" style={{ background: '#f59e0b', marginLeft: 8 }} /> 10–40
                <span className="bb-speed-dot" style={{ background: '#ef4444', marginLeft: 8 }} /> &lt;10
              </div>
            )}
          </div>

          {/* Controls pane */}
          {tripPoints.length > 0 && (
            <div className="bb-history-controls-pane">
              <div className="bb-playback-bar">
                {/* Progress strip */}
                <div className="bb-elapsed-track">
                  <div className="bb-elapsed-fill" style={{ width: `${progress * 100}%`, background: spColor }} />
                </div>
                {/* Scrubber */}
                <input
                  type="range" min={0} max={tripPoints.length - 1} value={playbackIndex}
                  onChange={handleSlider}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '2px 0' }}
                  title={currentPoint?.timestamp ?? ''}
                />
                {/* Time labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                  <span>{startTs}</span>
                  <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{currentPoint?.timestamp ?? ''}</span>
                  <span>{endTs}</span>
                </div>
                {/* Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="bb-ctrl-btn" title="Jump to start" onClick={() => stepTo(0)}>⏮</button>
                  <button className="bb-ctrl-btn" title="Step back" onClick={() => stepTo(playbackIndex - 1)}>⏪</button>
                  <button className="bb-ctrl-btn play" title={isPlaying ? 'Pause' : 'Play'} onClick={() => setIsPlaying(p => !p)}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="bb-ctrl-btn" title="Step forward" onClick={() => stepTo(playbackIndex + 1)}>⏩</button>
                  <button className="bb-ctrl-btn" title="Jump to end" onClick={() => stepTo(tripPoints.length - 1)}>⏭</button>
                  <div style={{ flex: 1 }} />
                  <select
                    value={playbackSpeed}
                    onChange={e => setPlaybackSpeed(Number(e.target.value))}
                    style={{
                      background: 'var(--bg3)', color: 'var(--t1)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      padding: '3px 6px', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {[1, 2, 5, 10, 20, 50].map(s => <option key={s} value={s}>{s}×</option>)}
                  </select>
                </div>
                {/* Follow cam + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t2)', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={followCam} onChange={e => setFollowCam(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Follow vehicle
                  </label>
                  {currentPoint && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', gap: 10 }}>
                      <span>Pt <strong style={{ color: 'var(--t1)' }}>{playbackIndex + 1}/{tripPoints.length}</strong></span>
                      <span style={{ color: spColor, fontWeight: 700 }}>{(currentPoint.speed ?? 0).toFixed(1)} km/h</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="tnt-history-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p>{error}</p>
                 {(error.includes('endpoint') || error.includes('responded')) && !showCustom && (
                   <div className="tnt-devtools-guide">
                     <p className="tnt-devtools-title">Click <strong>🔍 Auto-detect</strong> above to fix this automatically.</p>
                     <p style={{ marginBottom: 10 }}>
                       Auto-detect uses your stored session to discover which endpoints your account supports — no DevTools needed.
                     </p>
                     <p style={{ margin: '8px 0', opacity: 0.7 }}>Still failing? Use manual fallback:</p>
                     <ol className="tnt-devtools-steps">
                       <li>Open <strong>web.trakntell.com</strong> in Chrome</li>
                       <li>Press <kbd>F12</kbd> → Network tab → filter by <code>tntService</code></li>
                       <li>Click on a vehicle → open History</li>
                       <li>Copy the servlet name from the request URL</li>
                       <li>Click <strong>"Manual endpoint"</strong> above and paste it</li>
                     </ol>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Table if we have records */}
          {result && !loading && result.records?.length > 0 && (
            <div className="tnt-history-body" style={{ flex: 1, overflow: 'auto' }}>
              <ResultView result={result} tab={tab} />
            </div>
          )}
          {result && !loading && (!result.records || result.records.length === 0) && !error && (
            <div className="tnt-history-empty"><p>No GPS records found for this date range.</p></div>
          )}
        </div>
      )}

      {/* ── All other tabs: existing behaviour ── */}
      {tab !== 'history' && (
        <div className="tnt-history-body">
          {!result && !error && !loading && (
            <div className="tnt-history-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>Select a date range and click Fetch to load {TAB_LABELS.find(t => t.id === tab)?.label.toLowerCase()} data.</p>
            </div>
          )}
          {loading && (
            <div className="tnt-history-empty">
              <div className="gps-loading-spinner" />
              <p>Fetching from Trak N Tell…</p>
            </div>
          )}
          {error && (
            <div className="tnt-history-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p>{error}</p>
                 {(error.includes('endpoint') || error.includes('responded')) && !showCustom && (
                   <div className="tnt-devtools-guide">
                     <p className="tnt-devtools-title">Use Auto-detect or find endpoint manually:</p>
                     <p style={{ marginBottom: 10 }}>
                       💡 Click the <strong>🔍 Auto-detect</strong> button above to automatically scan for working endpoints for your account.
                     </p>
                     <p style={{ margin: '8px 0', opacity: 0.7 }}>Or manually via DevTools:</p>
                     <ol className="tnt-devtools-steps">
                       <li>Open <strong>web.trakntell.com</strong> in Chrome</li>
                       <li>Press <kbd>F12</kbd> → Network tab → filter by <code>tntService</code></li>
                       <li>Click on a vehicle → open History or Sensor Report</li>
                       <li>Copy the servlet name from the request URL (e.g. <code>tntServiceGetHistoryData</code>)</li>
                       <li>Click <strong>"Manual endpoint"</strong> above and paste it</li>
                     </ol>
                   </div>
                 )}
              </div>
            </div>
          )}
          {result && !loading && <ResultView result={result} tab={tab} />}
         </div>
       )}
     </Modal>
   );
 }

function ResultView({ result, tab }: { result: FetchResult; tab: DataTab }) {
  if (!result.records || result.records.length === 0) {
    return (
      <div className="tnt-history-empty">
        <p>No records found for this date range.</p>
        {result.endpoint && <p className="tnt-history-hint">Endpoint: <code>{result.endpoint}</code></p>}
      </div>
    );
  }

  const cats = result.field_categories;
  const hasBoomData = cats && cats.boom_crane.length > 0;
  const hasCanData = cats && cats.can_engine.length > 0;

  return (
    <div className="tnt-history-result">
      <div className="tnt-history-summary">
        <span>{result.count} records</span>
        {result.endpoint && <span className="tnt-history-endpoint-badge">{result.endpoint}</span>}
        {hasBoomData && (
          <span className="tnt-history-category-badge boom">Boom/Crane: {cats!.boom_crane.join(', ')}</span>
        )}
        {hasCanData && (
          <span className="tnt-history-category-badge can">CAN: {cats!.can_engine.length} fields</span>
        )}
      </div>
      {hasBoomData && <BoomSensorSummary records={result.records} fields={cats!.boom_crane} />}
      <RecordTable records={result.records} tab={tab} boomFields={cats?.boom_crane || []} canFields={cats?.can_engine || []} />
    </div>
  );
}

function BoomSensorSummary({ records, fields }: { records: HistoryRecord[]; fields: string[] }) {
  const stats: { field: string; min: number; max: number; latest: any }[] = [];
  for (const f of fields) {
    const vals = records.map(r => parseFloat(r[f])).filter(v => !isNaN(v));
    if (vals.length) {
      stats.push({ field: f, min: Math.min(...vals), max: Math.max(...vals), latest: records[records.length - 1]?.[f] ?? '--' });
    }
  }
  if (!stats.length) return null;

  return (
    <div className="tnt-boom-summary">
      <p className="tnt-boom-title">Boom / Crane Sensors</p>
      <div className="tnt-boom-grid">
        {stats.map(s => (
          <div key={s.field} className="tnt-boom-card">
            <p className="tnt-boom-field-name">{s.field.replace(/_/g, ' ')}</p>
            <p className="tnt-boom-latest">{s.latest}</p>
            <p className="tnt-boom-range">Range: {s.min.toFixed(1)} – {s.max.toFixed(1)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordTable({ records, tab: _tab, boomFields, canFields }: {
  records: HistoryRecord[];
  tab: DataTab;
  boomFields: string[];
  canFields: string[];
}) {
  const allKeys = Object.keys(records[0] || {});
  const priorityKeys = [
    ...boomFields, ...canFields,
    'timestamp', 'time', 'dateTime', 'date_time', 'created_at',
    'latitude', 'longitude', 'speed', 'address',
    'ignition', 'ignition_value',
    'alert_type', 'alertType', 'event_type',
    'distance', 'duration', 'trip_distance',
  ];

  const orderedKeys = [
    ...priorityKeys.filter(k => allKeys.includes(k)),
    ...allKeys.filter(k => !priorityKeys.includes(k)),
  ].slice(0, 15);

  return (
    <div className="tnt-history-table-wrap">
      <table className="data-table tnt-history-table">
        <thead>
          <tr>{orderedKeys.map(k => <th key={k} title={k}>{k.replace(/_/g, ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {records.slice(0, 200).map((r, i) => (
            <tr key={i}>
              {orderedKeys.map(k => {
                const val = r[k];
                const isBoom = boomFields.includes(k);
                const isCan = canFields.includes(k);
                return (
                  <td key={k}>
                    <span className={isBoom ? 'tnt-td-boom' : isCan ? 'tnt-td-can' : ''}>
                      {val == null ? '--' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 200 && (
        <p className="tnt-history-truncated">Showing first 200 of {records.length} records</p>
      )}
    </div>
  );
}
