import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue in Leaflet + Vite
import crawlerCraneIcon from '../assets/crane.png';

interface VehicleMarker {
  registration_number: string;
  status: string;
  latitude: number;
  longitude: number;
  speed?: number;
  engine_on?: boolean | null;
  ignition_status?: string;
  signal?: string;
  address?: string;
  last_updated?: string;
}

interface GPSMapProps {
  vehicles: VehicleMarker[];
  active: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  moving: '#22c55e',
  stopped: '#ef4444',
  wire_disconnected: '#f59e0b',
  signal_lost: '#8b5cf6',
};

function statusColor(status: string): string {
  return STATUS_COLOR[status] || '#6b7280';
}

function createDivIcon(vehicle: VehicleMarker): L.DivIcon {
  const color = statusColor(vehicle.status);
  const engineDot = vehicle.engine_on === true
    ? `<span style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 4px rgba(34,197,94,0.6);"></span>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;width:32px;height:32px;">
        <img src="${crawlerCraneIcon}" alt="${vehicle.registration_number}" style="width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
        <span style="position:absolute;bottom:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,0.3);"></span>
        ${engineDot}
      </div>
      <div style="margin-top:2px;padding:1px 6px;background:rgba(0,0,0,0.15);border-radius:4px;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.15);text-shadow:0 1px 2px rgba(0,0,0,0.8);">${vehicle.registration_number}</div>
    </div>`,
    iconSize: [70, 48],
    iconAnchor: [35, 16],
    popupAnchor: [0, -16],
  });
}

export function GPSMap({ vehicles, active }: GPSMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  // Initialize map ONLY when the tab becomes active
  useEffect(() => {
    if (!active || !containerRef.current || initRef.current) return;
    initRef.current = true;

    // Pre-show container to avoid Leaflet dimension issues
    containerRef.current.style.display = 'block';

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true, // Better performance for many markers
      fadeAnimation: false, // Faster rendering
      markerZoomAnimation: false,
    }).setView([20.5, 85.5], 9);

    // CartoDB Voyager tiles — faster than OSM, no rate limits
    const tiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
        updateWhenZooming: false, // Performance
        updateWhenIdle: true,
        keepBuffer: 2,
      }
    ).addTo(map);
    tilesRef.current = tiles;

    mapRef.current = map;
    setReady(true);

    // Fix tile rendering if container was hidden
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      tilesRef.current = null;
      initRef.current = false;
      setReady(false);
    };
  }, [active]);

  // Invalidate size when tab becomes active (map was hidden before)
  useEffect(() => {
    if (active && mapRef.current && ready) {
      mapRef.current.invalidateSize();
    }
  }, [active, ready]);

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapRef.current || !ready) return;

    // Clear old markers
    markersRef.current.forEach(m => mapRef.current!.removeLayer(m));
    markersRef.current = [];

    // Filter vehicles with valid coordinates
    const validVehicles = vehicles.filter(
      v => v.latitude && v.longitude && v.latitude !== 0 && v.longitude !== 0
    );

    if (validVehicles.length === 0) return;

    // Add markers
    validVehicles.forEach(v => {
      const marker = L.marker([v.latitude, v.longitude], {
        icon: createDivIcon(v),
      });

      const engineText = v.engine_on === true
        ? '<span style="color:#22c55e;font-weight:600">Engine ON</span>'
        : v.engine_on === false
          ? '<span style="color:#6b7280">Engine OFF</span>'
          : '<span style="color:#9ca3af">Engine —</span>';

      const popupContent = `<div style="min-width:200px;font-family:system-ui;font-size:12px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">${v.registration_number}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;line-height:1.6;">
          <span style="color:#6b7280">Status:</span><span style="font-weight:600;color:${statusColor(v.status)}">${v.status.replace(/_/g, ' ').toUpperCase()}</span>
          <span style="color:#6b7280">Engine:</span><span>${engineText}</span>
          <span style="color:#6b7280">Speed:</span><span>${v.speed != null ? v.speed + ' km/h' : '—'}</span>
          <span style="color:#6b7280">Signal:</span><span>${v.signal || '—'}</span>
          <span style="color:#6b7280">Updated:</span><span>${v.last_updated || '—'}</span>
          ${v.address ? `<span style="color:#6b7280">Address:</span><span style="grid-column:2;font-size:11px;color:#4b5563">${v.address}</span>` : ''}
        </div>
      </div>`;

      marker.bindPopup(popupContent);
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Fit map to show all markers with padding
    const group = L.featureGroup(markersRef.current);
    mapRef.current.fitBounds(group.getBounds().pad(0.15));
  }, [vehicles, ready]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading overlay */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--bg2)', zIndex: 1000,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Loading map…</div>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: active ? 'block' : 'none',
        }}
      />
      {/* Spin animation style */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
