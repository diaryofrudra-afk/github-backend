import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Modal } from '../../components/ui/Modal';
import { GPSMap } from '../GPS/GPSMap';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import type { Crane } from '../../types';

interface LiveTrackModalProps {
  open: boolean;
  onClose: () => void;
  crane: Crane | null;
  vehicle?: UnifiedVehicle;
}

const noop = () => {};

export function LiveTrackModal({ open, onClose, crane, vehicle }: LiveTrackModalProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Leaflet renders at zero size inside a freshly-shown modal — nudge it once visible.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [open, vehicle]);

  if (!crane) return null;

  const subtitle = crane.operator || crane.site || crane.type || '';
  const hasLocation =
    !!vehicle &&
    vehicle.latitude != null &&
    vehicle.longitude != null &&
    (vehicle.latitude !== 0 || vehicle.longitude !== 0);

  const footerBits = vehicle
    ? [
        vehicle.speed != null ? `${Math.round(vehicle.speed)} km/h` : null,
        vehicle.last_updated ? `Updated ${vehicle.last_updated}` : null,
        vehicle.address || null,
      ].filter(Boolean)
    : [];

  return (
    <Modal open={open} onClose={onClose} title={crane.reg} subtitle={subtitle} maxWidth="720px">
      {hasLocation ? (
        <>
          <div style={{ position: 'relative', height: 420, borderRadius: 12, overflow: 'hidden' }}>
            <GPSMap
              vehicles={vehicle ? [vehicle] : []}
              selectedVehicle={vehicle}
              onVehicleSelect={noop}
              mapRef={mapRef}
            />
          </div>
          {footerBits.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted, #64748b)' }}>
              {footerBits.join(' · ')}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            height: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 8,
            color: 'var(--muted, #64748b)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>No live location available</div>
          <div style={{ fontSize: 12, maxWidth: 360 }}>
            This vehicle isn't reporting GPS data yet. Connect or sync its GPS provider
            (Blackbuck / Trak N Tell / WheelsEye) from the GPS page to enable live tracking.
          </div>
        </div>
      )}
    </Modal>
  );
}
