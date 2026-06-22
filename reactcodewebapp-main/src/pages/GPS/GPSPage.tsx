import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useUnifiedGPS } from '../../hooks/useUnifiedGPS';
import { GPSMap } from './GPSMap';
import L from 'leaflet';

export function GPSPage({ active }: { active: boolean }) {
  const { showToast } = useApp();
  const { vehicles, initialLoading, refetch, loading } = useUnifiedGPS();
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (active) refetch();
  }, [active, refetch]);

  const handleVehicleSelect = (v: any) => {
    setSelectedVehicle(v);
    if (mapRef.current && v.latitude && v.longitude) {
      mapRef.current.setView([v.latitude, v.longitude], 15);
    }
  };

  const handleRefresh = () => {
    refetch();
    showToast('Refreshing GPS data...', 'info');
  };

  return (
    <div className={`page gps-page ${active ? 'active' : ''}`} id="page-gps">
      <div className="gps-sync-bar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Live GPS</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>
            {loading ? 'Updating...' : `Tracking ${vehicles.length} assets`}
          </p>
        </div>
        <button className="btn-sm accent" onClick={handleRefresh} disabled={loading}>
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div className="gps-iframe-wrap">
        <GPSMap 
          vehicles={vehicles} 
          onVehicleSelect={handleVehicleSelect} 
          selectedVehicle={selectedVehicle}
          mapRef={mapRef}
        />
      </div>
      
      {initialLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>
          Loading GPS data...
        </div>
      )}
    </div>
  );
}
