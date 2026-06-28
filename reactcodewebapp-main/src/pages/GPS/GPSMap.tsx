import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';

interface GPSMapProps {
  vehicles: UnifiedVehicle[];
  onVehicleSelect: (vehicle: UnifiedVehicle) => void;
  selectedVehicle?: UnifiedVehicle | null;
  mapRef?: React.MutableRefObject<L.Map | null>;
}

export function getVehicleCategory(v: UnifiedVehicle): 'on' | 'off' {
  return (v.engine_on === true || v.ignition === 'on') ? 'on' : 'off';
}

const PIN_COLORS: Record<string, string> = {
  on:  '#34c759',
  off: '#d1d1d6',
};

function makePin(vehicle: UnifiedVehicle, selected: boolean): L.DivIcon {
  const cat = getVehicleCategory(vehicle);
  const color = PIN_COLORS[cat];

  return L.divIcon({
    className: '',
    html: `
      <div class="vehicle-marker" style="transform: translate(-50%, -50%);">
        <div class="marker-icon-new" style="${selected ? 'border: 2px solid #ff6b35;' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 19h18"/>
            <path d="M7 11l2-4h6l2 4"/>
            <path d="M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
            <circle cx="7" cy="17" r="1"/>
            <circle cx="17" cy="17" r="1"/>
          </svg>
          <div class="marker-dot-new ${cat === 'on' ? 'green' : 'gray'}"></div>
        </div>
      </div>`,
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  });
}

export function GPSMap({ vehicles, onVehicleSelect, selectedVehicle, mapRef: extRef }: GPSMapProps) {
  const mapRef        = useRef<L.Map | null>(null);
  const containerRef  = useRef<HTMLDivElement | null>(null);
  const layerRef      = useRef<L.LayerGroup | null>(null);
  const initRef       = useRef(false);
  const onSelectRef   = useRef(onVehicleSelect);

  useEffect(() => { onSelectRef.current = onVehicleSelect; }, [onVehicleSelect]);
  useEffect(() => { if (extRef) extRef.current = mapRef.current; });

  const rebuild = useCallback(() => {
    const pts = vehicles.filter(v => v.latitude && v.longitude && (v.latitude !== 0 || v.longitude !== 0));
    if (!containerRef.current) return;

    if (!mapRef.current) {
      if (pts.length === 0) return;

      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: false,
      }).setView([pts[0].latitude!, pts[0].longitude!], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(mapRef.current);

      layerRef.current = L.layerGroup().addTo(mapRef.current);
      if (extRef) extRef.current = mapRef.current;
    }

    layerRef.current!.clearLayers();
    if (pts.length === 0) return;

    const bounds: [number, number][] = [];
    pts.forEach(v => {
      const isSel = selectedVehicle?.registration_number === v.registration_number;
      const marker = L.marker([v.latitude!, v.longitude!], { icon: makePin(v, isSel), zIndexOffset: isSel ? 1000 : 0 });
      marker.on('click', () => onSelectRef.current(v));
      layerRef.current!.addLayer(marker);
      bounds.push([v.latitude!, v.longitude!]);
    });

    if (!initRef.current && bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [80, 220], maxZoom: 14 });
      initRef.current = true;
    }
  }, [vehicles, selectedVehicle, extRef]);

  useEffect(() => { rebuild(); }, [rebuild]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={containerRef} className="beacon-map-container" />;
}
