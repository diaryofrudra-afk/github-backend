import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';

interface GPSMapProps {
  vehicles: UnifiedVehicle[];
  onVehicleClick: (vehicle: UnifiedVehicle) => void;
  mapRef?: React.MutableRefObject<L.Map | null>;
  isDark?: boolean;
}

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function GPSMap({ vehicles, onVehicleClick, mapRef: externalMapRef, isDark = true }: GPSMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const prevVehiclesRef = useRef<UnifiedVehicle[]>([]);

  // Expose map ref to parent
  useEffect(() => {
    if (externalMapRef) {
      externalMapRef.current = mapRef.current;
    }
  }, [externalMapRef]);

  const createMarkerIcon = useCallback((vehicle: UnifiedVehicle) => {
    const isWireDisconnected = vehicle.status === 'wire_disconnected';
    const isSignalLost = vehicle.status === 'signal_lost';
    const isGpsLost = vehicle.is_gps_working === false;
    const isStopped = vehicle.status === 'stopped';

    let markerColor = '#00e5a0'; // connected - green
    let statusClass = 'connected';

    if (isWireDisconnected || isSignalLost) {
      markerColor = '#6b7280';
      statusClass = 'signal-lost';
    } else if (isGpsLost) {
      markerColor = '#ff4466';
      statusClass = 'alert';
    } else if (isStopped) {
      markerColor = '#60a5fa';
      statusClass = 'stopped';
    }

    const isMoving = vehicle.status === 'moving' || (vehicle.speed && vehicle.speed > 5);
    const hasPulse = statusClass === 'connected' && isMoving;

    const icon = L.divIcon({
      className: 'beacon-marker-wrapper',
      html: `
        <div class="beacon-marker">
          ${hasPulse ? '<div class="beacon-marker-pulse"></div>' : ''}
          <div class="beacon-marker-dot" style="background-color: ${markerColor};"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -16],
    });

    return icon;
  }, []);

  const flyToVehicle = useCallback((vehicle: UnifiedVehicle) => {
    if (vehicle.latitude && vehicle.longitude && mapRef.current) {
      mapRef.current.flyTo([vehicle.latitude, vehicle.longitude], 16, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, []);

  useEffect(() => {
    if (vehicles.length === 0 || !mapContainerRef.current) return;

    const withCoords = vehicles.filter(
      (v) => v.latitude != null && v.longitude != null && (v.latitude !== 0 || v.longitude !== 0)
    );

    if (withCoords.length === 0) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current!, {
        zoomControl: false,
        scrollWheelZoom: true,
        dragging: true,
        attributionControl: false,
      }).setView([withCoords[0].latitude!, withCoords[0].longitude!], 13);

      // Tile layer - satellite for light theme, dark for dark theme
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

      L.tileLayer(tileUrl, {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        subdomains: isDark ? 'abcd' : 'server',
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    // Update markers
    if (markersRef.current && mapRef.current) {
      markersRef.current.clearLayers();
      const bounds: [number, number][] = [];

      withCoords.forEach((vehicle) => {
        const lat = vehicle.latitude!;
        const lng = vehicle.longitude!;

        const icon = createMarkerIcon(vehicle);

        L.marker([lat, lng], { icon })
          .on('click', () => {
            onVehicleClick(vehicle);
            flyToVehicle(vehicle);
          })
          .bindPopup(`
            <div class="beacon-popup">
              <div class="beacon-popup-header">
                <span class="beacon-popup-name">${vehicle.registration_number}</span>
                <span class="beacon-popup-status status-${vehicle.status}">${vehicle.status.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div class="beacon-popup-body">
                <div class="beacon-popup-row">
                  <span>Speed</span>
                  <strong>${vehicle.speed || 0} km/h</strong>
                </div>
                <div class="beacon-popup-row">
                  <span>Location</span>
                  <strong>${vehicle.address || 'N/A'}</strong>
                </div>
              </div>
            </div>
          `)
          .addTo(markersRef.current!);

        bounds.push([lat, lng]);
      });

      // Only fit bounds on initial load or when vehicle count changes significantly
      const prevCount = prevVehiclesRef.current.length;
      if (prevCount === 0 && bounds.length > 0) {
        mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [80, 80], maxZoom: 15 });
      }

      prevVehiclesRef.current = [...vehicles];
    }
  }, [vehicles, onVehicleClick, isDark, createMarkerIcon, flyToVehicle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="beacon-map-container" ref={mapContainerRef} />
  );
}
