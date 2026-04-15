import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../../services/api';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import type { TripPoint } from '../../services/api';
import { Modal } from '../../components/ui/Modal';

interface Props {
  vehicle: UnifiedVehicle;
  onClose: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Haversine distance in km between two lat/lng points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing from point A to point B (degrees, 0 = North)
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Speed colour thresholds
function speedColor(speed: number): string {
  if (speed >= 40) return '#10b981'; // fast  — green
  if (speed >= 10) return '#f59e0b'; // slow  — amber
  return '#ef4444';                  // stopped — red
}

// Build a truck SVG marker rotated to a given heading
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
        <!-- arrow head pointing up = north -->
        <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fff" stroke-width="2.5"/>
        <polygon points="16,6 21,22 16,18 11,22" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const START_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#22c55e;border:3px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const END_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#ef4444;border:3px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function BlackbuckHistoryModal({ vehicle, onClose }: Props) {
  const [date, setDate] = useState(todayStr());
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [followCam, setFollowCam] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Leaflet refs — never trigger re-renders
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const segmentsRef = useRef<L.Polyline[]>([]);
  const markerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  // ── Init map once on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(
      [20.5937, 78.9629],
      5
    );
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw route whenever tripPoints changes ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layers
    segmentsRef.current.forEach(s => s.remove());
    segmentsRef.current = [];
    markerRef.current?.remove();
    startMarkerRef.current?.remove();
    endMarkerRef.current?.remove();
    markerRef.current = null;
    startMarkerRef.current = null;
    endMarkerRef.current = null;

    if (tripPoints.length === 0) return;

    // Draw speed-coloured segments
    for (let i = 0; i < tripPoints.length - 1; i++) {
      const a = tripPoints[i];
      const b = tripPoints[i + 1];
      const seg = L.polyline(
        [[a.lat, a.lng], [b.lat, b.lng]],
        { color: speedColor(a.speed ?? 0), weight: 4, opacity: 0.9 }
      ).addTo(map);
      segmentsRef.current.push(seg);
    }

    // Fit bounds
    const latlngs: [number, number][] = tripPoints.map(p => [p.lat, p.lng]);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });

    // Start / end
    startMarkerRef.current = L.marker(latlngs[0], { icon: START_ICON }).addTo(map);
    endMarkerRef.current = L.marker(latlngs[latlngs.length - 1], { icon: END_ICON }).addTo(map);

    // Truck marker at first point, facing first bearing
    const initBear = latlngs.length > 1
      ? bearing(latlngs[0][0], latlngs[0][1], latlngs[1][0], latlngs[1][1])
      : 0;
    markerRef.current = L.marker(latlngs[0], { icon: makeTruckIcon(initBear), zIndexOffset: 1000 }).addTo(map);

    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [tripPoints]);

  // ── Playback animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || tripPoints.length === 0) return;

    const interval = setInterval(() => {
      setPlaybackIndex(i => {
        const next = i + 1;
        if (next >= tripPoints.length) {
          setIsPlaying(false);
          return i;
        }
        const pt = tripPoints[next];
        // Compute heading toward next point
        const deg =
          next < tripPoints.length - 1
            ? bearing(pt.lat, pt.lng, tripPoints[next + 1].lat, tripPoints[next + 1].lng)
            : 0;
        markerRef.current?.setIcon(makeTruckIcon(deg));
        markerRef.current?.setLatLng([pt.lat, pt.lng]);
        if (followCam) {
          mapRef.current?.panTo([pt.lat, pt.lng], { animate: false });
        }
        return next;
      });
    }, Math.max(50, Math.round(1000 / playbackSpeed)));

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, tripPoints, followCam]);

  // ── Slider drag ───────────────────────────────────────────────────────────
  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.target.value);
      setPlaybackIndex(idx);
      setIsPlaying(false);
      if (tripPoints[idx]) {
        const pt = tripPoints[idx];
        const deg =
          idx < tripPoints.length - 1
            ? bearing(pt.lat, pt.lng, tripPoints[idx + 1].lat, tripPoints[idx + 1].lng)
            : 0;
        markerRef.current?.setIcon(makeTruckIcon(deg));
        markerRef.current?.setLatLng([pt.lat, pt.lng]);
        if (followCam) mapRef.current?.panTo([pt.lat, pt.lng], { animate: false });
      }
    },
    [tripPoints, followCam]
  );

  // ── Step forward / back ───────────────────────────────────────────────────
  const stepTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(tripPoints.length - 1, idx));
    setPlaybackIndex(clamped);
    setIsPlaying(false);
    if (tripPoints[clamped]) {
      const pt = tripPoints[clamped];
      const deg =
        clamped < tripPoints.length - 1
          ? bearing(pt.lat, pt.lng, tripPoints[clamped + 1].lat, tripPoints[clamped + 1].lng)
          : 0;
      markerRef.current?.setIcon(makeTruckIcon(deg));
      markerRef.current?.setLatLng([pt.lat, pt.lng]);
      if (followCam) mapRef.current?.panTo([pt.lat, pt.lng], { animate: false });
    }
  }, [tripPoints, followCam]);

  // ── Fetch trip history ────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTripPoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
    setHasFetched(true);

    try {
      const fromMs = new Date(`${date}T${fromTime}:00`).getTime();
      const toMs = new Date(`${date}T${toTime}:59`).getTime();

      if (fromMs >= toMs) {
        setError('"From" time must be before "To" time.');
        setLoading(false);
        return;
      }

      const resp = await api.getBlackbuckTripHistory(
        vehicle.registration_number,
        fromMs,
        toMs
      );

      if (resp.error) {
        setError(resp.error);
      } else if (!resp.points || resp.points.length === 0) {
        setError('No tracking data available for the selected time range.');
      } else {
        setTripPoints(resp.points);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch trip history.');
    } finally {
      setLoading(false);
    }
  }, [date, fromTime, toTime, vehicle.registration_number]);

  // ── Derived values ────────────────────────────────────────────────────────
  const currentPoint = tripPoints[playbackIndex];
  const progress = tripPoints.length > 1 ? playbackIndex / (tripPoints.length - 1) : 0;

  const totalDistanceKm = (() => {
    let d = 0;
    for (let i = 0; i < tripPoints.length - 1; i++) {
      d += haversine(tripPoints[i].lat, tripPoints[i].lng, tripPoints[i + 1].lat, tripPoints[i + 1].lng);
    }
    return d;
  })();

  const startTs = tripPoints[0]?.timestamp ?? '—';
  const endTs = tripPoints[tripPoints.length - 1]?.timestamp ?? '—';

  const spColor = speedColor(currentPoint?.speed ?? 0);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`${vehicle.registration_number} Trip History`}
      maxWidth="1100px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ── Date / time controls ── */}
        <div className="tnt-history-date-row" style={{ gap: 8 }}>
          <div className="tnt-history-date-group">
            <label className="lbl">Date</label>
            <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()} />
          </div>
          <div className="tnt-history-date-group">
            <label className="lbl">From</label>
            <input className="inp" type="time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
          </div>
          <div className="tnt-history-date-group">
            <label className="lbl">To</label>
            <input className="inp" type="time" value={toTime} onChange={e => setToTime(e.target.value)} />
          </div>
          <button
            className="btn-sm accent"
            onClick={fetchHistory}
            disabled={loading}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? 'Loading…' : 'Fetch History'}
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="tnt-history-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Two-column layout: map + controls ── */}
        <div className="bb-history-body">

          {/* Map pane */}
          <div className="bb-history-map-pane" style={{ position: 'relative' }}>
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 8, overflow: 'hidden' }}
            />

            {/* Empty state overlay */}
            {tripPoints.length === 0 && !loading && !error && !hasFetched && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--t3)', fontSize: 13, gap: 8,
                pointerEvents: 'none', zIndex: 500,
                background: 'rgba(0,0,0,0.3)', borderRadius: 8,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" /><path d="M12 8v4l3 3" />
                </svg>
                <span>Select a date range and click Fetch History</span>
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)', zIndex: 600, gap: 12, borderRadius: 8,
              }}>
                <div className="gps-loading-spinner" />
                <span style={{ color: '#fff', fontSize: 13 }}>Fetching route…</span>
              </div>
            )}

            {/* Speed legend (bottom-left of map) */}
            {tripPoints.length > 0 && (
              <div className="bb-speed-legend">
                <span className="bb-speed-dot" style={{ background: '#10b981' }} /> ≥40 km/h
                <span className="bb-speed-dot" style={{ background: '#f59e0b', marginLeft: 8 }} /> 10–40
                <span className="bb-speed-dot" style={{ background: '#ef4444', marginLeft: 8 }} /> &lt;10
              </div>
            )}
          </div>

          {/* Controls pane */}
          {tripPoints.length > 0 && (
            <div className="bb-history-controls-pane">

              {/* ── Video-style playback bar ── */}
              <div className="bb-playback-bar">

                {/* Progress strip */}
                <div className="bb-elapsed-track">
                  <div className="bb-elapsed-fill" style={{ width: `${progress * 100}%`, background: spColor }} />
                </div>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={tripPoints.length - 1}
                  value={playbackIndex}
                  onChange={handleSlider}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '2px 0' }}
                  title={currentPoint?.timestamp ?? ''}
                />

                {/* Time labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>
                  <span>{startTs}</span>
                  <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{currentPoint?.timestamp ?? ''}</span>
                  <span>{endTs}</span>
                </div>

                {/* Control buttons row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Jump to start */}
                  <button className="bb-ctrl-btn" title="Jump to start" onClick={() => stepTo(0)}>⏮</button>

                  {/* Step back */}
                  <button className="bb-ctrl-btn" title="Step back" onClick={() => stepTo(playbackIndex - 1)}>⏪</button>

                  {/* Play / Pause */}
                  <button
                    className="bb-ctrl-btn play"
                    title={isPlaying ? 'Pause' : 'Play'}
                    onClick={() => setIsPlaying(p => !p)}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>

                  {/* Step forward */}
                  <button className="bb-ctrl-btn" title="Step forward" onClick={() => stepTo(playbackIndex + 1)}>⏩</button>

                  {/* Jump to end */}
                  <button className="bb-ctrl-btn" title="Jump to end" onClick={() => stepTo(tripPoints.length - 1)}>⏭</button>

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Speed selector */}
                  <select
                    value={playbackSpeed}
                    onChange={e => setPlaybackSpeed(Number(e.target.value))}
                    style={{
                      background: 'var(--bg3)', color: 'var(--t1)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      padding: '3px 6px', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {[1, 2, 5, 10, 20, 50].map(s => (
                      <option key={s} value={s}>{s}×</option>
                    ))}
                  </select>
                </div>

                {/* Follow cam toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t2)', marginTop: 6, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={followCam}
                    onChange={e => setFollowCam(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Follow vehicle
                </label>
              </div>

              {/* ── Current point info ── */}
              {currentPoint && (
                <div className="bb-point-info">
                  <div className="bb-point-row">
                    <span className="bb-point-label">Point</span>
                    <span className="bb-point-value">{playbackIndex + 1} / {tripPoints.length}</span>
                  </div>
                  <div className="bb-point-row">
                    <span className="bb-point-label">Speed</span>
                    <span className="bb-point-value" style={{ color: spColor, fontWeight: 700 }}>
                      {(currentPoint.speed ?? 0).toFixed(1)} km/h
                    </span>
                  </div>
                  {currentPoint.timestamp && (
                    <div className="bb-point-row">
                      <span className="bb-point-label">Time</span>
                      <span className="bb-point-value">{currentPoint.timestamp}</span>
                    </div>
                  )}
                  {currentPoint.address && (
                    <div className="bb-point-row" style={{ flexDirection: 'column', gap: 2 }}>
                      <span className="bb-point-label">Location</span>
                      <span className="bb-point-value" style={{ fontSize: 11, color: 'var(--t2)', wordBreak: 'break-word' }}>
                        {currentPoint.address}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Route summary ── */}
              <div className="bb-route-summary">
                <div className="bb-summary-row">
                  <span className="bb-dot" style={{ background: '#22c55e' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>Start</div>
                    <div style={{ fontSize: 12 }}>{startTs}</div>
                  </div>
                </div>
                <div className="bb-summary-row">
                  <span className="bb-dot" style={{ background: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>End</div>
                    <div style={{ fontSize: 12 }}>{endTs}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--t2)' }}>
                  <span>{tripPoints.length} pts</span>
                  {totalDistanceKm > 0 && (
                    <span>{totalDistanceKm.toFixed(1)} km</span>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
